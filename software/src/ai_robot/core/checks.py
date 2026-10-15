# SPDX-License-Identifier: MIT
"""Checks for numbers that come from the configuration or from callers."""

from __future__ import annotations

import math


def finite(name: str, value: float) -> float:
    """``value`` if it is a finite number; otherwise ``ValueError``."""
    if not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number, got {value!r}")
    return value


def positive(name: str, value: float) -> float:
    """``value`` if it is a finite number above zero; otherwise ``ValueError``."""
    if not (math.isfinite(value) and value > 0):
        raise ValueError(f"{name} must be a positive number, got {value!r}")
    return value
