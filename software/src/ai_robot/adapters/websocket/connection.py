# SPDX-License-Identifier: MIT
"""One connection of the control channel: a WebSocket, from its handshake to its close
(platform/protocols/cloud/README.md, The control channel and Staying connected)."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import random
from dataclasses import dataclass
from typing import Any

import aiohttp
from aiohttp import WSCloseCode, WSMsgType

from ai_robot.adapters.websocket.session import MAX_MESSAGE, Session, parse
from ai_robot.core.data import Schema, encode

log = logging.getLogger(__name__)

# Fixed by the protocol (platform/protocols/cloud/README.md, Messages and schema.json).
UNNUMBERED = frozenset({"hello", "ping", "pong", "reconnect", "bye"})
LARGEST_SEQ = 2**53 - 1  # $defs/seq: what JSON numbers hold exactly


@dataclass(frozen=True, slots=True)
class Ending:
    """How a connection ended.

    - ``greeted``: whether its hello exchange completed, which starts the backoff
      again;
    - ``reason``: the ``bye`` that ended the session, from either side, if one did; the
      session cannot resume after it;
    - ``by_cloud``: whether the cloud said that ``bye``.
    """

    greeted: bool
    reason: str | None = None
    by_cloud: bool = False


class Connection:
    """The WebSocket ``ws`` of the control channel, whose messages ``schema`` checks.

    Before it carries a session, the robot says its hello on it (``say``) and reads the
    cloud's (``first``). Then it carries the session (``carry``): it writes what the
    session sends, in order (``write``), reads what the cloud sends, and pings. It
    closes after the robot's ``bye`` (``finish``).
    """

    def __init__(self, ws: aiohttp.ClientWebSocketResponse, schema: Schema, close_timeout: float):
        self.ws = ws
        self.schema = schema
        self.close_timeout = close_timeout
        self._outbox: asyncio.Queue[str | None] = asyncio.Queue()  # None: close here
        self._writer: asyncio.Task[None] | None = None
        self._bye: str | None = None  # the reason of the robot's bye, once it says it
        self._pong_due = False
        self._warned: set[str] = set()

    async def say(self, message: dict[str, Any]) -> None:
        """Send ``message`` at once, before the connection carries a session."""
        await self.ws.send_str(encode(message))

    async def first(self) -> Any:
        """The cloud's first message, parsed: ``{}`` if it is not JSON, ``None`` if the
        connection closed before it."""
        while True:
            frame = await self.ws.receive()
            if frame.type is WSMsgType.TEXT:
                try:
                    return parse(frame.data)
                except ValueError:
                    return {}
            if frame.type is not WSMsgType.BINARY:
                return None

    def write(self, text: str) -> None:
        """Send ``text`` after what was written before it."""
        if self._bye is None:
            self._outbox.put_nowait(text)

    async def finish(self, reason: str) -> None:
        """Say ``bye`` with ``reason``, after what was written before it, then close."""
        if self._bye is not None:
            return
        self._bye = reason
        bye = encode({"type": "bye", "reason": reason})
        if self._writer is None or self._writer.done():
            with contextlib.suppress(Exception):  # the connection may be gone already
                await self.ws.send_str(bye)
            await self.ws.close()
            return
        self._outbox.put_nowait(bye)
        self._outbox.put_nowait(None)
        # The writer closes the connection after the bye; the reader then ends, and the
        # writer may be cancelled with it, its work done.
        await asyncio.wait({self._writer}, timeout=self.close_timeout)

    async def carry(self, session: Session, interval: float) -> Ending:
        """Carry ``session`` until the connection ends, pinging every ``interval``
        seconds."""
        self._writer = asyncio.create_task(self._write(), name="cloud: writing")
        reading = asyncio.create_task(self._read(session), name="cloud: reading")
        pinging = asyncio.create_task(self._ping(session, interval), name="cloud: pinging")
        tasks = {self._writer, reading, pinging}
        try:
            done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            ending = reading.result() if reading in done else None
            if ending is not None and ending.reason is not None and not ending.by_cloud:
                await self.finish(ending.reason)  # the robot ends the session: it says why
            if self._bye is not None:
                return Ending(greeted=True, reason=self._bye)
            return ending or Ending(greeted=True)
        finally:
            for task in tasks:
                task.cancel()
            for task in tasks:
                with contextlib.suppress(asyncio.CancelledError):
                    await task
            await self.ws.close()

    # ---- the three tasks of a connection ----

    async def _write(self) -> None:
        while True:
            text = await self._outbox.get()
            if text is None:
                await self.ws.close()
                return
            try:
                await self.ws.send_str(text)
            except Exception as error:  # the connection is gone; the reader sees it too
                log.info("cannot send to the cloud: %s", error or type(error).__name__)
                return

    async def _read(self, session: Session) -> Ending:
        while True:
            frame = await self.ws.receive()
            if frame.type is WSMsgType.TEXT:
                ending = self._take(frame.data, session)
                if ending is not None:
                    return ending
            elif frame.type is WSMsgType.BINARY:
                self._once("binary", "ignoring binary frames from the cloud")
            elif frame.type is WSMsgType.ERROR and _too_large(frame.data):
                # aiohttp stops reading it, and closes the connection: the session goes on
                # on the next one, where the robot answers it.
                log.warning("the cloud sent a message larger than %d bytes", MAX_MESSAGE)
                session.oversized()
                return Ending(greeted=True)
            else:  # closed, or failed
                return Ending(greeted=True)

    def _take(self, text: str, session: Session) -> Ending | None:
        """Take one message from the cloud. Returns how the connection ends, if it does."""
        try:
            message = parse(text)
        except ValueError:
            self._once("json", "ignoring messages from the cloud that are not JSON")
            return None
        kind = message.get("type") if isinstance(message, dict) else None
        if kind in UNNUMBERED:
            problem = self.schema.problem(message)
            if problem is not None:  # it has no number for an error to answer
                log.warning("ignoring a %s message from the cloud: %s", kind, problem)
                return None
            if kind == "pong":
                self._pong_due = False
                session.acknowledge(message["received"])
            elif kind == "reconnect":
                log.info("the cloud asks the robot to connect again")
                return Ending(greeted=True)
            elif kind == "bye":
                return Ending(greeted=True, reason=message["reason"], by_cloud=True)
            else:
                self._once(kind, f"ignoring {kind} messages from the cloud now")
            return None
        seq = message.get("seq") if isinstance(message, dict) else None
        if isinstance(seq, bool) or not isinstance(seq, int) or not 1 <= seq <= LARGEST_SEQ:
            self._once("seq", "ignoring messages from the cloud without a number")
            return None
        if not session.receive(seq, message):
            log.warning("the cloud's message %d skips a number after %d", seq, session.received)
            return Ending(greeted=True, reason="out_of_sequence")
        return None

    async def _ping(self, session: Session, interval: float) -> None:
        """Ping every ``interval`` seconds, and return when a pong is late."""
        await asyncio.sleep(random.uniform(0, interval))  # devices that connect together spread
        while True:
            if self._pong_due:
                log.warning("the cloud did not answer a ping within %g s", interval)
                return
            self._pong_due = True
            self.write(encode({"type": "ping", "received": session.received}))
            await asyncio.sleep(interval)

    def _once(self, key: str, text: str) -> None:
        if key not in self._warned:
            self._warned.add(key)
            log.warning(text)


def _too_large(error: Any) -> bool:
    """Whether ``error``, from aiohttp, says that a message was larger than allowed."""
    return isinstance(error, aiohttp.WebSocketError) and error.code == WSCloseCode.MESSAGE_TOO_BIG
