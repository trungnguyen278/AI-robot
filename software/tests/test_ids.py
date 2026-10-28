# SPDX-License-Identifier: MIT
"""The identifiers the robot makes: UUIDv7 (RFC 9562, §5.7)."""

from __future__ import annotations

import time
import uuid

from ai_robot.core.ids import uuid7


def test_a_uuid7_carries_its_version_its_variant_and_the_time() -> None:
    before = time.time_ns() // 1_000_000
    made = uuid.UUID(uuid7())
    after = time.time_ns() // 1_000_000
    assert made.version == 7
    assert made.variant == uuid.RFC_4122
    assert before <= made.int >> 80 <= after  # the Unix time, in milliseconds


def test_uuid7s_differ_and_sort_by_when_they_were_made() -> None:
    first = uuid7()
    time.sleep(0.002)
    second = uuid7()
    assert first != second
    assert first < second
    assert len({uuid7() for _ in range(1000)}) == 1000
