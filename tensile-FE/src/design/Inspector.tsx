/* Inspector workspace. Built from Inspector.dc.html (same markup and classes), driven by /inspections:
 * the queue (open mint requests, reinspection orders, lots whose attestation goes stale), the record form, and
 * history. Recording seals a report through the API, then the inspector signs from their own wallet:
 *   pass                      AttestationRegistry.attest(INSPECTION | REINSPECTION, REQUEST | LOT, id, 0, dataHash, uri)
 *   fail on a mint request    MintingController.rejectRequest(id, "INSPECTION_FAILED")
 *   fail on a lot             recorded and raised to operations (no transaction)
 * /inspections?ref=MR-0003 opens with that item selected. Risk staff can order reinspections of lots here.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { stringToHex } from 'viem';
import { simulateContract } from 'wagmi/actions';

import { AttestationRegistryAbi } from '../abis/AttestationRegistry';
import { MintingControllerAbi } from '../abis/MintingController';
import { ApiError } from '../lib/api';
import { tonnes, utc } from '../lib/format';
import { shortHash, txUrl, useTx } from '../lib/tx';
import type { ChainInfo, InspectionQueueItem, InspectionReport, InspectionReportIn, InspectionSealOut } from '../lib/types';
import { shortAddress } from '../lib/web3';
import Sidebar from '../shell/Sidebar';
import TopBar, { WalletArea } from '../shell/TopBar';
import {
  openEvidenceFile, reportUrl, useInspectionActions, useInspectionHistory, useInspectionQueue, useInspectionReport,
  useInspectorProfileActions, useOrderActions, useRefreshMint,
} from '../state/minting';
import { useNow } from '../state/protocol';
import { errorMessage, useSession } from '../state/session';
import { Alert, shortSha, t3 } from './tokenize/shared';
import './Tokenize.css';

const CONDITIONS: [key: string, label: string][] = [
  ['sealsIntact', 'Seals intact before inspection'],
  ['bundlesMatch', 'Bundles match receipt marks'],
  ['noDamage', 'No visible contamination or damage'],
  ['storedDry', 'Stored under cover, dry floor'],
];
const FILE_KINDS: [kind: string, label: string][] = [['weigh', 'Weigh report'], ['photos', 'Photographs'], ['assay', 'Assay certificate'], ['report', 'Other report']];
const KIND_LABEL: Record<InspectionQueueItem['kind'], string> = { mint: 'Mint', reinspection: 'Reinspection', due: 'Re-attest' };
const FAILED_REASON = stringToHex('INSPECTION_FAILED', { size: 32 });
const VARIANCE_LIMIT = 0.5; // % between declared and measured before the review flags it

const nowUtc = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
/** "2026-10-07 14:05" -> ISO, or null */
function parseUtc(text: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/.exec(text.trim());
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}:00Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}
const element = (material: string | null) => {
  const s = (material ?? '').split('-')[0];
  return s ? s[0] + s.slice(1).toLowerCase() : '';
};
const what = (item: InspectionQueueItem) => item.title.split(' · ')[0];

function dueLabel(item: InspectionQueueItem, now: number): [string, string] {
  if (item.status === 'ON HOLD') return ['Held', ''];
  if (!item.dueAt) return ['—', ''];
  const due = Date.parse(item.dueAt);
  if (due < now) return [`Overdue · ${item.dueAt.slice(0, 10)}`, 't-fg-danger'];
  if (item.dueAt.slice(0, 10) === new Date(now).toISOString().slice(0, 10)) return [`Due today ${item.dueAt.slice(11, 16)}`, 't-fg-warning'];
  return [`Due ${item.dueAt.slice(0, 10)}`, ''];
}

/** What to sign for a report that was sealed earlier (the queue only has its id). */
function sealFromReport(report: InspectionReport, chain: ChainInfo): InspectionSealOut {
  return {
    report,
    kindCode: report.kind === 'INSPECTION' ? 1 : 2,
    subjectTypeCode: report.subjectType === 'REQUEST' ? 0 : 1,
    dataHash: report.dataHash,
    uri: report.uri,
    reasonCode: report.outcome === 'fail' && report.subjectType === 'REQUEST' ? FAILED_REASON : null,
    registry: chain.addresses.AttestationRegistry,
    controller: chain.addresses.MintingController,
  };
}

// ------------------------------------------------------------------ record one inspection

interface Upload { key: string; name: string; kind: string; id?: string; sha256?: string; error?: string }
interface Done { title: string; body: string; hash?: string; reportId: string; dataHash: string }

