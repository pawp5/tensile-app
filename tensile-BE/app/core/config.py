from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    env: str = "dev"
    api_prefix: str = "/v1"

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "tensile"
    mongo_max_pool_size: int = 100

    jwt_secret: str = Field(min_length=32)
    jwt_ttl_minutes: int = 720
    siwe_domains: list[str] = ["localhost:5173"]
    siwe_nonce_ttl_seconds: int = 600

    deployments_dir: Path = BACKEND_DIR / "deployments"
    chains_file: Path = BACKEND_DIR / "chains.json"
    catalog_file: Path = BACKEND_DIR / "catalog.json"
    abis_dir: Path = BACKEND_DIR / "app" / "abis"
    bytecode_dir: Path = BACKEND_DIR / "app" / "bytecode"

    rpc_urls: dict[int, str] = {}
    rpc_timeout_seconds: float = 8.0
    default_chain_id: int | None = None

    # ---- keys used by scripts/seed.py and the worker. The API itself never needs them.
    deployer_private_key: SecretStr | None = None  # holds ADMIN on every chain; runs the seed
    service_private_key: SecretStr | None = None  # backend's sending wallet; defaults to the deployer key
    reserve_signer_a_key: SecretStr | None = None  # warehouse-side reserve report signer (signs only, no gas)
    reserve_signer_b_key: SecretStr | None = None  # inspector-side reserve report signer (signs only, no gas)
    staff_wallets: list[str] = []  # get ADMIN, KYC_ADMIN, RISK_ADMIN, INSPECTOR and KYC on every chain
    kyc_wallets: list[str] = []  # get KYC only (demo users)

    # ---- background services inside the API process (one dyno runs everything).
    # Leave false and run python -m app.indexer / python -m app.worker instead when you want separate processes.
    run_indexer: bool = False
    run_worker: bool = False

    # ---- indexer (python -m app.indexer)
    indexer_poll_seconds: float = 2.0  # how often to look for new blocks once caught up
    indexer_parallel_ranges: int = 4  # eth_getLogs requests in flight while catching up
    snapshot_seconds: int = 30  # how often warehouses, prices and the vault are re-read

    # ---- worker (python -m app.worker)
    upkeep_seconds: int = 300  # how often the worker checks reserve reports and prices
    reserve_refresh_hours: float = 12.0  # re-submit a reserve report older than this (guard limit: 24 h)
    price_refresh_hours: float = 24.0  # heartbeat a price older than this (adapter limit: 3 days)
    low_gas_native: float = 0.05  # warn when the service wallet holds less than this (MON / ETH)
    mint_keeper_seconds: float = 10.0  # how often open mint requests are checked (review, custody, expiry)
    auto_custody: bool = True  # confirm custody after inspection for warehouses this backend's wallet operates

    @property
    def service_key(self) -> SecretStr | None:
        return self.service_private_key or self.deployer_private_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
