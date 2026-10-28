# SPDX-License-Identifier: MIT
"""The robot's identity in a TPM (docs/decisions/0010): a software TPM here, the
robot's own on the robot. The tests need tpm2-pytss and swtpm (see conftest.py)."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Mapping

import aiohttp
import pytest

pytest.importorskip("tpm2_pytss", reason="tpm2-pytss is not installed (the tpm extra)")

from identity_checks import check, unb64url, verifies
from local_servers import free_ports
from token_server import TokenServer, token_schema
from tpm2_pytss import (
    ESAPI,
    ESYS_TR,
    TPM2_ALG,
    TPM2_HANDLE,
    TPM2B_NV_PUBLIC,
    TPM2B_SENSITIVE_CREATE,
    TPMA_NV,
    TPMA_OBJECT,
    TPMS_NV_PUBLIC,
    TSS2_Exception,
)

from ai_robot.adapters.livekit.tokens import server_access
from ai_robot.adapters.tpm.identity import (
    ID_ATTRIBUTES,
    ID_INDEX,
    ID_SIZE,
    TpmIdentity,
    key_template,
)


async def identity_of(tcti: str) -> tuple[str, Mapping[str, str]]:
    """The identifier and the public key of the identity in the TPM, made if need be."""
    identity = TpmIdentity(tcti=tcti)
    await identity.open()
    try:
        return await identity.robot_id(), await identity.public_key()
    finally:
        await identity.close()


def define_index(tcti: str, attributes: TPMA_NV, size: int) -> None:
    space = TPMS_NV_PUBLIC(
        nvIndex=ID_INDEX, nameAlg=TPM2_ALG.SHA256, attributes=attributes, dataSize=size
    )
    with ESAPI(tcti) as esapi:
        esapi.nv_define_space(None, TPM2B_NV_PUBLIC(nvPublic=space), ESYS_TR.OWNER)


def test_an_identity_in_the_tpm_is_made_once_and_kept(tpm: str) -> None:
    async def main() -> None:
        made = TpmIdentity(tcti=tpm)
        await made.open()
        try:
            robot = await check(made)
            jwk = await made.public_key()
            # Signatures asked for at once: the TPM takes them in turn.
            data = [b"first", b"second", b"third"]
            signatures = await asyncio.gather(*(made.sign(each) for each in data))
            for each, signature in zip(data, signatures, strict=True):
                assert verifies(jwk, each, signature)
        finally:
            await made.close()
        again = TpmIdentity(tcti=tpm)
        await again.open()
        try:
            assert await check(again) == robot
            assert await again.public_key() == jwk
        finally:
            await again.close()

    asyncio.run(main())


def test_the_key_cannot_leave_the_tpm(tpm: str) -> None:
    """The TPM made the key itself and keeps it bound to itself: it can be neither
    exported nor duplicated."""
    _, jwk = asyncio.run(identity_of(tpm))
    with ESAPI(tpm) as esapi:
        key, public, *_ = esapi.create_primary(
            TPM2B_SENSITIVE_CREATE(), key_template(), ESYS_TR.OWNER
        )
        esapi.flush_context(key)
    attributes = public.publicArea.objectAttributes
    for bound in (TPMA_OBJECT.FIXEDTPM, TPMA_OBJECT.FIXEDPARENT, TPMA_OBJECT.SENSITIVEDATAORIGIN):
        assert attributes & bound, bound
    point = public.publicArea.unique.ecc
    for coordinate, value in (("x", point.x), ("y", point.y)):
        assert int.from_bytes(bytes(value), "big") == int.from_bytes(
            unb64url(jwk[coordinate]), "big"
        )


def test_clearing_the_tpm_gives_the_robot_a_new_identity(tpm: str) -> None:
    """A factory reset clears the TPM: the robot then has a new identifier and a new key,
    which its owner sets up again."""
    robot, jwk = asyncio.run(identity_of(tpm))
    with ESAPI(tpm) as esapi:
        esapi.clear(ESYS_TR.LOCKOUT)
    new_robot, new_jwk = asyncio.run(identity_of(tpm))
    assert new_robot != robot
    assert new_jwk != jwk


def test_the_identifier_is_written_once(tpm: str) -> None:
    asyncio.run(identity_of(tpm))
    with ESAPI(tpm) as esapi:
        index = esapi.tr_from_tpmpublic(TPM2_HANDLE(ID_INDEX))
        with pytest.raises(TSS2_Exception):
            esapi.nv_write(index, bytes(ID_SIZE), 0, ESYS_TR.OWNER)


def test_a_first_start_cut_short_is_completed(tpm: str) -> None:
    """The robot stopped after defining its identifier's index, before writing it: the
    next start writes and locks it."""
    define_index(tpm, ID_ATTRIBUTES, ID_SIZE)
    robot, _ = asyncio.run(identity_of(tpm))
    assert asyncio.run(identity_of(tpm))[0] == robot
    with ESAPI(tpm) as esapi:
        index = esapi.tr_from_tpmpublic(TPM2_HANDLE(ID_INDEX))
        public, _ = esapi.nv_read_public(index)
    assert public.nvPublic.attributes & TPMA_NV.WRITELOCKED


def test_an_identifier_written_but_not_locked_is_locked(tpm: str) -> None:
    """The robot stopped between writing its identifier and locking it: the next start
    keeps that identifier, and locks it."""
    robot = uuid.uuid4()
    define_index(tpm, ID_ATTRIBUTES, ID_SIZE)
    with ESAPI(tpm) as esapi:
        index = esapi.tr_from_tpmpublic(TPM2_HANDLE(ID_INDEX))
        esapi.nv_write(index, robot.bytes, 0, ESYS_TR.OWNER)
    assert asyncio.run(identity_of(tpm))[0] == str(robot)
    with ESAPI(tpm) as esapi:
        index = esapi.tr_from_tpmpublic(TPM2_HANDLE(ID_INDEX))
        public, _ = esapi.nv_read_public(index)
    assert public.nvPublic.attributes & TPMA_NV.WRITELOCKED


def test_an_index_that_is_not_the_identifier_is_refused(tpm: str) -> None:
    define_index(tpm, TPMA_NV.OWNERWRITE | TPMA_NV.OWNERREAD, 8)
    with pytest.raises(ValueError, match="is not the robot's identifier"):
        asyncio.run(identity_of(tpm))


def test_an_unreachable_tpm_is_reported() -> None:
    identity = TpmIdentity(tcti=f"swtpm:host=127.0.0.1,port={free_ports(2)}")
    with pytest.raises(RuntimeError, match="cannot reach the TPM"):
        asyncio.run(identity.open())


def test_closing_waits_for_signatures_then_refuses_them(tpm: str) -> None:
    async def main() -> None:
        identity = TpmIdentity(tcti=tpm)
        await identity.open()
        jwk = await identity.public_key()
        signature, _ = await asyncio.gather(identity.sign(b"last"), identity.close())
        assert verifies(jwk, b"last", signature)
        with pytest.raises(RuntimeError, match="not open"):
            await identity.sign(b"too late")

    asyncio.run(main())


def test_the_server_takes_the_assertions_the_tpm_signs(tpm: str) -> None:
    """The token endpoint checks the assertion with PyJWT: what the TPM signs is standard
    ES256."""

    async def main() -> None:
        identity = TpmIdentity(tcti=tpm)
        await identity.open()
        try:
            robot = await identity.robot_id()
            server = TokenServer({robot: await identity.public_key()})
            await server.start()
            try:
                async with aiohttp.ClientSession() as http:
                    access = await server_access(http, server.url, identity, token_schema())
            finally:
                await server.stop()
        finally:
            await identity.close()
        assert access.token == f"token-for-{robot}"
        assert [each["iss"] for each in server.assertions] == [robot]

    asyncio.run(main())
