# SPDX-License-Identifier: MIT
"""SPAKE2+ (RFC 9383) on P-256, with SHA-256, HKDF and HMAC: the exchange that turns the
set-up code into keys (protocol/setup/README.md, SPAKE2+).

The robot is the Verifier: it holds w0 and L, never the code itself. The Prover is the app;
it is here too, for the tests and for tools that play the app.

Python's ``cryptography`` does no arithmetic on points, so PyCryptodome does it: its scalar
multiplications are constant-time and blinded, as RFC 9382, §7, asks of them.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

from Crypto.PublicKey import ECC
from Crypto.PublicKey.ECC import EccPoint
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

# P-256 (NIST SP 800-186, §3.2.1.3): the field's prime, and the order of its group.
PRIME = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF
ORDER = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
COORDINATE = 32  # bytes in a coordinate, or a scalar
POINT = 1 + 2 * COORDINATE  # bytes in a point, uncompressed (SEC1, §2.3.3)

# Fixed by RFC 9383, §4: the points M and N for P-256, compressed (SEC1, §2.3.3).
M_POINT = "02886e2f97ace46e55ba9dd7242579f2993b64e16ef3dcab95afd497333d8fa12f"
N_POINT = "03d8bbd6c639c62937b04d997f38c3770719c629d7014d49a24b4f98baa1292b49"

# RFC 9383, §3.2: each half of the PBKDF's output is reduced modulo the order, so it holds
# 64 bits more than the order, to keep the bias below 2^-64: 40 bytes for P-256.
HALF = (ORDER.bit_length() + 64 + 7) // 8
# The PBKDF that turns the code into w0 and w1: scrypt with the parameters RFC 9383, §3.2,
# recommends (protocol/setup/README.md).
SCRYPT_N = 32768
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_MEMORY = 2 * 128 * SCRYPT_R * SCRYPT_N  # what scrypt needs (RFC 7914, §6), twice over

CONFIRMATION_KEYS = b"ConfirmationKeys"  # RFC 9383, §3.4
SHARED_KEY = b"SharedKey"


class ExchangeError(Exception):
    """The exchange failed: a share that is not a point, or a wrong confirmation."""


def _point(hex_point: str) -> EccPoint:
    return ECC.import_key(bytes.fromhex(hex_point), curve_name="P-256").pointQ


M = _point(M_POINT)
N = _point(N_POINT)


def encode(point: EccPoint) -> bytes:
    """``point`` in SEC1's uncompressed form."""
    x, y = point.xy
    return b"\x04" + x.to_bytes(COORDINATE, "big") + y.to_bytes(COORDINATE, "big")


def decode(data: bytes) -> EccPoint:
    """The point that ``data`` holds in SEC1's uncompressed form. It must be on P-256 and
    not the point at infinity: on P-256, every other point is in the group (RFC 9383, §6)."""
    if len(data) != POINT or data[0] != 0x04:
        raise ExchangeError("a share must be an uncompressed point of 65 bytes")
    x = int.from_bytes(data[1 : 1 + COORDINATE], "big")
    y = int.from_bytes(data[1 + COORDINATE :], "big")
    if x >= PRIME or y >= PRIME:
        raise ExchangeError("a share's coordinates must be below the field's prime")
    try:
        point = EccPoint(x, y, curve="p256")
    except ValueError:
        raise ExchangeError("a share is not a point of P-256") from None
    if point.is_point_at_infinity():
        raise ExchangeError("a share is the point at infinity")
    return point


def _length(data: bytes) -> bytes:
    """``len()`` of RFC 9383: 8 bytes, little-endian."""
    return len(data).to_bytes(8, "little")


def _framed(*parts: bytes) -> bytes:
    return b"".join(_length(part) + part for part in parts)


def _scalar() -> int:
    """A random scalar, from 1 to the order minus 1."""
    return 1 + secrets.randbelow(ORDER - 1)


def _times_generator(scalar: int) -> EccPoint:
    return ECC.construct(curve="P-256", d=scalar).pointQ


def _hkdf(key: bytes, info: bytes, length: int) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=length, salt=None, info=info).derive(key)


def _mac(key: bytes, data: bytes) -> bytes:
    return hmac.new(key, data, hashlib.sha256).digest()


def stretch(
    code: bytes, salt: bytes, prover: bytes = b"", verifier: bytes = b""
) -> tuple[int, int]:
    """w0 and w1 for ``code``: scrypt of the code and the identities, split in two and
    reduced modulo the order (RFC 9383, §3.2)."""
    stretched = hashlib.scrypt(
        _framed(code, prover, verifier),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        maxmem=SCRYPT_MEMORY,
        dklen=2 * HALF,
    )
    return (
        int.from_bytes(stretched[:HALF], "big") % ORDER,
        int.from_bytes(stretched[HALF:], "big") % ORDER,
    )


