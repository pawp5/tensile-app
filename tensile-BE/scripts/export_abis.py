#!/usr/bin/env python3
"""Export contract ABIs into the backend (and optionally the frontend).

SOURCE can be Foundry's out/ folder, a zip of it, or any folder/zip of ABI .json files.
Both Foundry artifacts ({"abi": [...]}) and plain ABI arrays are accepted.
Contracts the seed script deploys (DEPLOYABLE) also get their bytecode written to app/bytecode/,
which needs Foundry artifacts (plain ABI arrays carry no bytecode).

    python scripts/export_abis.py ~/Downloads/out.zip
    python scripts/export_abis.py ../contracts/out --frontend ../frontend/src/abis
"""
import argparse
import json
import sys
import zipfile
from collections.abc import Callable, Iterator
from pathlib import Path, PurePosixPath

CONTRACTS = [
    "TensileAccessManager", "IdentityRegistry", "WarehouseRegistry", "AttestationRegistry",
    "MaterialPassport", "MintingController", "RedemptionManager", "TensileReserveFeed", "ReserveGuard",
    "TensilePriceFeed", "PriceOracleAdapter", "MarketRegistry", "TensileMorphoOracle", "LotWrapper",
    "TensileCreditVault", "CreditRouter", "Marketplace", "FeeCollector", "PriceIndex", "MockUSDC",
    "Morpho", "AdaptiveCurveIrm",
]
DEPLOYABLE = ["TensileReserveFeed", "TensilePriceFeed", "TensileMorphoOracle"]
BACKEND = Path(__file__).resolve().parents[1]
BACKEND_ABIS = BACKEND / "app" / "abis"
BACKEND_BYTECODE = BACKEND / "app" / "bytecode"


def _iter_json(source: Path) -> Iterator[tuple[PurePosixPath, Callable[[], bytes]]]:
    """Every .json file in a folder or a zip, as (path, reader)."""
    if source.is_file() and zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as zf:
            for info in zf.infolist():
                if not info.is_dir() and info.filename.endswith(".json"):
                    yield PurePosixPath(info.filename), (lambda name=info.filename: zf.read(name))
    elif source.is_dir():
        for path in source.rglob("*.json"):
            yield PurePosixPath(path.relative_to(source).as_posix()), path.read_bytes
    else:
        sys.exit(f"{source} is not a folder or a zip file")


def _artifact(raw: bytes) -> tuple[list, str | None] | None:
    """-> (abi, bytecode or None)"""
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    if isinstance(data, list):
        return data, None
    if isinstance(data, dict) and isinstance(data.get("abi"), list):
        bytecode = data.get("bytecode")
        if isinstance(bytecode, dict):
            bytecode = bytecode.get("object")
        return data["abi"], bytecode if isinstance(bytecode, str) and len(bytecode) > 2 else None
    return None


def find_artifacts(source: Path) -> dict[str, tuple[list, str | None]]:
    wanted = set(CONTRACTS)
    found: dict[str, tuple[int, list, str | None]] = {}
    for path, read in _iter_json(source):
        name = path.stem
        if name not in wanted or "build-info" in path.parts:
            continue
        rank = 0 if path.parent.name == f"{name}.sol" else 1  # prefer out/<Name>.sol/<Name>.json
        if name in found and found[name][0] <= rank:
            continue
        art = _artifact(read())
        if art is not None:
            found[name] = (rank, *art)
    return {name: (abi, bytecode) for name, (_, abi, bytecode) in found.items()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", type=Path, help="Foundry out/ folder, a zip of it, or a folder/zip of ABI files")
    parser.add_argument("--frontend", type=Path, help="also write TypeScript ABIs here")
    args = parser.parse_args()

    artifacts = find_artifacts(args.source.expanduser())
    BACKEND_ABIS.mkdir(parents=True, exist_ok=True)
    BACKEND_BYTECODE.mkdir(parents=True, exist_ok=True)
    if args.frontend:
        args.frontend.mkdir(parents=True, exist_ok=True)

    for name, (abi, bytecode) in artifacts.items():
        (BACKEND_ABIS / f"{name}.json").write_text(json.dumps(abi, indent=1))
        if name in DEPLOYABLE and bytecode:
            (BACKEND_BYTECODE / f"{name}.hex").write_text(bytecode)
        if args.frontend:
            (args.frontend / f"{name}.ts").write_text(f"export const {name}Abi = {json.dumps(abi, indent=2)} as const;\n")
    if args.frontend:
        names = sorted(p.stem for p in args.frontend.glob("*.ts") if p.stem != "index")
        (args.frontend / "index.ts").write_text("".join(f"export {{ {n}Abi }} from './{n}';\n" for n in names))

    with_code = [n for n in DEPLOYABLE if (BACKEND_BYTECODE / f"{n}.hex").exists()]
    print(f"exported {len(artifacts)}/{len(CONTRACTS)} ABIs to {BACKEND_ABIS}" + (f" and {args.frontend}" if args.frontend else ""))
    print(f"bytecode for {len(with_code)}/{len(DEPLOYABLE)} deployable contracts in {BACKEND_BYTECODE}")
    missing = [n for n in CONTRACTS if n not in artifacts] + [f"{n} (bytecode)" for n in DEPLOYABLE if n not in with_code]
    if missing:
        sys.exit(f"missing: {', '.join(missing)}")


if __name__ == "__main__":
    main()