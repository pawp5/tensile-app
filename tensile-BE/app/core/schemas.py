"""Every request/response model lives in this file."""
from datetime import datetime
from typing import Any, Literal

from eth_utils import is_address, to_checksum_address
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    """snake_case in Python, camelCase on the wire."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
    )


# ------------------------------------------------------------------ health / chains


class ServiceStatus(ApiModel):
    ok: bool
    error: str | None = None


class ChainStatus(ApiModel):
    chain_id: int
    ok: bool
    block: int | None = None
    error: str | None = None


class HealthOut(ApiModel):
    status: str  # ok | degraded
    mongo: ServiceStatus
    chains: list[ChainStatus]


class NativeCurrency(ApiModel):
    name: str
    symbol: str
    decimals: int


class ChainOut(ApiModel):
    chain_id: int
    name: str
    short_name: str
    testnet: bool
    native_currency: NativeCurrency
    rpc_url: str
    explorer_url: str | None
    addresses: dict[str, str]


class ChainsOut(ApiModel):
    default_chain_id: int
    chains: list[ChainOut]


# ------------------------------------------------------------------ auth


class NonceIn(ApiModel):
    address: str

    @field_validator("address")
    @classmethod
    def _checksum(cls, value: str) -> str:
        if not is_address(value):
            raise ValueError("not an EVM address")
        return to_checksum_address(value)


class NonceOut(ApiModel):
    nonce: str
    expires_at: datetime


class VerifyIn(ApiModel):
    message: str = Field(min_length=1, max_length=4000)
    signature: str = Field(pattern=r"^0x[0-9a-fA-F]{130}$")


class SessionOut(ApiModel):
    token: str
    expires_at: datetime
    address: str


class SessionInfoOut(ApiModel):
    address: str


# ------------------------------------------------------------------ me


class IdentityOut(ApiModel):
    status: str  # not_started | in_review | verified | expired | rejected
    verified: bool
    country: str | None
    tier: int  # 1 lender, 2 institution, 3 operator
    expires_at: datetime | None
    org_name: str | None = None  # from the KYC application
    application_status: str | None = None  # draft | in_review | approved | rejected


class MeOut(ApiModel):
    chain_id: int
    address: str
    roles: list[str]
    personas: list[str]
    identity: IdentityOut


# ------------------------------------------------------------------ protocol: warehouses, prices, stats, sync


class MaterialRef(ApiModel):
    code: str
    name: str
    symbol: str


class WarehouseOut(ApiModel):
    warehouse_id: int
    code: str | None
    name: str
    operator_name: str | None
    operator: str  # on-chain operator wallet
    region: str
    country: str | None
    place: str | None
    lat: float | None
    lon: float | None
    materials: list[MaterialRef]
    reserve_feed: str | None
    active: bool
    frozen: bool
    frozen_reason: str | None
    healthy: bool  # ReserveGuard.isHealthy: not frozen, fresh report, reserve >= outstanding
    fresh: bool
    reserve_kg: int
    outstanding_kg: int  # tokenized and not yet redeemed
    coverage: float | None  # reserve / outstanding; None while nothing is tokenized
    reported_at: datetime | None
    updated_at: datetime | None


class WarehousesOut(ApiModel):
    chain_id: int
    warehouses: list[WarehouseOut]
    updated_at: datetime | None


class ReservePoint(ApiModel):
    round_id: int
    reserve_kg: int
    observed_at: datetime | None


class WarehouseDetailOut(WarehouseOut):
    reserve_history: list[ReservePoint]


class PriceOut(ApiModel):
    material: str
    material_name: str | None
    symbol: str | None
    region: str
    feed: str | None
    price_usd_per_tonne: float | None
    haircut_bps: int
    round_id: int
    updated_at: datetime | None
    stale: bool


class PricesOut(ApiModel):
    chain_id: int
    prices: list[PriceOut]
    updated_at: datetime | None


class PricePoint(ApiModel):
    round_id: int
    price_usd_per_tonne: float
    at: datetime | None


class PriceHistoryOut(ApiModel):
    chain_id: int
    material: str
    region: str
    points: list[PricePoint]  # oldest first


class VaultStats(ApiModel):
    total_assets_usdc: float
    deployed_usdc: float  # supplied to lot markets
    idle_usdc: float
    utilization: float  # 0..1
    updated_at: datetime | None


class ProtocolStatsOut(ApiModel):
    chain_id: int
    warehouses: int
    active_warehouses: int
    healthy_warehouses: int
    frozen_warehouses: int
    custody_kg: int  # reported reserves across the network
    tokenized_kg: int  # outstanding passports
    active_lots: int
    lots_minted: int
    material_value_usd: float  # active lots at current reference prices (no haircut)
    vault: VaultStats | None
    updated_at: datetime | None


class SyncOut(ApiModel):
    chain_id: int
    indexer_live: bool  # an indexer holds this chain's lease
    indexed_block: int | None
    head_block: int | None
    lag_blocks: int | None
    catching_up: bool
    indexed_at: datetime | None
    snapshot_at: datetime | None
    worker_live: bool
    upkeep_at: datetime | None
    low_gas: bool
    error: str | None


# ------------------------------------------------------------------ KYC (Stage 3)

EntityType = Literal["corporate", "partnership", "fund", "individual"]


class KycApplicationIn(ApiModel):
    org_name: str = Field(min_length=2, max_length=120)
    country: str = Field(pattern=r"^[A-Z]{2}$")  # ISO 3166-1 alpha-2
    entity_type: EntityType
    tier: int = Field(ge=1, le=3)
    contact_email: str | None = Field(default=None, max_length=200)

    @field_validator("org_name")
    @classmethod
    def _strip(cls, value: str) -> str:
        return " ".join(value.split())


class KycDocumentOut(ApiModel):
    id: str
    kind: str  # registration | owners | directors
    filename: str
    content_type: str
    size: int
    sha256: str
    uploaded_at: datetime


class KycRequirementOut(ApiModel):
    key: str
    title: str
    detail: str
    state: str  # complete | in_review | required | failed


class KycChainStatus(ApiModel):
    chain_id: int
    chain_name: str
    status: str  # queued | running | done | failed
    tx_hash: str | None = None
    error: str | None = None


class KycApplicationOut(ApiModel):
    address: str
    status: str  # draft | in_review | approved | rejected
    org_name: str | None
    country: str | None
    entity_type: str | None
    tier: int | None
    contact_email: str | None
    documents: list[KycDocumentOut]
    requirements: list[KycRequirementOut]
    screening: str | None  # clear | flagged
    screening_notes: list[str]
    submitted_at: datetime | None
    reviewed_at: datetime | None
    reviewed_by: str | None
    reject_reason: str | None
    approved_tier: int | None
    expires_at: datetime | None
    attestations: list[KycChainStatus]  # one per chain once approved
    created_at: datetime | None
    updated_at: datetime | None


class KycMeOut(ApiModel):
    application: KycApplicationOut | None


class KycListOut(ApiModel):
    applications: list[KycApplicationOut]


class KycApproveIn(ApiModel):
    tier: int | None = Field(default=None, ge=1, le=3)  # default: the tier applied for
    valid_days: int | None = Field(default=None, ge=1, le=1095)  # default: catalog identityDefaults.validDays


class KycRejectIn(ApiModel):
    reason: str = Field(min_length=3, max_length=500)


# ------------------------------------------------------------------ lots, attestations, activity (Stage 3)


class LotOut(ApiModel):
    token_id: int
    display_id: str  # TNS-CU-00418
    material: str | None
    material_name: str | None
    symbol: str | None
    material_code: str
    warehouse_id: int
    warehouse_code: str | None
    warehouse_name: str | None
    region: str | None
    quantity_kg: int
    owner: str
    owner_name: str | None
    state: str  # FREE | REDEEMING | BURNED
    minted_at: datetime | None
    last_attested_at: datetime | None
    cert_hash: str | None
    evidence_uri: str | None
    request_id: int | None
    price_usd_per_tonne: float | None
    value_usd: float | None
    haircut_bps: int
    collateral_value_usd: float | None  # value after the regional haircut
    max_borrow_usdc: float | None  # collateral value x the router's max LTV


class LotsOut(ApiModel):
    chain_id: int
    lots: list[LotOut]
    total: int


class AttestationOut(ApiModel):
    index: int
    kind: str  # CUSTODY | INSPECTION | REINSPECTION | AI_REVIEW | RELEASE
    subject_type: str  # REQUEST | LOT
    subject: int
    attestor: str
    attestor_name: str | None
    score: int
    data_hash: str
    uri: str
    at: datetime | None
    tx_hash: str | None


class MintRequestOut(ApiModel):
    request_id: int
    display_id: str  # MR-0012
    owner: str
    warehouse_id: int
    material: str | None
    quantity_kg: int
    status: str  # REQUESTED | FINALIZED | REJECTED | CANCELLED | EXPIRED
    created_at: datetime | None
    custody_at: datetime | None
    ai_override: bool
    token_id: int | None
    evidence_uri: str | None
    cert_hash: str | None


class ActivityItemOut(ApiModel):
    id: str  # txHash:logIndex
    kind: str  # mint | insp | loan | repay | trade | redeem | identity | role | warehouse | vault | transfer
    title: str
    ref: str | None
    actor: str | None
    amount: str | None
    at: datetime | None
    tx_hash: str
    href: str | None


class ActivityOut(ApiModel):
    chain_id: int
    items: list[ActivityItemOut]


class NotificationsOut(ApiModel):
    chain_id: int
    items: list[ActivityItemOut]
    unread: int
    seen_at: datetime | None


class LotDetailOut(LotOut):
    warehouse: WarehouseOut | None
    request: MintRequestOut | None
    attestations: list[AttestationOut]  # on the mint request and on the lot, oldest first
    history: list[ActivityItemOut]  # oldest first


# ------------------------------------------------------------------ portfolio (Stage 3)


class MaterialHolding(ApiModel):
    material: str | None
    name: str
    symbol: str | None
    quantity_kg: int
    lots: int
    value_usd: float
    share: float  # of the portfolio value, 0..1


class PortfolioSite(ApiModel):
    warehouse_id: int
    code: str | None
    name: str
    lat: float | None
    lon: float | None
    lots: int
    quantity_kg: int
    coverage: float | None
    healthy: bool
    fresh: bool
    reported_at: datetime | None


class ValuePoint(ApiModel):
    at: datetime
    gross_usd: float
    net_usd: float


class VaultPosition(ApiModel):
    shares: str  # raw share units (decimal string)
    assets_usdc: float


class PortfolioOut(ApiModel):
    chain_id: int
    address: str
    display_name: str
    lots: list[LotOut]
    lot_count: int
    quantity_kg: int
    lots_value_usd: float
    vault: VaultPosition | None
    portfolio_value_usd: float
    debt_usdc: float  # Stage 5 fills this from the credit router
    borrow_capacity_usdc: float
    by_material: list[MaterialHolding]
    sites: list[PortfolioSite]
    history: list[ValuePoint]
    valued_at: datetime | None


# ------------------------------------------------------------------ search + ops queue (Stage 3)


class SearchResultOut(ApiModel):
    type: str  # lot | warehouse | address | request
    id: str
    title: str
    subtitle: str | None
    href: str


class SearchOut(ApiModel):
    query: str
    results: list[SearchResultOut]


class OpsRowOut(ApiModel):
    module: str  # Identity | Warehouses | Reserve feeds | Mint requests | ...
    ref: str
    subject: str
    warehouse: str
    state: str
    tone: str  # badge tone class
    queue: str  # pending | attention | frozen | disputed | expired | completed
    since: datetime | None
    who: str
    action: str
    href: str


class OpsQueueOut(ApiModel):
    chain_id: int
    rows: list[OpsRowOut]


# ------------------------------------------------------------------ tokenize (Stage 4)


class EvidenceFileOut(ApiModel):
    id: str
    kind: str  # certificate | receipt | weighbridge | photos | mill  (inspection files: report)
    filename: str
    content_type: str
    size: int
    sha256: str
    uploaded_at: datetime


class MintDocKindOut(ApiModel):
    kind: str
    title: str
    detail: str
    required: bool
    multiple: bool


class MintMaterialOut(ApiModel):
    code: str
    name: str
    symbol: str
    family: str
    grade: str


class MintWarehouseOut(ApiModel):
    warehouse_id: int
    code: str | None
    name: str
    operator_name: str | None
    region: str
    place: str | None
    materials: list[str]  # material codes this warehouse stores
    eligible: bool  # active, not frozen, fresh reserve report
    reason: str | None  # why not eligible
    fresh: bool
    frozen: bool
    headroom_kg: int  # attested reserve minus tokenized outstanding


class MintConfigOut(ApiModel):
    chain_id: int
    controller: str  # MintingController: the owner sends requestMint / finalizeMint / cancelRequest here
    min_ai_score: int
    request_ttl_seconds: int
    min_lot_kg: int
    mint_fee: str  # raw token units; "0" = free
    fee_token: str | None
    fee_token_symbol: str | None
    fee_token_decimals: int | None
    max_file_mb: int
    materials: list[MintMaterialOut]
    warehouses: list[MintWarehouseOut]
    doc_kinds: list[MintDocKindOut]


class MintDraftIn(ApiModel):
    material: str = Field(min_length=2, max_length=40)  # catalog code, e.g. CU-CATH-A
    warehouse_id: int = Field(gt=0)
    quantity_kg: int = Field(gt=0, lt=2**96)
    certificate_id: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9 ._/-]*$")
    receipt_no: str | None = Field(default=None, max_length=64)

    @field_validator("certificate_id", "receipt_no")
    @classmethod
    def _squash(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return " ".join(value.split()) or None


class MintDraftOut(ApiModel):
    id: str
    chain_id: int
    owner: str
    status: str  # draft | submitted (waiting for the requestMint tx) | requested | discarded
    material: str | None
    material_name: str | None
    symbol: str | None
    warehouse_id: int | None
    warehouse_code: str | None
    warehouse_name: str | None
    region: str | None
    place: str | None
    quantity_kg: int | None
    certificate_id: str | None
    receipt_no: str | None
    documents: list[EvidenceFileOut]
    missing: list[str]  # required document kinds not uploaded yet
    cert_hash: str | None
    evidence_uri: str | None
    request_id: int | None
    indicative_value_usd: float | None
    borrow_capacity_usdc: float | None
    created_at: datetime | None
    updated_at: datetime | None
    submitted_at: datetime | None


class MintDraftsOut(ApiModel):
    chain_id: int
    drafts: list[MintDraftOut]


class MintPrepareOut(ApiModel):
    """Everything the wallet needs for MintingController.requestMint(warehouseId, materialCode, quantityKg, certHash, evidenceURI)."""

    draft: MintDraftOut
    controller: str
    warehouse_id: int
    material_code: str  # bytes32 hex
    quantity_kg: int
    cert_hash: str  # bytes32 hex
    evidence_uri: str
    mint_fee: str
    fee_token: str | None
    allowance_needed: bool  # approve fee_token for the controller first
    warnings: list[str]


class EvidenceManifestOut(ApiModel):
    """Public: what tensile://evidence/<id> (a requestMint evidenceURI) contains. Files themselves need sign-in."""

    draft_id: str
    chain_id: int
    owner: str
    cert_hash: str | None
    evidence_uri: str
    request_id: int | None
    documents: list[EvidenceFileOut]
    submitted_at: datetime | None


