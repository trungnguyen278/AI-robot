# SPDX-License-Identifier: MIT
from __future__ import annotations

from pathlib import Path

import pytest

from ai_robot.__main__ import main


def test_runs_the_desktop_profile(shipped_config: Path) -> None:
    args = ["--profile", "desktop", "--config-dir", str(shipped_config), "--duration", "0.2"]
    assert main(args) == 0


def test_unknown_profile(shipped_config: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--profile", "nope", "--config-dir", str(shipped_config)]) == 2
    assert "unknown profile 'nope'" in capsys.readouterr().err


def test_version(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as caught:
        main(["--version"])
    assert caught.value.code == 0
    assert capsys.readouterr().out.startswith("ai-robot ")
