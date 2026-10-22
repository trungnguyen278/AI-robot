# SPDX-License-Identifier: MIT
"""The robot's side of a session of the cloud link (protocol/cloud/README.md).

A session runs between the robot and one agent, from the robot's ``hello`` to its end:
the MCP server that offers the robot's capabilities (ADR-0008), events, and the turns
and responses of conversations. It does not know what carries it: the ``livekit``
adapter hands it the agent's messages and sends its own as text streams, and gives it
the microphone of the robot's speech track (``cloud.py``). Tests drive it directly.
"""

from __future__ import annotations

import asyncio
import itertools
import json
import logging
import time
from collections import deque
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any, Protocol

from ai_robot import software_version
from ai_robot.core.data import Schema, encode, plain
from ai_robot.ports.cloud import (
    MAX_ID,
    Capability,
    CloudPart,
    ConversationAudio,
    Interrupted,
    ResponseEnd,
    ResponseStart,
    ResponseStop,
    ResponseText,
    RobotPart,
    Speech,
    SpeechEnd,
    ToolCall,
    TurnCancel,
    TurnStart,
)

if TYPE_CHECKING:
    from ai_robot.adapters.livekit.cloud import LiveKitCloud

log = logging.getLogger(__name__)

# Fixed by the protocol (protocol/cloud/README.md and schema.json), not settings: the
# cloud relies on them.
PROTOCOL = "2.0"
MCP_VERSION = "2026-07-28"
TOPIC = "ai-robot"  # the text streams that carry the messages
MAX_MESSAGE = 1 << 20  # bytes in a message
MAX_ERROR = 1024  # characters in an error's message ($defs/error in schema.json)
MAX_REASON = 256  # characters in a reason ($defs/short_text in schema.json)

# How this implementation works, which nobody needs to tune.
SEEN = 1000  # message ids, turns and responses remembered, so that none acts twice
DROP_REPORT = 10.0  # seconds between two reports of dropped messages

# JSON-RPC and MCP error codes
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
UNSUPPORTED_PROTOCOL_VERSION = -32022


class Rejected(Exception):
    """A request the robot answers with a JSON-RPC error."""

    def __init__(self, code: int, message: str, data: Any = None) -> None:
        super().__init__(message)
        self.code = code
        self.data = data


class SessionEnded(Exception):
    """The session ends, for ``reason``: a ``bye``, or a hello the robot refused."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class Microphone(Protocol):
    """Where the user's speech goes during a turn: the robot's speech track."""

    async def start(self) -> None:
        """A turn begins: speech may follow."""

    async def write(self, pcm: bytes) -> None:
        """Send a piece of speech, in the conversation's speech format."""

    async def stop(self, *, drop: bool) -> None:
        """The speech has ended. With ``drop``, what is still queued is not sent."""


class Bucket:
    """A token bucket: ``rate`` messages a second, in bursts of up to ``burst``."""

    def __init__(self, rate: float, burst: int) -> None:
        self.rate = rate
        self.burst = burst
        self._tokens = float(burst)
        self._at = time.monotonic()

    async def take(self) -> None:
        """Wait for a token, then use it."""
        while True:
            now = time.monotonic()
            self._tokens = min(self.burst, self._tokens + (now - self._at) * self.rate)
            self._at = now
            if self._tokens >= 1:
                self._tokens -= 1
                return
            await asyncio.sleep((1 - self._tokens) / self.rate)


@dataclass
class Turn:
    """A turn in progress on the robot's side."""

    id: str
    streaming: bool = True  # the user's speech still goes out
    answered: bool = False  # a response to it has started
    samples: int = 0  # samples of speech sent so far, per channel


def hello(link: LiveKitCloud, offered: ConversationAudio | None) -> dict[str, Any]:
    """The robot's ``hello``, without its ``id``."""
    return {
        "type": "hello",
        "protocol": PROTOCOL,
        "software": software_version(),
        "time": time.time(),
        "utc_offset": _utc_offset(),
        "conversations": offered is not None,
        "events": [
            {"name": kind.name, "description": kind.description, "schema": plain(kind.schema)}
            for kind in link.event_kinds
        ],
    }


