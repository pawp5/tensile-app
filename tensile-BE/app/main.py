import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.catalog import load_catalog
from app.core.chains import ChainRegistry
from app.core.config import get_settings
from app.core.db import create_client, ensure_indexes
from app.core.errors import install_error_handlers
from app.core.process import Runtime, setup_logging
from app.indexer import service as indexer
from app.routers import auth, chains, health, inspections, kyc, lots, me, ops, portfolio, protocol, search, tokenize
from app.worker import service as worker

setup_logging()
log = logging.getLogger("tensile.api")


def _report_crash(task: asyncio.Task) -> None:
    if not task.cancelled() and task.exception() is not None:
        log.error("background %s stopped", task.get_name(), exc_info=task.exception())


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    registry = ChainRegistry(settings)
    mongo = create_client(settings)
    db = mongo[settings.mongo_db]
    app.state.registry = registry
    app.state.db = db
    await ensure_indexes(db)

    # RUN_INDEXER / RUN_WORKER: the indexer and worker run in this process (one dyno for everything).
    # Leases keep it safe with several API processes: one indexes / sends per chain, the rest stand by.
    rt = Runtime(settings, registry, db, load_catalog(settings.catalog_file))
    background: list[asyncio.Task] = []
    if settings.run_indexer:
        background.append(asyncio.create_task(indexer.serve(rt, registry.all()), name="indexer"))
    if settings.run_worker:
        background.append(asyncio.create_task(worker.serve(rt, registry.all()), name="worker"))
    for task in background:
        task.add_done_callback(_report_crash)
    if background:
        log.info("background services in this process: %s", ", ".join(t.get_name() for t in background))
    try:
        yield
    finally:
        for task in background:
            task.cancel()
        await asyncio.gather(*background, return_exceptions=True)  # releases their leases
        await registry.close()
        await mongo.close()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Tensile API", version="0.1.0", lifespan=lifespan, docs_url = "/docs")
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    # Auth is a Bearer token (no cookies), so allowing every origin is safe.
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    install_error_handlers(app)
    for module in (health, chains, auth, me, protocol, kyc, lots, portfolio, search, ops, tokenize, inspections):
        app.include_router(module.router, prefix=settings.api_prefix)
    return app


app = create_app()
