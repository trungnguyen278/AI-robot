# SPDX-License-Identifier: MIT
"""Simulated wake word and voice activity: for computers without the engines, whose
simulated microphones hear silence anyway."""

from __future__ import annotations

from ai_robot.ports.audio import AudioFormat
from ai_robot.ports.listening import VoiceActivity, WakeWord

# The audio the engines they stand in for take (docs/decisions/0013).
FORMAT = AudioFormat(16000, 1)


class SimWakeWord(WakeWord):
    """Spots no wake word."""

    @property
    def format(self) -> AudioFormat:
        return FORMAT

    async def spot(self, pcm: bytes) -> str | None:
        return None

    def reset(self) -> None:
        pass


class SimVoiceActivity(VoiceActivity):
    """Hears no voice."""

    @property
    def format(self) -> AudioFormat:
        return FORMAT

    async def voice(self, pcm: bytes) -> float:
        return 0.0

    def reset(self) -> None:
        pass
