# SPDX-License-Identifier: MIT
"""Microphones and speaker."""

from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass

from ai_robot.ports.base import Port


@dataclass(frozen=True, slots=True)
class AudioFormat:
    """Signed 16-bit little-endian PCM, channels interleaved."""

    sample_rate: int  # frames per second
    channels: int

    def __post_init__(self) -> None:
        if self.sample_rate <= 0 or self.channels <= 0:
            raise ValueError(
                f"invalid audio format: {self.sample_rate} Hz, {self.channels} channel(s)"
            )

    @property
    def frame_bytes(self) -> int:
        """Bytes per frame: one sample for each channel."""
        return 2 * self.channels

    @property
    def bytes_per_second(self) -> int:
        return self.sample_rate * self.frame_bytes


class AudioIn(Port):
    """Microphones."""

    @property
    @abstractmethod
    def format(self) -> AudioFormat:
        """Format of the audio returned by ``read``."""

    @abstractmethod
    async def read(self) -> bytes:
        """Wait for the next chunk of audio and return it."""


class AudioOut(Port):
    """Speaker."""

    @property
    @abstractmethod
    def format(self) -> AudioFormat:
        """Format of the audio accepted by ``write``."""

    @abstractmethod
    async def write(self, pcm: bytes) -> None:
        """Queue audio for playback, waiting while the output buffer is full."""

    @abstractmethod
    async def drain(self) -> None:
        """Wait until all queued audio has been played."""

    @abstractmethod
    async def drop(self) -> None:
        """Stop playback at once and discard queued audio, e.g. when interrupted."""
