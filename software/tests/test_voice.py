# SPDX-License-Identifier: MIT
"""The voice module: turns, the end of speech, answers and barge-in
(docs/decisions/0012 and 0013), with microphones, a speaker and engines the tests
control."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import wave
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest

from ai_robot.adapters.microwakeword.wake_word import MicroWakeWords
from ai_robot.adapters.silero.voice_activity import SileroVoiceActivity
from ai_robot.core.bus import Bus
from ai_robot.core.module import ModuleContext, RobotInfo
from ai_robot.messages import (
    CloudStatus,
    ConversationFromCloud,
    ConversationOffered,
    ConversationToCloud,
    ExpressionRequest,
    InteractionChanged,
    InteractionState,
    MicrophonesChanged,
    SettingChanged,
    SettingOffered,
    SoundLevel,
)
from ai_robot.modules.voice import VoiceModule
from ai_robot.ports import (
    AudioFormat,
    AudioIn,
    AudioOut,
    CloudPart,
    ConversationAudio,
    Interrupted,
    ResponseEnd,
    ResponseStart,
    ResponseStop,
    RobotPart,
    Speech,
    SpeechEnd,
    Trigger,
    TurnCancel,
    TurnStart,
    Voice,
    VoiceActivity,
    WakeWord,
)

FORMAT = AudioFormat(16000, 1)
CHUNK = 640  # 20 ms
SILENCE = bytes(CHUNK)
VOICE = b"V" + bytes(CHUNK - 1)  # what the fake detector takes for voice
WAKE = b"W" + bytes(CHUNK - 1)  # what the fake spotter takes for the wake word
SETTINGS = {
    "voice_threshold": 0.5,
    "end_silence": 1.0,
    "nothing_heard": 2.0,
    "barge_in": 0.2,
    "offline_expression": "confused",
    "offline_seconds": 2.0,
    "volume": 100,
    "microphones": True,
}
TIMEOUT = 2.0
ENGINES_TIMEOUT = 30.0  # for the real engines on a whole recording, however slow the computer


def chunks(seconds: float, chunk: bytes) -> list[bytes]:
    return [chunk] * round(seconds / 0.02)


class Microphones(AudioIn):
    """Hear what the test gives them; ``heard`` waits until the module has handled it
    all and asks for more."""

    def __init__(self) -> None:
        self.chunks: asyncio.Queue[bytes] = asyncio.Queue()
        self.waiting = asyncio.Event()

    @property
    def format(self) -> AudioFormat:
        return FORMAT

    async def read(self) -> bytes:
        if self.chunks.empty():
            self.waiting.set()
        chunk = await self.chunks.get()
        self.waiting.clear()
        return chunk

    async def heard(self, *chunks: bytes, timeout: float = TIMEOUT) -> None:
        self.waiting.clear()
        for chunk in chunks:
            self.chunks.put_nowait(chunk)
        await asyncio.wait_for(self.waiting.wait(), timeout)


class Speaker(AudioOut):
    def __init__(self) -> None:
        self.played = bytearray()
        self.drops = 0
        self.playing = asyncio.Event()  # cleared to hold drain() back
        self.playing.set()

    @property
    def format(self) -> AudioFormat:
        return FORMAT

    async def write(self, pcm: bytes) -> None:
        self.played.extend(pcm)

    async def drain(self) -> None:
        await self.playing.wait()

    async def drop(self) -> None:
        self.drops += 1


class Spotter(WakeWord):
    def __init__(self, format: AudioFormat = FORMAT) -> None:
        self._format = format
        self.resets = 0

    @property
    def format(self) -> AudioFormat:
        return self._format

    async def spot(self, pcm: bytes) -> str | None:
        return "hey robot" if pcm[:1] == b"W" else None

    def reset(self) -> None:
        self.resets += 1


class Detector(VoiceActivity):
    @property
    def format(self) -> AudioFormat:
        return FORMAT

    async def voice(self, pcm: bytes) -> float:
        return 1.0 if pcm[:1] == b"V" else 0.0

    def reset(self) -> None:
        pass


class Robot:
    """The voice module, its devices, and what it says on the bus."""

    def __init__(self, **changes: Any) -> None:
        self.bus = Bus()
        self.microphones = Microphones()
        self.speaker = Speaker()
        self.spotter = Spotter()
        ports = {
            "audio_in": self.microphones,
            "audio_out": self.speaker,
            "wake_word": self.spotter,
            "voice_activity": Detector(),
        }
        ctx = ModuleContext(
            name="voice",
            bus=self.bus,
            ports=ports,
            robot=RobotInfo(display_name="Robot"),
            log=logging.getLogger("test.voice"),
        )
        self.to_cloud = self.bus.subscribe(ConversationToCloud, maxsize=10_000)
        self.states = self.bus.subscribe(InteractionChanged)
        self.offers = self.bus.subscribe(ConversationOffered)
        self.expressions = self.bus.subscribe(ExpressionRequest)
        self.module = VoiceModule(ctx, **{**SETTINGS, **changes})

    async def sent(self) -> list[RobotPart]:
        """What the robot sent to the cloud since the last call."""
        parts = []
        while self.to_cloud.pending:
            parts.append((await self.to_cloud.get()).part)
        return parts

    async def state_changes(self) -> list[InteractionState]:
        """Where the conversation went since the last call."""
        states = []
        while self.states.pending:
            states.append((await self.states.get()).state)
        return states

    async def cloud_says(self, *parts: CloudPart) -> None:
        for part in parts:
            self.bus.publish(ConversationFromCloud(part))
        await settle()

    async def online(self, conversations: bool = True) -> None:
        self.bus.publish(CloudStatus(online=True, conversations=conversations))
        await settle()


async def settle() -> None:
    """Let the module handle what was just published."""
    for _ in range(10):
        await asyncio.sleep(0)


@contextlib.asynccontextmanager
async def running(robot: Robot) -> AsyncIterator[Robot]:
    await robot.module.start()
    task = asyncio.create_task(robot.module.run())
    try:
        await settle()
        yield robot
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        await robot.module.stop()


async def in_a_turn(robot: Robot) -> None:
    """Hear the wake word and some voice, and forget what was sent."""
    await robot.online()
    await robot.microphones.heard(WAKE, VOICE)
    await robot.sent()
    await robot.state_changes()


def test_it_offers_conversations_and_starts_idle() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            offer = await robot.offers.get()
            assert (offer.owner, offer.audio) == ("voice", ConversationAudio(FORMAT, FORMAT))
            assert await robot.state_changes() == [InteractionState.IDLE]

    asyncio.run(main())


def test_a_wake_word_opens_a_turn_that_streams_what_it_hears() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await robot.online()
            await robot.state_changes()
            await robot.microphones.heard(SILENCE, WAKE, VOICE, VOICE)
            assert await robot.sent() == [
                TurnStart("t1", Trigger.WAKE_WORD),
                Speech("t1", VOICE),
                Speech("t1", VOICE),
            ]
            assert await robot.state_changes() == [InteractionState.LISTENING]
            assert robot.spotter.resets == 1  # the same words are not spotted twice

    asyncio.run(main())


def test_the_cloud_ends_the_speech() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await in_a_turn(robot)
            await robot.cloud_says(SpeechEnd("t1"))
            await robot.microphones.heard(VOICE, SILENCE)
            assert await robot.sent() == []  # the robot no longer streams
            assert await robot.state_changes() == [InteractionState.PROCESSING]

    asyncio.run(main())


def test_the_robot_ends_the_speech_after_a_silence_the_cloud_left() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await in_a_turn(robot)
            silence = chunks(SETTINGS["end_silence"], SILENCE)
            await robot.microphones.heard(*silence[:-1])
            assert SpeechEnd("t1") not in await robot.sent()
            await robot.microphones.heard(silence[-1], VOICE)
            assert await robot.sent() == [Speech("t1", SILENCE), SpeechEnd("t1")]
            assert await robot.state_changes() == [InteractionState.PROCESSING]

    asyncio.run(main())


def test_a_turn_in_which_nobody_speaks_is_cancelled() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await robot.online()
            await robot.microphones.heard(WAKE, *chunks(SETTINGS["nothing_heard"], SILENCE))
            assert (await robot.sent())[-1] == TurnCancel("t1", "nothing heard")
            assert (await robot.state_changes())[-1] == InteractionState.IDLE

    asyncio.run(main())


def test_the_speech_ends_after_thirty_seconds() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await robot.online()
            await robot.microphones.heard(WAKE, *chunks(30.0, VOICE))
            sent = await robot.sent()
            assert sent[-1] == SpeechEnd("t1")
            assert sum(isinstance(part, Speech) for part in sent) == 1500

    asyncio.run(main())


def test_an_answer_plays_then_its_follow_up_opens_a_turn() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await in_a_turn(robot)
            robot.speaker.playing.clear()  # the answer is still playing
            await robot.cloud_says(
                SpeechEnd("t1"),
                ResponseStart("a1", "t1"),
                Voice(b"\x01\x00" * 160),
                Voice(b"\x02\x00" * 160),
                ResponseEnd("a1", follow_up=True),
            )
            assert bytes(robot.speaker.played) == b"\x01\x00" * 160 + b"\x02\x00" * 160
            assert TurnStart("t2", Trigger.FOLLOW_UP) not in await robot.sent()
            robot.speaker.playing.set()  # played: now the robot listens again
            await settle()
            assert await robot.sent() == [TurnStart("t2", Trigger.FOLLOW_UP)]
            assert await robot.state_changes() == [
                InteractionState.PROCESSING,
                InteractionState.SPEAKING,
                InteractionState.LISTENING,
            ]

    asyncio.run(main())


def test_an_answer_without_a_follow_up_ends_idle() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await in_a_turn(robot)
            await robot.cloud_says(ResponseStart("a1", "t1"), ResponseEnd("a1", follow_up=False))
            await robot.microphones.heard(VOICE)
            assert await robot.sent() == []  # the answer ended the turn
            assert await robot.state_changes() == [InteractionState.SPEAKING, InteractionState.IDLE]

    asyncio.run(main())


def test_barge_in_stops_the_answer_and_opens_a_turn_with_the_words() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await in_a_turn(robot)
            await robot.cloud_says(SpeechEnd("t1"), ResponseStart("a1", "t1"))
            words = chunks(SETTINGS["barge_in"], VOICE)
            await robot.microphones.heard(SILENCE, *words)
            assert robot.speaker.drops == 1
            sent = await robot.sent()
            assert sent[:2] == [Interrupted("a1"), TurnStart("t2", Trigger.BARGE_IN)]
            # The turn starts with what interrupted, and a little of what came before.
            assert sent[2:] == [Speech("t2", SILENCE)] + [Speech("t2", VOICE)] * len(words)
            # What the agent still sends of the stopped answer is not played.
            await robot.cloud_says(Voice(b"\x05\x00" * 160))
            assert robot.speaker.played == bytearray()
            assert (await robot.state_changes())[-1] == InteractionState.LISTENING

    asyncio.run(main())


def test_the_next_answer_plays_from_its_first_sound() -> None:
    """After a barge-in, the cloud's voice plays again once the new turn's speech is
    over: the next answer's voice may come before its response.start."""

    async def main() -> None:
        async with running(Robot()) as robot:
            await in_a_turn(robot)
            await robot.cloud_says(SpeechEnd("t1"), ResponseStart("a1", "t1"))
            await robot.microphones.heard(*chunks(SETTINGS["barge_in"], VOICE))
            await robot.cloud_says(Voice(b"\x05\x00" * 160))  # the stopped answer's
            assert robot.speaker.played == bytearray()
            await robot.cloud_says(SpeechEnd("t2"), Voice(b"\x06\x00" * 160))
            assert bytes(robot.speaker.played) == b"\x06\x00" * 160

    asyncio.run(main())


