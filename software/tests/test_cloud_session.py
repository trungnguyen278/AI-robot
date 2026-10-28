# SPDX-License-Identifier: MIT
"""A session of the cloud link, driven by a test that plays the cloud's agent.

The session does not know what carries its messages, so these tests hand them over
directly; tests/test_livekit_cloud.py runs the link through a real LiveKit server.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import time
from collections.abc import AsyncIterator, Mapping
from pathlib import Path
from typing import Any

import pytest

from ai_robot.adapters.livekit import session as protocol
from ai_robot.adapters.livekit.cloud import LiveKitCloud
from ai_robot.adapters.livekit.session import Session
from ai_robot.core.data import Schema
from ai_robot.ports import (
    AudioFormat,
    CallCancelled,
    Capability,
    CloudPart,
    ConversationAudio,
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
)

SCHEMA = Path(__file__).resolve().parents[2] / "protocol" / "cloud" / "schema.json"
MCP_META = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
}
TIMEOUT = 2.0
AUDIO = ConversationAudio(AudioFormat(16000, 1), AudioFormat(16000, 1))

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

# The link's settings, as shipped.
SETTINGS = {
    "tokens": "development",
    "url": "ws://127.0.0.1:7880",
    "room": "robot",
    "participant": "robot",
    "connect_timeout": 10.0,
    "hello_timeout": 5.0,
    "reconnect_first": 1.0,
    "reconnect_max": 60.0,
    "rate": 50.0,
    "burst": 100,
    "backlog": 500,
    "catalogue_ttl": 60.0,
}


def schema(direction: str) -> Schema:
    root = json.loads(SCHEMA.read_text(encoding="utf-8"))
    return Schema(f"from_{direction}", {**root, "$ref": f"#/$defs/from_{direction}"})


class FakeMicrophone:
    """Keeps what the session does with the robot's speech track."""

    def __init__(self) -> None:
        self.live = False
        self.pcm = bytearray()
        self.stops: list[bool] = []  # drop, for each stop

    async def start(self) -> None:
        self.live = True

    async def write(self, pcm: bytes) -> None:
        assert self.live, "speech written to a muted track"
        self.pcm += pcm

    async def stop(self, *, drop: bool) -> None:
        self.live = False
        self.stops.append(drop)


class Agent:
    """The test's side of the session: the cloud's agent. Every message the robot sends
    is checked against the protocol's schema (``problems``)."""

    def __init__(self, session: Session, sent: asyncio.Queue[str]) -> None:
        self.session = session
        self.sent = sent
        self.from_robot = schema("robot")
        self.problems: list[str] = []
        self._ids = iter(range(2, 1_000_000))

    async def receive(self, timeout: float = TIMEOUT) -> dict[str, Any]:
        """The robot's next message."""
        message = json.loads(await asyncio.wait_for(self.sent.get(), timeout))
        problem = self.from_robot.problem(message)
        if problem is not None:
            self.problems.append(f"{problem} in {message}")
        return message

    async def nothing(self, wait: float = 0.1) -> bool:
        """Whether the robot sends nothing for ``wait`` seconds."""
        await asyncio.sleep(wait)
        return self.sent.empty()

    async def send(self, message: Mapping[str, Any]) -> str:
        """Send ``message``, with a new id unless it has one; returns the id."""
        message = {"id": f"c{next(self._ids)}", **message}
        await self.session.deliver(json.dumps(message))
        return str(message["id"])

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


def agent_hello(robot: Mapping[str, Any], **changes: Any) -> dict[str, Any]:
    return {
        "type": "hello",
        "id": "c1",
        "reply_to": robot["id"],
        "protocol": "2.0",
        "session": {"id": "s-1"},
        "time": time.time(),
        "conversations": True,
        "events": ["lamp.changed", "lamp.unknown"],
        **changes,
    }


