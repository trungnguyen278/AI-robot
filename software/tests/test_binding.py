# SPDX-License-Identifier: MIT
"""The robot's binding kept in a file: what a restart finds, and what a broken file means."""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

import pytest

from ai_robot.adapters.files.binding import FileBindingStore
from ai_robot.ports import Binding


def test_no_file_is_no_binding(tmp_path: Path) -> None:
    store = FileBindingStore(path=str(tmp_path / "binding.json"))
    assert asyncio.run(store.load()) == Binding()


def test_a_saved_binding_is_found_again(tmp_path: Path) -> None:
    path = tmp_path / "state" / "ai-robot" / "binding.json"  # folders made as needed
    store = FileBindingStore(path=str(path))
    asyncio.run(store.save(Binding("https://cloud.example", True)))
    assert asyncio.run(FileBindingStore(path=str(path)).load()) == Binding(
        "https://cloud.example", True
    )
    asyncio.run(store.save(Binding("https://cloud.example", False)))
    assert asyncio.run(store.load()) == Binding("https://cloud.example", False)
    assert [p.name for p in path.parent.iterdir()] == ["binding.json"]  # nothing left over


@pytest.mark.parametrize(
    "content",
    ["not json", "[]", json.dumps({"server": 7, "bound": True}), json.dumps({"server": None})],
)
def test_a_file_that_is_not_a_binding_counts_as_none(
    tmp_path: Path, content: str, caplog: pytest.LogCaptureFixture
) -> None:
    path = tmp_path / "binding.json"
    path.write_text(content, encoding="utf-8")
    with caplog.at_level(logging.ERROR):
        assert asyncio.run(FileBindingStore(path=str(path)).load()) == Binding()
    assert "binding" in caplog.text


def test_the_path_is_needed() -> None:
    with pytest.raises(ValueError, match="path"):
        FileBindingStore(path="")
