# SPDX-License-Identifier: MIT
"""The microphones and the speaker through PortAudio, with streams that stand in for
PortAudio's: they call back from a thread of their own, as it does."""

from __future__ import annotations

import asyncio
import threading
from collections.abc import Callable
from typing import Any

import pytest

from ai_robot.adapters.portaudio import audio
from ai_robot.adapters.portaudio.audio import BACKLOG_SECONDS, PortAudioIn, PortAudioOut

CHUNK = 640  # 20 ms of 16 kHz mono
TIMEOUT = 2.0


class FakeInput:
    """A capture stream that delivers ``chunks`` from a thread once started."""

    def __init__(self, chunks: list[bytes], **settings: Any) -> None:
        self.callback: Callable[..., None] = settings.pop("callback")
        self.settings = settings
        self.chunks = chunks
        self.thread = threading.Thread(target=self._deliver)
        self.closed = False

    def start(self) -> None:
        self.thread.start()

    def _deliver(self) -> None:
        for chunk in self.chunks:
            self.callback(chunk, len(chunk) // 2, None, None)

    def stop(self) -> None:
        self.thread.join()

    def close(self) -> None:
        self.closed = True


class FakeOutput:
    """A playback stream whose device takes audio when the test says so."""

    def __init__(self, **settings: Any) -> None:
        self.callback: Callable[..., None] = settings.pop("callback")
        self.settings = settings
        self.latency = 0.0
        self.closed = False

    def start(self) -> None:
        pass

    def pull(self, frames: int) -> bytes:
        """What the device gets when it asks for ``frames`` frames."""
        out = bytearray(frames * 2)
        self.callback(out, frames, None, None)
        return bytes(out)

    def stop(self) -> None:
        pass

    def close(self) -> None:
        self.closed = True


def microphones(
    monkeypatch: pytest.MonkeyPatch, chunks: list[bytes], **settings: Any
) -> PortAudioIn:
    streams: list[FakeInput] = []

    def stream(**arguments: Any) -> FakeInput:
        streams.append(FakeInput(chunks, **arguments))
        return streams[-1]

    monkeypatch.setattr(audio.sounddevice, "RawInputStream", stream)
    adapter = PortAudioIn(
        **{
            "device": "default",
            "sample_rate": 16000,
            "channels": 1,
            "chunk_ms": 20,
            "echo_cancelled": False,
            **settings,
        }
    )
    adapter.streams = streams  # type: ignore[attr-defined]
    return adapter


def speaker(monkeypatch: pytest.MonkeyPatch, buffer_ms: float = 20.0) -> PortAudioOut:
    streams: list[FakeOutput] = []

    def stream(**arguments: Any) -> FakeOutput:
        streams.append(FakeOutput(**arguments))
        return streams[-1]

    monkeypatch.setattr(audio.sounddevice, "RawOutputStream", stream)
    adapter = PortAudioOut(device="default", sample_rate=16000, channels=1, buffer_ms=buffer_ms)
    adapter.streams = streams  # type: ignore[attr-defined]
    return adapter


async def settle() -> None:
    for _ in range(20):
        await asyncio.sleep(0)


def test_captured_chunks_arrive_in_order(monkeypatch: pytest.MonkeyPatch) -> None:
    chunks = [bytes([n]) * CHUNK for n in range(5)]

    async def main() -> None:
        adapter = microphones(monkeypatch, chunks)
        await adapter.open()
        try:
            heard = [await asyncio.wait_for(adapter.read(), TIMEOUT) for _ in chunks]
            assert heard == chunks
            (stream,) = adapter.streams  # type: ignore[attr-defined]
            assert stream.settings == {
                "device": None,  # "default": the system's own
                "samplerate": 16000,
                "channels": 1,
                "dtype": "int16",
                "blocksize": 320,
            }
        finally:
            await adapter.close()
        assert stream.closed

    asyncio.run(main())


def test_a_named_device_is_opened(monkeypatch: pytest.MonkeyPatch) -> None:
    async def main() -> None:
        adapter = microphones(monkeypatch, [], device="pipewire")
        await adapter.open()
        await adapter.close()
        assert adapter.streams[0].settings["device"] == "pipewire"  # type: ignore[attr-defined]

    asyncio.run(main())


def test_a_reader_that_falls_behind_loses_the_oldest_audio(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    kept = round(BACKLOG_SECONDS / 0.02)
    chunks = [n.to_bytes(2, "little") * (CHUNK // 2) for n in range(kept + 3)]

    async def main() -> None:
        adapter = microphones(monkeypatch, chunks)
        await adapter.open()
        try:
            adapter.streams[0].thread.join()  # type: ignore[attr-defined]
            await settle()
            heard = [await asyncio.wait_for(adapter.read(), TIMEOUT) for _ in range(kept)]
            assert heard == chunks[3:]
        finally:
            await adapter.close()

    asyncio.run(main())


@pytest.mark.parametrize(("setting", "value"), [("device", ""), ("chunk_ms", 0)])
def test_microphone_settings_are_checked(setting: str, value: Any) -> None:
    settings = {
        "device": "default",
        "sample_rate": 16000,
        "channels": 1,
        "chunk_ms": 20,
        "echo_cancelled": False,
    }
    with pytest.raises(ValueError, match=setting):
        PortAudioIn(**{**settings, setting: value})


def test_queued_audio_reaches_the_device_then_silence(monkeypatch: pytest.MonkeyPatch) -> None:
    async def main() -> None:
        adapter = speaker(monkeypatch)
        await adapter.open()
        try:
            await adapter.write(b"\x01\x02" * 50)
            stream = adapter.streams[0]  # type: ignore[attr-defined]
            assert await asyncio.to_thread(stream.pull, 80) == b"\x01\x02" * 50 + bytes(60)
        finally:
            await adapter.close()

    asyncio.run(main())


def test_writing_waits_while_too_much_is_queued(monkeypatch: pytest.MonkeyPatch) -> None:
    async def main() -> None:
        adapter = speaker(monkeypatch, buffer_ms=20.0)  # 640 bytes
        await adapter.open()
        try:
            writing = asyncio.create_task(adapter.write(bytes(3 * CHUNK)))
            await settle()
            assert not writing.done()
            stream = adapter.streams[0]  # type: ignore[attr-defined]
            await asyncio.to_thread(stream.pull, 2 * CHUNK // 2)  # 2 chunks out: 1 left
            await asyncio.wait_for(writing, TIMEOUT)
        finally:
            await adapter.close()

    asyncio.run(main())


def test_draining_waits_for_what_was_written_before_it(monkeypatch: pytest.MonkeyPatch) -> None:
    async def main() -> None:
        adapter = speaker(monkeypatch, buffer_ms=100.0)
        await adapter.open()
        try:
            await adapter.write(bytes(CHUNK))
            draining = asyncio.create_task(adapter.drain())
            await settle()
            await adapter.write(b"\x07\x00" * (CHUNK // 2))  # after: drain does not wait for it
            assert not draining.done()
            stream = adapter.streams[0]  # type: ignore[attr-defined]
            await asyncio.to_thread(stream.pull, CHUNK // 2)
            await asyncio.wait_for(draining, TIMEOUT)
            assert await asyncio.to_thread(stream.pull, CHUNK // 2) == b"\x07\x00" * (CHUNK // 2)
        finally:
            await adapter.close()

    asyncio.run(main())


def test_dropping_discards_the_queue_at_once(monkeypatch: pytest.MonkeyPatch) -> None:
    async def main() -> None:
        adapter = speaker(monkeypatch, buffer_ms=20.0)
        await adapter.open()
        try:
            writing = asyncio.create_task(adapter.write(b"\x09\x00" * (3 * CHUNK // 2)))
            draining = asyncio.create_task(adapter.drain())
            await settle()
            await adapter.drop()
            await asyncio.wait_for(asyncio.gather(writing, draining), TIMEOUT)
            stream = adapter.streams[0]  # type: ignore[attr-defined]
            assert await asyncio.to_thread(stream.pull, 100) == bytes(200)
        finally:
            await adapter.close()

    asyncio.run(main())


def test_closing_releases_whoever_waits(monkeypatch: pytest.MonkeyPatch) -> None:
    async def main() -> None:
        adapter = speaker(monkeypatch, buffer_ms=20.0)
        await adapter.open()
        writing = asyncio.create_task(adapter.write(bytes(3 * CHUNK)))
        await settle()
        await adapter.close()
        await asyncio.wait_for(writing, TIMEOUT)
        assert adapter.streams[0].closed  # type: ignore[attr-defined]

    asyncio.run(main())


def test_audio_must_be_whole_frames(monkeypatch: pytest.MonkeyPatch) -> None:
    async def main() -> None:
        adapter = speaker(monkeypatch)
        with pytest.raises(ValueError, match="whole frames"):
            await adapter.write(b"\x01")

    asyncio.run(main())
