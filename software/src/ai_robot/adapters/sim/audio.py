# SPDX-License-Identifier: MIT
"""Simulated microphones and speaker."""

from __future__ import annotations

import asyncio

from ai_robot.adapters.sim.pacing import Pacer
from ai_robot.ports.audio import AudioFormat, AudioIn, AudioOut


class SimAudioIn(AudioIn):
    """Microphones that hear silence, delivered in real time."""

    def __init__(self, *, sample_rate: int = 16000, channels: int = 1, chunk_ms: int = 20) -> None:
        if chunk_ms <= 0:
            raise ValueError("chunk_ms must be positive")
        self._format = AudioFormat(sample_rate, channels)
        frames = sample_rate * chunk_ms // 1000
        self._chunk = bytes(frames * self._format.frame_bytes)
        self._pacer = Pacer(chunk_ms / 1000)

    @property
    def format(self) -> AudioFormat:
        return self._format

    async def read(self) -> bytes:
        await self._pacer.wait()
        return self._chunk


class SimAudioOut(AudioOut):
    """A speaker that plays nothing, but takes as long as real playback would."""

    def __init__(
        self, *, sample_rate: int = 16000, channels: int = 1, buffer_ms: int = 200
    ) -> None:
        self._format = AudioFormat(sample_rate, channels)
        self._buffer = buffer_ms / 1000
        self._ends_at = 0.0  # event loop time at which the queued audio has been played
        self.bytes_written = 0

    @property
    def format(self) -> AudioFormat:
        return self._format

    async def write(self, pcm: bytes) -> None:
        if len(pcm) % self._format.frame_bytes:
            raise ValueError("PCM data must contain whole frames")
        now = asyncio.get_running_loop().time()
        self._ends_at = max(self._ends_at, now) + len(pcm) / self._format.bytes_per_second
        self.bytes_written += len(pcm)
        # Like a device buffer: block while more than buffer_ms of audio is queued.
        await asyncio.sleep(max(0.0, self._ends_at - now - self._buffer))

    async def drain(self) -> None:
        now = asyncio.get_running_loop().time()
        await asyncio.sleep(max(0.0, self._ends_at - now))

    async def drop(self) -> None:
        self._ends_at = 0.0
