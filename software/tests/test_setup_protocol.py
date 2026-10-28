# SPDX-License-Identifier: MIT
"""The set-up protocol's definitions: the schema is valid, the example follows it, and an
app can replay the example's exchange byte for byte."""

from __future__ import annotations

import json
from typing import Any

import jwt
import pytest

from ai_robot.core.config import protocol_dir
from ai_robot.core.data import Schema
from ai_robot.core.jose import b64url, b64url_decode
from ai_robot.core.setup_session import Records, _context, _session_keys
from ai_robot.core.spake2plus import Prover, Verifier, decode, record, stretch
from ai_robot.modules.cloud import REGISTRATION_TYPE

PROTOCOL = protocol_dir() / "setup"


def load(name: str) -> Any:
    return json.loads((PROTOCOL / name).read_text(encoding="utf-8"))


def schema(side: str) -> Schema:
    root = load("schema.json")
    return Schema("protocol/setup/schema.json", {**root, "$ref": f"#/$defs/from_{side}"})


EXAMPLE = load("examples/session.json")


def test_every_message_of_the_example_follows_the_schema() -> None:
    schemas = {"app": schema("app"), "robot": schema("robot")}
    for step in EXAMPLE["messages"]:
        assert schemas[step["from"]].problem(step["message"]) is None, step


def test_the_examples_exchange_replays() -> None:
    exchange = EXAMPLE["exchange"]
    messages = [step["message"] for step in EXAMPLE["messages"]]
    app_hello = exchange["app_hello"].encode("utf-8")
    robot_hello = exchange["robot_hello"].encode("utf-8")
    assert json.loads(app_hello) == messages[0] and json.loads(robot_hello) == messages[1]
    w0, w1 = stretch(exchange["code"].encode("ascii"), b64url_decode(exchange["salt"]))
    assert (f"{w0:064x}", f"{w1:064x}") == (exchange["w0"], exchange["w1"])
    context = _context(app_hello, robot_hello)
    assert context.hex() == exchange["context"]

    prover = Prover(context, w0, w1, scalar=int(exchange["x"], 16))
    assert b64url(prover.share) == messages[2]["share"]
    verifier = Verifier(context, w0, record(w1), scalar=int(exchange["y"], 16))
    share, confirmation = verifier.respond(prover.share)
    assert (b64url(share), b64url(confirmation)) == (messages[3]["share"], messages[3]["confirm"])
    confirm, shared = prover.finish(share, confirmation)
    assert b64url(confirm) == messages[4]["confirm"]
    assert verifier.finish(confirm) == shared

    app_key, robot_key = _session_keys(shared)
    assert (app_key.hex(), robot_key.hex()) == (exchange["app_key"], exchange["robot_key"])
    first = Records(app_key, robot_key).seal(json.dumps(messages[5]).encode("utf-8"))
    assert b64url(first) == exchange["first_encrypted"]


def test_the_examples_registration_is_signed_by_the_key_it_carries() -> None:
    register = next(m["message"] for m in EXAMPLE["messages"] if m["message"]["type"] == "register")
    signed = next(
        m["message"]["registration"]
        for m in EXAMPLE["messages"]
        if m["message"]["type"] == "registration"
    )
    header = jwt.get_unverified_header(signed)
    assert (header["alg"], header["typ"]) == ("ES256", REGISTRATION_TYPE)
    claims = jwt.decode(
        signed, jwt.PyJWK(header["jwk"]).key, algorithms=["ES256"], audience=register["server"]
    )
    assert claims["nonce"] == register["challenge"] and claims["iss"] == claims["sub"]
    decode(b"\x04" + b64url_decode(header["jwk"]["x"]) + b64url_decode(header["jwk"]["y"]))


@pytest.mark.parametrize(
    ("side", "message"),
    [
        ("app", {"type": "hello", "id": "a1"}),
        ("app", {"type": "hello", "id": "a1", "protocol": "one"}),
        ("app", {"type": "share", "id": "a2", "share": "too short"}),
        ("app", {"type": "join", "id": "a5", "ssid": "Home", "ssid_hex": "486f6d65"}),
        ("app", {"type": "join", "id": "a5"}),
        ("app", {"type": "join", "id": "a5", "ssid": "Home", "hidden": True}),
        ("app", {"type": "join", "id": "a5", "ssid": "Home", "password": ""}),
        ("app", {"type": "register", "id": "a6", "challenge": "short", "server": "https://x"}),
        ("app", {"type": "register", "id": "a6", "challenge": "c" * 22, "server": "ftp://x"}),
        ("robot", {"type": "hello", "id": "r1", "reply_to": "a1", "protocol": "1.0"}),
        ("robot", {"type": "info", "id": "r2", "reply_to": "a4", "bound": False}),
        ("robot", {"type": "joined", "id": "r3", "reply_to": "a5", "network": {"state": "up"}}),
        (
            "robot",
            {"type": "joined", "id": "r3", "reply_to": "a5", "network": {"state": "connected"}},
        ),
        ("robot", {"type": "networks", "id": "r4", "reply_to": "a5", "networks": [{"ssid": "x"}]}),
        ("robot", {"type": "error", "id": "r5", "code": "Busy!", "message": ""}),
        ("robot", {"type": "finished", "id": "r6"}),
    ],
)
def test_messages_that_break_the_schema_are_caught(side: str, message: dict[str, Any]) -> None:
    assert schema(side).problem(message) is not None


def test_a_message_of_a_newer_minor_version_passes() -> None:
    assert schema("app").problem({"type": "dance", "id": "a9", "steps": 3}) is None
