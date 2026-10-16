# SPDX-License-Identifier: MIT
"""The system module: battery reports and the charging scene."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from pathlib import Path

from ai_robot.adapters.sim.body import SimLights, SimPower
from ai_robot.core.bus import Bus
from ai_robot.core.module import ModuleContext, RobotInfo
from ai_robot.messages import BatteryReport, SceneRequest
from ai_robot.modules.system import CHARGING_SCENE, CHARGING_SECONDS, SystemModule
from ai_robot.ports import BatteryStatus

VOCABULARY = Path(__file__).resolve().parents[2] / "protocol" / "screen" / "vocabulary.json"
INTERVAL = 0.01


def scenes_for(readings: list[bool | None]) -> list[SceneRequest]:
    """The scene requests the system module makes while the battery reports ``readings``
    (charging or not, or unknown), each for a few battery intervals."""

    async def main() -> list[SceneRequest]:
        bus = Bus()
        power = SimPower()
        ctx = ModuleContext(
            name="system",
            bus=bus,
            ports={"power": power, "lights": SimLights()},
            robot=RobotInfo(display_name="Robot"),
            log=logging.getLogger("test"),
        )
        module = SystemModule(ctx, battery_interval=INTERVAL)
        requests = bus.subscribe(SceneRequest)
        reports = bus.subscribe(BatteryReport)
        await module.start()
        task = asyncio.create_task(module.run())
        try:
            for charging in readings:
                power.status = BatteryStatus(voltage=7.4, percent=50.0, charging=charging)
                for _ in range(3):  # wait until the module has read it a few times
                    while (await reports.get()).status.charging != charging:
                        pass
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
            await module.stop()
        return [await requests.get() for _ in range(requests.pending)]

    return asyncio.run(main())


def test_plugging_in_shows_the_charging_scene() -> None:
    plugged = SceneRequest("system", CHARGING_SCENE, duration=CHARGING_SECONDS)
    assert scenes_for([False, True]) == [plugged]
    assert scenes_for([False, True, False]) == [plugged, SceneRequest("system", None)]


def test_starting_on_the_charger_shows_nothing() -> None:
    assert scenes_for([True, True]) == []


def test_unknown_readings_change_nothing() -> None:
    plugged = SceneRequest("system", CHARGING_SCENE, duration=CHARGING_SECONDS)
    assert scenes_for([False, True, None, True]) == [plugged]
    assert scenes_for([None, True, None]) == []


def test_the_charging_scene_is_in_the_protocol() -> None:
    vocabulary = json.loads(VOCABULARY.read_text(encoding="utf-8"))
    assert CHARGING_SCENE in vocabulary["scenes"]
