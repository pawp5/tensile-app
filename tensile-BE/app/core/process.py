"""Shared start-up for the background processes (python -m app.indexer / python -m app.worker)."""
import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass

from pymongo.asynchronous.database import AsyncDatabase

from app.core.catalog import Catalog, load_catalog
from app.core.chains import ChainContext, ChainRegistry
from app.core.config import Settings, get_settings
from app.core.db import create_client, ensure_indexes


@dataclass
class Runtime:
    settings: Settings
    registry: ChainRegistry
    db: AsyncDatabase
    catalog: Catalog

    def chains(self, only: list[int] | None) -> list[ChainContext]:
        if not only:
            return self.registry.all()
        missing = [c for c in only if self.registry.get(c) is None]
        if missing:
            raise SystemExit(f"no deployments/<id>.json for chain(s) {missing}; known: {self.registry.chain_ids()}")
        return [self.registry.get(c) for c in only]


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s  %(message)s")
    logging.getLogger("web3").setLevel(logging.WARNING)


@asynccontextmanager
async def runtime(app_name: str) -> AsyncIterator[Runtime]:
    settings = get_settings()
    registry = ChainRegistry(settings)
    mongo = create_client(settings, app_name)
    db = mongo[settings.mongo_db]
    try:
        await ensure_indexes(db)
        yield Runtime(settings, registry, db, load_catalog(settings.catalog_file))
    finally:
        await registry.close()
        await mongo.close()


def run(main: Callable[[], Awaitable[None]]) -> None:
    """asyncio.run that exits quietly on Ctrl+C (leases are released by the tasks' finally blocks)."""
    setup_logging()
    with suppress(KeyboardInterrupt, asyncio.CancelledError):
        asyncio.run(main())