@contextlib.asynccontextmanager
async def started(
    conversation: ConversationAudio | None = AUDIO, **settings: Any
) -> AsyncIterator[tuple[LiveKitCloud, Session, Agent, FakeMicrophone, asyncio.Task[bool]]]:
    """A session that has said hello, before the agent answers."""
    link = LiveKitCloud(**{**SETTINGS, **settings})
    await link.offer([LAMP], [CHANGED], conversation=conversation)
    sent: asyncio.Queue[str] = asyncio.Queue()

    async def send(text: str) -> None:
        sent.put_nowait(text)

    microphone = FakeMicrophone()
    session = Session(link, "agent", send, microphone, schema("cloud"), 1)
    agent = Agent(session, sent)
    task = asyncio.create_task(session.run())
    try:
        yield link, session, agent, microphone, task
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        link.closed(session)
    assert agent.problems == []  # every message from the robot follows the schema


@contextlib.asynccontextmanager
async def opened(
    conversation: ConversationAudio | None = AUDIO, **settings: Any
) -> AsyncIterator[tuple[LiveKitCloud, Agent, FakeMicrophone]]:
    """A session whose hello exchange succeeded."""
    async with started(conversation, **settings) as (link, _, agent, microphone, _):
        robot = await agent.receive()
        await agent.send(agent_hello(robot))
        status = await asyncio.wait_for(link.status(), TIMEOUT)
        assert status.online
        yield link, agent, microphone


async def heard(link: LiveKitCloud) -> CloudPart:
    """The cloud's next part of the conversation, as the link hands it to the robot."""
    return await asyncio.wait_for(link.conversation(), TIMEOUT)


async def silent(link: LiveKitCloud, wait: float = 0.1) -> bool:
    """Whether the link hands the robot nothing of the conversation for ``wait`` seconds."""
    try:
        await asyncio.wait_for(link.conversation(), wait)
    except TimeoutError:
        return True
    return False


# ---- the session ----


def test_the_robot_says_hello_first_and_the_session_opens() -> None:
    async def main() -> None:
        async with started() as (link, session, agent, _, _):
            hello = await agent.receive()
            assert (hello["type"], hello["id"], hello["protocol"]) == ("hello", "r1", "2.2")
            assert hello["conversations"] is True
            assert [event["name"] for event in hello["events"]] == ["lamp.changed"]
            await agent.send(agent_hello(hello))
            status = await asyncio.wait_for(link.status(), TIMEOUT)
            assert status == LinkStatus(True, "s-1", frozenset({"lamp.changed"}), True)
            assert link.session is session

    asyncio.run(main())


def test_conversations_need_both_sides() -> None:
    async def main() -> None:
        async with started(conversation=None) as (link, _, agent, _, _):
            hello = await agent.receive()
            assert hello["conversations"] is False
            await agent.send(agent_hello(hello))
            assert (await asyncio.wait_for(link.status(), TIMEOUT)).conversations is False
            await link.converse(TurnStart("t1", Trigger.TAP))
            assert await heard(link) == TurnCancel("t1", "no conversations")
            assert await agent.nothing()
        async with started() as (link, _, agent, _, _):
            hello = await agent.receive()
            await agent.send(agent_hello(hello, conversations=False))
            assert (await asyncio.wait_for(link.status(), TIMEOUT)).conversations is False

    asyncio.run(main())


@pytest.mark.parametrize(
    ("answer", "reason"),
    [
        (None, "no hello"),
        ({"protocol": "3.0"}, "unsupported protocol"),
        ({"type": "event", "name": "x", "time": 0, "data": {}}, "not a hello"),
        ({"reply_to": "r9"}, "not a hello"),
    ],
)
def test_an_agent_without_a_proper_hello_gets_a_bye(
    answer: dict[str, Any] | None, reason: str
) -> None:
    async def main() -> None:
        async with started(hello_timeout=0.2) as (link, _, agent, _, task):
            hello = await agent.receive()
            if answer is not None:
                await agent.send(agent_hello(hello, **answer))
            bye = await agent.receive()
            assert (bye["type"], bye["reason"]) == ("bye", reason)
            assert await asyncio.wait_for(task, TIMEOUT) is False
            assert link.session is None

    asyncio.run(main())


def test_a_bye_from_the_agent_ends_the_session() -> None:
    async def main() -> None:
        async with started() as (link, _, agent, _, task):
            await agent.send(agent_hello(await agent.receive()))
            await asyncio.wait_for(link.status(), TIMEOUT)
            await agent.send({"type": "bye", "reason": "restarting"})
            assert await asyncio.wait_for(task, TIMEOUT) is True

    asyncio.run(main())