class ReportOut(ApiModel):
    """Public: the JSON an attestation commits to. keccak256(canonical body) == data_hash when verified is true."""

    id: str
    chain_id: int
    kind: str  # AI_REVIEW | INSPECTION | REINSPECTION | CUSTODY
    subject_type: str
    subject: int
    data_hash: str
    uri: str
    verified: bool
    body: dict[str, Any]


class MintStepOut(ApiModel):
    key: str  # details | evidence | review | inspection | custody | reserve | mint
    label: str
    state: str  # done | current | waiting | blocked | failed
    detail: str | None
    at: datetime | None


class ReviewCheckOut(ApiModel):
    key: str
    label: str
    result: str
    tone: str  # t-success | t-warning | t-danger | t-neutral
    points: int
    max_points: int


class ReviewOut(ApiModel):
    status: str  # queued | running | posted | failed
    score: int | None
    threshold: int
    passed: bool | None
    checks: list[ReviewCheckOut]
    documents_reviewed: int
    report_id: str | None
    data_hash: str | None
    uri: str | None
    tx_hash: str | None
    started_at: datetime | None
    finished_at: datetime | None
    error: str | None
    override: bool
    override_by: str | None


class ConditionOut(ApiModel):
    key: str
    label: str
    ok: bool


class InspectionReportOut(ApiModel):
    id: str
    chain_id: int
    kind: str  # INSPECTION | REINSPECTION
    subject_type: str  # REQUEST | LOT
    subject: int
    ref: str  # MR-0003 | TNS-CU-00001
    outcome: str  # pass | fail
    status: str  # sealed (waiting for the wallet) | attested | rejected (mint request) | failed (lot, recorded off-chain)
    inspector: str
    inspector_name: str | None
    organisation: str | None
    licence: str | None
    declared_kg: int | None
    measured_kg: int | None
    variance_pct: float | None
    bundles_declared: int | None
    bundles_counted: int | None
    assay_pct: float | None
    assay_element: str | None
    seals: str | None
    inspected_at: datetime | None
    conditions: list[ConditionOut]
    notes: str | None
    reason: str | None
    files: list[EvidenceFileOut]
    data_hash: str
    uri: str
    tx_hash: str | None
    attested_at: datetime | None
    created_at: datetime


