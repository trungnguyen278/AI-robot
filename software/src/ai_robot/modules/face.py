# SPDX-License-Identifier: MIT
"""Face: the robot's expressions on the display."""

from __future__ import annotations

from ai_robot.core.module import Module, ModuleContext
from ai_robot.messages import InteractionChanged, InteractionState
from ai_robot.ports import Color, Display, Image

# Placeholder until the real face exists: one background colour per state.
STATE_COLORS: dict[InteractionState, Color] = {
    InteractionState.IDLE: (0, 0, 0),
    InteractionState.TRIGGERED: (0, 60, 120),
    InteractionState.LISTENING: (0, 120, 240),
    InteractionState.PROCESSING: (120, 0, 240),
    InteractionState.SPEAKING: (0, 200, 120),
    InteractionState.CANCELLING: (120, 60, 0),
}


class FaceModule(Module):
    """Draws the face on the display.

    Planned: animated eyes and expressions in the previous generation's design language
    (docs/legacy.md), driven by the interaction state and emotions.
    """

    owns = ("display",)

    def __init__(self, ctx: ModuleContext) -> None:
        super().__init__(ctx)
        self.display = self.port("display", Display)
        self.states = self.bus.subscribe(InteractionChanged)

    async def run(self) -> None:
        async for message in self.states:
            width, height = self.display.size
            color = STATE_COLORS.get(message.state, (0, 0, 0))
            await self.display.show(Image.filled(width, height, color))

    async def stop(self) -> None:
        self.states.close()
