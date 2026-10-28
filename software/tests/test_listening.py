# SPDX-License-Identifier: MIT
"""What the robot hears on its own: wake words and voice (docs/decisions/0013), with the
real engines on recorded speech (see THIRD_PARTY_NOTICES.md for the recordings)."""

from __future__ import annotations

import asyncio
import importlib.resources
import wave
from collections.abc import Iterator
from pathlib import Path

import pytest

from ai_robot.adapters.microwakeword.wake_word import MicroWakeWords
from ai_robot.adapters.silero.voice_activity import SileroVoiceActivity
from ai_robot.adapters.sim.listening import SimVoiceActivity, SimWakeWord
from ai_robot.ports import AudioFormat, VoiceActivity, WakeWord

DATA = Path(__file__).parent / "data"
CHUNK = 640  # 20 ms of 16 kHz mono, as the robot reads its microphones
SILENCE = bytes(16000 * 2)  # a second


def recording(name: str) -> bytes:
    with wave.open(str(DATA / name)) as audio:
        assert (audio.getframerate(), audio.getnchannels(), audio.getsampwidth()) == (16000, 1, 2)
        return audio.readframes(audio.getnframes())


def in_chunks(pcm: bytes) -> Iterator[bytes]:
    for start in range(0, len(pcm) - CHUNK + 1, CHUNK):
        yield pcm[start : start + CHUNK]


async def spotted(spotter: WakeWord, pcm: bytes) -> list[str]:
    """The wake words heard, resetting after each, as the voice module does."""
    heard = []
    for chunk in in_chunks(pcm):
        if (word := await spotter.spot(chunk)) is not None:
            heard.append(word)
            spotter.reset()
    return heard


async def voice_peak(detector: VoiceActivity, pcm: bytes) -> float:
    return max([await detector.voice(chunk) for chunk in in_chunks(pcm)])


def test_the_simulated_engines_hear_nothing() -> None:
    async def main() -> None:
        spotter, detector = SimWakeWord(), SimVoiceActivity()
        assert spotter.format == detector.format == AudioFormat(16000, 1)
        speech = recording("okay_nabu.wav")
        assert await spotted(spotter, speech) == []
        assert await voice_peak(detector, speech) == 0.0

    asyncio.run(main())


def test_a_wake_word_is_spotted_in_speech_and_only_there() -> None:
    async def main() -> None:
        spotter = MicroWakeWords(models=["okay_nabu"])
        await spotter.open()
        try:
            assert spotter.format == AudioFormat(16000, 1)
            assert await spotted(spotter, recording("okay_nabu.wav") + SILENCE) == ["Okay Nabu"]
            spotter.reset()
            assert await spotted(spotter, recording("speech.wav") + SILENCE) == []
        finally:
            await spotter.close()

    asyncio.run(main())


def test_a_model_is_loaded_from_its_manifest() -> None:
    manifest = importlib.resources.files("pymicro_wakeword") / "models" / "okay_nabu.json"

    async def main() -> None:
        spotter = MicroWakeWords(models=[str(manifest), "hey_jarvis"])
        await spotter.open()
        try:
            assert await spotted(spotter, recording("okay_nabu.wav") + SILENCE) == ["Okay Nabu"]
        finally:
            await spotter.close()

    asyncio.run(main())


@pytest.mark.parametrize("models", [[], [""]])
def test_a_wake_word_needs_a_model(models: list[str]) -> None:
    with pytest.raises(ValueError, match="at least one"):
        MicroWakeWords(models=models)


def test_a_model_that_cannot_load_is_reported(tmp_path: Path) -> None:
    missing = tmp_path / "nowhere.json"
    with pytest.raises(ValueError, match="cannot load the wake word model"):
        asyncio.run(MicroWakeWords(models=["okay_nabu", str(missing)]).open())


def test_voice_is_told_from_silence() -> None:
    async def main() -> None:
        detector = SileroVoiceActivity()
        await detector.open()
        assert detector.format == AudioFormat(16000, 1)
        assert await voice_peak(detector, recording("speech.wav")) > 0.9
        detector.reset()
        assert await voice_peak(detector, SILENCE) < 0.1

    asyncio.run(main())


def test_chunks_that_do_not_fill_a_window_keep_the_latest_probability() -> None:
    async def main() -> None:
        detector = SileroVoiceActivity()
        await detector.open()
        speech = recording("speech.wav")
        # The model's windows are 32 ms: a 20 ms chunk completes none, or one.
        probabilities = [await detector.voice(chunk) for chunk in in_chunks(speech)]
        assert all(0.0 <= probability <= 1.0 for probability in probabilities)
        assert probabilities[0] == 0.0  # nothing complete yet: no voice
        assert len(set(probabilities[:4])) <= 3  # a value repeats until a window completes

    asyncio.run(main())