class CustodyOut(ApiModel):
    status: str  # waiting | queued | confirmed | failed
    at: datetime | None
    by: str | None
    operator_name: str | None
    warehouse_code: str | None
    warehouse_name: str | None
    receipt_no: str | None
    seals: str | None
    report_id: str | None
    data_hash: str | None
    uri: str | None
    tx_hash: str | None
    error: str | None


class ReserveCheckOut(ApiModel):
    reserve_kg: int
    outstanding_kg: int
    new_kg: int
    coverage_after: float | None  # reserve / (outstanding + new)
    fresh: bool
    frozen: bool
    can_add: bool  # ReserveGuard.canAdd(warehouseId, quantityKg), read live
    shortfall_kg: int
    reported_at: datetime | None
    operator_name: str | None


class MintActionsOut(ApiModel):
    can_cancel: bool  # owner, while REQUESTED
    can_finalize: bool  # finalizeMint would succeed right now
    finalize_blocker: str | None  # contract error name, e.g. MissingInspection
    finalize_message: str | None
    can_expire: bool
    can_override: bool  # RISK_ADMIN, review below threshold
    can_reject: bool  # RISK_ADMIN or INSPECTOR
    can_inspect: bool  # INSPECTOR, no inspection yet


class MintRequestDetailOut(ApiModel):
    request: MintRequestOut
    title: str  # "Tokenize 25.000 t copper cathode"
    material_name: str | None
    symbol: str | None
    owner_name: str | None
    warehouse: WarehouseOut | None
    expires_at: datetime | None
    min_ai_score: int
    indicative_value_usd: float | None
    borrow_capacity_usdc: float | None
    steps: list[MintStepOut]
    current_step: str
    draft: MintDraftOut | None
    review: ReviewOut | None
    inspection: InspectionReportOut | None
    custody: CustodyOut
    reserve: ReserveCheckOut | None
    actions: MintActionsOut
    attestations: list[AttestationOut]
    history: list[ActivityItemOut]
    reject_reason: str | None


