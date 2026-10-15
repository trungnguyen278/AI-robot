# SPDX-License-Identifier: MIT
"""Configuration: ``base.toml``, then a profile, then an optional local file.

A configuration directory holds ``base.toml`` (shared by all profiles),
``profiles/<name>.toml`` (one per way of running the robot) and an optional,
git-ignored ``local.toml`` (settings for one machine). They are merged in that order.
"""

from __future__ import annotations

import os
import tomllib
from collections.abc import Mapping
from pathlib import Path
from typing import Any

CONFIG_DIR_ENV = "AI_ROBOT_CONFIG_DIR"


class ConfigError(Exception):
    """The configuration is missing, malformed or inconsistent."""


def default_config_dir() -> Path:
    """``$AI_ROBOT_CONFIG_DIR`` if set, otherwise the ``config`` folder of this checkout."""
    if value := os.environ.get(CONFIG_DIR_ENV):
        return Path(value)
    # src/ai_robot/core/config.py -> software/config
    return Path(__file__).resolve().parents[3] / "config"


def available_profiles(config_dir: Path) -> list[str]:
    """Names of the profiles in ``config_dir``."""
    return sorted(path.stem for path in (config_dir / "profiles").glob("*.toml"))


def load_config(profile: str, config_dir: Path | None = None) -> dict[str, Any]:
    """Load ``base.toml`` and merge ``profiles/<profile>.toml`` and ``local.toml`` on top."""
    config_dir = default_config_dir() if config_dir is None else config_dir
    base = config_dir / "base.toml"
    if not base.is_file():
        raise ConfigError(f"{base} not found (use --config-dir or {CONFIG_DIR_ENV})")
    profile_file = config_dir / "profiles" / f"{profile}.toml"
    if not profile_file.is_file():
        available = ", ".join(available_profiles(config_dir)) or "none"
        raise ConfigError(f"unknown profile {profile!r} (available: {available})")
    config = deep_merge(_read(base), _read(profile_file))
    local = config_dir / "local.toml"
    if local.is_file():
        config = deep_merge(config, _read(local))
    return config


def get_table(parent: Mapping[str, Any], key: str, where: str | None = None) -> Mapping[str, Any]:
    """The table ``parent[key]``, or an empty one if it is missing.

    ``where`` names the table in error messages; it defaults to ``key``.
    """
    value = parent.get(key, {})
    if not isinstance(value, Mapping):
        raise ConfigError(f"[{where or key}] must be a table")
    return value


def deep_merge(base: Mapping[str, Any], override: Mapping[str, Any]) -> dict[str, Any]:
    """Return ``base`` updated with ``override``.

    Tables present in both are merged key by key; any other value, lists included, is
    replaced. Neither argument is modified.
    """
    merged = dict(base)
    for key, value in override.items():
        current = merged.get(key)
        if isinstance(current, Mapping) and isinstance(value, Mapping):
            merged[key] = deep_merge(current, value)
        else:
            merged[key] = value
    return merged


def _read(path: Path) -> dict[str, Any]:
    try:
        with path.open("rb") as file:
            return tomllib.load(file)
    except (tomllib.TOMLDecodeError, UnicodeDecodeError) as error:
        raise ConfigError(f"{path}: {error}") from None
