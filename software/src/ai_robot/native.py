# SPDX-License-Identifier: MIT
"""Speed-critical functions: C++ when the extension is installed, Python otherwise.

The C++ extension (``software/native``) is optional; ``pip install ./native`` builds
and installs it. Each function gives the same results either way, and
``tests/test_native.py`` checks that the two implementations agree.
"""

from __future__ import annotations

import math
import sys
from array import array

try:
    import ai_robot_native as _native
except ImportError:
    _native = None

AVAILABLE = _native is not None
"""Whether the C++ extension is in use."""


def rms_int16(pcm: bytes | bytearray | memoryview) -> float:
    """Root mean square of signed 16-bit little-endian PCM samples (0.0 if empty)."""
    data = memoryview(pcm).cast("B")
    if _native is not None:
        return _native.rms_int16(data)
    return _rms_int16_python(data)


def _rms_int16_python(data: memoryview) -> float:
    if len(data) % 2:
        raise ValueError("PCM data must contain whole 16-bit samples")
    samples = array("h")
    samples.frombytes(data)
    if sys.byteorder == "big":
        samples.byteswap()
    if not samples:
        return 0.0
    return math.sqrt(sum(sample * sample for sample in samples) / len(samples))


def scale_int16(pcm: bytes | bytearray | memoryview, gain: float) -> bytes:
    """Signed 16-bit little-endian PCM samples multiplied by ``gain``, from 0: each one
    truncated towards zero, and held within 16 bits."""
    if not (math.isfinite(gain) and gain >= 0):
        raise ValueError(f"gain must be a finite number from 0, got {gain!r}")
    data = memoryview(pcm).cast("B")
    if _native is not None:
        return _native.scale_int16(data, gain)
    return _scale_int16_python(data, gain)


def _scale_int16_python(data: memoryview, gain: float) -> bytes:
    if len(data) % 2:
        raise ValueError("PCM data must contain whole 16-bit samples")
    samples = array("h")
    samples.frombytes(data)
    if sys.byteorder == "big":
        samples.byteswap()
    scaled = array("h", (max(-32768, min(32767, int(sample * gain))) for sample in samples))
    if sys.byteorder == "big":
        scaled.byteswap()
    return scaled.tobytes()
