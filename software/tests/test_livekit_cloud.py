# SPDX-License-Identifier: MIT
"""The cloud link through a real LiveKit server, with a test playing the cloud's agent.

The tests need the LiveKit server: the path to `livekit-server` in the environment
variable LIVEKIT_SERVER, or the program on the PATH. Without it they are skipped. The
software workflow downloads it, so they always run in CI.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import math
import os
import shutil
import socket
import struct
import subprocess
import time
import uuid
from collections.abc import AsyncIterator, Iterator, Mapping
from pathlib import Path
from typing import Any

import pytest
from livekit import api, rtc
from token_server import TokenServer

from ai_robot.adapters.livekit import cloud
from ai_robot.adapters.livekit.cloud import LiveKitCloud, TrackMicrophone
from ai_robot.adapters.sim.identity import SimIdentity
from ai_robot.core.data import Schema
from ai_robot.ports import (
    AudioFormat,
    Capability,
    ConversationAudio,
    EventKind,
    SafetyClass,
    Speech,
    SpeechEnd,
    Trigger,
    TurnStart,
    Voice,
)

KEY = "test"
SECRET = "a-test-secret-that-is-long-enough-for-livekit"
TOPIC = "ai-robot"
TIMEOUT = 10.0
SCHEMA = Path(__file__).resolve().parents[2] / "protocol" / "cloud" / "schema.json"
AUDIO = ConversationAudio(AudioFormat(16000, 1), AudioFormat(16000, 1))
SWITCH = {"type": "object", "properties": {"on": {"type": "boolean"}}, "required": ["on"]}
LAMP = Capability("lamp.set", "Turn the lamp on or off", SWITCH, SafetyClass.INFORMATIONAL)
CHANGED = EventKind("lamp.changed", "The lamp changed", SWITCH)


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


@pytest.fixture(scope="module")
def server() -> Iterator[str]:
    """A LiveKit server on this computer, for these tests only; its address."""
    program = os.environ.get("LIVEKIT_SERVER") or shutil.which("livekit-server")
    if not program:
        pytest.skip("no LiveKit server: set LIVEKIT_SERVER, or put livekit-server on the PATH")
    port = free_port()
    config = (
        f"port: {port}\n"
        f"rtc:\n  udp_port: {free_port()}\n  tcp_port: {free_port()}\n  use_external_ip: false\n"
    )
    process = subprocess.Popen(
        [program, "--bind", "127.0.0.1", "--keys", f"{KEY}: {SECRET}", "--config-body", config],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        deadline = time.monotonic() + TIMEOUT
        while True:
            try:
                socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
                break
            except OSError:
                if time.monotonic() > deadline:
                    raise RuntimeError("the LiveKit server did not start") from None
                time.sleep(0.1)
        yield f"ws://127.0.0.1:{port}"
    finally:
        process.terminate()
        process.wait(timeout=TIMEOUT)


def token(room: str, identity: str, kind: str = "standard") -> str:
    grants = api.VideoGrants(room_join=True, room=room)
    return (
        api.AccessToken(KEY, SECRET)
        .with_identity(identity)
        .with_kind(kind)  # type: ignore[arg-type]
        .with_grants(grants)
        .to_jwt()
    )


def tone(seconds: float, rate: int = 16000, amplitude: int = 8000) -> bytes:
    """A 440 Hz tone, as 16-bit PCM, mono."""
    count = round(seconds * rate)
    return struct.pack(
        f"<{count}h",
        *(round(amplitude * math.sin(2 * math.pi * 440 * n / rate)) for n in range(count)),
    )


def loud(pcm: bytes) -> bool:
    samples = memoryview(pcm).cast("h")
    return max((abs(sample) for sample in samples), default=0) > 1000


class Participant:
    """Someone else in the robot's room: the cloud's agent, or the owner's phone."""

    def __init__(self) -> None:
        self.room = rtc.Room()
        self.messages: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self.robot_frames: list[bytes] = []  # what it hears on the robot's speech track
        self.subscribed = asyncio.Event()
        self.from_robot = Schema(
            "from_robot",
            {**json.loads(SCHEMA.read_text(encoding="utf-8")), "$ref": "#/$defs/from_robot"},
        )
        self.problems: list[str] = []
        self._tasks: list[asyncio.Task[None]] = []
        self.room.register_text_stream_handler(TOPIC, self._on_stream)
        self.room.on("track_subscribed", self._on_track)

    async def join(self, url: str, room: str, identity: str, kind: str) -> None:
        await self.room.connect(url, token(room, identity, kind))

    async def leave(self) -> None:
        for task in self._tasks:
            task.cancel()
        await self.room.disconnect()

    def _on_stream(self, reader: rtc.TextStreamReader, identity: str) -> None:
        async def read() -> None:
            message = json.loads(await reader.read_all())
            problem = self.from_robot.problem(message)
            if problem is not None:
                self.problems.append(f"{problem} in {message}")
            self.messages.put_nowait(message)

        self._tasks.append(asyncio.ensure_future(read()))

    def _on_track(self, track: rtc.Track, *_: Any) -> None:
        async def listen() -> None:
            stream = rtc.AudioStream.from_track(track=track, sample_rate=16000, num_channels=1)
            async for event in stream:
                self.robot_frames.append(bytes(event.frame.data))

        self.subscribed.set()
        self._tasks.append(asyncio.ensure_future(listen()))

    async def receive(self, timeout: float = TIMEOUT) -> dict[str, Any]:
        return await asyncio.wait_for(self.messages.get(), timeout)

    async def send(self, to: str, message: Mapping[str, Any]) -> None:
        await self.room.local_participant.send_text(
            json.dumps(message), topic=TOPIC, destination_identities=[to]
        )

    async def answer_hello(self, robot: Mapping[str, Any], **changes: Any) -> None:
        await self.send(
            "robot",
            {
                "type": "hello",
                "id": "c1",
                "reply_to": robot["id"],
                "protocol": "2.1",
                "session": {"id": f"s-{uuid.uuid4().hex[:8]}"},
                "time": time.time(),
                "conversations": True,
                "events": [],
                **changes,
            },
        )


