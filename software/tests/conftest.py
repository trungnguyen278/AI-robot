# SPDX-License-Identifier: MIT
from __future__ import annotations

import os
import shutil
from collections.abc import Iterator
from pathlib import Path

import pytest
from local_servers import free_ports, running

SOFTWARE_DIR = Path(__file__).resolve().parents[1]
TPM_START_SECONDS = 10.0  # how long a software TPM may take to listen


@pytest.fixture(autouse=True)
def _ignore_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep the developer's own settings out of the tests."""
    monkeypatch.delenv("AI_ROBOT_CONFIG_DIR", raising=False)
    monkeypatch.delenv("AI_ROBOT_PROFILE", raising=False)
    monkeypatch.delenv("AI_ROBOT_PROTOCOL_DIR", raising=False)
    monkeypatch.delenv("AI_ROBOT_PLATFORM_DIR", raising=False)


@pytest.fixture
def shipped_config(tmp_path: Path) -> Path:
    """A copy of software/config, without the developer's local.toml."""
    target = tmp_path / "config"
    shutil.copytree(SOFTWARE_DIR / "config", target, ignore=shutil.ignore_patterns("local.toml"))
    return target


@pytest.fixture
def tpm(tmp_path: Path) -> Iterator[str]:
    """A software TPM, new for each test; the TCTI that reaches it.

    The tests need tpm2-pytss (the tpm extra) and swtpm: the path to it in the
    environment variable SWTPM, or the program on the PATH. Without them they are
    skipped. The software workflow installs both, so they always run in CI.
    """
    pytest.importorskip("tpm2_pytss", reason="tpm2-pytss is not installed (the tpm extra)")
    program = os.environ.get("SWTPM") or shutil.which("swtpm")
    if not program:
        pytest.skip("no software TPM: set SWTPM, or put swtpm on the PATH")
    port = free_ports(2)  # the TPM's commands, then its control channel, as the TCTI expects
    state = tmp_path / "tpm"
    state.mkdir()
    command = [
        program,
        "socket",
        "--tpm2",
        "--server",
        f"type=tcp,port={port},bindaddr=127.0.0.1",
        "--ctrl",
        f"type=tcp,port={port + 1},bindaddr=127.0.0.1",
        "--tpmstate",
        f"dir={state}",
        "--flags",
        "not-need-init,startup-clear",
    ]
    with running(command, port, tmp_path / "swtpm.log", TPM_START_SECONDS):
        yield f"swtpm:host=127.0.0.1,port={port}"
