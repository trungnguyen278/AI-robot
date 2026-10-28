# SPDX-License-Identifier: MIT
"""Wake words spotted by microWakeWord models (docs/decisions/0013-listening-on-the-robot.md).

pymicro-wakeword runs the models, with TensorFlow Lite built in. One feature extractor
feeds every model, as they all take the same features.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from pymicro_wakeword import MicroWakeWord, MicroWakeWordFeatures, Model

from ai_robot.ports.audio import AudioFormat
from ai_robot.ports.listening import WakeWord

FORMAT = AudioFormat(16000, 1)  # what microWakeWord's features take: 16 kHz, mono
BUILT_IN = {model.value: model for model in Model}  # the models pymicro-wakeword comes with


class MicroWakeWords(WakeWord):
    """Spots any of ``models``. Each is the name of a model that comes with
    pymicro-wakeword (okay_nabu, hey_jarvis, hey_mycroft or alexa), or the path to the
    manifest of a model trained with microWakeWord, a JSON file beside its ``.tflite``."""

    def __init__(self, *, models: list[str]) -> None:
        if not models or not all(isinstance(model, str) and model for model in models):
            raise ValueError("models must name at least one wake word model")
        self.models = list(models)
        self._spotters: list[MicroWakeWord] = []
        self._features = MicroWakeWordFeatures()

    @property
    def format(self) -> AudioFormat:
        return FORMAT

    async def open(self) -> None:
        self._spotters = await asyncio.to_thread(_load, self.models)

    async def close(self) -> None:
        spotters, self._spotters = self._spotters, []
        for spotter in spotters:
            spotter.close()

    async def spot(self, pcm: bytes) -> str | None:
        return await asyncio.to_thread(self._spot, pcm)

    def reset(self) -> None:
        self._features.reset()
        for spotter in self._spotters:
            spotter.reset()

    def _spot(self, pcm: bytes) -> str | None:
        heard = None
        for features in self._features.process_streaming(pcm):
            # Every model takes every window, even once one has spotted its word.
            for spotter in self._spotters:
                if spotter.process_streaming(features) and heard is None:
                    heard = spotter.wake_word
        return heard


def _load(models: list[str]) -> list[MicroWakeWord]:
    spotters: list[MicroWakeWord] = []
    try:
        for model in models:
            try:
                if model in BUILT_IN:
                    spotters.append(MicroWakeWord.from_builtin(BUILT_IN[model]))
                else:
                    spotters.append(MicroWakeWord.from_config(Path(model).expanduser()))
            except (OSError, KeyError, TypeError, ValueError) as error:
                raise ValueError(f"cannot load the wake word model {model!r}: {error}") from None
    except BaseException:
        for spotter in spotters:
            spotter.close()
        raise
    return spotters
