# SPDX-License-Identifier: MIT
"""Images and colours, shared by the camera and lights ports."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

Color = tuple[int, int, int]
"""Red, green and blue, from 0 to 255 each."""


def check_color(color: Sequence[int]) -> Color:
    """Return ``color`` as a tuple; raise ``ValueError`` if it is not a valid colour."""
    if len(color) != 3 or not all(isinstance(c, int) and 0 <= c <= 255 for c in color):
        raise ValueError(f"invalid colour {color!r}: expected three integers from 0 to 255")
    red, green, blue = color
    return (red, green, blue)


@dataclass(frozen=True, slots=True)
class Image:
    """An 8-bit RGB image: ``width * height * 3`` bytes, row by row from the top left."""

    width: int
    height: int
    data: bytes

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValueError(f"invalid image size {self.width}x{self.height}")
        if len(self.data) != self.width * self.height * 3:
            raise ValueError(
                f"{self.width}x{self.height} RGB image needs {self.width * self.height * 3} "
                f"bytes, got {len(self.data)}"
            )

    @classmethod
    def filled(cls, width: int, height: int, color: Color) -> Image:
        """An image of one colour."""
        return cls(width, height, bytes(check_color(color)) * (width * height))
