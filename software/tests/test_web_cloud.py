# SPDX-License-Identifier: MIT
"""The cloud link over a WebSocket, against a fake cloud that speaks the protocol."""

from __future__ import annotations

import asyncio
import contextlib
import itertools
import json
import logging
import struct
import time
from collections.abc import AsyncIterator, Mapping
from pathlib import Path
from typing import Any

import pytest
from aiohttp import WSMsgType, web

from ai_robot.adapters.web import cloud as adapter
from ai_robot.adapters.web.cloud import WebSocketCloud
from ai_robot.core.data import Schema
from ai_robot.ports import (
    CallCancelled,
    Capability,
    CloudPart,
    EventKind,
    Interrupted,
    LinkStatus,
    ResponseEnd,
    ResponseStart,
    ResponseStop,
    ResponseText,
    SafetyClass,
    Speech,
    SpeechEnd,
    ToolCall,
    Trigger,
    TurnCancel,
    TurnStart,
    Voice,
)
from ai_robot.ports.cloud import BASELINE

SCHEMA = Path(__file__).resolve().parents[2] / "protocol" / "cloud" / "schema.json"
MCP_META = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
}
TIMEOUT = 2.0


def schema(direction: str) -> Schema:
    root = json.loads(SCHEMA.read_text(encoding="utf-8"))
    return Schema(f"from_{direction}", {**root, "$ref": f"#/$defs/from_{direction}"})


class FakeCloud:
    """A server that answers the robot's hello, checks every message the robot sends
    against the protocol's schema (``problems``), and hands each connection to the test.

    ``hello`` overrides fields of the cloud's hello; ``answer=False`` never answers;
    ``token`` refuses robots without that bearer token.
    """

    def __init__(
        self,
        *,
        hello: Mapping[str, Any] | None = None,
        answer: bool = True,
        token: str | None = None,
        events: tuple[str, ...] = ("lamp.changed",),
    ) -> None:
        self.hello = dict(hello or {})
        self.answer = answer
        self.token = token
        self.events = events
        self.from_robot = schema("robot")
        self.problems: list[str] = []
        self.headers: list[dict[str, str]] = []
        self.connections: asyncio.Queue[Connection] = asyncio.Queue()
        self.url = ""
        self._sessions = itertools.count(1)
        self._runner: web.AppRunner | None = None

    async def start(self) -> None:
        app = web.Application()
        app.router.add_get("/robot", self._connect)
        self._runner = web.AppRunner(app, access_log=None, shutdown_timeout=1.0)
        await self._runner.setup()
        await web.TCPSite(self._runner, "127.0.0.1", 0).start()
        port = self._runner.addresses[0][1]
        self.url = f"ws://127.0.0.1:{port}/robot"

    async def stop(self) -> None:
        if self._runner is not None:
            await self._runner.cleanup()

    async def next_connection(self) -> Connection:
        return await asyncio.wait_for(self.connections.get(), TIMEOUT)

    async def _connect(self, request: web.Request) -> web.WebSocketResponse:
        self.headers.append(dict(request.headers))
        if self.token is not None and request.headers.get("Authorization") != (
            f"Bearer {self.token}"
        ):
            raise web.HTTPUnauthorized()
        socket = web.WebSocketResponse()
        await socket.prepare(request)
        connection = Connection(self, socket, next(self._sessions))
        self.connections.put_nowait(connection)
        await connection.serve()
        return socket


