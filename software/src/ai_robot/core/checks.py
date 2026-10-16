# SPDX-License-Identifier: MIT
"""Checks for values that come from the configuration or from callers."""

from __future__ import annotations

import math
from datetime import datetime, time


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


def within(name: str, value: float, low: float, high: float) -> float:
    """``value`` if it is a number from ``low`` to ``high``; otherwise ``ValueError``."""
    if not (math.isfinite(value) and low <= value <= high):
        raise ValueError(f"{name} must be from {low} to {high}, got {value!r}")
    return value


def time_of_day(name: str, text: str) -> time:
    """``text``, written "HH:MM", as a time of day; otherwise ``ValueError``."""
    try:
        return datetime.strptime(text, "%H:%M").time()
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a time of day such as '18:00', got {text!r}") from None
