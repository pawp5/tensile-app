from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.chains import gather_rpc
from app.core.deps import Chain, Db, User
from app.core.roles import ROLES, personas_for
from app.core.schemas import IdentityOut, MeOut

router = APIRouter(tags=["me"])


@router.get("/chains/{chain_id}/me", response_model=MeOut)
async def me(chain: Chain, user: User, db: Db) -> MeOut:
    access = chain.contract("TensileAccessManager")
    identity = chain.contract("IdentityRegistry")
    names = list(ROLES)

    application = await db.kyc_applications.find_one({"address": user.address}, {"status": 1, "orgName": 1})
    *held, record, verified = await gather_rpc(
        *(chain.call(access.functions.hasRole(ROLES[n], user.address)) for n in names),
        chain.call(identity.functions.identityOf(user.address)),
        chain.call(identity.functions.isVerified(user.address)),
    )
    app_status = (application or {}).get("status")

    roles = {n for n, has in zip(names, held) if has}
    _, country, tier, expiry = record
    expires_at = datetime.fromtimestamp(expiry, timezone.utc) if expiry else None
    lapsed = bool(tier) and expires_at is not None and expires_at <= datetime.now(timezone.utc)
    if verified:
        status = "verified"
    elif app_status == "in_review":
        status = "in_review"
    elif lapsed:
        status = "expired"
    elif app_status == "rejected":
        status = "rejected"
    elif app_status == "approved":
        status = "in_review"  # approved; the on-chain attestation is on its way
    else:
        status = "not_started"

    return MeOut(
        chain_id=chain.chain_id,
        address=user.address,
        roles=sorted(roles),
        personas=personas_for(roles),
        identity=IdentityOut(
            status=status,
            verified=bool(verified),
            country=country.rstrip(b"\x00").decode("ascii", "ignore") or None,
            tier=int(tier),
            expires_at=expires_at,
            org_name=(application or {}).get("orgName"),
            application_status=app_status,
        ),
    )
