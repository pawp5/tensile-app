"""Role checks for staff endpoints, against the on-chain TensileAccessManager.

Results are cached for a minute per process, so a staff page doesn't cost an RPC call per request.
"""
import asyncio
import time
from typing import Annotated

from fastapi import Depends

from app.core.chains import ChainContext, ChainRegistry
from app.core.deps import CurrentUser, get_chain, get_current_user, get_registry
from app.core.errors import ApiError
from app.core.roles import OPS_ROLES, ROLES

_TTL = 60.0
_cache: dict[tuple[int, str, str], tuple[float, bool]] = {}
STAFF_ROLES = tuple(sorted(OPS_ROLES | {"INSPECTOR"}))


async def has_role(chain: ChainContext, address: str, role: str) -> bool:
    key = (chain.chain_id, address, role)
    hit = _cache.get(key)
    now = time.monotonic()
    if hit and now - hit[0] < _TTL:
        return hit[1]
    held = bool(await chain.call(chain.contract("TensileAccessManager").functions.hasRole(ROLES[role], address)))
    _cache[key] = (now, held)
    return held


async def roles_on(chain: ChainContext, address: str, roles: tuple[str, ...]) -> set[str]:
    held = await asyncio.gather(*(has_role(chain, address, r) for r in roles), return_exceptions=True)
    return {r for r, h in zip(roles, held) if h is True}


async def has_role_anywhere(registry: ChainRegistry, address: str, role: str) -> bool:
    """True if the role is held on any chain (KYC is shared across chains). Chains whose RPC is down are skipped."""
    held = await asyncio.gather(*(has_role(c, address, role) for c in registry.all()), return_exceptions=True)
    return any(h is True for h in held)


def require_chain_role(*roles: str):
    """Dependency for /chains/{chain_id}/... staff routes: the user must hold one of `roles` on that chain."""

    async def dep(
        chain: Annotated[ChainContext, Depends(get_chain)],
        user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if not await roles_on(chain, user.address, roles):
            raise ApiError(403, "forbidden", f"This needs one of {', '.join(roles)} on {chain.config.name}")
        return user

    return dep


def require_role_anywhere(role: str):
    """Dependency for chain-independent staff routes (KYC review)."""

    async def dep(
        registry: Annotated[ChainRegistry, Depends(get_registry)],
        user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if not await has_role_anywhere(registry, user.address, role):
            raise ApiError(403, "forbidden", f"This needs the {role} role")
        return user

    return dep


StaffUser = Annotated[CurrentUser, Depends(require_chain_role(*STAFF_ROLES))]
KycAdmin = Annotated[CurrentUser, Depends(require_role_anywhere("KYC_ADMIN"))]
