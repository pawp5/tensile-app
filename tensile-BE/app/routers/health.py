import asyncio

from fastapi import APIRouter

from app.core.chains import ChainContext
from app.core.deps import Db, Registry
from app.core.schemas import ChainStatus, HealthOut, ServiceStatus

router = APIRouter(tags=["health"])


@router.get("/livez")
async def livez() -> dict[str, bool]:
    """No I/O. For load balancer liveness checks."""
    return {"ok": True}


@router.get("/health", response_model=HealthOut)
async def health(db: Db, registry: Registry) -> HealthOut:
    async def mongo() -> ServiceStatus:
        try:
            await asyncio.wait_for(db.command("ping"), 3)
            return ServiceStatus(ok=True)
        except Exception as exc:
            return ServiceStatus(ok=False, error=type(exc).__name__)

    async def chain(ctx: ChainContext) -> ChainStatus:
        try:
            return ChainStatus(chain_id=ctx.chain_id, ok=True, block=await ctx.block_number())
        except Exception as exc:
            return ChainStatus(chain_id=ctx.chain_id, ok=False, error=type(exc).__name__)

    mongo_status, *chains = await asyncio.gather(mongo(), *(chain(c) for c in registry.all()))
    healthy = mongo_status.ok and all(c.ok for c in chains)
    return HealthOut(status="ok" if healthy else "degraded", mongo=mongo_status, chains=chains)