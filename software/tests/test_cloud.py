# SPDX-License-Identifier: MIT
"""The cloud module: capabilities offered by modules, calls, events and the link's status,
tested with the simulated cloud."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import math
from collections.abc import AsyncIterator, Mapping
from typing import Any

import pytest

from ai_robot.adapters.sim.cloud import SimCloud
from ai_robot.adapters.sim.identity import SimIdentity
from ai_robot.adapters.sim.screen import SimScreen
from ai_robot.core.bus import Bus
from ai_robot.core.capabilities import CapabilityHost
from ai_robot.core.config import ConfigError
from ai_robot.core.factory import create
from ai_robot.core.module import Module, ModuleContext, RobotInfo
from ai_robot.messages import (
    BatteryReport,
    CapabilityCall,
    CapabilityCancelled,
    CapabilityOffered,
    CapabilityWithdrawn,
    CloudStatus,
    ConversationFromCloud,
    ConversationOffered,
    ConversationToCloud,
    RobotEvent,
)
from ai_robot.modules.cloud import CloudModule
from ai_robot.modules.screen import ScreenModule, capabilities, load_vocabulary
from ai_robot.ports import (
    AudioFormat,
    BatteryStatus,
    Capability,
    ConversationAudio,
    EventKind,
    ResponseEnd,
    ResponseStart,
    SafetyClass,
    Speech,
    SpeechEnd,
    Trigger,
    TurnStart,
    Voice,
)

TIMEOUT = 2.0

# The screen module's settings, as shipped in config/base.toml.
SCREEN = {
    "voice_rate": 25.0,
    "reaction_seconds": 3.0,
    "reaction_max_seconds": 30.0,
    "scene_max_seconds": 86400.0,
}

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
        context("cloud", bus, {"cloud": cloud, "identity": SimIdentity()}),
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


# The audio of the module that holds conversations: 16 kHz mono, both ways.
AUDIO = ConversationAudio(AudioFormat(16000, 1), AudioFormat(16000, 1))


class Talker(Module):
    """A module that holds conversations, as voice does."""

    async def start(self) -> None:
        self.bus.publish(ConversationOffered(self.name, AUDIO))


def talking_robot() -> tuple[Bus, SimCloud, Talker, CloudModule]:
    bus = Bus()
    cloud = SimCloud()
    return bus, cloud, Talker(context("voice", bus, {})), cloud_module(bus, cloud)


def test_the_link_offers_conversations_once_a_module_holds_them(
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def main() -> None:
        bus, cloud, talker, module = talking_robot()
        statuses = bus.subscribe(CloudStatus)
        async with running(talker, module):
            await until(lambda: cloud.online)
            assert cloud.conversing
            status = await asyncio.wait_for(statuses.get(), TIMEOUT)
            assert status == CloudStatus(True, conversations=True)
            bus.publish(ConversationOffered("rival", AUDIO))
            await until(lambda: "rival offers to hold conversations" in caplog.text)
            assert module.conversing is not None
            assert module.conversing.owner == "voice"

    with caplog.at_level(logging.ERROR):
        asyncio.run(main())


def test_the_robots_part_reaches_the_cloud_in_order_with_its_context() -> None:
    async def main() -> None:
        bus, cloud, talker, module = talking_robot()
        async with running(talker, module):
            await until(lambda: cloud.online)
            bus.publish(ConversationToCloud(TurnStart("t1", Trigger.WAKE_WORD)))
            await until(lambda: cloud.heard)
            assert cloud.heard[0].context == {"battery": None, "charging": None}  # type: ignore[union-attr]
            bus.publish(BatteryReport(BatteryStatus(voltage=7.4, percent=63.0, charging=True)))
            await until(lambda: module.battery is not None)
            # Published at once, more than a bus queue holds by default: none is lost.
            parts = [
                TurnStart("t2", Trigger.TAP),
                *(Speech("t2", bytes([n % 256]) * 640) for n in range(300)),
                SpeechEnd("t2"),
            ]
            for part in parts:
                bus.publish(ConversationToCloud(part))
            await until(lambda: len(cloud.heard) == 1 + len(parts))
            assert list(cloud.heard)[1:] == [
                TurnStart("t2", Trigger.TAP, {"battery": 63.0, "charging": True}),
                *parts[1:],
            ]

    asyncio.run(main())


@pytest.mark.parametrize(
    ("percent", "sent"),
    [(63.0, 63.0), (104.0, 100.0), (-2.0, 0.0), (math.nan, None), (None, None)],
)
def test_the_battery_in_the_context_is_always_valid(
    percent: float | None, sent: float | None
) -> None:
    _, _, _, module = talking_robot()
    module.battery = BatteryStatus(voltage=7.4, percent=percent, charging=False)
    assert module._context() == {"battery": sent, "charging": False}


def test_the_clouds_part_reaches_the_robot_in_order() -> None:
    async def main() -> None:
        bus, cloud, talker, module = talking_robot()
        heard = bus.subscribe(ConversationFromCloud, maxsize=10)
        received: list[Any] = []

        async def read() -> None:  # as the voice module reads them: one task, at once
            async for message in heard:
                received.append(message.part)

        async with running(talker, module):
            await until(lambda: cloud.online)
            reader = asyncio.create_task(read())
            # Many parts at once, far more than the queue holds: none is lost.
            answer = [
                ResponseStart("a1", None),
                *(Voice(bytes([n % 256]) * 640) for n in range(500)),
                ResponseEnd("a1", follow_up=False),
            ]
            cloud.say(*answer)
            await until(lambda: len(received) == len(answer))
            reader.cancel()
            assert received == answer
            assert heard.dropped == 0

    asyncio.run(main())


def test_settings_are_checked() -> None:
    ctx = context("cloud", Bus(), {"cloud": SimCloud(), "identity": SimIdentity()})
    with pytest.raises(ConfigError, match=r"allowed_classes: unknown classes \['flying'\]"):
        create(CloudModule, "modules.cloud", ctx, allowed_classes=["flying"], call_timeout=1.0)
    with pytest.raises(ConfigError, match="call_timeout must be a positive number"):
        create(CloudModule, "modules.cloud", ctx, allowed_classes=[], call_timeout=0)


# ---- the screen's capabilities ----


def screen_robot() -> tuple[SimScreen, SimCloud, ScreenModule, CloudModule]:
    bus = Bus()
    screen = SimScreen()
    cloud = SimCloud()
    module = ScreenModule(
        context("screen", bus, {"screen": screen}), quiet_db=-50, loud_db=-10, **SCREEN
    )
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
    limits = {key: SCREEN[key] for key in SCREEN if key != "voice_rate"}
    show, mood, scene = capabilities(vocabulary, **limits)
    assert show.input_schema["properties"]["seconds"]["maximum"] == 30.0
    assert scene.input_schema["properties"]["seconds"]["maximum"] == 86400.0
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
