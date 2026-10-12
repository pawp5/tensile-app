import asyncio
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable

import aiohttp
from eth_utils import to_checksum_address
from web3 import AsyncHTTPProvider, AsyncWeb3
from web3.exceptions import Web3Exception

from app.core.config import Settings
from app.core.errors import ApiError

# Deployment keys look like "C06_MaterialPassport"; strip the "C06_" id to get the contract name.
_ID_PREFIX = re.compile(r"^C\d+[a-z]?_")
# Deployment names whose ABI file is named differently.
ABI_ALIASES: dict[str, str] = {"USDC": "MockUSDC"}
# Errors worth retrying: the node was slow, rate-limited (HTTP 429) or dropped the connection.
TRANSIENT = (TimeoutError, aiohttp.ClientError, ConnectionError)


async def with_retries(make_call, *, retries: int = 3, timeout: float = 20.0):
    """Run `await make_call()` with a timeout, retrying transient network errors with back-off."""
    delay = 0.5
    for attempt in range(retries + 1):
        try:
            return await asyncio.wait_for(make_call(), timeout)
        except TRANSIENT:
            if attempt == retries:
                raise
            await asyncio.sleep(delay)
            delay *= 2


@dataclass(frozen=True)
class ChainConfig:
    chain_id: int
    name: str
    short_name: str
    testnet: bool
    native_currency: dict[str, Any]
    rpc_url: str  # may be a private override; never returned to clients
    public_rpc_url: str
    explorer_url: str | None
    deploy_block: int
    logs_block_range: int
    addresses: dict[str, str]
    confirmations: int = 2  # the indexer stays this many blocks behind the head (reorg safety)

    def public(self) -> dict[str, Any]:
        return {
            "chainId": self.chain_id,
            "name": self.name,
            "shortName": self.short_name,
            "testnet": self.testnet,
            "nativeCurrency": self.native_currency,
            "rpcUrl": self.public_rpc_url,
            "explorerUrl": self.explorer_url,
            "addresses": self.addresses,
        }


def load_chain_configs(settings: Settings) -> dict[int, ChainConfig]:
    meta: dict[str, dict[str, Any]] = json.loads(settings.chains_file.read_text())
    configs: dict[int, ChainConfig] = {}
    for path in sorted(settings.deployments_dir.glob("*.json")):
        raw = json.loads(path.read_text())
        chain_id = int(raw.get("chainId", path.stem))
        m = meta.get(str(chain_id))
        if m is None:
            raise RuntimeError(f"deployments/{path.name}: chain {chain_id} is missing from chains.json")
        if not m.get("enabled", True):
            continue
        configs[chain_id] = ChainConfig(
            chain_id=chain_id,
            name=m["name"],
            short_name=m.get("shortName", str(chain_id)),
            testnet=bool(m.get("testnet", False)),
            native_currency=m["nativeCurrency"],
            rpc_url=settings.rpc_urls.get(chain_id, m["rpcUrl"]),
            public_rpc_url=m["rpcUrl"],
            explorer_url=m.get("explorerUrl"),
            deploy_block=int(m.get("deployBlock", 0)),
            logs_block_range=int(m.get("logsBlockRange", 1000)),
            confirmations=int(m.get("confirmations", 2)),
            addresses={
                _ID_PREFIX.sub("", key): to_checksum_address(value)
                for key, value in raw.items()
                if isinstance(value, str) and value.startswith("0x")
            },
        )
    if not configs:
        raise RuntimeError(f"No deployments found in {settings.deployments_dir}")
    return configs


def load_abis(abis_dir: Path) -> dict[str, list[dict[str, Any]]]:
    if not abis_dir.exists():
        return {}
    return {p.stem: json.loads(p.read_text()) for p in abis_dir.glob("*.json")}


