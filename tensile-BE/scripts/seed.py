#!/usr/bin/env python3
"""Seed a Tensile deployment from catalog.json: roles, KYC, warehouses, reserve and price feeds,
Morpho oracles and classes, vault caps, and first reserve reports.

Safe to re-run: every step reads the chain first and only sends what is missing or stale.

    python scripts/seed.py --check                          # what each chain needs; sends nothing
    python scripts/seed.py --chain 10143                    # seed Monad testnet
    python scripts/seed.py --chain 11155111 --fund-vault 500000
"""
import argparse
import asyncio
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from eth_account import Account  # noqa: E402
from eth_utils import is_address, to_checksum_address  # noqa: E402

from app.core.catalog import Catalog, code_from_meta, load_catalog, meta_uri, region_bytes, region_str, usd_to_price8  # noqa: E402
from app.core.chains import ChainContext, ChainRegistry, with_retries  # noqa: E402
from app.core.config import Settings, get_settings  # noqa: E402
from app.core.roles import ROLES  # noqa: E402
from app.core.txsender import Tx, TxFailed, TxSender, error_selectors  # noqa: E402

STAFF_ROLES = ("ADMIN", "KYC_ADMIN", "RISK_ADMIN", "INSPECTOR")
REFRESH_AFTER = 12 * 3600  # re-submit reserve reports / refresh prices older than this (limits are 24 h / 3 days)
FAUCET_CAP_USDC = 1_000_000

log = logging.getLogger("seed")


def short(address: str) -> str:
    return f"{address[:6]}…{address[-4:]}"


def is_zero(address: str) -> bool:
    return int(address, 16) == 0


