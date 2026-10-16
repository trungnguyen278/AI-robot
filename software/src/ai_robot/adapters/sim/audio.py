# SPDX-License-Identifier: MIT
"""Simulated microphones and speaker."""

from __future__ import annotations

import asyncio
import contextlib

from ai_robot.adapters.sim.pacing import Pacer
from ai_robot.core.checks import positive
from ai_robot.ports.audio import AudioFormat, AudioIn, AudioOut


class SimAudioIn(AudioIn):
    """Microphones that hear silence, delivered in real time."""

    def __init__(self, *, sample_rate: int, channels: int, chunk_ms: int) -> None:
        self._format = AudioFormat(sample_rate, channels)
        frames = sample_rate * positive("chunk_ms", chunk_ms) // 1000
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

    def __init__(self, *, sample_rate: int, channels: int, buffer_ms: float) -> None:
        self._format = AudioFormat(sample_rate, channels)
        self._buffer = positive("buffer_ms", buffer_ms) / 1000
        self._ends_at = 0.0  # event loop time at which the queued audio has been played
        self._dropped = asyncio.Event()  # set, then replaced, by every drop()
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
        await self._sleep_until(self._ends_at - self._buffer)

    async def drain(self) -> None:
        await self._sleep_until(self._ends_at)

    async def drop(self) -> None:
        self._ends_at = 0.0
        self._dropped.set()  # wakes the callers still waiting for the discarded audio
        self._dropped = asyncio.Event()

    async def _sleep_until(self, deadline: float) -> None:
        """Sleep until ``deadline`` (event loop time), or until ``drop`` is called."""
        delay = deadline - asyncio.get_running_loop().time()
        if delay > 0:
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._dropped.wait(), delay)
