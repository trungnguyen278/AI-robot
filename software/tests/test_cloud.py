# SPDX-License-Identifier: MIT
"""The cloud module: capabilities offered by modules, calls, events and the link's status,
tested with the simulated cloud."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Mapping
from typing import Any

import pytest

from ai_robot.adapters.sim.cloud import SimCloud
from ai_robot.adapters.sim.screen import SimScreen
from ai_robot.core.bus import Bus
from ai_robot.core.capabilities import CapabilityHost
from ai_robot.core.config import ConfigError
from ai_robot.core.factory import create
from ai_robot.core.module import Module, ModuleContext, RobotInfo
from ai_robot.messages import (
    CapabilityCall,
    CapabilityCancelled,
    CapabilityOffered,
    CapabilityWithdrawn,
    CloudStatus,
    RobotEvent,
)
from ai_robot.modules.cloud import CloudModule
from ai_robot.modules.screen import ScreenModule, capabilities, load_vocabulary
from ai_robot.ports import Capability, EventKind, SafetyClass

TIMEOUT = 2.0

SWITCH = {
    "type": "object",
    "properties": {"on": {"type": "boolean"}},
    "required": ["on"],
    "additionalProperties": False,
}


def context(name: str, bus: Bus, ports: Mapping[str, Any]) -> ModuleContext:
    return ModuleContext(
        name=name,
        bus=bus,
        ports=dict(ports),
        robot=RobotInfo(display_name="Robot"),
        log=logging.getLogger(f"test.{name}"),
    )


class Lamp(Module):
    """A module with capabilities and an event, whose behaviour the tests choose."""

    def __init__(self, ctx: ModuleContext) -> None:
        super().__init__(ctx)
        self.host = CapabilityHost(self)
        self.calls: list[dict[str, Any]] = []
        self.behaviour = "ok"
        self.host.add(
            Capability(
                "lamp.set",
                "Turn the lamp on or off",
                SWITCH,
                SafetyClass.INFORMATIONAL,
                output_schema=SWITCH,
            ),
            self.set,
        )
        self.host.add(
            Capability("lamp.move", "Move the lamp", {"type": "object"}, SafetyClass.PHYSICAL),
            self.set,
        )
        self.host.add_event(EventKind("lamp.changed", "The lamp changed", SWITCH))

    async def start(self) -> None:
        self.host.offer()

    async def run(self) -> None:
        await self.host.serve()

    async def stop(self) -> None:
        self.host.close()

    async def set(self, arguments: Mapping[str, Any]) -> Mapping[str, Any]:
        self.calls.append(dict(arguments))
        if self.behaviour == "refuse":
            raise ValueError("too bright")
        if self.behaviour == "crash":
            raise RuntimeError("a bug")
        if self.behaviour == "bad":
            return {"on": "yes"}
        if self.behaviour == "slow":
            await asyncio.Event().wait()
        return {"on": arguments.get("on", False)}


def cloud_module(bus: Bus, cloud: SimCloud, timeout: float = TIMEOUT) -> CloudModule:
    return CloudModule(
        context("cloud", bus, {"cloud": cloud}),
        allowed_classes=["informational"],
        call_timeout=timeout,
    )


@contextlib.asynccontextmanager
async def running(*modules: Module) -> AsyncIterator[None]:
    for module in modules:
        await module.start()
    tasks = [asyncio.create_task(module.run()) for module in modules]
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        for module in reversed(modules):
            await module.stop()


async def until(condition: Any, timeout: float = TIMEOUT) -> None:
    async with asyncio.timeout(timeout):
        while not condition():
            await asyncio.sleep(0.01)


def lamp_robot(timeout: float = TIMEOUT) -> tuple[Bus, SimCloud, Lamp, CloudModule]:
    bus = Bus()
    cloud = SimCloud()
    lamp = Lamp(context("lamp", bus, {}))
    return bus, cloud, lamp, cloud_module(bus, cloud, timeout)


def test_the_cloud_sees_the_capabilities_its_owner_allows() -> None:
    async def main() -> None:
        bus, cloud, lamp, module = lamp_robot()
        statuses = bus.subscribe(CloudStatus)
        async with running(lamp, module):
            await until(lambda: cloud.online)
            assert list(cloud.capabilities) == ["lamp.set"]  # lamp.move is physical
            assert list(cloud.event_kinds) == ["lamp.changed"]
            assert await asyncio.wait_for(statuses.get(), TIMEOUT) == CloudStatus(True)

    asyncio.run(main())


def test_a_call_runs_on_its_owner_and_returns_its_data() -> None:
    async def main() -> None:
        _, cloud, lamp, module = lamp_robot()
        async with running(lamp, module):
            await until(lambda: cloud.online)
            assert await cloud.call("lamp.set", {"on": True}) == ({"on": True}, None)
            assert lamp.calls == [{"on": True}]

    asyncio.run(main())


def test_arguments_are_checked_before_the_owner_sees_them() -> None:
    async def main() -> None:
        bus, cloud, lamp, module = lamp_robot()
        calls = bus.subscribe(CapabilityCall)
        async with running(lamp, module):
            await until(lambda: cloud.online)
            data, error = await cloud.call("lamp.set", {"on": "yes"})
            assert data is None
            assert error == "invalid arguments: on: 'yes' is not of type 'boolean'"
            assert (await cloud.call("lamp.set", {"on": True, "colour": "red"}))[1] is not None
            assert lamp.calls == [] and calls.pending == 0

    asyncio.run(main())


@pytest.mark.parametrize(
    ("behaviour", "error"),
    [("refuse", "too bright"), ("crash", "internal error"), ("bad", "internal error")],
)
def test_failures_of_the_owner_reach_the_cloud(
    behaviour: str, error: str, caplog: pytest.LogCaptureFixture
) -> None:
    async def main() -> None:
        _, cloud, lamp, module = lamp_robot()
        lamp.behaviour = behaviour
        async with running(lamp, module):
            await until(lambda: cloud.online)
            assert await cloud.call("lamp.set", {"on": True}) == (None, error)
            # The module keeps serving after a failure.
            lamp.behaviour = "ok"
            assert await cloud.call("lamp.set", {"on": False}) == ({"on": False}, None)

    with caplog.at_level(logging.ERROR):
        asyncio.run(main())
    if behaviour == "crash":
        assert "capability lamp.set failed" in caplog.text
    if behaviour == "bad":
        assert "lamp.set returned data that breaks its schema" in caplog.text


def test_a_capability_that_does_not_answer_times_out() -> None:
    async def main() -> None:
        _, cloud, lamp, module = lamp_robot(timeout=0.1)
        lamp.behaviour = "slow"
        async with running(lamp, module):
            await until(lambda: cloud.online)
            assert await cloud.call("lamp.set", {"on": True}) == (
                None,
                "lamp.set did not answer within 0.1 s",
            )

    asyncio.run(main())


def test_a_cancelled_call_gets_no_answer() -> None:
    async def main() -> None:
        bus, cloud, lamp, module = lamp_robot()
        lamp.behaviour = "slow"
        cancellations = bus.subscribe(CapabilityCancelled)
        async with running(lamp, module):
            await until(lambda: cloud.online)
            call = cloud.begin("lamp.set", {"on": True})
            await until(lambda: lamp.calls)
            cloud.cancel(call)
            cancelled = await asyncio.wait_for(cancellations.get(), TIMEOUT)
            assert cancelled == CapabilityCancelled(call.id)
            assert module._calls == {}

    asyncio.run(main())


def test_events_reach_the_cloud_when_declared_and_valid(caplog: pytest.LogCaptureFixture) -> None:
    async def main() -> None:
        bus, cloud, lamp, module = lamp_robot()
        async with running(lamp, module):
            await until(lambda: cloud.online)
            lamp.host.emit("lamp.changed", {"on": True})
            bus.publish(RobotEvent("lamp.changed", {"on": "yes"}))  # breaks its schema
            bus.publish(RobotEvent("lamp.broken", {}))  # never offered
            await until(lambda: len(cloud.events) == 1)
            await asyncio.sleep(0.05)
            assert list(cloud.events) == [("lamp.changed", {"on": True})]
        with pytest.raises(ValueError, match=r"event 'lamp\.moved' was not declared"):
            lamp.host.emit("lamp.moved", {})

    with caplog.at_level(logging.WARNING):
        asyncio.run(main())
    assert "event lamp.changed breaks its schema" in caplog.text
    assert "event lamp.broken was never offered" in caplog.text


def test_the_catalogue_follows_offers_and_withdrawals(caplog: pytest.LogCaptureFixture) -> None:
    async def main() -> None:
        bus, cloud, lamp, module = lamp_robot()
        extra = Capability("lamp.blink", "Blink", {"type": "object"}, SafetyClass.INFORMATIONAL)
        async with running(lamp, module):
            await until(lambda: cloud.online)
            bus.publish(CapabilityOffered("lamp", extra))
            await until(lambda: "lamp.blink" in cloud.capabilities)
            bus.publish(CapabilityOffered("thief", extra))  # someone else's name: refused
            bus.publish(CapabilityWithdrawn("thief", "lamp.blink"))  # not the owner: ignored
            await asyncio.sleep(0.05)
            assert module.capabilities["lamp.blink"].owner == "lamp"
            bus.publish(CapabilityWithdrawn("lamp", "lamp.blink"))
            await until(lambda: "lamp.blink" not in cloud.capabilities)
            assert (await cloud.call("lamp.blink"))[1] == "unknown tool lamp.blink"

    with caplog.at_level(logging.ERROR):
        asyncio.run(main())
    assert "thief offers capability lamp.blink, which lamp already offers" in caplog.text


def test_capabilities_are_checked() -> None:
    assert (
        Capability("lamp.set", "Set", SWITCH, "informational").safety is SafetyClass.INFORMATIONAL
    )  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="version must be a whole number"):
        Capability("lamp.set", "Set", SWITCH, SafetyClass.INFORMATIONAL, version=True)
    with pytest.raises(ValueError, match="capability name must be"):
        Capability("lamp set", "Set", SWITCH, SafetyClass.INFORMATIONAL)
    with pytest.raises(ValueError, match="input_schema must describe an object"):
        Capability("lamp.set", "Set", {"type": "array"}, SafetyClass.INFORMATIONAL)
    with pytest.raises(ValueError, match="is not a valid JSON Schema"):
        Capability(
            "lamp.set", "Set", {"type": "object", "properties": 1}, SafetyClass.INFORMATIONAL
        )
    with pytest.raises(ValueError, match="'flying' is not a valid SafetyClass"):
        Capability("lamp.set", "Set", SWITCH, "flying")  # type: ignore[arg-type]


def test_settings_are_checked() -> None:
    ctx = context("cloud", Bus(), {"cloud": SimCloud()})
    with pytest.raises(ConfigError, match=r"allowed_classes: unknown classes \['flying'\]"):
        create(CloudModule, "modules.cloud", ctx, allowed_classes=["flying"], call_timeout=1.0)
    with pytest.raises(ConfigError, match="call_timeout must be a positive number"):
        create(CloudModule, "modules.cloud", ctx, allowed_classes=[], call_timeout=0)


# ---- the screen's capabilities ----


def screen_robot() -> tuple[SimScreen, SimCloud, ScreenModule, CloudModule]:
    bus = Bus()
    screen = SimScreen()
    cloud = SimCloud()
    module = ScreenModule(context("screen", bus, {"screen": screen}), quiet_db=-50, loud_db=-10)
    return screen, cloud, module, cloud_module(bus, cloud)


def test_the_cloud_can_show_an_expression_a_mood_and_a_scene() -> None:
    async def main() -> None:
        screen, cloud, module, link = screen_robot()
        async with running(module, link):
            await until(lambda: cloud.online)
            assert set(cloud.capabilities) == {
                "screen.show_expression",
                "screen.set_mood",
                "screen.show_scene",
            }
            assert await cloud.call("screen.set_mood", {"expression": "sleepy"}) == (
                {"showing": "sleepy"},
                None,
            )
            reaction = {"expression": "happy", "seconds": 0.5, "tone": "rose"}
            assert await cloud.call("screen.show_expression", reaction) == (
                {"showing": "happy"},
                None,
            )
            assert (screen.state.expression, screen.state.tone) == ("happy", "rose")
            await until(lambda: screen.state.expression == "sleepy")  # the reaction ends
            weather = {"scene": "weather", "data": {"condition": "rain", "temperature": 18}}
            assert await cloud.call("screen.show_scene", weather) == ({"showing": "weather"}, None)
            assert dict(screen.state.scene_data) == {"condition": "rain", "temperature": 18}
            assert await cloud.call("screen.show_scene", {"scene": None}) == (
                {"showing": None},
                None,
            )
            assert await cloud.call("screen.set_mood", {"expression": None}) == (
                {"showing": "neutral"},
                None,
            )

    asyncio.run(main())


def test_the_screens_capabilities_follow_the_vocabulary() -> None:
    vocabulary = load_vocabulary()
    show, mood, scene = capabilities(vocabulary)
    expression = show.input_schema["properties"]["expression"]
    assert list(expression["enum"]) == list(vocabulary["expressions"])
    assert list(show.input_schema["properties"]["tone"]["enum"]) == vocabulary["tones"]
    assert list(mood.input_schema["properties"]["expression"]["enum"])[-1] is None
    assert list(scene.input_schema["properties"]["scene"]["enum"]) == [
        *vocabulary["scenes"],
        None,
    ]
    timer = next(
        branch["then"]["properties"]["data"]
        for branch in scene.input_schema["allOf"]
        if branch["if"]["properties"]["scene"]["const"] == "timer"
    )
    assert timer["properties"]["label"]["maxLength"] == 16


def test_scene_data_the_renderer_cannot_draw_is_refused() -> None:
    async def main() -> None:
        screen, cloud, module, link = screen_robot()
        async with running(module, link):
            await until(lambda: cloud.online)
            sunny = {"scene": "weather", "data": {"condition": "sunny"}}
            data, error = await cloud.call("screen.show_scene", sunny)
            assert data is None and error is not None
            assert error.startswith("invalid arguments: data.condition: 'sunny' is not one of")
            long = {"scene": "timer", "data": {"label": "x" * 17}}
            assert (await cloud.call("screen.show_scene", long))[1] is not None
            assert screen.state.scene is None

    asyncio.run(main())


def test_a_tap_reaches_the_cloud() -> None:
    async def main() -> None:
        screen, cloud, module, link = screen_robot()
        async with running(module, link):
            await until(lambda: cloud.online)
            screen.tap(0.5, 0.25)
            await until(lambda: cloud.events)
            assert list(cloud.events) == [("screen.touched", {"x": 0.5, "y": 0.25})]

    asyncio.run(main())
