# SPDX-License-Identifier: MIT
"""Access tokens for the control channel, from ai-cloud's token endpoint, in exchange for
an assertion signed by the robot's key (platform/protocols/cloud/README.md, Tokens from
the server)."""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
from collections.abc import AsyncIterator
from typing import Any

import aiohttp
import jwt
import pytest
from fake_cloud import FakeCloud, schema

from ai_robot.adapters.sim.identity import SimIdentity
from ai_robot.adapters.websocket.tokens import NoToken, NotSetUp, access_token, assertion
from ai_robot.core.jose import b64url, thumbprint

TIMEOUT = 5.0


@contextlib.asynccontextmanager
async def server_and_robot(
    known: bool = True,
) -> AsyncIterator[tuple[FakeCloud, SimIdentity, aiohttp.ClientSession]]:
    identity = SimIdentity()
    await identity.open()
    robots = {await identity.robot_id(): await identity.public_key()} if known else {}
    server = FakeCloud(robots)
    await server.start()
    try:
        async with aiohttp.ClientSession() as http:
            yield server, identity, http
    finally:
        await server.stop()


async def token(server: FakeCloud, identity: SimIdentity, http: aiohttp.ClientSession) -> str:
    return await access_token(http, server.url, identity, schema("token_response"), TIMEOUT)


def test_a_robot_the_server_knows_gets_its_token() -> None:
    async def main() -> None:
        async with server_and_robot() as (server, identity, http):
            assert await token(server, identity, http) == "access-1"
            robot = await identity.robot_id()
            (claims,) = server.assertions
            assert claims["iss"] == claims["sub"] == robot
            assert claims["aud"] == server.endpoint
            assert claims["exp"] - claims["iat"] == 60
            assert await token(server, identity, http) == "access-2"
            assert server.assertions[0]["jti"] != server.assertions[1]["jti"]

    asyncio.run(main())


def test_the_assertion_is_a_standard_es256_jwt() -> None:
    async def main() -> None:
        identity = SimIdentity()
        await identity.open()
        signed = await assertion(identity, "https://cloud.example/device/token")
        jwk = await identity.public_key()
        header = jwt.get_unverified_header(signed)
        assert header == {"alg": "ES256", "typ": "JWT", "kid": thumbprint(jwk)}
        claims = jwt.decode(
            signed,
            jwt.PyJWK(dict(jwk)).key,
            algorithms=["ES256"],
            audience="https://cloud.example/device/token",
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
            with pytest.raises(NotSetUp, match="does not know this robot: it must be set up"):
                await token(server, identity, http)

    asyncio.run(main())


@pytest.mark.parametrize(
    ("answer", "message"),
    [
        ({"access_token": "a"}, "is not a token"),
        ("not a token", "is not a token"),
        ({"access_token": "a", "token_type": "Bearer", "expires_in": 0}, "is not a token"),
        ({"access_token": "a", "token_type": "MAC", "expires_in": 600}, "uses bearer"),
    ],
)
def test_an_answer_that_is_not_a_proper_token_is_refused(answer: Any, message: str) -> None:
    async def main() -> None:
        async with server_and_robot() as (server, identity, http):
            server.answer = answer
            with pytest.raises(NoToken, match=message):
                await token(server, identity, http)

    asyncio.run(main())


def test_a_bearer_token_is_taken_whatever_its_case() -> None:
    async def main() -> None:
        async with server_and_robot() as (server, identity, http):
            server.answer = {"access_token": "a", "token_type": "bearer", "expires_in": 600}
            assert await token(server, identity, http) == "a"

    asyncio.run(main())


def test_the_robot_does_not_follow_a_redirect() -> None:
    async def main() -> None:
        async with server_and_robot() as (server, identity, http):
            server.redirect = server.url + "/elsewhere"
            with pytest.raises(NoToken, match="redirects"):
                await token(server, identity, http)
            assert server.elsewhere == []  # the assertion went nowhere else

    asyncio.run(main())
