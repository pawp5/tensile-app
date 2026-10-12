/* API response types. Mirrors backend/app/core/schemas.py (camelCase on the wire). */

export type Address = `0x${string}`;

export interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

export interface ChainInfo {
  chainId: number;
  name: string;
  shortName: string;
  testnet: boolean;
  nativeCurrency: NativeCurrency;
  rpcUrl: string;
  explorerUrl: string | null;
  addresses: Record<string, Address>;
}

export interface ChainsOut {
  defaultChainId: number;
  chains: ChainInfo[];
}

export interface NonceOut {
  nonce: string;
  expiresAt: string;
}

export interface SessionOut {
  token: string;
  expiresAt: string;
  address: Address;
}

export type Persona = 'owner' | 'lender' | 'buyer' | 'inspector' | 'ops';
export type IdentityStatus = 'not_started' | 'in_review' | 'verified' | 'expired' | 'rejected';

export interface IdentityOut {
  status: IdentityStatus;
  verified: boolean;
  country: string | null;
  tier: number;
  expiresAt: string | null;
  orgName: string | null;
  applicationStatus: 'draft' | 'in_review' | 'approved' | 'rejected' | null;
}

export interface MeOut {
  chainId: number;
  address: Address;
  roles: string[];
  personas: Persona[];
  identity: IdentityOut;
}

/* ---- protocol (Stage 2): warehouses, prices, stats, sync ---- */

export interface MaterialRef {
  code: string;
  name: string;
  symbol: string;
}

export interface WarehouseOut {
  warehouseId: number;
  code: string | null;
  name: string;
  operatorName: string | null;
  operator: Address;
  region: string;
  country: string | null;
  place: string | null;
  lat: number | null;
  lon: number | null;
  materials: MaterialRef[];
  reserveFeed: Address | null;
  active: boolean;
  frozen: boolean;
  frozenReason: string | null;
  /** ReserveGuard.isHealthy: not frozen, fresh report, reserve >= outstanding */
  healthy: boolean;
  fresh: boolean;
  reserveKg: number;
  outstandingKg: number;
  /** reserve / outstanding; null while nothing is tokenized */
  coverage: number | null;
  reportedAt: string | null;
  updatedAt: string | null;
}

export interface WarehousesOut {
  chainId: number;
  warehouses: WarehouseOut[];
  updatedAt: string | null;
}

export interface PriceOut {
  material: string;
  materialName: string | null;
  symbol: string | null;
  region: string;
  feed: Address | null;
  priceUsdPerTonne: number | null;
  haircutBps: number;
  roundId: number;
  updatedAt: string | null;
  stale: boolean;
}

export interface PricesOut {
  chainId: number;
  prices: PriceOut[];
  updatedAt: string | null;
}

export interface VaultStats {
  totalAssetsUsdc: number;
  deployedUsdc: number;
  idleUsdc: number;
  utilization: number;
  updatedAt: string | null;
}

export interface ProtocolStatsOut {
  chainId: number;
  warehouses: number;
  activeWarehouses: number;
  healthyWarehouses: number;
  frozenWarehouses: number;
  custodyKg: number;
  tokenizedKg: number;
  activeLots: number;
  lotsMinted: number;
  materialValueUsd: number;
  vault: VaultStats | null;
  updatedAt: string | null;
}

export interface SyncOut {
  chainId: number;
  indexerLive: boolean;
  indexedBlock: number | null;
  headBlock: number | null;
  lagBlocks: number | null;
  catchingUp: boolean;
  indexedAt: string | null;
  snapshotAt: string | null;
  workerLive: boolean;
  upkeepAt: string | null;
  lowGas: boolean;
  error: string | null;
}

/* ---- Stage 3: KYC, lots, activity, portfolio, search, ops ---- */

export type KycStatus = 'draft' | 'in_review' | 'approved' | 'rejected';
export type EntityType = 'corporate' | 'partnership' | 'fund' | 'individual';
export type DocKind = 'registration' | 'owners' | 'directors';

