# SPDX-License-Identifier: MIT
"""SPAKE2+ (RFC 9383), as the set-up session runs it: RFC 9383's test vectors, and
the checks on what the other side sends."""

from __future__ import annotations

import pytest

from ai_robot.core.spake2plus import (
    ORDER,
    PRIME,
    ExchangeError,
    Prover,
    Verifier,
    decode,
    encode,
    record,
    stretch,
)

# RFC 9383, Appendix C: the vectors of P256-SHA256-HKDF-SHA256-HMAC-SHA256.
CONTEXT = b"SPAKE2+-P256-SHA256-HKDF-SHA256-HMAC-SHA256 Test Vectors"
PROVER, VERIFIER = b"client", b"server"
W0 = 0xBB8E1BBCF3C48F62C08DB243652AE55D3E5586053FCA77102994F23AD95491B3
W1 = 0x7E945F34D78785B8A3EF44D0DF5A1A97D6B3B460409A345CA7830387A74B1DBA
L = bytes.fromhex(
    "04eb7c9db3d9a9eb1f8adab81b5794c1f13ae3e225efbe91ea487425854c7fc00f"
    "00bfedcbd09b2400142d40a14f2064ef31dfaa903b91d1faea7093d835966efd"
)
X = 0xD1232C8E8693D02368976C174E2088851B8365D0D79A9EEE709C6A05A2FAD539
SHARE_P = bytes.fromhex(
    "04ef3bd051bf78a2234ec0df197f7828060fe9856503579bb1733009042c15c0c1"
    "de127727f418b5966afadfdd95a6e4591d171056b333dab97a79c7193e341727"
)
Y = 0x717A72348A182085109C8D3917D6C43D59B224DC6A7FC4F0483232FA6516D8B3
SHARE_V = bytes.fromhex(
    "04c0f65da0d11927bdf5d560c69e1d7d939a05b0e88291887d679fcadea75810fb"
    "5cc1ca7494db39e82ff2f50665255d76173e09986ab46742c798a9a68437b048"
)
CONFIRM_P = bytes.fromhex("926cc713504b9b4d76c9162ded04b5493e89109f6d89462cd33adc46fda27527")
CONFIRM_V = bytes.fromhex("9747bcc4f8fe9f63defee53ac9b07876d907d55047e6ff2def2e7529089d3e68")
K_SHARED = bytes.fromhex("0c5f8ccd1413423a54f6c1fb26ff01534a87f893779c6e68666d772bfd91f3e7")

SALT = bytes(range(16))


def rfc_prover() -> Prover:
    return Prover(CONTEXT, W0, W1, PROVER, VERIFIER, scalar=X)


def rfc_verifier() -> Verifier:
    return Verifier(CONTEXT, W0, decode(L), PROVER, VERIFIER, scalar=Y)


def test_the_record_is_w1_times_the_generator() -> None:
    assert encode(record(W1)) == L


def test_the_shares_and_confirmations_are_those_of_rfc_9383() -> None:
    prover, verifier = rfc_prover(), rfc_verifier()
    assert prover.share == SHARE_P
    assert verifier.respond(SHARE_P) == (SHARE_V, CONFIRM_V)
    assert prover.finish(SHARE_V, CONFIRM_V) == (CONFIRM_P, K_SHARED)
    assert verifier.finish(CONFIRM_P) == K_SHARED


def test_both_sides_agree_on_a_key_from_the_same_code() -> None:
    w0, w1 = stretch(b"12345678", SALT)
    prover = Prover(b"context", w0, w1)
    verifier = Verifier(b"context", w0, record(w1))
    share, confirmation = verifier.respond(prover.share)
    confirm, key = prover.finish(share, confirmation)
    assert verifier.finish(confirm) == key
    assert len(key) == 32


def test_a_wrong_code_fails_on_both_sides() -> None:
    w0, w1 = stretch(b"12345678", SALT)
    wrong0, wrong1 = stretch(b"12345679", SALT)
    prover = Prover(b"context", wrong0, wrong1)
    verifier = Verifier(b"context", w0, record(w1))
    share, confirmation = verifier.respond(prover.share)
    with pytest.raises(ExchangeError, match="confirmation is wrong"):
        prover.finish(share, confirmation)
    with pytest.raises(ExchangeError, match="confirmation is wrong"):
        verifier.finish(b"\x00" * 32)


def test_another_context_gives_other_keys() -> None:
    w0, w1 = stretch(b"12345678", SALT)
    prover = Prover(b"one session", w0, w1)
    verifier = Verifier(b"another session", w0, record(w1))
    share, confirmation = verifier.respond(prover.share)
    with pytest.raises(ExchangeError):
        prover.finish(share, confirmation)


def test_the_code_is_stretched_with_its_salt() -> None:
    w0, w1 = stretch(b"12345678", SALT)
    assert (w0, w1) == stretch(b"12345678", SALT)
    assert (w0, w1) != stretch(b"12345678", bytes(16))
    assert 0 <= w0 < ORDER and 0 <= w1 < ORDER and w0 != w1


def test_the_verifier_needs_a_share_before_a_confirmation() -> None:
    with pytest.raises(ExchangeError, match="no share"):
        rfc_verifier().finish(CONFIRM_P)


@pytest.mark.parametrize(
    ("share", "problem"),
    [
        (SHARE_P[:-1], "65 bytes"),
        (b"\x02" + SHARE_P[1:33] + b"\x00" * 32, "uncompressed"),
        (SHARE_P[:-1] + bytes([SHARE_P[-1] ^ 1]), "not a point"),
        (b"\x04" + PRIME.to_bytes(32, "big") + SHARE_P[33:], "below the field's prime"),
        (b"\x04" + bytes(64), "not a point|infinity"),
    ],
)
def test_shares_that_are_not_points_are_refused(share: bytes, problem: str) -> None:
    with pytest.raises(ExchangeError, match=problem):
        rfc_verifier().respond(share)
    with pytest.raises(ExchangeError, match=problem):
        rfc_prover().finish(share, CONFIRM_V)
