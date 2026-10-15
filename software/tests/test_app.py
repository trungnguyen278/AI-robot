# SPDX-License-Identifier: MIT
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest

from ai_robot.adapters import ADAPTERS
from ai_robot.app import App, ModuleError
from ai_robot.core.config import ConfigError, load_config
from ai_robot.core.module import Module, ModuleContext
from ai_robot.messages import BatteryReport, SoundLevel
from ai_robot.modules import MODULES
from ai_robot.ports import Color, Lights


def run(app: App, seconds: float) -> None:
    """Run ``app`` for ``seconds``, or until it fails."""

    async def main() -> None:
        stop = asyncio.Event()
        asyncio.get_running_loop().call_later(seconds, stop.set)
        await app.run(stop)

    asyncio.run(main())


class RecordingLights(Lights):
    def __init__(self, *, events: list[str]) -> None:
        self.events = events

    async def open(self) -> None:
        self.events.append("open lights")

    async def close(self) -> None:
        self.events.append("close lights")

    async def fill(self, color: Color) -> None:
        pass


class Recorder(Module):
    """Records its lifecycle, and fails where asked to."""

    def __init__(self, ctx: ModuleContext, *, events: list[str], fail_in: str = "") -> None:
        super().__init__(ctx)
        self.events = events
        self.fail_in = fail_in

    async def start(self) -> None:
        self.events.append(f"start {self.name}")
        if self.fail_in == "start":
            raise RuntimeError("start failed")

    async def run(self) -> None:
        self.events.append(f"run {self.name}")
        if self.fail_in == "run":
            raise RuntimeError("run failed")
        await super().run()

    async def stop(self) -> None:
        self.events.append(f"stop {self.name}")


class LightsRecorder(Recorder):
    owns = ("lights",)


@pytest.fixture
def events(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    monkeypatch.setitem(MODULES, "first", LightsRecorder)
    monkeypatch.setitem(MODULES, "second", Recorder)
    monkeypatch.setitem(ADAPTERS["lights"], "recording", RecordingLights)
    return []


def config(events: list[str], enabled: list[str], **settings: dict[str, Any]) -> dict[str, Any]:
    tables = {name: {"events": events, **settings.get(name, {})} for name in enabled}
    return {
        "modules": {"enabled": enabled, **tables},
        "ports": {"lights": {"adapter": "recording", "events": events}},
    }


def test_lifecycle_order(events: list[str]) -> None:
    run(App(config(events, ["first", "second"])), 0.05)
    assert events == [
        "open lights",
        "start first",
        "start second",
        "run first",
        "run second",
        "stop second",
        "stop first",
        "close lights",
    ]


def test_a_failing_module_stops_the_robot(events: list[str]) -> None:
    app = App(config(events, ["first", "second"], second={"fail_in": "run"}))
    with pytest.raises(ModuleError, match="'second' failed") as caught:
        run(app, 10)
    assert isinstance(caught.value.__cause__, RuntimeError)
    assert events[-3:] == ["stop second", "stop first", "close lights"]


def test_a_module_failing_to_start_stops_the_ones_already_started(events: list[str]) -> None:
    app = App(config(events, ["first", "second"], second={"fail_in": "start"}))
    with pytest.raises(ModuleError, match="'second' failed to start"):
        run(app, 10)
    assert events == ["open lights", "start first", "start second", "stop first", "close lights"]


def test_ports_nobody_owns_get_no_adapter(events: list[str]) -> None:
    app = App(config(events, ["second"]))
    app.build()
    assert app.adapters == {}


def test_two_modules_cannot_own_the_same_port(
    events: list[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(MODULES, "other", LightsRecorder)
    with pytest.raises(ConfigError, match="'lights' is claimed by both 'first' and 'other'"):
        App(config(events, ["first", "other"])).build()


def test_an_owned_port_must_be_configured(events: list[str]) -> None:
    table = config(events, ["first"])
    del table["ports"]["lights"]
    with pytest.raises(ConfigError, match=r"\[ports\.lights\] is missing"):
        App(table).build()


def test_unknown_module(events: list[str]) -> None:
    with pytest.raises(ConfigError, match="unknown module 'third'"):
        App(config(events, ["third"])).build()


def test_unknown_adapter(events: list[str]) -> None:
    table = config(events, ["first"])
    table["ports"]["lights"]["adapter"] = "laser"
    with pytest.raises(ConfigError, match=r"ports\.lights\.adapter"):
        App(table).build()


def test_misspelt_setting(events: list[str]) -> None:
    with pytest.raises(ConfigError, match=r"modules\.second: .*'fail_inn'"):
        App(config(events, ["second"], second={"fail_inn": "run"})).build()


def test_invalid_setting_value(shipped_config: Path) -> None:
    table = load_config("desktop", shipped_config)
    table["modules"]["system"]["battery_interval"] = 0
    with pytest.raises(ConfigError, match=r"modules\.system: battery_interval must be positive"):
        App(table).build()


def test_desktop_profile(shipped_config: Path) -> None:
    app = App(load_config("desktop", shipped_config))
    app.build()
    levels = app.bus.subscribe(SoundLevel)
    batteries = app.bus.subscribe(BatteryReport)
    run(app, 0.3)
    display: Any = app.adapters["display"]
    lights: Any = app.adapters["lights"]
    assert display.frames_shown >= 1
    assert lights.color == (0, 0, 0)  # switched off when stopping
    assert levels.pending > 0
    assert batteries.pending > 0
