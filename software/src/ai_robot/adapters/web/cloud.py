# SPDX-License-Identifier: MIT
"""The link to ai-robot-server over a WebSocket (protocol/cloud/README.md).

The robot opens the connection (ADR-0007), keeps a session with the cloud, and
reconnects after a loss. On the session the robot is an MCP server (ADR-0008): the cloud
lists and calls the capabilities the robot offers, and receives the events it
subscribed to. Turns and audio frames are not handled yet: the robot offers no audio
formats.
"""

from __future__ import annotations

import asyncio
import contextlib
import itertools
import json
import logging
import os
import random
import time
import urllib.parse
from collections import deque
from collections.abc import Mapping, Sequence
from datetime import datetime
from pathlib import Path
from typing import Any

import aiohttp
from aiohttp import WSCloseCode, WSMsgType

from ai_robot import software_version
from ai_robot.core.checks import finite, positive
from ai_robot.core.config import protocol_dir
from ai_robot.core.data import Schema, encode, plain
from ai_robot.ports.cloud import (
    CallCancelled,
    Capability,
    Cloud,
    EventKind,
    LinkStatus,
    ToolCall,
)

log = logging.getLogger(__name__)

# Fixed by the protocol (protocol/cloud/README.md and schema.json), not settings: the
# cloud relies on them.
PROTOCOL = "1.0"
MCP_VERSION = "2026-07-28"
TOKEN_ENV = "AI_ROBOT_CLOUD_TOKEN"  # the robot's credentials, provisional (decision 5)
MAX_TEXT = 1 << 20  # bytes in a text frame
MAX_BINARY = 64 << 10  # bytes in a binary frame
MAX_ID = 64  # characters in a message id ($defs/id in schema.json)
MAX_ERROR = 1024  # characters in an error's message ($defs/error in schema.json)
CLOSE_REASON_BYTES = 123  # the longest reason a close frame carries (RFC 6455, 5.5)
LOOPBACK = {"127.0.0.1", "::1", "localhost"}

# How this implementation works, which nobody needs to tune.
SEEN = 1000  # message ids remembered, so that a resent message never acts twice
DROP_REPORT = 10.0  # seconds between two reports of dropped messages

# Close codes (protocol/cloud/README.md)
UNSUPPORTED_PROTOCOL = 4000
NO_HELLO = 4001

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
    """The connection closed, or must close with ``code``."""

    def __init__(self, reason: str, code: int | None = None) -> None:
        super().__init__(reason)
        self.code = code


class Bucket:
    """A token bucket: ``rate`` messages a second, in bursts of up to ``burst``."""

    def __init__(self, rate: float, burst: int) -> None:
        self.rate = rate
        self.burst = burst
        self._tokens = float(burst)
        self._at = time.monotonic()

    def take(self) -> bool:
        now = time.monotonic()
        self._tokens = min(self.burst, self._tokens + (now - self._at) * self.rate)
        self._at = now
        if self._tokens < 1:
            return False
        self._tokens -= 1
        return True


def _check_url(url: str) -> str:
    parts = urllib.parse.urlsplit(url)
    if parts.scheme not in ("wss", "ws") or not parts.hostname:
        raise ValueError(f"url must be a wss:// address, got {url!r}")
    if parts.scheme == "ws" and parts.hostname not in LOOPBACK:
        raise ValueError(
            "url: ws:// is allowed only to this computer (127.0.0.1, ::1, localhost); "
            f"use wss://, got {url!r}"
        )
    return url


def _load_schema(path: Path) -> Schema:
    """The schema of the messages from the cloud, from protocol/cloud/schema.json."""
    try:
        schema = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise ValueError(f"cannot read the cloud protocol's schema: {error}") from None
    return Schema("protocol/cloud/schema.json", {**schema, "$ref": "#/$defs/from_cloud"})


def _parse(text: str) -> Any:
    """``text`` as JSON; ``ValueError`` if it is not, NaN and Infinity included."""
    return json.loads(text, parse_constant=_not_json)


def _not_json(name: str) -> Any:
    raise ValueError(f"{name} is not JSON")


