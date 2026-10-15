# SPDX-License-Identifier: MIT
"""The application: builds the robot from the configuration and runs it."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Mapping
from typing import Any

from ai_robot.adapters import create_adapter
from ai_robot.core.bus import Bus
from ai_robot.core.config import ConfigError
from ai_robot.core.factory import create, import_object
from ai_robot.core.module import Module, ModuleContext, RobotInfo
from ai_robot.modules import MODULES
from ai_robot.ports import Port

log = logging.getLogger(__name__)

CLEANUP_TIMEOUT = 5.0  # seconds allowed for each module's stop() and each adapter's close()


class ModuleError(Exception):
    """A module failed, so the robot was stopped."""


class App:
    """The robot: the enabled modules, the adapters of the ports they own, and the bus."""

    def __init__(self, config: Mapping[str, Any]) -> None:
        self.config = config
        self.bus = Bus()
        self.robot = RobotInfo(display_name="")
        self.adapters: dict[str, Port] = {}
        self.modules: list[Module] = []
        self._built = False

    def build(self) -> None:
        """Create the enabled modules and the adapters of the ports they own.

        Any mistake in the configuration raises ``ConfigError`` here, before any
        hardware is touched.
        """
        if self._built:
            return
        robot_table = _table(self.config, "robot")
        modules_table = _table(self.config, "modules")
        ports_table = _table(self.config, "ports")
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
            adapters[port] = create_adapter(port, _table(ports_table, port, f"ports.{port}"))

        modules: list[Module] = []
        for name, cls in classes.items():
            ctx = ModuleContext(
                name=name,
                bus=self.bus,
                ports={port: adapters[port] for port in cls.owns},
                robot=robot,
                log=logging.getLogger(f"ai_robot.modules.{name}"),
            )
            settings = _table(modules_table, name, f"modules.{name}")
            modules.append(create(cls, f"modules.{name}", ctx, **settings))

        self.robot, self.adapters, self.modules = robot, adapters, modules
        self._built = True

    async def run(self, stop: asyncio.Event) -> None:
        """Run the robot until ``stop`` is set.

        If a module fails, the robot is stopped in the same way and ``ModuleError`` is
        raised. Whatever happens, every started module is stopped and every opened
        adapter closed, in reverse order.
        """
        self.build()
        opened: list[Port] = []
        started: list[Module] = []
        try:
            for adapter in self.adapters.values():
                await adapter.open()
                opened.append(adapter)
            for module in self.modules:
                try:
                    await module.start()
                except Exception as error:
                    raise ModuleError(f"module {module.name!r} failed to start") from error
                started.append(module)
            log.info("running: %s", ", ".join(module.name for module in self.modules))
            await self._run_modules(stop)
        finally:
            for module in reversed(started):
                await _cleanup(module.stop(), f"stopping module {module.name!r}")
            for adapter in reversed(opened):
                await _cleanup(adapter.close(), f"closing {type(adapter).__name__}")
            log.info("stopped")

    async def _run_modules(self, stop: asyncio.Event) -> None:
        tasks = {
            asyncio.create_task(module.run(), name=f"module {module.name}"): module
            for module in self.modules
        }
        stopping = asyncio.create_task(stop.wait(), name="stop")
        try:
            running = set(tasks)
            while True:
                done, _ = await asyncio.wait(
                    {stopping, *running}, return_when=asyncio.FIRST_COMPLETED
                )
                for task in done - {stopping}:
                    running.discard(task)
                    name = tasks[task].name
                    if not task.cancelled() and (error := task.exception()) is not None:
                        raise ModuleError(f"module {name!r} failed") from error
                    log.info("module %r has nothing more to do", name)
                if stopping in done:
                    return
        finally:
            stopping.cancel()
            for task in tasks:
                task.cancel()
            await asyncio.gather(stopping, *tasks, return_exceptions=True)


async def _cleanup(step: Awaitable[None], what: str) -> None:
    """Await one shutdown step, logging its failure instead of raising it, so that the
    remaining steps still run."""
    try:
        async with asyncio.timeout(CLEANUP_TIMEOUT):
            await step
    except Exception:
        log.exception("error while %s", what)


def _table(parent: Mapping[str, Any], key: str, where: str | None = None) -> Mapping[str, Any]:
    """The table ``parent[key]``; empty if missing."""
    value = parent.get(key, {})
    if not isinstance(value, Mapping):
        raise ConfigError(f"{where or key} must be a table")
    return value
