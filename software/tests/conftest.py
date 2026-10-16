# SPDX-License-Identifier: MIT
from __future__ import annotations

import shutil
from pathlib import Path

import pytest

SOFTWARE_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def _ignore_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep the developer's own settings out of the tests."""
    monkeypatch.delenv("AI_ROBOT_CONFIG_DIR", raising=False)
    monkeypatch.delenv("AI_ROBOT_PROFILE", raising=False)
    monkeypatch.delenv("AI_ROBOT_PROTOCOL_DIR", raising=False)
    monkeypatch.delenv("AI_ROBOT_CLOUD_TOKEN", raising=False)


@pytest.fixture
def shipped_config(tmp_path: Path) -> Path:
    """A copy of software/config, without the developer's local.toml."""
    target = tmp_path / "config"
    shutil.copytree(SOFTWARE_DIR / "config", target, ignore=shutil.ignore_patterns("local.toml"))
    return target
