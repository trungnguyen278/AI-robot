# SPDX-License-Identifier: MIT
"""The setup module: when set-up opens and closes, the code on the screen, and a whole
session with an app, played through the simulated link."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections.abc import AsyncIterator, Mapping
from typing import Any, TypeVar

import jwt
import pytest

from ai_robot.adapters.sim.binding import SimBindingStore
from ai_robot.adapters.sim.cloud import SimCloud
from ai_robot.adapters.sim.identity import SimIdentity
from ai_robot.adapters.sim.network import ADDRESS, SimNetwork
from ai_robot.adapters.sim.setup import SimSetupLink
from ai_robot.core.bus import Bus, Message, Subscription
from ai_robot.core.config import ConfigError, protocol_dir
from ai_robot.core.factory import create
from ai_robot.core.module import ModuleContext, RobotInfo
from ai_robot.core.setup_session import AppSession
from ai_robot.core.spake2plus import ExchangeError
from ai_robot.messages import (
    BindingChanged,
    RegistrationRequested,
    RegistrationSigned,
    SceneRequest,
    ScreenPriority,
    ScreenTouched,
)
from ai_robot.modules.cloud import CloudModule
from ai_robot.modules.setup import LINK_LENGTH, SCENE, SetupModule
from ai_robot.ports import Binding

TIMEOUT = 5.0
M = TypeVar("M", bound=Message)
ROBOT = "6f1c2a9e-0d55-4c4b-9a43-1f0e8b2d7c11"
NAME = "Robot"
REGISTRATION = "eyJhbGciOiJFUzI1NiJ9.eyJub25jZSI6IngifQ.c2lnbmF0dXJl"
NETWORKS = [
    {"ssid": "Home", "security": "wpa2", "signal": 80, "password": "correct horse"},
    {"ssid": "Office", "security": "other", "signal": 60},
    {"ssid": "Café", "security": "open", "signal": 40},
]

# The module's settings as shipped, but with short times.
SETTINGS: dict[str, Any] = {
    "window": 30.0,
    "attempts": 3,
    "idle": 30.0,
    "join_timeout": 5.0,
    "bind_timeout": 30.0,
    "link": "{setup}",
}


class Robot:
    """The module, its ports and the bus, and the cloud's part of set-up."""

    def __init__(self, **settings: Any) -> None:
        self.bus = Bus()
        self.link = SimSetupLink()
        self.network = SimNetwork(networks=NETWORKS)
        ctx = ModuleContext(
            name="setup",
            bus=self.bus,
            ports={"setup_link": self.link, "network": self.network},
            robot=RobotInfo(display_name=NAME),
            log=logging.getLogger("test"),
        )
        self.module = SetupModule(ctx, **{**SETTINGS, **settings})
        self.scenes = self.bus.subscribe(SceneRequest)
        self.requests = self.bus.subscribe(RegistrationRequested)
        self.signature: RegistrationSigned | None = None  # what the cloud answers, if anything

    def bind(self, bound: bool) -> None:
        self.bus.publish(BindingChanged(ROBOT, bound))

    async def scene(self) -> Mapping[str, Any] | None:
        """The data of the set-up scene the module asks for next; None when it withdraws."""
        request = await next_of(self.scenes)
        assert request.source == "setup"
        if request.scene is None:
            return None
        assert (request.scene, request.priority) == (SCENE, ScreenPriority.ALERT)
        return request.data

    async def code_shown(self) -> Mapping[str, Any]:
        """The next set-up scene that shows a code."""
        return await self.until("code")

    async def until(self, state: str | None) -> Mapping[str, Any] | None:
        """The next set-up scene in ``state``; None: the next withdrawal."""
        while True:
            data = await self.scene()
            if (data and data["state"]) == state or (data is None and state is None):
                return data

    async def cloud(self) -> None:
        """Sign each registration, as the cloud module does."""
        while True:
            request = await self.requests.get()
            if self.signature is not None:
                self.bus.publish(self.signature)
            else:
                self.bus.publish(RegistrationSigned(request.request, REGISTRATION))


