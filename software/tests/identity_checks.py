# SPDX-License-Identifier: MIT
"""Checks that every identity must pass, whatever keeps its key."""

from __future__ import annotations

import base64
import uuid
from collections.abc import Mapping

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

from ai_robot.ports import Identity


def unb64url(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def verifies(jwk: Mapping[str, str], data: bytes, signature: bytes) -> bool:
    """Whether ``signature``, the r and s of ES256, signs ``data`` for the key ``jwk``."""
    x = int.from_bytes(unb64url(jwk["x"]), "big")
    y = int.from_bytes(unb64url(jwk["y"]), "big")
    key = ec.EllipticCurvePublicNumbers(x, y, ec.SECP256R1()).public_key()
    der = encode_dss_signature(
        int.from_bytes(signature[:32], "big"), int.from_bytes(signature[32:], "big")
    )
    try:
        key.verify(der, data, ec.ECDSA(hashes.SHA256()))
    except InvalidSignature:
        return False
    return True


async def check(identity: Identity) -> str:
    """Check what every identity promises; return its identifier."""
    robot = await identity.robot_id()
    uuid.UUID(robot)  # an identifier made at random
    jwk = await identity.public_key()
    assert (jwk["kty"], jwk["crv"]) == ("EC", "P-256")
    assert len(unb64url(jwk["x"])) == len(unb64url(jwk["y"])) == 32
    signature = await identity.sign(b"hello")
    assert len(signature) == 64
    assert verifies(jwk, b"hello", signature)
    assert not verifies(jwk, b"hullo", signature)
    return robot
