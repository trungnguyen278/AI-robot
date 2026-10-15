# SPDX-License-Identifier: MIT
"""Voice: listening and talking."""

from __future__ import annotations

from ai_robot import native
from ai_robot.core.module import Module, ModuleContext
from ai_robot.messages import SoundLevel
from ai_robot.ports import AIBackend, AudioIn, AudioOut


class VoiceModule(Module):
    """Listens and talks.

    Planned: wake word, voice activity detection, echo cancellation (so that the robot
    can be interrupted while it speaks) and the conversation with the AI backend.
    """

    owns = ("audio_in", "audio_out", "ai_backend")

    def __init__(self, ctx: ModuleContext) -> None:
        super().__init__(ctx)
        self.microphones = self.port("audio_in", AudioIn)
        self.speaker = self.port("audio_out", AudioOut)
        self.ai = self.port("ai_backend", AIBackend)

    async def run(self) -> None:
        while True:
            chunk = await self.microphones.read()
            self.bus.publish(SoundLevel(native.rms_int16(chunk)))

    async def stop(self) -> None:
        await self.speaker.drop()
