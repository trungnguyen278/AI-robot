# SPDX-License-Identifier: MIT
"""The robot's identity, with its key kept in software (docs/decisions/0010)."""

from __future__ import annotations

import asyncio
import json
import os
import stat
from pathlib import Path

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from identity_checks import check

from ai_robot.adapters.keys.identity import FileIdentity
from ai_robot.adapters.sim.identity import SimIdentity


def write_identity(path: Path, content: str) -> None:
    """Write an identity file as the file adapter wants it: open to its owner only."""
    path.write_text(content, encoding="utf-8")
    path.chmod(0o600)


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