class Connection:
    """One robot connected to the fake cloud."""

    def __init__(self, cloud: FakeCloud, socket: web.WebSocketResponse, number: int) -> None:
        self.cloud = cloud
        self.socket = socket
        self.number = number
        self.hello: dict[str, Any] = {}  # the robot's
        self.received: asyncio.Queue[dict[str, Any] | bytes] = asyncio.Queue()
        self.close_code: int | None = None
        self.closed = asyncio.Event()
        self._ids = itertools.count(2)

    async def serve(self) -> None:
        try:
            while True:
                frame = await self.socket.receive()
                if frame.type == WSMsgType.CLOSE:
                    self.close_code = frame.data  # the robot's code, before aiohttp answers
                    break
                if frame.type in (WSMsgType.CLOSING, WSMsgType.CLOSED, WSMsgType.ERROR):
                    break
                if frame.type == WSMsgType.TEXT:
                    message = json.loads(frame.data)
                    problem = self.cloud.from_robot.problem(message)
                    if problem is not None:
                        self.cloud.problems.append(f"{problem} in {message}")
                    if message.get("type") == "hello" and not self.hello:
                        self.hello = message
                        if self.cloud.answer:
                            await self.socket.send_json(self._hello(message))
                        continue
                    self.received.put_nowait(message)
                elif frame.type == WSMsgType.BINARY:
                    self.received.put_nowait(frame.data)
        finally:
            if self.close_code is None:
                self.close_code = self.socket.close_code
            self.closed.set()

    def _hello(self, robot: Mapping[str, Any]) -> dict[str, Any]:
        return {
            "type": "hello",
            "id": "c1",
            "reply_to": robot["id"],
            "protocol": "1.0",
            "session": {
                "id": f"s-{self.number}",
                "resume": f"k-{self.number}",
                "resume_within": 60,
            },
            "time": time.time(),
            "media": {"speech": None, "voice": None},
            "events": list(self.cloud.events),
            **self.cloud.hello,
        }

    async def send(self, message: Mapping[str, Any]) -> str:
        """Send ``message``, with a new id unless it has one; returns the id."""
        message = {"id": f"c{next(self._ids)}", **message}
        await self.socket.send_json(message)
        return str(message["id"])

    async def send_text(self, text: str) -> None:
        await self.socket.send_str(text)

    async def receive(self, timeout: float = TIMEOUT) -> Any:
        """The robot's next message after the hello: a dict, or bytes for a frame."""
        return await asyncio.wait_for(self.received.get(), timeout)

    async def nothing(self, wait: float = 0.1) -> bool:
        """Whether the robot sends nothing for ``wait`` seconds."""
        await asyncio.sleep(wait)
        return self.received.empty()

    async def request(
        self, method: str, params: Mapping[str, Any] | None = None, *, request: Any = None
    ) -> str:
        """Send an MCP request; returns the id of the message that carried it."""
        payload = {
            "jsonrpc": "2.0",
            "id": next(self._ids) if request is None else request,
            "method": method,
            "params": {"_meta": MCP_META, **(params or {})},
        }
        return await self.send({"type": "mcp", "payload": payload})

    async def mcp(self, method: str, params: Mapping[str, Any] | None = None) -> dict[str, Any]:
        """Send an MCP request and return the payload of the robot's answer."""
        sent = await self.request(method, params)
        message = await self.receive()
        assert message["type"] == "mcp" and message["reply_to"] == sent, message
        return message["payload"]


SWITCH = {
    "type": "object",
    "properties": {"on": {"type": "boolean"}},
    "required": ["on"],
    "additionalProperties": False,
}
LAMP = Capability(
    "lamp.set", "Turn the lamp on or off", SWITCH, SafetyClass.INFORMATIONAL, output_schema=SWITCH
)
CHANGED = EventKind("lamp.changed", "The lamp changed", SWITCH)


# The link's settings, as shipped, but reconnecting at once so that the tests do not wait.
SETTINGS = {
    "connect_timeout": 10.0,
    "hello_timeout": 5.0,
    "ping_after": 10.0,
    "send_timeout": 5.0,
    "close_timeout": 2.0,
    "reconnect_first": 0.01,
    "reconnect_max": 60.0,
    "rate": 50.0,
    "burst": 100,
    "catalogue_ttl": 60.0,
}


@contextlib.asynccontextmanager
async def linked(
    cloud: FakeCloud | None = None, *, conversation: bool = False, **settings: Any
) -> AsyncIterator[tuple[WebSocketCloud, Any]]:
    """A fake cloud and an open link to it that offered ``LAMP`` and ``CHANGED``, and to
    converse if ``conversation``."""
    cloud = cloud or FakeCloud()
    await cloud.start()
    link = WebSocketCloud(url=cloud.url, **{**SETTINGS, **settings})
    await link.open()
    try:
        await link.offer([LAMP], [CHANGED], conversation=conversation)
        yield link, cloud
    finally:
        await link.close()
        await cloud.stop()
    assert cloud.problems == []  # every message from the robot follows the schema


async def online(link: WebSocketCloud, cloud: FakeCloud) -> Connection:
    """The connection, once the session is open."""
    connection = await cloud.next_connection()
    status = await asyncio.wait_for(link.status(), TIMEOUT)
    assert status.online
    return connection


@contextlib.asynccontextmanager
async def talking() -> AsyncIterator[tuple[WebSocketCloud, Connection]]:
    """An open session whose cloud took both audio streams in the baseline format."""
    cloud = FakeCloud(hello={"media": {"speech": 0, "voice": 0}})
    async with linked(cloud, conversation=True) as (link, cloud):
        yield link, await online(link, cloud)


