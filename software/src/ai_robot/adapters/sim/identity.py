# SPDX-License-Identifier: MIT
"""A simulated identity."""

from __future__ import annotations

import uuid

from cryptography.hazmat.primitives.asymmetric import ec

from ai_robot.adapters.keys.identity import SoftwareIdentity


class SimIdentity(SoftwareIdentity):
    """An identity made afresh at each start and kept in memory, so that the robot runs
    without a key of its own. No server knows it."""

    async def open(self) -> None:
        self._hold(str(uuid.uuid4()), ec.generate_private_key(ec.SECP256R1()))
