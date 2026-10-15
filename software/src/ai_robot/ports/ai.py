# SPDX-License-Identifier: MIT
"""AI services: speech recognition, conversation, speech synthesis."""

from __future__ import annotations

from abc import abstractmethod

from ai_robot.ports.audio import AudioClip
from ai_robot.ports.base import Port


class AIBackend(Port):
    """Speech recognition, conversation and speech synthesis: a cloud service, the
    future ``ai-robot-server`` or models running on the Pi.

    Provisional: refine this interface (streaming, separate services) together with
    the first real backend.
    """

    @abstractmethod
    async def transcribe(self, speech: AudioClip) -> str:
        """The text spoken in ``speech``; empty if nothing was understood."""

    @abstractmethod
    async def reply(self, text: str) -> str:
        """The robot's answer to what the user said."""

    @abstractmethod
    async def synthesize(self, text: str) -> AudioClip:
        """``text``, spoken."""