async def heard(link: WebSocketCloud) -> CloudPart:
    """The cloud's next part of the conversation, as the link hands it to the robot."""
    return await asyncio.wait_for(link.conversation(), TIMEOUT)


async def silent(link: WebSocketCloud, wait: float = 0.1) -> bool:
    """Whether the link hands the robot nothing of the conversation for ``wait`` seconds."""
    try:
        await asyncio.wait_for(link.conversation(), wait)
    except TimeoutError:
        return True
    return False


def frame(
    audio: bytes,
    *,
    stream: int = 2,
    form: int = 0,
    flags: int = 0,
    sequence: int = 1,
    timestamp: int = 0,
    version: int = 1,
) -> bytes:
    """An audio frame: its header, then ``audio``. By default, the cloud's first."""
    return struct.pack(">BBBBII", version, stream, form, flags, sequence, timestamp) + audio


def header(data: bytes) -> tuple[int, ...]:
    """The fields of a frame's header: version, stream, format, flags, sequence, timestamp."""
    return struct.unpack(">BBBBII", data[:12])


def test_the_session_opens_with_a_hello_exchange() -> None:
    async def main() -> None:
        async with linked(FakeCloud(events=("lamp.changed", "lamp.unknown"))) as (link, cloud):
            connection = await cloud.next_connection()
            status = await asyncio.wait_for(link.status(), TIMEOUT)
            assert status == LinkStatus(True, "s-1", frozenset({"lamp.changed"}))
            hello = connection.hello
            assert (hello["type"], hello["id"], hello["protocol"]) == ("hello", "r1", "1.0")
            assert hello["media"] == {"speech": [], "voice": []}
            assert [event["name"] for event in hello["events"]] == ["lamp.changed"]
            assert "resume" not in hello

    asyncio.run(main())


def test_the_cloud_discovers_and_lists_the_capabilities() -> None:
    async def main() -> None:
        async with linked() as (link, cloud):
            connection = await online(link, cloud)
            discovered = await connection.mcp("server/discover")
            assert discovered["result"]["supportedVersions"] == ["2026-07-28"]
            assert discovered["result"]["capabilities"] == {"tools": {"listChanged": True}}
            assert discovered["result"]["resultType"] == "complete"
            server = discovered["result"]["_meta"]["io.modelcontextprotocol/serverInfo"]
            assert server["name"] == "ai-robot"
            listed = (await connection.mcp("tools/list"))["result"]
            assert (listed["ttlMs"], listed["cacheScope"]) == (60_000, "private")
            assert listed["tools"] == [
                {
                    "name": "lamp.set",
                    "description": "Turn the lamp on or off",
                    "inputSchema": SWITCH,
                    "outputSchema": SWITCH,
                    "_meta": {"ai-robot/safety": "informational", "ai-robot/version": 1},
                }
            ]

    asyncio.run(main())


def test_a_call_reaches_the_robot_and_its_answer_the_cloud() -> None:
    async def main() -> None:
        async with linked() as (link, cloud):
            connection = await online(link, cloud)
            sent = await connection.request(
                "tools/call", {"name": "lamp.set", "arguments": {"on": True}}
            )
            call = await asyncio.wait_for(link.request(), TIMEOUT)
            assert isinstance(call, ToolCall)
            assert (call.name, dict(call.arguments)) == ("lamp.set", {"on": True})
            await link.reply(call, data={"on": True})
            answer = await connection.receive()
            assert answer["reply_to"] == sent
            result = answer["payload"]["result"]
            assert result["structuredContent"] == {"on": True}
            assert result["content"] == [{"type": "text", "text": '{"on": true}'}]
            assert result["isError"] is False
            await connection.request("tools/call", {"name": "lamp.set", "arguments": {}})
            call = await asyncio.wait_for(link.request(), TIMEOUT)
            await link.reply(call, error="invalid arguments: 'on' is a required property")
            result = (await connection.receive())["payload"]["result"]
            assert result["isError"] is True
            assert result["content"][0]["text"] == "invalid arguments: 'on' is a required property"

    asyncio.run(main())


@pytest.mark.parametrize(
    ("method", "params", "code", "message"),
    [
        ("tools/call", {"name": "lamp.fly"}, -32602, "Unknown tool: lamp.fly"),
        ("tools/call", {"name": "lamp.set", "arguments": [1]}, -32602, "params.arguments"),
        ("tools/list", {"cursor": "2"}, -32602, "Invalid cursor"),
        ("prompts/list", {}, -32601, "Method not found: prompts/list"),
    ],
)
def test_requests_the_robot_cannot_serve_get_an_error(
    method: str, params: dict[str, Any], code: int, message: str
) -> None:
    async def main() -> None:
        async with linked() as (link, cloud):
            connection = await online(link, cloud)
            error = (await connection.mcp(method, params))["error"]
            assert error["code"] == code and error["message"].startswith(message)

    asyncio.run(main())


