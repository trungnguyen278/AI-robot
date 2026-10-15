# SPDX-License-Identifier: MIT
"""Behavior: decides what the robot does."""

from __future__ import annotations

from ai_robot.core.module import Module
from ai_robot.messages import InteractionChanged, InteractionState


class BehaviorModule(Module):
    """Decides what the robot does, and announces the interaction state.

    Planned: the conversation flow (wake word, listening, processing, speaking),
    reactions to what vision sees, idle behaviors and emotions.
    """

    async def start(self) -> None:
        self.bus.publish(InteractionChanged(InteractionState.IDLE))
