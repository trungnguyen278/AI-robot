# SPDX-License-Identifier: MIT
"""What the robot hears on its own: its wake words, and voice
(docs/decisions/0013-listening-on-the-robot.md)."""

from __future__ import annotations

from abc import abstractmethod

from ai_robot.ports.audio import AudioFormat
from ai_robot.ports.base import Port


class WakeWord(Port):
    """Spots the robot's wake words in what its microphones hear.

    It takes audio in ``format``, in chunks of any whole number of frames, and keeps
    what it needs from one chunk to the next.
    """

    @property
    @abstractmethod
    def format(self) -> AudioFormat:
        """The audio ``spot`` takes."""

    @abstractmethod
    async def spot(self, pcm: bytes) -> str | None:
        """Listen to ``pcm``, which follows the previous chunk; return the wake word
        heard by the end of it, if any."""

    @abstractmethod
    def reset(self) -> None:
        """Forget what was heard, so that the same wake word is not spotted twice."""


class VoiceActivity(Port):
    """Tells voice from silence and noise in what the microphones hear.

    It takes audio in ``format``, in chunks of any whole number of frames. Its model
    looks at windows of its own length, so a chunk may complete none or several.
    """

    @property
    @abstractmethod
    def format(self) -> AudioFormat:
        """The audio ``voice`` takes."""

    @abstractmethod
    async def voice(self, pcm: bytes) -> float:
        """Listen to ``pcm``, which follows the previous chunk; return the probability,
        from 0 to 1, that the latest complete window holds voice."""

    @abstractmethod
    def reset(self) -> None:
        """Forget what was heard, before audio that does not follow the last chunk."""
