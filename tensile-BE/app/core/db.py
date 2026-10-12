from pymongo import ASCENDING, DESCENDING, AsyncMongoClient, IndexModel
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import Settings

_A, _D = ASCENDING, DESCENDING

# collection -> indexes. Each stage adds its collections here; create_indexes is idempotent.
INDEXES: dict[str, list[IndexModel]] = {
    # ---- Stage 1: auth
    "auth_nonces": [
        IndexModel([("nonce", _A)], unique=True),
        IndexModel([("expiresAt", _A)], expireAfterSeconds=0),  # Mongo deletes expired nonces
    ],
    "users": [IndexModel([("lastLoginAt", _D)])],
    # ---- Stage 2: indexer + worker
    # leases {_id: "indexer:10143", owner, expiresAt} and chain_status {_id: chainId} only use _id
    "events": [  # every log from Tensile contracts, decoded
        IndexModel([("chainId", _A), ("blockNumber", _A), ("logIndex", _A)], unique=True),
        IndexModel([("chainId", _A), ("contract", _A), ("event", _A), ("blockNumber", _D)]),
        IndexModel([("chainId", _A), ("tokenId", _A), ("blockNumber", _D)], partialFilterExpression={"tokenId": {"$exists": True}}),
        IndexModel([("chainId", _A), ("addresses", _A), ("blockNumber", _D)]),
    ],
    "warehouses": [IndexModel([("chainId", _A), ("warehouseId", _A)], unique=True)],
    "lots": [
        IndexModel([("chainId", _A), ("tokenId", _A)], unique=True),
        IndexModel([("chainId", _A), ("owner", _A)]),
        IndexModel([("chainId", _A), ("state", _A), ("warehouseId", _A)]),
    ],
    "roles": [
        IndexModel([("chainId", _A), ("role", _A), ("account", _A)], unique=True),
        IndexModel([("chainId", _A), ("account", _A)]),
    ],
    "identities": [IndexModel([("chainId", _A), ("account", _A)], unique=True)],
    "prices": [IndexModel([("chainId", _A), ("material", _A), ("region", _A)], unique=True)],
    "price_history": [IndexModel([("chainId", _A), ("material", _A), ("region", _A), ("roundId", _D)], unique=True)],
    "reserve_history": [IndexModel([("chainId", _A), ("warehouseId", _A), ("roundId", _D)], unique=True)],
    "mint_requests": [
        IndexModel([("chainId", _A), ("requestId", _A)], unique=True),
        IndexModel([("chainId", _A), ("owner", _A), ("createdAt", _D)]),
        IndexModel([("chainId", _A), ("status", _A), ("createdAt", _D)]),
    ],
    "attestations": [
        IndexModel([("chainId", _A), ("index", _A)], unique=True),
        IndexModel([("chainId", _A), ("subjectType", _A), ("subject", _A), ("index", _A)]),
    ],
    # ---- Stage 3: KYC (documents live in GridFS bucket "kyc_docs")
    "kyc_applications": [
        IndexModel([("address", _A)], unique=True),
        IndexModel([("status", _A), ("submittedAt", _D)]),
    ],
    # ---- Stage 4: tokenize + inspections (files live in GridFS bucket "evidence")
    "mint_drafts": [
        IndexModel([("chainId", _A), ("owner", _A), ("status", _A), ("updatedAt", _D)]),
        IndexModel([("chainId", _A), ("status", _A), ("evidenceUri", _A)]),
        IndexModel([("chainId", _A), ("certHash", _A), ("status", _A)]),
        IndexModel([("documents.sha256", _A)]),
    ],
    "reports": [  # bodies behind attestations; dataHash = keccak256(canonical body)
        IndexModel([("chainId", _A), ("dataHash", _A)]),
        IndexModel([("chainId", _A), ("kind", _A), ("subjectType", _A), ("subject", _A), ("createdAt", _D)]),
        IndexModel([("chainId", _A), ("createdBy", _A), ("createdAt", _D)]),
    ],
    "inspectors": [IndexModel([("address", _A)], unique=True)],
    "reinspection_orders": [
        IndexModel([("chainId", _A), ("seq", _A)], unique=True),
        IndexModel([("chainId", _A), ("status", _A), ("dueAt", _A)]),
        IndexModel([("chainId", _A), ("tokenId", _A)]),
    ],
    # counters {_id: "reinspection:10143", seq} only use _id
    "jobs": [
        IndexModel([("chainId", _A), ("status", _A), ("runAt", _A)]),
        IndexModel([("chainId", _A), ("kind", _A), ("payload.requestId", _A), ("createdAt", _D)]),  # Stage 4: jobs per mint request
        # one open job per dedupe key ("open" is removed when the job finishes)
        IndexModel([("dedupeKey", _A)], unique=True, partialFilterExpression={"open": True, "dedupeKey": {"$exists": True}}),
        IndexModel([("finishedAt", _A)], expireAfterSeconds=14 * 86400),
    ],
}


def create_client(settings: Settings, app_name: str = "tensile-api") -> AsyncMongoClient:
    return AsyncMongoClient(
        settings.mongo_uri,
        maxPoolSize=settings.mongo_max_pool_size,
        serverSelectionTimeoutMS=5_000,
        tz_aware=True,
        appname=app_name,
    )


async def ensure_indexes(db: AsyncDatabase) -> None:
    for name, models in INDEXES.items():
        await db[name].create_indexes(models)