def test_requests_without_the_right_metadata_get_an_error() -> None:
    async def main() -> None:
        async with linked() as (link, cloud):
            connection = await online(link, cloud)
            old = {
                "jsonrpc": "2.0",
                "id": 7,
                "method": "tools/list",
                "params": {
                    "_meta": {
                        "io.modelcontextprotocol/protocolVersion": "2025-06-18",
                        "io.modelcontextprotocol/clientCapabilities": {},
                    }
                },
            }
            await connection.send({"type": "mcp", "payload": old})
            error = (await connection.receive())["payload"]["error"]
            assert error["code"] == -32022
            assert error["data"] == {"supported": ["2026-07-28"], "requested": "2025-06-18"}
            bare = {"jsonrpc": "2.0", "id": 8, "method": "tools/list", "params": {}}
            await connection.send({"type": "mcp", "payload": bare})
            assert (await connection.receive())["payload"]["error"]["code"] == -32602
            odd = {"jsonrpc": "2.0", "id": True, "method": "tools/list", "params": {}}
            await connection.send({"type": "mcp", "payload": odd})
            payload = (await connection.receive())["payload"]
            assert payload["error"]["code"] == -32600 and "id" not in payload

    asyncio.run(main())


def test_a_subscription_hears_of_catalogue_changes_until_it_is_cancelled() -> None:
    async def main() -> None:
        async with linked() as (link, cloud):
            connection = await online(link, cloud)
            sent = await connection.request(
                "subscriptions/listen", {"notifications": {"toolsListChanged": True}}, request=5
            )
            ack = await connection.receive()
            assert ack["reply_to"] == sent
            assert ack["payload"]["method"] == "notifications/subscriptions/acknowledged"
            assert ack["payload"]["params"]["_meta"] == {
                "io.modelcontextprotocol/subscriptionId": 5
            }
            assert ack["payload"]["params"]["notifications"] == {"toolsListChanged": True}
            blink = Capability("lamp.blink", "Blink", {"type": "object"}, SafetyClass.INFORMATIONAL)
            await link.offer([LAMP, blink], [CHANGED])
            changed = (await connection.receive())["payload"]
            assert changed["method"] == "notifications/tools/list_changed"
            assert changed["params"]["_meta"] == {"io.modelcontextprotocol/subscriptionId": 5}
            await link.offer([LAMP, blink], [CHANGED])  # no change, no notification
            cancel = {
                "jsonrpc": "2.0",
                "method": "notifications/cancelled",
                "params": {"requestId": 5},
            }
            await connection.send({"type": "mcp", "payload": cancel})
            await asyncio.sleep(0.05)
            await link.offer([LAMP], [CHANGED])
            assert await connection.nothing()

    asyncio.run(main())


def test_a_cancelled_call_is_not_answered() -> None:
    async def main() -> None:
        async with linked() as (link, cloud):
            connection = await online(link, cloud)
            await connection.request(
                "tools/call", {"name": "lamp.set", "arguments": {"on": True}}, request="x"
            )
            call = await asyncio.wait_for(link.request(), TIMEOUT)
            assert isinstance(call, ToolCall)
            cancel = {
                "jsonrpc": "2.0",
                "method": "notifications/cancelled",
                "params": {"requestId": "x", "reason": "no longer needed"},
            }
            await connection.send({"type": "mcp", "payload": cancel})
            assert await asyncio.wait_for(link.request(), TIMEOUT) == CallCancelled(call.id)
            await link.reply(call, data={"on": True})
            assert await connection.nothing()

    asyncio.run(main())


def test_events_go_only_to_a_cloud_that_subscribed() -> None:
    async def main() -> None:
        async with linked() as (link, cloud):
            connection = await online(link, cloud)
            await link.emit("lamp.changed", {"on": True})
            event = await connection.receive()
            assert (event["type"], event["name"], event["data"]) == (
                "event",
                "lamp.changed",
                {"on": True},
            )
            await link.emit("lamp.other", {})
            assert await connection.nothing()

    asyncio.run(main())


