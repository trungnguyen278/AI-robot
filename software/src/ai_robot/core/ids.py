# SPDX-License-Identifier: MIT
"""Identifiers the robot makes: UUIDs, made as UUIDv7 (ai-platform ADR-0004)."""

from __future__ import annotations

import secrets
import time
import uuid

# Fixed by RFC 9562, §5.7: UUIDv7's version and variant, and the size of its parts.
VERSION = 0b0111
VARIANT = 0b10
TIME_BITS = 48  # the Unix time, in milliseconds
RANDOM_A_BITS = 12
RANDOM_B_BITS = 62


def uuid7() -> str:
    """A new UUIDv7 (RFC 9562, §5.7): the Unix time in milliseconds, then random bits,
    so that identifiers sort by when they were made."""
    milliseconds = time.time_ns() // 1_000_000 & (2**TIME_BITS - 1)
    value = (
        milliseconds << 80
        | VERSION << 76
        | secrets.randbits(RANDOM_A_BITS) << 64
        | VARIANT << 62
        | secrets.randbits(RANDOM_B_BITS)
    )
    return str(uuid.UUID(int=value))