class Seeder:
    def __init__(self, chain: ChainContext, settings: Settings, catalog: Catalog, sender: TxSender, check: bool) -> None:
        self.chain = chain
        self.settings = settings
        self.cat = catalog
        self.tx = sender
        self.check = check
        self.todo: list[str] = []
        self._sem = asyncio.Semaphore(4)  # be gentle with public RPCs

        c = chain.contract
        self.access, self.identity, self.warehouses = c("TensileAccessManager"), c("IdentityRegistry"), c("WarehouseRegistry")
        self.passport, self.guard, self.adapter = c("MaterialPassport"), c("ReserveGuard"), c("PriceOracleAdapter")
        self.registry, self.vault, self.usdc = c("MarketRegistry"), c("TensileCreditVault"), c("USDC")

        self.me = sender.address
        self.service = Account.from_key(settings.service_key.get_secret_value()).address
        self.key_a = settings.reserve_signer_a_key.get_secret_value()
        self.key_b = settings.reserve_signer_b_key.get_secret_value()
        self.signer_a = Account.from_key(self.key_a).address
        self.signer_b = Account.from_key(self.key_b).address
        self.staff = [to_checksum_address(a) for a in settings.staff_wallets]
        self.kyc = [to_checksum_address(a) for a in settings.kyc_wallets]
        self.wh_ids: dict[str, int] = {}
        self.onchain: dict[int, tuple] = {}

    # ------------------------------------------------------------------ helpers

    async def read(self, fn):
        async with self._sem:
            return await self.chain.call(fn, timeout=20, retries=4)

    async def read_all(self, fns):
        return await asyncio.gather(*(self.read(f) for f in fns))

    async def run(self, txs: list[Tx], step: str) -> list[dict]:
        if not txs:
            log.info("  ✓ %s: nothing to do", step)
            return []
        if self.check:
            self.todo += [f"{step}: {t.label}" for t in txs]
            log.info("  • %s: %d to send", step, len(txs))
            return []
        log.info("  → %s: sending %d", step, len(txs))
        return await self.tx.send(txs)

    def bytecode(self, name: str) -> str:
        path = self.settings.bytecode_dir / f"{name}.hex"
        if not path.exists():
            raise SystemExit(f"{path} is missing: re-run scripts/export_abis.py with the Foundry out.zip")
        return path.read_text().strip()

    async def scan_warehouses(self) -> None:
        count = await self.read(self.warehouses.functions.warehouseCount())
        ids = list(range(1, count + 1))
        rows = await self.read_all(self.warehouses.functions.getWarehouse(i) for i in ids)
        self.onchain = dict(zip(ids, rows))  # (operator, regionCode, reserveFeed, active, frozen, metaURI)
        for wid, row in self.onchain.items():
            code = code_from_meta(row[5])
            if code and self.cat.warehouse(code):
                self.wh_ids[code] = wid

    # ------------------------------------------------------------------ steps

    async def step_roles(self) -> None:
        if not await self.read(self.access.functions.hasRole(ROLES["ADMIN"], self.me)):
            raise SystemExit(f"{self.me} (DEPLOYER_PRIVATE_KEY) does not hold ADMIN on chain {self.chain.chain_id}")
        wants = {(self.me, "KYC_ADMIN"), (self.me, "RISK_ADMIN"), (self.service, "AI_AGENT"), (self.service, "PRICE_UPDATER")}
        wants |= {(w, r) for w in self.staff for r in STAFF_ROLES}
        wants = sorted(wants)
        held = await self.read_all(self.access.functions.hasRole(ROLES[r], a) for a, r in wants)
        await self.run(
            [Tx(f"grant {r} to {short(a)}", self.access.functions.grantRole(ROLES[r], a)) for (a, r), h in zip(wants, held) if not h],
            "roles",
        )

    async def step_kyc(self) -> None:
        people = list(dict.fromkeys([self.me, self.service, *self.staff, *self.kyc]))
        d = self.cat.identity_defaults
        now = int(time.time())
        records = await self.read_all(self.identity.functions.identityOf(a) for a in people)
        txs = [
            Tx(f"verify {short(a)}", self.identity.functions.setIdentity(a, d["country"].encode(), int(d["tier"]), now + int(d["validDays"]) * 86400))
            for a, (verified, _country, _tier, expiry) in zip(people, records)
            if not (verified and expiry > now + 30 * 86400)
        ]
        await self.run(txs, "KYC")

    async def step_warehouses(self) -> None:
        await self.scan_warehouses()
        unclaimed = [(wid, region_str(row[1])) for wid, row in self.onchain.items() if not row[5]]
        txs = []
        for w in self.cat.warehouses:
            if w.code in self.wh_ids:
                continue
            adopt = next((wid for wid, region in unclaimed if region == w.region), None)
            if adopt is not None:  # e.g. warehouse 1 from Onboard.s.sol (NG-LAGOS, empty metaURI)
                unclaimed = [u for u in unclaimed if u[0] != adopt]
                self.wh_ids[w.code] = adopt
                txs.append(Tx(f"name warehouse {adopt} as {w.code}", self.warehouses.functions.setMetaURI(adopt, meta_uri(w.code))))
            else:
                txs.append(Tx(f"register {w.code}", self.warehouses.functions.registerWarehouse(self.service, region_bytes(w.region), meta_uri(w.code))))
        for code, wid in self.wh_ids.items():
            operator, _region, _feed, active, frozen, _uri = self.onchain[wid]
            if operator != self.service:
                txs.append(Tx(f"operator of {code} -> {short(self.service)}", self.warehouses.functions.setOperator(wid, self.service)))
            if not active:
                txs.append(Tx(f"activate {code}", self.warehouses.functions.setActive(wid, True)))
            if frozen:
                log.warning("  ! %s (id %s) is FROZEN: unfreeze it after checking reserves (WarehouseRegistry.unfreeze)", code, wid)
        await self.run(txs, "warehouses")
        await self.scan_warehouses()

    async def step_feeds(self) -> None:
        access = self.access.address
        now = int(time.time())
        deploys: list[Tx] = []
        made: list[tuple] = []
        configure: list[Tx] = []

        for code, wid in sorted(self.wh_ids.items()):
            feed = self.onchain[wid][2]
            if is_zero(feed):
                deploys.append(Tx(f"deploy reserve feed {code}", self.chain.factory("TensileReserveFeed", self.bytecode("TensileReserveFeed"))
                                  .constructor(access, wid, f"TENSILE-WH-{wid} RESERVE KG", self.signer_a, self.signer_b)))
                made.append(("reserve", code, wid))
                continue
            rf = self.chain.contract_at("TensileReserveFeed", feed)
            signers = tuple(await self.read_all([rf.functions.warehouseSigner(), rf.functions.inspectorSigner()]))
            if signers != (self.signer_a, self.signer_b):
                configure.append(Tx(f"reserve signers of {code}", rf.functions.setSigners(self.signer_a, self.signer_b)))

        for material, region in self.cat.price_pairs():
            mh = self.cat.materials[material].hash
            price8 = usd_to_price8(self.cat.prices[(material, region)])
            feed = await self.read(self.adapter.functions.feedOf(mh, region_bytes(region)))
            if is_zero(feed):
                deploys.append(Tx(f"deploy price feed {material}/{region}", self.chain.factory("TensilePriceFeed", self.bytecode("TensilePriceFeed"))
                                  .constructor(access, f"{material} / {region} USD/t")))
                made.append(("price", material, region, mh, price8))
                continue
            pf = self.chain.contract_at("TensilePriceFeed", feed)
            _, answer, _, updated, _ = await self.read(pf.functions.latestRoundData())
            if now - updated > REFRESH_AFTER:
                configure.append(Tx(f"refresh price {material}/{region}", pf.functions.forceUpdate(answer if answer > 0 else price8)))

        receipts = await self.run(deploys, "deploy feeds")
        for info, receipt in zip(made, receipts):
            address = receipt["contractAddress"]
            if info[0] == "reserve":
                _, code, wid = info
                configure.append(Tx(f"attach reserve feed to {code}", self.warehouses.functions.setReserveFeed(wid, address)))
            else:
                _, material, region, mh, price8 = info
                pf = self.chain.contract_at("TensilePriceFeed", address)
                configure.append(Tx(f"first price {material}/{region}", pf.functions.forceUpdate(price8)))
                configure.append(Tx(f"route price {material}/{region}", self.adapter.functions.setFeed(mh, region_bytes(region), address)))
        await self.run(configure, "configure feeds")
        await self.scan_warehouses()

    async def step_classes(self) -> None:
        d = self.cat.class_defaults
        lltv, bps, age = int(d["lltv"]), int(d["routerMaxLtvBps"]), int(d["maxAttestationAgeDays"]) * 86400
        cap = int(d["vaultCapUsdc"]) * 10 ** await self.read(self.usdc.functions.decimals())
        deploys, made, caps = [], [], []
        for w in self.cat.warehouses:
            wid = self.wh_ids.get(w.code)
            if wid is None:
                continue
            for material in w.materials:
                mh = self.cat.materials[material].hash
                (oracle, _lltv, _bps, _age, enabled), key = await self.read_all(
                    [self.registry.functions.getClass(mh, wid), self.registry.functions.classKey(mh, wid)]
                )
                if not enabled or is_zero(oracle):
                    deploys.append(Tx(f"deploy oracle {material}@{w.code}", self.chain.factory("TensileMorphoOracle", self.bytecode("TensileMorphoOracle"))
                                      .constructor(self.adapter.address, self.warehouses.address, mh, wid)))
                    made.append((material, w.code, wid, mh))
                if await self.read(self.vault.functions.classCap(key)) == 0:
                    caps.append(Tx(f"vault cap {material}@{w.code}", self.vault.functions.setClassCap(key, cap)))
        receipts = await self.run(deploys, "deploy oracles")
        enable = [
            Tx(f"enable class {material}@{code}", self.registry.functions.setClass(mh, wid, (r["contractAddress"], lltv, bps, age, True)))
            for (material, code, wid, mh), r in zip(made, receipts)
        ]
        await self.run(enable + caps, "classes and vault caps")

    async def step_reserves(self) -> None:
        now = (await with_retries(lambda: self.chain.w3.eth.get_block("latest")))["timestamp"]
        txs = []
        for w in self.cat.warehouses:
            wid = self.wh_ids.get(w.code)
            if wid is None or is_zero(self.onchain[wid][2]):
                continue
            rf = self.chain.contract_at("TensileReserveFeed", self.onchain[wid][2])
            (_, answer, _, updated, _), last, outstanding, signers = await asyncio.gather(
                self.read(rf.functions.latestRoundData()),
                self.read(rf.functions.lastObservedAt()),
                self.read(self.passport.functions.outstandingKg(wid)),
                self.read_all([rf.functions.warehouseSigner(), rf.functions.inspectorSigner()]),
            )
            if updated and now - updated < REFRESH_AFTER and answer >= outstanding:
                continue
            if tuple(signers) != (self.signer_a, self.signer_b):
                if self.check:
                    self.todo.append(f"reserve reports: {w.code} (after its signers are switched)")
                continue
            reserve = max(w.reserve_kg, outstanding * 11 // 10)  # always covers what is tokenized here
            observed = max(now - 15, last + 1)
            digest = await self.read(rf.functions.reportDigest(reserve, observed))
            sig_a = bytes(Account.unsafe_sign_hash(digest, self.key_a).signature)
            sig_b = bytes(Account.unsafe_sign_hash(digest, self.key_b).signature)
            txs.append(Tx(f"reserve report {w.code} {reserve:,} kg", rf.functions.submit(reserve, observed, sig_a, sig_b)))
        await self.run(txs, "reserve reports")

    async def step_fund_vault(self, amount_usdc: int) -> None:
        if not self.chain.config.testnet:
            raise SystemExit("--fund-vault uses the MockUSDC faucet: testnets only")
        decimals = await self.read(self.usdc.functions.decimals())
        amount = amount_usdc * 10**decimals
        balance = await self.read(self.usdc.functions.balanceOf(self.me))
        mint, need = [], amount - balance
        while need > 0:
            chunk = min(need, FAUCET_CAP_USDC * 10**decimals)
            mint.append(Tx(f"faucet {chunk // 10**decimals:,} USDC", self.usdc.functions.faucet(self.me, chunk)))
            need -= chunk
        await self.run(mint, "test USDC")
        if await self.read(self.usdc.functions.allowance(self.me, self.vault.address)) < amount:
            await self.run([Tx("approve vault", self.usdc.functions.approve(self.vault.address, amount))], "approve")
        await self.run([Tx(f"deposit {amount_usdc:,} USDC", self.vault.functions.deposit(amount, self.me))], "vault deposit")

    async def summary(self) -> None:
        w3 = self.chain.w3
        sym = self.chain.config.native_currency["symbol"]
        balances = await asyncio.gather(*(with_retries(lambda a=a: w3.eth.get_balance(a)) for a in dict.fromkeys([self.me, self.service])))
        for a, b in zip(dict.fromkeys([self.me, self.service]), balances):
            log.info("  gas  %s  %.4f %s%s", short(a), b / 1e18, sym, "   ← low" if b < 5 * 10**16 else "")
        for code, wid in sorted(self.wh_ids.items(), key=lambda kv: kv[1]):
            (reserve, fresh), healthy, outstanding = await asyncio.gather(
                self.read(self.guard.functions.reserveOf(wid)),
                self.read(self.guard.functions.isHealthy(wid)),
                self.read(self.passport.functions.outstandingKg(wid)),
            )
            state = "FROZEN" if self.onchain[wid][4] else ("healthy" if healthy else "UNHEALTHY")
            log.info("  wh %-2s %-11s %-9s reserve %12s kg  outstanding %12s kg  %s", wid, code, state, f"{reserve:,}", f"{outstanding:,}", "fresh" if fresh else "stale")
        log.info("  vault  %s USDC", f"{await self.read(self.vault.functions.totalAssets()) / 1e6:,.2f}")

    async def run_all(self, fund_vault: int | None) -> None:
        cfg = self.chain.config
        log.info("\n== %s (%s)%s", cfg.name, cfg.chain_id, "  [check only]" if self.check else "")
        log.info("  deployer %s · service %s · reserve signers %s / %s", short(self.me), short(self.service), short(self.signer_a), short(self.signer_b))
        await self.step_roles()
        await self.step_kyc()
        await self.step_warehouses()
        await self.step_feeds()
        await self.step_classes()
        await self.step_reserves()
        if fund_vault:
            await self.step_fund_vault(fund_vault)
        await self.summary()
        if self.check and self.todo:
            log.info("  a seed run would send %d transactions:", len(self.todo))
            for line in self.todo:
                log.info("    - %s", line)


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--chain", type=int, action="append", help="chain id (repeatable); default: every chain in deployments/")
    parser.add_argument("--check", action="store_true", help="report what is missing; send nothing")
    parser.add_argument("--fund-vault", type=int, metavar="USDC", help="mint test USDC and deposit it into the credit vault")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("tensile.tx").setLevel(logging.WARNING if args.check else logging.INFO)
    logging.getLogger("web3").setLevel(logging.WARNING)  # hides "Successfully disconnected from ..."

    settings = get_settings()
    if not settings.deployer_private_key:
        raise SystemExit("DEPLOYER_PRIVATE_KEY is missing from backend/.env")
    if not (settings.reserve_signer_a_key and settings.reserve_signer_b_key):
        raise SystemExit("reserve signer keys are missing: run  python scripts/gen_signer_keys.py")
    bad = [a for a in settings.staff_wallets + settings.kyc_wallets if not is_address(a)]
    if bad:
        raise SystemExit(f"not addresses in STAFF_WALLETS / KYC_WALLETS: {bad}")

    catalog = load_catalog(settings.catalog_file)
    registry = ChainRegistry(settings)
    try:
        for chain_id in args.chain or registry.chain_ids():
            chain = registry.get(chain_id)
            if chain is None:
                raise SystemExit(f"chain {chain_id} has no deployments/{chain_id}.json")
            sender = TxSender(chain.w3, settings.deployer_private_key.get_secret_value(), errors=error_selectors(chain.abis))
            try:
                await Seeder(chain, settings, catalog, sender, args.check).run_all(args.fund_vault)
            except TxFailed as exc:
                raise SystemExit(f"\nstopped on chain {chain_id}: {exc}\nFix the cause and re-run; finished steps are skipped.") from exc
    finally:
        await registry.close()


if __name__ == "__main__":
    asyncio.run(main())