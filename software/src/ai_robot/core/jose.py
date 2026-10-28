# SPDX-License-Identifier: MIT
"""Pieces of JOSE, the JSON formats for signing (RFC 7515 to RFC 7518 and RFC 7638)."""

from __future__ import annotations

import base64
import hashlib
import json
from collections.abc import Mapping
from typing import Any

# Bytes in a P-256 coordinate, and in each half of an ES256 signature (RFC 7518, §3.4).
COORDINATE = 32


def b64url(data: bytes) -> str:
    """Base64url without padding, as JOSE writes binary data (RFC 7515, §2)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_decode(text: str) -> bytes:
    """The bytes that ``text`` holds in base64url without padding; ``ValueError`` for
    anything else, such as padding or characters outside the alphabet."""
    if not text.isascii() or "=" in text or len(text) % 4 == 1:
        raise ValueError("not base64url without padding")
    try:
        data = base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))
    except ValueError:
        raise ValueError("not base64url without padding") from None
    if b64url(data) != text:  # other characters, or bits left over in the last one
        raise ValueError("not base64url without padding")
    return data


def b64url_json(value: Any) -> str:
    """``value`` as compact JSON, then base64url: a part of a JWS."""
    return b64url(json.dumps(value, separators=(",", ":")).encode())


def p256_jwk(x: int, y: int) -> dict[str, str]:
    """The JWK of the P-256 public key at (``x``, ``y``) (RFC 7518, §6.2.1)."""
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": b64url(x.to_bytes(COORDINATE, "big")),
        "y": b64url(y.to_bytes(COORDINATE, "big")),
    }


def es256(r: int, s: int) -> bytes:
    """An ES256 signature as JWS writes it: r then s, each in 32 bytes (RFC 7518, §3.4)."""
    return r.to_bytes(COORDINATE, "big") + s.to_bytes(COORDINATE, "big")


def thumbprint(jwk: Mapping[str, str]) -> str:
    """The thumbprint of an elliptic-curve JWK (RFC 7638, §3.2): SHA-256 of its required
    members, in lexicographic order, without spaces."""
    members = {name: jwk[name] for name in ("crv", "kty", "x", "y")}
    canonical = json.dumps(members, separators=(",", ":"), sort_keys=True)
    return b64url(hashlib.sha256(canonical.encode()).digest())