async def next_of(subscription: Subscription[M]) -> M:
    return await asyncio.wait_for(subscription.get(), TIMEOUT)


@contextlib.asynccontextmanager
async def running(robot: Robot) -> AsyncIterator[None]:
    await robot.module.start()
    tasks = [asyncio.create_task(robot.module.run()), asyncio.create_task(robot.cloud())]
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        await robot.module.stop()


class App:
    """An app on the simulated link: connects, runs the exchange with the code it read
    on the screen, and sends requests."""

    def __init__(self, robot: Robot, peer: str = "phone") -> None:
        self.link = robot.link
        self.peer = peer

    def connect(self) -> None:
        self.link.connect(self.peer)

    async def receive(self) -> bytes:
        return await asyncio.wait_for(self.link.receive(self.peer), TIMEOUT)

    async def open(self, code: str) -> AppSession:
        """Connect, and run the exchange with ``code``."""
        self.connect()
        session = AppSession(code)
        self.link.deliver(self.peer, session.hello())
        self.link.deliver(self.peer, session.share(await self.receive()))
        self.link.deliver(self.peer, session.confirm(await self.receive()))
        return session

    async def ask(self, session: AppSession, kind: str, **fields: Any) -> dict[str, Any]:
        self.link.deliver(self.peer, session.request(kind, **fields))
        return session.read(await self.receive())

    async def gone(self) -> None:
        """Wait until the robot dropped this app."""
        for _ in range(100):
            if not self.link.connected(self.peer):
                return
            await asyncio.sleep(0.01)
        raise AssertionError(f"{self.peer} is still connected")


def test_an_unbound_robot_opens_set_up_and_shows_its_code() -> None:
    async def main() -> None:
        robot = Robot()
        async with running(robot):
            robot.bind(False)
            data = await robot.code_shown()
            assert len(data["code"]) == 8 and data["code"].isdigit()
            assert len(data["discriminator"]) == 4
            assert data["link"] == f"setup:1:{data['discriminator']}:{data['code']}"
            assert robot.link.offered and robot.link.advertised == NAME

    asyncio.run(main())


def test_a_bound_robot_keeps_set_up_closed() -> None:
    async def main() -> None:
        robot = Robot()
        async with running(robot):
            robot.bind(True)
            assert await robot.scene() is None
            assert not robot.link.offered

    asyncio.run(main())


def test_a_whole_set_up() -> None:
    async def main() -> None:
        robot = Robot()
        app = App(robot)
        async with running(robot):
            robot.bind(False)
            shown = await robot.code_shown()
            session = await app.open(shown["code"])
            assert (await robot.scene()) == {"state": "connected"}
            assert not robot.link.advertised  # while a session runs

            info = await app.ask(session, "info")
            assert info["robot"]["id"] == ROBOT and info["robot"]["name"] == NAME
            assert info["bound"] is False
            assert info["network"] == {"state": "disconnected"}

            networks = (await app.ask(session, "networks"))["networks"]
            assert [n.get("ssid") for n in networks] == ["Home", "Office", "Café"]
            assert networks[0] == {"ssid": "Home", "security": "wpa2", "signal": 80, "saved": False}

            joined = await app.ask(session, "join", ssid="Home", password="correct horse")
            assert joined["type"] == "joined"
            assert joined["network"] == {
                "state": "connected",
                "ssid": "Home",
                "address": ADDRESS,
                "internet": True,
            }

            challenge = "c" * 22
            answer = await app.ask(
                session, "register", challenge=challenge, server="https://cloud.example"
            )
            assert answer["registration"] == REGISTRATION
            asked = robot.requests  # the cloud got the request (and answered)
            assert asked.pending == 0

            finished = await app.ask(session, "finish")
            assert finished["type"] == "finished"
            await app.gone()
            assert await robot.scene() == {"state": "connecting"}
            assert not robot.link.offered

            robot.bind(True)
            assert await robot.scene() is None

    asyncio.run(main())