class Session:
    """The robot's session with the agent ``agent``.

    ``send`` sends one message, already encoded, to the agent; it never raises. The
    adapter hands each message from the agent to ``deliver``, in order.
    """

    def __init__(
        self,
        link: LiveKitCloud,
        agent: str,
        send: Callable[[str], Awaitable[None]],
        microphone: Microphone,
        schema: Schema,
        number: int,
    ) -> None:
        self.link = link
        self.agent = agent
        self.microphone = microphone
        self.schema = schema
        self.number = number  # tells this session's calls from an earlier one's
        self.id = ""
        self.events: frozenset[str] = frozenset()
        self.offered = link.audio  # the audio this session's hello offers, if any
        self.conversations = False  # whether both sides hold conversations
        self.subscriptions: dict[str, Any] = {}  # subscriptions/listen: key -> request id
        self.calls: dict[str, tuple[Any, str]] = {}  # call id -> request id, its message
        self.turn: Turn | None = None
        self.response: str | None = None  # the response in progress
        self.ended_turns: deque[str] = deque(maxlen=SEEN)
        self.ended_responses: deque[str] = deque(maxlen=SEEN)
        self._send = send
        self._ids = itertools.count(1)
        self._seen: deque[str] = deque(maxlen=SEEN)
        self._inbox: asyncio.Queue[str] = asyncio.Queue(maxsize=link.backlog)
        self._bucket = Bucket(link.rate, link.burst)
        self._dropped = 0  # messages dropped since the last report
        self._reported = -DROP_REPORT  # when dropped messages were last reported
        self._warned: set[str] = set()

    # ---- the session's life ----

    async def run(self) -> bool:
        """Say hello, then handle the agent's messages until the session ends. Returns
        whether the hello exchange succeeded."""
        greeting = await self.send(hello(self.link, self.offered))
        try:
            answer = await asyncio.wait_for(self._hello(greeting), self.link.hello_timeout)
        except TimeoutError:
            log.warning("the agent %s did not answer the robot's hello", self.agent)
            await self.send({"type": "bye", "reason": "no hello"})
            return False
        except SessionEnded as refused:
            log.warning("the hello of the agent %s was refused: %s", self.agent, refused)
            await self.send({"type": "bye", "reason": refused.reason})
            return False
        self.id = answer["session"]["id"]
        declared = {kind.name for kind in self.link.event_kinds}
        self.events = frozenset(answer["events"]) & declared
        self.conversations = self.offered is not None and answer["conversations"]
        self.link.opened(self)
        log.info(
            "cloud session %s open with %s (protocol %s%s)",
            self.id,
            self.agent,
            answer["protocol"],
            ", conversations" if self.conversations else "",
        )
        try:
            while True:
                text = await self._inbox.get()
                await self._bucket.take()
                await self._receive(text)
        except SessionEnded as ended:
            log.info("the agent ends the session: %s", ended)
        return True

    async def _hello(self, greeting: str) -> Mapping[str, Any]:
        """The agent's valid answer to the robot's hello, which must come first."""
        try:
            message = _parse(await self._inbox.get())
        except ValueError:
            raise SessionEnded("not a hello") from None
        problem = self.schema.problem(message)
        if problem is not None or message.get("type") != "hello":
            raise SessionEnded("not a hello")
        if message["reply_to"] != greeting:
            raise SessionEnded("not a hello")
        if message["protocol"].split(".")[0] != PROTOCOL.split(".")[0]:
            raise SessionEnded("unsupported protocol")
        self._seen.append(message["id"])
        return message

    async def deliver(self, text: str) -> None:
        """A message from the agent. It waits its turn; past the backlog it is dropped."""
        try:
            self._inbox.put_nowait(text)
        except asyncio.QueueFull:
            await self._drop("too many messages; some were dropped", "rate_limited")

    async def oversized(self) -> None:
        """The agent sent a message larger than the protocol allows; it was not read."""
        await self._drop(f"a message larger than {MAX_MESSAGE} bytes", "invalid_message")

    async def _drop(self, what: str, code: str) -> None:
        """Count a dropped message, and report the drops now and then."""
        self._dropped += 1
        now = time.monotonic()
        if now - self._reported >= DROP_REPORT:
            self._reported = now
            log.warning("dropping messages from the cloud: %s (%d)", what, self._dropped)
            self._dropped = 0
            await self._error(code, what)

    async def goodbye(self, reason: str) -> None:
        """End the subscriptions and say goodbye, before the robot leaves."""
        for request in list(self.subscriptions.values()):  # MCP: end them gracefully
            await self._mcp(
                {
                    "jsonrpc": "2.0",
                    "id": request,
                    "result": {
                        "resultType": "complete",
                        "_meta": {"io.modelcontextprotocol/subscriptionId": request},
                    },
                }
            )
        await self.send({"type": "bye", "reason": reason})

    def cancel_calls(self) -> list[str]:
        """The calls still in progress, which the session can no longer answer."""
        calls = list(self.calls)
        self.calls.clear()
        return calls

    def abandon(self) -> list[CloudPart]:
        """What ends with the session: the turn and the response in progress."""
        parts: list[CloudPart] = []
        if self.turn is not None:
            self.turn.streaming = False
            if not self.turn.answered:
                parts.append(TurnCancel(self.turn.id, "connection lost"))
            self.turn = None
        if self.response is not None:
            parts.append(ResponseEnd(self.response, follow_up=False))
            self.response = None
        return parts

    # ---- sending ----

    async def send(self, message: dict[str, Any]) -> str:
        """Send ``message`` with a new ``id``, and return the id."""
        message = {"type": message["type"], "id": f"r{next(self._ids)}", **message}
        await self._send(encode(message))
        return message["id"]

    async def _mcp(self, payload: dict[str, Any], reply_to: str | None = None) -> None:
        message: dict[str, Any] = {"type": "mcp", "payload": payload}
        if reply_to is not None:
            message["reply_to"] = reply_to
        await self.send(message)

    async def _error(self, code: str, text: str, reply_to: str | None = None) -> None:
        message: dict[str, Any] = {"type": "error", "code": code, "message": text[:MAX_ERROR]}
        if reply_to is not None:
            message["reply_to"] = reply_to
        await self.send(message)

    # ---- receiving ----

    async def _receive(self, text: str) -> None:
        try:
            message = _parse(text)
        except ValueError:
            await self._error("invalid_message", "not JSON")
            return
        problem = self.schema.problem(message)
        if problem is not None:
            reply_to = message.get("id") if isinstance(message, dict) else None
            valid = isinstance(reply_to, str) and 0 < len(reply_to) <= MAX_ID
            await self._error("invalid_message", problem, reply_to if valid else None)
            return
        if message["id"] in self._seen:
            return  # a resent message acts only once (SES-6)
        self._seen.append(message["id"])
        kind = message["type"]
        handler = {
            "mcp": self._on_mcp,
            "bye": self._on_bye,
            "error": self._on_error,
            "turn.speech_end": self._on_speech_end,
            "turn.cancel": self._on_turn_cancel,
            "response.start": self._on_response_start,
            "response.text": self._on_response_text,
            "response.end": self._on_response_end,
            "response.stop": self._on_response_stop,
        }.get(kind)
        if handler is None:
            self._once(kind, "ignoring a %s message from the cloud", kind)
        else:
            await handler(message)

    async def _on_bye(self, message: Mapping[str, Any]) -> None:
        raise SessionEnded(message["reason"])

    async def _on_error(self, message: Mapping[str, Any]) -> None:
        log.warning("the cloud reports %s: %s", message["code"], message["message"])

    def _once(self, key: str, text: str, *args: object) -> None:
        if key not in self._warned:
            self._warned.add(key)
            log.info(text, *args)

    # ---- MCP: the robot is the server ----

    async def _on_mcp(self, message: Mapping[str, Any]) -> None:
        payload = message["payload"]
        method = payload.get("method")
        if "id" not in payload:
            if method == "notifications/cancelled":
                self._cancelled(payload.get("params"))
            return  # other notifications, and responses: the robot sends no requests
        request = payload["id"]
        valid = isinstance(request, str | int) and not isinstance(request, bool)
        try:
            if not valid:
                raise Rejected(INVALID_REQUEST, "the request id must be a string or an integer")
            if not isinstance(method, str):
                raise Rejected(INVALID_REQUEST, "the request has no method")
            handler = {
                "server/discover": self._discover,
                "tools/list": self._list,
                "tools/call": self._call,
                "subscriptions/listen": self._listen,
            }.get(method)
            if handler is None:
                raise Rejected(METHOD_NOT_FOUND, f"Method not found: {method}")
            params = payload.get("params")
            _check_meta(params)
            result = await handler(request, params, message["id"])
        except Rejected as rejected:
            error: dict[str, Any] = {"code": rejected.code, "message": str(rejected)}
            if rejected.data is not None:
                error["data"] = rejected.data
            response: dict[str, Any] = {"jsonrpc": "2.0", "error": error}
            if valid:
                response["id"] = request
            await self._mcp(response, message["id"])
            return
        if result is not None:
            result.setdefault("resultType", "complete")
            result["_meta"] = {**result.get("_meta", {}), **_server_info()}
            await self._mcp({"jsonrpc": "2.0", "id": request, "result": result}, message["id"])

    async def _discover(self, request: Any, params: Mapping[str, Any], _: str) -> dict[str, Any]:
        return {
            "supportedVersions": [MCP_VERSION],
            "capabilities": {"tools": {"listChanged": True}},
            "ttlMs": self._ttl_ms(),
            "cacheScope": "private",
        }

    async def _list(self, request: Any, params: Mapping[str, Any], _: str) -> dict[str, Any]:
        if params.get("cursor") is not None:
            raise Rejected(INVALID_PARAMS, "Invalid cursor: the catalogue has one page")
        tools = [_tool(capability) for _, capability in sorted(self.link.capabilities.items())]
        return {"tools": tools, "ttlMs": self._ttl_ms(), "cacheScope": "private"}

    def _ttl_ms(self) -> int:
        """How long the cloud may cache the catalogue: MCP's ``ttlMs``."""
        return round(self.link.catalogue_ttl * 1000)

    async def _call(self, request: Any, params: Mapping[str, Any], message: str) -> None:
        name = params.get("name")
        arguments = params.get("arguments", {})
        if not isinstance(name, str):
            raise Rejected(INVALID_PARAMS, "params.name must be a string")
        if not isinstance(arguments, dict):
            raise Rejected(INVALID_PARAMS, "params.arguments must be an object")
        if name not in self.link.capabilities:
            raise Rejected(INVALID_PARAMS, f"Unknown tool: {name}")
        call = ToolCall(f"{self.number}.{json.dumps(request)}", name, arguments)
        if call.id in self.calls:
            raise Rejected(INVALID_REQUEST, f"request {request!r} is already in progress")
        self.calls[call.id] = (request, message)
        self.link.called(call)
        return None  # the answer comes with reply()

    async def _listen(self, request: Any, params: Mapping[str, Any], message: str) -> None:
        wanted = params.get("notifications")
        if not isinstance(wanted, dict):
            raise Rejected(INVALID_PARAMS, "params.notifications must be an object")
        honoured = {"toolsListChanged": True} if wanted.get("toolsListChanged") is True else {}
        await self._mcp(
            {
                "jsonrpc": "2.0",
                "method": "notifications/subscriptions/acknowledged",
                "params": {
                    "_meta": {"io.modelcontextprotocol/subscriptionId": request},
                    "notifications": honoured,
                },
            },
            message,
        )
        if honoured:
            self.subscriptions[json.dumps(request)] = request
        return None  # the subscription stays open until cancelled

    def _cancelled(self, params: Any) -> None:
        request = params.get("requestId") if isinstance(params, dict) else None
        if not isinstance(request, str | int) or isinstance(request, bool):
            return
        key = json.dumps(request)
        self.subscriptions.pop(key, None)
        call = f"{self.number}.{key}"
        if self.calls.pop(call, None) is not None:
            self.link.cancelled(call)

    async def reply(
        self, call: ToolCall, data: Mapping[str, Any] | None, error: str | None
    ) -> None:
        pending = self.calls.pop(call.id, None)
        if pending is None:
            return  # an earlier session's call, or a cancelled one
        request, message = pending
        if error is not None:
            result: dict[str, Any] = {"content": [{"type": "text", "text": error}], "isError": True}
        else:
            structured = plain(data or {})
            result = {
                "content": [{"type": "text", "text": encode(structured)}],
                "structuredContent": structured,
                "isError": False,
            }
        result = {"resultType": "complete", **result, "_meta": _server_info()}
        await self._mcp({"jsonrpc": "2.0", "id": request, "result": result}, message)

    async def catalogue_changed(self) -> None:
        for request in list(self.subscriptions.values()):
            await self._mcp(
                {
                    "jsonrpc": "2.0",
                    "method": "notifications/tools/list_changed",
                    "params": {"_meta": {"io.modelcontextprotocol/subscriptionId": request}},
                }
            )

    async def emit(self, name: str, data: Mapping[str, Any]) -> None:
        if name in self.events:
            await self.send({"type": "event", "name": name, "time": time.time(), "data": data})

    # ---- conversations: the robot's part ----

    async def converse(self, part: RobotPart) -> None:
        if isinstance(part, TurnStart):
            await self._start_turn(part)
        elif isinstance(part, Speech):
            turn = self._current(part.turn)
            if turn is not None and turn.streaming and self.offered is not None:
                await self.microphone.write(part.pcm)
                turn.samples += len(part.pcm) // self.offered.speech.frame_bytes
        elif isinstance(part, SpeechEnd):
            turn = self._current(part.turn)
            if turn is not None and turn.streaming and self.offered is not None:
                await self._stop_speech(turn, drop=False)
                speech_ms = round(turn.samples * 1000 / self.offered.speech.sample_rate)
                await self.send(
                    {"type": "turn.speech_end", "turn": turn.id, "speech_ms": speech_ms}
                )
        elif isinstance(part, TurnCancel):
            if self._current(part.turn) is not None:
                await self._end_turn()
                message = {"type": "turn.cancel", "turn": part.turn}
                if part.reason:
                    message["reason"] = part.reason[:MAX_REASON]
                await self.send(message)
        elif isinstance(part, Interrupted):
            if part.response == self.response:
                self._end_response()
            elif part.response not in self.ended_responses:
                return
            await self.send({"type": "response.interrupted", "response": part.response})

    async def _start_turn(self, part: TurnStart) -> None:
        if not self.conversations:
            self._hear(TurnCancel(part.turn, "no conversations"))
            return
        await self._end_turn()  # a new turn ends the one in progress (SES-8)
        self.turn = Turn(part.turn)
        await self.send(
            {
                "type": "turn.start",
                "turn": part.turn,
                "trigger": str(part.trigger),
                "context": part.context,
            }
        )
        await self.microphone.start()

    async def _stop_speech(self, turn: Turn, *, drop: bool) -> None:
        turn.streaming = False
        await self.microphone.stop(drop=drop)

    # ---- conversations: the cloud's part ----

    async def _on_speech_end(self, message: Mapping[str, Any]) -> None:
        turn = await self._named_turn(message)
        if turn is not None and turn.streaming:
            await self._stop_speech(turn, drop=False)
            self._hear(SpeechEnd(turn.id))

    async def _on_turn_cancel(self, message: Mapping[str, Any]) -> None:
        turn = await self._named_turn(message)
        if turn is not None:
            await self._end_turn()
            self._hear(TurnCancel(turn.id, message.get("reason")))

    async def _on_response_start(self, message: Mapping[str, Any]) -> None:
        response, turn = message["response"], message["turn"]
        if self.response is not None:  # one at a time
            self._hear(ResponseEnd(self.response, follow_up=False))
            self._end_response()
        if turn is not None:
            current = await self._named_turn(message)
            if current is None:  # an answer to a turn that is over: not wanted
                self.ended_responses.append(response)
                return
            current.answered = True
        self.response = response
        self._hear(ResponseStart(response, turn))

    async def _on_response_text(self, message: Mapping[str, Any]) -> None:
        if await self._named_response(message):
            self._hear(ResponseText(message["response"], message["delta"]))

    async def _on_response_end(self, message: Mapping[str, Any]) -> None:
        if await self._named_response(message):
            self._end_response()
            self._hear(ResponseEnd(message["response"], message["follow_up"]))

    async def _on_response_stop(self, message: Mapping[str, Any]) -> None:
        response = message["response"]
        if response == self.response:
            self._end_response()
        elif response not in self.ended_responses:
            await self._unknown("response", response, message)
            return
        self._hear(ResponseStop(response))  # its voice may still be playing

    # ---- conversations: bookkeeping ----

    def _current(self, turn: str) -> Turn | None:
        """The turn in progress, if it is ``turn``."""
        return self.turn if self.turn is not None and self.turn.id == turn else None

    async def _named_turn(self, message: Mapping[str, Any]) -> Turn | None:
        """The turn in progress, if ``message`` names it. The cloud hears of a turn it
        names that the robot never had; one that just ended, it may not know yet."""
        turn = self._current(message["turn"])
        if turn is None and message["turn"] not in self.ended_turns:
            await self._unknown("turn", message["turn"], message)
        return turn

    async def _named_response(self, message: Mapping[str, Any]) -> bool:
        """Whether ``message`` names the response in progress, as ``_named_turn``."""
        response = message["response"]
        if response == self.response:
            return True
        if response not in self.ended_responses:
            await self._unknown("response", response, message)
        return False

    async def _unknown(self, kind: str, name: str, message: Mapping[str, Any]) -> None:
        await self._error(f"unknown_{kind}", f"{kind} {name} is not active", message["id"])

    async def _end_turn(self) -> None:
        turn = self.turn
        if turn is not None:
            if turn.streaming:
                await self._stop_speech(turn, drop=True)
            self.ended_turns.append(turn.id)
            self.turn = None

    def _end_response(self) -> None:
        if self.response is not None:
            self.ended_responses.append(self.response)
            self.response = None

    def _hear(self, part: CloudPart) -> None:
        """Hand the cloud's part of the conversation to the robot."""
        self.link.heard(part)


