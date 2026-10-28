# SPDX-License-Identifier: MIT
"""The robot's identity in its TPM (docs/decisions/0010-device-identity.md).

The key is a primary key of the TPM's owner hierarchy. The TPM derives it from the
hierarchy's secret seed and a fixed template, so it makes the same key at every start,
and never lets its private half out. The identifier lives in the TPM's own memory, in
an NV index written once and then locked. Clearing the TPM, as a factory reset does,
changes the seed and deletes the index: the robot then has a new identity, which its
owner sets up again.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import uuid
from collections.abc import Mapping
from dataclasses import dataclass

from tpm2_pytss import (
    ESAPI,
    ESYS_TR,
    TPM2_ALG,
    TPM2_CAP,
    TPM2_HANDLE,
    TPM2_RH,
    TPM2_ST,
    TPM2B_DIGEST,
    TPM2B_ECC_PARAMETER,
    TPM2B_NV_PUBLIC,
    TPM2B_PUBLIC,
    TPM2B_SENSITIVE_CREATE,
    TPMA_NV,
    TPMA_OBJECT,
    TPMS_NV_PUBLIC,
    TPMT_SIG_SCHEME,
    TPMT_TK_HASHCHECK,
    TSS2_Exception,
)

from ai_robot.core.jose import es256, p256_jwk
from ai_robot.ports.identity import Identity

# The robot's objects in the TPM, the same for the robot's whole life.
KEY_LABEL = b"ai-robot identity"  # the key template's unique field: which key of the seed
ID_INDEX = 0x01800100  # an NV index in the owner's range (TCG handle registry v1.1, table 2)
ID_SIZE = 16  # bytes: a UUID
# The owner reads and writes the index; locked once written, it stays until a clear.
ID_ATTRIBUTES = TPMA_NV.OWNERWRITE | TPMA_NV.OWNERREAD | TPMA_NV.NO_DA | TPMA_NV.WRITEDEFINE


def key_template() -> TPM2B_PUBLIC:
    """The template of the robot's key: ECC on P-256, signing with ECDSA and SHA-256.

    The TPM makes the key itself and binds it to itself, so it can never be exported or
    duplicated. It needs no password: whoever may open the TPM device may sign with it.
    """
    public = TPM2B_PUBLIC.parse(
        "ecc256:ecdsa-sha256",
        objectAttributes=TPMA_OBJECT.FIXEDTPM
        | TPMA_OBJECT.FIXEDPARENT
        | TPMA_OBJECT.SENSITIVEDATAORIGIN
        | TPMA_OBJECT.USERWITHAUTH
        | TPMA_OBJECT.SIGN_ENCRYPT,
        nameAlg="sha256",
    )
    public.publicArea.unique.ecc.x = KEY_LABEL
    return public


@dataclass(frozen=True, slots=True)
class _Tpm:
    """The open TPM: the connection, the robot's key in it, and what the port reports."""

    esapi: ESAPI
    key: ESYS_TR
    robot_id: str
    jwk: Mapping[str, str]


