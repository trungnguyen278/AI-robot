# SPDX-License-Identifier: MIT
"""systemd-timedated, as the time zone adapter's tests need it (org.freedesktop.timedate1(5)):
on a private D-Bus, its ``Timezone`` property and its ``SetTimezone`` method. Like
timedated, it refuses a zone it does not know with ``InvalidArgs``, and any zone when
polkit does not allow the caller."""

from __future__ import annotations

from dbus_fast import Message, MessageType, Variant
from dbus_fast.aio import MessageBus

TIMEDATE = "org.freedesktop.timedate1"
TIMEDATE_PATH = "/org/freedesktop/timedate1"
PROPERTIES = "org.freedesktop.DBus.Properties"
ZONES = {"UTC", "Asia/Ho_Chi_Minh", "Europe/Paris"}  # the zones its system has
DENIED = "org.freedesktop.DBus.Error.AccessDenied"


class FakeTimedated:
    """Owns ``org.freedesktop.timedate1`` on the bus at ``address``, starting at ``zone``.
    ``allowed`` is what polkit decides; ``interactive`` lists what each ``SetTimezone``
    asked."""

    def __init__(self, address: str, zone: str = "UTC") -> None:
        self.address = address
        self.zone = zone
        self.allowed = True
        self.interactive: list[bool] = []
        self.bus: MessageBus | None = None

    async def start(self) -> None:
        self.bus = await MessageBus(bus_address=self.address).connect()
        await self.bus.request_name(TIMEDATE)
        self.bus.add_message_handler(self._handle)

    async def stop(self) -> None:
        if self.bus is not None:
            self.bus.disconnect()

    def _handle(self, message: Message) -> bool | None:
        if message.message_type is not MessageType.METHOD_CALL or message.path != TIMEDATE_PATH:
            return None
        assert self.bus is not None
        if message.interface == PROPERTIES and message.member == "Get":
            if message.body != [TIMEDATE, "Timezone"]:
                return None
            self.bus.send(Message.new_method_return(message, "v", [Variant("s", self.zone)]))
            return True
        if message.interface != TIMEDATE or message.member != "SetTimezone":
            return None
        zone, interactive = message.body
        self.interactive.append(interactive)
        if not self.allowed:
            self.bus.send(Message.new_error(message, DENIED, "Permission denied"))
        elif zone not in ZONES:
            error = f"Invalid or not installed time zone '{zone}'"
            self.bus.send(
                Message.new_error(message, "org.freedesktop.DBus.Error.InvalidArgs", error)
            )
        else:
            self.zone = zone
            self.bus.send(Message.new_method_return(message))
        return True
