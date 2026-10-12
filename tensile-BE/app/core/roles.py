from eth_utils import keccak

# Mirrors contracts/src/access/Roles.sol.
# Human / service roles: checked for the signed-in wallet (personas, staff screens).
ROLES: dict[str, bytes] = {
    "ADMIN": bytes(32),
    "KYC_ADMIN": keccak(text="TENSILE_KYC_ADMIN"),
    "RISK_ADMIN": keccak(text="TENSILE_RISK_ADMIN"),
    "INSPECTOR": keccak(text="TENSILE_INSPECTOR"),
    "AI_AGENT": keccak(text="TENSILE_AI_AGENT"),
    "PRICE_UPDATER": keccak(text="TENSILE_PRICE_UPDATER"),
}
# Contract-to-contract roles: only used to name RoleGranted/RoleRevoked events.
CONTRACT_ROLES: dict[str, bytes] = {
    name: keccak(text=f"TENSILE_{name}")
    for name in ("MINTER", "REDEEMER", "RECORDER", "GUARDIAN", "REGISTRAR", "FEE_NOTIFIER", "INDEX_RECORDER")
}
# "0x<role hash>" -> name
ROLE_NAMES: dict[str, str] = {"0x" + h.hex(): name for name, h in {**ROLES, **CONTRACT_ROLES}.items()}

OPS_ROLES = frozenset({"ADMIN", "KYC_ADMIN", "RISK_ADMIN"})
BASE_PERSONAS = ("owner", "lender", "buyer")  # any verified wallet


def personas_for(roles: set[str]) -> list[str]:
    personas = list(BASE_PERSONAS)
    if "INSPECTOR" in roles:
        personas.append("inspector")
    if roles & OPS_ROLES:
        personas.append("ops")
    return personas
