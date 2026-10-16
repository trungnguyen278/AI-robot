# SPDX-License-Identifier: MIT
"""Daylight from fixed times, or computed from the robot's place."""

from __future__ import annotations

import math
from datetime import UTC, date, datetime, timedelta

from ai_robot.core.checks import time_of_day, within
from ai_robot.ports.daylight import Daylight, SunTimes

# Where the sun's centre is when its upper edge touches the horizon, refraction
# included, in degrees from the zenith.
SUNRISE_ZENITH = 90.833


class FixedDaylight(Daylight):
    """The same sunrise and sunset every day, in local time: the stand-in until the
    robot knows where it is."""

    def __init__(self, *, sunrise: str, sunset: str) -> None:
        self.sunrise = time_of_day("sunrise", sunrise)
        self.sunset = time_of_day("sunset", sunset)
        if self.sunset <= self.sunrise:
            raise ValueError(f"sunset ({sunset}) must come after sunrise ({sunrise})")

    async def sun(self, day: date) -> SunTimes:
        local = (
            datetime.combine(day, moment).astimezone() for moment in (self.sunrise, self.sunset)
        )
        return SunTimes(*local)


class SolarDaylight(Daylight):
    """Sunrise and sunset computed for the robot's place, with no network.

    ``latitude`` and ``longitude`` are in degrees, north and east positive.
    """

    def __init__(self, *, latitude: float, longitude: float) -> None:
        self.latitude = within("latitude", latitude, -90, 90)
        self.longitude = within("longitude", longitude, -180, 180)

    async def sun(self, day: date) -> SunTimes:
        times = sun_times(day, self.latitude, self.longitude)
        return SunTimes(
            None if times.sunrise is None else times.sunrise.astimezone(),
            None if times.sunset is None else times.sunset.astimezone(),
            times.up_all_day,
        )


def sun_times(day: date, latitude: float, longitude: float) -> SunTimes:
    """Sunrise and sunset, in UTC, on the local date ``day`` at a place.

    The equations of NOAA's solar calculator (from Meeus, Astronomical Algorithms),
    which NOAA gives as accurate to within a minute between 72° south and 72° north
    (https://gml.noaa.gov/grad/solcalc/). The sun's position is evaluated at solar
    noon, then again at each estimated event, which keeps high latitudes within that
    minute around the equinoxes.
    """
    midnight = datetime(day.year, day.month, day.day, tzinfo=UTC)
    noon = midnight + timedelta(hours=12 - longitude / 15)
    cos_hour_angle, _ = _sun_at(noon, latitude)
    if not -1 <= cos_hour_angle <= 1:  # the sun stays above (< -1) or below (> 1) the horizon
        return SunTimes(None, None, up_all_day=cos_hour_angle < -1)

    def event(side: int, moment: datetime) -> datetime:
        cos_hour_angle, equation_of_time = _sun_at(moment, latitude)
        half_day = 4 * math.degrees(math.acos(max(-1.0, min(1.0, cos_hour_angle))))  # minutes
        solar_noon = 720 - 4 * longitude - equation_of_time  # minutes after midnight UTC
        return midnight + timedelta(minutes=solar_noon + side * half_day)

    sunrise, sunset = event(-1, noon), event(1, noon)
    return SunTimes(event(-1, sunrise), event(1, sunset))


def _sun_at(moment: datetime, latitude: float) -> tuple[float, float]:
    """The cosine of the sunrise hour angle at ``latitude``, and the equation of time
    in minutes, for the sun's position at ``moment``."""
    t = (moment.timestamp() / 86400 + 2440587.5 - 2451545) / 36525  # Julian centuries since J2000
    mean_longitude = math.radians((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360)
    mean_anomaly = math.radians(357.52911 + t * (35999.05029 - 0.0001537 * t))
    eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
    centre = (
        math.sin(mean_anomaly) * (1.914602 - t * (0.004817 + 0.000014 * t))
        + math.sin(2 * mean_anomaly) * (0.019993 - 0.000101 * t)
        + math.sin(3 * mean_anomaly) * 0.000289
    )
    node = math.radians(125.04 - 1934.136 * t)
    apparent_longitude = mean_longitude + math.radians(centre - 0.00569 - 0.00478 * math.sin(node))
    mean_obliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    obliquity = math.radians(mean_obliquity + 0.00256 * math.cos(node))
    declination = math.asin(math.sin(obliquity) * math.sin(apparent_longitude))
    y = math.tan(obliquity / 2) ** 2
    equation_of_time = 4 * math.degrees(
        y * math.sin(2 * mean_longitude)
        - 2 * eccentricity * math.sin(mean_anomaly)
        + 4 * eccentricity * y * math.sin(mean_anomaly) * math.cos(2 * mean_longitude)
        - 0.5 * y * y * math.sin(4 * mean_longitude)
        - 1.25 * eccentricity * eccentricity * math.sin(2 * mean_anomaly)
    )
    lat = math.radians(latitude)
    cos_hour_angle = math.cos(math.radians(SUNRISE_ZENITH)) / (
        math.cos(lat) * math.cos(declination)
    ) - math.tan(lat) * math.tan(declination)
    return cos_hour_angle, equation_of_time