def test_bad_messages_get_an_error_and_the_session_goes_on() -> None:
    async def main() -> None:
        async with linked() as (link, cloud):
            connection = await online(link, cloud)
            await connection.send_text("not json")
            assert (await connection.receive())["message"] == "not JSON"
            await connection.send_text('{"type": "event", "id": "c50", "x": NaN}')
            assert (await connection.receive())["message"] == "not JSON"
            sent = await connection.send({"type": "mcp", "payload": {"jsonrpc": "1.0"}})
            error = await connection.receive()
            assert (error["type"], error["code"], error["reply_to"]) == (
                "error",
                "invalid_message",
                sent,
            )
            # A type the robot does not know is ignored, not refused.
            await connection.send({"type": "mood.changed", "mood": "calm"})
            assert await connection.nothing()
            assert "result" in await connection.mcp("tools/list")

    asyncio.run(main())


def test_a_resent_message_acts_only_once() -> None:
    async def main() -> None:
        async with linked() as (link, cloud):
            connection = await online(link, cloud)
            request = {
                "type": "mcp",
                "id": "c77",
                "payload": {
                    "jsonrpc": "2.0",
                    "id": 77,
                    "method": "tools/list",
                    "params": {
                        "_meta": {
                            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                            "io.modelcontextprotocol/clientCapabilities": {},
                        }
                    },
                },
            }
            await connection.send(request)
            await connection.send(request)
            assert (await connection.receive())["reply_to"] == "c77"
            assert await connection.nothing()

    asyncio.run(main())


def test_too_many_messages_are_dropped_and_reported_now_and_then() -> None:
    async def main() -> None:
        async with linked(burst=3, rate=20.0) as (link, cloud):
            connection = await online(link, cloud)
            for _ in range(40):  # a flood, while the bucket keeps refilling a little
                await connection.send({"type": "mood.changed", "mood": "calm"})
                await asyncio.sleep(0.01)
            error = await connection.receive()
            assert (error["type"], error["code"]) == ("error", "rate_limited")
            assert await connection.nothing()  # one report, not one per refill

    asyncio.run(main())


def test_after_a_loss_the_robot_reconnects_and_resumes() -> None:
    async def main() -> None:
        async with linked() as (link, cloud):
            first = await online(link, cloud)
            await first.socket.close()
            assert await asyncio.wait_for(link.status(), TIMEOUT) == LinkStatus(False)
            second = await online(link, cloud)
            assert second.hello["resume"] == "k-1"
            assert "result" in await second.mcp("tools/list")

    asyncio.run(main())


def test_a_call_in_progress_ends_with_its_session() -> None:
    async def main() -> None:
        async with linked() as (link, cloud):
            connection = await online(link, cloud)
            await connection.request("tools/call", {"name": "lamp.set", "arguments": {"on": True}})
            call = await asyncio.wait_for(link.request(), TIMEOUT)
            await connection.socket.close()
            assert await asyncio.wait_for(link.request(), TIMEOUT) == CallCancelled(call.id)
            await link.reply(call, data={"on": True})  # dropped: its session is gone
            assert await asyncio.wait_for(link.status(), TIMEOUT) == LinkStatus(False)
            second = await online(link, cloud)
            assert await second.nothing()

    asyncio.run(main())


def test_without_a_hello_from_the_cloud_the_robot_hangs_up() -> None:
    async def main() -> None:
        async with linked(FakeCloud(answer=False), hello_timeout=0.2) as (_, cloud):
            connection = await cloud.next_connection()
            await asyncio.wait_for(connection.closed.wait(), TIMEOUT)
            assert connection.close_code == 4001

    asyncio.run(main())


def test_another_major_version_is_refused() -> None:
    async def main() -> None:
        async with linked(FakeCloud(hello={"protocol": "2.0"})) as (link, cloud):
            connection = await cloud.next_connection()
            await asyncio.wait_for(connection.closed.wait(), TIMEOUT)
            assert connection.close_code == 4000
            assert link.session is None

    asyncio.run(main())


def test_the_robot_says_goodbye_when_it_stops() -> None:
    async def main() -> None:
        cloud = FakeCloud()
        await cloud.start()
        link = WebSocketCloud(url=cloud.url, **SETTINGS)
        await link.open()
        try:
            await link.offer([LAMP], [CHANGED])
            connection = await online(link, cloud)
            await connection.request(
                "subscriptions/listen", {"notifications": {"toolsListChanged": True}}, request=3
            )
            await connection.receive()  # the acknowledgement
            await link.close()
            ended = (await connection.receive())["payload"]
            assert ended == {
                "jsonrpc": "2.0",
                "id": 3,
                "result": {
                    "resultType": "complete",
                    "_meta": {"io.modelcontextprotocol/subscriptionId": 3},
                },
            }
            bye = await connection.receive()
            assert (bye["type"], bye["reason"]) == ("bye", "stopping")
            await asyncio.wait_for(connection.closed.wait(), TIMEOUT)
            assert connection.close_code == 1001
        finally:
            await cloud.stop()
        assert cloud.problems == []

    asyncio.run(main())