@contextlib.asynccontextmanager
async def robot(
    url: str, monkeypatch: pytest.MonkeyPatch, conversation: ConversationAudio | None
) -> AsyncIterator[tuple[LiveKitCloud, str]]:
    """The robot's link, joined to a room of its own; the room's name."""
    room = f"robot-{uuid.uuid4().hex[:8]}"
    monkeypatch.setenv("AI_ROBOT_LIVEKIT_API_KEY", KEY)
    monkeypatch.setenv("AI_ROBOT_LIVEKIT_API_SECRET", SECRET)
    link = LiveKitCloud(
        tokens="development",
        url=url,
        room=room,
        participant="robot",
        connect_timeout=TIMEOUT,
        hello_timeout=TIMEOUT,
        reconnect_first=0.2,
        reconnect_max=1.0,
        rate=50.0,
        burst=100,
        backlog=500,
        catalogue_ttl=60.0,
    )
    await link.open()
    try:
        await link.offer([LAMP], [CHANGED], conversation=conversation)
        yield link, room
    finally:
        await link.close()


async def until(condition: Any, timeout: float = TIMEOUT) -> None:
    async with asyncio.timeout(timeout):
        while not condition():
            await asyncio.sleep(0.05)


def test_the_robot_and_the_agent_meet_in_the_room(
    server: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def main() -> None:
        async with robot(server, monkeypatch, None) as (link, room):
            agent, phone = Participant(), Participant()
            await agent.join(server, room, "agent", "agent")
            await phone.join(server, room, "phone", "standard")
            try:
                hello = await agent.receive()
                assert (hello["type"], hello["protocol"], hello["conversations"]) == (
                    "hello",
                    "2.1",
                    False,
                )
                await agent.answer_hello(hello)
                status = await asyncio.wait_for(link.status(), TIMEOUT)
                assert status.online and not status.conversations
                await agent.send(
                    "robot",
                    {
                        "type": "mcp",
                        "id": "c2",
                        "payload": {
                            "jsonrpc": "2.0",
                            "id": 1,
                            "method": "tools/list",
                            "params": {
                                "_meta": {
                                    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                                    "io.modelcontextprotocol/clientCapabilities": {},
                                }
                            },
                        },
                    },
                )
                listed = await agent.receive()
                assert listed["reply_to"] == "c2"
                assert [tool["name"] for tool in listed["payload"]["result"]["tools"]] == [
                    "lamp.set"
                ]
                # Someone who is not an agent cannot call the robot's capabilities.
                await phone.send(
                    "robot",
                    {
                        "type": "mcp",
                        "id": "p1",
                        "payload": {
                            "jsonrpc": "2.0",
                            "id": 1,
                            "method": "tools/call",
                            "params": {"name": "lamp.set", "arguments": {"on": True}},
                        },
                    },
                )
                with pytest.raises(TimeoutError):
                    await asyncio.wait_for(link.request(), 1.0)
                assert phone.messages.empty()
                await link.close()
                bye = await agent.receive()
                assert (bye["type"], bye["reason"]) == ("bye", "stopping")
                assert agent.problems == []
            finally:
                await agent.leave()
                await phone.leave()

    asyncio.run(main())


def test_speech_and_voice_travel_on_tracks_and_only_the_agent_hears_the_robot(
    server: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def main() -> None:
        async with robot(server, monkeypatch, AUDIO) as (link, room):
            agent, phone = Participant(), Participant()
            await agent.join(server, room, "agent", "agent")
            await phone.join(server, room, "phone", "standard")
            try:
                hello = await agent.receive()
                assert hello["conversations"] is True
                await agent.answer_hello(hello)
                assert (await asyncio.wait_for(link.status(), TIMEOUT)).conversations
                await asyncio.wait_for(agent.subscribed.wait(), TIMEOUT)

                # The user's speech, during a turn only.
                await link.converse(TurnStart("t1", Trigger.TAP))
                start = await agent.receive()
                assert (start["type"], start["turn"]) == ("turn.start", "t1")
                speech = tone(1.0)
                for offset in range(0, len(speech), 640):  # 20 ms pieces, as voice gives them
                    await link.converse(Speech("t1", speech[offset : offset + 640]))
                await link.converse(SpeechEnd("t1"))
                end = await agent.receive()
                assert (end["type"], end["speech_ms"]) == ("turn.speech_end", 1000)
                await until(lambda: sum(loud(frame) for frame in agent.robot_frames) > 50)
                # The phone may not subscribe to the robot's microphone.
                assert not phone.subscribed.is_set()

                # The agent's voice reaches the robot as it plays.
                source = rtc.AudioSource(16000, 1)
                track = rtc.LocalAudioTrack.create_audio_track("voice", source)
                options = rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
                await agent.room.local_participant.publish_track(track, options)
                await asyncio.sleep(0.5)
                voice = tone(1.0)
                for offset in range(0, len(voice), 320):
                    frame = rtc.AudioFrame(voice[offset : offset + 320], 16000, 1, 160)
                    await source.capture_frame(frame)
                heard = 0
                async with asyncio.timeout(TIMEOUT):
                    while heard < 20:
                        part = await link.conversation()
                        if isinstance(part, Voice) and loud(part.pcm):
                            heard += 1
                assert agent.problems == []
            finally:
                await agent.leave()
                await phone.leave()

    asyncio.run(main())


def test_a_new_agent_opens_a_new_session_when_the_first_leaves(
    server: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def main() -> None:
        async with robot(server, monkeypatch, None) as (link, room):
            first = Participant()
            await first.join(server, room, "agent-1", "agent")
            await first.answer_hello(await first.receive())
            assert (await asyncio.wait_for(link.status(), TIMEOUT)).online
            await first.leave()
            assert not (await asyncio.wait_for(link.status(), TIMEOUT)).online
            second = Participant()
            await second.join(server, room, "agent-2", "agent")
            try:
                await second.answer_hello(await second.receive())
                assert (await asyncio.wait_for(link.status(), TIMEOUT)).online
            finally:
                await second.leave()

    asyncio.run(main())


# ---- without a server ----


def test_the_speech_track_never_raises_once_the_room_is_left(
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def main() -> None:
        microphone = TrackMicrophone(AudioFormat(16000, 1))
        await microphone.start()
        await microphone.write(bytes(640))
        # The source goes away under a turn still speaking: the failure is logged.
        await microphone.source.aclose()
        await microphone.stop(drop=True)
        # Once the room is left, the microphone does nothing at all.
        await microphone.aclose()
        await microphone.start()
        await microphone.write(bytes(640))
        await microphone.stop(drop=False)

    with caplog.at_level(logging.WARNING):
        asyncio.run(main())
    assert "the speech track failed to stop" in caplog.text


def test_the_link_outlives_any_failure_and_tries_again(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    async def main() -> None:
        def broken(room: str, participant: str) -> str:
            raise RuntimeError("a bug")

        monkeypatch.setattr(cloud, "development_token", broken)
        link = LiveKitCloud(
            tokens="development",
            url="ws://127.0.0.1:9",
            room="robot",
            participant="robot",
            connect_timeout=1.0,
            hello_timeout=1.0,
            reconnect_first=0.01,
            reconnect_max=0.02,
            rate=50.0,
            burst=100,
            backlog=500,
            catalogue_ttl=60.0,
        )
        await link.open()
        try:
            await link.offer([LAMP], [CHANGED])
            await until(lambda: caplog.text.count("the cloud link failed") >= 2)
            assert link._task is not None and not link._task.done()
        finally:
            await link.close()

    with caplog.at_level(logging.ERROR):
        asyncio.run(main())


def test_a_robot_gets_its_room_from_the_server(server: str) -> None:
    async def main() -> None:
        identity = SimIdentity()
        await identity.open()
        room = f"robot-{uuid.uuid4().hex[:8]}"
        tokens = TokenServer(
            {await identity.robot_id(): await identity.public_key()},
            livekit_url=server,
            mint=lambda robot: token(room, "robot"),
        )
        await tokens.start()
        link = LiveKitCloud(
            tokens="server",
            url=tokens.url,
            room="unused",
            participant="unused",
            connect_timeout=TIMEOUT,
            hello_timeout=TIMEOUT,
            reconnect_first=0.2,
            reconnect_max=1.0,
            rate=50.0,
            burst=100,
            backlog=500,
            catalogue_ttl=60.0,
        )
        await link.identify(identity)
        await link.open()
        agent = Participant()
        try:
            await link.offer([LAMP], [CHANGED])
            await agent.join(server, room, "agent", "agent")
            await agent.answer_hello(await agent.receive())
            assert (await asyncio.wait_for(link.status(), TIMEOUT)).online
            assert len(tokens.assertions) == 1
        finally:
            await agent.leave()
            await link.close()
            await tokens.stop()

    asyncio.run(main())
