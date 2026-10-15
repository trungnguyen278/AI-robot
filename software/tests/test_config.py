# SPDX-License-Identifier: MIT
from __future__ import annotations

from pathlib import Path

import pytest

from ai_robot.core.config import (
    CONFIG_DIR_ENV,
    ConfigError,
    available_profiles,
    deep_merge,
    default_config_dir,
    get_table,
    load_config,
)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def test_profile_and_local_file_are_merged_over_base(tmp_path: Path) -> None:
    write(tmp_path / "base.toml", "[a]\nx = 1\ny = 1\nitems = [1, 2]\n[b]\nz = 1\n")
    write(tmp_path / "profiles" / "test.toml", "[a]\ny = 2\nitems = [3]\n")
    write(tmp_path / "local.toml", "[b]\nz = 3\n")
    assert load_config("test", tmp_path) == {"a": {"x": 1, "y": 2, "items": [3]}, "b": {"z": 3}}


def test_local_file_is_optional(tmp_path: Path) -> None:
    write(tmp_path / "base.toml", "x = 1\n")
    write(tmp_path / "profiles" / "test.toml", "")
    assert load_config("test", tmp_path) == {"x": 1}


def test_unknown_profile_lists_the_available_ones(tmp_path: Path) -> None:
    write(tmp_path / "base.toml", "")
    write(tmp_path / "profiles" / "one.toml", "")
    write(tmp_path / "profiles" / "two.toml", "")
    assert available_profiles(tmp_path) == ["one", "two"]
    with pytest.raises(ConfigError, match=r"unknown profile 'three' \(available: one, two\)"):
        load_config("three", tmp_path)


def test_missing_base_file(tmp_path: Path) -> None:
    with pytest.raises(ConfigError, match=r"base\.toml"):
        load_config("test", tmp_path)


def test_syntax_errors_name_the_file(tmp_path: Path) -> None:
    write(tmp_path / "base.toml", "")
    write(tmp_path / "profiles" / "test.toml", "[broken\n")
    with pytest.raises(ConfigError, match=r"test\.toml"):
        load_config("test", tmp_path)


def test_files_must_be_utf8(tmp_path: Path) -> None:
    (tmp_path / "base.toml").write_bytes("x = 1\n".encode("utf-16"))
    write(tmp_path / "profiles" / "test.toml", "")
    with pytest.raises(ConfigError, match=r"base\.toml"):
        load_config("test", tmp_path)


def test_get_table() -> None:
    assert get_table({"a": {"b": 1}}, "a") == {"b": 1}
    assert get_table({}, "a") == {}
    with pytest.raises(ConfigError, match=r"\[log\] must be a table"):
        get_table({"log": "DEBUG"}, "log")


def test_deep_merge_leaves_its_arguments_unchanged() -> None:
    base = {"a": {"x": 1}}
    override = {"a": {"y": 2}}
    assert deep_merge(base, override) == {"a": {"x": 1, "y": 2}}
    assert base == {"a": {"x": 1}}
    assert override == {"a": {"y": 2}}


def test_config_dir_from_the_environment(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(CONFIG_DIR_ENV, str(tmp_path))
    assert default_config_dir() == tmp_path


def test_default_config_dir_is_in_this_checkout() -> None:
    assert (default_config_dir() / "base.toml").is_file()