def test_a_short_noise_over_an_answer_does_not_interrupt_it() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await in_a_turn(robot)
            await robot.cloud_says(ResponseStart("a1", "t1"))
            short = chunks(SETTINGS["barge_in"], VOICE)[:-1]
            await robot.microphones.heard(*short, SILENCE, *short)
            assert robot.speaker.drops == 0
            assert await robot.sent() == []

    asyncio.run(main())


def test_a_stopped_answer_is_dropped_and_its_voice_not_played() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await in_a_turn(robot)
            await robot.cloud_says(
                ResponseStart("a1", "t1"), ResponseStop("a1"), Voice(b"\x05\x00" * 160)
            )
            assert robot.speaker.drops == 1
            assert robot.speaker.played == bytearray()
            assert (await robot.state_changes())[-1] == InteractionState.IDLE
            await robot.cloud_says(ResponseStart("a2", None), Voice(b"\x06\x00" * 160))
            assert bytes(robot.speaker.played) == b"\x06\x00" * 160  # the next one plays

    asyncio.run(main())


def test_the_cloud_cancels_the_turn() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await in_a_turn(robot)
            await robot.cloud_says(TurnCancel("t1", "not understood"))
            await robot.microphones.heard(VOICE)
            assert await robot.sent() == []
            assert await robot.state_changes() == [InteractionState.IDLE]

    asyncio.run(main())


