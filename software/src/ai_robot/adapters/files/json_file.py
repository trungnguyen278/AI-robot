# SPDX-License-Identifier: MIT
"""JSON files written whole or not at all, for the robot's state."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def read(path: Path) -> Any:
    """The JSON value in ``path``; ``None`` if there is no such file. ``OSError`` or
    ``ValueError`` if it cannot be read."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None


def write(path: Path, value: Any) -> None:
    """Write ``value`` as JSON to ``path``: in a new file beside the old one, then put in
    its place, so that a power cut leaves one or the other, never half of one."""
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False)
    handle, name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as file:
            file.write(text)
            file.flush()
            os.fsync(file.fileno())
        os.replace(name, path)
    except BaseException:
        Path(name).unlink(missing_ok=True)
        raise
