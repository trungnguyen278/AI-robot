# SPDX-License-Identifier: MIT
"""Simulated network: Wi-Fi networks from the configuration, joined at once."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from ai_robot.ports.network import (
    JoinError,
    JoinFailure,
    Network,
    NetworkState,
    NetworkStatus,
    Security,
    WifiNetwork,
)

ADDRESS = "192.0.2.10"  # the robot's address once joined: one for documentation (RFC 5737)


@dataclass(slots=True)
class _Simulated:
    ssid: bytes
    security: Security
    signal: int
    password: str | None  # the one it takes; None: any


class SimNetwork(Network):
    """Sees ``networks``: tables with ``ssid``, ``security`` (``open``, ``wpa2``,
    ``wpa3`` or ``other``), ``signal`` (0 to 100) and, optionally, the ``password`` the
    network takes; without one, it takes any. Joining is immediate, and gives the
    Internet."""

    def __init__(self, *, networks: Sequence[Mapping[str, Any]]) -> None:
        self._networks: dict[bytes, _Simulated] = {}
        for index, table in enumerate(networks):
            try:
                ssid = str(table["ssid"]).encode("utf-8")
                network = _Simulated(
                    ssid,
                    Security(table["security"]),
                    int(table["signal"]),
                    table.get("password"),
                )
            except (KeyError, TypeError, ValueError) as error:
                raise ValueError(f"networks[{index}] is not a network: {error}") from None
            if not 1 <= len(ssid) <= 32 or not 0 <= network.signal <= 100:
                raise ValueError(f"networks[{index}]: ssid has 1 to 32 bytes, signal 0 to 100")
            self._networks[ssid] = network
        self._saved: set[bytes] = set()
        self._status = NetworkStatus(NetworkState.DISCONNECTED)

    async def scan(self) -> list[WifiNetwork]:
        seen = [
            WifiNetwork(network.ssid, network.security, network.signal, network.ssid in self._saved)
            for network in self._networks.values()
        ]
        return sorted(seen, key=lambda network: -network.signal)

    async def join(
        self,
        ssid: bytes,
        password: str | None,
        *,
        hidden: bool,
        security: Security | None,
        timeout: float,
    ) -> NetworkStatus:
        network = self._networks.get(ssid)
        if network is None:
            raise JoinError(JoinFailure.NOT_FOUND, "no such network in reach")
        if network.security is Security.OTHER:
            raise JoinError(JoinFailure.OTHER, "the robot does not join this kind of network")
        if network.security is not Security.OPEN:
            if password is None and ssid not in self._saved:
                raise JoinError(JoinFailure.WRONG_PASSWORD, "the network needs a password")
            if password is not None and network.password not in (None, password):
                raise JoinError(JoinFailure.WRONG_PASSWORD, "the network refused the password")
        self._saved.add(ssid)
        self._status = NetworkStatus(NetworkState.CONNECTED, ssid, ADDRESS, True)
        return self._status

    async def status(self) -> NetworkStatus:
        return self._status
