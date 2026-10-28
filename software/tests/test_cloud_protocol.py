# SPDX-License-Identifier: MIT
"""The cloud link's definitions, as this repository pins them (platform/protocols/cloud):
the schema is valid, the examples follow it, and it catches what the robot relies on it
to catch."""

from __future__ import annotations

import json
from typing import Any

import pytest

from ai_robot.core.config import platform_dir
from ai_robot.core.data import Schema

PROTOCOL = platform_dir() / "cloud"
# Who sends each message of the examples, and the schema of what they send.
SENDERS = {
    "device": "from_device",
    "cloud": "from_cloud",
    "agent": "from_agent",
    "device_in_room": "from_device_in_room",
}


def load(name: str) -> Any:
    return json.loads((PROTOCOL / name).read_text(encoding="utf-8"))


def schema(name: str) -> Schema:
    """The schema of ``$defs/<name>``."""
    return Schema(f"$defs/{name}", {**load("schema.json"), "$ref": f"#/$defs/{name}"})


EXAMPLES = sorted(path.name for path in (PROTOCOL / "examples").glob("*.json"))


def test_there_are_examples() -> None:
    assert {"session.json", "resume.json", "conversation.json"} <= set(EXAMPLES)


@pytest.mark.parametrize("name", EXAMPLES)
def test_every_message_of_the_examples_follows_the_schema(name: str) -> None:
    schemas = {sender: schema(definition) for sender, definition in SENDERS.items()}
    for step in load(f"examples/{name}")["messages"]:
        if "message" in step:  # not an audio step
            assert schemas[step["from"]].problem(step["message"]) is None, step


def test_messages_that_break_the_schema_are_caught() -> None:
    device, cloud = schema("from_device"), schema("from_cloud")
    hello = next(
        step["message"]
        for step in load("examples/session.json")["messages"]
        if step["from"] == "device" and step["message"]["type"] == "hello"
    )
    assert device.problem({**hello, "conversations": "yes"}) is not None
    assert device.problem({key: value for key, value in hello.items() if key != "languages"})
    assert cloud.problem({"type": "mcp", "seq": 3, "payload": {"jsonrpc": "1.0"}}) is not None
    assert cloud.problem({"type": "mcp", "payload": {"jsonrpc": "2.0"}}) is not None  # no number
    assert cloud.problem({"type": "pong"}) is not None  # it says what was received
    assert device.problem({"type": "event", "seq": 1, "name": "a", "time": 0, "data": {}})
    assert device.problem({"seq": 1}) is not None  # no type
    # A type the schema does not know is allowed, for newer minor versions.
    assert cloud.problem({"type": "mood.changed", "seq": 9, "mood": "calm"}) is None
