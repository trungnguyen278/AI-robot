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
from ai_robot.ports.audio import AudioFormat
from ai_robot.ports.base import Port

# Names of capabilities and events, as MCP allows for tool names.
NAME = re.compile(r"[A-Za-z0-9_.-]{1,128}")
MAX_ID = 64  # characters in the identifier of a turn or a response ($defs/id in schema.json)


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


# ---- Conversations: turns, responses and their audio ----


@dataclass(frozen=True, slots=True)
class MediaFormat:
    """An audio format of the link: a codec, its sample rate and channels, and the
    duration of one frame, which is one binary message (protocol/cloud/README.md, Media)."""

    codec: str
    rate: int  # samples per second
    channels: int
    frame_ms: float

    @property
    def pcm(self) -> AudioFormat:
        """The PCM the robot exchanges with the link in this format."""
        return AudioFormat(self.rate, self.channels)


# The format every robot that streams audio offers and every cloud accepts, the
# protocol's baseline (NEG-3): 16-bit PCM at 16 kHz, mono, in 20 ms frames.
BASELINE = MediaFormat("pcm_s16le", 16000, 1, 20)


class Trigger(StrEnum):
    """What started a turn."""

    WAKE_WORD = "wake_word"
    TAP = "tap"
    BUTTON = "button"
    FOLLOW_UP = "follow_up"  # the cloud asked the robot to listen again
    BARGE_IN = "barge_in"  # the user spoke over the robot


@dataclass(frozen=True, slots=True)
class TurnStart:
    """Someone speaks to the robot: a turn begins. ``turn`` identifies it, uniquely in
    the session; ``context`` is a snapshot of the robot's situation (IO-4), which the
    cloud module fills in."""

    turn: str
    trigger: Trigger
    context: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not (isinstance(self.turn, str) and 0 < len(self.turn) <= MAX_ID):
            raise ValueError(f"turn must be 1 to {MAX_ID} characters, got {self.turn!r}")
        object.__setattr__(self, "trigger", Trigger(self.trigger))
        object.__setattr__(self, "context", frozen("context", self.context))


@dataclass(frozen=True, slots=True)
class Speech:
    """What the user says during a turn: PCM in the format of the speech stream."""

    turn: str
    pcm: bytes


@dataclass(frozen=True, slots=True)
class SpeechEnd:
    """The user has finished speaking, as the robot or the cloud decided: the robot
    stops streaming."""

    turn: str


@dataclass(frozen=True, slots=True)
class TurnCancel:
    """The turn is abandoned: by the robot, by the cloud, or with the session."""

    turn: str
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class Interrupted:
    """The user spoke over a response, once ``played_ms`` of it had been played."""

    response: str
    played_ms: int

    def __post_init__(self) -> None:
        if isinstance(self.played_ms, bool) or not (
            isinstance(self.played_ms, int) and self.played_ms >= 0
        ):
            raise ValueError(f"played_ms must be a whole number from 0, got {self.played_ms!r}")


@dataclass(frozen=True, slots=True)
class ResponseStart:
    """An answer begins. ``turn`` is the turn it answers, or ``None`` for an answer no
    turn asked for, such as a reminder."""

    response: str
    turn: str | None


@dataclass(frozen=True, slots=True)
class ResponseText:
    """A piece of the text of an answer's speech."""

    response: str
    delta: str


@dataclass(frozen=True, slots=True)
class Voice:
    """A piece of an answer's speech: PCM in the format of the voice stream. ``last``
    marks the end of the answer's speech."""

    response: str
    pcm: bytes
    last: bool = False


@dataclass(frozen=True, slots=True)
class ResponseEnd:
    """The answer is complete: no more of it will come. ``follow_up`` asks the robot to
    listen again once it has played the answer."""

    response: str
    follow_up: bool


@dataclass(frozen=True, slots=True)
class ResponseStop:
    """Stop playing an answer at once, and drop what is left of it."""

    response: str


# The robot's part of a conversation, and the cloud's, each in the order it happens.
RobotPart = TurnStart | Speech | SpeechEnd | TurnCancel | Interrupted
CloudPart = (
    SpeechEnd | TurnCancel | ResponseStart | ResponseText | Voice | ResponseEnd | ResponseStop
)


@dataclass(frozen=True, slots=True)
class LinkStatus:
    """Whether a session with the cloud is open, which events it subscribed to, and the
    formats of the audio streams the cloud accepted: ``speech``, what the user says,
    and ``voice``, what the robot says. A stream is ``None`` if the cloud declined it
    or the robot did not offer it."""

    online: bool
    session: str | None = None
    events: frozenset[str] = frozenset()
    speech: MediaFormat | None = None
    voice: MediaFormat | None = None


class Cloud(Port):
    """The link to the cloud. The cloud drives the robot through the capabilities the
    robot offers, receives the events it subscribed to, and holds conversations with
    it: in a turn the robot streams what the user says, and in a response the cloud
    streams what the robot says.

    Like every port, it inherits ``open`` and ``close`` from ``Port``, and the
    application calls them:
    - ``open``, before the modules start, only prepares the link. The ``websocket``
      adapter loads the protocol's schema and starts the task that connects; the
      ``sim`` adapter needs nothing, so it keeps ``Port``'s empty ``open``.
    - ``close``, after the modules stop, ends the session.

    The link opens no session until ``offer`` has been called, so that the first
    session already lists everything the robot can do. It reconnects on its own after
    a loss; ``status`` tells when the session opens and closes.
    """

    @abstractmethod
    async def offer(
        self,
        capabilities: Sequence[Capability],
        events: Sequence[EventKind],
        *,
        conversation: bool = False,
    ) -> None:
        """Set what the robot offers. ``conversation`` offers the audio streams: a
        module takes turns and plays the answers. A change of ``capabilities`` reaches
        the cloud at once; a change of ``events`` or ``conversation``, at the next
        session."""

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

    @abstractmethod
    async def converse(self, part: RobotPart) -> None:
        """Send the robot's next part of a conversation. A turn that cannot start, with
        no session or no speech stream, comes back at once from ``conversation`` as a
        ``TurnCancel``; speech for a turn that is over is dropped."""

    @abstractmethod
    async def conversation(self) -> CloudPart:
        """Wait for the cloud's next part of a conversation. When the session ends, the
        turn and the response in progress end with it: a ``TurnCancel`` and a
        ``ResponseEnd`` follow."""
