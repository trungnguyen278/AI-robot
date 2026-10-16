# SPDX-License-Identifier: MIT
"""Plain JSON data: read-only copies, encoding, and checks against a JSON Schema.

Data that crosses a boundary (scene data for the screen, capability arguments and
results, events for the cloud) is made of JSON values only, and checked where it is
made, so that a bad value fails at its publisher rather than inside another module.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from types import MappingProxyType
from typing import Any

from jsonschema import Draft202012Validator, validators
from jsonschema.exceptions import SchemaError, best_match


def frozen(name: str, data: Mapping[str, Any]) -> Mapping[str, Any]:
    """A deep, read-only copy of ``data``, made of JSON values only.

    Mappings become read-only mappings and lists become tuples, so that nobody can
    change what others hold. Raises ``ValueError``, naming ``name``, for data that does
    not convert to JSON: keys that are not strings, numbers that are not finite (JSON has
    no NaN), other objects such as dates.
    """
    if not isinstance(data, Mapping):
        raise ValueError(f"{name} must be a mapping, got {type(data).__name__}")
    try:
        text = json.dumps(data, allow_nan=False, default=_thaw)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{name} must convert to JSON: {error}") from None
    return _freeze(json.loads(text))


def encode(value: Any) -> str:
    """The JSON text of ``value``. Read-only mappings encode as objects and tuples as
    arrays; NaN is refused, as JSON has none and the receiver would drop the message."""
    return json.dumps(value, allow_nan=False, default=_thaw)


def plain(value: Any) -> Any:
    """``value`` with read-only mappings and tuples turned back into dicts and lists."""
    return json.loads(encode(value))


def _thaw(value: Any) -> Any:
    """For ``json.dumps``: read-only mappings convert like dicts; nothing else does."""
    if isinstance(value, Mapping):
        return dict(value)
    raise TypeError(f"{type(value).__name__} is not JSON")


def _freeze(value: Any) -> Any:
    if isinstance(value, dict):
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    return value


# Read-only mappings and tuples pass as JSON objects and arrays.
_Validator = validators.extend(
    Draft202012Validator,
    type_checker=Draft202012Validator.TYPE_CHECKER.redefine_many(
        {
            "object": lambda _, value: isinstance(value, Mapping),
            "array": lambda _, value: isinstance(value, list | tuple),
        }
    ),
)


class Schema:
    """A JSON Schema (2020-12 unless it names another dialect), checked when it is
    made: ``ValueError`` names ``name`` if it is not a valid schema."""

    def __init__(self, name: str, schema: Mapping[str, Any]) -> None:
        self.schema = plain(schema)
        try:
            _Validator.check_schema(self.schema)
        except SchemaError as error:
            raise ValueError(f"{name} is not a valid JSON Schema: {error.message}") from None
        self._validator = _Validator(self.schema)

    def problem(self, instance: Any) -> str | None:
        """What is wrong with ``instance``, or ``None`` if it matches."""
        error = best_match(self._validator.iter_errors(instance))
        if error is None:
            return None
        where = ".".join(str(part) for part in error.absolute_path)
        return f"{where}: {error.message}" if where else error.message
