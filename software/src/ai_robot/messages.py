# SPDX-License-Identifier: MIT
"""Messages exchanged by the modules on the bus.

This file is the contract between modules: they publish and subscribe only to the
classes defined here. Each class is one topic.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from ai_robot.core.bus import Message
from ai_robot.ports.body import BatteryStatus


class InteractionState(StrEnum):
    """Where the robot is in a conversation (the same states as the previous generation)."""

    IDLE = "idle"
    TRIGGERED = "triggered"  # wake word heard
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"
    CANCELLING = "cancelling"


@dataclass(frozen=True, slots=True)
class InteractionChanged(Message):
    """The interaction state changed. Published by behavior."""

    state: InteractionState


@dataclass(frozen=True, slots=True)
class SoundLevel(Message):
    """Loudness of the latest microphone chunk. Published by voice."""

    rms: float  # root mean square of the 16-bit samples, from 0 to 32768


@dataclass(frozen=True, slots=True)
class BatteryReport(Message):
    """The battery's state. Published by system at a regular interval."""

    status: BatteryStatus
