from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.asynchronous.database import AsyncDatabase

from app.core.catalog import Catalog, load_catalog
from app.core.chains import ChainContext, ChainRegistry
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.core.security import read_token

# All dependencies are `async def` so FastAPI never hops to its threadpool for them.


@dataclass(frozen=True)
class CurrentUser:
    address: str


async def settings_dep() -> Settings:
    return get_settings()


async def get_db(request: Request) -> AsyncDatabase:
    return request.app.state.db


async def get_catalog(settings: Annotated[Settings, Depends(settings_dep)]) -> Catalog:
    return load_catalog(settings.catalog_file)  # parsed once (lru_cache)


async def get_registry(request: Request) -> ChainRegistry:
    return request.app.state.registry


async def get_chain(chain_id: int, registry: Annotated[ChainRegistry, Depends(get_registry)]) -> ChainContext:
    chain = registry.get(chain_id)
    if chain is None:
        raise ApiError(
            404, "unsupported_chain", f"Tensile is not deployed on chain {chain_id}", {"supported": registry.chain_ids()}
        )
    return chain


_bearer = HTTPBearer(auto_error=False)


async def get_optional_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(settings_dep)],
) -> CurrentUser | None:
    if creds is None:
        return None
    return CurrentUser(address=read_token(creds.credentials, settings))


async def get_current_user(user: Annotated[CurrentUser | None, Depends(get_optional_user)]) -> CurrentUser:
    if user is None:
        raise ApiError(401, "not_authenticated", "Connect and sign in with your wallet")
    return user


AppSettings = Annotated[Settings, Depends(settings_dep)]
Db = Annotated[AsyncDatabase, Depends(get_db)]
CatalogDep = Annotated[Catalog, Depends(get_catalog)]
Registry = Annotated[ChainRegistry, Depends(get_registry)]
Chain = Annotated[ChainContext, Depends(get_chain)]
User = Annotated[CurrentUser, Depends(get_current_user)]
OptionalUser = Annotated[CurrentUser | None, Depends(get_optional_user)]
