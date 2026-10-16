# SPDX-License-Identifier: MIT
"""Plain JSON data: read-only copies, encoding and JSON Schema checks."""

from __future__ import annotations

import json
import math
from datetime import date

import pytest

from ai_robot.core.data import Schema, encode, frozen, plain


def test_frozen_is_a_deep_read_only_copy() -> None:
    days = [18, {"high": 19}]
    data = frozen("data", {"days": days})
    days.append(20)
    assert data["days"] == (18, {"high": 19})
    with pytest.raises(TypeError):
        data["days"][1]["high"] = 0  # type: ignore[index]


@pytest.mark.parametrize("data", [{"t": math.nan}, {(1, 2): 3}, {"day": date(2026, 10, 17)}, []])
def test_frozen_refuses_what_is_not_json(data: object) -> None:
    with pytest.raises(ValueError, match="result must"):
        frozen("result", data)  # type: ignore[arg-type]


def test_encode_and_plain_undo_frozen() -> None:
    data = frozen("data", {"a": [1, {"b": None}], "c": "é"})
    assert json.loads(encode(data)) == plain(data) == {"a": [1, {"b": None}], "c": "é"}
    with pytest.raises(ValueError):
        encode({"t": math.inf})


def test_schema_accepts_frozen_data_and_says_what_is_wrong() -> None:
    schema = Schema(
        "test",
        {
            "type": "object",
            "properties": {"tags": {"type": "array", "items": {"type": "string"}}},
            "required": ["tags"],
        },
    )
    assert schema.problem(frozen("data", {"tags": ["a"]})) is None
    assert schema.problem({"tags": ["a", 2]}) == "tags.1: 2 is not of type 'string'"
    assert schema.problem({}) == "'tags' is a required property"


def test_invalid_schemas_are_refused() -> None:
    with pytest.raises(ValueError, match="test is not a valid JSON Schema"):
        Schema("test", {"type": "thing"})
