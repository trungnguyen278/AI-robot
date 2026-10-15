# SPDX-License-Identifier: MIT
"""Creating modules and adapters from the registries and the configuration."""

from __future__ import annotations

import importlib
import inspect
import types
import typing
from collections.abc import Mapping
from typing import Any, TypeVar

from ai_robot.core.config import ConfigError

T = TypeVar("T")


def import_object(target: Any) -> Any:
    """Return the object named by ``"package.module:Name"``.

    The registries hold import paths, so a module or an adapter, and the libraries it
    needs, is imported only when the configuration selects it. A target that is not a
    string is returned unchanged, so tests can register classes directly.
    """
    if not isinstance(target, str):
        return target
    module_name, _, name = target.partition(":")
    if not module_name or not name:
        raise ValueError(f"expected 'package.module:Name', got {target!r}")
    return getattr(importlib.import_module(module_name), name)


def create(cls: type[T], where: str, /, *args: Any, **settings: Any) -> T:
    """Return ``cls(*args, **settings)``, reporting configuration mistakes clearly.

    A setting that ``cls`` does not accept (a misspelt key), a missing required setting,
    a value whose type does not match the parameter's annotation, or a ``ValueError``
    raised by ``cls`` for an invalid value becomes a ``ConfigError`` that names
    ``where``: the configuration table the settings came from.
    """
    try:
        inspect.signature(cls).bind(*args, **settings)
    except TypeError as error:
        raise ConfigError(f"{where}: {error}") from None
    _check_types(cls, where, settings)
    try:
        return cls(*args, **settings)
    except ValueError as error:
        raise ConfigError(f"{where}: {error}") from error


def _check_types(cls: type, where: str, settings: Mapping[str, Any]) -> None:
    try:
        hints = typing.get_type_hints(cls.__init__)
    except Exception:  # annotations that cannot be resolved are not checked
        return
    for name, value in settings.items():
        expected = hints.get(name)
        if expected is not None and not _matches(value, expected):
            described = getattr(expected, "__name__", None) or str(expected)
            raise ConfigError(f"{where}: {name} must be {described}, got {value!r}")


def _matches(value: Any, expected: Any) -> bool:
    """Whether ``value`` fits the annotation ``expected``; only the outer type is checked."""
    if expected is Any:
        return True
    if expected is float:  # an integer is a valid float setting; a bool is not
        return isinstance(value, int | float) and not isinstance(value, bool)
    if expected is int:
        return isinstance(value, int) and not isinstance(value, bool)
    origin = typing.get_origin(expected)
    if origin is typing.Union or origin is types.UnionType:
        return any(_matches(value, option) for option in typing.get_args(expected))
    target = expected if origin is None else origin
    return not isinstance(target, type) or isinstance(value, target)
