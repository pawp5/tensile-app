/* Tokenize request panels, one per step (read-only views of a mint request). */
import { coords, pct, tonnes, utc } from '../../lib/format';
import { shortHash, txUrl } from '../../lib/tx';
import type { MintRequestDetail } from '../../lib/types';
import { shortAddress } from '../../lib/web3';
import { useLot } from '../../state/account';
import { openEvidenceFile, reportUrl, resolveUri } from '../../state/minting';
import { errorMessage, useSession } from '../../state/session';
import { Alert, Badge, CardHead, fileSize, Kv, shortSha, t3, usd } from './shared';

export function DetailsPanel({ d }: { d: MintRequestDetail }) {
  const r = d.request;
  return (
    <div className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <CardHead title="Material details" sub="As declared by the owner. Fixed once the request was submitted." right={<Badge tone="t-success">SUBMITTED</Badge>} />
      <div className="t-kv">
        <Kv k="Material">{d.materialName ?? '—'}</Kv>
        <Kv k="Material code" mono>{r.material ?? '—'}</Kv>
        <Kv k="Quantity">{t3(r.quantityKg)} t</Kv>
        <Kv k="Certificate identifier" mono>{d.draft?.certificateId ?? '—'}</Kv>
        <Kv k="Certificate hash" mono>{shortHash(r.certHash)}</Kv>
        <Kv k="Warehouse">{d.warehouse ? <>{d.warehouse.name} · <span className="t-mono">{d.warehouse.code}</span></> : `#${r.warehouseId}`}</Kv>
        <Kv k="Region">{d.warehouse ? [d.warehouse.region, d.warehouse.place].filter(Boolean).join(' · ') : '—'}</Kv>
        <Kv k="Warehouse receipt" mono>{d.draft?.receiptNo ?? '—'}</Kv>
        <Kv k="Owner">{d.ownerName ?? '—'} · <span className="t-mono">{shortAddress(r.owner)}</span></Kv>
      </div>
    </div>
  );
}

