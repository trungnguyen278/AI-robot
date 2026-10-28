# SPDX-License-Identifier: MIT
"""The set-up link through BlueZ, on a private D-Bus with a fake BlueZ (local_dbus.py):
the GATT service and the advertisement it registers, and phones that write fragments and
confirm indications."""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import AsyncIterator, Iterator
from functools import partial
from pathlib import Path

import pytest
import waiting
from local_dbus import private_bus

from ai_robot.ports.setup import Connected, Disconnected, LinkEvent, Received

TIMEOUT = 5.0

until = partial(waiting.until, timeout=TIMEOUT)

PHONE = "/org/bluez/hci0/dev_AA_BB_CC_DD_EE_FF"
OTHER = "/org/bluez/hci0/dev_11_22_33_44_55_66"


@pytest.fixture
def bus(tmp_path: Path) -> Iterator[str]:
    with private_bus(tmp_path) as address:
        yield address


@contextlib.asynccontextmanager
async def started(bus: str, confirm_timeout: float = TIMEOUT) -> AsyncIterator[tuple]:
    from fake_bluez import FakeBluez

    from ai_robot.adapters.bluez.setup import BluezSetupLink

    bluez = FakeBluez(bus)
    await bluez.start()
    link = BluezSetupLink(adapter="hci0", bus=bus, confirm_timeout=confirm_timeout)
    await link.open()
    try:
        yield bluez, link
    finally:
        await link.close()
        await bluez.stop()


async def next_event(link: object) -> LinkEvent:
    return await asyncio.wait_for(link.event(), TIMEOUT)  # type: ignore[attr-defined]


def test_the_service_and_the_advertisement_are_registered(bus: str) -> None:
    from ai_robot.adapters.bluez.setup import ANSWER_UUID, REQUEST_UUID, SERVICE_UUID

    async def main() -> None:
        async with started(bus) as (bluez, link):
            await link.start("Robot with a long name")
            services = [
                interfaces["org.bluez.GattService1"]
                for interfaces in bluez.application.values()
                if "org.bluez.GattService1" in interfaces
            ]
            assert services == [{"UUID": SERVICE_UUID, "Primary": True}]
            request = bluez.application[bluez.characteristic(REQUEST_UUID)]
            answer = bluez.application[bluez.characteristic(ANSWER_UUID)]
            assert request["org.bluez.GattCharacteristic1"]["Flags"] == ["write"]
            assert answer["org.bluez.GattCharacteristic1"]["Flags"] == ["indicate"]
            assert bluez.advertisement is not None
            assert bluez.advertisement["ServiceUUIDs"] == [SERVICE_UUID]
            assert bluez.advertisement["LocalName"] == "Robot wi"  # 8 bytes fit
            await link.advertise(False)
            assert bluez.advertisement is None
            await link.advertise(True)
            assert bluez.advertisement is not None
            await link.stop()
            assert bluez.advertisement is None and bluez.application == {}

    asyncio.run(main())


def test_messages_both_ways_in_fragments(bus: str) -> None:
    from ai_robot.adapters.bluez.setup import ANSWER_UUID, REQUEST_UUID

    async def main() -> None:
        async with started(bus) as (bluez, link):
            await link.start("Robot")
            await bluez.subscribe(ANSWER_UUID)
            request = b'{"type": "hello", "id": "a1", "protocol": "1.0"}'
            await bluez.send(PHONE, REQUEST_UUID, request, mtu=23)
            assert await next_event(link) == Connected(PHONE)
            assert await next_event(link) == Received(PHONE, request)
            answer = bytes(range(256)) * 3
            await link.send(PHONE, answer)
            assert await bluez.receive(TIMEOUT) == answer
            assert bluez.indications.empty()

    asyncio.run(main())