class MintRequestRowOut(ApiModel):
    request: MintRequestOut
    title: str
    owner_name: str | None
    warehouse_code: str | None
    current_step: str
    current_label: str
    review_score: int | None
    inspected: bool
    custody: bool


class MintRequestsOut(ApiModel):
    chain_id: int
    requests: list[MintRequestRowOut]


# ------------------------------------------------------------------ inspections (Stage 4)


class InspectorProfileIn(ApiModel):
    name: str = Field(min_length=2, max_length=80)
    organisation: str = Field(min_length=2, max_length=120)
    licence: str | None = Field(default=None, max_length=64)


class InspectorProfileOut(ApiModel):
    address: str
    name: str | None
    organisation: str | None
    licence: str | None
    is_inspector: bool  # holds INSPECTOR on this chain
    updated_at: datetime | None


class InspectionReportIn(ApiModel):
    subject_type: Literal["REQUEST", "LOT"]
    subject: int = Field(gt=0)
    outcome: Literal["pass", "fail"]
    measured_kg: int | None = Field(default=None, ge=0, lt=2**96)
    bundles_declared: int | None = Field(default=None, ge=0, le=100_000)
    bundles_counted: int | None = Field(default=None, ge=0, le=100_000)
    assay_pct: float | None = Field(default=None, ge=0, le=100)
    seals: str | None = Field(default=None, max_length=120)
    inspected_at: datetime | None = None
    conditions: dict[str, bool] = {}
    notes: str | None = Field(default=None, max_length=2000)
    reason: str | None = Field(default=None, max_length=200)  # why it failed (shown to the owner)
    file_ids: list[str] = Field(default=[], max_length=50)
    order_id: str | None = None  # reinspection order this report closes


