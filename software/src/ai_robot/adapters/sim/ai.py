# SPDX-License-Identifier: MIT
"""Stand-in for the AI backend."""

from __future__ import annotations

from ai_robot.ports.ai import AIBackend
from ai_robot.ports.audio import AudioClip, AudioFormat


class StubAIBackend(AIBackend):
    """Understands nothing and says nothing, until a real backend exists."""

    async def transcribe(self, speech: AudioClip) -> str:
        return ""

    async def reply(self, text: str) -> str:
        return ""

    async def synthesize(self, text: str) -> AudioClip:
        return AudioClip(AudioFormat(sample_rate=16000, channels=1), b"")
