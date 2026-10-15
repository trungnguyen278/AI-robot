# SPDX-License-Identifier: MIT
"""The web screen: serves the renderer and speaks the screen protocol with its pages."""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Any

import aiohttp
import pytest

from ai_robot.adapters.web.screen import PROTOCOL, WebScreen
from ai_robot.ports import ScreenState, Touch

VOCABULARY = Path(__file__).resolve().parents[2] / "protocol" / "screen" / "vocabulary.json"
TIMEOUT = 2.0


@pytest.fixture
def ui_dir(tmp_path: Path) -> Path:
    (tmp_path / "screen.html").write_text("<!doctype html><title>Screen</title>", "utf-8")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.js").write_text("export {};", "utf-8")
    return tmp_path


async def receive(socket: aiohttp.ClientWebSocketResponse) -> Any:
    return await socket.receive_json(timeout=TIMEOUT)


def test_protocol_version_matches_the_vocabulary() -> None:
    assert json.loads(VOCABULARY.read_text(encoding="utf-8"))["protocol"] == PROTOCOL


def test_serves_this_checkouts_renderer_by_default() -> None:
    screen = WebScreen(host="127.0.0.1", port=0)
    assert (screen.ui_dir / "screen.html").is_file()


def test_settings_are_checked(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match=r"no screen\.html"):
        WebScreen(host="127.0.0.1", port=0, ui_dir=str(tmp_path))
    with pytest.raises(ValueError, match="port"):
        WebScreen(host="127.0.0.1", port=70000)


def test_serves_the_renderer_and_drives_its_pages(ui_dir: Path) -> None:
    async def main() -> None:
        screen = WebScreen(host="127.0.0.1", port=0, ui_dir=str(ui_dir))
        await screen.open()
        try:
            assert screen.address is not None
            base = "http://{}:{}".format(*screen.address)
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{base}/") as response:
                    assert response.status == 200
                    assert "<title>Screen" in await response.text()
                    assert response.headers["Cache-Control"] == "no-cache"
                async with session.get(f"{base}/src/app.js") as response:
                    assert response.status == 200
                async with session.get(f"{base}/src/../../secret.txt") as response:
                    assert response.status in (403, 404)

                await screen.show(ScreenState(expression="happy", battery=50.0, charging=False))
                async with session.ws_connect(f"{base}/ws") as page:
                    # A page that connects gets the whole state at once.
                    assert await receive(page) == {"type": "hello", "protocol": PROTOCOL}
                    assert await receive(page) == {
                        "type": "state",
                        "face": {"expression": "happy", "tone": None},
                        "status": {"battery": 50.0, "charging": False},
                    }
                    assert await receive(page) == {"type": "look", "target": None}

                    await page.send_json(
                        {
                            "type": "ready",
                            "protocol": PROTOCOL,
                            "width": 1024,
                            "height": 600,
                            "shape": "rect",
                            "expressions": ["neutral", "happy"],
                        }
                    )
                    await page.send_json({"type": "touch", "x": 0.25, "y": 0.75})
                    assert await asyncio.wait_for(screen.touched(), TIMEOUT) == Touch(0.25, 0.75)

                    await screen.look((0.5, -0.25))
                    assert await receive(page) == {"type": "look", "target": {"x": 0.5, "y": -0.25}}
                    await screen.voice(0.4)
                    assert await receive(page) == {"type": "voice", "level": 0.4}
                    await screen.show(ScreenState(expression="sad", tone="blue"))
                    message = await receive(page)
                    assert message["face"] == {"expression": "sad", "tone": "blue"}
        finally:
            await screen.close()

    asyncio.run(main())


def test_ignores_what_it_does_not_understand(ui_dir: Path) -> None:
    async def main() -> None:
        screen = WebScreen(host="127.0.0.1", port=0, ui_dir=str(ui_dir))
        await screen.open()
        try:
            base = "http://{}:{}".format(*screen.address)  # type: ignore[str-format]
            async with aiohttp.ClientSession() as session, session.ws_connect(f"{base}/ws") as page:
                await page.send_str("not json")
                await page.send_json(["not", "an", "object"])
                await page.send_json({"type": "from-the-future"})
                await page.send_json({"type": "touch", "x": 2, "y": 0})  # off the screen
                await page.send_json({"type": "touch", "x": True, "y": 0})
                await page.send_json({"type": "touch", "x": 1, "y": 0})
                assert await asyncio.wait_for(screen.touched(), TIMEOUT) == Touch(1.0, 0.0)
        finally:
            await screen.close()

    asyncio.run(main())


def test_closing_disconnects_the_pages(ui_dir: Path) -> None:
    async def main() -> None:
        screen = WebScreen(host="127.0.0.1", port=0, ui_dir=str(ui_dir))
        await screen.open()
        base = "http://{}:{}".format(*screen.address)  # type: ignore[str-format]
        async with aiohttp.ClientSession() as session, session.ws_connect(f"{base}/ws") as page:
            for _ in range(3):
                await receive(page)
            began = time.monotonic()
            closing = asyncio.create_task(screen.close())
            message = await page.receive(timeout=TIMEOUT)
            assert message.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.CLOSED)
            await closing
            assert time.monotonic() - began < TIMEOUT
            assert screen.pages == {}

    asyncio.run(main())