def test_join_failures_are_answered_and_the_session_goes_on() -> None:
    async def main() -> None:
        robot = Robot()
        app = App(robot)
        async with running(robot):
            robot.bind(False)
            session = await app.open((await robot.code_shown())["code"])
            for fields, code in [
                ({"ssid": "Home", "password": "wrong password"}, "wrong_password"),
                ({"ssid": "Nowhere", "password": "anything at all"}, "not_found"),
                ({"ssid": "Office"}, "network"),
                ({"ssid": "ồ" * 11}, "protocol"),  # 33 bytes
            ]:
                answer = await app.ask(session, "join", **fields)
                assert (answer["type"], answer["code"]) == ("error", code), answer
            assert (await app.ask(session, "join", ssid="Café"))["type"] == "joined"
            unknown = await app.ask(session, "dance")
            assert (unknown["type"], unknown["code"]) == ("error", "unknown")
            assert robot.link.connected(app.peer)

    asyncio.run(main())


def test_a_wrong_code_ends_the_session_and_brings_a_new_code() -> None:
    async def main() -> None:
        robot = Robot()
        app = App(robot)
        async with running(robot):
            robot.bind(False)
            shown = await robot.code_shown()
            wrong = f"{(int(shown['code']) + 1) % 10**8:08d}"
            app.connect()
            session = AppSession(wrong)
            app.link.deliver(app.peer, session.hello())
            app.link.deliver(app.peer, session.share(await app.receive()))
            with pytest.raises(ExchangeError):
                session.confirm(await app.receive())
            app.link.disconnect(app.peer)  # the app gives up, as it should
            again = await robot.code_shown()
            assert again["code"] != shown["code"]
            assert again["discriminator"] == shown["discriminator"]
            assert robot.module.failures == 1 and robot.link.advertised == NAME

    asyncio.run(main())


def test_too_many_failures_close_set_up_until_a_tap() -> None:
    async def main() -> None:
        robot = Robot(attempts=2)
        app = App(robot)
        async with running(robot):
            robot.bind(False)
            for _ in range(2):
                shown = await robot.code_shown()
                app.connect()
                session = AppSession(shown["code"])
                app.link.deliver(app.peer, session.hello())
                app.link.deliver(app.peer, session.share(await app.receive()))
                await app.receive()  # the robot's share
                bogus = {"type": "confirm", "id": "a3", "confirm": "A" * 43}
                app.link.deliver(app.peer, json.dumps(bogus).encode())
                error = json.loads(await app.receive())
                assert (error["type"], error["code"]) == ("error", "code")
                await app.gone()
            await robot.until("closed")
            assert not robot.link.offered
            robot.bus.publish(ScreenTouched(0.5, 0.5))
            assert (await robot.code_shown())["state"] == "code"

    asyncio.run(main())


def test_one_app_at_a_time() -> None:
    async def main() -> None:
        robot = Robot()
        first, second = App(robot, "first"), App(robot, "second")
        async with running(robot):
            robot.bind(False)
            await first.open((await robot.code_shown())["code"])
            second.connect()
            refusal = json.loads(await second.receive())
            assert (refusal["type"], refusal["code"]) == ("error", "busy")
            await second.gone()
            assert robot.link.connected("first")

    asyncio.run(main())


def test_what_the_robot_sent_before_dropping_an_app_can_still_be_read() -> None:
    async def main() -> None:
        link = SimSetupLink()
        await link.start("robot")
        link.connect("app")
        await link.send("app", b"busy")
        await link.drop("app")
        assert not link.connected("app")
        assert await link.receive("app") == b"busy"
        with pytest.raises(ConnectionError):
            await link.receive("app")

    asyncio.run(main())


def test_a_silent_session_ends_and_set_up_stays_open() -> None:
    async def main() -> None:
        robot = Robot(idle=0.2)
        app = App(robot)
        async with running(robot):
            robot.bind(False)
            await robot.code_shown()
            app.connect()
            await app.gone()
            assert robot.link.offered and robot.link.advertised == NAME
            assert robot.module.failures == 0  # it never tried a code

    asyncio.run(main())


