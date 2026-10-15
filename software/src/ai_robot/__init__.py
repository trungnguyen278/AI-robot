# SPDX-License-Identifier: MIT
"""Robot software for the Raspberry Pi 5.

- ``core``: configuration, message bus, module base class, factory.
- ``ports``: interfaces to hardware and external services.
- ``adapters``: implementations of the ports, simulated or real, chosen per profile.
- ``modules``: what the robot does (system, motion, voice, vision, screen, behavior).
- ``messages``: what the modules tell each other.
- ``app``: builds the robot from the configuration and runs it.
"""