def _close_reason(reason: str) -> bytes:
    """``reason`` cut to fit a close frame. A character the cut splits is dropped, so
    that the reason stays valid UTF-8, as RFC 6455 requires."""
    return reason.encode()[:CLOSE_REASON_BYTES].decode(errors="ignore").encode()


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


class WebSocketCloud(Cloud):
    """The link to the cloud at ``url``: ``wss://``, or ``ws://`` to this computer for
    development. The robot's credentials come from the environment variable
    ``AI_ROBOT_CLOUD_TOKEN``, sent as a bearer token; without it, the robot connects
    without credentials.

    The other settings, in seconds unless they say, are explained in
    ``config/base.toml`` (``[ports.cloud.websocket]``).
    """

    def __init__(
        self,
        *,
        url: str,
        connect_timeout: float,
        hello_timeout: float,
        ping_after: float,
        send_timeout: float,
        close_timeout: float,
        reconnect_first: float,
        reconnect_max: float,
        rate: float,
        burst: int,
        catalogue_ttl: float,
    ) -> None:
        self.url = _check_url(url)
        self.connect_timeout = positive("connect_timeout", connect_timeout)
        self.hello_timeout = positive("hello_timeout", hello_timeout)
        self.ping_after = positive("ping_after", ping_after)
        self.send_timeout = positive("send_timeout", send_timeout)
        self.close_timeout = positive("close_timeout", close_timeout)
        self.reconnect_first = positive("reconnect_first", reconnect_first)
        self.reconnect_max = positive("reconnect_max", reconnect_max)
        if self.reconnect_max < self.reconnect_first:
            raise ValueError("reconnect_max must not be below reconnect_first")
        self.rate = positive("rate", rate)
        if burst < 1:
            raise ValueError(f"burst must be at least 1, got {burst}")
        self.burst = burst
        self.catalogue_ttl = finite("catalogue_ttl", catalogue_ttl)
        if self.catalogue_ttl < 0:
            raise ValueError(f"catalogue_ttl must not be negative, got {catalogue_ttl}")
        self.capabilities: dict[str, Capability] = {}
        self.event_kinds: list[EventKind] = []
        self.session: Session | None = None
        self._schema: Schema | None = None
        self._offered = asyncio.Event()
        self._requests: asyncio.Queue[ToolCall | CallCancelled] = asyncio.Queue()
        self._statuses: asyncio.Queue[LinkStatus] = asyncio.Queue()
        self._resume: tuple[str, float] | None = None  # the token and when it expires
        self._numbers = itertools.count(1)
        self._http: aiohttp.ClientSession | None = None
        self._task: asyncio.Task[None] | None = None

    async def open(self) -> None:
        self._schema = await asyncio.to_thread(
            _load_schema, protocol_dir() / "cloud" / "schema.json"
        )
        if not os.environ.get(TOKEN_ENV):
            log.info("no %s set: the robot connects to the cloud without credentials", TOKEN_ENV)
        self._http = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=None, connect=self.connect_timeout)
        )
        self._task = asyncio.create_task(self._run(), name="cloud link")

    async def close(self) -> None:
        if self.session is not None:
            with contextlib.suppress(Exception):
                await self.session.goodbye("stopping")
        if self._task is not None:  # the task closes the connection with 1001 as it ends
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        if self._http is not None:
            await self._http.close()

    async def offer(self, capabilities: Sequence[Capability], events: Sequence[EventKind]) -> None:
        offered = {capability.name: capability for capability in capabilities}
        changed = offered != self.capabilities
        self.capabilities = offered
        self.event_kinds = list(events)
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

    def hello(self) -> dict[str, Any]:
        """The robot's ``hello``, without its ``id``."""
        message: dict[str, Any] = {
            "type": "hello",
            "protocol": PROTOCOL,
            "software": software_version(),
            "time": time.time(),
            "utc_offset": _utc_offset(),
            "media": {"speech": [], "voice": []},  # no audio streams yet
            "events": [
                {"name": kind.name, "description": kind.description, "schema": plain(kind.schema)}
                for kind in self.event_kinds
            ],
        }
        if self._resume is not None and time.monotonic() < self._resume[1]:
            message["resume"] = self._resume[0]
        return message

    def opened(self, session: Session, hello: Mapping[str, Any]) -> None:
        """Called when the cloud has answered the robot's hello."""
        self.session = session
        resume = hello["session"].get("resume")
        within = hello["session"].get("resume_within", 0)
        self._resume = None if resume is None else (resume, time.monotonic() + within)
        self._statuses.put_nowait(LinkStatus(True, session.id, session.events))

    def closed(self, session: Session) -> None:
        """Called when ``session`` ends; its calls in progress are cancelled."""
        if self.session is session:
            self.session = None
            self._statuses.put_nowait(LinkStatus(False))
        for call in session.cancel_calls():
            self._requests.put_nowait(CallCancelled(call))

    async def _run(self) -> None:
        """Connect, keep the session, and reconnect after a loss, for ever."""
        await self._offered.wait()
        assert self._http is not None and self._schema is not None
        failures = 0
        reported = False  # whether this outage was logged
        while True:
            reached = False
            try:
                async with self._http.ws_connect(
                    self.url,
                    headers=self._headers(),
                    heartbeat=self.ping_after,
                    max_msg_size=MAX_TEXT,
                    timeout=aiohttp.ClientWSTimeout(ws_receive=None, ws_close=self.close_timeout),
                ) as socket:
                    session = Session(self, socket, self._schema, next(self._numbers))
                    try:
                        reached = await session.run()
                    except asyncio.CancelledError:
                        # Close from this task: aiohttp would close with 1000 otherwise.
                        await socket.close(code=WSCloseCode.GOING_AWAY, message=b"stopping")
                        raise
                    except Exception:
                        log.exception("the cloud session failed")
                        await socket.close(code=WSCloseCode.INTERNAL_ERROR, message=b"internal")
                    finally:
                        self.closed(session)
                if reached:
                    reported = False
                    log.info("cloud session closed")
            except aiohttp.WSServerHandshakeError as error:
                if error.status in (401, 403) and not reported:
                    log.warning("the cloud refused the robot's credentials (%s)", error.status)
                    reported = True
                elif not reported:
                    log.warning("cannot open a session with the cloud: %s", error)
                    reported = True
            except (aiohttp.ClientError, OSError, TimeoutError) as error:
                if not reported:
                    log.warning("cannot reach the cloud: %s", error or type(error).__name__)
                    reported = True
            failures = 0 if reached else failures + 1
            delay = random.uniform(0, min(self.reconnect_max, self.reconnect_first * 2**failures))
            await asyncio.sleep(delay)

    def _headers(self) -> dict[str, str]:
        token = os.environ.get(TOKEN_ENV)
        return {"Authorization": f"Bearer {token}"} if token else {}


