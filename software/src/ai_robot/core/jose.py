# SPDX-License-Identifier: MIT
"""Pieces of JOSE, the JSON formats for signing (RFC 7515 to RFC 7518 and RFC 7638)."""

from __future__ import annotations

import base64
import hashlib
import json
from collections.abc import Mapping
from typing import Any


def b64url(data: bytes) -> str:
    """Base64url without padding, as JOSE writes binary data (RFC 7515, §2)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_json(value: Any) -> str:
    """``value`` as compact JSON, then base64url: a part of a JWS."""
    return b64url(json.dumps(value, separators=(",", ":")).encode())


def thumbprint(jwk: Mapping[str, str]) -> str:
    """The thumbprint of an elliptic-curve JWK (RFC 7638, §3.2): SHA-256 of its required
    members, in lexicographic order, without spaces."""
    members = {name: jwk[name] for name in ("crv", "kty", "x", "y")}
    canonical = json.dumps(members, separators=(",", ":"), sort_keys=True)
    return b64url(hashlib.sha256(canonical.encode()).digest())
