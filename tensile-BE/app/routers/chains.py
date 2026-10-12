from typing import Any

from fastapi import APIRouter

from app.core.deps import Chain, Registry

router = APIRouter(tags=["chains"])


@router.get("/chains")
async def list_chains(registry: Registry) -> dict[str, Any]:
    return {
        "defaultChainId": registry.default_chain_id,
        "chains": [c.config.public() for c in registry.all()],
    }


@router.get("/chains/{chain_id}")
async def get_chain_info(chain: Chain) -> dict[str, Any]:
    return chain.config.public()