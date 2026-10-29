# SPDX-License-Identifier: MIT
"""Servers that tests run on this computer: a software TPM, a LiveKit server."""

from __future__ import annotations

import contextlib
import shlex
import socket
import subprocess
import time
from collections.abc import Iterator, Sequence
from pathlib import Path


def free_port() -> int:
    """A TCP port that nothing listens on, on this computer."""
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def free_udp_port() -> int:
    """A UDP port that nothing uses, on this computer. Asked of the system for UDP: a
    TCP port may fall in a range that Windows keeps for UDP (``netsh int ipv4 show
    excludedportrange protocol=udp``)."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def free_ports(count: int) -> int:
    """The first of ``count`` free TCP ports in a row, for servers that take more than one
    (a software TPM listens on its port and the next)."""
    for _ in range(100):
        first = free_port()
        try:
            with contextlib.ExitStack() as probes:
                for port in range(first + 1, first + count):
                    probe = probes.enter_context(socket.socket())
                    probe.bind(("127.0.0.1", port))
        except OSError:
            continue
        return first
    raise RuntimeError(f"found no {count} free ports in a row")


@contextlib.contextmanager
def running(
    command: Sequence[str], port: int, log: Path, timeout: float
) -> Iterator[subprocess.Popen[bytes]]:
    """Run ``command`` for the length of the block, once it listens on ``port``.

    What it prints goes to ``log``. If it stops, or does not listen within ``timeout``
    seconds, ``RuntimeError`` says what it printed.
    """
    with log.open("wb") as output:
        process = subprocess.Popen(command, stdout=output, stderr=subprocess.STDOUT)
    try:
        deadline = time.monotonic() + timeout
        while True:
            try:
                socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
                break
            except OSError:
                if process.poll() is not None or time.monotonic() > deadline:
                    said = log.read_text(encoding="utf-8", errors="replace")[-2000:]
                    message = f"{shlex.join(command)} did not start:\n{said}"
                    raise RuntimeError(message) from None
                time.sleep(0.1)
        yield process
    finally:
        process.terminate()
        process.wait(timeout=timeout)