def _parse(text: str) -> Any:
    """``text`` as JSON; ``ValueError`` if it is not, NaN and Infinity included."""
    return json.loads(text, parse_constant=_not_json)


def _not_json(name: str) -> Any:
    raise ValueError(f"{name} is not JSON")


def _utc_offset() -> int:
    """The local clock's offset from UTC, in minutes."""
    offset = datetime.now().astimezone().utcoffset()
    return 0 if offset is None else round(offset.total_seconds() / 60)


def _tool(capability: Capability) -> dict[str, Any]:
    """The MCP tool definition of ``capability``."""
    tool: dict[str, Any] = {"name": capability.name}
    if capability.title is not None:
        tool["title"] = capability.title
    tool["description"] = capability.description
    tool["inputSchema"] = plain(capability.input_schema)
    if capability.output_schema is not None:
        tool["outputSchema"] = plain(capability.output_schema)
    tool["_meta"] = {
        "ai-robot/safety": str(capability.safety),
        "ai-robot/version": capability.version,
    }
    return tool


def _check_meta(params: Any) -> None:
    """Every MCP request carries its protocol version and the client's capabilities."""
    if not isinstance(params, dict):
        raise Rejected(INVALID_PARAMS, "params must be an object")
    meta = params.get("_meta")
    version = (
        meta.get("io.modelcontextprotocol/protocolVersion") if isinstance(meta, dict) else None
    )
    capabilities = (
        meta.get("io.modelcontextprotocol/clientCapabilities") if isinstance(meta, dict) else None
    )
    if not isinstance(version, str) or not isinstance(capabilities, dict):
        raise Rejected(
            INVALID_PARAMS,
            "params._meta must carry io.modelcontextprotocol/protocolVersion and "
            "io.modelcontextprotocol/clientCapabilities",
        )
    if version != MCP_VERSION:
        raise Rejected(
            UNSUPPORTED_PROTOCOL_VERSION,
            "Unsupported protocol version",
            {"supported": [MCP_VERSION], "requested": version},
        )


def _server_info() -> dict[str, Any]:
    return {
        "io.modelcontextprotocol/serverInfo": {"name": "ai-robot", "version": software_version()}
    }
