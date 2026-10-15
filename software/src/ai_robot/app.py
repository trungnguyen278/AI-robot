# SPDX-License-Identifier: MIT
"""The application: builds the robot from the configuration and runs it."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine, Iterable, Mapping
from typing import Any

from ai_robot.adapters import create_adapter
from ai_robot.core.bus import Bus
from ai_robot.core.config import ConfigError, get_table
from ai_robot.core.factory import create, import_object
from ai_robot.core.module import Module, ModuleContext, RobotInfo
from ai_robot.modules import MODULES
from ai_robot.ports import Port

log = logging.getLogger(__name__)

CLEANUP_TIMEOUT = 5.0  # seconds allowed for each step of the shutdown


class ModuleError(Exception):
    """A module failed, so the robot was stopped."""


class App:
    """The robot: the enabled modules, the adapters of the ports they own, and the bus.

    An App runs once; create a new one to run the robot again.
    """

    def __init__(self, config: Mapping[str, Any]) -> None:
        self.config = config
        self.bus = Bus()
        self.robot = RobotInfo(display_name="")
        self.adapters: dict[str, Port] = {}
        self.modules: list[Module] = []
        self._built = False
        self._ran = False

    def build(self) -> None:
        """Create the enabled modules and the adapters of the ports they own.

        Any mistake in the configuration raises ``ConfigError`` here, before any
        hardware is touched.
        """
        if self._built:
            return
        robot_table = get_table(self.config, "robot")
        modules_table = get_table(self.config, "modules")
        ports_table = get_table(self.config, "ports")
        robot = RobotInfo(display_name=str(robot_table.get("display_name", "Robot")))

        enabled = modules_table.get("enabled", [])
        if not isinstance(enabled, list) or not all(isinstance(name, str) for name in enabled):
            raise ConfigError("modules.enabled must be a list of module names")
        classes: dict[str, type[Module]] = {}
        owners: dict[str, str] = {}
        for name in enabled:
            if name not in MODULES:
                known = ", ".join(sorted(MODULES))
                raise ConfigError(f"modules.enabled: unknown module {name!r} (known: {known})")
            if name in classes:
                raise ConfigError(f"modules.enabled: {name!r} is listed twice")
            classes[name] = cls = import_object(MODULES[name])
            for port in cls.owns:
                if port in owners:
                    raise ConfigError(
                        f"port {port!r} is claimed by both {owners[port]!r} and {name!r}"
                    )
                owners[port] = name

        adapters: dict[str, Port] = {}
        for port, owner in owners.items():
            if port not in ports_table:
                raise ConfigError(f"[ports.{port}] is missing; module {owner!r} needs it")
            adapters[port] = create_adapter(port, get_table(ports_table, port, f"ports.{port}"))

        modules: list[Module] = []
        for name, cls in classes.items():
            ctx = ModuleContext(
                name=name,
                bus=self.bus,
                ports={port: adapters[port] for port in cls.owns},
                robot=robot,
                log=logging.getLogger(f"ai_robot.modules.{name}"),
            )
            settings = get_table(modules_table, name, f"modules.{name}")
            modules.append(create(cls, f"modules.{name}", ctx, **settings))

        self.robot, self.adapters, self.modules = robot, adapters, modules
        self._built = True

    async def run(self, stop: asyncio.Event) -> None:
        """Run the robot until ``stop`` is set.

        Setting ``stop`` also interrupts the startup (opening the adapters, starting the
        modules). If an adapter or a module fails, the robot is stopped the same way and
        the error is raised (``ModuleError`` for a module). Whatever happens, every
        started module is stopped and every opened adapter closed, in reverse order, each
        step within ``CLEANUP_TIMEOUT`` seconds.
        """
        if self._ran:
            raise RuntimeError("an App runs only once; create a new one")
        self._ran = True
        self.build()
        opened: list[Port] = []
        started: list[Module] = []
        try:
            startup = asyncio.create_task(self._start(opened, started), name="startup")
            if not await _until_stopped([startup], stop):
                return
            log.info("running: %s", ", ".join(module.name for module in self.modules))
            tasks = [
                asyncio.create_task(_run_module(module), name=f"module {module.name}")
                for module in self.modules
            ]
            if await _until_stopped(tasks, stop):
                await stop.wait()  # every module has returned: wait until stopped
        finally:
            for module in reversed(started):
                await _cleanup(module.stop(), f"stopping module {module.name!r}")
            for adapter in reversed(opened):
                await _cleanup(adapter.close(), f"closing {type(adapter).__name__}")
            log.info("stopped")

    async def _start(self, opened: list[Port], started: list[Module]) -> None:
        """Open every adapter, then start every module, recording each success."""
        for adapter in self.adapters.values():
            await adapter.open()
            opened.append(adapter)
        for module in self.modules:
            try:
                await module.start()
            except Exception as error:
                raise ModuleError(f"module {module.name!r} failed to start") from error
            started.append(module)


async def _run_module(module: Module) -> None:
    try:
        await module.run()
    except Exception as error:
        raise ModuleError(f"module {module.name!r} failed") from error
    log.info("module %r has nothing more to do", module.name)


async def _until_stopped(tasks: list[asyncio.Task[None]], stop: asyncio.Event) -> bool:
    """Wait until every task has finished (return True) or ``stop`` is set (False).

    If a task fails, its error is raised. On the way out, the tasks still running are
    cancelled.
    """
    stopping = asyncio.create_task(stop.wait(), name="stop")
    pending = set(tasks)
    try:
        while pending and not stopping.done():
            done, pending = await asyncio.wait(
                {stopping, *pending}, return_when=asyncio.FIRST_COMPLETED
            )
            pending.discard(stopping)
            errors: list[tuple[str, BaseException]] = []
            for task in done - {stopping}:
                if not task.cancelled() and (error := task.exception()) is not None:
                    errors.append((task.get_name(), error))
            for name, error in errors[1:]:
                log.error("%s also failed", name, exc_info=error)
            if errors:
                raise errors[0][1]
        return not stop.is_set()
    finally:
        await _cancel([stopping, *pending])


async def _cancel(tasks: Iterable[asyncio.Task[Any]]) -> None:
    """Cancel ``tasks`` and wait up to ``CLEANUP_TIMEOUT`` seconds for them to finish.

    Errors raised while they finish are logged. A task that ignores its cancellation is
    logged and left behind, so that the shutdown can go on.
    """
    running = [task for task in tasks if not task.done()]
    if not running:
        return
    for task in running:
        task.cancel()
    done, pending = await asyncio.wait(running, timeout=CLEANUP_TIMEOUT)
    for task in done:
        if not task.cancelled() and task.exception() is not None:
            log.error("%s failed while stopping", task.get_name(), exc_info=task.exception())
    for task in pending:
        log.error(
            "%s did not stop within %s s; leaving it behind", task.get_name(), CLEANUP_TIMEOUT
        )


async def _cleanup(step: Coroutine[Any, Any, None], what: str) -> None:
    """Run one shutdown step for up to ``CLEANUP_TIMEOUT`` seconds, logging its failure
    instead of raising it, so that the remaining steps still run."""
    task = asyncio.create_task(step, name=what)
    await asyncio.wait([task], timeout=CLEANUP_TIMEOUT)
    if not task.done():
        task.cancel()
        task.add_done_callback(_consume)
        log.error("%s took more than %s s; moving on", what, CLEANUP_TIMEOUT)
    elif not task.cancelled() and task.exception() is not None:
        log.error("error while %s", what, exc_info=task.exception())


def _consume(task: asyncio.Task[Any]) -> None:
    """Retrieve the outcome of a task nobody waits for, so asyncio does not warn about it."""
    if not task.cancelled():
        task.exception()