def test_set_up_closes_when_its_time_is_up_and_a_tap_opens_it_again() -> None:
    async def main() -> None:
        robot = Robot(window=0.2)
        async with running(robot):
            robot.bind(False)
            first = await robot.code_shown()
            assert await robot.scene() == {"state": "closed"}
            assert not robot.link.offered
            robot.bus.publish(ScreenTouched(0.5, 0.5))
            second = await robot.code_shown()
            drawn = (second["code"], second["discriminator"])
            assert drawn != (first["code"], first["discriminator"])

    asyncio.run(main())


def test_a_registration_the_cloud_refuses() -> None:
    async def main() -> None:
        robot = Robot()
        robot.signature = RegistrationSigned("setup-1", error="server", detail="not https")
        app = App(robot)
        async with running(robot):
            robot.bind(False)
            session = await app.open((await robot.code_shown())["code"])
            refusal = await app.ask(
                session, "register", challenge="c" * 22, server="https://cloud.example"
            )
            assert (refusal["type"], refusal["code"], refusal["message"]) == (
                "error",
                "server",
                "not https",
            )

    asyncio.run(main())


def test_the_screen_stops_saying_connecting_if_the_server_never_accepts() -> None:
    async def main() -> None:
        robot = Robot(bind_timeout=0.2)
        app = App(robot)
        async with running(robot):
            robot.bind(False)
            session = await app.open((await robot.code_shown())["code"])
            await app.ask(session, "register", challenge="c" * 22, server="https://cloud.example")
            await app.ask(session, "finish")
            await robot.until("connecting")
            assert await robot.scene() == {"state": "closed"}

    asyncio.run(main())


def test_a_robot_that_loses_its_binding_opens_set_up() -> None:
    async def main() -> None:
        robot = Robot()
        async with running(robot):
            robot.bind(True)
            assert await robot.scene() is None
            robot.bind(False)  # the server no longer knows it: revoked
            assert (await robot.code_shown())["state"] == "code"

    asyncio.run(main())


def test_the_code_stays_out_of_the_logs(caplog: pytest.LogCaptureFixture) -> None:
    async def main() -> str:
        robot = Robot()
        app = App(robot)
        async with running(robot):
            robot.bind(False)
            code = (await robot.code_shown())["code"]
            session = await app.open(code)
            await app.ask(session, "join", ssid="Home", password="correct horse")
            await app.ask(session, "finish")
            await app.gone()
        return code

    with caplog.at_level(logging.DEBUG):
        code = asyncio.run(main())
    assert code not in caplog.text and "correct horse" not in caplog.text
    assert "Home" not in caplog.text


def test_settings_are_checked() -> None:
    robot = Robot()
    ctx = ModuleContext(
        name="setup",
        bus=Bus(),
        ports={"setup_link": robot.link, "network": robot.network},
        robot=RobotInfo(display_name=NAME),
        log=logging.getLogger("test"),
    )
    for change, message in [
        ({"window": 0}, "window must be a positive number"),
        ({"attempts": 0}, "attempts must be at least 1"),
        ({"idle": -1}, "idle must be a positive number"),
        ({"join_timeout": 0}, "join_timeout must be a positive number"),
        ({"bind_timeout": 0}, "bind_timeout must be a positive number"),
        ({"link": "https://app.example/setup"}, "link must contain"),
        ({"link": "https://app.example/" + "x" * 230 + "#{setup}"}, "the screen takes 256"),
    ]:
        with pytest.raises(ConfigError, match=message):
            create(SetupModule, "modules.setup", ctx, **{**SETTINGS, **change})