def test_credentials_go_in_the_authorization_header(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    async def main() -> None:
        monkeypatch.setenv("AI_ROBOT_CLOUD_TOKEN", "secret")
        async with linked(FakeCloud(token="secret")) as (link, cloud):
            await online(link, cloud)
            assert cloud.headers[0]["Authorization"] == "Bearer secret"
        monkeypatch.setenv("AI_ROBOT_CLOUD_TOKEN", "wrong")
        async with linked(FakeCloud(token="secret")) as (link, cloud):
            async with asyncio.timeout(TIMEOUT):
                while not cloud.headers:
                    await asyncio.sleep(0.01)
            await asyncio.sleep(0.05)
            assert link.session is None

    with caplog.at_level(logging.WARNING):
        asyncio.run(main())
    assert "the cloud refused the robot's credentials (401)" in caplog.text


def test_an_oversized_frame_ends_the_session() -> None:
    async def main() -> None:
        async with linked() as (link, cloud):
            connection = await online(link, cloud)
            await connection.socket.send_bytes(bytes(adapter.MAX_BINARY + 1))
            await asyncio.wait_for(connection.closed.wait(), TIMEOUT)
            assert connection.close_code == 1009

    asyncio.run(main())


# ---- conversations ----

BASELINE_OFFER = {"id": 0, "codec": "pcm_s16le", "rate": 16000, "channels": 1, "frame_ms": 20}


def test_a_robot_that_converses_offers_the_baseline_for_each_stream() -> None:
    async def main() -> None:
        cloud = FakeCloud(hello={"media": {"speech": 0, "voice": None}})
        async with linked(cloud, conversation=True) as (link, cloud):
            connection = await cloud.next_connection()
            status = await asyncio.wait_for(link.status(), TIMEOUT)
            assert connection.hello["media"] == {
                "speech": [BASELINE_OFFER],
                "voice": [BASELINE_OFFER],
            }
            assert (status.speech, status.voice) == (BASELINE, None)  # voice was declined

    asyncio.run(main())


def test_a_format_the_robot_did_not_offer_ends_the_session() -> None:
    async def main() -> None:
        cloud = FakeCloud(hello={"media": {"speech": 1, "voice": None}})
        async with linked(cloud, conversation=True) as (link, cloud):
            connection = await cloud.next_connection()
            await asyncio.wait_for(connection.closed.wait(), TIMEOUT)
            assert connection.close_code == 4001
            assert link.session is None

    asyncio.run(main())


def test_speech_goes_out_in_frames_and_the_last_one_is_marked() -> None:
    async def main() -> None:
        async with talking() as (link, connection):
            context = {"battery": 80.0, "charging": False}
            await link.converse(TurnStart("t1", Trigger.WAKE_WORD, context))
            start = await connection.receive()
            assert {key: start[key] for key in ("type", "turn", "trigger", "context")} == {
                "type": "turn.start",
                "turn": "t1",
                "trigger": "wake_word",
                "context": context,
            }
            speech = bytes(range(256)) * 6  # 1536 bytes: two 640-byte frames, and 256 more
            for piece in (speech[:500], speech[500:1000], speech[1000:]):
                await link.converse(Speech("t1", piece))
            first = await connection.receive()
            assert header(first) == (1, 1, 0, 0, 1, 0) and first[12:] == speech[:640]
            assert await connection.nothing()  # the second waits: it may be the last
            await link.converse(SpeechEnd("t1"))
            second, last, end = [await connection.receive() for _ in range(3)]
            assert header(second) == (1, 1, 0, 0, 2, 320) and second[12:] == speech[640:1280]
            assert header(last) == (1, 1, 0, 1, 3, 640) and last[12:] == speech[1280:]
            assert (end["type"], end["turn"]) == ("turn.speech_end", "t1")
            await link.converse(Speech("t1", bytes(640)))  # after the end: dropped
            await link.converse(SpeechEnd("t1"))
            assert await connection.nothing()

    asyncio.run(main())


def test_the_cloud_can_end_the_speech_or_cancel_the_turn() -> None:
    async def main() -> None:
        async with talking() as (link, connection):
            await link.converse(TurnStart("t1", Trigger.TAP))
            await connection.receive()  # turn.start
            await link.converse(Speech("t1", bytes(700)))  # one frame, and 60 bytes
            await connection.send({"type": "turn.speech_end", "turn": "t1"})
            assert await heard(link) == SpeechEnd("t1")
            held, rest = await connection.receive(), await connection.receive()
            assert (header(held)[3:5], len(held)) == ((0, 1), 12 + 640)
            assert (header(rest)[3:5], len(rest)) == ((1, 2), 12 + 60)  # marked last
            await link.converse(Speech("t1", bytes(640)))
            assert await connection.nothing()

            await link.converse(TurnStart("t2", Trigger.WAKE_WORD))
            await connection.receive()
            await connection.send({"type": "turn.cancel", "turn": "t2", "reason": "nothing heard"})
            assert await heard(link) == TurnCancel("t2", "nothing heard")
            await link.converse(Speech("t2", bytes(1280)))
            await link.converse(TurnCancel("t2", "too late"))  # over already: nothing to send
            assert await connection.nothing()
            sent = await connection.send({"type": "turn.cancel", "turn": "t9"})
            error = await connection.receive()
            assert (error["type"], error["code"], error["reply_to"]) == (
                "error",
                "unknown_turn",
                sent,
            )
            # A turn that has just ended is not reported: the cloud may not know yet.
            await connection.send({"type": "turn.speech_end", "turn": "t2"})
            assert await connection.nothing()

    asyncio.run(main())


def test_an_answer_comes_with_its_text_and_its_voice() -> None:
    async def main() -> None:
        async with talking() as (link, connection):
            await link.converse(TurnStart("t1", Trigger.WAKE_WORD))
            await link.converse(SpeechEnd("t1"))
            await connection.receive()  # turn.start
            await connection.receive()  # turn.speech_end
            await connection.send({"type": "response.start", "response": "a1", "turn": "t1"})
            await connection.send({"type": "response.text", "response": "a1", "delta": "Sunny"})
            await connection.socket.send_bytes(frame(bytes(640)))
            await connection.socket.send_bytes(
                frame(bytes(100), flags=1, sequence=2, timestamp=320)
            )
            await connection.send({"type": "response.end", "response": "a1", "follow_up": True})
            assert [await heard(link) for _ in range(5)] == [
                ResponseStart("a1", "t1"),
                ResponseText("a1", "Sunny"),
                Voice("a1", bytes(640)),
                Voice("a1", bytes(100), last=True),
                ResponseEnd("a1", follow_up=True),
            ]
            # Once complete, it may still be playing: the cloud can stop it.
            await connection.send({"type": "response.stop", "response": "a1"})
            assert await heard(link) == ResponseStop("a1")
            assert await connection.nothing()

    asyncio.run(main())


def test_answers_come_one_at_a_time() -> None:
    async def main() -> None:
        async with talking() as (link, connection):
            await connection.socket.send_bytes(frame(bytes(640)))  # outside an answer: ignored
            await connection.send({"type": "response.start", "response": "a1", "turn": None})
            await connection.send({"type": "response.start", "response": "a2", "turn": None})
            await connection.socket.send_bytes(frame(bytes(640), sequence=2))
            assert [await heard(link) for _ in range(4)] == [
                ResponseStart("a1", None),
                ResponseEnd("a1", follow_up=False),  # the frames that follow are a2's
                ResponseStart("a2", None),
                Voice("a2", bytes(640)),
            ]
            await connection.send({"type": "response.text", "response": "a1", "delta": "Hi"})
            assert await silent(link)  # a1 is over
            sent = await connection.send(
                {"type": "response.end", "response": "a9", "follow_up": False}
            )
            error = await connection.receive()
            assert (error["code"], error["reply_to"]) == ("unknown_response", sent)
            # An answer to a turn the robot never had is refused, and ends a2 all the same.
            sent = await connection.send({"type": "response.start", "response": "a3", "turn": "t7"})
            error = await connection.receive()
            assert (error["code"], error["reply_to"]) == ("unknown_turn", sent)
            assert await heard(link) == ResponseEnd("a2", follow_up=False)
            await connection.send({"type": "response.text", "response": "a3", "delta": "Hi"})
            await connection.socket.send_bytes(frame(bytes(640), sequence=3))
            assert await silent(link)
            assert await connection.nothing()

    asyncio.run(main())


def test_the_cloud_hears_how_much_of_an_interrupted_answer_was_played() -> None:
    async def main() -> None:
        async with talking() as (link, connection):
            await connection.send({"type": "response.start", "response": "a1", "turn": None})
            assert await heard(link) == ResponseStart("a1", None)
            await link.converse(Interrupted("a1", 1840))
            message = await connection.receive()
            assert (message["type"], message["response"], message["played_ms"]) == (
                "response.interrupted",
                "a1",
                1840,
            )
            # What was still on its way is no longer wanted, and needs no answer.
            await connection.socket.send_bytes(frame(bytes(640)))
            await connection.send({"type": "response.end", "response": "a1", "follow_up": False})
            await link.converse(Interrupted("a9", 10))  # never heard of: not sent
            assert await silent(link)
            assert await connection.nothing()

    asyncio.run(main())


def test_audio_the_robot_cannot_play_is_dropped_and_reported() -> None:
    async def main() -> None:
        async with talking() as (link, connection):
            await connection.send({"type": "response.start", "response": "a1", "turn": None})
            assert await heard(link) == ResponseStart("a1", None)
            for bad in (
                bytes(5),  # less than a header
                frame(bytes(640), version=2),
                frame(bytes(640), stream=1),  # the robot's stream
                frame(bytes(640), form=3),  # not negotiated
                frame(bytes(641)),  # half a sample
                frame(bytes(642)),  # more than 20 ms
            ):
                await connection.socket.send_bytes(bad)
            error = await connection.receive()
            assert (error["type"], error["code"]) == ("error", "invalid_message")
            assert error["message"] == "audio frame dropped: 5 bytes, less than a header"
            assert await connection.nothing()  # reported now and then, not for every frame
            assert await silent(link)
            await connection.socket.send_bytes(frame(bytes(640)))
            assert await heard(link) == Voice("a1", bytes(640))

    asyncio.run(main())


def test_a_turn_that_cannot_start_is_cancelled_at_once() -> None:
    async def main() -> None:
        offline = WebSocketCloud(url="ws://127.0.0.1:9/robot", **SETTINGS)  # never opened
        await offline.converse(TurnStart("t1", Trigger.WAKE_WORD))
        assert await heard(offline) == TurnCancel("t1", "offline")
        cloud = FakeCloud(hello={"media": {"speech": None, "voice": 0}})
        async with linked(cloud, conversation=True) as (link, cloud):
            connection = await online(link, cloud)
            await link.converse(TurnStart("t2", Trigger.WAKE_WORD))
            assert await heard(link) == TurnCancel("t2", "the cloud takes no speech")
            assert await connection.nothing()

    asyncio.run(main())


def test_the_turn_and_the_answer_end_with_their_session() -> None:
    async def main() -> None:
        async with talking() as (link, connection):
            await link.converse(TurnStart("t1", Trigger.WAKE_WORD))
            await connection.receive()
            await connection.send({"type": "response.start", "response": "a1", "turn": None})
            assert await heard(link) == ResponseStart("a1", None)
            await connection.socket.close()
            assert [await heard(link), await heard(link)] == [
                TurnCancel("t1", "connection lost"),
                ResponseEnd("a1", follow_up=False),
            ]

    asyncio.run(main())


@pytest.mark.parametrize(
    ("url", "allowed"),
    [
        ("wss://cloud.example/robot", True),
        ("ws://127.0.0.1:8780/robot", True),
        ("ws://localhost/robot", True),
        ("ws://cloud.example/robot", False),
        ("https://cloud.example/robot", False),
        ("", False),
    ],
)
def test_addresses_are_checked(url: str, allowed: bool) -> None:
    if allowed:
        assert WebSocketCloud(url=url, **SETTINGS).url == url
    else:
        with pytest.raises(ValueError, match="url"):
            WebSocketCloud(url=url, **SETTINGS)


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"reconnect_max": 0.001}, "reconnect_max must not be below reconnect_first"),
        ({"burst": 0}, "burst must be at least 1"),
        ({"catalogue_ttl": -1.0}, "catalogue_ttl must not be negative"),
        ({"hello_timeout": 0}, "hello_timeout must be a positive number"),
    ],
)
def test_settings_are_checked(change: dict[str, Any], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        WebSocketCloud(url="wss://cloud.example/robot", **{**SETTINGS, **change})


@pytest.mark.parametrize("reason", ["é" * 100, "a" + "é" * 100, "stopping"])
def test_a_close_reason_fits_its_frame_and_stays_utf8(reason: str) -> None:
    cut = adapter._close_reason(reason)
    assert len(cut) <= 123  # RFC 6455: the reason and its 2-byte code fit 125 bytes
    assert reason.startswith(cut.decode("utf-8"))  # valid UTF-8, nothing invented
