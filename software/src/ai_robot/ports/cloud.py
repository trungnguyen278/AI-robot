# SPDX-License-Identifier: MIT
"""The link to the cloud, ``ai-robot-server`` (protocol/cloud/README.md)."""

from __future__ import annotations

import re
from abc import abstractmethod
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from ai_robot.core.data import Schema, frozen
from ai_robot.ports.base import Port

# Names of capabilities and events, as MCP allows for tool names.
NAME = re.compile(r"[A-Za-z0-9_.-]{1,128}")


class SafetyClass(StrEnum):
    """How much a capability can affect people, which the robot enforces itself
    whatever the cloud asks (protocol/cloud/requirements.md, SEC-8 and SEC-9)."""

    INFORMATIONAL = "informational"  # the screen, sounds
    PRIVACY = "privacy"  # the camera; a turn the cloud starts by itself
    PHYSICAL = "physical"  # motion
    SYSTEM = "system"  # reboot, update, settings


def _name(kind: str, name: str) -> str:
    if not (isinstance(name, str) and NAME.fullmatch(name)):
        raise ValueError(
            f"{kind} name must be 1 to 128 letters, digits, '_', '.' or '-', got {name!r}"
        )
    return name


@dataclass(frozen=True, slots=True)
class Capability:
    """Something the robot does when the cloud asks: an MCP tool.

    ``name`` starts with the owning module's name (``screen.show_scene``). The schemas
    are JSON Schema 2020-12, kept as deep, read-only copies: ``input_schema`` describes
    the arguments, an object; ``output_schema``, if any, the result's data. ``version``
    changes when the meaning does (EXT-7).
    """

    name: str
    description: str
    input_schema: Mapping[str, Any]
    safety: SafetyClass
    version: int = 1
    output_schema: Mapping[str, Any] | None = None
    title: str | None = None

    def __post_init__(self) -> None:
        _name("capability", self.name)
        object.__setattr__(self, "safety", SafetyClass(self.safety))
        if isinstance(self.version, bool) or not (
            isinstance(self.version, int) and self.version >= 1
        ):
            raise ValueError(f"version must be a whole number from 1, got {self.version!r}")
        schema = frozen(f"{self.name} input_schema", self.input_schema)
        if schema.get("type") != "object":
            raise ValueError(f"{self.name} input_schema must describe an object")
        Schema(f"{self.name} input_schema", schema)
        object.__setattr__(self, "input_schema", schema)
        if self.output_schema is not None:
            output = frozen(f"{self.name} output_schema", self.output_schema)
            Schema(f"{self.name} output_schema", output)
            object.__setattr__(self, "output_schema", output)


@dataclass(frozen=True, slots=True)
class EventKind:
    """An event the robot can send to the cloud: its name and the JSON Schema of its
    data (EXT-6)."""

    name: str
    description: str
    schema: Mapping[str, Any] = field(default_factory=lambda: {"type": "object"})

    def __post_init__(self) -> None:
        _name("event", self.name)
        schema = frozen(f"{self.name} schema", self.schema)
        Schema(f"{self.name} schema", schema)
        object.__setattr__(self, "schema", schema)


@dataclass(frozen=True, slots=True)
class ToolCall:
    """The cloud asks the robot to run a capability."""

    id: str  # unique among the calls the link has received
    name: str
    arguments: Mapping[str, Any]  # not checked yet against the capability's input schema

    def __post_init__(self) -> None:
        object.__setattr__(self, "arguments", frozen("arguments", self.arguments))


@dataclass(frozen=True, slots=True)
class CallCancelled:
    """The cloud no longer wants the result of a call."""

    id: str


@dataclass(frozen=True, slots=True)
class LinkStatus:
    """Whether a session with the cloud is open, and which events it subscribed to."""

    online: bool
    session: str | None = None
    events: frozenset[str] = frozenset()


class Cloud(Port):
    """The link to the cloud. The cloud drives the robot through the capabilities the
    robot offers, and receives the events it subscribed to.

    The link opens no session until ``offer`` has been called, so that the first
    session already lists everything the robot can do. It reconnects on its own after
    a loss; ``status`` tells when the session opens and closes.
    """

    @abstractmethod
    async def offer(self, capabilities: Sequence[Capability], events: Sequence[EventKind]) -> None:
        """Set what the robot offers. A change of ``capabilities`` reaches the cloud at
        once; a change of ``events``, at the next session."""

    @abstractmethod
    async def request(self) -> ToolCall | CallCancelled:
        """Wait for the next call from the cloud, or the cancellation of one."""

    @abstractmethod
    async def reply(
        self,
        call: ToolCall,
        *,
        data: Mapping[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        """Answer ``call`` with the result's ``data``, or with an ``error`` the cloud can
        read. A reply after the session ended is dropped."""

    @abstractmethod
    async def emit(self, name: str, data: Mapping[str, Any]) -> None:
        """Send an event, if a session is open and the cloud subscribed to it."""

    @abstractmethod
    async def status(self) -> LinkStatus:
        """Wait for the next change of the link's status."""
