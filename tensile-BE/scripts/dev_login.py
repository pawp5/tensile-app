#!/usr/bin/env python3
"""Dev only: sign in with a throwaway wallet and print /me.
    python scripts/dev_login.py [api_base] [chain_id]
"""
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

from eth_account import Account
from eth_account.messages import encode_defunct

API = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001/v1"
CHAIN_ID = int(sys.argv[2]) if len(sys.argv) > 2 else 10143
DOMAIN = "localhost:5173"


def call(method: str, path: str, body: dict | None = None, token: str | None = None) -> dict:
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        sys.exit(f"{method} {path} -> {exc.code}: {exc.read().decode()}")


acct = Account.create()
nonce = call("POST", "/auth/nonce", {"address": acct.address})["nonce"]
issued = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
message = (
    f"{DOMAIN} wants you to sign in with your Ethereum account:\n{acct.address}\n\n"
    f"Sign in to Tensile\n\nURI: http://{DOMAIN}\nVersion: 1\nChain ID: {CHAIN_ID}\n"
    f"Nonce: {nonce}\nIssued At: {issued}"
)
signature = "0x" + bytes(acct.sign_message(encode_defunct(text=message)).signature).hex()

session = call("POST", "/auth/verify", {"message": message, "signature": signature})
print("session:", session["address"], "expires", session["expiresAt"])
print("me:", json.dumps(call("GET", f"/chains/{CHAIN_ID}/me", token=session["token"]), indent=2))