def test_the_robot_says_goodbye_and_ends_its_subscriptions() -> None:
    async def main() -> None:
        async with opened() as (link, agent, _):
            await agent.request(
                "subscriptions/listen", {"notifications": {"toolsListChanged": True}}, request=3
            )
            await agent.receive()  # the acknowledgement
            assert link.session is not None
            await link.session.goodbye("stopping")
            ended = (await agent.receive())["payload"]
            assert ended == {
                "jsonrpc": "2.0",
                "id": 3,
                "result": {
                    "resultType": "complete",
                    "_meta": {"io.modelcontextprotocol/subscriptionId": 3},
                },
            }
            bye = await agent.receive()
            assert (bye["type"], bye["reason"]) == ("bye", "stopping")

    asyncio.run(main())


# ---- capabilities ----


def test_the_cloud_discovers_and_lists_the_capabilities() -> None:
    async def main() -> None:
        async with opened() as (_, agent, _):
            discovered = await agent.mcp("server/discover")
            assert discovered["result"]["supportedVersions"] == ["2026-07-28"]
            assert discovered["result"]["capabilities"] == {"tools": {"listChanged": True}}
            assert discovered["result"]["resultType"] == "complete"
            server = discovered["result"]["_meta"]["io.modelcontextprotocol/serverInfo"]
            assert server["name"] == "ai-robot"
            listed = (await agent.mcp("tools/list"))["result"]
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
        async with opened() as (link, agent, _):
            sent = await agent.request(
                "tools/call", {"name": "lamp.set", "arguments": {"on": True}}
            )
            call = await asyncio.wait_for(link.request(), TIMEOUT)
            assert isinstance(call, ToolCall)
            assert (call.name, dict(call.arguments)) == ("lamp.set", {"on": True})
            await link.reply(call, data={"on": True})
            answer = await agent.receive()
            assert answer["reply_to"] == sent
            result = answer["payload"]["result"]
            assert result["structuredContent"] == {"on": True}
            assert result["content"] == [{"type": "text", "text": '{"on": true}'}]
            assert result["isError"] is False
            await agent.request("tools/call", {"name": "lamp.set", "arguments": {}})
            call = await asyncio.wait_for(link.request(), TIMEOUT)
            await link.reply(call, error="invalid arguments: 'on' is a required property")
            result = (await agent.receive())["payload"]["result"]
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
        async with opened() as (_, agent, _):
            error = (await agent.mcp(method, params))["error"]
            assert error["code"] == code and error["message"].startswith(message)

    asyncio.run(main())


def test_requests_without_the_right_metadata_get_an_error() -> None:
    async def main() -> None:
        async with opened() as (_, agent, _):
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
            await agent.send({"type": "mcp", "payload": old})
            error = (await agent.receive())["payload"]["error"]
            assert error["code"] == -32022
            assert error["data"] == {"supported": ["2026-07-28"], "requested": "2025-06-18"}
            bare = {"jsonrpc": "2.0", "id": 8, "method": "tools/list", "params": {}}
            await agent.send({"type": "mcp", "payload": bare})
            assert (await agent.receive())["payload"]["error"]["code"] == -32602
            odd = {"jsonrpc": "2.0", "id": True, "method": "tools/list", "params": {}}
            await agent.send({"type": "mcp", "payload": odd})
            payload = (await agent.receive())["payload"]
            assert payload["error"]["code"] == -32600 and "id" not in payload

    asyncio.run(main())


