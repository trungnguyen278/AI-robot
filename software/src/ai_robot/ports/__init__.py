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
from ai_robot.ports.binding import Binding, BindingStore
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
from ai_robot.ports.listening import VoiceActivity, WakeWord
from ai_robot.ports.network import (
    JoinError,
    JoinFailure,
    Network,
    NetworkState,
    NetworkStatus,
    Security,
    WifiNetwork,
)
from ai_robot.ports.screen import Screen, ScreenState, Touch
from ai_robot.ports.setup import Connected, Disconnected, LinkEvent, Received, SetupLink

# The port names used in the configuration ([ports.<name>]) and in Module.owns.
PORT_TYPES: dict[str, type[Port]] = {
    "audio_in": AudioIn,
    "audio_out": AudioOut,
    "wake_word": WakeWord,
    "voice_activity": VoiceActivity,
    "camera": Camera,
    "screen": Screen,
    "cloud": Cloud,
    "identity": Identity,
    "binding": BindingStore,
    "setup_link": SetupLink,
    "network": Network,
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
    "Binding",
    "BindingStore",
    "CallCancelled",
    "Camera",
    "Capability",
    "Cloud",
    "CloudPart",
    "Color",
    "Connected",
    "ConversationAudio",
    "Daylight",
    "Disconnected",
    "DriveBase",
    "EventKind",
    "Frame",
    "Identity",
    "Image",
    "Interrupted",
    "JoinError",
    "JoinFailure",
    "JointInfo",
    "Joints",
    "Lights",
    "LinkEvent",
    "LinkStatus",
    "Network",
    "NetworkState",
    "NetworkStatus",
    "Port",
    "Pose",
    "Power",
    "RangeSensor",
    "Received",
    "ResponseEnd",
    "ResponseStart",
    "ResponseStop",
    "ResponseText",
    "RobotPart",
    "Safety",
    "SafetyClass",
    "Screen",
    "ScreenState",
    "Security",
    "SetupLink",
    "Speech",
    "SpeechEnd",
    "SunTimes",
    "ToolCall",
    "Touch",
    "Trigger",
    "TurnCancel",
    "TurnStart",
    "Voice",
    "VoiceActivity",
    "WakeWord",
    "WifiNetwork",
]
