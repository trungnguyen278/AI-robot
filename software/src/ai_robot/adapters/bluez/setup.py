# SPDX-License-Identifier: MIT
"""The set-up link over Bluetooth LE, through BlueZ (protocol/setup/README.md, The
Bluetooth service): a GATT service and an advertisement, on D-Bus.

BlueZ's GATT server calls this application over D-Bus: ``WriteValue`` for each fragment an
app writes, ``StartNotify`` when it enables indications, ``Confirm`` when it confirms one.
The robot sends a fragment by changing the answer's ``Value``, which BlueZ indicates.
"""

# No `from __future__ import annotations` here: dbus-fast reads the annotations of the
# methods and properties below at run time, as D-Bus signatures.

import asyncio
import contextlib
import logging
from collections.abc import Sequence
from typing import Annotated, Any

from dbus_fast import Message, MessageType, Variant
from dbus_fast.aio import MessageBus
from dbus_fast.annotations import DBusBool, DBusBytes, DBusDict, DBusSignature, DBusStr
from dbus_fast.constants import PropertyAccess
from dbus_fast.service import ServiceInterface, dbus_method, dbus_property

from ai_robot.adapters.bluez.fragments import FragmentError, Joiner, split
from ai_robot.adapters.dbus import call, connect, watch
from ai_robot.core.checks import positive
from ai_robot.ports.setup import Connected, Disconnected, LinkEvent, Received, SetupLink

log = logging.getLogger(__name__)

# Fixed by the protocol (protocol/setup/README.md, The Bluetooth service).
SERVICE_UUID = "eaf35dcb-e774-4881-b0c6-4990127a1289"
REQUEST_UUID = "eaf35dcc-e774-4881-b0c6-4990127a1289"
ANSWER_UUID = "eaf35dcd-e774-4881-b0c6-4990127a1289"

# BlueZ's D-Bus interfaces (doc/org.bluez.*.rst in BlueZ's sources).
BLUEZ = "org.bluez"
GATT_MANAGER = "org.bluez.GattManager1"
ADVERTISING_MANAGER = "org.bluez.LEAdvertisingManager1"
DEVICE = "org.bluez.Device1"
PROPERTIES = "org.freedesktop.DBus.Properties"
DEFAULT_MTU = 23  # the ATT MTU until a larger one is exchanged (Bluetooth Core, Vol 3, Part F)
# A legacy advertisement holds 31 bytes: the flags take 3 and the service's 128-bit UUID
# 18, which leaves 8 for the name, after its 2 bytes of length and type.
NAME_BYTES = 8

# The objects on the bus. BlueZ wants the GATT application's objects, and only them,
# under its root (doc/org.bluez.GattManager.rst): the advertisement lives beside it.
ROOT = "/ai_robot/setup"
SERVICE_PATH = f"{ROOT}/service0"
REQUEST_PATH = f"{SERVICE_PATH}/request"
ANSWER_PATH = f"{SERVICE_PATH}/answer"
ADVERTISEMENT_PATH = "/ai_robot/advertisement0"

DBusStrings = Annotated[list[str], DBusSignature("as")]
DBusPath = Annotated[str, DBusSignature("o")]


def short_name(name: str) -> str:
    """``name``, cut to what fits in the advertisement, on a whole character."""
    data = name.encode("utf-8")[:NAME_BYTES]
    return data.decode("utf-8", errors="ignore")


class _Service(ServiceInterface):
    def __init__(self) -> None:
        super().__init__("org.bluez.GattService1")

    @dbus_property(access=PropertyAccess.READ, name="UUID")
    def uuid(self) -> DBusStr:
        return SERVICE_UUID

    @dbus_property(access=PropertyAccess.READ, name="Primary")
    def primary(self) -> DBusBool:
        return True


class _Request(ServiceInterface):
    """The characteristic apps write their fragments to."""

    def __init__(self, link: "BluezSetupLink") -> None:
        super().__init__("org.bluez.GattCharacteristic1")
        self._link = link

    @dbus_property(access=PropertyAccess.READ, name="UUID")
    def uuid(self) -> DBusStr:
        return REQUEST_UUID

    @dbus_property(access=PropertyAccess.READ, name="Service")
    def service(self) -> DBusPath:
        return SERVICE_PATH

    @dbus_property(access=PropertyAccess.READ, name="Flags")
    def flags(self) -> DBusStrings:
        return ["write"]

    @dbus_method(name="WriteValue")
    def write_value(self, value: DBusBytes, options: DBusDict) -> None:
        self._link.written(bytes(value), options)


