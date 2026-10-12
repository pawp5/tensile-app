"""Sends transactions from a backend-held key (seed script and worker).

Transactions go out in waves: every transaction in a wave must be independent of the others
(gas is estimated before any of them is mined). Nonces are tracked locally so a wave lands in
one or two blocks instead of one block per transaction.
"""
import asyncio
import logging
from dataclasses import dataclass
from typing import Any

from eth_account import Account
from eth_utils import keccak
from web3 import AsyncWeb3
from web3.exceptions import ContractLogicError

from app.core.chains import with_retries

log = logging.getLogger("tensile.tx")


class TxFailed(RuntimeError):
    pass


@dataclass
class Tx:
    label: str
    call: Any  # contract function call or constructor: anything with async .build_transaction()


def error_selectors(abis: dict[str, list[dict]]) -> dict[str, str]:
    """4-byte selector -> "ErrorName(types)" for every custom error in the given ABIs."""
    out: dict[str, str] = {}
    for abi in abis.values():
        for item in abi:
            if item.get("type") == "error":
                sig = f"{item['name']}({','.join(i['type'] for i in item.get('inputs', []))})"
                out["0x" + keccak(text=sig)[:4].hex()] = sig
    return out


class TxSender:
    def __init__(self, w3: AsyncWeb3, private_key: str, *, errors: dict[str, str] | None = None,
                 wave_size: int = 12, gas_multiplier: float = 1.25, receipt_timeout: int = 300) -> None:
        self.w3 = w3
        self.account = Account.from_key(private_key)
        self.address = self.account.address
        self.errors = errors or {}
        self.wave_size = wave_size
        self.gas_multiplier = gas_multiplier
        self.receipt_timeout = receipt_timeout
        self._nonce: int | None = None
        self._chain_id: int | None = None
        self._lock = asyncio.Lock()

    def explain(self, exc: Exception) -> str:
        data = getattr(exc, "data", None)
        if isinstance(data, str) and data.startswith("0x") and len(data) >= 10:
            return self.errors.get(data[:10], f"custom error {data[:10]}")
        return str(exc)

    async def _fees(self) -> dict[str, int]:
        try:
            block = await with_retries(lambda: self.w3.eth.get_block("latest"))
            base = block.get("baseFeePerGas")
            if base is not None:
                tip = await with_retries(lambda: self.w3.eth.max_priority_fee)
                return {"maxFeePerGas": int(base) * 2 + int(tip), "maxPriorityFeePerGas": int(tip)}
        except Exception:  # chain without EIP-1559 fee methods
            pass
        return {"gasPrice": int(await with_retries(lambda: self.w3.eth.gas_price))}

    async def _broadcast(self, raw: bytes, tx_hash: bytes) -> None:
        """Send a signed tx. If a retry finds the node already has it, that counts as sent."""
        try:
            await with_retries(lambda: self.w3.eth.send_raw_transaction(raw))
        except Exception as exc:
            if "already known" not in str(exc).lower() and "known transaction" not in str(exc).lower():
                raise

    async def send(self, txs: list[Tx]) -> list[dict]:
        """Send independent transactions; returns receipts in order. Raises TxFailed on any revert."""
        receipts: list[dict] = []
        async with self._lock:
            if self._chain_id is None:
                self._chain_id = await with_retries(lambda: self.w3.eth.chain_id)
            try:
                for i in range(0, len(txs), self.wave_size):
                    receipts.extend(await self._wave(txs[i:i + self.wave_size]))
            except BaseException:
                # Some of the wave may not have gone out (or another process used the key):
                # ask the node for the nonce again next time instead of trusting the local count.
                self.reset_nonce()
                raise
        return receipts

    def reset_nonce(self) -> None:
        """Forget the local nonce; the next send reads the pending nonce from the node."""
        self._nonce = None

    async def _wave(self, txs: list[Tx]) -> list[dict]:
        if self._nonce is None:
            self._nonce = await with_retries(lambda: self.w3.eth.get_transaction_count(self.address, "pending"))
        fees = await self._fees()
        base = {"from": self.address, "chainId": self._chain_id, **fees}
        sent: list[tuple[Tx, bytes]] = []
        for tx in txs:
            try:
                params = await with_retries(lambda: tx.call.build_transaction(dict(base)))
            except ContractLogicError as exc:
                raise TxFailed(f"{tx.label}: would revert: {self.explain(exc)}") from exc
            params["gas"] = int(params["gas"] * self.gas_multiplier)
            params["nonce"] = self._nonce
            signed = self.account.sign_transaction(params)
            await self._broadcast(signed.raw_transaction, signed.hash)
            self._nonce += 1
            sent.append((tx, signed.hash))
            log.info("sent   %-48s %s", tx.label, "0x" + bytes(signed.hash).hex())

        receipts = await asyncio.gather(
            *(
                with_retries(
                    lambda h=h: self.w3.eth.wait_for_transaction_receipt(h, timeout=self.receipt_timeout, poll_latency=2),
                    timeout=self.receipt_timeout + 30,
                )
                for _, h in sent
            )
        )
        for (tx, tx_hash), receipt in zip(sent, receipts):
            if receipt["status"] != 1:
                raise TxFailed(f"{tx.label}: reverted in 0x{bytes(tx_hash).hex()}")
            log.info("mined  %-48s block %s", tx.label, receipt["blockNumber"])
        return list(receipts)
