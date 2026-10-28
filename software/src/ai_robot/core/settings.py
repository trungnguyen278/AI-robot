# SPDX-License-Identifier: MIT
"""Offering settings from a module (docs/decisions/0016-settings.md)."""

from __future__ import annotations

import dataclasses
from collections.abc import Awaitable, Callable
from typing import Any

from ai_robot.core.data import Schema
from ai_robot.core.module import Module
from ai_robot.messages import Setting, SettingChanged, SettingKind, SettingOffered

# Applies a setting's new value, already checked against its schema, or runs an action
# (with None). A ValueError means the value cannot be applied: it is logged.
Handler = Callable[[Any], Awaitable[None]]


class SettingsHost:
    """The settings of one module.

    Create it in the module's ``__init__``, so that it hears the values the owner chose
    before any module starts; ``add`` the settings, ``offer`` them in ``start``, apply
    what was kept with ``apply_pending`` before anything relies on it, run ``serve`` in
    ``run``, and ``close`` it in ``stop``.
    """

    def __init__(self, module: Module) -> None:
        self._module = module
        self._settings: dict[str, Setting] = {}
        self._handlers: dict[str, Handler] = {}
        self._schemas: dict[str, Schema] = {}
        self._changes = module.bus.subscribe(SettingChanged)

    def add(self, setting: Setting, handler: Handler | None = None) -> None:
        """Offer ``setting``. A value or an action needs the ``handler`` that applies
        it; a line of information has none."""
        if not setting.name.startswith(self._module.name + "."):
            raise ValueError(f"{setting.name} must start with {self._module.name}.")
        if (handler is None) != (setting.kind is SettingKind.INFO):
            raise ValueError(f"{setting.name}: a value or an action, and only they, need a handler")
        self._settings[setting.name] = setting
        if handler is not None:
            self._handlers[setting.name] = handler
        if setting.schema is not None:
            schema = Schema(f"{setting.name} schema", setting.schema)
            problem = schema.problem(setting.value)
            if problem is not None:
                raise ValueError(f"{setting.name}: its value breaks its schema: {problem}")
            self._schemas[setting.name] = schema

    def value(self, name: str) -> Any:
        return self._settings[name].value

    def offer(self) -> None:
        """Tell the settings module what this module offers."""
        for setting in self._settings.values():
            self._publish(setting)

    def update(self, name: str, value: Any) -> None:
        """Tell the settings module a new value, or a line's new text."""
        setting = dataclasses.replace(self._settings[name], value=value)
        if setting != self._settings[name]:
            self._settings[name] = setting
            self._publish(setting)

    async def apply_pending(self) -> None:
        """Apply the changes already waiting, such as the values kept from before a
        restart, without waiting for more."""
        while self._changes.pending:
            await self._apply(await self._changes.get())

    async def serve(self) -> None:
        """Apply this module's settings as the owner changes them, one at a time."""
        async for change in self._changes:
            await self._apply(change)

    def close(self) -> None:
        self._changes.close()

    async def _apply(self, change: SettingChanged) -> None:
        handler = self._handlers.get(change.name)
        if handler is None:
            return
        log = self._module.log
        schema = self._schemas.get(change.name)
        if schema is not None:
            problem = schema.problem(change.value)
            if problem is not None:
                log.warning("setting %s: refused %r: %s", change.name, change.value, problem)
                self._publish(self._settings[change.name])  # the screen shows it as it is
                return
        try:
            await handler(change.value)
        except ValueError as error:
            log.warning("setting %s: cannot apply %r: %s", change.name, change.value, error)
            self._publish(self._settings[change.name])
            return
        except Exception:  # a faulty setting never stops the module
            log.exception("setting %s failed", change.name)
            self._publish(self._settings[change.name])
            return
        if schema is not None:
            self.update(change.name, change.value)

    def _publish(self, setting: Setting) -> None:
        self._module.bus.publish(SettingOffered(self._module.name, setting))