class _Answer(ServiceInterface):
    """The characteristic the robot indicates its fragments on."""

    def __init__(self, link: "BluezSetupLink") -> None:
        super().__init__("org.bluez.GattCharacteristic1")
        self._link = link
        self.data = b""

    @dbus_property(access=PropertyAccess.READ, name="UUID")
    def uuid(self) -> DBusStr:
        return ANSWER_UUID

    @dbus_property(access=PropertyAccess.READ, name="Service")
    def service(self) -> DBusPath:
        return SERVICE_PATH

    @dbus_property(access=PropertyAccess.READ, name="Flags")
    def flags(self) -> DBusStrings:
        return ["indicate"]

    @dbus_property(access=PropertyAccess.READ, name="Value")
    def value(self) -> DBusBytes:
        return self.data

    @dbus_method(name="StartNotify")
    def start_notify(self) -> None:
        self._link.notifying = True

    @dbus_method(name="StopNotify")
    def stop_notify(self) -> None:
        self._link.notifying = False

    @dbus_method(name="Confirm")
    def confirm(self) -> None:
        self._link.confirmed()

    def indicate(self, data: bytes) -> None:
        self.data = data
        self.emit_properties_changed({"Value": data})


class _Advertisement(ServiceInterface):
    def __init__(self) -> None:
        super().__init__("org.bluez.LEAdvertisement1")
        self.local = ""  # not `name`: ServiceInterface's name is the interface's

    @dbus_property(access=PropertyAccess.READ, name="Type")
    def kind(self) -> DBusStr:
        return "peripheral"

    @dbus_property(access=PropertyAccess.READ, name="ServiceUUIDs")
    def service_uuids(self) -> DBusStrings:
        return [SERVICE_UUID]

    @dbus_property(access=PropertyAccess.READ, name="LocalName")
    def local_name(self) -> DBusStr:
        return self.local

    @dbus_property(access=PropertyAccess.READ, name="Discoverable")
    def discoverable(self) -> DBusBool:
        return True

    @dbus_method(name="Release")
    def release(self) -> None:
        log.info("BlueZ released the set-up advertisement")


