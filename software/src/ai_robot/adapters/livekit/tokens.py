# SPDX-License-Identifier: MIT
"""Tokens to join the robot's room (protocol/cloud/README.md, Joining).

A robot gets them from ``ai-cloud``'s token endpoint, with an assertion signed by
its key (docs/decisions/0010-device-identity.md). For a development LiveKit server, it
makes them itself with that server's key.
"""

from __future__ import annotations

import os
import secrets
import time
from dataclasses import dataclass

import aiohttp
from livekit import api

from ai_robot.core.data import Schema
from ai_robot.core.jose import b64url, b64url_json, thumbprint
from ai_robot.ports.cloud import check_url
from ai_robot.ports.identity import Identity

# Fixed by the protocol (protocol/cloud/README.md, Tokens from the server).
TOKEN_PATH = "/robot/token"
GRANT_TYPE = "client_credentials"
ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"  # RFC 7523, §2.2
KEY_ENV = "AI_ROBOT_LIVEKIT_API_KEY"  # a development server's key, for development tokens
SECRET_ENV = "AI_ROBOT_LIVEKIT_API_SECRET"

# How this implementation works, which nobody needs to tune.
ASSERTION_SECONDS = 60  # how long an assertion is valid; the protocol allows up to 300


class NoToken(Exception):
    """The robot could not get a token for its room."""


class NotSetUp(NoToken):
    """The server does not know the robot's key, or revoked it: the robot is not set up."""


@dataclass(frozen=True, slots=True)
class Access:
    """Where to join the robot's room, and the token to join it with."""

    url: str
    token: str


def development_token(room: str, participant: str) -> str:
    """A token for ``room``, made with a development server's key from the environment.
    It lets the robot publish only a microphone."""
    key, secret = os.environ.get(KEY_ENV), os.environ.get(SECRET_ENV)
    if not key or not secret:
        raise NoToken(f"no token: set {KEY_ENV} and {SECRET_ENV} for a development server")
    grants = api.VideoGrants(
        room_join=True,
        room=room,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
        can_publish_sources=["microphone"],
    )
    return api.AccessToken(key, secret).with_identity(participant).with_grants(grants).to_jwt()


async def assertion(identity: Identity, audience: str) -> str:
    """A JWT that proves the robot's identity to ``audience``, signed with ES256 by its
    key (RFC 7523, §3)."""
    robot = await identity.robot_id()
    now = int(time.time())
    header = {"alg": "ES256", "typ": "JWT", "kid": thumbprint(await identity.public_key())}
    claims = {
        "iss": robot,
        "sub": robot,
        "aud": audience,
        "iat": now,
        "exp": now + ASSERTION_SECONDS,
        "jti": secrets.token_urlsafe(16),
    }
    signed = f"{b64url_json(header)}.{b64url_json(claims)}"
    return f"{signed}.{b64url(await identity.sign(signed.encode('ascii')))}"


async def server_access(
    http: aiohttp.ClientSession, server: str, identity: Identity, schema: Schema
) -> Access:
    """Ask the token endpoint of ``server`` for the robot's tokens."""
    endpoint = server.rstrip("/") + TOKEN_PATH
    form = {
        "grant_type": GRANT_TYPE,
        "client_assertion_type": ASSERTION_TYPE,
        "client_assertion": await assertion(identity, endpoint),
    }
    # A redirect would carry the assertion somewhere the robot never chose: refuse it.
    async with http.post(endpoint, data=form, allow_redirects=False) as response:
        if 300 <= response.status < 400:
            raise NoToken(
                f"the token endpoint redirects ({response.status}); the robot does not follow"
            )
        try:
            answer = await response.json(content_type=None)
        except ValueError:
            answer = None
        if response.status != 200:
            error = answer.get("error") if isinstance(answer, dict) else None
            if error == "invalid_client":
                raise NotSetUp("the server does not know this robot: it must be set up")
            raise NoToken(f"the server refused the robot's tokens ({response.status}, {error})")
    problem = schema.problem(answer)
    if problem is not None:
        raise NoToken(f"the server's answer is not tokens: {problem}")
    livekit = answer["livekit"]
    try:
        url = check_url("the room's url", livekit["url"], ("wss", "ws"))
    except ValueError as error:
        raise NoToken(str(error)) from None
    return Access(url, livekit["token"])
