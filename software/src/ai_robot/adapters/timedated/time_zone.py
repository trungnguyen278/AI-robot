# SPDX-License-Identifier: MIT
"""The robot's time zone through systemd-timedated, the system's time and date service,
on D-Bus (org.freedesktop.timedate1(5)).

The user who runs the robot must be allowed to set the time zone through polkit.
"""

from __future__ import annotations

from dbus_fast import Message, MessageType
from dbus_fast.aio import MessageBus

from ai_robot.adapters.dbus import call, connect
from ai_robot.ports.time_zone import TimeZone

# Fixed by systemd-timedated and D-Bus (org.freedesktop.timedate1(5)).
TIMEDATE = "org.freedesktop.timedate1"
TIMEDATE_PATH = "/org/freedesktop/timedate1"
PROPERTIES = "org.freedesktop.DBus.Properties"
INVALID_ARGS = "org.freedesktop.DBus.Error.InvalidArgs"  # a zone it does not know


class TimedatedTimeZone(TimeZone):
    """The time zone of the system, through systemd-timedated on the D-Bus ``bus``:
    ``system``, or the address of another bus, as the tests use."""

    def __init__(self, *, bus: str) -> None:
        self.bus_address = bus
        self._bus: MessageBus | None = None

    async def open(self) -> None:
        self._bus = await connect(self.bus_address)

    async def close(self) -> None:
        if self._bus is not None:
            self._bus.disconnect()
            self._bus = None

    async def current(self) -> str:
        assert self._bus is not None, "the time zone is not open"
        (value,) = await call(
            self._bus, TIMEDATE, TIMEDATE_PATH, PROPERTIES, "Get", "ss", [TIMEDATE, "Timezone"]
        )
        zone: str = value.value
        return zone

    async def set(self, zone: str) -> None:
        assert self._bus is not None, "the time zone is not open"
        try:
            reply = await self._bus.call(
                Message(
                    destination=TIMEDATE,
                    path=TIMEDATE_PATH,
                    interface=TIMEDATE,
                    member="SetTimezone",
                    signature="sb",
                    body=[zone, False],  # never ask a person to authenticate
                )
            )
        except Exception as error:  # the bus itself failed: the robot goes on without it
            raise OSError(f"cannot reach systemd-timedated: {error}") from error
        if reply is not None and reply.message_type is not MessageType.ERROR:
            return
        detail = reply.body[0] if reply is not None and reply.body else "no reply"
        if reply is not None and reply.error_name == INVALID_ARGS:
            raise ValueError(f"{zone!r} is not a time zone the system knows: {detail}")
        name = reply.error_name if reply is not None else "?"
        raise OSError(f"systemd-timedated refused the time zone: {name}: {detail}")
