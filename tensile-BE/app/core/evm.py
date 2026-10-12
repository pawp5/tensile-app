"""Small conversions between chain values and what we store in Mongo / send to clients."""
from datetime import datetime, timezone
from typing import Any

INT64_MIN, INT64_MAX = -(2**63), 2**63 - 1
ZERO_ADDRESS = "0x" + "0" * 40


def to_doc(value: Any) -> Any:
    """Decoded ABI value -> Mongo-safe value: bytes -> 0x-hex, ints beyond int64 -> decimal strings."""
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value
    if isinstance(value, int):
        return value if INT64_MIN <= value <= INT64_MAX else str(value)
    if isinstance(value, (bytes, bytearray)):
        return "0x" + bytes(value).hex()
    if isinstance(value, dict):
        return {str(k): to_doc(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_doc(v) for v in value]
    return str(value)


def as_int(value: Any) -> int:
    """Inverse of to_doc for integers (stored as int or as a decimal string)."""
    return int(value) if value is not None else 0


def hex_to_bytes(value: str) -> bytes:
    return bytes.fromhex(value[2:] if value.startswith("0x") else value)


def bytes_to_text(value: bytes | str) -> str:
    """bytes32 / bytes2 string (zero padded) -> str."""
    raw = hex_to_bytes(value) if isinstance(value, str) else bytes(value)
    return raw.rstrip(b"\0").decode("ascii", "ignore")


def is_zero_address(address: str | None) -> bool:
    return not address or int(address, 16) == 0


def ts(seconds: int | None) -> datetime | None:
    """Unix seconds -> aware UTC datetime (None for 0 / missing)."""
    return datetime.fromtimestamp(int(seconds), timezone.utc) if seconds else None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
