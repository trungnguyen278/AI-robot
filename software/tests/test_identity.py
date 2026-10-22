# SPDX-License-Identifier: MIT
"""The robot's identity, with its key kept in software (docs/decisions/0010)."""

from __future__ import annotations

import asyncio
import base64
import json
import os
import stat
import uuid
from collections.abc import Mapping
from pathlib import Path

import pytest
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

from ai_robot.adapters.keys.identity import FileIdentity
from ai_robot.adapters.sim.identity import SimIdentity
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


def write_identity(path: Path, content: str) -> None:
    """Write an identity file as the file adapter wants it: open to its owner only."""
    path.write_text(content, encoding="utf-8")
    path.chmod(0o600)


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


def test_a_simulated_identity_is_new_at_each_start() -> None:
    async def main() -> None:
        first, second = SimIdentity(), SimIdentity()
        await first.open()
        await second.open()
        assert await check(first) != await check(second)

    asyncio.run(main())


def test_an_identity_in_a_file_is_made_once_and_kept(tmp_path: Path) -> None:
    async def main() -> None:
        path = tmp_path / "keys" / "identity.json"
        made = FileIdentity(path=str(path))
        await made.open()
        robot = await check(made)
        again = FileIdentity(path=str(path))
        await again.open()
        assert await check(again) == robot
        assert await again.public_key() == await made.public_key()
        if os.name == "posix":  # only its owner may read the key
            assert stat.S_IMODE(path.stat().st_mode) == 0o600

    asyncio.run(main())


@pytest.mark.skipif(os.name != "posix", reason="file modes are POSIX's")
def test_a_key_file_others_can_read_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "identity.json"
    asyncio.run(FileIdentity(path=str(path)).open())
    path.chmod(0o644)
    with pytest.raises(ValueError, match="open to others"):
        asyncio.run(FileIdentity(path=str(path)).open())


@pytest.mark.parametrize(
    ("content", "message"),
    [
        ("not json", "cannot read the identity"),
        ('{"id": "r1"}', "is damaged"),
        ('{"id": "r1", "key": "not a key"}', "is damaged"),
    ],
)
def test_a_damaged_identity_file_is_refused(tmp_path: Path, content: str, message: str) -> None:
    path = tmp_path / "identity.json"
    write_identity(path, content)
    with pytest.raises(ValueError, match=message):
        asyncio.run(FileIdentity(path=str(path)).open())


def test_only_p256_keys_are_taken(tmp_path: Path) -> None:
    key = ec.generate_private_key(ec.SECP384R1())
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode("ascii")
    path = tmp_path / "identity.json"
    write_identity(path, json.dumps({"id": "r1", "key": pem}))
    with pytest.raises(ValueError, match="P-256"):
        asyncio.run(FileIdentity(path=str(path)).open())


def test_an_identity_must_be_open_and_a_file_must_be_named() -> None:
    with pytest.raises(RuntimeError, match="not open"):
        asyncio.run(SimIdentity().robot_id())
    with pytest.raises(ValueError, match="path must name a file"):
        FileIdentity(path="")
