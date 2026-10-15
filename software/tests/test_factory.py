# SPDX-License-Identifier: MIT
from __future__ import annotations

import math
from collections.abc import Sequence

import pytest

from ai_robot.core.checks import positive
from ai_robot.core.config import ConfigError
from ai_robot.core.factory import create, import_object


class Example:
    def __init__(
        self,
        *,
        count: int = 1,
        rate: float = 1.0,
        name: str = "",
        enabled: bool = False,
        items: Sequence[str] = (),
        limit: float | None = None,
    ) -> None:
        positive("rate", rate)
        self.count, self.rate, self.name = count, rate, name
        self.enabled, self.items, self.limit = enabled, items, limit


def test_valid_settings_create_the_object() -> None:
    example = create(Example, "table", count=2, rate=3, items=["a"], limit=None, enabled=True)
    assert (example.count, example.rate, example.items) == (2, 3, ["a"])


@pytest.mark.parametrize(
    ("settings", "message"),
    [
        ({"count": 2.0}, "count must be int, got 2.0"),
        ({"count": True}, "count must be int"),
        ({"rate": "fast"}, "rate must be float"),
        ({"name": 5}, "name must be str"),
        ({"items": 5}, "items must be Sequence"),
        ({"limit": "x"}, "limit must be float | None"),
        ({"rate": math.nan}, "rate must be a positive number"),
        ({"cuont": 2}, "unexpected keyword argument 'cuont'"),
    ],
)
def test_configuration_mistakes_name_the_table(settings: dict[str, object], message: str) -> None:
    with pytest.raises(ConfigError) as caught:
        create(Example, "ports.example", **settings)
    assert str(caught.value).startswith("ports.example: ")
    assert message in str(caught.value)


def test_import_object() -> None:
    assert import_object("ai_robot.core.factory:create") is create
    assert import_object(Example) is Example
    with pytest.raises(ValueError):
        import_object("no_colon")
