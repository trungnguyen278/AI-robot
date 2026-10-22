# SPDX-License-Identifier: MIT
"""The cloud protocol's definitions: the schema is valid and the examples follow it."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from ai_robot.core.data import Schema

PROTOCOL = Path(__file__).resolve().parents[2] / "protocol" / "cloud"


def load(name: str) -> Any:
    return json.loads((PROTOCOL / name).read_text(encoding="utf-8"))


def schema(direction: str) -> Schema:
    """The schema of the messages from ``direction``: robot or cloud."""
    root = load("schema.json")
    return Schema(f"from_{direction}", {**root, "$ref": f"#/$defs/from_{direction}"})


EXAMPLES = sorted(path.name for path in (PROTOCOL / "examples").glob("*.json"))


def test_there_are_examples() -> None:
    assert {"session.json", "turn.json"} <= set(EXAMPLES)


@pytest.mark.parametrize("name", EXAMPLES)
def test_every_message_of_the_examples_follows_the_schema(name: str) -> None:
    schemas = {"robot": schema("robot"), "cloud": schema("cloud")}
    ids: dict[str, set[str]] = {"robot": set(), "cloud": set()}
    for step in load(f"examples/{name}")["messages"]:
        sender = step["from"]
        if "message" not in step:
            continue  # an audio step: what plays on a track, not a message
        message = step["message"]
        assert schemas[sender].problem(message) is None, message
        assert message["id"] not in ids[sender], f"{message['id']} is used twice"
        ids[sender].add(message["id"])


def test_messages_that_break_the_schema_are_caught() -> None:
    robot, cloud = schema("robot"), schema("cloud")
    hello = load("examples/session.json")["messages"][1]["message"]
    assert cloud.problem({**hello, "conversations": "yes"}) is not None
    assert cloud.problem({key: value for key, value in hello.items() if key != "session"})
    assert cloud.problem({"type": "mcp", "id": "c9", "payload": {"jsonrpc": "1.0"}})
    assert robot.problem({"type": "event", "id": "x" * 65, "name": "a", "time": 0, "data": {}})
    assert robot.problem({"id": "r1"}) is not None  # no type
    # A type the schema does not know is allowed, for newer minor versions.
    assert cloud.problem({"type": "mood.changed", "id": "c9", "mood": "calm"}) is None
