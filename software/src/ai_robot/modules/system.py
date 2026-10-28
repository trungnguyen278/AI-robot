# SPDX-License-Identifier: MIT
"""System: the robot's own health, and its locale."""

from __future__ import annotations

import asyncio
import itertools
import re
from collections.abc import Mapping, Sequence

from ai_robot.core.checks import positive, within
from ai_robot.core.module import Module, ModuleContext
from ai_robot.core.settings import SettingsHost
from ai_robot.messages import (
    BatteryReport,
    LocaleApplied,
    LocaleChanged,
    LocaleRequested,
    SceneRequest,
    Setting,
    SettingKind,
    SettingRequested,
    SettingSection,
)
from ai_robot.ports import BatteryStatus, Color, Lights, Power, TimeZone
from ai_robot.ports.image import check_color

OFF: Color = (0, 0, 0)

CHARGING_SCENE = "charging"

# A BCP 47 tag's form, as the protocols take it (ai-platform's schemas, $defs/language).
LANGUAGE_TAG = re.compile(r"^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$")
LANGUAGES_SETTING = "system.languages"
TIME_ZONE_SETTING = "system.time_zone"


def _orders(tags: Sequence[str]) -> list[tuple[str, ...]]:
    """Every order of every set of ``tags``: what the owner can choose."""
    return [
        order for count in range(1, len(tags) + 1) for order in itertools.permutations(tags, count)
    ]


def _joined(languages: Sequence[str]) -> str:
    """The languages setting's value: the tags in order, joined by commas."""
    return ",".join(languages)