def test_the_scene_is_in_the_protocol() -> None:
    vocabulary = json.loads(
        (protocol_dir() / "screen" / "vocabulary.json").read_text(encoding="utf-8")
    )
    scene = vocabulary["scenes"][SCENE]
    assert set(scene["data"]) == {"state", "code", "discriminator", "link"}
    assert scene["data"]["link"]["max_length"] == LINK_LENGTH
    assert scene["robot_only"] is True  # the cloud cannot show a code of its own
    assert set(scene["data"]["state"]["values"]) == {"code", "connected", "connecting", "closed"}


def test_set_up_end_to_end_with_the_cloud_module() -> None:
    """The setup module and the cloud module together: the app's registration is signed
    by the robot's key, and the robot is bound once its server accepts it."""

    async def main() -> None:
        robot = Robot()
        identity, store, cloud = SimIdentity(), SimBindingStore(bound=False), SimCloud()
        cloud.knows_robot = False  # a new robot
        module = CloudModule(
            ModuleContext(
                name="cloud",
                bus=robot.bus,
                ports={"cloud": cloud, "identity": identity, "binding": store},
                robot=RobotInfo(display_name=NAME),
                log=logging.getLogger("test.cloud"),
            ),
            allowed_classes=["informational"],
            call_timeout=5.0,
        )
        await identity.open()
        await robot.module.start()
        await module.start()
        tasks = [asyncio.create_task(robot.module.run()), asyncio.create_task(module.run())]
        try:
            app = App(robot)
            session = await app.open((await robot.code_shown())["code"])
            info = await app.ask(session, "info")
            assert info["robot"]["id"] == await identity.robot_id()
            answer = await app.ask(
                session, "register", challenge="c" * 22, server="https://cloud.example"
            )
            header = jwt.get_unverified_header(answer["registration"])
            assert header["jwk"] == dict(await identity.public_key())
            assert store.binding.server == cloud.server == "https://cloud.example"
            await app.ask(session, "finish")
            await robot.until("connecting")
            cloud.recognise()  # the app sent the registration: the server knows the robot
            assert await robot.until(None) is None
            assert store.binding == Binding("https://cloud.example", True)
        finally:
            for task in tasks:
                task.cancel()
            for task in tasks:
                with contextlib.suppress(asyncio.CancelledError):
                    await task
            await module.stop()
            await robot.module.stop()

    asyncio.run(main())


class BrokenLink(SimSetupLink):
    """A link whose service cannot be offered, as with Bluetooth turned off."""

    def __init__(self) -> None:
        super().__init__()
        self.broken = True

    async def start(self, name: str) -> None:
        if self.broken:
            raise ConnectionError("org.bluez.GattManager1.RegisterApplication failed")
        await super().start(name)


class BrokenNetwork(SimNetwork):
    """A network whose service does not answer, as when NetworkManager is down."""

    async def scan(self) -> list:  # type: ignore[type-arg]
        raise ConnectionError("org.freedesktop.NetworkManager is not running")


def test_a_link_that_fails_does_not_stop_the_robot(caplog: pytest.LogCaptureFixture) -> None:
    async def main() -> None:
        robot = Robot()
        robot.link = link = BrokenLink()
        robot.module.link = link
        async with running(robot):
            robot.bind(False)
            assert await robot.until("closed") == {"state": "closed"}  # it says so
            assert not robot.module.is_open
            link.broken = False  # Bluetooth is back: a tap opens set-up
            robot.bus.publish(ScreenTouched(0.5, 0.5))
            assert (await robot.code_shown())["state"] == "code"

    with caplog.at_level(logging.ERROR):
        asyncio.run(main())
    assert "set-up cannot offer the set-up service: org.bluez" in caplog.text


def test_a_network_service_that_fails_is_an_error_for_the_app() -> None:
    async def main() -> None:
        robot = Robot()
        robot.module.network = BrokenNetwork(networks=NETWORKS)
        app = App(robot)
        async with running(robot):
            robot.bind(False)
            session = await app.open((await robot.code_shown())["code"])
            refusal = await app.ask(session, "networks")
            assert (refusal["type"], refusal["code"]) == ("error", "network")
            assert (await app.ask(session, "info"))["type"] == "info"  # the session goes on

    asyncio.run(main())