function RecordInspection({ item, gone, canRecord, isRisk, onNext }: { item: InspectionQueueItem; gone: boolean; canRecord: boolean; isRisk: boolean; onNext: () => void }) {
  const { chain, setError } = useSession();
  const { uploadFile, seal } = useInspectionActions();
  const orders = useOrderActions();
  const tx = useTx();
  const refresh = useRefreshMint();
  const sealedReport = useInspectionReport(item.sealedReportId).data;
  const declared = item.declaredKg;

  const [measured, setMeasured] = useState('');
  const [counted, setCounted] = useState('');
  const [declaredBundles, setDeclaredBundles] = useState('');
  const [assay, setAssay] = useState('');
  const [seals, setSeals] = useState('');
  const [at, setAt] = useState(nowUtc);
  const [cond, setCond] = useState<Record<string, boolean>>({});
  const [files, setFiles] = useState<Upload[]>([]);
  const [fileKind, setFileKind] = useState('weigh');
  const [notes, setNotes] = useState('');
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [sealed, setSealed] = useState<InspectionSealOut | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [redo, setRedo] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // a report sealed earlier and never signed: offer to sign it (or record a new one)
  useEffect(() => {
    if (sealedReport && !sealed && !redo && sealedReport.status === 'sealed') setSealed(sealFromReport(sealedReport, chain));
  }, [sealedReport]); // eslint-disable-line react-hooks/exhaustive-deps

  const measuredKg = measured.trim() ? Math.round(Number(measured.replace(/[,\s]/g, '')) * 1000) : null;
  const variance = declared && measuredKg != null && Number.isFinite(measuredKg) ? ((measuredKg - declared) / declared) * 100 : null;
  const inspectedAt = parseUtc(at);
  const frozen = item.status === 'ON HOLD';
  const uploading = files.some((f) => !f.id && !f.error);
  const int = (s: string) => (s.trim() ? Math.max(0, Math.round(Number(s))) : null);
  const errors = {
    measured: !failing && (measuredKg == null || !Number.isFinite(measuredKg) || measuredKg <= 0) ? 'Enter the measured net weight.' : null,
    at: inspectedAt ? (Date.parse(inspectedAt) > Date.now() + 5 * 60_000 ? 'That is in the future.' : null) : 'Use YYYY-MM-DD HH:MM (UTC).',
    reason: failing && !reason.trim() ? 'Say why the inspection failed; the owner sees this.' : null,
    assay: assay.trim() && !(Number(assay) >= 0 && Number(assay) <= 100) ? 'A percentage between 0 and 100.' : null,
  };
  const valid = !errors.measured && !errors.at && !errors.reason && !errors.assay;

  const attach = async (list: File[]) => {
    const items = list.map((file, i) => ({ key: `${Date.now()}-${i}`, name: file.name, kind: fileKind, file }));
    setFiles((f) => [...f, ...items.map(({ file: _f, ...u }) => u)]);
    for (const it of items) {
      try {
        const out = await uploadFile.mutateAsync({ kind: it.kind, file: it.file });
        setFiles((f) => f.map((x) => (x.key === it.key ? { ...x, id: out.id, sha256: out.sha256 } : x)));
      } catch (e) {
        setFiles((f) => f.map((x) => (x.key === it.key ? { ...x, error: errorMessage(e) } : x)));
      }
    }
  };

  const sign = async (s: InspectionSealOut) => {
    const r = s.report;
    const lotFail = r.outcome === 'fail' && r.subjectType === 'LOT';
    if (lotFail) {
      setDone({ title: `Failed reinspection recorded · ${r.ref}`, body: 'Raised to operations. No on-chain attestation is written for a failed reinspection; the lot keeps its last attestation until operations act.', reportId: r.id, dataHash: r.dataHash });
      refresh();
      return;
    }
    try {
      const receipt = r.outcome === 'fail'
        ? await tx.run('Sign rejection', (x) =>
          simulateContract(x.config, { address: s.controller, abi: MintingControllerAbi, functionName: 'rejectRequest', args: [BigInt(r.subject), s.reasonCode ?? FAILED_REASON], account: x.account, chainId: x.chainId }))
        : await tx.run('Sign inspection attestation', (x) =>
          simulateContract(x.config, { address: s.registry, abi: AttestationRegistryAbi, functionName: 'attest', args: [s.kindCode, s.subjectTypeCode, BigInt(r.subject), 0, s.dataHash, s.uri], account: x.account, chainId: x.chainId }));
      const signedAt = utc(new Date().toISOString());
      setDone(r.outcome === 'fail'
        ? { title: `Mint request rejected · ${r.ref}`, body: `Signed ${signedAt}. The owner has been notified and the certificate is free again.`, hash: receipt.transactionHash, reportId: r.id, dataHash: r.dataHash }
        : { title: `Inspection attested · ${r.ref}`, body: `Signed ${signedAt}. ${r.subjectType === 'REQUEST' ? `The owner${item.warehouseName ? ` and ${item.warehouseName}` : ''} have been notified; custody confirmation is next.` : "The lot's attestation is refreshed."}`, hash: receipt.transactionHash, reportId: r.id, dataHash: r.dataHash });
      setSealed(null);
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const record = async (outcome: 'pass' | 'fail') => {
    setTouched(true);
    if (outcome === 'fail' && !failing) return setFailing(true);
    if (outcome === 'pass' && failing) return setFailing(false);
    if (!valid || uploading) return;
    const body: InspectionReportIn = {
      subjectType: item.subjectType, subject: item.subject, outcome,
      measuredKg: measuredKg != null && Number.isFinite(measuredKg) ? measuredKg : null,
      bundlesDeclared: int(declaredBundles), bundlesCounted: int(counted),
      assayPct: assay.trim() ? Number(assay) : null, seals: seals.trim() || null, inspectedAt,
      conditions: Object.fromEntries(CONDITIONS.map(([k]) => [k, !!cond[k]])),
      notes: notes.trim() || null, reason: outcome === 'fail' ? reason.trim() : null,
      fileIds: files.filter((f) => f.id).map((f) => f.id!), orderId: item.orderId,
    };
    try {
      const s = await seal.mutateAsync(body);
      setSealed(s);
      await sign(s);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const busy = tx.busy ? tx.status : seal.isPending ? 'Sealing report…' : null;
  const disabled = !canRecord || !!busy || !!done || gone;
  const ownerLabel = item.ownerName ?? (item.owner ? shortAddress(item.owner) : null);
  const subjectHref = item.subjectType === 'REQUEST' ? `/tokenize?request=${item.subject}` : `/lots/${item.subject}`;

  return (
    <section className="t-card" style={{ flex: '999 1 560px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="t-between t-wrap" style={{ alignItems: 'flex-start', gap: '12px' }}>
        <div className="t-stack" style={{ gap: '4px' }}>
          <span className="t-eyebrow">{item.kind === 'mint' ? 'Record inspection' : 'Record reinspection'}</span>
          <span className="t-h3">{item.ref} · {what(item)}</span>
          <span className="t-sm t-sec">
            {[item.warehouseName ?? item.warehouseCode, ownerLabel ? `owner ${ownerLabel}` : null, item.certificateId ? `certificate ${item.certificateId}` : null, item.receiptNo ? `receipt ${item.receiptNo}` : null].filter(Boolean).join(' · ')}
          </span>
        </div>
        <span className="t-row" style={{ gap: '12px' }}>
          {isRisk && item.orderId ? (
            <button className="t-btn t-btn-sm t-btn-ghost" disabled={orders.cancel.isPending} onClick={() => window.confirm(`Cancel reinspection order ${item.ref}?`) && orders.cancel.mutate(item.orderId!, { onError: (e) => setError(errorMessage(e)) })}>Cancel order</button>
          ) : null}
          <a href={subjectHref} className="t-sm">{item.subjectType === 'REQUEST' ? 'Open request' : 'Open lot'}</a>
        </span>
      </div>

      {item.evidence.length ? (
        <div className="t-row" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <span className="t-label" style={{ marginRight: '4px' }}>Owner evidence</span>
          {item.evidence.map((f) => (
            <button key={f.id} className="t-chip" style={{ cursor: 'pointer', border: 0 }} title={`${f.filename} · sha256 ${f.sha256}`} onClick={() => openEvidenceFile(chain.chainId, f.id).catch((e) => setError(errorMessage(e)))}>
              {f.kind} · {f.filename.length > 28 ? f.filename.slice(0, 25) + '…' : f.filename}
            </button>
          ))}
        </div>
      ) : null}
      {item.note && item.status !== 'ON HOLD' ? <span className="t-cap">{item.note}</span> : null}
      {frozen ? <span className="t-reason">{item.note}</span> : null}
      {gone && !done ? <Alert tone="warning" title="No longer in the queue">{item.ref} has been inspected or closed since you opened it.</Alert> : null}
      {!canRecord ? <Alert tone="warning" title="View only">Recording an inspection needs the INSPECTOR role on {chain.name}.</Alert> : null}

      {done ? (
        <>
          <Alert tone="success" title={done.title}>
            {done.body}
            {done.hash ? <> · tx <a href={txUrl(chain.explorerUrl, done.hash)} target="_blank" rel="noreferrer" className="t-mono">{shortHash(done.hash)}</a></> : null}
            {' · report '}<a href={reportUrl(done.reportId)} target="_blank" rel="noreferrer" className="t-mono">{shortHash(done.dataHash)}</a>
          </Alert>
          <button className="t-btn t-btn-secondary" onClick={onNext} style={{ alignSelf: 'flex-start' }}>Next in queue</button>
        </>
      ) : sealed ? (
        <>
          <Alert tone="warning" title={`Report sealed · ${sealed.report.outcome === 'fail' ? 'failed inspection' : 'passed'} · not signed yet`}>
            Sealed {utc(sealed.report.createdAt)} · report <a href={reportUrl(sealed.report.id)} target="_blank" rel="noreferrer" className="t-mono">{shortHash(sealed.dataHash)}</a>
            {sealed.report.measuredKg != null ? ` · measured ${t3(sealed.report.measuredKg)} t` : ''}.
            {sealed.report.outcome === 'fail' && sealed.report.subjectType === 'REQUEST'
              ? ' Signing rejects the mint request on-chain.'
              : sealed.report.outcome === 'fail' ? ' Confirm to raise it to operations.' : ' Signing writes the attestation with your key.'}
          </Alert>
          <div className="t-between t-wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <button className="t-btn t-btn-ghost" disabled={!!busy} onClick={() => { setSealed(null); setRedo(true); }}>Record a new report instead</button>
            <button className={`t-btn ${sealed.report.outcome === 'fail' ? 't-btn-danger-outline' : 't-btn-primary'}`} disabled={!canRecord || !!busy} onClick={() => sign(sealed)}>
              {busy ? <><span className="t-spinner" />{busy}</> : sealed.report.outcome === 'fail' ? (sealed.report.subjectType === 'REQUEST' ? 'Sign rejection' : 'Confirm failed reinspection') : 'Sign inspection attestation'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px' }}>
            <label className="t-field">
              <span className="t-label">Measured net weight</span>
              <span style={{ position: 'relative' }}>
                <input className="t-input" inputMode="decimal" placeholder={declared ? tonnes(declared).replace(/,/g, '') : '0.000'} value={measured} disabled={disabled} onChange={(e) => setMeasured(e.target.value)} style={{ fontVariantNumeric: 'tabular-nums' }} />
                <span className="t-sm t-muted" style={{ position: 'absolute', right: '12px', top: '10px' }}>t</span>
              </span>
              <span className="t-help" style={{ color: touched && errors.measured ? 'var(--danger-text)' : variance == null ? undefined : Math.abs(variance) <= VARIANCE_LIMIT ? 'var(--success-text)' : 'var(--warning-text)' }}>
                {touched && errors.measured
                  ? errors.measured
                  : variance == null
                    ? `Declared ${t3(declared)} t`
                    : `Declared ${t3(declared)} t · variance ${variance >= 0 ? '+' : ''}${variance.toFixed(2)}%, ${Math.abs(variance) <= VARIANCE_LIMIT ? 'within' : 'outside'} ${VARIANCE_LIMIT.toFixed(2)}%`}
              </span>
            </label>
            <label className="t-field">
              <span className="t-label">Bundles counted</span>
              <span className="t-row" style={{ gap: '8px' }}>
                <input className="t-input" inputMode="numeric" value={counted} disabled={disabled} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ''))} />
                <span className="t-sm t-muted">of</span>
                <input className="t-input" inputMode="numeric" placeholder="—" aria-label="Bundles declared" value={declaredBundles} disabled={disabled} onChange={(e) => setDeclaredBundles(e.target.value.replace(/\D/g, ''))} />
              </span>
              <span className="t-help">Counted on site · declared on the receipt</span>
            </label>
            <label className="t-field">
              <span className="t-label">Assay sample</span>
              <span style={{ position: 'relative' }}>
                <input className="t-input" inputMode="decimal" value={assay} disabled={disabled} onChange={(e) => setAssay(e.target.value)} />
                <span className="t-sm t-muted" style={{ position: 'absolute', right: '12px', top: '10px' }}>% {element(item.material)}</span>
              </span>
              <span className="t-help" style={errors.assay ? { color: 'var(--danger-text)' } : undefined}>{errors.assay ?? `Purity of the sample${item.materialName ? ` · ${item.materialName}` : ''}`}</span>
            </label>
            <label className="t-field" style={{ gridColumn: 'span 2' }}>
              <span className="t-label">Seals applied</span>
              <input className="t-input" placeholder="MS-77120 → MS-77129" value={seals} disabled={disabled} maxLength={120} onChange={(e) => setSeals(e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: '13px' }} />
            </label>
            <label className="t-field">
              <span className="t-label">Inspected at (UTC)</span>
              <input className="t-input" value={at} disabled={disabled} onChange={(e) => setAt(e.target.value)} />
              {touched && errors.at ? <span className="t-help" style={{ color: 'var(--danger-text)' }}>{errors.at}</span> : null}
            </label>
          </div>
          <div className="t-stack" style={{ gap: '10px' }}>
            <span className="t-label">Condition</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
              {CONDITIONS.map(([k, label]) => (
                <label key={k} className="t-well t-row" style={{ padding: '10px 12px', gap: '10px', cursor: disabled ? 'default' : 'pointer' }}>
                  <input type="checkbox" checked={!!cond[k]} disabled={disabled} onChange={(e) => setCond((c) => ({ ...c, [k]: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: 'var(--brand)' }} />
                  <span className="t-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="t-stack" style={{ gap: '10px' }}>
            <div className="t-between">
              <span className="t-label">Evidence</span>
              <span className="t-row" style={{ gap: '8px' }}>
                <select className="t-input t-select" value={fileKind} disabled={disabled} onChange={(e) => setFileKind(e.target.value)} style={{ height: '32px', fontSize: '13px', width: 'auto', padding: '0 28px 0 10px' }}>
                  {FILE_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <button className="t-btn t-btn-sm t-btn-secondary" disabled={disabled} onClick={() => input.current?.click()}>Attach files</button>
              </span>
              <input ref={input} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; if (l.length) attach(l); }} />
            </div>
            {files.length ? (
              <div className="t-table-wrap"><table className="t-table t-dense"><tbody>
                {files.map((f) => (
                  <tr key={f.key}>
                    <td><span className="t-sm" style={{ fontWeight: '500' }}>{f.name}</span> <span className="t-cap">· {FILE_KINDS.find(([k]) => k === f.kind)?.[1]}</span></td>
                    <td><span className="t-mono t-sec" title={f.sha256 ? `sha256 ${f.sha256}` : undefined}>{shortSha(f.sha256)}</span></td>
                    <td className="t-right">
                      <span className="t-row" style={{ gap: '8px', justifyContent: 'flex-end' }}>
                        {f.error ? <span title={f.error} className="t-badge t-badge-word t-danger"><span className="t-dot" />Failed</span>
                          : f.id ? <span className="t-badge t-badge-word t-success"><span className="t-dot" />Stored</span>
                            : <span className="t-badge t-badge-word t-info"><span className="t-dot t-pulse" />Uploading</span>}
                        <button className="t-btn t-btn-sm t-btn-ghost" disabled={disabled} onClick={() => setFiles((l) => l.filter((x) => x.key !== f.key))} aria-label={`Remove ${f.name}`}>Remove</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody></table></div>
            ) : <span className="t-cap">Weigh report, photographs of tags and seals, and the assay certificate. Hashed into the sealed report.</span>}
          </div>
          <label className="t-field">
            <span className="t-label">Notes for the record</span>
            <textarea className="t-input" value={notes} disabled={disabled} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Bundles strapped and tagged; bay floor dry; operator present." style={{ height: '72px', padding: '10px 12px' }} />
          </label>
          {failing ? (
            <label className="t-field">
              <span className="t-label">Why it failed</span>
              <input className="t-input" value={reason} disabled={disabled} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. 2 of 10 bundles missing; weight 6% below declared" />
              <span className="t-help" style={touched && errors.reason ? { color: 'var(--danger-text)' } : undefined}>
                {touched && errors.reason ? errors.reason : item.subjectType === 'REQUEST' ? 'Shown to the owner. Signing rejects the mint request and frees the certificate.' : 'Raised to operations with the report.'}
              </span>
            </label>
          ) : null}
          <div className="t-between t-wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', gap: '12px' }}>
            <span className="t-cap" style={{ flex: '1 1 260px' }}>
              {busy ?? (uploading ? 'Waiting for uploads to finish…' : 'Signing writes an attestation with your key. It cannot be edited; a correction is a new attestation.')}
            </span>
            <div className="t-row" style={{ gap: '8px' }}>
              {failing ? <button className="t-btn t-btn-ghost" disabled={disabled} onClick={() => setFailing(false)}>Back</button> : null}
              <button className="t-btn t-btn-danger-outline" disabled={disabled || uploading} onClick={() => record('fail')}>
                {failing ? (busy ? <><span className="t-spinner" />{busy}</> : item.subjectType === 'REQUEST' ? 'Seal and sign rejection' : 'Record failed reinspection') : 'Record failed inspection'}
              </button>
              {!failing ? (
                <button className="t-btn t-btn-primary" disabled={disabled || uploading || frozen} title={frozen ? 'Paused while the warehouse is frozen' : undefined} onClick={() => record('pass')}>
                  {busy ? <><span className="t-spinner" />{busy}</> : 'Sign inspection attestation'}
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ profile + reinspection orders

function ProfileEditor({ initial, onClose }: { initial: { name: string | null; organisation: string | null; licence: string | null }; onClose: () => void }) {
  const save = useInspectorProfileActions();
  const { setError } = useSession();
  const [name, setName] = useState(initial.name ?? '');
  const [org, setOrg] = useState(initial.organisation ?? '');
  const [licence, setLicence] = useState(initial.licence ?? '');
  const ok = name.trim().length >= 2 && org.trim().length >= 2;
  return (
    <div className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="t-stack" style={{ gap: '4px' }}>
        <span className="t-h4">Inspector profile</span>
        <span className="t-sm t-sec">Your name, organisation and licence go into every report you seal.</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
        <label className="t-field"><span className="t-label">Name</span><input className="t-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="J. Okafor" /></label>
        <label className="t-field"><span className="t-label">Organisation</span><input className="t-input" value={org} maxLength={120} onChange={(e) => setOrg(e.target.value)} placeholder="Meridian Survey BV" /></label>
        <label className="t-field"><span className="t-label">Licence</span><input className="t-input" value={licence} maxLength={64} onChange={(e) => setLicence(e.target.value)} placeholder="Optional" style={{ fontFamily: 'var(--mono)', fontSize: '13px' }} /></label>
      </div>
      <div className="t-row" style={{ gap: '8px', justifyContent: 'flex-end' }}>
        <button className="t-btn t-btn-ghost" onClick={onClose}>Close</button>
        <button
          className="t-btn t-btn-primary"
          disabled={!ok || save.isPending}
          onClick={() => save.mutate({ name: name.trim(), organisation: org.trim(), licence: licence.trim() || null }, { onSuccess: onClose, onError: (e) => setError(errorMessage(e)) })}
        >
          {save.isPending ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </div>
  );
}

function OrderReinspection() {
  const orders = useOrderActions();
  const { setError } = useSession();
  const [lot, setLot] = useState('');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);
  const tokenId = Number(/(\d+)\s*$/.exec(lot)?.[1] ?? NaN);
  const ok = Number.isInteger(tokenId) && tokenId > 0 && reason.trim().length >= 3;
  return (
    <div className="t-card t-card-dense t-stack" style={{ gap: '10px' }}>
      <span className="t-h4">Order a reinspection</span>
      <span className="t-cap">Operations: send an inspector back to a lot. It joins this queue with a due date.</span>
      <input className="t-input" value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Lot, e.g. TNS-CU-00003" style={{ fontFamily: 'var(--mono)', fontSize: '13px' }} />
      <input className="t-input" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. dispute DS-0012" />
      <div className="t-row" style={{ gap: '8px' }}>
        <select className="t-input t-select" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ flex: '1' }}>
          {[3, 7, 14, 30].map((d) => <option key={d} value={d}>Due in {d} days</option>)}
        </select>
        <button
          className="t-btn t-btn-secondary"
          disabled={!ok || orders.create.isPending}
          onClick={() => orders.create.mutate({ tokenId, reason: reason.trim(), dueDays: days }, { onSuccess: () => { setLot(''); setReason(''); }, onError: (e) => setError(errorMessage(e)) })}
        >
          {orders.create.isPending ? 'Ordering…' : 'Order'}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the workspace

export default function Inspector() {
  const [params] = useSearchParams();
  const { chain, address, me, persona, personas, setPersona, signedIn } = useSession();
  const now = useNow(60_000);
  // Opening the workspace means acting as an inspector: switch "Viewing as" when this wallet can.
  const staffPersona = personas.includes('inspector') ? 'inspector' : personas.includes('ops') ? 'ops' : null;
  useEffect(() => {
    if (staffPersona && persona !== 'inspector' && persona !== 'ops') setPersona(staffPersona);
  }, [staffPersona]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = useInspectionQueue();
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const history = useInspectionHistory(scope);
  const [selRef, setSelRef] = useState<string | null>(params.get('ref'));
  const [pinned, setPinned] = useState<InspectionQueueItem | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  const forbidden = q.error instanceof ApiError && q.error.status === 403;
  const items = q.data?.items ?? [];
  // The selected item stays on screen after it leaves the queue (signed and indexed), so its result stays visible.
  const live = selRef ? items.find((i) => i.ref === selRef) : undefined;
  const fallback = items.find((i) => i.status !== 'ON HOLD') ?? items[0];
  useEffect(() => { if (live) setPinned(live); }, [live]);
  useEffect(() => { if (fallback && (!selRef || (!live && pinned?.ref !== selRef))) setSelRef(fallback.ref); }, [fallback?.ref, selRef, live, pinned?.ref]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = live ?? (pinned && pinned.ref === selRef ? pinned : fallback);
  const gone = !!sel && !items.some((i) => i.ref === sel.ref);
  const roles = me?.roles ?? [];
  const isInspector = q.data?.profile.isInspector ?? roles.includes('INSPECTOR');
  const isRisk = roles.includes('RISK_ADMIN') || roles.includes('ADMIN');
  const p = q.data?.profile;
  const profileLine = p?.name || p?.organisation
    ? [p.name, p.organisation, p.licence ? `licence ${p.licence}` : null, `attesting key ${shortAddress(address)}`].filter(Boolean).join(' · ')
    : !signedIn ? 'Sign in with an inspector wallet'
      : isInspector ? `Attesting key ${shortAddress(address)} · add your name and organisation before sealing reports`
        : `${me?.identity.orgName ?? shortAddress(address)} · operations view · recording needs the INSPECTOR role`;
  const next = () => {
    const i = items.findIndex((x) => x.ref === sel?.ref);
    const rest = [...items.slice(i + 1), ...items.slice(0, Math.max(0, i))].filter((x) => x.status !== 'ON HOLD' && x.ref !== sel?.ref);
    setPinned(null);
    setSelRef(rest[0]?.ref ?? null);
    q.refetch();
  };

  return (
    <div className="t-app">
      <div style={{ flex: '0 0 248px', display: 'flex', background: 'var(--bg-sunken)' }}>
        <Sidebar active="inspections" role="inspector" />
      </div>
      <div className="t-main">
        <TopBar section="Inspections" crumb={p?.organisation ?? 'Inspector'} />
        <main className="t-content">
          <div className="t-between t-wrap" style={{ alignItems: 'flex-end' }}>
            <div className="t-stack" style={{ gap: '8px' }}>
              <span className="t-eyebrow">Inspector</span>
              <h1 className="t-h1">Inspection queue</h1>
              <span className="t-sm t-sec">
                {profileLine}
                {isInspector ? <> · <button className="tk-link t-sm" onClick={() => setEditProfile((v) => !v)}>{p?.name ? 'Edit profile' : 'Set up profile'}</button></> : null}
              </span>
            </div>
            <div className="t-row" style={{ gap: '8px' }}>
              <span className="t-badge t-badge-word t-info">{q.data?.pending ?? 0} pending</span>
              <span className={`t-badge t-badge-word ${q.data?.dueToday ? 't-warning' : 't-neutral'}`}>{q.data?.dueToday ?? 0} due today</span>
            </div>
          </div>

          {!signedIn || forbidden ? (
            <div className="t-alert t-warning">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: 'none', marginTop: '1px' }}><path d="M12 3l9 16H3zM12 10v4M12 17v.5" /></svg>
              <div style={{ flex: '1' }}>
                <p className="t-alert-title">{signedIn ? 'The inspection queue needs an inspector or risk role on this network' : 'Sign in with an inspector wallet'}</p>
                <p className="t-alert-body">INSPECTOR, RISK_ADMIN or ADMIN on {chain.name}.</p>
              </div>
              {!signedIn ? <WalletArea /> : null}
            </div>
          ) : null}
          {q.error && !forbidden ? <Alert tone="danger" title="The queue could not be loaded">{errorMessage(q.error)}</Alert> : null}
          {editProfile && p ? <ProfileEditor initial={p} onClose={() => setEditProfile(false)} /> : null}

          {signedIn && !forbidden ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
              <section style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {q.isLoading ? [0, 1, 2].map((i) => <div key={i} className="t-skel" style={{ height: '96px', borderRadius: '18px' }} />) : null}
                {!q.isLoading && !items.length ? (
                  <div className="t-card t-card-dense t-stack" style={{ gap: '6px' }}>
                    <span className="t-sm" style={{ fontWeight: '500' }}>Nothing to inspect right now</span>
                    <span className="t-cap">New mint requests, reinspection orders and lots whose attestation is about to go stale show up here.</span>
                  </div>
                ) : null}
                {items.map((it) => {
                  const [due, dueFg] = dueLabel(it, now);
                  const on = sel?.ref === it.ref;
                  return (
                    <button key={it.ref} onClick={() => setSelRef(it.ref)} className="t-card t-card-dense" style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text)', borderColor: on ? 'var(--brand)' : 'var(--border)', boxShadow: on ? 'inset 0 0 0 1px var(--brand)' : undefined }}>
                      <div className="t-between">
                        <span className="t-row" style={{ gap: '8px' }}><span className="t-mono">{it.ref}</span><span className="t-badge t-badge-word t-neutral">{KIND_LABEL[it.kind]}</span></span>
                        <span className={`t-badge ${it.tone}`}>{it.status}</span>
                      </div>
                      <span className="t-sm" style={{ fontWeight: '500' }}>{it.title}</span>
                      <div className="t-between t-cap"><span>{it.warehouseCode ?? '—'}</span><span className={dueFg}>{due}</span></div>
                      {it.status === 'ON HOLD' || it.status === 'OVERDUE' ? <span className="t-reason">{it.note}</span> : null}
                    </button>
                  );
                })}
                {isRisk ? <OrderReinspection /> : null}
              </section>

              {sel ? (
                <RecordInspection key={`${chain.chainId}:${sel.ref}`} item={sel} gone={gone} canRecord={isInspector} isRisk={isRisk} onNext={next} />
              ) : (
                <section className="t-card" style={{ flex: '999 1 560px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="t-eyebrow">Record inspection</span>
                  <span className="t-sm t-sec">Pick an item from the queue.</span>
                </section>
              )}
            </div>
          ) : null}

          {signedIn && !forbidden ? (
            <section className="t-stack" style={{ gap: '12px' }}>
              <div className="t-between">
                <span className="t-h4">Inspection history</span>
                <div className="t-seg" role="group" aria-label="History scope">
                  <button aria-pressed={scope === 'all' ? 'true' : 'false'} onClick={() => setScope('all')}>Everyone</button>
                  <button aria-pressed={scope === 'mine' ? 'true' : 'false'} onClick={() => setScope('mine')}>Mine</button>
                </div>
              </div>
              <div className="t-table-wrap">
                <table className="t-table t-dense">
                  <thead><tr><th>Date (UTC)</th><th>Reference</th><th>Type</th><th>Warehouse</th><th className="t-right">Declared</th><th className="t-right">Measured</th><th>Result</th><th>Evidence</th></tr></thead>
                  <tbody>
                    {(history.data?.rows ?? []).map((h, n) => (
                      <tr key={`${h.ref}:${h.reportId ?? n}`}>
                        <td className="t-sec">{h.at ? h.at.slice(0, 10) : '—'}</td>
                        <td>{h.href ? <a href={h.href} className="t-mono">{h.ref}</a> : <span className="t-mono">{h.ref}</span>}</td>
                        <td>{h.type}</td>
                        <td><span className="t-mono t-sec">{h.warehouseCode ?? '—'}</span></td>
                        <td className="t-right">{h.declaredKg != null ? `${t3(h.declaredKg)} t` : '—'}</td>
                        <td className="t-right">{h.measuredKg != null ? `${t3(h.measuredKg)} t` : '—'}</td>
                        <td><span className={`t-badge ${h.tone}`}>{h.result}</span></td>
                        <td>{h.reportId ? <a href={reportUrl(h.reportId)} target="_blank" rel="noreferrer" className="t-mono">{shortHash(h.dataHash)}</a> : <span className="t-mono t-muted">{shortHash(h.dataHash)}</span>}</td>
                      </tr>
                    ))}
                    {history.data && !history.data.rows.length ? (
                      <tr><td colSpan={8} className="t-sec">No inspections recorded on {chain.name} yet.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