def test_without_the_cloud_the_wake_word_gets_a_local_cue() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await robot.online(conversations=False)
            await robot.microphones.heard(WAKE, VOICE)
            assert await robot.sent() == []
            cue = await robot.expressions.get()
            assert (cue.source, cue.expression, cue.duration) == ("voice", "confused", 2.0)

    asyncio.run(main())


def test_a_reminder_does_not_end_the_users_turn() -> None:
    async def main() -> None:
        async with running(Robot()) as robot:
            await in_a_turn(robot)
            await robot.cloud_says(ResponseStart("a1", None))  # an answer no turn asked for
            await robot.microphones.heard(VOICE)
            assert await robot.sent() == [Speech("t1", VOICE)]

    asyncio.run(main())


def test_engines_that_take_other_audio_are_refused() -> None:
    robot = Robot()
    ports = {
        "audio_in": robot.microphones,
        "audio_out": robot.speaker,
        "wake_word": Spotter(AudioFormat(48000, 1)),
        "voice_activity": Detector(),
    }
    ctx = ModuleContext("voice", Bus(), ports, RobotInfo("Robot"), logging.getLogger("test"))
    with pytest.raises(ValueError, match="Spotter takes"):
        VoiceModule(ctx, **SETTINGS)


@pytest.mark.parametrize(
    ("setting", "value"),
    [
        ("voice_threshold", 1.5),
        ("end_silence", 0.0),
        ("nothing_heard", -1.0),
        ("barge_in", float("nan")),
        ("offline_expression", ""),
        ("offline_seconds", 0.0),
        ("volume", 83),  # not a step of 5
        ("volume", 120),
        ("microphones", "yes"),
    ],
)
def test_settings_are_checked(setting: str, value: Any) -> None:
    with pytest.raises(ValueError, match=setting):
        Robot(**{setting: value})


