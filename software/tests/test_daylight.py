# SPDX-License-Identifier: MIT
"""Daylight adapters: fixed times, and times computed for a place."""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, time

import pytest

from ai_robot.adapters.sun.daylight import FixedDaylight, SolarDaylight, sun_times
from ai_robot.ports import SunTimes

# Reference times from astral 3.2, an independent implementation (computed on
# 2026-10-16), in UTC: place, latitude, longitude, local date, sunrise, sunset.
REFERENCES = [
    ("Hanoi", 21.0285, 105.8542, date(2026, 6, 21), "2026-06-20T22:16:09", "2026-06-21T11:40:31"),
    ("Hanoi", 21.0285, 105.8542, date(2026, 12, 21), "2026-12-20T23:29:02", "2026-12-21T10:19:59"),
    ("Oslo", 59.9139, 10.7522, date(2026, 3, 20), "2026-03-20T05:19:16", "2026-03-20T17:30:58"),
    ("Sydney", -33.8688, 151.2093, date(2026, 1, 10), "2026-01-09T18:55:07", "2026-01-10T09:09:36"),
]
TROMSO = (69.6492, 18.9553)


def utc(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=UTC)


@pytest.mark.parametrize(("place", "latitude", "longitude", "day", "sunrise", "sunset"), REFERENCES)
def test_sun_times_are_within_a_minute(
    place: str, latitude: float, longitude: float, day: date, sunrise: str, sunset: str
) -> None:
    times = sun_times(day, latitude, longitude)
    assert times.sunrise is not None and times.sunset is not None
    assert abs((times.sunrise - utc(sunrise)).total_seconds()) < 60, place
    assert abs((times.sunset - utc(sunset)).total_seconds()) < 60, place


def test_the_sun_may_neither_rise_nor_set() -> None:
    assert sun_times(date(2026, 6, 21), *TROMSO) == SunTimes(None, None, up_all_day=True)
    assert sun_times(date(2026, 12, 21), *TROMSO) == SunTimes(None, None, up_all_day=False)


def test_solar_daylight_gives_local_times() -> None:
    place, latitude, longitude, day, sunrise, _ = REFERENCES[0]
    times = asyncio.run(SolarDaylight(latitude=latitude, longitude=longitude).sun(day))
    assert times.sunrise is not None and times.sunrise.tzinfo is not None
    assert abs((times.sunrise - utc(sunrise)).total_seconds()) < 60, place


def test_fixed_daylight_gives_the_same_times_every_day() -> None:
    daylight = FixedDaylight(sunrise="06:15", sunset="18:45")
    for day in (date(2026, 1, 1), date(2026, 7, 1)):
        times = asyncio.run(daylight.sun(day))
        assert times.sunrise is not None and times.sunset is not None
        assert (times.sunrise.date(), times.sunrise.time(), times.sunset.time()) == (
            day,
            time(6, 15),
            time(18, 45),
        )
        assert times.sunrise.tzinfo is not None


def test_settings_are_checked() -> None:
    with pytest.raises(ValueError, match=r"sunset .* must come after sunrise"):
        FixedDaylight(sunrise="18:00", sunset="06:00")
    with pytest.raises(ValueError, match="sunrise must be a time of day"):
        FixedDaylight(sunrise="6am", sunset="18:00")
    with pytest.raises(ValueError, match="latitude must be from -90 to 90"):
        SolarDaylight(latitude=91, longitude=0)
    with pytest.raises(ValueError, match="longitude must be from -180 to 180"):
        SolarDaylight(latitude=0, longitude=-181)
