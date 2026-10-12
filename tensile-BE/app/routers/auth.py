import asyncio
import secrets
from datetime import timedelta

from fastapi import APIRouter

from app.core.deps import AppSettings, Db, User
from app.core.errors import ApiError
from app.core.schemas import NonceIn, NonceOut, SessionInfoOut, SessionOut, VerifyIn
from app.core.security import SiweError, issue_token, utcnow, verify_siwe

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/nonce", response_model=NonceOut)
async def create_nonce(body: NonceIn, db: Db, settings: AppSettings) -> NonceOut:
    now = utcnow()
    nonce = secrets.token_hex(16)
    expires_at = now + timedelta(seconds=settings.siwe_nonce_ttl_seconds)
    await db.auth_nonces.insert_one(
        {"nonce": nonce, "address": body.address, "createdAt": now, "expiresAt": expires_at}
    )
    return NonceOut(nonce=nonce, expires_at=expires_at)


@router.post("/verify", response_model=SessionOut)
async def verify(body: VerifyIn, db: Db, settings: AppSettings) -> SessionOut:
    try:
        msg = await asyncio.to_thread(verify_siwe, body.message, body.signature, settings.siwe_domains)
    except SiweError as exc:
        raise ApiError(401, "invalid_signature", str(exc)) from exc

    now = utcnow()
    # Atomic: a nonce can be used once, by the address it was issued to, before it expires.
    consumed = await db.auth_nonces.find_one_and_delete(
        {"nonce": msg.nonce, "address": msg.address, "expiresAt": {"$gt": now}}
    )
    if consumed is None:
        raise ApiError(401, "invalid_nonce", "This sign-in request expired or was already used. Try again.")

    await db.users.update_one(
        {"_id": msg.address.lower()},
        {
            "$set": {"address": msg.address, "lastLoginAt": now, "lastChainId": msg.chain_id},
            "$setOnInsert": {"createdAt": now},
        },
        upsert=True,
    )
    token, expires_at = issue_token(msg.address, settings)
    return SessionOut(token=token, expires_at=expires_at, address=msg.address)


@router.get("/session", response_model=SessionInfoOut)
async def session(user: User) -> SessionInfoOut:
    return SessionInfoOut(address=user.address)