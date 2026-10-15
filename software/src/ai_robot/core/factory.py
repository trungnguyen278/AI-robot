# SPDX-License-Identifier: MIT
"""Creating modules and adapters from the registries and the configuration."""

from __future__ import annotations

import importlib
import inspect
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
    or a ``ValueError`` raised by ``cls`` for an invalid value becomes a ``ConfigError``
    that names ``where``: the configuration table the settings came from.
    """
    try:
        inspect.signature(cls).bind(*args, **settings)
    except TypeError as error:
        raise ConfigError(f"{where}: {error}") from None
    try:
        return cls(*args, **settings)
    except ValueError as error:
        raise ConfigError(f"{where}: {error}") from error