class Session:
    """One connection to the cloud, from the hello exchange to its end."""

    def __init__(
        self,
        link: WebSocketCloud,
        socket: aiohttp.ClientWebSocketResponse,
        schema: Schema,
        number: int,
    ) -> None:
        self.link = link
        self.socket = socket
        self.schema = schema
        self.number = number  # tells this session's calls from an earlier one's
        self.id = ""
        self.events: frozenset[str] = frozenset()
        self.subscriptions: dict[str, Any] = {}  # subscriptions/listen: key -> request id
        self.calls: dict[str, tuple[Any, str]] = {}  # call id -> request id, its message
        self._ids = itertools.count(1)
        self._seen: deque[str] = deque(maxlen=SEEN)
        self._bucket = Bucket(link.rate, link.burst)
        self._dropped = 0  # messages dropped since the last report
        self._reported = -DROP_REPORT  # when dropped messages were last reported
        self._warned: set[str] = set()

    # ---- the session's life ----

    async def run(self) -> bool:
        """Exchange hellos, then handle the cloud's messages until the connection
        closes. Returns whether the hello exchange succeeded."""
        hello = self.link.hello()
        await self.send(hello)
        try:
            answer = await asyncio.wait_for(self._hello(), self.link.hello_timeout)
        except TimeoutError:
            await self._close(NO_HELLO, "no hello")
            log.warning("the cloud did not answer the robot's hello")
            return False
        except SessionEnded as ended:
            if ended.code is not None:
                await self._close(ended.code, str(ended))
            log.warning("the cloud's hello was refused: %s", ended)
            return False
        self.id = answer["session"]["id"]
        declared = {kind.name for kind in self.link.event_kinds}
        self.events = frozenset(answer["events"]) & declared
        self.link.opened(self, answer)
        log.info("cloud session %s open (protocol %s)", self.id, answer["protocol"])
        async for frame in self.socket:
            if frame.type == WSMsgType.TEXT:
                await self._receive(frame.data)
            elif frame.type == WSMsgType.BINARY:
                await self._binary(frame.data)
            elif frame.type == WSMsgType.ERROR:
                log.warning("cloud connection error: %s", self.socket.exception())
                break
        return True

    async def _hello(self) -> Mapping[str, Any]:
        """The cloud's valid hello, which must come first."""
        frame = await self.socket.receive()
        if frame.type != WSMsgType.TEXT:
            raise SessionEnded("the connection closed before the cloud's hello")
        try:
            message = _parse(frame.data)
        except ValueError:
            raise SessionEnded("the cloud's first message is not JSON", NO_HELLO) from None
        problem = self.schema.problem(message)
        if problem is not None or message.get("type") != "hello":
            raise SessionEnded(
                f"the cloud's first message is not a valid hello: {problem}", NO_HELLO
            )
        major = message["protocol"].split(".")[0]
        if major != PROTOCOL.split(".")[0]:
            raise SessionEnded(
                f"the cloud speaks protocol {message['protocol']}", UNSUPPORTED_PROTOCOL
            )
        self._seen.append(message["id"])
        return message

    async def goodbye(self, reason: str) -> None:
        """End the subscriptions and say goodbye, before the robot closes the connection."""
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

    async def _close(self, code: int, reason: str) -> None:
        await self.socket.close(code=code, message=_close_reason(reason))

    def cancel_calls(self) -> list[str]:
        """The calls still in progress, which the session can no longer answer."""
        calls = list(self.calls)
        self.calls.clear()
        return calls

    # ---- sending ----

    async def send(self, message: dict[str, Any]) -> str:
        """Send ``message`` with a new ``id``, and return the id."""
        message = {"type": message["type"], "id": f"r{next(self._ids)}", **message}
        text = encode(message)
        try:
            async with asyncio.timeout(self.link.send_timeout):
                await self.socket.send_str(text)
        except (TimeoutError, ConnectionError) as error:
            log.warning("cannot send to the cloud: %s", error or type(error).__name__)
            await self._close(WSCloseCode.GOING_AWAY, "too slow")
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
        if not self._bucket.take():
            self._dropped += 1
            now = time.monotonic()
            if now - self._reported >= DROP_REPORT:
                self._reported = now
                log.warning("the cloud sends too many messages; %d dropped", self._dropped)
                self._dropped = 0
                await self._error("rate_limited", "too many messages; some were dropped")
            return
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
        if kind == "mcp":
            await self._on_mcp(message)
        elif kind == "bye":
            log.info("the cloud ends the session: %s", message["reason"])
            await self._close(WSCloseCode.OK, "bye")
        elif kind == "error":
            log.warning("the cloud reports %s: %s", message["code"], message["message"])
        elif kind.startswith(("turn.", "response.")):
            self._once(kind, "the robot does not handle turns and responses yet (%s)", kind)
        else:
            self._once(kind, "ignoring a %s message from the cloud", kind)

    async def _binary(self, data: bytes) -> None:
        if len(data) > MAX_BINARY:
            await self._close(WSCloseCode.MESSAGE_TOO_BIG, "frame too large")
            return
        self._once("binary", "ignoring audio from the cloud: no stream was negotiated")

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
        self.link._requests.put_nowait(call)
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
            self.link._requests.put_nowait(CallCancelled(call))

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
