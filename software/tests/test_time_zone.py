# SPDX-License-Identifier: MIT
"""The robot's time zone: kept in memory by the simulated adapter, and the system's
through systemd-timedated, on a private D-Bus with a fake timedated (local_dbus.py)."""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from typing import Any

import pytest
from local_dbus import private_bus

from ai_robot.adapters.sim.time_zone import SimTimeZone


def test_the_simulated_time_zone_takes_the_zones_python_knows() -> None:
    async def main() -> None:
        zone = SimTimeZone(zone="UTC")
        assert await zone.current() == "UTC"
        await zone.set("Asia/Ho_Chi_Minh")
        assert await zone.current() == "Asia/Ho_Chi_Minh"
        with pytest.raises(ValueError, match="not a time zone"):
            await zone.set("Mars/Olympus_Mons")
        assert await zone.current() == "Asia/Ho_Chi_Minh"

    asyncio.run(main())


def test_the_simulated_time_zone_starts_at_a_real_zone() -> None:
    with pytest.raises(ValueError, match="not a time zone"):
        SimTimeZone(zone="Asia/Saigon City")


@pytest.fixture
def bus(tmp_path: Path) -> Iterator[str]:
    with private_bus(tmp_path) as address:
        yield address


@contextlib.asynccontextmanager
async def started(bus: str) -> AsyncIterator[tuple[Any, Any]]:
    from fake_timedated import FakeTimedated

    from ai_robot.adapters.timedated.time_zone import TimedatedTimeZone

    service = FakeTimedated(bus)
    await service.start()
    zone = TimedatedTimeZone(bus=bus)
    await zone.open()
    try:
        yield service, zone
    finally:
        await zone.close()
        await service.stop()


def test_timedated_reads_and_sets_the_time_zone(bus: str) -> None:
    async def main() -> None:
        async with started(bus) as (service, zone):
            assert await zone.current() == "UTC"
            await zone.set("Asia/Ho_Chi_Minh")
            assert service.zone == await zone.current() == "Asia/Ho_Chi_Minh"
            assert service.interactive == [False]  # nobody is asked to authenticate

    asyncio.run(main())


def test_timedated_refuses_a_zone_it_does_not_know(bus: str) -> None:
    async def main() -> None:
        async with started(bus) as (service, zone):
            with pytest.raises(ValueError, match="not a time zone the system knows"):
                await zone.set("Mars/Olympus_Mons")
            assert service.zone == "UTC"

    asyncio.run(main())


def test_a_robot_polkit_does_not_allow_cannot_set_it(bus: str) -> None:
    async def main() -> None:
        async with started(bus) as (service, zone):
            service.allowed = False
            with pytest.raises(OSError, match=r"refused the time zone: .*AccessDenied"):
                await zone.set("Europe/Paris")
            assert service.zone == "UTC"

    asyncio.run(main())
