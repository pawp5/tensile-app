import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import is_address, to_checksum_address

from app.core.config import Settings
from app.core.errors import ApiError

from fnmatch import fnmatchcase

JWT_ALG = "HS256"
CLOCK_SKEW = timedelta(seconds=60)
_HEADER = re.compile(r"^(?P<domain>\S+) wants you to sign in with your Ethereum account:$")


class SiweError(ValueError):
    pass


@dataclass(frozen=True)
class SiweMessage:
    domain: str
    address: str
    uri: str
    version: str
    chain_id: int
    nonce: str
    issued_at: datetime
    expiration_time: datetime | None
    not_before: datetime | None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ts(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def parse_siwe(message: str) -> SiweMessage:
    """EIP-4361 message, as produced by viem's createSiweMessage."""
    lines = message.replace("\r\n", "\n").split("\n")
    header = _HEADER.match(lines[0]) if lines else None
    if header is None or len(lines) < 2 or not is_address(lines[1].strip()):
        raise SiweError("Not a Sign-In with Ethereum message")
    fields: dict[str, str] = {}
    for line in lines[2:]:
        key, sep, value = line.partition(": ")
        if sep:
            fields[key.strip()] = value.strip()  # last wins: real fields come after the statement
    try:
        return SiweMessage(
            domain=header["domain"],
            address=to_checksum_address(lines[1].strip()),
            uri=fields["URI"],
            version=fields["Version"],
            chain_id=int(fields["Chain ID"]),
            nonce=fields["Nonce"],
            issued_at=_ts(fields["Issued At"]),
            expiration_time=_ts(fields["Expiration Time"]) if "Expiration Time" in fields else None,
            not_before=_ts(fields["Not Before"]) if "Not Before" in fields else None,
        )
    except (KeyError, ValueError) as exc:
        raise SiweError(f"Malformed sign-in message: {exc}") from exc


def domain_allowed(domain: str, patterns: list[str]) -> bool:
    """Exact hosts ("app.tensile.xyz") or shell-style patterns ("tensile-*.vercel.app")."""
    return any(fnmatchcase(domain, pattern) for pattern in patterns)

def verify_siwe(message: str, signature: str, allowed_domains: list[str]) -> SiweMessage:
    """CPU-bound (signature recovery): call it through asyncio.to_thread."""
    msg = parse_siwe(message)
    if not domain_allowed(msg.domain, allowed_domains):
        raise SiweError(f"Sign-in domain {msg.domain} is not allowed")
    if msg.version != "1":
        raise SiweError("Unsupported sign-in message version")
    now = utcnow()
    if msg.issued_at > now + CLOCK_SKEW:
        raise SiweError("Sign-in message is dated in the future")
    if msg.expiration_time is not None and msg.expiration_time <= now:
        raise SiweError("Sign-in message has expired")
    if msg.not_before is not None and msg.not_before > now + CLOCK_SKEW:
        raise SiweError("Sign-in message is not valid yet")
    try:
        signer = Account.recover_message(encode_defunct(text=message), signature=signature)
    except Exception as exc:
        raise SiweError("Signature could not be verified") from exc
    if signer != msg.address:
        raise SiweError("Signature does not match the address in the message")
    return msg


def issue_token(address: str, settings: Settings) -> tuple[str, datetime]:
    now = utcnow()
    expires_at = now + timedelta(minutes=settings.jwt_ttl_minutes)
    token = jwt.encode({"sub": address, "iat": now, "exp": expires_at}, settings.jwt_secret, algorithm=JWT_ALG)
    return token, expires_at


def read_token(token: str, settings: Settings) -> str:
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALG], options={"require": ["sub", "exp"]})
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(401, "session_expired", "Your session expired. Sign in again.") from exc
    except jwt.InvalidTokenError as exc:
        raise ApiError(401, "invalid_session", "Sign in again.") from exc
    return to_checksum_address(claims["sub"])