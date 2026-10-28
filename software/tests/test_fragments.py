# SPDX-License-Identifier: MIT
"""Set-up messages split into Bluetooth fragments, and joined again."""

from __future__ import annotations

import pytest

from ai_robot.adapters.bluez.fragments import FIRST, LAST, FragmentError, Joiner, split
from ai_robot.core.setup_session import MAX_MESSAGE


@pytest.mark.parametrize("mtu", [23, 24, 185, 517])
@pytest.mark.parametrize("size", [1, 16, 17, 18, 400, MAX_MESSAGE])
def test_a_message_comes_back_whole(mtu: int, size: int) -> None:
    message = bytes(i % 251 for i in range(size))
    fragments = split(message, mtu)
    assert all(len(fragment) <= mtu - 3 for fragment in fragments)
    assert fragments[0][0] & FIRST and fragments[-1][0] & LAST
    joiner = Joiner()
    assert [joiner.add(f) for f in fragments[:-1]] == [None] * (len(fragments) - 1)
    assert joiner.add(fragments[-1]) == message
    assert joiner.add(split(b"next", mtu)[0]) == b"next"  # ready for the next message


def test_the_smallest_mtu_leaves_twenty_bytes() -> None:
    first, *rest = split(b"x" * 40, 23)
    assert first == bytes([FIRST, 0, 40]) + b"x" * 17
    assert [len(f) for f in rest] == [20, 5]  # 19 bytes, then 4, each after its flags


@pytest.mark.parametrize(
    ("fragments", "problem"),
    [
        ([bytes([0x01])], "unknown flags"),
        ([b""], "unknown flags"),
        ([bytes([LAST]) + b"x"], "no first one"),
        ([bytes([FIRST, 0])], "too short for the length"),
        ([bytes([FIRST | LAST, 0, 0])], "1 to 8192 bytes"),
        ([bytes([FIRST | LAST]) + (MAX_MESSAGE + 1).to_bytes(2, "big")], "1 to 8192 bytes"),
        ([bytes([FIRST, 0, 4]) + b"ab", bytes([FIRST, 0, 2]) + b"ab"], "within a message"),
        ([bytes([FIRST, 0, 2]) + b"abc"], "longer than its length"),
        ([bytes([FIRST | LAST, 0, 3]) + b"ab"], "shorter than its length"),
    ],
)
def test_fragments_that_do_not_fit_are_refused(fragments: list[bytes], problem: str) -> None:
    joiner = Joiner()
    with pytest.raises(FragmentError, match=problem):
        for fragment in fragments:
            joiner.add(fragment)


def test_messages_too_long_or_empty_are_not_sent() -> None:
    for message in (b"", b"x" * (MAX_MESSAGE + 1)):
        with pytest.raises(ValueError, match="1 to 8192 bytes"):
            split(message, 185)
    with pytest.raises(ValueError, match="no room"):
        split(b"x", 6)
