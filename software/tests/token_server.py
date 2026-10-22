# SPDX-License-Identifier: MIT
"""ai-robot-server's token endpoint, as the tests need it (protocol/cloud/README.md,
Tokens from the server). It checks assertions with PyJWT, a JWT library of its own, so
that the robot's hand-made ES256 assertions are proven to be standard."""

from __future__ import annotations

import time
from collections.abc import Callable, Mapping
from typing import Any

import jwt
from aiohttp import web

from ai_robot.core.jose import thumbprint

ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"


class TokenServer:
    """Knows the robots in ``robots`` (identifier -> public JWK), and answers each with
    tokens for the LiveKit server at ``livekit_url``, as ``mint`` makes them. Every
    assertion it accepts is kept in ``assertions``."""

    def __init__(
        self,
        robots: Mapping[str, Mapping[str, str]],
        livekit_url: str = "wss://media.cloud.example",
        mint: Callable[[str], str] = lambda robot: f"token-for-{robot}",
    ) -> None:
        self.robots = dict(robots)
        self.livekit_url = livekit_url
        self.mint = mint
        self.answer: Any = None  # if set, what the endpoint answers instead of tokens
        self.redirect: str | None = None  # if set, where the endpoint redirects to (307)
        self.elsewhere: list[str] = []  # what reached /elsewhere, which a redirect may name
        self.assertions: list[dict[str, Any]] = []
        self.url = ""
        self._runner: web.AppRunner | None = None

    @property
    def endpoint(self) -> str:
        return self.url + "/robot/token"

    async def start(self) -> None:
        app = web.Application()
        app.router.add_post("/robot/token", self._token)
        app.router.add_post("/elsewhere", self._elsewhere)
        self._runner = web.AppRunner(app, access_log=None)
        await self._runner.setup()
        await web.TCPSite(self._runner, "127.0.0.1", 0).start()
        self.url = f"http://127.0.0.1:{self._runner.addresses[0][1]}"

    async def stop(self) -> None:
        if self._runner is not None:
            await self._runner.cleanup()

    async def _elsewhere(self, request: web.Request) -> web.Response:
        self.elsewhere.append(await request.text())
        return web.json_response(self.answer or {})

    async def _token(self, request: web.Request) -> web.Response:
        if self.redirect is not None:
            raise web.HTTPTemporaryRedirect(self.redirect)  # 307: a client would resend the body
        form = await request.post()
        if (
            form.get("grant_type") != "client_credentials"
            or form.get("client_assertion_type") != ASSERTION_TYPE
        ):
            return refusal(400, "invalid_request")
        assertion = str(form.get("client_assertion", ""))
        try:
            header = jwt.get_unverified_header(assertion)
            robot = jwt.decode(assertion, options={"verify_signature": False})["iss"]
            key = self.robots.get(robot)
            if key is None or header.get("kid") != thumbprint(key) or header.get("typ") != "JWT":
                return refusal(401, "invalid_client")
            claims = jwt.decode(
                assertion,
                jwt.PyJWK(dict(key)).key,
                algorithms=["ES256"],
                audience=self.endpoint,
                options={"require": ["iss", "sub", "aud", "iat", "exp", "jti"]},
            )
        except (jwt.PyJWTError, KeyError):
            return refusal(401, "invalid_client")
        seen = {old["jti"] for old in self.assertions}
        if claims["sub"] != robot or claims["exp"] - claims["iat"] > 300 or claims["jti"] in seen:
            return refusal(401, "invalid_client")
        self.assertions.append(claims)
        if self.answer is not None:
            return web.json_response(self.answer)
        return web.json_response(
            {
                "access_token": f"api-{int(time.time())}",
                "token_type": "Bearer",
                "expires_in": 600,
                "livekit": {"url": self.livekit_url, "token": self.mint(robot)},
            }
        )


def refusal(status: int, error: str) -> web.Response:
    """An OAuth 2.0 error (RFC 6749, §5.2)."""
    return web.json_response({"error": error, "error_description": error}, status=status)