class BluezSetupLink(SetupLink):
    """Offers the set-up service on the Bluetooth controller ``adapter`` (``hci0``),
    through BlueZ on the D-Bus ``bus``: ``system``, or the address of another bus, as the
    tests use. An app that does not confirm an indication within ``confirm_timeout``
    seconds is dropped.

    Apps are named by their BlueZ device's object path. One connects with its first
    write; it leaves when BlueZ says the device disconnected, or when it is dropped.
    """

    def __init__(self, *, adapter: str, bus: str, confirm_timeout: float) -> None:
        if not adapter:
            raise ValueError("adapter must not be empty")
        self.adapter_path = f"/org/bluez/{adapter}"
        self.bus_address = bus
        self.confirm_timeout = positive("confirm_timeout", confirm_timeout)
        self.notifying = False
        self._bus: MessageBus | None = None
        self._service = _Service()
        self._request = _Request(self)
        self._answer = _Answer(self)
        self._advertisement = _Advertisement()
        self._offered = False
        self._advertised = False
        self._peers: dict[str, tuple[Joiner, int]] = {}  # device path -> its joiner and MTU
        self._events: asyncio.Queue[LinkEvent] = asyncio.Queue()
        self._confirmation: asyncio.Event = asyncio.Event()
        self._sending = asyncio.Lock()  # one message at a time: each fragment is confirmed
        self._tasks: set[asyncio.Task[None]] = set()  # drops started from BlueZ's calls

    async def open(self) -> None:
        self._bus = await connect(self.bus_address)
        self._bus.add_message_handler(self._on_message)
        await watch(
            self._bus,
            f"type='signal',sender='{BLUEZ}',interface='{PROPERTIES}',"
            f"member='PropertiesChanged',path_namespace='{self.adapter_path}'",
        )
        self._bus.export(SERVICE_PATH, self._service)
        self._bus.export(REQUEST_PATH, self._request)
        self._bus.export(ANSWER_PATH, self._answer)
        self._bus.export(ADVERTISEMENT_PATH, self._advertisement)

    async def close(self) -> None:
        with contextlib.suppress(Exception):
            await self.stop()
        if self._bus is not None:
            self._bus.disconnect()
            self._bus = None

    # ---- the port ----

    async def start(self, name: str) -> None:
        self._advertisement.local = short_name(name)
        if not self._offered:
            await self._bluez(
                self.adapter_path, GATT_MANAGER, "RegisterApplication", "oa{sv}", [ROOT, {}]
            )
            self._offered = True
        await self.advertise(True)

    async def advertise(self, on: bool) -> None:
        if on and self._offered and not self._advertised:
            await self._bluez(
                self.adapter_path,
                ADVERTISING_MANAGER,
                "RegisterAdvertisement",
                "oa{sv}",
                [ADVERTISEMENT_PATH, {}],
            )
            self._advertised = True
        elif not on and self._advertised:
            self._advertised = False
            await self._bluez(
                self.adapter_path,
                ADVERTISING_MANAGER,
                "UnregisterAdvertisement",
                "o",
                [ADVERTISEMENT_PATH],
            )

    async def stop(self) -> None:
        await self.advertise(False)
        for peer in list(self._peers):
            await self.drop(peer)
        if self._offered:
            self._offered = False
            await self._bluez(self.adapter_path, GATT_MANAGER, "UnregisterApplication", "o", [ROOT])

    async def event(self) -> LinkEvent:
        return await self._events.get()

    async def send(self, peer: str, message: bytes) -> None:
        async with self._sending:
            entry = self._peers.get(peer)
            if entry is None:
                return
            for fragment in split(message, entry[1]):
                if peer not in self._peers:
                    return
                self._confirmation.clear()
                self._answer.indicate(fragment)
                try:
                    await asyncio.wait_for(self._confirmation.wait(), self.confirm_timeout)
                except TimeoutError:
                    log.warning("an app did not confirm a set-up fragment: dropped")
                    await self.drop(peer)
                    return

    async def drop(self, peer: str) -> None:
        if self._peers.pop(peer, None) is None:
            return
        self._events.put_nowait(Disconnected(peer))
        with contextlib.suppress(ConnectionError):  # it may be gone already
            await self._bluez(peer, DEVICE, "Disconnect")

    # ---- what BlueZ tells the link ----

    def written(self, fragment: bytes, options: dict[str, Variant]) -> None:
        """A fragment an app wrote to the request characteristic."""
        peer = options["device"].value if "device" in options else ""
        if not peer.startswith(self.adapter_path + "/"):
            log.warning("a set-up fragment came from no known device; ignored")
            return
        mtu = int(options["mtu"].value) if "mtu" in options else DEFAULT_MTU
        entry = self._peers.get(peer)
        if entry is None:
            entry = (Joiner(), mtu)
            self._events.put_nowait(Connected(peer))
        self._peers[peer] = (entry[0], mtu)
        try:
            message = entry[0].add(fragment)
        except FragmentError as error:
            log.warning("an app sent a fragment that does not fit (%s): dropped", error)
            task = asyncio.get_running_loop().create_task(self.drop(peer))
            self._tasks.add(task)
            task.add_done_callback(self._tasks.discard)
            return
        if message is not None:
            self._events.put_nowait(Received(peer, message))

    def confirmed(self) -> None:
        self._confirmation.set()

    def _on_message(self, message: Message) -> None:
        """A device's properties changed: one that disconnects leaves."""
        if (
            message.message_type is MessageType.SIGNAL
            and message.member == "PropertiesChanged"
            and message.body
            and message.body[0] == DEVICE
        ):
            connected = message.body[1].get("Connected")
            if connected is not None and not connected.value and message.path in self._peers:
                del self._peers[message.path]
                self._events.put_nowait(Disconnected(message.path))

    async def _bluez(
        self, path: str, interface: str, member: str, signature: str = "", body: Sequence[Any] = ()
    ) -> list[Any]:
        assert self._bus is not None, "the link is not open"
        return await call(self._bus, BLUEZ, path, interface, member, signature, body)
