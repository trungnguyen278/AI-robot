# SPDX-License-Identifier: MIT
"""The link to ai-robot-server through a LiveKit server (protocol/cloud/README.md).

The robot gets a token for its room (``tokens.py``), joins it (ADR-0009), holds a
session with the cloud's agent there (``session.py``), and joins again after a loss. The
session's messages travel as text streams. The user's speech goes out on the robot's
``speech`` track, during turns only, and the agent's voice comes back on its own track.
"""

from __future__ import annotations

import asyncio
import contextlib
import itertools
import json
import logging
import random
from collections.abc import Awaitable, Callable, Iterator, Mapping, Sequence
from pathlib import Path
from typing import Any

import aiohttp
from livekit import rtc

from ai_robot.adapters.livekit.session import MAX_MESSAGE, TOPIC, Session
from ai_robot.adapters.livekit.tokens import (
    Access,
    NoToken,
    check_url,
    development_token,
    server_access,
)
from ai_robot.core.checks import finite, positive
from ai_robot.core.config import protocol_dir
from ai_robot.core.data import Schema
from ai_robot.ports.audio import AudioFormat
from ai_robot.ports.cloud import (
    CallCancelled,
    Capability,
    Cloud,
    CloudPart,
    ConversationAudio,
    EventKind,
    LinkStatus,
    RobotPart,
    ToolCall,
    TurnCancel,
    TurnStart,
    Voice,
)
from ai_robot.ports.identity import Identity

log = logging.getLogger(__name__)

# Fixed by the protocol (protocol/cloud/README.md): the names the cloud relies on.
SPEECH_TRACK = "speech"  # the robot's microphone track
TOKENS = ("server", "development")  # where the robot gets its tokens

# How this implementation works, which nobody needs to tune.
VOICE_FRAME_MS = 20  # the agent's voice is handed over in pieces this long
PLAYOUT_MARGIN = 1.0  # seconds, past what is queued, to wait for the speech to go out


def _load_schemas(path: Path) -> tuple[Schema, Schema]:
    """From protocol/cloud/schema.json: the schema of the messages from the cloud, and
    that of the token endpoint's answer."""
    try:
        schema = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise ValueError(f"cannot read the cloud protocol's schema: {error}") from None
    return (
        Schema("protocol/cloud/schema.json", {**schema, "$ref": "#/$defs/from_cloud"}),
        Schema("protocol/cloud/schema.json", {**schema, "$ref": "#/$defs/token_response"}),
    )


class TrackMicrophone:
    """The robot's ``speech`` track. It is muted outside turns, and fed only during
    them (PRIV-1).

    Like every microphone of a session, it never raises: a turn may still be speaking
    while the robot leaves the room, and the conversation must survive that.
    """

    def __init__(self, audio: AudioFormat) -> None:
        self.format = audio
        self.source = rtc.AudioSource(audio.sample_rate, audio.channels)
        self.track = rtc.LocalAudioTrack.create_audio_track(SPEECH_TRACK, self.source)
        self.closed = False

    async def publish(self, participant: rtc.LocalParticipant) -> None:
        options = rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
        await participant.publish_track(self.track, options)
        self.track.mute()

    async def start(self) -> None:
        if not self.closed:
            with self._guard("start"):
                self.track.unmute()

    async def write(self, pcm: bytes) -> None:
        samples = len(pcm) // self.format.frame_bytes
        if samples and not self.closed:
            data = pcm[: samples * self.format.frame_bytes]
            frame = rtc.AudioFrame(data, self.format.sample_rate, self.format.channels, samples)
            with self._guard("write"):
                await self.source.capture_frame(frame)

    async def stop(self, *, drop: bool) -> None:
        if self.closed:
            return
        with self._guard("stop"):
            if drop:
                self.source.clear_queue()
            else:
                # What is queued would be lost if the track were muted now: let it play out.
                with contextlib.suppress(TimeoutError):
                    async with asyncio.timeout(self.source.queued_duration + PLAYOUT_MARGIN):
                        await self.source.wait_for_playout()
            self.track.mute()

    async def aclose(self) -> None:
        self.closed = True
        await self.source.aclose()

    @contextlib.contextmanager
    def _guard(self, what: str) -> Iterator[None]:
        try:
            yield
        except Exception as error:  # the track is going away with the room
            log.warning("the speech track failed to %s: %s", what, error or type(error).__name__)