class ChainContext:
    """One chain: its config, an async web3 client and cached contract objects."""

    def __init__(self, config: ChainConfig, abis: dict[str, list[dict[str, Any]]], timeout: float) -> None:
        self.config = config
        self.timeout = timeout
        self._abis = abis
        self._contracts: dict[str, Any] = {}
        self.w3 = AsyncWeb3(
            AsyncHTTPProvider(
                config.rpc_url,
                request_kwargs={"timeout": aiohttp.ClientTimeout(total=timeout)},
                # web3 checks the chain id before every call; ask the node once, not every time
                cache_allowed_requests=True,
                cacheable_requests={"eth_chainId"},
            )
        )

    @property
    def chain_id(self) -> int:
        return self.config.chain_id

    def _abi(self, name: str) -> list[dict[str, Any]]:
        abi = self._abis.get(name)
        if abi is None:
            raise ApiError(503, "abi_missing", f"{name}.json is missing from app/abis. Run scripts/export_abis.py.")
        return abi

    def contract(self, name: str) -> Any:
        cached = self._contracts.get(name)
        if cached is not None:
            return cached
        address = self.config.addresses.get(name)
        if address is None:
            raise ApiError(404, "not_deployed", f"{name} is not deployed on chain {self.chain_id}")
        contract = self.w3.eth.contract(address=address, abi=self._abi(ABI_ALIASES.get(name, name)))
        self._contracts[name] = contract
        return contract

    def contract_at(self, abi_name: str, address: str) -> Any:
        """Contracts with per-lot / per-warehouse addresses (wrappers, feeds, oracles)."""
        return self.w3.eth.contract(address=to_checksum_address(address), abi=self._abi(abi_name))

    def factory(self, abi_name: str, bytecode: str) -> Any:
        """Undeployed contract (for .constructor(...)), used by scripts/seed.py."""
        return self.w3.eth.contract(abi=self._abi(abi_name), bytecode=bytecode)

    @property
    def abis(self) -> dict[str, list[dict[str, Any]]]:
        return self._abis

    async def call(self, fn: Any, block: int | str = "latest", *, timeout: float | None = None, retries: int = 1) -> Any:
        """Read a contract view. Network errors and timeouts are retried with back-off; reverts are not."""
        return await with_retries(lambda: fn.call(block_identifier=block), retries=retries, timeout=timeout or self.timeout)

    async def block_number(self) -> int:
        return await asyncio.wait_for(self.w3.eth.block_number, self.timeout)

    async def close(self) -> None:
        disconnect = getattr(self.w3.provider, "disconnect", None)
        if disconnect is not None:
            await disconnect()


class ChainRegistry:
    def __init__(self, settings: Settings) -> None:
        abis = load_abis(settings.abis_dir)
        self._chains = {
            cid: ChainContext(cfg, abis, settings.rpc_timeout_seconds)
            for cid, cfg in load_chain_configs(settings).items()
        }
        preferred = settings.default_chain_id
        self.default_chain_id = preferred if preferred in self._chains else next(iter(self._chains))

    def get(self, chain_id: int) -> ChainContext | None:
        return self._chains.get(chain_id)

    def all(self) -> list[ChainContext]:
        return list(self._chains.values())

    def chain_ids(self) -> list[int]:
        return list(self._chains)

    async def close(self) -> None:
        await asyncio.gather(*(c.close() for c in self._chains.values()), return_exceptions=True)


def _map_rpc_error(exc: Exception) -> ApiError:
    if isinstance(exc, ApiError):
        return exc
    if isinstance(exc, TimeoutError):
        return ApiError(504, "rpc_timeout", "The chain RPC did not answer in time")
    if isinstance(exc, (aiohttp.ClientError, ConnectionError)):
        return ApiError(502, "rpc_unavailable", "The chain RPC is unreachable")
    if isinstance(exc, Web3Exception):
        return ApiError(502, "chain_call_failed", str(exc)[:300])
    return ApiError(500, "internal_error", "Chain read failed")


async def gather_rpc(*calls: Awaitable[Any]) -> list[Any]:
    """Run chain reads concurrently; each is bounded by the chain timeout. First failure maps to an ApiError."""
    results = await asyncio.gather(*calls, return_exceptions=True)
    for result in results:
        if isinstance(result, Exception):
            raise _map_rpc_error(result) from result
        if isinstance(result, BaseException):
            raise result
    return list(results)
