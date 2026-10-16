# SPDX-License-Identifier: MIT
from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

import ai_robot.app
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


def run_until(app: App, done: Callable[[], bool], timeout: float = 10.0) -> None:
    """Run ``app`` until ``done()`` is true, failing after ``timeout`` seconds."""

    async def main() -> None:
        stop = asyncio.Event()

        async def watch() -> None:
            began = time.monotonic()
            while not done():
                assert time.monotonic() - began < timeout, "the robot did not get going"
                await asyncio.sleep(0.01)
            stop.set()

        watcher = asyncio.create_task(watch())
        await app.run(stop)
        await watcher

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
    """Records its lifecycle, and misbehaves where ``fail_in`` says."""

    def __init__(self, ctx: ModuleContext, *, events: list[str], fail_in: str = "") -> None:
        super().__init__(ctx)
        self.events = events
        self.fail_in = fail_in

    async def start(self) -> None:
        self.events.append(f"start {self.name}")
        if self.fail_in == "start":
            raise RuntimeError("start failed")
        if self.fail_in == "slow start":
            await asyncio.sleep(10)

    async def run(self) -> None:
        self.events.append(f"run {self.name}")
        if self.fail_in == "run":
            raise RuntimeError("run failed")
        try:
            await super().run()
        except asyncio.CancelledError:
            if self.fail_in == "cancel":
                raise OSError("failed while stopping") from None
            if self.fail_in == "ignore cancel":
                await asyncio.sleep(1)  # a bug: goes on after being cancelled
            raise

    async def stop(self) -> None:
        self.events.append(f"stop {self.name}")
        if self.fail_in == "slow stop":
            await asyncio.sleep(10)


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
    with pytest.raises(ConfigError, match=r"modules\.system: battery_interval must be a positive"):
        App(table).build()


def test_hardware_settings_have_no_defaults_in_code(shipped_config: Path) -> None:
    table = load_config("desktop", shipped_config)
    del table["ports"]["camera"]["width"]
    with pytest.raises(ConfigError, match=r"ports\.camera \(sim\): missing .*'width'"):
        App(table).build()


def test_desktop_profile(shipped_config: Path) -> None:
    table = load_config("desktop", shipped_config)
    table["ports"]["screen"]["web"]["port"] = 0  # any free port
    app = App(table)
    app.build()
    levels = app.bus.subscribe(SoundLevel)
    batteries = app.bus.subscribe(BatteryReport)
    screen: Any = app.adapters["screen"]
    lights: Any = app.adapters["lights"]

    def going() -> bool:
        """Every module at work: sound, battery reports, and the battery on screen."""
        shown = screen.state is not None and screen.state.battery is not None
        return shown and levels.pending > 0 and batteries.pending > 0

    run_until(app, going)
    assert screen.state.expression == "neutral"
    assert lights.color == (0, 0, 0)  # switched off when stopping


def test_stopping_during_startup(events: list[str]) -> None:
    app = App(config(events, ["first", "second"], second={"fail_in": "slow start"}))
    began = time.monotonic()
    run(app, 0.05)
    assert time.monotonic() - began < 1
    assert events == ["open lights", "start first", "start second", "stop first", "close lights"]


@pytest.fixture
def short_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ai_robot.app, "CLEANUP_TIMEOUT", 0.1)


@pytest.mark.usefixtures("short_timeout")
def test_a_module_ignoring_cancellation_does_not_block_the_shutdown(
    events: list[str], caplog: pytest.LogCaptureFixture
) -> None:
    run(App(config(events, ["first", "second"], second={"fail_in": "ignore cancel"})), 0.05)
    assert events[-3:] == ["stop second", "stop first", "close lights"]
    assert "module second did not stop" in caplog.text


@pytest.mark.usefixtures("short_timeout")
def test_a_slow_stop_does_not_block_the_shutdown(
    events: list[str], caplog: pytest.LogCaptureFixture
) -> None:
    run(App(config(events, ["first", "second"], second={"fail_in": "slow stop"})), 0.05)
    assert events[-2:] == ["stop first", "close lights"]
    assert "stopping module 'second' took more than" in caplog.text


def test_errors_while_stopping_are_logged(
    events: list[str], caplog: pytest.LogCaptureFixture
) -> None:
    run(App(config(events, ["first", "second"], second={"fail_in": "cancel"})), 0.05)
    assert "module second failed while stopping" in caplog.text
    assert events[-1] == "close lights"


def test_simultaneous_failures_are_all_reported(
    events: list[str], caplog: pytest.LogCaptureFixture
) -> None:
    both = {"fail_in": "run"}
    app = App(config(events, ["first", "second"], first=both, second=both))
    with pytest.raises(ModuleError):
        run(app, 10)
    assert "also failed" in caplog.text


def test_an_app_runs_only_once(events: list[str]) -> None:
    app = App(config(events, ["second"]))
    run(app, 0.01)
    with pytest.raises(RuntimeError, match="runs only once"):
        run(app, 0.01)