def test_a_subscription_hears_of_catalogue_changes_until_it_is_cancelled() -> None:
    async def main() -> None:
        async with opened() as (link, agent, _):
            sent = await agent.request(
                "subscriptions/listen", {"notifications": {"toolsListChanged": True}}, request=5
            )
            ack = await agent.receive()
            assert ack["reply_to"] == sent
            assert ack["payload"]["method"] == "notifications/subscriptions/acknowledged"
            assert ack["payload"]["params"]["notifications"] == {"toolsListChanged": True}
            blink = Capability("lamp.blink", "Blink", {"type": "object"}, SafetyClass.INFORMATIONAL)
            await link.offer([LAMP, blink], [CHANGED], conversation=AUDIO)
            changed = (await agent.receive())["payload"]
            assert changed["method"] == "notifications/tools/list_changed"
            assert changed["params"]["_meta"] == {"io.modelcontextprotocol/subscriptionId": 5}
            await link.offer([LAMP, blink], [CHANGED], conversation=AUDIO)  # no change
            cancel = {
                "jsonrpc": "2.0",
                "method": "notifications/cancelled",
                "params": {"requestId": 5},
            }
            await agent.send({"type": "mcp", "payload": cancel})
            await asyncio.sleep(0.05)
            await link.offer([LAMP], [CHANGED], conversation=AUDIO)
            assert await agent.nothing()

    asyncio.run(main())


def test_a_cancelled_call_is_not_answered() -> None:
    async def main() -> None:
        async with opened() as (link, agent, _):
            await agent.request(
                "tools/call", {"name": "lamp.set", "arguments": {"on": True}}, request="x"
            )
            call = await asyncio.wait_for(link.request(), TIMEOUT)
            assert isinstance(call, ToolCall)
            cancel = {
                "jsonrpc": "2.0",
                "method": "notifications/cancelled",
                "params": {"requestId": "x", "reason": "no longer needed"},
            }
            await agent.send({"type": "mcp", "payload": cancel})
            assert await asyncio.wait_for(link.request(), TIMEOUT) == CallCancelled(call.id)
            await link.reply(call, data={"on": True})
            assert await agent.nothing()

    asyncio.run(main())


def test_events_go_only_to_a_cloud_that_subscribed() -> None:
    async def main() -> None:
        async with opened() as (link, agent, _):
            await link.emit("lamp.changed", {"on": True})
            event = await agent.receive()
            assert (event["type"], event["name"], event["data"]) == (
                "event",
                "lamp.changed",
                {"on": True},
            )
            await link.emit("lamp.other", {})
            assert await agent.nothing()

    asyncio.run(main())


# ---- messages ----


def test_bad_messages_get_an_error_and_the_session_goes_on() -> None:
    async def main() -> None:
        async with opened() as (link, agent, _):
            assert link.session is not None
            await link.session.deliver("not json")
            assert (await agent.receive())["message"] == "not JSON"
            await link.session.deliver('{"type": "event", "id": "c50", "x": NaN}')
            assert (await agent.receive())["message"] == "not JSON"
            sent = await agent.send({"type": "mcp", "payload": {"jsonrpc": "1.0"}})
            error = await agent.receive()
            assert (error["type"], error["code"], error["reply_to"]) == (
                "error",
                "invalid_message",
                sent,
            )
            await link.session.oversized()
            error = await agent.receive()
            assert (error["code"], error["message"]) == (
                "invalid_message",
                f"a message larger than {protocol.MAX_MESSAGE} bytes",
            )
            # A type the robot does not know is ignored, not refused.
            await agent.send({"type": "mood.changed", "mood": "calm"})
            assert await agent.nothing()
            assert "result" in await agent.mcp("tools/list")

    asyncio.run(main())


def test_a_resent_message_acts_only_once() -> None:
    async def main() -> None:
        async with opened() as (_, agent, _):
            request = {
                "type": "mcp",
                "id": "c77",
                "payload": {
                    "jsonrpc": "2.0",
                    "id": 77,
                    "method": "tools/list",
                    "params": {"_meta": MCP_META},
                },
            }
            await agent.send(request)
            await agent.send(request)
            assert (await agent.receive())["reply_to"] == "c77"
            assert await agent.nothing()

    asyncio.run(main())


def test_a_burst_waits_its_turn_and_only_a_flood_is_dropped() -> None:
    async def main() -> None:
        async with opened(rate=50.0, burst=5, backlog=40) as (_, agent, _):
            # 30 requests at once: past the burst they wait, but every one is answered.
            sent = [await agent.request("tools/list") for _ in range(30)]
            answers = [await agent.receive() for _ in sent]
            assert [answer["reply_to"] for answer in answers] == sent
            # A flood past the backlog: the rest is dropped, and reported once.
            for _ in range(100):
                await agent.request("tools/list")
            messages = [await agent.receive() for _ in range(41)]
            errors = [message for message in messages if message["type"] == "error"]
            assert [error["code"] for error in errors] == ["rate_limited"]
            assert await agent.nothing(wait=0.3)

    asyncio.run(main())


