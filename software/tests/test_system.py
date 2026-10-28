# SPDX-License-Identifier: MIT
"""The system module: battery reports, the charging scene, and the robot's locale."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections.abc import AsyncIterator
from pathlib import Path
from typing import TypeVar

import pytest

from ai_robot.adapters.sim.body import SimLights, SimPower
from ai_robot.adapters.sim.time_zone import SimTimeZone
from ai_robot.core.bus import Bus, Message, Subscription
from ai_robot.core.module import ModuleContext, RobotInfo
from ai_robot.messages import (
    BatteryReport,
    LocaleApplied,
    LocaleChanged,
    LocaleRequested,
    SceneRequest,
    SettingChanged,
    SettingOffered,
    SettingRequested,
)
from ai_robot.modules.system import CHARGING_SCENE, LANGUAGES_SETTING, SystemModule
from ai_robot.ports import BatteryStatus

VOCABULARY = Path(__file__).resolve().parents[2] / "protocol" / "screen" / "vocabulary.json"
INTERVAL = 0.01
CHARGING_SECONDS = 4.0
SETTINGS = {
    "battery_interval": INTERVAL,
    "charging_scene_seconds": CHARGING_SECONDS,
    "ready_color": [0, 40, 0],
    "low_battery_percent": 15.0,
    "language_names": {"vi": "Vietnamese", "en": "English"},
    "languages": ["vi"],
}
TIMEOUT = 5.0


def ports() -> dict[str, object]:
    return {
        "power": SimPower(voltage=7.4, percent=50.0, charging=False),
        "lights": SimLights(),
        "time_zone": SimTimeZone(zone="UTC"),
    }


def context(bus: Bus, ports: dict[str, object]) -> ModuleContext:
    return ModuleContext(
        name="system",
        bus=bus,
        ports=ports,  # type: ignore[arg-type]
        robot=RobotInfo(display_name="Robot", kind="robot", model="concept-v0"),
        log=logging.getLogger("test"),
    )


def scenes_for(readings: list[bool | None]) -> list[SceneRequest]:
    """The scene requests the system module makes while the battery reports ``readings``
    (charging or not, or unknown), each for a few battery intervals."""

    async def main() -> list[SceneRequest]:
        bus = Bus()
        adapters = ports()
        power = adapters["power"]
        assert isinstance(power, SimPower)
        module = SystemModule(context(bus, adapters), **SETTINGS)
        requests = bus.subscribe(SceneRequest)
        reports = bus.subscribe(BatteryReport)
        await module.start()
        task = asyncio.create_task(module.run())
        try:
            for charging in readings:
                power.status = BatteryStatus(voltage=7.4, percent=50.0, charging=charging)
                for _ in range(3):  # wait until the module has read it a few times
                    while (await reports.get()).status.charging != charging:
                        pass
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
            await module.stop()
        return [await requests.get() for _ in range(requests.pending)]

    return asyncio.run(main())


def test_plugging_in_shows_the_charging_scene() -> None:
    plugged = SceneRequest("system", CHARGING_SCENE, duration=CHARGING_SECONDS)
    assert scenes_for([False, True]) == [plugged]
    assert scenes_for([False, True, False]) == [plugged, SceneRequest("system", None)]


def test_starting_on_the_charger_shows_nothing() -> None:
    assert scenes_for([True, True]) == []


def test_unknown_readings_change_nothing() -> None:
    plugged = SceneRequest("system", CHARGING_SCENE, duration=CHARGING_SECONDS)
    assert scenes_for([False, True, None, True]) == [plugged]
    assert scenes_for([None, True, None]) == []


def test_the_charging_scene_is_in_the_protocol() -> None:
    vocabulary = json.loads(VOCABULARY.read_text(encoding="utf-8"))
    assert CHARGING_SCENE in vocabulary["scenes"]


@pytest.mark.parametrize(
    ("percent", "charging", "low"),
    [
        (15.0, False, True),
        (15.5, False, False),
        (10.0, True, False),  # plugged in: not low, even if empty
        (10.0, None, True),  # unknown charger: low, to be safe
        (None, False, None),  # unknown charge: unknown
    ],
)
def test_the_system_judges_the_battery_low(
    percent: float | None, charging: bool | None, low: bool | None
) -> None:
    module = SystemModule(context(Bus(), ports()), **SETTINGS)
    assert module.is_low(BatteryStatus(voltage=7.4, percent=percent, charging=charging)) is low


# ---- the locale ----


M = TypeVar("M", bound=Message)


async def next_of(subscription: Subscription[M]) -> M:
    return await asyncio.wait_for(subscription.get(), TIMEOUT)


@contextlib.asynccontextmanager
async def running_system(
    bus: Bus, adapters: dict[str, object], kept: str | None = None
) -> AsyncIterator[SystemModule]:
    """The system module, running. ``kept`` is the owner's languages, kept from before a
    restart: the settings module sends them once every module exists."""
    module = SystemModule(context(bus, adapters), **SETTINGS)
    if kept is not None:
        bus.publish(SettingChanged(LANGUAGES_SETTING, kept))
    await module.start()
    task = asyncio.create_task(module.run())
    try:
        yield module
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        await module.stop()


def test_the_system_tells_the_locale_once_the_owners_languages_are_applied() -> None:
    async def main() -> None:
        bus = Bus()
        locales = bus.subscribe(LocaleChanged)
        async with running_system(bus, ports(), kept="en,vi"):
            assert await next_of(locales) == LocaleChanged(("en", "vi"), "UTC")

    asyncio.run(main())


def test_the_languages_setting_offers_every_order_of_the_languages() -> None:
    async def main() -> None:
        bus = Bus()
        offers = bus.subscribe(SettingOffered)
        async with running_system(bus, ports()):
            offered = {}
            while LANGUAGES_SETTING not in offered or "system.time_zone" not in offered:
                setting = (await next_of(offers)).setting
                offered[setting.name] = setting
        choices = offered[LANGUAGES_SETTING].schema["oneOf"]
        assert [(c["const"], c["title"]) for c in choices] == [
            ("vi", "Vietnamese"),
            ("en", "English"),
            ("vi,en", "Vietnamese, then English"),
            ("en,vi", "English, then Vietnamese"),
        ]
        assert offered["system.time_zone"].value == "UTC"

    asyncio.run(main())


def test_set_up_gives_the_languages_it_supports_and_a_time_zone() -> None:
    async def main() -> None:
        bus = Bus()
        adapters = ports()
        applied, kept = bus.subscribe(LocaleApplied), bus.subscribe(SettingRequested)
        locales = bus.subscribe(LocaleChanged)
        async with running_system(bus, adapters) as module:
            assert await next_of(locales) == LocaleChanged(("vi",), "UTC")
            bus.publish(LocaleRequested("r1", ("fr", "EN-gb", "vi", "en"), "Asia/Ho_Chi_Minh"))
            answer = await next_of(applied)
            assert answer == LocaleApplied("r1", ("en", "vi"), "Asia/Ho_Chi_Minh")
            # Kept as the owner's choice, through the settings module.
            assert await next_of(kept) == SettingRequested(LANGUAGES_SETTING, "en,vi")
            assert await next_of(locales) == LocaleChanged(("vi",), "Asia/Ho_Chi_Minh")
            assert await adapters["time_zone"].current() == "Asia/Ho_Chi_Minh"  # type: ignore[attr-defined]
            bus.publish(SettingChanged(LANGUAGES_SETTING, "en,vi"))  # as settings sends it
            assert await next_of(locales) == LocaleChanged(("en", "vi"), "Asia/Ho_Chi_Minh")
            assert module.languages == ("en", "vi")

    asyncio.run(main())


def test_a_time_zone_the_robot_cannot_take_changes_nothing() -> None:
    async def main() -> None:
        bus = Bus()
        adapters = ports()
        applied, kept = bus.subscribe(LocaleApplied), bus.subscribe(SettingRequested)
        async with running_system(bus, adapters):
            bus.publish(LocaleRequested("r1", ("en",), "Mars/Olympus_Mons"))
            answer = await next_of(applied)
            assert (answer.error, answer.languages, answer.time_zone) == (
                "time_zone",
                ("vi",),
                "UTC",
            )
            assert kept.pending == 0
            assert await adapters["time_zone"].current() == "UTC"  # type: ignore[attr-defined]

    asyncio.run(main())


def test_languages_it_does_not_support_leave_its_own() -> None:
    async def main() -> None:
        bus = Bus()
        applied, kept = bus.subscribe(LocaleApplied), bus.subscribe(SettingRequested)
        async with running_system(bus, ports()):
            bus.publish(LocaleRequested("r1", ("fr", "de-CH")))
            assert await next_of(applied) == LocaleApplied("r1", ("vi",), "UTC")
            assert kept.pending == 0

    asyncio.run(main())


@pytest.mark.parametrize(
    ("names", "languages"),
    [
        ({}, ["vi"]),
        ({"vi": "Vietnamese"}, []),
        ({"vi": "Vietnamese"}, ["en"]),
        ({"vi": "Vietnamese"}, ["vi", "vi"]),
        ({"vi_VN": "Vietnamese"}, ["vi_VN"]),
        ({"vi": ""}, ["vi"]),
    ],
)
def test_the_languages_are_checked(names: dict[str, str], languages: list[str]) -> None:
    settings = {**SETTINGS, "language_names": names, "languages": languages}
    with pytest.raises(ValueError, match="language"):
        SystemModule(context(Bus(), ports()), **settings)
