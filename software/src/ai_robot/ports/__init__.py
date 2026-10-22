# SPDX-License-Identifier: MIT
"""Ports: the interfaces through which the software reaches hardware and services.

Each port is an abstract class; adapters (``ai_robot.adapters``) implement them. For
every port:

- Methods that talk to a device or a service are ``async``. An adapter that wraps a
  blocking library runs the blocking calls in a thread (``asyncio.to_thread``).
- Quantities are in SI units: metres, seconds, radians, volts.
"""

from ai_robot.ports.audio import AudioFormat, AudioIn, AudioOut
from ai_robot.ports.base import Port
from ai_robot.ports.body import (
    BatteryStatus,
    DriveBase,
    JointInfo,
    Joints,
    Lights,
    Pose,
    Power,
    RangeSensor,
    Safety,
)
from ai_robot.ports.camera import Camera, Frame
from ai_robot.ports.cloud import (
    CallCancelled,
    Capability,
    Cloud,
    CloudPart,
    ConversationAudio,
    EventKind,
    Interrupted,
    LinkStatus,
    ResponseEnd,
    ResponseStart,
    ResponseStop,
    ResponseText,
    RobotPart,
    SafetyClass,
    Speech,
    SpeechEnd,
    ToolCall,
    Trigger,
    TurnCancel,
    TurnStart,
    Voice,
)
from ai_robot.ports.daylight import Daylight, SunTimes
from ai_robot.ports.identity import Identity
from ai_robot.ports.image import Color, Image
from ai_robot.ports.screen import Screen, ScreenState, Touch

# The port names used in the configuration ([ports.<name>]) and in Module.owns.
PORT_TYPES: dict[str, type[Port]] = {
    "audio_in": AudioIn,
    "audio_out": AudioOut,
    "camera": Camera,
    "screen": Screen,
    "cloud": Cloud,
    "identity": Identity,
    "daylight": Daylight,
    "drive": DriveBase,
    "joints": Joints,
    "range": RangeSensor,
    "power": Power,
    "lights": Lights,
    "safety": Safety,
}

__all__ = [
    "PORT_TYPES",
    "AudioFormat",
    "AudioIn",
    "AudioOut",
    "BatteryStatus",
    "CallCancelled",
    "Camera",
    "Capability",
    "Cloud",
    "CloudPart",
    "Color",
    "ConversationAudio",
    "Daylight",
    "DriveBase",
    "EventKind",
    "Frame",
    "Identity",
    "Image",
    "Interrupted",
    "JointInfo",
    "Joints",
    "Lights",
    "LinkStatus",
    "Port",
    "Pose",
    "Power",
    "RangeSensor",
    "ResponseEnd",
    "ResponseStart",
    "ResponseStop",
    "ResponseText",
    "RobotPart",
    "Safety",
    "SafetyClass",
    "Screen",
    "ScreenState",
    "Speech",
    "SpeechEnd",
    "SunTimes",
    "ToolCall",
    "Touch",
    "Trigger",
    "TurnCancel",
    "TurnStart",
    "Voice",
]