class InspectionSealOut(ApiModel):
    """Sign next: pass -> AttestationRegistry.attest(kind, subjectType, subject, 0, dataHash, uri);
    fail on a request -> MintingController.rejectRequest(subject, reasonCode)."""

    report: InspectionReportOut
    kind_code: int  # 1 INSPECTION | 2 REINSPECTION
    subject_type_code: int  # 0 REQUEST | 1 LOT
    data_hash: str
    uri: str
    reason_code: str | None  # bytes32 hex for rejectRequest
    registry: str  # AttestationRegistry address
    controller: str  # MintingController address


class InspectionQueueItemOut(ApiModel):
    kind: str  # mint | reinspection | due
    ref: str  # MR-0003 | RI-0001 | TNS-CU-00001
    subject_type: str
    subject: int
    title: str
    owner: str | None
    owner_name: str | None
    material: str | None
    material_name: str | None
    warehouse_id: int | None
    warehouse_code: str | None
    warehouse_name: str | None
    declared_kg: int | None
    certificate_id: str | None
    receipt_no: str | None
    status: str  # REQUESTED | ON HOLD | ORDERED | DUE | OVERDUE | SEALED
    tone: str
    due_at: datetime | None
    note: str | None
    order_id: str | None
    evidence: list[EvidenceFileOut]
    sealed_report_id: str | None  # a report already sealed but not yet signed


class InspectionQueueOut(ApiModel):
    chain_id: int
    profile: InspectorProfileOut
    items: list[InspectionQueueItemOut]
    pending: int
    due_today: int


class InspectionHistoryRowOut(ApiModel):
    at: datetime | None
    ref: str
    type: str  # Mint | Reinspection
    warehouse_code: str | None
    declared_kg: int | None
    measured_kg: int | None
    result: str  # ATTESTED | REJECTED | FAILED
    tone: str
    inspector: str | None
    inspector_name: str | None
    report_id: str | None
    data_hash: str | None
    uri: str | None
    tx_hash: str | None
    href: str | None


class InspectionHistoryOut(ApiModel):
    chain_id: int
    rows: list[InspectionHistoryRowOut]


class ReinspectionOrderIn(ApiModel):
    token_id: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=200)
    due_days: int = Field(default=7, ge=1, le=30)


class ReinspectionOrderOut(ApiModel):
    id: str
    ref: str  # RI-0001
    chain_id: int
    token_id: int
    lot_ref: str
    reason: str
    status: str  # open | done | cancelled
    due_at: datetime
    created_by: str
    created_at: datetime
    done_at: datetime | None
    report_id: str | None