# ---- the owner's settings: the volume and the microphones ----


async def microphones(robot: Robot) -> list[bool]:
    """What the module said of its microphones since the last call."""
    said = []
    while robot.mics.pending:
        said.append((await robot.mics.get()).on)
    return said


def settings_robot(**changes: Any) -> Robot:
    robot = Robot(**changes)
    robot.mics = robot.bus.subscribe(MicrophonesChanged)
    robot.levels = robot.bus.subscribe(SoundLevel)
    robot.offered = robot.bus.subscribe(SettingOffered)
    return robot


def test_it_offers_its_settings() -> None:
    async def main() -> None:
        async with running(settings_robot(volume=60)) as robot:
            offered = {}
            while robot.offered.pending:
                setting = (await robot.offered.get()).setting
                offered[setting.name] = setting
            assert offered["voice.volume"].value == 60
            assert offered["voice.volume"].unit == "%"
            assert offered["voice.microphones"].value is True
            assert await microphones(robot) == [True]

    asyncio.run(main())


def test_microphones_off_hear_nothing() -> None:
    async def main() -> None:
        async with running(settings_robot()) as robot:
            await robot.online()
            await microphones(robot)
            robot.bus.publish(SettingChanged("voice.microphones", False))
            await settle()
            assert await microphones(robot) == [False]
            while robot.levels.pending:
                await robot.levels.get()
            await robot.microphones.heard(WAKE, VOICE)
            assert await robot.sent() == []  # no turn
            assert robot.levels.pending == 0  # nothing measured
            resets = robot.spotter.resets
            robot.bus.publish(SettingChanged("voice.microphones", True))
            await settle()
            assert await microphones(robot) == [True]
            assert robot.spotter.resets == resets + 1  # what came before is forgotten
            await robot.microphones.heard(WAKE)
            assert await robot.sent() == [TurnStart("t1", Trigger.WAKE_WORD)]

    asyncio.run(main())