# ---- conversations ----


def test_a_turn_streams_its_speech_and_says_how_much() -> None:
    async def main() -> None:
        async with opened() as (link, agent, microphone):
            context = {"battery": 80.0, "charging": False}
            await link.converse(TurnStart("t1", Trigger.WAKE_WORD, context))
            start = await agent.receive()
            assert {key: start[key] for key in ("type", "turn", "trigger", "context")} == {
                "type": "turn.start",
                "turn": "t1",
                "trigger": "wake_word",
                "context": context,
            }
            assert microphone.live
            for _ in range(3):
                await link.converse(Speech("t1", bytes(640)))  # 3 x 20 ms at 16 kHz
            await link.converse(SpeechEnd("t1"))
            end = await agent.receive()
            assert (end["type"], end["turn"], end["speech_ms"]) == ("turn.speech_end", "t1", 60)
            assert (bytes(microphone.pcm), microphone.live) == (bytes(1920), False)
            assert microphone.stops == [False]  # what was queued still goes out
            await link.converse(Speech("t1", bytes(640)))  # after the end: dropped
            await link.converse(SpeechEnd("t1"))
            assert await agent.nothing()
            assert len(microphone.pcm) == 1920

    asyncio.run(main())


def test_the_cloud_can_end_the_speech_or_cancel_the_turn() -> None:
    async def main() -> None:
        async with opened() as (link, agent, microphone):
            await link.converse(TurnStart("t1", Trigger.TAP))
            await agent.receive()
            await agent.send({"type": "turn.speech_end", "turn": "t1"})
            assert await heard(link) == SpeechEnd("t1")
            assert (microphone.live, microphone.stops) == (False, [False])
            await link.converse(Speech("t1", bytes(640)))
            assert len(microphone.pcm) == 0

            await link.converse(TurnStart("t2", Trigger.WAKE_WORD))
            await agent.receive()
            await agent.send({"type": "turn.cancel", "turn": "t2", "reason": "nothing heard"})
            assert await heard(link) == TurnCancel("t2", "nothing heard")
            assert microphone.stops[-1] is True  # what was queued is dropped
            await link.converse(TurnCancel("t2", "too late"))  # over already: nothing to send
            assert await agent.nothing()
            sent = await agent.send({"type": "turn.cancel", "turn": "t9"})
            error = await agent.receive()
            assert (error["code"], error["reply_to"]) == ("unknown_turn", sent)
            # A turn that has just ended is not reported: the cloud may not know yet.
            await agent.send({"type": "turn.speech_end", "turn": "t2"})
            assert await agent.nothing()

    asyncio.run(main())


def test_the_robot_can_cancel_a_turn() -> None:
    async def main() -> None:
        async with opened() as (link, agent, microphone):
            await link.converse(TurnStart("t1", Trigger.TAP))
            await agent.receive()
            await link.converse(TurnCancel("t1", "x" * 300))
            cancel = await agent.receive()
            assert (cancel["type"], cancel["turn"], len(cancel["reason"])) == (
                "turn.cancel",
                "t1",
                protocol.MAX_REASON,
            )
            assert microphone.stops == [True]

    asyncio.run(main())


def test_an_answer_comes_with_its_text() -> None:
    async def main() -> None:
        async with opened() as (link, agent, _):
            await link.converse(TurnStart("t1", Trigger.WAKE_WORD))
            await link.converse(SpeechEnd("t1"))
            await agent.receive()  # turn.start
            await agent.receive()  # turn.speech_end
            await agent.send({"type": "response.start", "response": "a1", "turn": "t1"})
            await agent.send({"type": "response.text", "response": "a1", "delta": "Sunny"})
            await agent.send({"type": "response.end", "response": "a1", "follow_up": True})
            assert [await heard(link) for _ in range(3)] == [
                ResponseStart("a1", "t1"),
                ResponseText("a1", "Sunny"),
                ResponseEnd("a1", follow_up=True),
            ]
            # Once complete, it may still be playing: the cloud can stop it.
            await agent.send({"type": "response.stop", "response": "a1"})
            assert await heard(link) == ResponseStop("a1")
            assert await agent.nothing()

    asyncio.run(main())


