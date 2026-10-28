# SPDX-License-Identifier: MIT
"""BlueZ, as the set-up link's tests need it (doc/org.bluez.*.rst in BlueZ's sources): on a
private D-Bus, a controller that takes the robot's GATT application and advertisement,
and phones that connect, write fragments and confirm indications, as BlueZ relays them."""

from __future__ import annotations

import asyncio
from typing import Any

from dbus_fast import Message, MessageType, Variant
from dbus_fast.aio import MessageBus

from ai_robot.adapters.bluez.fragments import Joiner, split

BLUEZ = "org.bluez"
ADAPTER = "/org/bluez/hci0"
GATT_MANAGER = "org.bluez.GattManager1"
ADVERTISING_MANAGER = "org.bluez.LEAdvertisingManager1"
DEVICE = "org.bluez.Device1"
CHARACTERISTIC = "org.bluez.GattCharacteristic1"
PROPERTIES = "org.freedesktop.DBus.Properties"


def plain(value: Any) -> Any:
    """``value`` with its variants unwrapped."""
    if isinstance(value, Variant):
        return plain(value.value)
    if isinstance(value, dict):
        return {key: plain(item) for key, item in value.items()}
    if isinstance(value, list):
        return [plain(item) for item in value]
    return value


class FakeBluez:
    """Owns ``org.bluez`` on the bus at ``address``.

    ``application`` holds the robot's GATT objects once it registers them (path ->
    interface -> properties), and ``advertisement`` the properties of its advertisement
    while it advertises. ``refuse`` makes the next registration fail. Phones are named
    by their device's object path.
    """

    def __init__(self, address: str) -> None:
        self.address = address
        self.bus: MessageBus | None = None
        self.application: dict[str, dict[str, dict[str, Any]]] = {}
        self.advertisement: dict[str, Any] | None = None
        self.robot = ""  # the robot's unique name on the bus
        self.disconnected: list[str] = []  # devices the robot asked to disconnect
        self.refuse = False
        self.confirming = True  # whether phones confirm the indications they get
        self.indications: asyncio.Queue[bytes] = asyncio.Queue()
        self._tasks: set[asyncio.Task[None]] = set()

    async def start(self) -> None:
        self.bus = await MessageBus(bus_address=self.address).connect()
        await self.bus.request_name(BLUEZ)
        self.bus.add_message_handler(self._handle)

    async def stop(self) -> None:
        for task in list(self._tasks):
            task.cancel()
        if self.bus is not None:
            self.bus.disconnect()

    # ---- what the robot asks of BlueZ ----

    def _handle(self, message: Message) -> bool | None:
        if message.message_type is MessageType.SIGNAL and message.member == "PropertiesChanged":
            interface, changed, _ = message.body
            if interface == CHARACTERISTIC and "Value" in changed:
                self._spawn(self._indicated(message.path, bytes(changed["Value"].value)))
            return None
        if message.message_type is not MessageType.METHOD_CALL:
            return None
        call = (message.interface, message.member)
        if call == (GATT_MANAGER, "RegisterApplication"):
            self._spawn(self._register_application(message))
        elif call == (GATT_MANAGER, "UnregisterApplication"):
            self.application = {}
            self._reply(message)
        elif call == (ADVERTISING_MANAGER, "RegisterAdvertisement"):
            self._spawn(self._register_advertisement(message))
        elif call == (ADVERTISING_MANAGER, "UnregisterAdvertisement"):
            self.advertisement = None
            self._reply(message)
        elif call == (DEVICE, "Disconnect"):
            self.disconnected.append(message.path)
            self._reply(message)
            self.disconnect(message.path)
        else:
            return None
        return True

    async def _register_application(self, message: Message) -> None:
        if self.refuse:
            self.refuse = False
            self._error(message, "org.bluez.Error.Failed", "refused for the test")
            return
        self.robot = message.sender
        (objects,) = await self._call(
            message.body[0], "org.freedesktop.DBus.ObjectManager", "GetManagedObjects", "", []
        )
        self.application = plain(objects)
        self._reply(message)
        await self._call(
            "/org/freedesktop/DBus",
            "org.freedesktop.DBus",
            "AddMatch",
            "s",
            [f"type='signal',sender='{self.robot}',member='PropertiesChanged'"],
            destination="org.freedesktop.DBus",
        )

    async def _register_advertisement(self, message: Message) -> None:
        (properties,) = await self._call(
            message.body[0],
            PROPERTIES,
            "GetAll",
            "s",
            ["org.bluez.LEAdvertisement1"],
            destination=message.sender,
        )
        self.advertisement = plain(properties)
        self._reply(message)

    # ---- phones ----

    def characteristic(self, uuid: str) -> str:
        """The path of the robot's characteristic ``uuid``."""
        for path, interfaces in self.application.items():
            if interfaces.get(CHARACTERISTIC, {}).get("UUID") == uuid:
                return path
        raise KeyError(uuid)

    async def subscribe(self, uuid: str) -> None:
        """A phone enables the indications of characteristic ``uuid``."""
        await self._call(self.characteristic(uuid), CHARACTERISTIC, "StartNotify", "", [])

    async def write(self, device: str, uuid: str, fragment: bytes, mtu: int) -> None:
        await self._call(
            self.characteristic(uuid),
            CHARACTERISTIC,
            "WriteValue",
            "aya{sv}",
            [fragment, {"device": Variant("o", device), "mtu": Variant("q", mtu)}],
        )

    async def send(self, device: str, uuid: str, message: bytes, mtu: int) -> None:
        """A phone writes ``message``, in fragments, to characteristic ``uuid``."""
        for fragment in split(message, mtu):
            await self.write(device, uuid, fragment, mtu)

    async def receive(self, timeout: float) -> bytes:
        """The next whole message the robot indicated."""
        joiner = Joiner()
        while True:
            fragment = await asyncio.wait_for(self.indications.get(), timeout)
            message = joiner.add(fragment)
            if message is not None:
                return message

    async def _indicated(self, path: str, value: bytes) -> None:
        self.indications.put_nowait(value)
        if self.confirming:
            await self._call(path, CHARACTERISTIC, "Confirm", "", [])

    def disconnect(self, device: str) -> None:
        """BlueZ says that ``device`` disconnected."""
        assert self.bus is not None
        self.bus.send(
            Message.new_signal(
                device,
                PROPERTIES,
                "PropertiesChanged",
                "sa{sv}as",
                [DEVICE, {"Connected": Variant("b", False)}, []],
            )
        )

    # ---- plumbing ----

    def _spawn(self, coroutine: Any) -> None:
        task = asyncio.get_running_loop().create_task(coroutine)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    def _reply(self, message: Message) -> None:
        assert self.bus is not None
        self.bus.send(Message.new_method_return(message))

    def _error(self, message: Message, name: str, text: str) -> None:
        assert self.bus is not None
        self.bus.send(Message.new_error(message, name, text))

    async def _call(
        self,
        path: str,
        interface: str,
        member: str,
        signature: str,
        body: list[Any],
        destination: str | None = None,
    ) -> list[Any]:
        assert self.bus is not None
        reply = await self.bus.call(
            Message(
                destination=destination or self.robot,
                path=path,
                interface=interface,
                member=member,
                signature=signature,
                body=body,
            )
        )
        assert reply is not None
        if reply.message_type is MessageType.ERROR:
            raise ConnectionError(f"{member}: {reply.error_name}: {reply.body}")
        return list(reply.body)
