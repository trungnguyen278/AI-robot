# SPDX-License-Identifier: MIT
"""Voice: listening and talking (docs/decisions/0012 and 0013)."""

from __future__ import annotations

import asyncio
import itertools
from collections import deque

from ai_robot import native
from ai_robot.core.checks import positive, within
from ai_robot.core.module import Module, ModuleContext
from ai_robot.core.settings import SettingsHost
from ai_robot.messages import (
    CloudStatus,
    ConversationFromCloud,
    ConversationOffered,
    ConversationToCloud,
    ExpressionRequest,
    InteractionChanged,
    InteractionState,
    MicrophonesChanged,
    Setting,
    SettingKind,
    SettingSection,
    SoundLevel,
)
from ai_robot.ports import (
    AudioIn,
    AudioOut,
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
from ai_robot.ports.cloud import MAX_SPEECH_SECONDS

# How this implementation works, which nobody needs to tune.
LEAD_IN_SECONDS = 0.3  # audio from before a barge-in's voice was confirmed, sent with it
FROM_CLOUD_BACKLOG = 1000  # unread parts of the cloud's conversation kept: far more than pile up
VOLUME_STEP = 5  # percent between two volumes the settings offer


class VoiceModule(Module):
    """Listens and talks: it holds the robot's conversations with the cloud.

    - **Turns.** A wake word starts a turn, if the cloud takes conversations; otherwise
      the face shows ``offline_expression`` for ``offline_seconds`` (REL-1). The robot
      streams what it hears until the turn's speech ends.
    - **The end of speech** is the cloud's to decide (ADR-0012). The robot ends it
      itself only after ``end_silence`` seconds of silence following voice, or after
      the protocol's 30 s. A turn with no voice within ``nothing_heard`` seconds is
      cancelled.
    - **Answers** play as they come. An answer that asks for a follow-up opens a new
      turn once it has been played.
    - **Barge-in.** ``barge_in`` seconds of voice over an answer stop it at once and
      open a new turn, which starts with the words that interrupted.
    - **Voice** is a window whose probability of voice reaches ``voice_threshold``.
      Durations are measured in the audio heard, to the byte, not on a clock.

    It publishes where the conversation is (``InteractionChanged``), and the loudness
    of what the microphones hear (``SoundLevel``).

    **Settings** (docs/decisions/0016): the ``volume`` of the robot's voice, in percent,
    and whether the ``microphones`` are on. Off, the robot hears nothing: no wake word,
    no loudness, no turn, and the screen says so (``MicrophonesChanged``, PRIV-1).
    """

    owns = ("audio_in", "audio_out", "wake_word", "voice_activity")

    def __init__(
        self,
        ctx: ModuleContext,
        *,
        voice_threshold: float,
        end_silence: float,
        nothing_heard: float,
        barge_in: float,
        offline_expression: str,
        offline_seconds: float,
        volume: int,
        microphones: bool,
    ) -> None:
        super().__init__(ctx)
        self.microphones = self.port("audio_in", AudioIn)
        self.speaker = self.port("audio_out", AudioOut)
        self.wake_word = self.port("wake_word", WakeWord)
        self.voice_activity = self.port("voice_activity", VoiceActivity)
        self.voice_threshold = within("voice_threshold", voice_threshold, 0, 1)
        self.end_silence = positive("end_silence", end_silence)
        self.nothing_heard = positive("nothing_heard", nothing_heard)
        self.barge_in = positive("barge_in", barge_in)
        if not offline_expression:
            raise ValueError("offline_expression must name an expression")
        self.offline_expression = offline_expression
        self.offline_seconds = positive("offline_seconds", offline_seconds)
        self.volume = volume
        self.microphones_on = microphones
        self._said_microphones = False  # whether it told the others yet
        self.settings = SettingsHost(self)
        self.settings.add(
            Setting(
                "voice.volume",
                SettingKind.VALUE,
                SettingSection.SOUND,
                "Volume",
                volume,
                schema={"type": "integer", "minimum": 0, "maximum": 100, "multipleOf": VOLUME_STEP},
                unit="%",
            ),
            self._set_volume,
        )
        self.settings.add(
            Setting(
                "voice.microphones",
                SettingKind.VALUE,
                SettingSection.SOUND,
                "Microphones",
                microphones,
                schema={"type": "boolean"},
                help="Off, the robot hears nothing until they are on again",
            ),
            self._set_microphones,
        )
        for port in (self.wake_word, self.voice_activity):
            if port.format != self.microphones.format:
                raise ValueError(
                    f"the microphones give {self.microphones.format}, "
                    f"but {type(port).__name__} takes {port.format}"
                )
        self.rate = self.microphones.format.bytes_per_second
        # The durations, in bytes of audio heard, which add up exactly.
        self._end_silence = self._bytes(self.end_silence)
        self._nothing_heard = self._bytes(self.nothing_heard)
        self._barge_in = self._bytes(self.barge_in)
        self._max_speech = self._bytes(MAX_SPEECH_SECONDS)
        self._lead_in_limit = self._bytes(self.barge_in + LEAD_IN_SECONDS)
        self.status = self.bus.subscribe(CloudStatus)
        self.from_cloud = self.bus.subscribe(ConversationFromCloud, maxsize=FROM_CLOUD_BACKLOG)
        self.conversations = False  # whether the cloud takes conversations now
        self.state = InteractionState.IDLE
        self._numbers = itertools.count(1)
        # The turn: its identifier while open, and what the robot heard in it.
        self.turn: str | None = None
        self.streaming = False  # whether the robot still sends what it hears
        self._turn_heard = 0  # bytes of audio since the turn started
        self._speech_sent = 0  # bytes of speech sent in the turn
        self._voiced = False  # whether the turn has had voice
        self._silent = 0  # bytes of silence since the turn's last voice
        # The answer: the response playing, and what is left to do with it.
        self.response: str | None = None
        self._muted = False  # drop the cloud's voice: its answer was stopped or interrupted
        self._finishing: asyncio.Task[None] | None = None
        # Barge-in: the voice over the answer so far, and what came just before it.
        self._voice_run = 0  # bytes of voice heard over the answer, without a break
        self._lead_in: deque[bytes] = deque()
        self._lead_in_bytes = 0

    # ---- lifecycle ----

    async def start(self) -> None:
        audio = ConversationAudio(self.microphones.format, self.speaker.format)
        self.bus.publish(ConversationOffered(self.name, audio))
        self.bus.publish(InteractionChanged(self.state))
        self.settings.offer()

    async def run(self) -> None:
        await self.settings.apply_pending()  # the owner's choices, before anything is heard
        self.bus.publish(MicrophonesChanged(self.microphones_on))
        self._said_microphones = True
        async with asyncio.TaskGroup() as tasks:
            tasks.create_task(self._listen())
            tasks.create_task(self._hear_the_cloud())
            tasks.create_task(self._follow_status())
            tasks.create_task(self.settings.serve())

    async def stop(self) -> None:
        self.status.close()
        self.from_cloud.close()
        self.settings.close()
        self._cancel_finishing()
        await self.speaker.drop()

    # ---- what the microphones hear ----

    async def _listen(self) -> None:
        while True:
            chunk = await self.microphones.read()
            if not self.microphones_on:
                continue  # off: nothing is heard, nor measured
            self.bus.publish(SoundLevel(native.rms_int16(chunk)))
            # The engines hear everything, so that their state follows the audio.
            voiced = await self.voice_activity.voice(chunk) >= self.voice_threshold
            wake_word = await self.wake_word.spot(chunk)
            if wake_word is not None:
                self.wake_word.reset()  # so that the same words are not spotted twice
            if self.streaming:
                self._stream(chunk, voiced)
            elif self.response is not None and not self._muted:
                await self._watch_for_barge_in(chunk, voiced)
            elif wake_word is not None:
                self._on_wake_word(wake_word)

    def _stream(self, chunk: bytes, voiced: bool) -> None:
        assert self.turn is not None
        self._send(Speech(self.turn, chunk))
        self._speech_sent += len(chunk)
        self._turn_heard += len(chunk)
        if voiced:
            self._voiced = True
            self._silent = 0
        else:
            self._silent += len(chunk)
        if not self._voiced and self._turn_heard >= self._nothing_heard:
            self.log.info("nothing heard in turn %s", self.turn)
            self._send(TurnCancel(self.turn, "nothing heard"))
            self._close_turn()
        else:
            silence_after_voice = self._voiced and self._silent >= self._end_silence
            if silence_after_voice or self._speech_sent >= self._max_speech:
                self._end_speech()

    async def _watch_for_barge_in(self, chunk: bytes, voiced: bool) -> None:
        self._remember(chunk)
        self._voice_run = self._voice_run + len(chunk) if voiced else 0
        if self._voice_run < self._barge_in:
            return
        assert self.response is not None
        self.log.info("barge-in over response %s", self.response)
        interrupted = self.response
        lead_in = list(self._lead_in)
        await self._stop_answer()
        self._send(Interrupted(interrupted))
        self._open_turn(Trigger.BARGE_IN)
        for earlier in lead_in:
            self._stream(earlier, voiced=True)

    def _remember(self, chunk: bytes) -> None:
        """Keep the latest audio heard over an answer: the voice that may interrupt
        it, and a little of what came before."""
        self._lead_in.append(chunk)
        self._lead_in_bytes += len(chunk)
        while self._lead_in_bytes - len(self._lead_in[0]) >= self._lead_in_limit:
            self._lead_in_bytes -= len(self._lead_in.popleft())

    def _on_wake_word(self, wake_word: str) -> None:
        if not self.conversations:
            self.log.info("heard %r, but the cloud takes no conversations", wake_word)
            request = ExpressionRequest(
                self.name, self.offline_expression, duration=self.offline_seconds
            )
            self.bus.publish(request)
            return
        self.log.info("heard %r", wake_word)
        self._open_turn(Trigger.WAKE_WORD)

    # ---- turns ----

    def _open_turn(self, trigger: Trigger) -> None:
        """Start a turn; one still open ends with it, as the protocol says."""
        self.turn = f"t{next(self._numbers)}"
        self.streaming = True
        self._turn_heard = 0
        self._speech_sent = 0
        self._voiced = False
        self._silent = 0
        self._send(TurnStart(self.turn, trigger))
        self._set_state(InteractionState.LISTENING)

    def _end_speech(self) -> None:
        """The robot ends the user's speech itself: the cloud has not."""
        assert self.turn is not None
        speech_ms = round(1000 * self._speech_sent / self.rate)
        self.log.info("ending the speech of turn %s after %d ms", self.turn, speech_ms)
        self._send(SpeechEnd(self.turn))
        self._speech_over()

    def _speech_over(self) -> None:
        self.streaming = False
        self._unmute()
        if self.response is None:
            self._set_state(InteractionState.PROCESSING)

    def _close_turn(self) -> None:
        self.turn = None
        self.streaming = False
        self._unmute()
        if self.response is None:
            self._set_state(InteractionState.IDLE)

    def _unmute(self) -> None:
        """Play the cloud's voice again, once a turn's speech is over: the agent has
        stopped the voice of an interrupted answer by then, and the next answer's
        voice may come before its ``response.start``."""
        if self.response is None:
            self._muted = False

    # ---- what the cloud says ----

    async def _hear_the_cloud(self) -> None:
        while True:
            part = (await self.from_cloud.get()).part
            if isinstance(part, Voice):
                if not self._muted:
                    await self.speaker.write(self._at_volume(part.pcm))
            elif isinstance(part, SpeechEnd):
                if part.turn == self.turn and self.streaming:
                    self._speech_over()
            elif isinstance(part, TurnCancel):
                if part.turn == self.turn:
                    self._close_turn()
            elif isinstance(part, ResponseStart):
                self._on_response(part)
            elif isinstance(part, ResponseEnd):
                if part.response == self.response:
                    self._finish_once_played(part)
            elif isinstance(part, ResponseStop) and part.response == self.response:
                await self._stop_answer()
                self._set_state(
                    InteractionState.LISTENING if self.streaming else InteractionState.IDLE
                )

    def _on_response(self, part: ResponseStart) -> None:
        self._cancel_finishing()  # a new answer ends the one before
        self.response = part.response
        self._muted = False
        self._voice_run = 0
        self._lead_in.clear()
        self._lead_in_bytes = 0
        if part.turn is not None and part.turn == self.turn:  # the answer to this turn
            self.turn = None
            self.streaming = False
        self._set_state(InteractionState.SPEAKING)

    def _finish_once_played(self, part: ResponseEnd) -> None:
        """Once the answer has been played: listen again if it asked for a follow-up,
        or go idle."""

        async def finish() -> None:
            await self.speaker.drain()
            self._finishing = None
            self.response = None
            if self.streaming:  # a turn opened meanwhile
                return
            if part.follow_up and self.conversations and self.microphones_on:
                self._open_turn(Trigger.FOLLOW_UP)
            else:
                self._set_state(InteractionState.IDLE)

        self._finishing = asyncio.create_task(finish(), name="voice: finishing an answer")
        self._finishing.add_done_callback(self._report_failure)

    async def _stop_answer(self) -> None:
        """Stop the answer playing at once, and drop the rest of its voice."""
        self._cancel_finishing()
        self.response = None
        self._muted = True
        self._voice_run = 0
        await self.speaker.drop()

    async def _follow_status(self) -> None:
        while True:
            status = await self.status.get()
            self.conversations = status.online and status.conversations

    # ---- settings ----

    async def _set_volume(self, volume: int) -> None:
        self.volume = volume

    async def _set_microphones(self, on: bool) -> None:
        if on == self.microphones_on:
            return
        self.microphones_on = on
        if on:
            # What was heard before they went off is no part of what comes now.
            self.wake_word.reset()
            self.voice_activity.reset()
            self.log.info("the microphones are on")
        else:
            self.log.info("the microphones are off")
            if self.turn is not None:
                self._send(TurnCancel(self.turn, "microphones off"))
                self._close_turn()
        if self._said_microphones:
            self.bus.publish(MicrophonesChanged(on))

    def _at_volume(self, pcm: bytes) -> bytes:
        return pcm if self.volume == 100 else native.scale_int16(pcm, self.volume / 100)

    # ---- helpers ----

    def _bytes(self, seconds: float) -> int:
        """``seconds`` of the microphones' audio, in whole frames' bytes."""
        frame = self.microphones.format.frame_bytes
        return round(seconds * self.rate / frame) * frame

    def _send(self, part: RobotPart) -> None:
        self.bus.publish(ConversationToCloud(part))

    def _set_state(self, state: InteractionState) -> None:
        if state != self.state:
            self.state = state
            self.bus.publish(InteractionChanged(state))

    def _cancel_finishing(self) -> None:
        if self._finishing is not None:
            self._finishing.cancel()
            self._finishing = None

    def _report_failure(self, task: asyncio.Task[None]) -> None:
        if not task.cancelled() and task.exception() is not None:
            self.log.error("finishing an answer failed", exc_info=task.exception())
