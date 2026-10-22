# SPDX-License-Identifier: MIT
"""The robot's identity (docs/decisions/0010-device-identity.md)."""

from __future__ import annotations

from abc import abstractmethod
from collections.abc import Mapping

from ai_robot.ports.base import Port


class Identity(Port):
    """Who the robot is: an identifier, made on its first start, and a key pair that
    proves it, made where the private key never leaves (a TPM on the robot).

    The key is an elliptic-curve key on P-256, which signs with ES256 (RFC 7518, §3.4).
    The identifier and the public key are what the owner registers with
    ``ai-robot-server`` at set-up.
    """

    @abstractmethod
    async def robot_id(self) -> str:
        """The robot's identifier, the same for the robot's whole life."""

    @abstractmethod
    async def public_key(self) -> Mapping[str, str]:
        """The public key as a JWK (RFC 7517): ``kty`` ``EC``, ``crv`` ``P-256``, and its
        coordinates ``x`` and ``y``, base64url-encoded."""

    @abstractmethod
    async def sign(self, data: bytes) -> bytes:
        """``data`` signed with ES256: the 64 bytes of r and s, as JWS has them."""
