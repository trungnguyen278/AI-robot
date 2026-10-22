# SPDX-License-Identifier: MIT
"""Identities whose key is kept in software (docs/decisions/0010-device-identity.md).

A robot keeps its key in a TPM, which never lets it out. These keep it in memory or in
a file: for development computers and for tests, never for a robot in a home.
"""

from __future__ import annotations

import asyncio
import json
import os
import stat
import uuid
from collections.abc import Mapping
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

from ai_robot.core.jose import b64url
from ai_robot.ports.identity import Identity

# Bytes in a P-256 coordinate, and in each half of an ES256 signature (RFC 7518, §3.4).
COORDINATE = 32


class SoftwareIdentity(Identity):
    """An identity whose private key is in this process's memory."""

    def __init__(self) -> None:
        self._id: str | None = None
        self._key: ec.EllipticCurvePrivateKey | None = None

    def _hold(self, robot_id: str, key: ec.EllipticCurvePrivateKey) -> None:
        if not isinstance(key.curve, ec.SECP256R1):
            raise ValueError(f"the key must be on P-256, not {key.curve.name}")
        self._id = robot_id
        self._key = key

    async def robot_id(self) -> str:
        return self._held()[0]

    async def public_key(self) -> Mapping[str, str]:
        numbers = self._held()[1].public_key().public_numbers()
        return {
            "kty": "EC",
            "crv": "P-256",
            "x": b64url(numbers.x.to_bytes(COORDINATE, "big")),
            "y": b64url(numbers.y.to_bytes(COORDINATE, "big")),
        }

    async def sign(self, data: bytes) -> bytes:
        der = self._held()[1].sign(data, ec.ECDSA(hashes.SHA256()))
        r, s = decode_dss_signature(der)
        return r.to_bytes(COORDINATE, "big") + s.to_bytes(COORDINATE, "big")

    def _held(self) -> tuple[str, ec.EllipticCurvePrivateKey]:
        if self._id is None or self._key is None:
            raise RuntimeError("the identity is not open")
        return self._id, self._key


class FileIdentity(SoftwareIdentity):
    """An identity kept in the file at ``path``, and made there the first time: for a
    development computer, which has no TPM. The file holds the private key: only its
    owner may read it, and it is never committed."""

    def __init__(self, *, path: str) -> None:
        super().__init__()
        if not path:
            raise ValueError("path must name a file")
        self.path = Path(path).expanduser()

    async def open(self) -> None:
        self._hold(*await asyncio.to_thread(self._load_or_make))

    def _load_or_make(self) -> tuple[str, ec.EllipticCurvePrivateKey]:
        try:
            descriptor = os.open(self.path, os.O_RDONLY)
        except FileNotFoundError:
            return self._make()
        except OSError as error:
            raise ValueError(f"cannot read the identity in {self.path}: {error}") from None
        with os.fdopen(descriptor, encoding="utf-8") as file:
            # A key others can reach may have been copied or swapped: refuse it, as SSH does.
            mode = stat.S_IMODE(os.fstat(descriptor).st_mode)
            if os.name == "posix" and mode & 0o077:
                raise ValueError(
                    f"the identity in {self.path} is open to others (mode {mode:03o}); "
                    "only its owner may have access (chmod 600)"
                )
            try:
                stored = json.loads(file.read())
            except (OSError, ValueError) as error:
                raise ValueError(f"cannot read the identity in {self.path}: {error}") from None
        try:
            robot_id = stored["id"]
            key = serialization.load_pem_private_key(stored["key"].encode("ascii"), None)
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError(f"the identity in {self.path} is damaged: {error}") from None
        if not (
            isinstance(robot_id, str) and robot_id and isinstance(key, ec.EllipticCurvePrivateKey)
        ):
            raise ValueError(f"the identity in {self.path} is not an identifier with a P-256 key")
        return robot_id, key

    def _make(self) -> tuple[str, ec.EllipticCurvePrivateKey]:
        key = ec.generate_private_key(ec.SECP256R1())
        robot_id = str(uuid.uuid4())
        pem = key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ).decode("ascii")
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        # Readable by its owner only, from the moment it exists (on POSIX systems).
        descriptor = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as file:
            json.dump({"id": robot_id, "key": pem}, file)
        return robot_id, key
