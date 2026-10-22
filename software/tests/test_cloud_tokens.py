# SPDX-License-Identifier: MIT
"""Tokens to join the robot's room: from the server, with the robot's identity, or made
for a development server (protocol/cloud/README.md, Joining)."""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import aiohttp
import jwt
import pytest
from token_server import TokenServer

from ai_robot.adapters.livekit.cloud import LiveKitCloud
from ai_robot.adapters.livekit.tokens import (
    Access,
    NoToken,
    assertion,
    development_token,
    server_access,
)
from ai_robot.adapters.sim.identity import SimIdentity
from ai_robot.core.data import Schema
from ai_robot.core.jose import b64url, thumbprint

SCHEMA = Path(__file__).resolve().parents[2] / "protocol" / "cloud" / "schema.json"
SETTINGS = {
    "tokens": "server",
    "url": "https://cloud.example",
    "room": "robot",
    "participant": "robot",
    "connect_timeout": 10.0,
    "hello_timeout": 5.0,
    "reconnect_first": 1.0,
    "reconnect_max": 60.0,
    "rate": 50.0,
    "burst": 100,
    "backlog": 500,
    "catalogue_ttl": 60.0,
}


def token_schema() -> Schema:
    root = json.loads(SCHEMA.read_text(encoding="utf-8"))
    return Schema("token_response", {**root, "$ref": "#/$defs/token_response"})


@contextlib.asynccontextmanager
async def server_and_robot(
    known: bool = True,
) -> AsyncIterator[tuple[TokenServer, SimIdentity, aiohttp.ClientSession]]:
    identity = SimIdentity()
    await identity.open()
    robots = {await identity.robot_id(): await identity.public_key()} if known else {}
    server = TokenServer(robots)
    await server.start()
    try:
        async with aiohttp.ClientSession() as http:
            yield server, identity, http
    finally:
        await server.stop()


def test_a_robot_the_server_knows_gets_its_tokens() -> None:
    async def main() -> None:
        async with server_and_robot() as (server, identity, http):
            access = await server_access(http, server.url, identity, token_schema())
            robot = await identity.robot_id()
            assert access == Access("wss://media.cloud.example", f"token-for-{robot}")
            (claims,) = server.assertions
            assert claims["iss"] == claims["sub"] == robot
            assert claims["aud"] == server.endpoint
            assert claims["exp"] - claims["iat"] == 60
            await server_access(http, server.url, identity, token_schema())
            assert server.assertions[0]["jti"] != server.assertions[1]["jti"]

    asyncio.run(main())


def test_the_assertion_is_a_standard_es256_jwt() -> None:
    async def main() -> None:
        identity = SimIdentity()
        await identity.open()
        signed = await assertion(identity, "https://cloud.example/robot/token")
        jwk = await identity.public_key()
        header = jwt.get_unverified_header(signed)
        assert header == {"alg": "ES256", "typ": "JWT", "kid": thumbprint(jwk)}
        claims = jwt.decode(
            signed,
            jwt.PyJWK(dict(jwk)).key,
            algorithms=["ES256"],
            audience="https://cloud.example/robot/token",
        )
        assert claims["iss"] == await identity.robot_id()

    asyncio.run(main())


def test_the_key_id_is_the_rfc_7638_thumbprint() -> None:
    jwk = {"kty": "EC", "crv": "P-256", "x": "xx", "y": "yy", "use": "sig"}
    canonical = b'{"crv":"P-256","kty":"EC","x":"xx","y":"yy"}'  # required members, in order
    assert thumbprint(jwk) == b64url(hashlib.sha256(canonical).digest())


def test_a_robot_the_server_does_not_know_must_be_set_up() -> None:
    async def main() -> None:
        async with server_and_robot(known=False) as (server, identity, http):
            with pytest.raises(NoToken, match="does not know this robot: it must be set up"):
                await server_access(http, server.url, identity, token_schema())

    asyncio.run(main())


@pytest.mark.parametrize(
    ("answer", "message"),
    [
        ({"access_token": "a"}, "is not tokens"),
        ("not tokens", "is not tokens"),
        (
            {
                "access_token": "a",
                "token_type": "Bearer",
                "expires_in": 600,
                "livekit": {"url": "ws://media.cloud.example", "token": "t"},
            },
            "ws:// is allowed only to this computer",
        ),
    ],
)
def test_an_answer_that_is_not_proper_tokens_is_refused(answer: Any, message: str) -> None:
    async def main() -> None:
        async with server_and_robot() as (server, identity, http):
            server.answer = answer
            with pytest.raises(NoToken, match=message):
                await server_access(http, server.url, identity, token_schema())

    asyncio.run(main())


def test_the_robot_does_not_follow_a_redirect() -> None:
    async def main() -> None:
        async with server_and_robot() as (server, identity, http):
            server.redirect = server.url + "/elsewhere"
            with pytest.raises(NoToken, match="redirects"):
                await server_access(http, server.url, identity, token_schema())
            assert server.elsewhere == []  # the assertion went nowhere else

    asyncio.run(main())


def test_server_tokens_need_an_identity() -> None:
    async def main() -> None:
        link = LiveKitCloud(**SETTINGS)
        await link.open()
        try:
            with pytest.raises(NoToken, match="no identity"):
                await link._access()
        finally:
            await link.close()

    asyncio.run(main())


@pytest.mark.parametrize(
    ("tokens", "url", "allowed"),
    [
        ("server", "https://cloud.example", True),
        ("server", "http://127.0.0.1:8080", True),
        ("server", "http://cloud.example", False),
        ("server", "wss://cloud.example", False),
        ("development", "wss://media.example", True),
        ("development", "ws://localhost:7880", True),
        ("development", "ws://media.example", False),
        ("development", "https://media.example", False),
        ("development", "", False),
    ],
)
def test_addresses_are_checked(tokens: str, url: str, allowed: bool) -> None:
    settings = {**SETTINGS, "tokens": tokens, "url": url}
    if allowed:
        assert LiveKitCloud(**settings).url == url
    else:
        with pytest.raises(ValueError, match="url"):
            LiveKitCloud(**settings)


def test_development_tokens_need_the_servers_key(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(NoToken, match="AI_ROBOT_LIVEKIT_API_KEY"):
        development_token("robot", "robot")
    monkeypatch.setenv("AI_ROBOT_LIVEKIT_API_KEY", "key")
    monkeypatch.setenv("AI_ROBOT_LIVEKIT_API_SECRET", "a-secret-long-enough-for-a-test-token")
    claims = jwt.decode(
        development_token("robot-desk", "robot"),
        "a-secret-long-enough-for-a-test-token",
        algorithms=["HS256"],
    )
    assert claims["sub"] == "robot"
    assert claims["video"]["room"] == "robot-desk"
    assert claims["video"]["canPublishSources"] == ["microphone"]
