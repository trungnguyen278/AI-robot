# SPDX-License-Identifier: MIT
from __future__ import annotations

import asyncio

from ai_robot.adapters.sim.audio import SimAudioIn, SimAudioOut


def test_the_microphones_deliver_chunks_in_real_time() -> None:
    async def scenario() -> None:
        microphones = SimAudioIn(sample_rate=16000, channels=1, chunk_ms=20, echo_cancelled=False)
        loop = asyncio.get_running_loop()
        began = loop.time()
        chunks = [await microphones.read() for _ in range(5)]
        assert all(len(chunk) == 640 for chunk in chunks)  # 320 samples of 2 bytes
        assert loop.time() - began >= 0.09

    asyncio.run(scenario())


def test_drop_releases_a_blocked_writer() -> None:
    async def scenario() -> None:
        speaker = SimAudioOut(sample_rate=16000, channels=1, buffer_ms=200.0)
        loop = asyncio.get_running_loop()
        began = loop.time()
        writing = asyncio.create_task(speaker.write(bytes(3 * 32000)))  # 3 s of audio
        await asyncio.sleep(0.05)
        await speaker.drop()
        await asyncio.wait_for(writing, timeout=1.0)
        await asyncio.wait_for(speaker.drain(), timeout=1.0)
        assert loop.time() - began < 1.0

    asyncio.run(scenario())
