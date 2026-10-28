# SPDX-License-Identifier: MIT
"""The C++ functions and their Python fallbacks behave the same."""

from __future__ import annotations

import math
import random
import struct
from collections.abc import Callable

import pytest

from ai_robot import native

try:
    import ai_robot_native
except ImportError:
    ai_robot_native = None

needs_extension = pytest.mark.skipif(
    ai_robot_native is None, reason="C++ extension not installed (pip install ./native)"
)


@pytest.fixture(params=["python", pytest.param("c++", marks=needs_extension)])
def rms_int16(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> Callable:
    """``native.rms_int16``, forced to one implementation."""
    monkeypatch.setattr(native, "_native", ai_robot_native if request.param == "c++" else None)
    return native.rms_int16


def pcm(*samples: int) -> bytes:
    return struct.pack(f"<{len(samples)}h", *samples)


def test_known_values(rms_int16: Callable) -> None:
    assert rms_int16(b"") == 0.0
    assert rms_int16(pcm(0, 0, 0)) == 0.0
    assert rms_int16(pcm(1000, -1000)) == 1000.0
    assert rms_int16(pcm(32767, -32768)) == pytest.approx(math.sqrt((32767**2 + 32768**2) / 2))


def test_accepts_any_bytes_like_object(rms_int16: Callable) -> None:
    data = pcm(3, -4, 5)
    assert rms_int16(bytearray(data)) == rms_int16(memoryview(data)) == rms_int16(data)


def test_rejects_a_partial_sample(rms_int16: Callable) -> None:
    with pytest.raises(ValueError, match="whole 16-bit samples"):
        rms_int16(b"\x00\x01\x02")


@needs_extension
def test_both_implementations_agree() -> None:
    generator = random.Random(1)
    data = pcm(*(generator.randint(-32768, 32767) for _ in range(4096)))
    expected = native._rms_int16_python(memoryview(data))
    assert ai_robot_native.rms_int16(data) == pytest.approx(expected, rel=1e-12)


@pytest.fixture(params=["python", pytest.param("c++", marks=needs_extension)])
def scale_int16(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> Callable:
    """``native.scale_int16``, forced to one implementation."""
    monkeypatch.setattr(native, "_native", ai_robot_native if request.param == "c++" else None)
    return native.scale_int16


def test_scaling_known_values(scale_int16: Callable) -> None:
    assert scale_int16(b"", 0.5) == b""
    assert scale_int16(pcm(1000, -1000, 3, -3), 0.5) == pcm(500, -500, 1, -1)  # towards zero
    assert scale_int16(pcm(1000, -1000), 1.0) == pcm(1000, -1000)
    assert scale_int16(pcm(1000, -1000), 0.0) == pcm(0, 0)
    assert scale_int16(pcm(30000, -30000), 2.0) == pcm(32767, -32768)  # held within 16 bits


def test_scaling_refuses_a_partial_sample_or_a_negative_gain(scale_int16: Callable) -> None:
    with pytest.raises(ValueError, match="whole 16-bit samples"):
        scale_int16(b"\x00\x01\x02", 1.0)
    for gain in (-0.1, math.nan, math.inf):
        with pytest.raises(ValueError, match="gain"):
            scale_int16(pcm(1), gain)


@needs_extension
def test_both_scalings_agree() -> None:
    generator = random.Random(2)
    data = pcm(*(generator.randint(-32768, 32767) for _ in range(4096)))
    for gain in (0.0, 0.05, 0.37, 0.8, 1.0, 1.5):
        expected = native._scale_int16_python(memoryview(data), gain)
        assert ai_robot_native.scale_int16(data, gain) == expected
