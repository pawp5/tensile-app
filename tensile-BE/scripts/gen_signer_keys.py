#!/usr/bin/env python3
"""Create the two reserve-report signer keys and add them to backend/.env (only if missing).

They only sign reports off-chain, so they never need gas. Run once:
    python scripts/gen_signer_keys.py
"""
from pathlib import Path

from eth_account import Account

ENV = Path(__file__).resolve().parents[1] / ".env"
NAMES = ("RESERVE_SIGNER_A_KEY", "RESERVE_SIGNER_B_KEY")


def main() -> None:
    text = ENV.read_text() if ENV.exists() else ""
    present = {line.split("=", 1)[0].strip() for line in text.splitlines() if "=" in line and not line.lstrip().startswith("#")}
    added = []
    for name in NAMES:
        if name in present:
            continue
        acct = Account.create()
        text += ("" if text.endswith("\n") or not text else "\n") + f"{name}=0x{bytes(acct.key).hex()}\n"
        added.append((name, acct.address))
    if added:
        ENV.write_text(text)
    for name in NAMES:
        line = next(l for l in ENV.read_text().splitlines() if l.startswith(name + "="))
        print(f"{name}: {Account.from_key(line.split('=', 1)[1].strip()).address}" + ("  (new)" if any(n == name for n, _ in added) else ""))


if __name__ == "__main__":
    main()