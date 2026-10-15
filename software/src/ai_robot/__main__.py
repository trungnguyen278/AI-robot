# SPDX-License-Identifier: MIT
"""Command line: ``ai-robot`` or ``python -m ai_robot``."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import logging
import os
import signal
import sys
from collections.abc import Sequence
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

from ai_robot.app import App
from ai_robot.core.config import CONFIG_DIR_ENV, ConfigError, load_config

PROFILE_ENV = "AI_ROBOT_PROFILE"
LOG_FORMAT = "%(asctime)s %(levelname)-7s %(name)s: %(message)s"

log = logging.getLogger("ai_robot")


def main(argv: Sequence[str] | None = None) -> int:
    """Run the robot; return the exit status (0: stopped normally, 1: error, 2: bad
    configuration)."""
    args = _parse_args(argv)
    try:
        config = load_config(args.profile, args.config_dir)
        level = _log_level(args.log_level or config.get("log", {}).get("level", "INFO"))
        app = App(config)
        app.build()
    except ConfigError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    logging.basicConfig(level=level, format=LOG_FORMAT)
    log.info("starting %r with profile %r", app.robot.display_name, args.profile)
    try:
        asyncio.run(_run(app, args.duration))
    except KeyboardInterrupt:
        pass  # Ctrl+C where signal handlers are unavailable (Windows); already stopped
    except Exception:
        log.exception("stopped by an error")
        return 1
    return 0


async def _run(app: App, duration: float | None) -> None:
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        # Unavailable on Windows and outside the main thread.
        with contextlib.suppress(NotImplementedError, RuntimeError):
            loop.add_signal_handler(sig, stop.set)
    if duration is not None:
        loop.call_later(duration, stop.set)
    await app.run(stop)


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="ai-robot", description="Run the robot.")
    parser.add_argument(
        "--profile",
        default=os.environ.get(PROFILE_ENV, "desktop"),
        help=f"configuration profile (default: ${PROFILE_ENV}, or desktop)",
    )
    parser.add_argument(
        "--config-dir",
        type=Path,
        help=f"configuration directory (default: ${CONFIG_DIR_ENV}, or software/config)",
    )
    parser.add_argument(
        "--duration", type=float, metavar="SECONDS", help="stop after this many seconds"
    )
    parser.add_argument(
        "--log-level",
        type=str.upper,
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="override the level set in the configuration",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {_version()}")
    return parser.parse_args(argv)


def _version() -> str:
    try:
        return version("ai-robot")
    except PackageNotFoundError:
        return "(not installed)"


def _log_level(name: object) -> int:
    level = logging.getLevelNamesMapping().get(str(name).upper())
    if level is None:
        raise ConfigError(f"log.level: unknown level {name!r}")
    return level


if __name__ == "__main__":
    sys.exit(main())
