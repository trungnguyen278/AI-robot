# SPDX-License-Identifier: MIT
"""Voice detected by Silero VAD (docs/decisions/0013-listening-on-the-robot.md).

pysilero-vad runs the model with its own inference, without onnxruntime. The model looks
at windows of its own length; the adapter gathers the chunks it is given into them.
"""

from __future__ import annotations

import asyncio

from pysilero_vad import SileroVoiceActivityDetector

from ai_robot.ports.audio import AudioFormat
from ai_robot.ports.listening import VoiceActivity

FORMAT = AudioFormat(16000, 1)  # what the model takes here: 16 kHz, mono


class SileroVoiceActivity(VoiceActivity):
    """The probability of voice, from Silero VAD."""

    def __init__(self) -> None:
        self._detector: SileroVoiceActivityDetector | None = None
        self._pending = bytearray()  # what does not fill a window yet
        self._latest = 0.0  # the probability of the latest complete window

    @property
    def format(self) -> AudioFormat:
        return FORMAT

    async def open(self) -> None:
        self._detector = await asyncio.to_thread(SileroVoiceActivityDetector)

    async def voice(self, pcm: bytes) -> float:
        return await asyncio.to_thread(self._voice, pcm)

    def reset(self) -> None:
        if self._detector is not None:
            self._detector.reset()
        self._pending.clear()
        self._latest = 0.0

    def _voice(self, pcm: bytes) -> float:
        if self._detector is None:
            raise RuntimeError("the voice activity detector is not open")
        self._pending.extend(pcm)
        window = self._detector.chunk_bytes()
        while len(self._pending) >= window:
            self._latest = float(self._detector(bytes(self._pending[:window])))
            del self._pending[:window]
        return self._latest