class SystemModule(Module):
    """Looks after the robot itself: battery reports, with whether the battery is low,
    the status light, and the robot's locale.

    It also shows the charging scene for ``charging_scene_seconds`` when the robot is
    plugged in:
    on a change from not charging to charging, not merely on a report that says
    charging (the robot may start on its charger), and an unknown reading changes
    nothing.

    **The locale** (ai-platform ADR-0002): the robot's languages, in the owner's order,
    and its time zone, the system's. It tells both (``LocaleChanged``) once the owner's
    choices are applied, and whenever they change.

    - **Languages** are a setting (docs/decisions/0016): any order of any of the
      languages in ``language_names``, which also gives their names on the panel.
      ``languages`` is the order as shipped.
    - **The time zone** shows on the panel. The app sets it at set-up, with the
      languages (``LocaleRequested``): the robot keeps the languages asked for that it
      supports, in their order, a region falling back to its language (``en-GB`` to
      ``en``), or its own if it supports none; and a time zone it cannot take changes
      nothing.

    Planned: a clean shutdown on low battery (hardware/README.md, open issue 6), the
    Pi's temperature and throttling.
    """

    owns = ("power", "lights", "time_zone")

    def __init__(
        self,
        ctx: ModuleContext,
        *,
        battery_interval: float,
        charging_scene_seconds: float,
        ready_color: list[int],
        low_battery_percent: float,
        language_names: Mapping[str, str],
        languages: list[str],
    ) -> None:
        super().__init__(ctx)
        self.battery_interval = positive("battery_interval", battery_interval)
        self.charging_scene_seconds = positive("charging_scene_seconds", charging_scene_seconds)
        self.ready_color = check_color(ready_color)  # the status light while the robot runs
        self.low_battery = within("low_battery_percent", low_battery_percent, 0, 100)
        self.language_names = self._check_names(language_names)
        self.languages = self._check_languages(languages)
        self.power = self.port("power", Power)
        self.lights = self.port("lights", Lights)
        self.time_zone = self.port("time_zone", TimeZone)
        self.zone: str | None = None  # the time zone, once read
        self._charging: bool | None = None  # the last known charging state
        self._requests = self.bus.subscribe(LocaleRequested)
        self.settings = SettingsHost(self)
        choices = [
            {
                "const": _joined(order),
                "title": ", then ".join(self.language_names[t] for t in order),
            }
            for order in _orders(list(self.language_names))
        ]
        self.settings.add(
            Setting(
                LANGUAGES_SETTING,
                SettingKind.VALUE,
                SettingSection.LOCALE,
                "Languages",
                _joined(self.languages),
                schema={"oneOf": choices},
                help="It shows the first, and understands each",
            ),
            self._set_languages,
        )

    async def start(self) -> None:
        await self.lights.fill(self.ready_color)
        self.zone = await self.time_zone.current()
        info = Setting(
            TIME_ZONE_SETTING, SettingKind.INFO, SettingSection.LOCALE, "Time zone", self.zone
        )
        self.settings.add(info)
        self.settings.offer()

    async def run(self) -> None:
        await self.settings.apply_pending()  # the owner's languages, before anyone hears them
        self._tell_locale()
        async with asyncio.TaskGroup() as tasks:
            tasks.create_task(self._watch_battery())
            tasks.create_task(self._serve_requests())
            tasks.create_task(self.settings.serve())

    async def stop(self) -> None:
        self._requests.close()
        self.settings.close()
        await self.lights.fill(OFF)

    # ---- health ----

    async def _watch_battery(self) -> None:
        while True:
            status = await self.power.battery()
            self.bus.publish(BatteryReport(status, self.is_low(status)))
            self._watch_charger(status.charging)
            await asyncio.sleep(self.battery_interval)

    def is_low(self, status: BatteryStatus) -> bool | None:
        """Whether the battery is low: at or below ``low_battery_percent`` and not
        charging. ``None`` when the charge is unknown."""
        if status.percent is None:
            return None
        return status.percent <= self.low_battery and status.charging is not True

    def _watch_charger(self, charging: bool | None) -> None:
        if charging is None:
            return
        if charging and self._charging is False:
            self.bus.publish(
                SceneRequest(self.name, CHARGING_SCENE, duration=self.charging_scene_seconds)
            )
        elif not charging and self._charging:
            self.bus.publish(SceneRequest(self.name, None))
        self._charging = charging

    # ---- the locale ----

    async def _set_languages(self, value: str) -> None:
        self.languages = tuple(value.split(","))  # one of the setting's choices
        self._tell_locale()

    async def _serve_requests(self) -> None:
        async for request in self._requests:
            await self._on_request(request)

    async def _on_request(self, request: LocaleRequested) -> None:
        assert self.zone is not None
        if request.time_zone is not None and request.time_zone != self.zone:
            try:
                await self.time_zone.set(request.time_zone)
            except (ValueError, OSError) as error:
                self.log.warning("cannot take the time zone %r: %s", request.time_zone, error)
                self.bus.publish(
                    LocaleApplied(
                        request.request, self.languages, self.zone, "time_zone", str(error)
                    )
                )
                return
            self.zone = request.time_zone
            self.settings.update(TIME_ZONE_SETTING, self.zone)
            self.log.info("the time zone is now %s", self.zone)
            self._tell_locale()
        languages = self.languages
        if request.languages is not None:
            supported = (self._supported(tag) for tag in request.languages)
            kept = tuple(dict.fromkeys(tag for tag in supported if tag is not None))
            if kept and kept != self.languages:
                languages = kept
                # Kept and applied as the owner's choice, as one made on the panel is.
                self.bus.publish(SettingRequested(LANGUAGES_SETTING, _joined(kept)))
        self.bus.publish(LocaleApplied(request.request, languages, self.zone))

    def _supported(self, tag: str) -> str | None:
        """The language the robot supports for ``tag``: the tag itself, or the language
        its region falls back to (RFC 4647, §3.4), whatever their case."""
        parts = tag.lower().split("-")
        while parts:
            wanted = "-".join(parts)
            for known in self.language_names:
                if known.lower() == wanted:
                    return known
            parts.pop()
        return None

    def _tell_locale(self) -> None:
        if self.zone is not None:
            self.bus.publish(LocaleChanged(self.languages, self.zone))

    # ---- checks ----

    @staticmethod
    def _check_names(names: Mapping[str, str]) -> dict[str, str]:
        if not names:
            raise ValueError("language_names must name at least one language")
        for tag, name in names.items():
            if not LANGUAGE_TAG.match(tag) or not isinstance(name, str) or not name:
                raise ValueError(f"language_names: {tag!r} = {name!r} is not a tag and its name")
        return dict(names)

    def _check_languages(self, languages: list[str]) -> tuple[str, ...]:
        unknown = [tag for tag in languages if tag not in self.language_names]
        if not languages or unknown or len(set(languages)) != len(languages):
            raise ValueError(
                f"languages must be one or more of {', '.join(self.language_names)}, "
                f"each once, got {languages!r}"
            )
        return tuple(languages)
