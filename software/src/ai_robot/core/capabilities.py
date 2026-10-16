# SPDX-License-Identifier: MIT
"""Offering capabilities and events from a module (protocol/cloud/README.md)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from typing import Any

from ai_robot.core.module import Module
from ai_robot.messages import (
    CapabilityCall,
    CapabilityOffered,
    CapabilityResult,
    EventOffered,
    RobotEvent,
)
from ai_robot.ports.cloud import Capability, EventKind

# Runs a capability: takes the call's arguments, already checked against the input
# schema, and returns the result's data. A ValueError's message goes back to the caller.
Handler = Callable[[Mapping[str, Any]], Awaitable[Mapping[str, Any]]]


class CapabilityHost:
    """The capabilities and events of one module.

    Create it in the module's ``__init__``, so that it subscribes to calls before any
    module starts; ``add`` the capabilities and events, ``offer`` them in ``start``, run
    ``serve`` in ``run`` and ``close`` it in ``stop``.
    """

    def __init__(self, module: Module) -> None:
        self._module = module
        self._handlers: dict[str, tuple[Capability, Handler]] = {}
        self._events: dict[str, EventKind] = {}
        self._calls = module.bus.subscribe(CapabilityCall)

    def add(self, capability: Capability, handler: Handler) -> None:
        """Run ``handler`` when ``capability`` is called."""
        self._handlers[capability.name] = (capability, handler)

    def add_event(self, kind: EventKind) -> None:
        """Declare an event the module sends with ``emit``."""
        self._events[kind.name] = kind

    def offer(self) -> None:
        """Tell the cloud module what this module offers."""
        owner = self._module.name
        for capability, _ in self._handlers.values():
            self._module.bus.publish(CapabilityOffered(owner, capability))
        for kind in self._events.values():
            self._module.bus.publish(EventOffered(owner, kind))

    def emit(self, name: str, data: Mapping[str, Any]) -> None:
        """Send a declared event to the cloud, if it subscribed to it."""
        if name not in self._events:
            raise ValueError(f"event {name!r} was not declared")
        self._module.bus.publish(RobotEvent(name, data))

    async def serve(self) -> None:
        """Answer the calls of this module's capabilities, one at a time.

        A handler's ``ValueError`` becomes an error for the caller; any other failure is
        logged and reported as an internal error, so that a faulty capability never
        stops the module.
        """
        async for call in self._calls:
            entry = self._handlers.get(call.name)
            if entry is None:
                continue
            try:
                data = await entry[1](call.arguments)
            except ValueError as error:
                result = CapabilityResult(call.call, error=str(error))
            except Exception:
                self._module.log.exception("capability %s failed", call.name)
                result = CapabilityResult(call.call, error="internal error")
            else:
                try:
                    result = CapabilityResult(call.call, data)
                except ValueError:
                    self._module.log.exception("capability %s returned bad data", call.name)
                    result = CapabilityResult(call.call, error="internal error")
            self._module.bus.publish(result)

    def close(self) -> None:
        self._calls.close()