def test_answers_come_one_at_a_time() -> None:
    async def main() -> None:
        async with opened() as (link, agent, _):
            await agent.send({"type": "response.start", "response": "a1", "turn": None})
            await agent.send({"type": "response.start", "response": "a2", "turn": None})
            assert [await heard(link) for _ in range(3)] == [
                ResponseStart("a1", None),
                ResponseEnd("a1", follow_up=False),
                ResponseStart("a2", None),
            ]
            await agent.send({"type": "response.text", "response": "a1", "delta": "Hi"})
            assert await silent(link)  # a1 is over
            sent = await agent.send({"type": "response.end", "response": "a9", "follow_up": False})
            error = await agent.receive()
            assert (error["code"], error["reply_to"]) == ("unknown_response", sent)
            # An answer to a turn the robot never had is refused, and ends a2 all the same.
            sent = await agent.send({"type": "response.start", "response": "a3", "turn": "t7"})
            error = await agent.receive()
            assert (error["code"], error["reply_to"]) == ("unknown_turn", sent)
            assert await heard(link) == ResponseEnd("a2", follow_up=False)
            await agent.send({"type": "response.text", "response": "a3", "delta": "Hi"})
            assert await silent(link)
            assert await agent.nothing()

    asyncio.run(main())


def test_the_cloud_hears_that_an_answer_was_interrupted() -> None:
    async def main() -> None:
        async with opened() as (link, agent, _):
            await agent.send({"type": "response.start", "response": "a1", "turn": None})
            assert await heard(link) == ResponseStart("a1", None)
            await link.converse(Interrupted("a1"))
            message = await agent.receive()
            assert (message["type"], message["response"]) == ("response.interrupted", "a1")
            # What was still on its way needs no answer.
            await agent.send({"type": "response.end", "response": "a1", "follow_up": False})
            await link.converse(Interrupted("a9"))  # never heard of: not sent
            assert await silent(link)
            assert await agent.nothing()

    asyncio.run(main())


def test_the_turn_and_the_answer_end_with_their_session() -> None:
    async def main() -> None:
        async with opened() as (link, agent, _):
            await link.converse(TurnStart("t1", Trigger.WAKE_WORD))
            await agent.receive()
            await agent.send({"type": "response.start", "response": "a1", "turn": None})
            assert await heard(link) == ResponseStart("a1", None)
            await agent.request("tools/call", {"name": "lamp.set", "arguments": {"on": True}})
            call = await asyncio.wait_for(link.request(), TIMEOUT)
            assert link.session is not None
            link.closed(link.session)
            assert await asyncio.wait_for(link.status(), TIMEOUT) == LinkStatus(False)
            assert await asyncio.wait_for(link.request(), TIMEOUT) == CallCancelled(call.id)
            assert [await heard(link), await heard(link)] == [
                TurnCancel("t1", "connection lost"),
                ResponseEnd("a1", follow_up=False),
            ]
            await link.converse(TurnStart("t2", Trigger.TAP))  # no session now
            assert await heard(link) == TurnCancel("t2", "offline")

    asyncio.run(main())


# ---- settings ----


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"reconnect_max": 0.5}, "reconnect_max must not be below reconnect_first"),
        ({"burst": 0}, "burst must be at least 1"),
        ({"backlog": 0}, "backlog must be at least 1"),
        ({"catalogue_ttl": -1.0}, "catalogue_ttl must not be negative"),
        ({"hello_timeout": 0}, "hello_timeout must be a positive number"),
        ({"room": ""}, "room and participant must not be empty"),
        ({"tokens": "magic"}, "tokens must be one of server, development"),
    ],
)
def test_settings_are_checked(change: dict[str, Any], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        LiveKitCloud(**{**SETTINGS, **change})
