# SPDX-License-Identifier: MIT
from __future__ import annotations

import asyncio
from dataclasses import dataclass

import pytest

from ai_robot.core.bus import Bus, Message


@dataclass(frozen=True, slots=True)
class Ping(Message):
    n: int


@dataclass(frozen=True, slots=True)
class Pong(Message):
    n: int


def test_every_subscriber_of_a_type_receives_its_messages() -> None:
    async def scenario() -> None:
        bus = Bus()
        first, second = bus.subscribe(Ping), bus.subscribe(Ping)
        pongs = bus.subscribe(Pong)
        bus.publish(Ping(1))
        bus.publish(Ping(2))
        assert [await first.get(), await first.get()] == [Ping(1), Ping(2)]
        assert [await second.get(), await second.get()] == [Ping(1), Ping(2)]
        assert pongs.pending == 0

    asyncio.run(scenario())


def test_a_slow_subscriber_loses_its_oldest_messages() -> None:
    async def scenario() -> None:
        bus = Bus()
        slow = bus.subscribe(Ping, maxsize=2)
        for n in range(5):
            bus.publish(Ping(n))
        assert slow.dropped == 3
        assert [await slow.get(), await slow.get()] == [Ping(3), Ping(4)]

    asyncio.run(scenario())


def test_subscriptions_are_async_iterables() -> None:
    async def scenario() -> None:
        bus = Bus()
        pings = bus.subscribe(Ping)
        bus.publish(Ping(1))
        bus.publish(Ping(2))
        received = []
        async for message in pings:
            received.append(message)
            if len(received) == 2:
                break
        assert received == [Ping(1), Ping(2)]

    asyncio.run(scenario())


def test_a_closed_subscription_receives_nothing() -> None:
    bus = Bus()
    pings = bus.subscribe(Ping)
    pings.close()
    bus.publish(Ping(1))
    assert pings.pending == 0


def test_only_messages_go_on_the_bus() -> None:
    bus = Bus()
    with pytest.raises(TypeError):
        bus.publish("hello")  # type: ignore[arg-type]
    with pytest.raises(TypeError):
        bus.subscribe(str)  # type: ignore[type-var]