class NoMicrophone:
    """The microphone of a robot that holds no conversations: turns never start."""

    async def start(self) -> None:
        pass

    async def write(self, pcm: bytes) -> None:
        pass

    async def stop(self, *, drop: bool) -> None:
        pass


class LiveKitCloud(Cloud):
    """The link to the cloud through a LiveKit server (protocol/cloud/README.md, Joining).

    ``tokens`` says where the robot gets the token to join its room:
    - ``server``: from ``ai-robot-server`` at ``url`` (``https://``, or ``http://`` to
      this computer), in exchange for an assertion signed by the robot's identity
      (``identify``). The server says which LiveKit server to join;
    - ``development``: made with the key of a development LiveKit server at ``url``
      (``wss://``, or ``ws://`` to this computer), from the environment, for the room
      ``room`` and the participant ``participant``.

    The other settings, in seconds unless they say, are explained in
    ``config/base.toml`` (``[ports.cloud.livekit]``).
    """

    def __init__(
        self,
        *,
        tokens: str,
        url: str,
        room: str,
        participant: str,
        connect_timeout: float,
        hello_timeout: float,
        reconnect_first: float,
        reconnect_max: float,
        rate: float,
        burst: int,
        backlog: int,
        catalogue_ttl: float,
    ) -> None:
        if tokens not in TOKENS:
            raise ValueError(f"tokens must be one of {', '.join(TOKENS)}, got {tokens!r}")
        self.tokens = tokens
        schemes = ("https", "http") if tokens == "server" else ("wss", "ws")
        self.url = check_url("url", url, schemes)
        if not room or not participant:
            raise ValueError("room and participant must not be empty")
        self.room = room
        self.participant = participant
        self.connect_timeout = positive("connect_timeout", connect_timeout)
        self.hello_timeout = positive("hello_timeout", hello_timeout)
        self.reconnect_first = positive("reconnect_first", reconnect_first)
        self.reconnect_max = positive("reconnect_max", reconnect_max)
        if self.reconnect_max < self.reconnect_first:
            raise ValueError("reconnect_max must not be below reconnect_first")
        self.rate = positive("rate", rate)
        if burst < 1:
            raise ValueError(f"burst must be at least 1, got {burst}")
        self.burst = burst
        if backlog < 1:
            raise ValueError(f"backlog must be at least 1, got {backlog}")
        self.backlog = backlog
        self.catalogue_ttl = finite("catalogue_ttl", catalogue_ttl)
        if self.catalogue_ttl < 0:
            raise ValueError(f"catalogue_ttl must not be negative, got {catalogue_ttl}")
        self.capabilities: dict[str, Capability] = {}
        self.event_kinds: list[EventKind] = []
        self.audio: ConversationAudio | None = None  # offered for conversations, if any
        self.session: Session | None = None  # the session whose hello succeeded
        self.identity: Identity | None = None
        self.schema: Schema | None = None
        self._token_schema: Schema | None = None
        self._http: aiohttp.ClientSession | None = None
        self.numbers = itertools.count(1)
        self._offered = asyncio.Event()
        self._requests: asyncio.Queue[ToolCall | CallCancelled] = asyncio.Queue()
        self._statuses: asyncio.Queue[LinkStatus] = asyncio.Queue()
        self._heard: asyncio.Queue[CloudPart] = asyncio.Queue()
        self._task: asyncio.Task[None] | None = None

    async def open(self) -> None:
        self.schema, self._token_schema = await asyncio.to_thread(
            _load_schemas, protocol_dir() / "cloud" / "schema.json"
        )
        self._http = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.connect_timeout)
        )
        self._task = asyncio.create_task(self._run(), name="cloud link")

    async def close(self) -> None:
        if self.session is not None:
            with contextlib.suppress(Exception):
                await self.session.goodbye("stopping")
        if self._task is not None:  # the task leaves the room as it ends
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        if self._http is not None:
            await self._http.close()

    # ---- the port ----

    async def identify(self, identity: Identity) -> None:
        self.identity = identity

    async def offer(
        self,
        capabilities: Sequence[Capability],
        events: Sequence[EventKind],
        *,
        conversation: ConversationAudio | None = None,
    ) -> None:
        offered = {capability.name: capability for capability in capabilities}
        changed = offered != self.capabilities
        self.capabilities = offered
        self.event_kinds = list(events)
        self.audio = conversation
        self._offered.set()
        if changed and self.session is not None:
            await self.session.catalogue_changed()

    async def request(self) -> ToolCall | CallCancelled:
        return await self._requests.get()

    async def reply(
        self,
        call: ToolCall,
        *,
        data: Mapping[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        if self.session is not None:
            await self.session.reply(call, data, error)

    async def emit(self, name: str, data: Mapping[str, Any]) -> None:
        if self.session is not None:
            await self.session.emit(name, data)

    async def status(self) -> LinkStatus:
        return await self._statuses.get()

    async def converse(self, part: RobotPart) -> None:
        if self.session is not None:
            await self.session.converse(part)
        elif isinstance(part, TurnStart):
            self.heard(TurnCancel(part.turn, "offline"))

    async def conversation(self) -> CloudPart:
        return await self._heard.get()

    # ---- what sessions tell the link ----

    def opened(self, session: Session) -> None:
        """``session``'s hello exchange succeeded."""
        self.session = session
        self._statuses.put_nowait(
            LinkStatus(True, session.id, session.events, conversations=session.conversations)
        )

    def closed(self, session: Session) -> None:
        """``session`` ended: its calls in progress are cancelled, and its turn and
        response end."""
        if self.session is session:
            self.session = None
            self._statuses.put_nowait(LinkStatus(False))
        for call in session.cancel_calls():
            self._requests.put_nowait(CallCancelled(call))
        for part in session.abandon():
            self.heard(part)

    def called(self, call: ToolCall) -> None:
        self._requests.put_nowait(call)

    def cancelled(self, call: str) -> None:
        self._requests.put_nowait(CallCancelled(call))

    def heard(self, part: CloudPart) -> None:
        self._heard.put_nowait(part)

    # ---- joining the room, again and again ----

    async def _run(self) -> None:
        """Join the room, hold sessions there, and join again after a loss, for ever."""
        await self._offered.wait()
        failures = 0
        reported = False  # whether this outage was logged
        while True:
            reached = False
            try:
                reached = await self._stay(await self._access())
            except NoToken as error:
                if not reported:
                    log.warning("cannot join the cloud's room: %s", error)
                    reported = True
            except (rtc.ConnectError, aiohttp.ClientError, OSError, TimeoutError) as error:
                if not reported:
                    log.warning("cannot join the cloud's room: %s", error or type(error).__name__)
                    reported = True
            except Exception:  # the link must outlive any failure, and try again
                log.exception("the cloud link failed")
            if reached:
                reported = False
            failures = 0 if reached else failures + 1
            delay = random.uniform(0, min(self.reconnect_max, self.reconnect_first * 2**failures))
            await asyncio.sleep(delay)

    async def _access(self) -> Access:
        """Where to join the robot's room, and the token to join it with."""
        if self.tokens == "development":
            return Access(self.url, development_token(self.room, self.participant))
        if self.identity is None:
            raise NoToken("no identity to prove the robot's to the server")
        assert self._http is not None and self._token_schema is not None
        return await server_access(self._http, self.url, self.identity, self._token_schema)

    async def _stay(self, access: Access) -> bool:
        """One stay in the room. Returns whether a session's hello exchange succeeded."""
        assert self.schema is not None
        room = rtc.Room()
        stay = Stay(self, room, self.schema)
        options = rtc.RoomOptions(auto_subscribe=False, connect_timeout=self.connect_timeout)
        await room.connect(access.url, access.token, options)
        try:
            return await stay.run()
        finally:
            await stay.leave()


class Stay:
    """The robot in its room, from joining to leaving, with the sessions it holds there
    one after the other."""

    def __init__(self, link: LiveKitCloud, room: rtc.Room, schema: Schema) -> None:
        self.link = link
        self.room = room
        self.schema = schema
        self.offered = link.audio  # the audio of this stay's sessions, if any
        self.microphone: TrackMicrophone | None = None
        self.session: Session | None = None  # the session being held, hello or not
        self.reached = False  # whether a session's hello exchange succeeded
        self._agents: asyncio.Queue[str] = asyncio.Queue()  # agents that joined, in order
        self._refused: set[str] = set()  # agents whose hello failed, until they leave
        self._streams: asyncio.Queue[tuple[rtc.TextStreamReader, str]] = asyncio.Queue()
        self._voices: dict[str, asyncio.Task[None]] = {}  # track sid -> its reader
        self._running: asyncio.Task[bool] | None = None  # the session's run()
        self._warned: set[str] = set()
        self._lost = asyncio.Event()
        room.register_text_stream_handler(TOPIC, self._on_stream)
        room.on("participant_connected", self._on_joined)
        room.on("participant_disconnected", self._on_left)
        room.on("track_published", self._on_published)
        room.on("track_subscribed", self._on_subscribed)
        room.on("track_unsubscribed", self._on_unsubscribed)
        room.on("disconnected", lambda reason: self._lost.set())

    async def run(self) -> bool:
        if self.offered is not None:
            self.microphone = TrackMicrophone(self.offered.speech)
            await self.microphone.publish(self.room.local_participant)
            self._allow(None)
        for participant in list(self.room.remote_participants.values()):
            self._on_joined(participant)
        reader = asyncio.create_task(self._read_streams(), name="cloud messages")
        holder = asyncio.create_task(self._hold_sessions(), name="cloud sessions")
        try:
            await self._lost.wait()
            log.warning("lost the cloud's room")
        finally:
            for task in (reader, holder):
                task.cancel()
            for task in (reader, holder):
                with contextlib.suppress(asyncio.CancelledError):
                    await task
        return self.reached

    async def leave(self) -> None:
        for task in list(self._voices.values()):
            task.cancel()
        if self.microphone is not None:
            with contextlib.suppress(Exception):
                await self.microphone.aclose()
        with contextlib.suppress(Exception):
            await self.room.disconnect()

    # ---- sessions ----

    async def _hold_sessions(self) -> None:
        """Hold a session with each agent that joins, one at a time."""
        while True:
            agent = await self._agents.get()
            participant = self.room.remote_participants.get(agent)
            if participant is None or agent in self._refused or self.session is not None:
                continue
            session = Session(
                self.link,
                agent,
                self._sender(agent),
                self.microphone or NoMicrophone(),
                self.schema,
                next(self.link.numbers),
            )
            self.session = session
            self._allow(agent)
            if self.offered is not None:
                self._subscribe(participant)
            running = self._running = asyncio.create_task(
                session.run(), name=f"cloud session {agent}"
            )
            try:
                await asyncio.wait({running})  # it ends, or is cancelled when the agent leaves
                if running.cancelled():
                    pass
                elif running.exception() is not None:
                    log.error("the cloud session failed", exc_info=running.exception())
                elif not running.result():
                    self._refused.add(agent)
            finally:
                if not running.done():  # this task is being cancelled: so is the session
                    running.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await running
                if session.id:
                    self.reached = True
                await self._end(session)

    async def _end(self, session: Session) -> None:
        self.session = None
        self._running = None
        for task in list(self._voices.values()):
            task.cancel()
        self._voices.clear()
        self._allow(None)
        if self.microphone is not None:
            await self.microphone.stop(drop=True)
        self.link.closed(session)

    def _sender(self, agent: str) -> Callable[[str], Awaitable[None]]:
        async def send(text: str) -> None:
            try:
                await self.room.local_participant.send_text(
                    text, topic=TOPIC, destination_identities=[agent]
                )
            except Exception as error:  # the room is gone; the stay is ending
                log.warning("cannot send to the cloud: %s", error or type(error).__name__)

        return send

    def _allow(self, agent: str | None) -> None:
        """Let only ``agent``, if any, subscribe to the robot's microphone."""
        if self.microphone is None:
            return
        permissions = (
            []
            if agent is None
            else [rtc.ParticipantTrackPermission(participant_identity=agent, allow_all=True)]
        )
        self.room.local_participant.set_track_subscription_permissions(
            allow_all_participants=False, participant_permissions=permissions
        )

    # ---- participants ----

    def _on_joined(self, participant: rtc.RemoteParticipant) -> None:
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            self._agents.put_nowait(participant.identity)

    def _on_left(self, participant: rtc.RemoteParticipant) -> None:
        self._refused.discard(participant.identity)
        session = self.session
        if session is not None and participant.identity == session.agent:
            log.info("the agent %s left the room", participant.identity)
            if self._running is not None:
                self._running.cancel()
            # Another agent that is still in the room may take over.
            for other in self.room.remote_participants.values():
                if other.identity != participant.identity:
                    self._on_joined(other)

    # ---- the agent's voice ----

    def _subscribe(self, participant: rtc.RemoteParticipant) -> None:
        for publication in participant.track_publications.values():
            if publication.kind == rtc.TrackKind.KIND_AUDIO:
                publication.set_subscribed(True)

    def _on_published(
        self, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant
    ) -> None:
        session = self.session
        if (
            session is not None
            and participant.identity == session.agent
            and self.offered is not None
            and publication.kind == rtc.TrackKind.KIND_AUDIO
        ):
            publication.set_subscribed(True)

    def _on_subscribed(
        self,
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        session = self.session
        if (
            session is not None
            and participant.identity == session.agent
            and self.offered is not None
            and track.kind == rtc.TrackKind.KIND_AUDIO
        ):
            self._voices[track.sid] = asyncio.create_task(
                self._voice(track, self.offered.voice), name="cloud voice"
            )

    def _on_unsubscribed(
        self,
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        task = self._voices.pop(track.sid, None)
        if task is not None:
            task.cancel()

    async def _voice(self, track: rtc.Track, audio: AudioFormat) -> None:
        """Hand the agent's voice to the robot as it plays, in the robot's format."""
        stream = rtc.AudioStream.from_track(
            track=track,
            sample_rate=audio.sample_rate,
            num_channels=audio.channels,
            frame_size_ms=VOICE_FRAME_MS,
        )
        try:
            async for event in stream:
                session = self.session
                if session is not None and session.conversations:
                    self.link.heard(Voice(bytes(event.frame.data)))
        except Exception as error:  # the track went away with its agent or the room
            log.warning("the agent's voice stopped: %s", error or type(error).__name__)
        finally:
            await stream.aclose()

    # ---- messages ----

    def _on_stream(self, reader: rtc.TextStreamReader, identity: str) -> None:
        self._streams.put_nowait((reader, identity))

    async def _read_streams(self) -> None:
        """Read the messages in the order they came, and hand those of the session's
        agent to its session."""
        while True:
            reader, identity = await self._streams.get()
            try:
                text = await _read(reader)
            except Exception as error:  # a stream cut off on its way; the next may be whole
                log.warning("a message from %s was cut off: %s", identity, error)
                continue
            session = self.session
            if session is None or identity != session.agent:
                if identity not in self._warned:
                    self._warned.add(identity)
                    log.info("ignoring messages from %s: not the session's agent", identity)
            elif text is None:
                await session.oversized()
            else:
                await session.deliver(text)


async def _read(reader: rtc.TextStreamReader) -> str | None:
    """The whole message, or ``None`` if it is larger than the protocol allows."""
    chunks: list[str] = []
    size = 0
    async for chunk in reader:
        size += len(chunk.encode())
        if size > MAX_MESSAGE:
            return None
        chunks.append(chunk)
    return "".join(chunks)