def record(w1: int) -> EccPoint:
    """L, the record the Verifier keeps instead of w1 (RFC 9383, §3.2)."""
    return _times_generator(w1)


class _Keys:
    """The key schedule of RFC 9383, §3.4, from the transcript."""

    def __init__(self, transcript: bytes) -> None:
        main = hashlib.sha256(transcript).digest()
        confirmation = _hkdf(main, CONFIRMATION_KEYS, 2 * hashlib.sha256().digest_size)
        half = len(confirmation) // 2
        self.confirm_prover = confirmation[:half]
        self.confirm_verifier = confirmation[half:]
        self.shared = _hkdf(main, SHARED_KEY, hashlib.sha256().digest_size)


def _transcript(
    context: bytes,
    prover: bytes,
    verifier: bytes,
    share_prover: bytes,
    share_verifier: bytes,
    z: EccPoint,
    v: EccPoint,
    w0: int,
) -> bytes:
    """TT, the transcript (RFC 9383, §3.3)."""
    return _framed(
        context,
        prover,
        verifier,
        encode(M),
        encode(N),
        share_prover,
        share_verifier,
        encode(z),
        encode(v),
        w0.to_bytes(COORDINATE, "big"),
    )


class Verifier:
    """The robot's side: answers the Prover's share, then checks its confirmation."""

    def __init__(
        self,
        context: bytes,
        w0: int,
        record: EccPoint,
        prover: bytes = b"",
        verifier: bytes = b"",
        scalar: int | None = None,  # y; random unless a test replays known values
    ) -> None:
        self._context = context
        self._identities = (prover, verifier)
        self._w0 = w0
        self._record = record
        self._y = _scalar() if scalar is None else scalar
        self._keys: _Keys | None = None
        self._share: bytes | None = None

    def respond(self, share_prover: bytes) -> tuple[bytes, bytes]:
        """shareV and confirmV, for the Prover's share X (RFC 9383, §3.3 and §3.4)."""
        x_point = decode(share_prover)
        share = encode(_times_generator(self._y) + self._w0 * N)
        z = self._y * (x_point + (-(self._w0 * M)))
        v = self._y * self._record
        if z.is_point_at_infinity() or v.is_point_at_infinity():
            raise ExchangeError("the exchange gave the point at infinity")
        self._keys = _Keys(
            _transcript(self._context, *self._identities, share_prover, share, z, v, self._w0)
        )
        self._share = share
        return share, _mac(self._keys.confirm_verifier, share_prover)

    def finish(self, confirmation: bytes) -> bytes:
        """K_shared, if ``confirmation`` is the Prover's confirmP; ``ExchangeError`` if not."""
        if self._keys is None or self._share is None:
            raise ExchangeError("no share to confirm")
        expected = _mac(self._keys.confirm_prover, self._share)
        if not hmac.compare_digest(expected, confirmation):
            raise ExchangeError("the confirmation is wrong")
        return self._keys.shared


class Prover:
    """The app's side: sends its share, checks the Verifier's confirmation, confirms."""

    def __init__(
        self,
        context: bytes,
        w0: int,
        w1: int,
        prover: bytes = b"",
        verifier: bytes = b"",
        scalar: int | None = None,  # x; random unless a test replays known values
    ) -> None:
        self._context = context
        self._identities = (prover, verifier)
        self._w0 = w0
        self._w1 = w1
        self._x = _scalar() if scalar is None else scalar
        self.share = encode(_times_generator(self._x) + w0 * M)

    def finish(self, share_verifier: bytes, confirmation: bytes) -> tuple[bytes, bytes]:
        """confirmP and K_shared, if ``confirmation`` is the Verifier's confirmV;
        ``ExchangeError`` if not."""
        y_point = decode(share_verifier)
        base = y_point + (-(self._w0 * N))
        z = self._x * base
        v = self._w1 * base
        if z.is_point_at_infinity() or v.is_point_at_infinity():
            raise ExchangeError("the exchange gave the point at infinity")
        keys = _Keys(
            _transcript(
                self._context, *self._identities, self.share, share_verifier, z, v, self._w0
            )
        )
        if not hmac.compare_digest(_mac(keys.confirm_verifier, self.share), confirmation):
            raise ExchangeError("the confirmation is wrong")
        return _mac(keys.confirm_prover, share_verifier), keys.shared