export function EvidencePanel({ d }: { d: MintRequestDetail }) {
  const { chain, setError } = useSession();
  const docs = d.draft?.documents ?? [];
  const manifest = resolveUri(d.request.evidenceUri);
  return (
    <div className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <CardHead title="Evidence" sub="Frozen when the request was submitted. Reviewers and the inspector see exactly these files." right={<Badge tone="t-success">ON RECORD</Badge>} />
      {docs.length ? (
        <div className="t-table-wrap">
          <table className="t-table t-dense">
            <thead><tr><th>Document</th><th>Type</th><th>Evidence reference</th><th className="t-right">Size</th><th>Status</th></tr></thead>
            <tbody>
              {docs.map((f) => (
                <tr key={f.id}>
                  <td><button className="tk-row-link t-sm" style={{ fontWeight: '500' }} onClick={() => openEvidenceFile(chain.chainId, f.id).catch((e) => setError(errorMessage(e)))}>{f.filename}</button></td>
                  <td><span className="t-sm t-sec">{f.kind}</span></td>
                  <td><span className="t-mono t-sec" title={`sha256 ${f.sha256}`}>{shortSha(f.sha256)}</span></td>
                  <td className="t-right"><span className="t-num">{fileSize(f.size)}</span></td>
                  <td><Badge word tone="t-success">Stored</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <span className="t-sm t-sec">The evidence for this request was submitted outside this app.</span>}
      <div className="t-between t-wrap t-well" style={{ padding: '12px 16px' }}>
        <span className="t-sm t-sec">Evidence bundle</span>
        <span className="t-mono">{d.request.evidenceUri ?? '—'}</span>
        {manifest ? <a href={manifest} target="_blank" rel="noreferrer" className="t-sm">Open manifest</a> : <span />}
      </div>
    </div>
  );
}

export function ReviewPanel({ d }: { d: MintRequestDetail }) {
  const v = d.review;
  const open = d.request.status === 'REQUESTED';
  const pending = open && (!v || ((v.status === 'queued' || v.status === 'running') && v.score == null));
  const docs = d.draft?.documents.length ?? v?.documentsReviewed ?? 0;
  return (
    <div className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <CardHead
        title="Automated review"
        sub="An automated check of the evidence for consistency. It is advisory: a human inspector still attests."
        right={v?.override ? <Badge tone="t-info">OVERRIDDEN</Badge> : v?.status === 'posted' ? <Badge tone={v.passed ? 't-success' : 't-danger'}>{v.passed ? 'PASSED' : 'BELOW THRESHOLD'}</Badge> : null}
      />
      {pending ? (
        <div className="t-well" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="t-row">
            <span className="t-spinner" style={{ color: 'var(--info)' }} />
            <span className="t-sm">
              {v?.status === 'running' ? `Reviewing ${docs} document${docs === 1 ? '' : 's'} · started ${utc(v.startedAt)} · typically under a minute` : 'Queued · the review starts within a minute of the request'}
            </span>
          </div>
          <div className="t-skel" style={{ height: '14px', width: '70%' }} /><div className="t-skel" style={{ height: '14px', width: '52%' }} /><div className="t-skel" style={{ height: '14px', width: '61%' }} />
        </div>
      ) : null}
      {v?.status === 'failed' ? (
        <Alert tone="danger" title="The review could not be posted">{v.error ?? 'Unknown error'}. It is retried automatically.</Alert>
      ) : null}
      {v && v.score != null ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: '24px' }}>
            <div className="t-metric" style={{ gap: '8px', alignItems: 'flex-start' }}>
              <span className="t-label">Review score</span>
              <span className="t-num-xl">{v.score}<span className="t-u">/ 100</span></span>
              {v.status !== 'posted' ? (
                <Badge word tone={v.status === 'failed' ? 't-warning' : 't-info'} pulse={v.status !== 'failed'}>{v.status === 'failed' ? 'Not posted yet' : 'Posting on-chain'} · threshold {v.threshold}</Badge>
              ) : (
                <Badge word tone={v.passed ? 't-success' : v.override ? 't-info' : 't-danger'}>
                  {v.passed ? `Passed · threshold ${v.threshold}` : v.override ? `Overridden${v.overrideBy ? ` by ${v.overrideBy}` : ''}` : `Below threshold ${v.threshold}`}
                </Badge>
              )}
              {v.finishedAt ? <span className="t-cap">{utc(v.finishedAt)}</span> : null}
            </div>
            <div className="t-kv">
              {v.checks.map((c) => (
                <div key={c.key} className="t-kv-row">
                  <span className="t-kv-k">{c.label}</span>
                  <span className="t-kv-v t-row" style={{ gap: '8px', justifyContent: 'flex-end' }}>
                    <span className="t-mono-sm t-muted">{c.points}/{c.maxPoints}</span>
                    <span className={`t-badge t-badge-word ${c.tone}`}>{c.result}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="t-between t-wrap t-well" style={{ padding: '12px 16px' }}>
            <span className="t-sm t-sec">Review evidence</span>
            <span className="t-mono">{shortHash(v.dataHash)} · report.json</span>
            {v.reportId ? <a href={reportUrl(v.reportId)} target="_blank" rel="noreferrer" className="t-sm">Open report</a> : <span />}
          </div>
        </>
      ) : !open && !v ? <span className="t-sm t-sec">No review was posted before the request closed.</span> : null}
    </div>
  );
}

export function InspectionPanel({ d }: { d: MintRequestDetail }) {
  const i = d.inspection;
  const open = d.request.status === 'REQUESTED';
  const frozen = !!d.warehouse?.frozen;
  const badge: [string, string, boolean] = !i
    ? frozen && open ? ['ON HOLD', 't-warning', false] : open ? ['AWAITING INSPECTOR', 't-neutral', false] : ['NOT INSPECTED', 't-neutral', false]
    : ({ attested: ['ATTESTED', 't-success', false], sealed: ['SEALED · AWAITING SIGNATURE', 't-info', true], rejected: ['REJECTED', 't-danger', false], failed: ['FAILED', 't-danger', false] } as Record<string, [string, string, boolean]>)[i.status];
  const ok = i?.conditions.filter((c) => c.ok).length ?? 0;
  const report = resolveUri(i?.uri);
  return (
    <div className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <CardHead title="Inspection" sub="An independent inspector weighs, samples and seals the material on site." right={<Badge tone={badge[1]} pulse={badge[2]}>{badge[0]}</Badge>} />
      {!i ? (
        open ? (
          frozen ? (
            <Alert tone="warning" title={`Paused: ${d.warehouse?.name} is frozen`}>A mint inspection there cannot lead to a mint until the warehouse is unfrozen.</Alert>
          ) : (
            <div className="t-well t-sm t-sec">
              An inspector visits {d.warehouse?.name ?? 'the warehouse'} to weigh, count and sample the bundles and to seal them, normally within 2 days of the request.
              The attestation is signed from the inspector's own key.
            </div>
          )
        ) : <span className="t-sm t-sec">No inspection was recorded before the request closed.</span>
      ) : (
        <>
          <div className="t-metrics" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', rowGap: '16px' }}>
            <div className="t-metric" style={{ gap: '4px' }}>
              <span className="t-label">Inspector</span>
              <span className="t-sm" style={{ fontWeight: '500' }}>{i.organisation ?? shortAddress(i.inspector)}</span>
              <span className="t-cap">{[i.inspectorName, i.licence ? `licence ${i.licence}` : null].filter(Boolean).join(' · ') || shortAddress(i.inspector)}</span>
            </div>
            <div className="t-metric" style={{ gap: '4px' }}>
              <span className="t-label">Inspected</span>
              <span className="t-num">{utc(i.inspectedAt)}</span>
              <span className="t-cap">{i.attestedAt ? `Attested ${utc(i.attestedAt)}` : i.status === 'sealed' ? 'Sealed, not signed yet' : `Recorded ${utc(i.createdAt)}`}</span>
            </div>
            <div className="t-metric" style={{ gap: '4px' }}>
              <span className="t-label">Measured quantity</span>
              <span className="t-num">{i.measuredKg != null ? `${t3(i.measuredKg)} t` : '—'}</span>
              <span className="t-cap">
                Declared {t3(i.declaredKg)} t{i.variancePct != null ? ` · ${Math.abs(i.variancePct) <= 0.5 ? 'within' : 'variance'} ${i.variancePct >= 0 ? '+' : ''}${i.variancePct.toFixed(2)}%` : ''}
              </span>
            </div>
          </div>
          <div className="t-kv">
            {i.bundlesCounted != null ? <Kv k="Bundles counted">{i.bundlesCounted}{i.bundlesDeclared != null ? ` of ${i.bundlesDeclared}` : ''}</Kv> : null}
            {i.assayPct != null ? <Kv k="Assay sample">{i.assayElement ?? ''} {i.assayPct}%</Kv> : null}
            {i.seals ? <Kv k="Seals applied" mono>{i.seals}</Kv> : null}
            {i.conditions.length ? (
              <Kv k="Condition">
                {ok} of {i.conditions.length} checks passed
                {ok < i.conditions.length ? <span className="t-fg-warning"> · {i.conditions.filter((c) => !c.ok).map((c) => c.label.toLowerCase()).join(', ')}</span> : null}
              </Kv>
            ) : null}
            {i.reason ? <Kv k="Reason"><span className="t-fg-danger">{i.reason}</span></Kv> : null}
            {i.notes ? <Kv k="Notes">{i.notes}</Kv> : null}
            <Kv k="Inspection evidence">
              <span className="t-mono">{shortHash(i.dataHash)}</span> · {i.files.length} file{i.files.length === 1 ? '' : 's'}
              {report ? <> · <a href={report} target="_blank" rel="noreferrer">report</a></> : null}
            </Kv>
          </div>
        </>
      )}
    </div>
  );
}

export function CustodyPanel({ d }: { d: MintRequestDetail }) {
  const { chain } = useSession();
  const c = d.custody;
  const w = d.warehouse;
  const badge: Record<string, [string, string, boolean]> = {
    confirmed: ['CONFIRMED', 't-success', false], queued: ['CONFIRMING', 't-info', true], failed: ['FAILED', 't-danger', false], waiting: ['WAITING', 't-neutral', false],
  };
  const [label, tone, pulse] = badge[c.status];
  return (
    <div className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <CardHead title="Warehouse custody" sub="The operator confirms the sealed material is held for Tensile and will only be released against a redemption." right={<Badge tone={tone} pulse={pulse}>{label}</Badge>} />
      {c.status === 'failed' ? <Alert tone="danger" title="Custody could not be confirmed">{c.error ?? 'Unknown error'}. It is retried automatically.</Alert> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '20px' }}>
        <div className="t-kv">
          <Kv k="Warehouse operator">{c.operatorName ?? w?.operatorName ?? '—'}</Kv>
          <Kv k="Warehouse">{c.warehouseName ?? w?.name ?? '—'} · <span className="t-mono">{c.warehouseCode ?? w?.code ?? '—'}</span></Kv>
          <Kv k="Warehouse receipt" mono>{c.receiptNo ?? d.draft?.receiptNo ?? '—'}</Kv>
          <Kv k="Seals" mono>{c.seals ?? d.inspection?.seals ?? '—'}</Kv>
          <Kv k="Custody confirmed">
            {c.status === 'confirmed' ? `${utc(c.at)}${c.by ? ` by ${shortAddress(c.by)}` : ''}` : c.status === 'queued' ? 'Being confirmed…' : 'After the inspection is attested'}
          </Kv>
          <Kv k="Proof">
            {c.dataHash ? (
              <><span className="t-mono">{shortHash(c.dataHash)}</span> · {c.txHash && chain.explorerUrl ? <a href={txUrl(chain.explorerUrl, c.txHash)} target="_blank" rel="noreferrer">signed receipt</a> : c.reportId ? <a href={reportUrl(c.reportId)} target="_blank" rel="noreferrer">signed receipt</a> : 'signed receipt'}</>
            ) : '—'}
          </Kv>
        </div>
        <div className="t-schem">
          <span style={{ position: 'absolute', left: '55%', top: '42%', width: '12px', height: '12px', borderRadius: '999px', background: c.status === 'confirmed' ? 'var(--brand)' : 'var(--text-disabled)', boxShadow: '0 0 0 6px var(--brand-subtle)' }} />
          <span className="t-mono-sm t-muted" style={{ position: 'absolute', left: '10px', bottom: '8px', fontWeight: '400' }}>{coords(w?.lat, w?.lon).replace(' N ', ' N · ').replace(' S ', ' S · ')}</span>
          <span className="t-mono-sm" style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--steel)' }}>{w?.code ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}

export function ReservePanel({ d }: { d: MintRequestDetail }) {
  const r = d.reserve;
  const status = d.request.status;
  const name = d.warehouse?.name ?? 'The warehouse';
  if (!r) {
    return (
      <div className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <CardHead title="Reserve confirmation" sub="A lot can only be minted if the warehouse's attested reserve covers everything already tokenized plus this lot." right={status === 'FINALIZED' ? <Badge tone="t-success">COVERED</Badge> : null} />
        {status === 'FINALIZED' ? (
          <Alert tone="success" title="Covered at mint">
            The reserve covered this lot when the passport was minted.{d.warehouse?.coverage != null ? ` ${name} is ${pct(d.warehouse.coverage)} covered now.` : ''}
          </Alert>
        ) : status === 'REQUESTED' ? (
          <span className="t-sm t-sec">The reserve could not be read right now. It is checked again on the next refresh.</span>
        ) : <span className="t-sm t-sec">Not checked: the request is {status.toLowerCase()}.</span>}
      </div>
    );
  }
  const total = r.outstandingKg + r.newKg;
  const scale = Math.max(r.reserveKg, total, 1) * 1.05;
  const w = (kg: number) => `${((kg / scale) * 100).toFixed(2)}%`;
  const ok = r.canAdd;
  const room = Math.max(0, r.reserveKg - r.outstandingKg);
  return (
    <div className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <CardHead title="Reserve confirmation" sub="A lot can only be minted if the warehouse's attested reserve covers everything already tokenized plus this lot." right={<Badge tone={ok ? 't-success' : 't-danger'}>{ok ? 'COVERED' : 'NOT COVERED'}</Badge>} />
      <div className="t-metrics" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', rowGap: '16px' }}>
        <div className="t-metric" style={{ gap: '4px' }}><span className="t-label">Warehouse reserve</span><span className="t-num-md">{r.reserveKg.toLocaleString('en-US')}<span className="t-u">kg</span></span></div>
        <div className="t-metric" style={{ gap: '4px' }}><span className="t-label">Tokenized outstanding</span><span className="t-num-md">{r.outstandingKg.toLocaleString('en-US')}<span className="t-u">kg</span></span></div>
        <div className="t-metric" style={{ gap: '4px' }}><span className="t-label">New lot</span><span className="t-num-md">+{r.newKg.toLocaleString('en-US')}<span className="t-u">kg</span></span></div>
        <div className="t-metric" style={{ gap: '4px', borderColor: ok ? 'var(--success-border)' : 'var(--danger-border)' }}>
          <span className="t-label">Coverage after mint</span>
          <span className={`t-num-md ${ok ? 't-fg-success' : 't-fg-danger'}`}>{r.coverageAfter != null ? pct(r.coverageAfter) : '—'}</span>
        </div>
      </div>
      <div className="t-stack" style={{ gap: '8px', paddingBottom: '16px' }}>
        <div className="t-meter" style={{ height: '14px' }}>
          <div className="t-meter-fill" style={{ width: w(r.outstandingKg), background: 'var(--data-1)' }} />
          <div className="t-meter-proj" style={{ left: w(r.outstandingKg), width: w(r.newKg) }} />
          <span className="t-mark" style={{ left: w(r.reserveKg) }} />
          <span className="t-mark-label" style={{ left: w(r.reserveKg), color: 'var(--text)' }}>Reserve</span>
        </div>
      </div>
      <div className="t-row t-cap" style={{ gap: '20px', flexWrap: 'wrap' }}>
        <span className="t-row" style={{ gap: '6px' }}><span style={{ width: '10px', height: '10px', background: 'var(--data-1)' }} />Outstanding</span>
        <span className="t-row" style={{ gap: '6px' }}><span style={{ width: '10px', height: '10px', background: 'var(--data-2)' }} />This lot</span>
        <span>Feed: {r.frozen ? 'frozen' : r.fresh ? 'fresh' : 'stale'} · attested {utc(r.reportedAt)}{r.operatorName ? ` by ${r.operatorName}` : ''}</span>
      </div>
      {ok ? (
        <Alert tone="success" title="Healthy · reserve covers this lot">
          After minting, {name} will be {r.coverageAfter != null ? pct(r.coverageAfter) : '—'} covered.
        </Alert>
      ) : (
        <Alert tone="danger" title="Mint unavailable: warehouse reserve does not cover the additional material.">
          {r.frozen ? `${name} is frozen. ` : !r.fresh ? 'The reserve feed is stale. ' : ''}
          Attested reserve is {r.reserveKg.toLocaleString('en-US')} kg; outstanding plus this lot would be {total.toLocaleString('en-US')} kg
          {r.coverageAfter != null ? ` (${pct(r.coverageAfter)})` : ''}. Ask {r.operatorName ?? 'the operator'} to post an updated reserve attestation
          {room >= 5000 ? `, or cancel and submit a lot of up to ${tonnes(room)} t` : ''}.
        </Alert>
      )}
    </div>
  );
}

export function PassportPanel({ d }: { d: MintRequestDetail }) {
  const { chain } = useSession();
  const tokenId = d.request.tokenId ?? undefined;
  const lot = useLot(tokenId).data;
  const issued = d.history.find((h) => h.title === 'Passport issued');
  const passport = chain.addresses.MaterialPassport;
  const v = d.review;
  const i = d.inspection;
  const owner = lot?.ownerName ?? d.ownerName ?? shortAddress(d.request.owner);
  const display = lot?.displayId ?? `Lot ${tokenId ?? '—'}`;
  const prov: [string, string, string][] = [
    ['VERIFIED', 'Certificate', d.draft?.certificateId ?? shortHash(d.request.certHash)],
    [v?.override ? 'OVERRIDDEN' : v?.score != null ? `${v.score} / 100` : '—', 'Automated review', v?.finishedAt ? utc(v.finishedAt).slice(0, 16) : '—'],
    ['ATTESTED', 'Inspection', i?.organisation ?? (i ? shortAddress(i.inspector) : '—')],
    ['CONFIRMED', 'Custody', d.custody.operatorName ?? '—'],
    [lot?.warehouse?.coverage != null ? pct(lot.warehouse.coverage) : 'COVERED', 'Reserve', d.warehouse?.code ?? '—'],
  ];
  return (
    <>
      <Alert tone="success" title="Passport issued · mint request FINALIZED">
        {display} was minted to {owner}{issued?.at ? ` at ${utc(issued.at)}` : ''}
        {issued?.txHash ? <> in transaction <a href={txUrl(chain.explorerUrl, issued.txHash)} target="_blank" rel="noreferrer" className="t-mono">{shortHash(issued.txHash)}</a></> : null}.
      </Alert>
      <article className="t-plate" style={{ padding: '48px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <span className="t-reg t-reg-tl" /><span className="t-reg t-reg-tr" /><span className="t-reg t-reg-bl" /><span className="t-reg t-reg-br" />
        <div className="t-between t-wrap" style={{ alignItems: 'flex-start' }}>
          <div className="t-row" style={{ gap: '14px' }}>
            <img src="/design-assets/f7ab157752a5014c52926e68ee69f6c6.png" alt="" style={{ width: '40px', height: '39px' }} />
            <div className="t-stack"><span className="t-wordmark" style={{ fontSize: '13px' }}>TENSILE</span><span className="t-eyebrow" style={{ color: 'var(--steel)' }}>Material passport</span></div>
          </div>
          <div className="t-stack" style={{ alignItems: 'flex-end', gap: '6px' }}>
            <Badge tone={lot?.state === 'FREE' || !lot ? 't-success' : lot.state === 'BURNED' ? 't-neutral' : 't-info'}>{lot?.state ?? 'FREE'}</Badge>
            <span className="t-mono-sm" style={{ color: 'var(--steel)' }}>SERIAL {String(tokenId ?? 0).padStart(6, '0')} · ISSUED {(lot?.mintedAt ?? issued?.at ?? '').slice(0, 10) || '—'}</span>
          </div>
        </div>
        <div className="t-stack" style={{ gap: '8px' }}>
          <span className="t-mono" style={{ color: 'var(--steel)', fontSize: '15px' }}>{display}</span>
          <span className="t-display" style={{ fontSize: '44px', lineHeight: '50px' }}>{lot?.materialName ?? d.materialName ?? 'Material lot'}</span>
          <span className="t-num-lg">{t3(d.request.quantityKg)}<span className="t-u">t</span> <span className="t-sec" style={{ fontSize: '18px' }}>· indicative {usd(lot?.valueUsd ?? d.indicativeValueUsd)}</span></span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
          <div className="t-spec"><span className="t-spec-k">Material code</span><span className="t-spec-v t-mono">{d.request.material ?? '—'}</span></div>
          <div className="t-spec"><span className="t-spec-k">Warehouse</span><span className="t-spec-v">{d.warehouse?.name ?? '—'}</span></div>
          <div className="t-spec"><span className="t-spec-k">Region</span><span className="t-spec-v">{[d.warehouse?.region, d.warehouse?.country].filter(Boolean).join(' · ') || '—'}</span></div>
          <div className="t-spec"><span className="t-spec-k">Certificate</span><span className="t-spec-v t-mono" style={{ fontSize: '12px' }}>{d.draft?.certificateId ?? '—'}</span></div>
          <div className="t-spec"><span className="t-spec-k">Current owner</span><span className="t-spec-v">{owner}</span></div>
          <div className="t-spec"><span className="t-spec-k">Owner address</span><span className="t-spec-v t-mono">{shortAddress(lot?.owner ?? d.request.owner)}</span></div>
          <div className="t-spec"><span className="t-spec-k">Seals</span><span className="t-spec-v t-mono" style={{ fontSize: '12px' }}>{i?.seals ?? '—'}</span></div>
          <div className="t-spec"><span className="t-spec-k">Reserve coverage</span><span className="t-spec-v">{lot?.warehouse?.coverage != null ? pct(lot.warehouse.coverage) : '—'}</span></div>
        </div>
        <div className="t-stack" style={{ gap: '12px' }}>
          <span className="t-spec-k">Provenance</span>
          <div className="t-hflow">
            {prov.map(([s, t, a], n) => (
              <div key={t} style={{ display: 'contents' }}>
                <div className="t-hflow-node" style={{ background: 'rgba(1,22,22,.82)', flexBasis: '96px' }}>
                  <span className="t-mono-sm t-fg-success">{s}</span>
                  <div className="t-sm" style={{ fontWeight: '500' }}>{t}</div>
                  <div className="t-cap">{a}</div>
                </div>
                {n < prov.length - 1 ? <div className="t-hflow-arrow" aria-hidden="true">→</div> : null}
              </div>
            ))}
          </div>
        </div>
        <div className="t-between t-wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <span className="t-mono-sm" style={{ color: 'var(--steel)' }}>MINT TX {shortHash(issued?.txHash)} · CONTRACT {shortHash(passport)}</span>
          <div className="t-row">
            <a href={`/lots/${tokenId}`} className="t-btn t-btn-secondary">Open lot</a>
            <a href={`/borrow?lot=${tokenId}`} className="t-btn t-btn-primary">Borrow against this lot</a>
          </div>
        </div>
      </article>
    </>
  );
}