def test_fragments_fit_the_mtu_of_the_phone(bus: str) -> None:
    from ai_robot.adapters.bluez.setup import ANSWER_UUID, REQUEST_UUID

    async def main() -> None:
        async with started(bus) as (bluez, link):
            await link.start("Robot")
            await bluez.subscribe(ANSWER_UUID)
            await bluez.send(PHONE, REQUEST_UUID, b"x", mtu=185)
            await next_event(link)
            await next_event(link)
            await link.send(PHONE, b"y" * 1000)
            fragments = [await asyncio.wait_for(bluez.indications.get(), TIMEOUT)]
            while sum(len(f) for f in fragments) < 1000:
                fragments.append(await asyncio.wait_for(bluez.indications.get(), TIMEOUT))
            assert max(len(f) for f in fragments) == 182  # 185 minus the ATT header

    asyncio.run(main())


def test_a_phone_that_disconnects_leaves(bus: str) -> None:
    from ai_robot.adapters.bluez.setup import REQUEST_UUID

    async def main() -> None:
        async with started(bus) as (bluez, link):
            await link.start("Robot")
            await bluez.send(PHONE, REQUEST_UUID, b"hello", mtu=23)
            assert await next_event(link) == Connected(PHONE)
            await next_event(link)
            bluez.disconnect(PHONE)
            assert await next_event(link) == Disconnected(PHONE)
            bluez.disconnect(OTHER)  # one it never knew: nothing
            await link.drop(PHONE)  # gone already: nothing
            assert bluez.disconnected == []

    asyncio.run(main())


def test_the_robot_drops_a_phone(bus: str) -> None:
    from ai_robot.adapters.bluez.setup import REQUEST_UUID

    async def main() -> None:
        async with started(bus) as (bluez, link):
            await link.start("Robot")
            await bluez.send(PHONE, REQUEST_UUID, b"hello", mtu=23)
            await next_event(link)
            await next_event(link)
            await link.drop(PHONE)
            assert await next_event(link) == Disconnected(PHONE)
            assert bluez.disconnected == [PHONE]

    asyncio.run(main())


def test_a_fragment_that_does_not_fit_drops_the_phone(bus: str) -> None:
    from ai_robot.adapters.bluez.setup import REQUEST_UUID

    async def main() -> None:
        async with started(bus) as (bluez, link):
            await link.start("Robot")
            await bluez.write(PHONE, REQUEST_UUID, bytes([0x40]) + b"no first", mtu=23)
            assert await next_event(link) == Connected(PHONE)
            assert await next_event(link) == Disconnected(PHONE)
            await until(lambda: bluez.disconnected == [PHONE])

    asyncio.run(main())


def test_a_phone_that_does_not_confirm_is_dropped(bus: str) -> None:
    from ai_robot.adapters.bluez.setup import ANSWER_UUID, REQUEST_UUID

    async def main() -> None:
        async with started(bus, confirm_timeout=0.3) as (bluez, link):
            await link.start("Robot")
            await bluez.subscribe(ANSWER_UUID)
            bluez.confirming = False
            await bluez.send(PHONE, REQUEST_UUID, b"hello", mtu=23)
            await next_event(link)
            await next_event(link)
            await link.send(PHONE, b"z" * 100)
            assert await next_event(link) == Disconnected(PHONE)
            await until(lambda: bluez.disconnected == [PHONE])

    asyncio.run(main())


def test_a_refusal_from_bluez_is_an_error(bus: str) -> None:
    async def main() -> None:
        async with started(bus) as (bluez, link):
            bluez.refuse = True
            with pytest.raises(ConnectionError, match="RegisterApplication failed"):
                await link.start("Robot")

    asyncio.run(main())


def test_settings_are_checked() -> None:
    pytest.importorskip("dbus_fast")
    from ai_robot.adapters.bluez.setup import BluezSetupLink, short_name

    with pytest.raises(ValueError, match="adapter"):
        BluezSetupLink(adapter="", bus="system", confirm_timeout=1.0)
    with pytest.raises(ValueError, match="confirm_timeout"):
        BluezSetupLink(adapter="hci0", bus="system", confirm_timeout=0)
    assert short_name("Rôbôtô") == "Rôbôt"  # cut on a whole character, within 8 bytes