export interface KycApplicationIn {
  orgName: string;
  country: string;
  entityType: EntityType;
  tier: number;
  contactEmail?: string | null;
}

export interface KycDocument {
  id: string;
  kind: DocKind;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
  uploadedAt: string;
}

export interface KycRequirement {
  key: 'wallet' | DocKind | 'screening';
  title: string;
  detail: string;
  state: 'complete' | 'in_review' | 'required' | 'failed';
}

export interface KycChainStatus {
  chainId: number;
  chainName: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  txHash: string | null;
  error: string | null;
}

export interface KycApplication {
  address: Address;
  status: KycStatus;
  orgName: string | null;
  country: string | null;
  entityType: EntityType | null;
  tier: number | null;
  contactEmail: string | null;
  documents: KycDocument[];
  requirements: KycRequirement[];
  screening: 'clear' | 'flagged' | null;
  screeningNotes: string[];
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectReason: string | null;
  approvedTier: number | null;
  expiresAt: string | null;
  attestations: KycChainStatus[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface KycMeOut {
  application: KycApplication | null;
}

export interface LotOut {
  tokenId: number;
  displayId: string;
  material: string | null;
  materialName: string | null;
  symbol: string | null;
  materialCode: string;
  warehouseId: number;
  warehouseCode: string | null;
  warehouseName: string | null;
  region: string | null;
  quantityKg: number;
  owner: Address;
  ownerName: string | null;
  state: 'FREE' | 'REDEEMING' | 'BURNED';
  mintedAt: string | null;
  lastAttestedAt: string | null;
  certHash: string | null;
  evidenceUri: string | null;
  requestId: number | null;
  priceUsdPerTonne: number | null;
  valueUsd: number | null;
  haircutBps: number;
  collateralValueUsd: number | null;
  maxBorrowUsdc: number | null;
}

export interface LotsOut {
  chainId: number;
  lots: LotOut[];
  total: number;
}

export interface AttestationOut {
  index: number;
  kind: 'CUSTODY' | 'INSPECTION' | 'REINSPECTION' | 'AI_REVIEW' | 'RELEASE';
  subjectType: 'REQUEST' | 'LOT';
  subject: number;
  attestor: Address;
  attestorName: string | null;
  score: number;
  dataHash: string;
  uri: string;
  at: string | null;
  txHash: string | null;
}

export interface MintRequestOut {
  requestId: number;
  displayId: string;
  owner: Address;
  warehouseId: number;
  material: string | null;
  quantityKg: number;
  status: 'REQUESTED' | 'FINALIZED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  createdAt: string | null;
  custodyAt: string | null;
  aiOverride: boolean;
  tokenId: number | null;
  evidenceUri: string | null;
  certHash: string | null;
}

export interface ActivityItem {
  id: string;
  kind: string;
  title: string;
  ref: string | null;
  actor: string | null;
  amount: string | null;
  at: string | null;
  txHash: string;
  href: string | null;
}

export interface ActivityOut {
  chainId: number;
  items: ActivityItem[];
}

export interface NotificationsOut {
  chainId: number;
  items: ActivityItem[];
  unread: number;
  seenAt: string | null;
}

export interface LotDetailOut extends LotOut {
  warehouse: WarehouseOut | null;
  request: MintRequestOut | null;
  attestations: AttestationOut[];
  history: ActivityItem[];
}

export interface MaterialHolding {
  material: string | null;
  name: string;
  symbol: string | null;
  quantityKg: number;
  lots: number;
  valueUsd: number;
  share: number;
}

export interface PortfolioSite {
  warehouseId: number;
  code: string | null;
  name: string;
  lat: number | null;
  lon: number | null;
  lots: number;
  quantityKg: number;
  coverage: number | null;
  healthy: boolean;
  fresh: boolean;
  reportedAt: string | null;
}

export interface ValuePoint {
  at: string;
  grossUsd: number;
  netUsd: number;
}

export interface PortfolioOut {
  chainId: number;
  address: Address;
  displayName: string;
  lots: LotOut[];
  lotCount: number;
  quantityKg: number;
  lotsValueUsd: number;
  vault: { shares: string; assetsUsdc: number } | null;
  portfolioValueUsd: number;
  debtUsdc: number;
  borrowCapacityUsdc: number;
  byMaterial: MaterialHolding[];
  sites: PortfolioSite[];
  history: ValuePoint[];
  valuedAt: string | null;
}

export interface SearchResult {
  type: 'lot' | 'warehouse' | 'address' | 'request';
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface SearchOut {
  query: string;
  results: SearchResult[];
}

export interface OpsRow {
  module: string;
  ref: string;
  subject: string;
  warehouse: string;
  state: string;
  tone: string;
  queue: 'pending' | 'attention' | 'frozen' | 'disputed' | 'expired' | 'completed';
  since: string | null;
  who: string;
  action: string;
  href: string;
}

export interface OpsQueueOut {
  chainId: number;
  rows: OpsRow[];
}

/* ---- Stage 4: tokenize (mint drafts, requests) and inspections ---- */

export interface EvidenceFile {
  id: string;
  /** certificate | receipt | weighbridge | photos | mill (mint evidence); weigh | photos | assay | report (inspections) */
  kind: string;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
  uploadedAt: string;
}

export interface MintDocKind {
  kind: string;
  title: string;
  detail: string;
  required: boolean;
  multiple: boolean;
}

export interface MintMaterial {
  code: string;
  name: string;
  symbol: string;
  family: string;
  grade: string;
}

export interface MintWarehouse {
  warehouseId: number;
  code: string | null;
  name: string;
  operatorName: string | null;
  region: string;
  place: string | null;
  /** material codes this warehouse stores */
  materials: string[];
  /** active, not frozen, fresh reserve report */
  eligible: boolean;
  reason: string | null;
  fresh: boolean;
  frozen: boolean;
  /** attested reserve minus tokenized outstanding */
  headroomKg: number;
}

export interface MintConfigOut {
  chainId: number;
  controller: Address;
  minAiScore: number;
  requestTtlSeconds: number;
  minLotKg: number;
  /** raw token units; "0" = free */
  mintFee: string;
  feeToken: Address | null;
  feeTokenSymbol: string | null;
  feeTokenDecimals: number | null;
  maxFileMb: number;
  materials: MintMaterial[];
  warehouses: MintWarehouse[];
  docKinds: MintDocKind[];
}

export interface MintDraftIn {
  material: string;
  warehouseId: number;
  quantityKg: number;
  certificateId: string;
  receiptNo?: string | null;
}

export type MintDraftStatus = 'draft' | 'submitted' | 'requested' | 'discarded';

export interface MintDraft {
  id: string;
  chainId: number;
  owner: Address;
  /** draft: editable · submitted: waiting for the requestMint transaction · requested: on-chain as requestId */
  status: MintDraftStatus;
  material: string | null;
  materialName: string | null;
  symbol: string | null;
  warehouseId: number | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  region: string | null;
  place: string | null;
  quantityKg: number | null;
  certificateId: string | null;
  receiptNo: string | null;
  documents: EvidenceFile[];
  /** required document kinds not uploaded yet */
  missing: string[];
  certHash: string | null;
  evidenceUri: string | null;
  requestId: number | null;
  indicativeValueUsd: number | null;
  borrowCapacityUsdc: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  submittedAt: string | null;
}

export interface MintDraftsOut {
  chainId: number;
  drafts: MintDraft[];
}

/** Arguments for MintingController.requestMint, returned by POST .../prepare. */
export interface MintPrepareOut {
  draft: MintDraft;
  controller: Address;
  warehouseId: number;
  /** bytes32 hex */
  materialCode: `0x${string}`;
  quantityKg: number;
  /** bytes32 hex */
  certHash: `0x${string}`;
  evidenceUri: string;
  mintFee: string;
  feeToken: Address | null;
  /** approve feeToken for the controller first */
  allowanceNeeded: boolean;
  warnings: string[];
}

export type MintStepKey = 'details' | 'evidence' | 'review' | 'inspection' | 'custody' | 'reserve' | 'mint';

export interface MintStep {
  key: MintStepKey;
  label: string;
  state: 'done' | 'current' | 'waiting' | 'blocked' | 'failed';
  detail: string | null;
  at: string | null;
}

export interface ReviewCheck {
  key: string;
  label: string;
  result: string;
  /** t-success | t-warning | t-danger | t-neutral */
  tone: string;
  points: number;
  maxPoints: number;
}

export interface MintReview {
  status: 'queued' | 'running' | 'posted' | 'failed';
  score: number | null;
  threshold: number;
  passed: boolean | null;
  checks: ReviewCheck[];
  documentsReviewed: number;
  reportId: string | null;
  dataHash: string | null;
  uri: string | null;
  txHash: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  override: boolean;
  overrideBy: string | null;
}

export interface InspectionCondition {
  key: string;
  label: string;
  ok: boolean;
}

export interface InspectionReport {
  id: string;
  chainId: number;
  kind: 'INSPECTION' | 'REINSPECTION';
  subjectType: 'REQUEST' | 'LOT';
  subject: number;
  /** MR-0003 | TNS-CU-00001 */
  ref: string;
  outcome: 'pass' | 'fail';
  /** sealed: waiting for the inspector's wallet · attested · rejected (mint request) · failed (lot, recorded off-chain) */
  status: 'sealed' | 'attested' | 'rejected' | 'failed';
  inspector: Address;
  inspectorName: string | null;
  organisation: string | null;
  licence: string | null;
  declaredKg: number | null;
  measuredKg: number | null;
  variancePct: number | null;
  bundlesDeclared: number | null;
  bundlesCounted: number | null;
  assayPct: number | null;
  assayElement: string | null;
  seals: string | null;
  inspectedAt: string | null;
  conditions: InspectionCondition[];
  notes: string | null;
  reason: string | null;
  files: EvidenceFile[];
  dataHash: `0x${string}`;
  uri: string;
  txHash: string | null;
  attestedAt: string | null;
  createdAt: string;
}

export interface MintCustody {
  status: 'waiting' | 'queued' | 'confirmed' | 'failed';
  at: string | null;
  by: Address | null;
  operatorName: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  receiptNo: string | null;
  seals: string | null;
  reportId: string | null;
  dataHash: string | null;
  uri: string | null;
  txHash: string | null;
  error: string | null;
}

export interface ReserveCheck {
  reserveKg: number;
  outstandingKg: number;
  newKg: number;
  /** reserve / (outstanding + new) */
  coverageAfter: number | null;
  fresh: boolean;
  frozen: boolean;
  /** ReserveGuard.canAdd, read live */
  canAdd: boolean;
  shortfallKg: number;
  reportedAt: string | null;
  operatorName: string | null;
}

export interface MintActions {
  canCancel: boolean;
  canFinalize: boolean;
  /** contract error name, e.g. MissingInspection */
  finalizeBlocker: string | null;
  finalizeMessage: string | null;
  canExpire: boolean;
  canOverride: boolean;
  canReject: boolean;
  canInspect: boolean;
}

export interface MintRequestDetail {
  request: MintRequestOut;
  title: string;
  materialName: string | null;
  symbol: string | null;
  ownerName: string | null;
  warehouse: WarehouseOut | null;
  expiresAt: string | null;
  minAiScore: number;
  indicativeValueUsd: number | null;
  borrowCapacityUsdc: number | null;
  steps: MintStep[];
  currentStep: MintStepKey;
  draft: MintDraft | null;
  review: MintReview | null;
  inspection: InspectionReport | null;
  custody: MintCustody;
  reserve: ReserveCheck | null;
  actions: MintActions;
  attestations: AttestationOut[];
  history: ActivityItem[];
  rejectReason: string | null;
}

export interface MintRequestRow {
  request: MintRequestOut;
  title: string;
  ownerName: string | null;
  warehouseCode: string | null;
  currentStep: MintStepKey;
  currentLabel: string;
  reviewScore: number | null;
  inspected: boolean;
  custody: boolean;
}

export interface MintRequestsOut {
  chainId: number;
  requests: MintRequestRow[];
}

export interface InspectorProfileIn {
  name: string;
  organisation: string;
  licence?: string | null;
}

export interface InspectorProfile {
  address: Address;
  name: string | null;
  organisation: string | null;
  licence: string | null;
  /** holds INSPECTOR on this chain */
  isInspector: boolean;
  updatedAt: string | null;
}

export interface InspectionReportIn {
  subjectType: 'REQUEST' | 'LOT';
  subject: number;
  outcome: 'pass' | 'fail';
  measuredKg?: number | null;
  bundlesDeclared?: number | null;
  bundlesCounted?: number | null;
  assayPct?: number | null;
  seals?: string | null;
  inspectedAt?: string | null;
  conditions: Record<string, boolean>;
  notes?: string | null;
  reason?: string | null;
  fileIds: string[];
  orderId?: string | null;
}

/** POST .../inspections/reports: the sealed report and what to sign next. */
export interface InspectionSealOut {
  report: InspectionReport;
  /** 1 INSPECTION | 2 REINSPECTION */
  kindCode: number;
  /** 0 REQUEST | 1 LOT */
  subjectTypeCode: number;
  dataHash: `0x${string}`;
  uri: string;
  /** bytes32 hex for MintingController.rejectRequest (failed mint inspection) */
  reasonCode: `0x${string}` | null;
  registry: Address;
  controller: Address;
}

export type QueueStatus = 'REQUESTED' | 'ON HOLD' | 'ORDERED' | 'DUE' | 'OVERDUE' | 'SEALED';

export interface InspectionQueueItem {
  kind: 'mint' | 'reinspection' | 'due';
  ref: string;
  subjectType: 'REQUEST' | 'LOT';
  subject: number;
  title: string;
  owner: Address | null;
  ownerName: string | null;
  material: string | null;
  materialName: string | null;
  warehouseId: number | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  declaredKg: number | null;
  certificateId: string | null;
  receiptNo: string | null;
  status: QueueStatus;
  tone: string;
  dueAt: string | null;
  note: string | null;
  orderId: string | null;
  evidence: EvidenceFile[];
  /** a report this inspector sealed but has not signed yet */
  sealedReportId: string | null;
}

export interface InspectionQueueOut {
  chainId: number;
  profile: InspectorProfile;
  items: InspectionQueueItem[];
  pending: number;
  dueToday: number;
}

export interface InspectionHistoryRow {
  at: string | null;
  ref: string;
  type: 'Mint' | 'Reinspection';
  warehouseCode: string | null;
  declaredKg: number | null;
  measuredKg: number | null;
  result: 'ATTESTED' | 'REJECTED' | 'FAILED';
  tone: string;
  inspector: Address | null;
  inspectorName: string | null;
  reportId: string | null;
  dataHash: string | null;
  uri: string | null;
  txHash: string | null;
  href: string | null;
}

export interface InspectionHistoryOut {
  chainId: number;
  rows: InspectionHistoryRow[];
}

export interface ReinspectionOrderIn {
  tokenId: number;
  reason: string;
  dueDays?: number;
}

export interface ReinspectionOrder {
  id: string;
  /** RI-0001 */
  ref: string;
  chainId: number;
  tokenId: number;
  lotRef: string;
  reason: string;
  status: 'open' | 'done' | 'cancelled';
  dueAt: string;
  createdBy: Address;
  createdAt: string;
  doneAt: string | null;
  reportId: string | null;
}