def test_microphones_off_end_the_turn() -> None:
    async def main() -> None:
        async with running(settings_robot()) as robot:
            await in_a_turn(robot)
            robot.bus.publish(SettingChanged("voice.microphones", False))
            await settle()
            assert await robot.sent() == [TurnCancel("t1", "microphones off")]
            assert await robot.state_changes() == [InteractionState.IDLE]

    asyncio.run(main())


def test_no_follow_up_while_the_microphones_are_off() -> None:
    async def main() -> None:
        async with running(settings_robot()) as robot:
            await in_a_turn(robot)
            await robot.cloud_says(SpeechEnd("t1"), ResponseStart("a1", "t1"))
            robot.bus.publish(SettingChanged("voice.microphones", False))
            await settle()
            await robot.cloud_says(ResponseEnd("a1", follow_up=True))
            await settle()
            assert [p for p in await robot.sent() if isinstance(p, TurnStart)] == []

    asyncio.run(main())


def test_the_volume_scales_the_robots_voice() -> None:
    async def main() -> None:
        async with running(settings_robot(volume=50)) as robot:
            await in_a_turn(robot)
            await robot.cloud_says(SpeechEnd("t1"), ResponseStart("a1", "t1"))
            await robot.cloud_says(Voice(b"\x10\x00" * 4))  # 16
            robot.bus.publish(SettingChanged("voice.volume", 25))
            await settle()
            await robot.cloud_says(Voice(b"\x10\x00" * 4))
            assert bytes(robot.speaker.played) == b"\x08\x00" * 4 + b"\x04\x00" * 4

    asyncio.run(main())


def test_a_value_its_schema_refuses_is_not_applied() -> None:
    async def main() -> None:
        async with running(settings_robot()) as robot:
            while robot.offered.pending:
                await robot.offered.get()
            robot.bus.publish(SettingChanged("voice.volume", 7))
            await settle()
            assert robot.module.volume == 100
            again = (await robot.offered.get()).setting  # offered again, as it is
            assert (again.name, again.value) == ("voice.volume", 100)

    asyncio.run(main())


def test_kept_settings_apply_before_it_hears_anything() -> None:
    async def main() -> None:
        robot = settings_robot()
        robot.bus.publish(SettingChanged("voice.microphones", False))  # as settings starts
        async with running(robot):
            assert await microphones(robot) == [False]  # off from the start
            await robot.online()
            await robot.microphones.heard(WAKE)
            assert await robot.sent() == []

    asyncio.run(main())


def test_the_real_engines_open_and_end_a_turn_in_a_recording() -> None:
    """A recording, as the microphones would hear it: the wake word opens a turn, the
    speech that follows streams, and the silence after it ends the speech."""
    data = Path(__file__).parent / "data"

    def recording(name: str) -> bytes:
        with wave.open(str(data / name)) as audio:
            return audio.readframes(audio.getnframes())

    async def main() -> None:
        robot = Robot()
        spotter, detector = MicroWakeWords(models=["okay_nabu"]), SileroVoiceActivity()
        robot.module.wake_word = spotter
        robot.module.voice_activity = detector
        await spotter.open()
        await detector.open()
        try:
            async with running(robot):
                await robot.online()
                heard = recording("okay_nabu.wav") + recording("speech.wav") + bytes(2 * 32000)
                await robot.microphones.heard(
                    *(heard[at : at + CHUNK] for at in range(0, len(heard), CHUNK)),
                    timeout=ENGINES_TIMEOUT,
                )
                sent = await robot.sent()
        finally:
            await spotter.close()
        assert sent[0] == TurnStart("t1", Trigger.WAKE_WORD)
        assert sent[-1] == SpeechEnd("t1")
        speech = [part for part in sent if isinstance(part, Speech)]
        # From the wake word's end to a second of silence after the speech.
        assert 1.5 < len(speech) * 0.02 < 2.5

    asyncio.run(main())