class TpmIdentity(Identity):
    """The robot's identity in its TPM, reached through the TCTI ``tcti``: the kernel's
    resource manager on the robot (``device:/dev/tpmrm0``), a software TPM in tests."""

    def __init__(self, *, tcti: str) -> None:
        if not tcti:
            raise ValueError("tcti must say how to reach the TPM, as device:/dev/tpmrm0 does")
        self.tcti = tcti
        self._tpm: _Tpm | None = None
        self._lock = asyncio.Lock()  # the TPM takes one command at a time

    async def open(self) -> None:
        opening = asyncio.ensure_future(asyncio.to_thread(self._open))
        try:
            self._tpm = await asyncio.shield(opening)
        except asyncio.CancelledError:
            # The robot stops while starting: let the TPM finish, then release it.
            with contextlib.suppress(Exception):
                _end(await opening)
            raise

    async def close(self) -> None:
        async with self._lock:  # after the signatures under way
            tpm, self._tpm = self._tpm, None
            if tpm is not None:
                await asyncio.to_thread(_end, tpm)

    async def robot_id(self) -> str:
        return self._held().robot_id

    async def public_key(self) -> Mapping[str, str]:
        return dict(self._held().jwk)

    async def sign(self, data: bytes) -> bytes:
        digest = hashlib.sha256(data).digest()
        async with self._lock:
            return await asyncio.to_thread(_sign, self._held(), digest)

    def _held(self) -> _Tpm:
        if self._tpm is None:
            raise RuntimeError("the identity is not open")
        return self._tpm

    def _open(self) -> _Tpm:
        try:
            esapi = ESAPI(self.tcti)
        except TSS2_Exception as error:
            raise RuntimeError(f"cannot reach the TPM through {self.tcti}: {error}") from None
        key = None
        try:
            key, public, *_ = esapi.create_primary(
                TPM2B_SENSITIVE_CREATE(), key_template(), ESYS_TR.OWNER
            )
            point = public.publicArea.unique.ecc
            jwk = p256_jwk(_number(point.x), _number(point.y))
            return _Tpm(esapi, key, _robot_id(esapi), jwk)
        except BaseException:
            with contextlib.suppress(Exception):
                if key is not None:
                    esapi.flush_context(key)
            esapi.close()
            raise


def _robot_id(esapi: ESAPI) -> str:
    """The identifier kept in the TPM, made and locked there at the first start.

    A start cut short between two steps is completed by the next one: an index defined
    but never written gets an identifier, and one written but not yet locked is locked.
    """
    if _defined(esapi, ID_INDEX):
        index = esapi.tr_from_tpmpublic(TPM2_HANDLE(ID_INDEX))
        public, _ = esapi.nv_read_public(index)
        attributes = public.nvPublic.attributes
        if public.nvPublic.dataSize != ID_SIZE or (attributes & ID_ATTRIBUTES) != ID_ATTRIBUTES:
            raise ValueError(f"the TPM's NV index {ID_INDEX:#010x} is not the robot's identifier")
        if attributes & TPMA_NV.WRITTEN:
            robot = uuid.UUID(bytes=bytes(esapi.nv_read(index, ID_SIZE, 0, ESYS_TR.OWNER)))
            if not (attributes & TPMA_NV.WRITELOCKED):
                esapi.nv_write_lock(index, ESYS_TR.OWNER)
            return str(robot)
    else:
        space = TPMS_NV_PUBLIC(
            nvIndex=ID_INDEX, nameAlg=TPM2_ALG.SHA256, attributes=ID_ATTRIBUTES, dataSize=ID_SIZE
        )
        index = esapi.nv_define_space(None, TPM2B_NV_PUBLIC(nvPublic=space), ESYS_TR.OWNER)
    robot = uuid.uuid4()
    esapi.nv_write(index, robot.bytes, 0, ESYS_TR.OWNER)
    esapi.nv_write_lock(index, ESYS_TR.OWNER)
    return str(robot)


def _defined(esapi: ESAPI, handle: int) -> bool:
    """Whether the TPM has an NV index at ``handle``: it lists its indices from there."""
    _, data = esapi.get_capability(TPM2_CAP.HANDLES, handle, 1)
    return handle in data.data.handles


def _sign(tpm: _Tpm, digest: bytes) -> bytes:
    scheme = TPMT_SIG_SCHEME(scheme=TPM2_ALG.ECDSA)
    scheme.details.any.hashAlg = TPM2_ALG.SHA256
    # A ticket from the TPM's own hashing is needed only by restricted keys: none here.
    validation = TPMT_TK_HASHCHECK(tag=TPM2_ST.HASHCHECK, hierarchy=TPM2_RH.NULL)
    signature = tpm.esapi.sign(tpm.key, TPM2B_DIGEST(digest), scheme, validation)
    ecdsa = signature.signature.ecdsa
    return es256(_number(ecdsa.signatureR), _number(ecdsa.signatureS))


def _end(tpm: _Tpm) -> None:
    try:
        tpm.esapi.flush_context(tpm.key)
    finally:
        tpm.esapi.close()


def _number(parameter: TPM2B_ECC_PARAMETER) -> int:
    """A TPM's big-endian number, which may come without its leading zeros."""
    return int.from_bytes(bytes(parameter), "big")
