# SPDX-License-Identifier: MIT
"""Microphones and speaker through PortAudio (docs/decisions/0013-listening-on-the-robot.md).

PortAudio calls back from a thread of its own, every chunk. The adapters hand the audio
over to the event loop, and never block that thread.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any

import sounddevice

from ai_robot.core.checks import positive
from ai_robot.ports.audio import AudioFormat, AudioIn, AudioOut

log = logging.getLogger(__name__)

# How this implementation works, which nobody needs to tune.
BACKLOG_SECONDS = 2.0  # captured audio kept for a reader that falls behind; older is dropped


def _device(device: str) -> str | None:
    """PortAudio's device: ``default`` is the system's own, PipeWire's on the robot."""
    if not device:
        raise ValueError("device must name the device, or be 'default'")
    return None if device == "default" else device


class PortAudioIn(AudioIn):
    """Microphones: the input ``device``, in chunks of ``chunk_ms`` milliseconds."""

    def __init__(self, *, device: str, sample_rate: int, channels: int, chunk_ms: int) -> None:
        self.device = _device(device)
        self._format = AudioFormat(sample_rate, channels)
        self._frames = sample_rate * positive("chunk_ms", chunk_ms) // 1000
        if self._frames < 1:
            raise ValueError(f"chunk_ms is shorter than a frame at {sample_rate} Hz")
        self._chunks: asyncio.Queue[bytes] = asyncio.Queue(
            max(1, round(BACKLOG_SECONDS * 1000 / chunk_ms))
        )
        self._loop: asyncio.AbstractEventLoop | None = None
        self._stream: sounddevice.RawInputStream | None = None
        self._dropped = 0  # chunks dropped since the last report

    @property
    def format(self) -> AudioFormat:
        return self._format

    async def open(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._stream = await asyncio.to_thread(self._start)

    async def close(self) -> None:
        stream, self._stream = self._stream, None
        if stream is not None:
            await asyncio.to_thread(_stop, stream)

    async def read(self) -> bytes:
        return await self._chunks.get()

    def _start(self) -> sounddevice.RawInputStream:
        stream = sounddevice.RawInputStream(
            device=self.device,
            samplerate=self._format.sample_rate,
            channels=self._format.channels,
            dtype="int16",
            blocksize=self._frames,
            callback=self._captured,
        )
        stream.start()
        return stream

    def _captured(self, data: Any, frames: int, time: Any, status: Any) -> None:
        # PortAudio's thread: hand the chunk over, and return at once.
        assert self._loop is not None
        self._loop.call_soon_threadsafe(self._keep, bytes(data))

    def _keep(self, chunk: bytes) -> None:
        if self._chunks.full():  # the reader fell behind: drop the oldest
            self._chunks.get_nowait()
            self._dropped += 1
            if self._dropped == 1:
                log.warning("the microphones' reader fell behind; dropping old audio")
        else:
            self._dropped = 0
        self._chunks.put_nowait(chunk)


class PortAudioOut(AudioOut):
    """A speaker: the output ``device``, with up to ``buffer_ms`` milliseconds queued
    before ``write`` waits."""

    def __init__(self, *, device: str, sample_rate: int, channels: int, buffer_ms: float) -> None:
        self.device = _device(device)
        self._format = AudioFormat(sample_rate, channels)
        buffered = positive("buffer_ms", buffer_ms) * self._format.bytes_per_second / 1000
        self._limit = round(buffered) // self._format.frame_bytes * self._format.frame_bytes
        self._lock = threading.Lock()  # guards what PortAudio's thread shares
        self._queued = bytearray()
        self._written = 0  # bytes ever queued
        self._played = 0  # bytes ever handed to the device, or dropped
        self._loop: asyncio.AbstractEventLoop | None = None
        self._progress = asyncio.Event()  # set when the device has taken some audio
        self._stream: sounddevice.RawOutputStream | None = None
        self._closed = False  # once closed, nothing waits for the device any more

    @property
    def format(self) -> AudioFormat:
        return self._format

    async def open(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._stream = await asyncio.to_thread(self._start)

    async def close(self) -> None:
        stream, self._stream = self._stream, None
        if stream is not None:
            await asyncio.to_thread(_stop, stream)
        self._closed = True
        self._progress.set()  # wakes whoever waits for the device

    async def write(self, pcm: bytes) -> None:
        if len(pcm) % self._format.frame_bytes:
            raise ValueError("PCM data must contain whole frames")
        with self._lock:
            self._queued.extend(pcm)
            self._written += len(pcm)
        while not self._closed:
            with self._lock:
                if len(self._queued) <= self._limit:
                    return
            await self._wait()

    async def drain(self) -> None:
        with self._lock:
            target = self._written
        while not self._closed:
            with self._lock:
                if self._played >= target:
                    break
            await self._wait()
        # What the device took still has to come out of it.
        stream = self._stream
        if stream is not None:
            await asyncio.sleep(stream.latency)

    async def drop(self) -> None:
        with self._lock:
            self._played += len(self._queued)
            self._queued.clear()
        self._progress.set()

    async def _wait(self) -> None:
        self._progress.clear()
        await self._progress.wait()

    def _start(self) -> sounddevice.RawOutputStream:
        stream = sounddevice.RawOutputStream(
            device=self.device,
            samplerate=self._format.sample_rate,
            channels=self._format.channels,
            dtype="int16",
            callback=self._feed,
        )
        stream.start()
        return stream

    def _feed(self, out: Any, frames: int, time: Any, status: Any) -> None:
        # PortAudio's thread: give the device what is queued, silence for the rest.
        wanted = len(out)
        with self._lock:
            given = min(wanted, len(self._queued))
            out[:given] = self._queued[:given]
            del self._queued[:given]
            self._played += given
        if given < wanted:
            out[given:] = bytes(wanted - given)
        assert self._loop is not None
        self._loop.call_soon_threadsafe(self._progress.set)


def _stop(stream: sounddevice.RawInputStream | sounddevice.RawOutputStream) -> None:
    try:
        stream.stop()
    finally:
        stream.close()
