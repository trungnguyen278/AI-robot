# SPDX-License-Identifier: MIT
"""The message bus: the only way modules talk to each other.

A message is an instance of a ``Message`` subclass, and its class is the topic: a
subscriber receives every message of the class it subscribed to. The messages the
modules exchange are defined in ``ai_robot.messages``.

Each subscription has its own bounded queue. A subscriber that falls behind loses its
oldest messages, so it can never slow down the publisher or the other subscribers.

The bus is not thread-safe: use it from the event loop only. Code running in another
thread (a driver callback, for example) hands its data to the loop with
``loop.call_soon_threadsafe``.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Generic, TypeVar

log = logging.getLogger(__name__)


class Message:
    """Base class of everything published on the bus.

    Subclasses are frozen dataclasses, so no subscriber can change what the others
    receive.
    """

    __slots__ = ()


M = TypeVar("M", bound=Message)


class Subscription(Generic[M]):
    """The messages of one type received by one subscriber, in publish order.

    Read them with ``await subscription.get()`` or ``async for message in subscription``;
    the loop waits for new messages until the reading task is cancelled.
    """

    def __init__(self, bus: Bus, kind: type[M], maxsize: int) -> None:
        if maxsize < 1:
            raise ValueError("maxsize must be at least 1")
        self.kind = kind
        self.dropped = 0
        self._bus = bus
        self._queue: asyncio.Queue[M] = asyncio.Queue(maxsize)

    @property
    def pending(self) -> int:
        """Number of messages waiting to be read."""
        return self._queue.qsize()

    async def get(self) -> M:
        """Wait for the next message."""
        return await self._queue.get()

    def close(self) -> None:
        """Stop receiving messages."""
        self._bus._unsubscribe(self)

    def __aiter__(self) -> Subscription[M]:
        return self

    async def __anext__(self) -> M:
        return await self.get()

    def _deliver(self, message: M) -> None:
        if self._queue.full():
            self._queue.get_nowait()
            if self.dropped == 0:
                log.warning(
                    "a %s subscriber is falling behind; dropping its oldest messages",
                    self.kind.__name__,
                )
            self.dropped += 1
        self._queue.put_nowait(message)


class Bus:
    """Delivers each published message to every subscriber of its type."""

    def __init__(self) -> None:
        self._subscriptions: dict[type[Message], list[Subscription]] = {}

    def publish(self, message: Message) -> None:
        """Deliver ``message`` to every subscriber of its type. Never blocks."""
        if not isinstance(message, Message):
            raise TypeError(f"not a bus message: {message!r}")
        for subscription in self._subscriptions.get(type(message), ()):
            subscription._deliver(message)

    def subscribe(self, kind: type[M], *, maxsize: int = 100) -> Subscription[M]:
        """Receive every message of type ``kind`` published from now on.

        ``maxsize`` is how many unread messages are kept before the oldest is dropped.
        """
        if not (isinstance(kind, type) and issubclass(kind, Message)):
            raise TypeError(f"not a bus message type: {kind!r}")
        subscription = Subscription(self, kind, maxsize)
        self._subscriptions.setdefault(kind, []).append(subscription)
        return subscription

    def _unsubscribe(self, subscription: Subscription) -> None:
        subscriptions = self._subscriptions.get(subscription.kind, [])
        if subscription in subscriptions:
            subscriptions.remove(subscription)
