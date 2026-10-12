/* Material passport for one lot (/lots/:tokenId). Built from LotPassport.dc.html (same markup and classes),
 * fed by /lots/{id}: provenance, attestations, reserve health and history. Loan figures fill in with credit. */
import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { ApiError } from '../lib/api';
import { ago, coords, int, money, moneyParts, pct, tonnes, utc } from '../lib/format';
import type { AttestationOut, LotDetailOut } from '../lib/types';
import { shortAddress } from '../lib/web3';
import Sidebar from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import { useLot, useMyLots } from '../state/account';
import { useNow } from '../state/protocol';
import { useSession } from '../state/session';
import Orb from './Orb';
import './LotPassport.css';

const KIND: Record<AttestationOut['kind'], [label: string, state: (a: AttestationOut) => string]> = {
  AI_REVIEW: ['Automated review', (a) => `${a.score} / 100`],
  INSPECTION: ['Inspection', () => 'ATTESTED'],
  REINSPECTION: ['Reinspection', () => 'ATTESTED'],
  CUSTODY: ['Custody evidence', () => 'CONFIRMED'],
  RELEASE: ['Release proof', () => 'RELEASED'],
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function exportRecord(lot: LotDetailOut) {
  const blob = new Blob([JSON.stringify(lot, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${lot.displayId}-provenance.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

function Shell({ crumb, children }: { crumb: string; children: ReactNode }) {
  return (
    <div className="t-app">
      <div style={{ flex: '0 0 248px', display: 'flex', background: 'var(--bg-sunken)' }}>
        <Sidebar active="lots" role="owner" />
      </div>
      <div className="t-main">
        <TopBar section="Lots" crumb={crumb} />
        <main className="t-content">{children}</main>
      </div>
    </div>
  );
}

function Empty({ title, body, cta }: { title: string; body: string; cta?: [string, string] }) {
  return (
    <div className="t-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '48px', textAlign: 'center' }}>
      <span className="t-h4">{title}</span>
      <span className="t-sm t-sec" style={{ maxWidth: '520px' }}>{body}</span>
      {cta ? <a href={cta[1]} className="t-btn t-btn-primary" style={{ marginTop: '8px' }}>{cta[0]}</a> : null}
    </div>
  );
}

/** /lots: the signed-in owner's newest lot, or an empty state. */
export function LotsIndex() {
  const { signedIn } = useSession();
  const lots = useMyLots();
  const first = lots.data?.lots[0];
  if (first) return <Navigate to={`/lots/${first.tokenId}`} replace />;
  return (
    <Shell crumb="Your lots">
      <Empty
        title={!signedIn ? 'Sign in to see your lots' : lots.isLoading ? 'Loading your lots…' : 'No lots yet'}
        body={signedIn ? 'A lot is a passport for metal in bonded custody. Tokenize material you hold in a Tensile warehouse to get your first one, or search a lot ID above.' : 'Connect and sign in, or search any lot ID with the search box above.'}
        cta={signedIn && !lots.isLoading ? ['Tokenize material', '/tokenize'] : undefined}
      />
    </Shell>
  );
}

export default function LotPassport() {
  const { tokenId } = useParams();
  const id = Number(tokenId);
  const { address, chain } = useSession();
  const now = useNow(30_000);
  const q = useLot(Number.isFinite(id) && id > 0 ? id : undefined);
  const lot = q.data;

  if (!lot) {
    const missing = q.error instanceof ApiError && q.error.status === 404;
    return (
      <Shell crumb={tokenId ?? ''}>
        <Empty
          title={missing ? 'No such lot' : q.isError ? 'Could not load this lot' : 'Loading passport…'}
          body={missing ? `There is no lot ${tokenId} on ${chain.name}. Lots are numbered per network: check the network switch above.` : q.isError ? (q.error as Error).message : ''}
        />
      </Shell>
    );
  }

  const w = lot.warehouse;
  const mine = !!address && lot.owner.toLowerCase() === address.toLowerCase();
  const redeeming = lot.state === 'REDEEMING';
  const burned = lot.state === 'BURNED';
  const ownerName = lot.ownerName ?? shortAddress(lot.owner);
  const [family, grade] = (lot.materialName ?? 'Material lot').split(', ');
  const att = (kind: AttestationOut['kind']) => [...lot.attestations].reverse().find((a) => a.kind === kind);
  const ai = att('AI_REVIEW'), insp = att('REINSPECTION') ?? att('INSPECTION'), custody = att('CUSTODY');
  const coverage = w?.coverage ?? null;
  const reserveBadge = !w ? ['Reserve unknown', 't-neutral'] : w.frozen ? ['Warehouse frozen', 't-danger'] : !w.fresh ? ['Reserve feed stale', 't-warning'] : w.healthy ? ['Reserve healthy', 't-success'] : ['Reserve short', 't-danger'];
  const scale = Math.max(w?.reserveKg ?? 0, w?.outstandingKg ?? 0) * 1.1 || 1;
  const owned = [...lot.history].reverse().find((h) => h.title === 'Lot transferred' || h.title === 'Lot minted');
  const passport = chain.addresses.MaterialPassport;
  const explorer = chain.explorerUrl;
  const [valueWhole, valueFrac] = moneyParts(lot.valueUsd ?? 0);

  const verif = [
    { k: 'Certificate', state: lot.certHash ? 'RECORDED' : 'MISSING', tone: lot.certHash ? 't-success' : 't-neutral', who: `Hash ${shortAddress(lot.certHash)}`, when: utc(lot.request?.createdAt ?? lot.mintedAt), ev: lot.evidenceUri ?? '—', href: undefined as string | undefined },
    ...lot.attestations.map((a) => ({
      k: KIND[a.kind][0], state: KIND[a.kind][1](a), tone: 't-success',
      who: a.attestorName ?? shortAddress(a.attestor), when: utc(a.at), ev: shortAddress(a.dataHash),
      href: a.txHash && explorer ? `${explorer}/tx/${a.txHash}` : undefined,
    })),
  ];
  const current = [lot.certHash, ai, insp, custody, w?.healthy].filter(Boolean).length;
  const enc = [
    ['FREE', 'No lien. Can be sold, transferred, pledged or redeemed.', 'success', lot.state === 'FREE'],
    ['PLEDGED', 'Collateral for a loan. Sale pays the loan off atomically.', 'info', false],
    ['REDEEMING', 'Physical release pending. Locked until released.', 'info', redeeming],
  ] as const;
  const encCopy = burned
    ? 'Redeemed: the warehouse released the material and the passport was burned. Its history is kept.'
    : redeeming
      ? 'Locked for physical release. When the warehouse posts release proof, the passport is burned and its history kept.'
      : 'Free of any lien. The owner can borrow, sell, transfer to a verified address or redeem.';
  const life = lot.history.map((h, i, a) => ({
    t: h.title, d: [h.ref, h.amount].filter(Boolean).join(' · '), actor: h.actor ?? '—', at: utc(h.at),
    node: h.title === 'Lot minted' || h.title === 'Passport issued' ? 't-node-brand' : 't-node-done', line: i < a.length - 1,
  }));

  return (
    <Shell crumb={lot.displayId}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="t-between t-wrap" style={{ alignItems: 'flex-start' }}>
          <div className="t-stack" style={{ gap: '8px' }}>
            <div className="t-row t-wrap" style={{ gap: '8px' }}>
              <span className="t-eyebrow">Material lot</span>
              <span className={`t-badge ${burned ? 't-burned' : redeeming ? 't-info' : 't-success'}`}>
                <span className={`t-dot ${redeeming ? 't-pulse' : ''}`} />
                {lot.state}
              </span>
              <span className={`t-badge t-badge-word ${reserveBadge[1]}`}><span className="t-dot" />{reserveBadge[0]}</span>
            </div>
            <h1 className="t-h1"><span className="t-mono" style={{ fontSize: '32px', lineHeight: '44px' }}>{lot.displayId}</span></h1>
            <span className="t-body t-sec">
              {lot.materialName ?? 'Material lot'} · {lot.warehouseName ?? `Warehouse ${lot.warehouseId}`} · owned by {mine ? 'you' : ownerName} · last attestation {utc(lot.lastAttestedAt)}
            </span>
          </div>
          <button className="t-btn t-btn-sm t-btn-secondary" onClick={() => exportRecord(lot)}>Export provenance record</button>
        </div>
        <div className="t-metrics" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', padding: '8px 0 4px' }}>
          <div className="t-metric">
            <span className="t-label">Quantity</span>
            <span className="t-num-lg t-lum">{tonnes(lot.quantityKg)}<span className="t-u">t</span></span>
            <span className="t-cap">{int(lot.quantityKg)} kg on the passport</span>
          </div>
          <div className="t-metric">
            <span className="t-label">Current value</span>
            <span className="t-num-lg t-lum">{lot.valueUsd != null ? <>${valueWhole}<span className="t-f">{valueFrac}</span></> : '—'}</span>
            <span className="t-cap">{lot.priceUsdPerTonne != null ? `$${money(lot.priceUsdPerTonne)} / t reference${lot.haircutBps ? ` · ${pct(lot.haircutBps / 10_000)} haircut` : ''}` : 'No reference price yet'}</span>
          </div>
          <div className="t-metric">
            <span className="t-label">Owner</span>
            <span className="t-num-md" style={{ lineHeight: '32px' }}>{mine ? `${ownerName} (you)` : ownerName}</span>
            <span className="t-mono-sm t-muted">{shortAddress(lot.owner)}</span>
          </div>
          <div className="t-metric">
            <span className="t-label">Current debt</span>
            <span className="t-num-lg">0.00 USDC</span>
            <span className="t-cap">No active loan</span>
          </div>
        </div>
        {burned ? null : mine ? (
          <div className="t-row t-wrap" style={{ gap: '12px' }}>
            {!redeeming ? <a href={`/borrow?lot=${lot.tokenId}`} className="t-btn t-btn-primary">Borrow up to {money(lot.maxBorrowUsdc ?? 0)} USDC</a> : null}
            {!redeeming ? <a href={`/marketplace?list=${lot.tokenId}`} className="t-btn t-btn-secondary">List for sale</a> : null}
            {!redeeming ? <a href={`/redemptions?lot=${lot.tokenId}`} className="t-btn t-btn-secondary">Request redemption</a> : null}
            <button className="t-btn t-btn-secondary" disabled>Transfer</button>
            <span className="t-reason">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: 'none', marginTop: '2px' }}><path d="M12 3a9 9 0 100 18 9 9 0 100-18zM12 8v5M12 16v.5" /></svg>
              {redeeming ? 'Transfer unavailable: this lot is redeeming. Physical release is pending.' : 'Transfers go through the marketplace so the buyer is verified.'}
            </span>
          </div>
        ) : (
          <div className="t-row t-wrap" style={{ gap: '12px' }}>
            {!redeeming ? <a href={`/marketplace/rfq?lot=${lot.tokenId}`} className="t-btn t-btn-secondary">Place a bid</a> : null}
            <span className="t-reason">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: 'none', marginTop: '2px' }}><path d="M12 3a9 9 0 100 18 9 9 0 100-18zM12 8v5M12 16v.5" /></svg>
              Only the owner can borrow against, sell or redeem this lot.
            </span>
          </div>
        )}
        {redeeming ? (
          <div className="t-alert t-info">
            <span className="t-dot t-pulse" style={{ color: 'var(--info)', marginTop: '7px' }} />
            <div>
              <p className="t-alert-title">REDEEMING</p>
              <p className="t-alert-body">This lot cannot be transferred while physical release is pending. {w?.operatorName ?? 'The warehouse'} must release the material and post proof.</p>
            </div>
            <Link to="/redemptions" className="t-btn t-btn-sm t-btn-secondary" style={{ marginLeft: 'auto' }}>Track release</Link>
          </div>
        ) : null}
        {burned ? (
          <div className="t-alert t-neutral">
            <span className="t-dot" style={{ marginTop: '7px' }} />
            <div><p className="t-alert-title">Redeemed and burned</p><p className="t-alert-body">The material was released from custody and this passport burned. Its full history stays on the ledger.</p></div>
          </div>
        ) : null}
      </header>

      <article className="t-plate" style={{ display: 'flex', flexDirection: 'column', gap: '32px', margin: '4px 8px' }}>
        <span className="t-reg t-reg-tl" />
        <span className="t-reg t-reg-tr" />
        <span className="t-reg t-reg-bl" />
        <span className="t-reg t-reg-br" />
        <div className="t-between t-wrap" style={{ alignItems: 'flex-start' }}>
          <div className="t-row" style={{ gap: '14px' }}>
            <img src="/design-assets/f7ab157752a5014c52926e68ee69f6c6.png" alt="" style={{ width: '34px', height: '33px', filter: 'drop-shadow(0 0 12px rgba(215,252,253,.35))' }} />
            <div className="t-stack">
              <span className="t-eyebrow" style={{ color: 'var(--steel)' }}>Material passport</span>
              <span className="t-mono-sm" style={{ color: 'var(--steel)', fontWeight: '400' }}>
                SERIAL {String(lot.tokenId).padStart(6, '0')} · ISSUED {lot.mintedAt?.slice(0, 10) ?? '—'} · CONTRACT {shortAddress(passport)}
              </span>
            </div>
          </div>
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" style={{ flex: 'none', opacity: '.9' }}>
            <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(159,179,181,.45)" strokeWidth="1" />
            <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(159,179,181,.25)" strokeWidth="1" strokeDasharray="1.5 3" />
            <circle cx="32" cy="32" r="15" fill="rgba(215,252,253,.06)" stroke="rgba(215,252,253,.5)" strokeWidth="1" />
            <path d="M25 32l5 5 9-10" fill="none" stroke="#d7fcfd" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="t-stack" style={{ gap: '6px' }}>
          <span className="t-mono" style={{ color: 'var(--steel)', fontSize: '14px', letterSpacing: '.06em' }}>{lot.displayId} · {lot.material ?? shortAddress(lot.materialCode)}</span>
          <span className="t-display" style={{ fontSize: '44px', lineHeight: '50px' }}>{lot.materialName ?? 'Material lot'}</span>
          <span className="t-num-lg t-lum">
            {tonnes(lot.quantityKg)}<span className="t-u">t</span>
            <span className="t-sec" style={{ fontSize: '17px', textShadow: 'none' }}> · {lot.warehouseName ?? `Warehouse ${lot.warehouseId}`} · held for {ownerName}</span>
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '40px', alignItems: 'stretch' }}>
          <div className="t-stack" style={{ gap: '16px' }}>
            <span className="t-spec-k" style={{ opacity: '.8' }}>Physical identity</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '22px 20px' }}>
              {[
                ['Material', family],
                ['Grade / class', grade ?? '—'],
                ['Material code', lot.material ?? '—', true],
                ['Quantity', `${tonnes(lot.quantityKg)} t net`],
                ['Mint request', lot.request?.displayId ?? '—', true],
                ['Certificate', shortAddress(lot.certHash), true],
                ['Warehouse', lot.warehouseName ?? '—'],
                ['Operator', w?.operatorName ?? shortAddress(w?.operator)],
                ['Region', w?.place ?? lot.region ?? '—'],
              ].map(([k, v, mono]) => (
                <div key={k as string} className="t-spec">
                  <span className="t-spec-k">{k}</span>
                  <span className={`t-spec-v ${mono ? 't-mono' : ''}`} style={mono ? { fontSize: '12px' } : undefined}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="t-stack" style={{ gap: '16px' }}>
            <span className="t-spec-k" style={{ opacity: '.8' }}>Location</span>
            <div className="t-schem" style={{ height: '100%', minHeight: '190px' }}>
              <svg viewBox="0 0 300 200" preserveAspectRatio="none" style={{ position: 'absolute', inset: '0', width: '100%', height: '100%' }} aria-hidden="true">
                <path d="M20 40h120v60H20zM160 40h120v60H160zM20 120h260v60H20z" fill="none" stroke="var(--steel)" strokeOpacity=".4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <path d="M200 70h30" stroke="var(--brand)" strokeWidth="6" strokeLinecap="round" />
              </svg>
              <span style={{ position: 'absolute', left: '70%', top: '32%', width: '40px', height: '40px', borderRadius: '999px', background: 'radial-gradient(circle, rgba(215,252,253,.35), transparent 70%)' }} />
              <span className="t-mono-sm" style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--steel)' }}>{lot.warehouseCode ?? `WH-${lot.warehouseId}`}</span>
              <span className="t-mono-sm" style={{ position: 'absolute', left: '168px', top: '108px', color: 'var(--steel)' }}>BONDED CUSTODY</span>
              <span className="t-mono-sm t-muted" style={{ position: 'absolute', right: '14px', bottom: '12px', fontWeight: '400' }}>{coords(w?.lat, w?.lon).replace(' N ', ' N · ').replace(' S ', ' S · ')}</span>
            </div>
          </div>
        </div>
        <div className="t-hr" />
        <div className="t-between t-wrap">
          <div className="t-row t-wrap" style={{ gap: '8px' }}>
            {[
              ['Certificate', !!lot.certHash],
              [ai ? `Review ${ai.score}` : 'Review', !!ai],
              ['Inspected', !!insp],
              ['Custody', !!custody],
              [coverage != null ? `Reserve ${pct(coverage)}` : 'Reserve', !!w?.healthy],
            ].map(([label, ok]) => (
              <span key={label as string} className={`t-badge t-badge-word ${ok ? 't-success' : 't-neutral'}`}><span className="t-dot" />{label}</span>
            ))}
          </div>
          <span className="t-mono-sm" style={{ color: 'var(--steel)', fontWeight: '400', letterSpacing: '.18em' }}>
            {lot.displayId.replace(/-/g, '·')}·{lot.warehouseCode ?? lot.warehouseId}·{shortAddress(lot.certHash)}
          </span>
        </div>
      </article>

      <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '32px', padding: '8px 8px 0' }}>
        <div className="t-stack" style={{ gap: '10px', flex: '1 1 260px', maxWidth: '360px' }}>
          <span className="t-eyebrow">Provenance</span>
          <span className="t-h2">Metal, location, passport</span>
          <span className="t-sm t-sec">
            {redeeming
              ? `Redemption has begun. The globe turns attention from the passport back to the metal in ${lot.warehouseName}.`
              : `The line runs from ${tonnes(lot.quantityKg)} t of ${family.toLowerCase()} in ${w?.place?.split(' · ').pop() ?? lot.warehouseName}, through Tensile’s verification, to this passport.`}
          </span>
        </div>
        <div className="t-parallax">
          <Orb mode={redeeming ? 'redeem' : 'lot'} focus={lot.warehouseCode ?? ''} phase={redeeming ? 1 : 0} lot={lot.displayId} w={640} />
        </div>
      </section>

      <section className="t-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 1px minmax(0, 1fr)', gap: '32px', padding: '32px' }}>
        <div className="t-stack" style={{ gap: '12px' }}>
          <div className="t-between">
            <span className="t-h4">Verification</span>
            <span className={`t-badge t-badge-word ${current === 5 ? 't-success' : 't-warning'}`}><span className="t-dot" />{current} of 5 current</span>
          </div>
          {verif.map((v, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '4px 16px', padding: '12px 0', borderTop: '1px solid rgba(215,252,253,.045)' }}>
              <span className="t-sm" style={{ fontWeight: '500' }}>{v.k}</span>
              <span className={`t-badge ${v.tone}`} style={{ justifySelf: 'end' }}>{v.state}</span>
              <span className="t-cap">{v.who} · {v.when}</span>
              {v.href ? (
                <a href={v.href} target="_blank" rel="noreferrer" className="t-mono-sm" style={{ justifySelf: 'end', fontWeight: '400' }}>{v.ev}</a>
              ) : (
                <span className="t-mono-sm t-muted" style={{ justifySelf: 'end', fontWeight: '400' }}>{v.ev}</span>
              )}
            </div>
          ))}
        </div>
        <div style={{ background: 'linear-gradient(180deg, transparent, rgba(215,252,253,.09), transparent)' }} />
        <div className="t-stack" style={{ gap: '18px' }}>
          <div className="t-between">
            <span className="t-h4">Reserve health</span>
            <a href={`/reserve?wh=${lot.warehouseCode ?? lot.warehouseId}`} className="t-sm">Warehouse</a>
          </div>
          <div className="t-between" style={{ alignItems: 'flex-end' }}>
            <div className="t-stack" style={{ gap: '4px' }}>
              <span className="t-label">Coverage ratio</span>
              <span className={`t-num-xl ${w?.healthy ? 't-fg-success' : 't-fg-danger'}`} style={{ textShadow: w?.healthy ? '0 0 24px rgba(95,211,154,.35)' : 'none' }}>{coverage != null ? pct(coverage) : '—'}</span>
            </div>
            <span className={`t-badge t-badge-word ${reserveBadge[1]}`}><span className="t-dot" />{w?.healthy ? 'Healthy' : reserveBadge[0]}</span>
          </div>
          <div style={{ paddingBottom: '14px' }}>
            <div className="t-meter" style={{ height: '10px' }}>
              <div className="t-meter-fill" style={{ width: `${(((w?.outstandingKg ?? 0) / scale) * 100).toFixed(2)}%` }} />
              <span className="t-mark" style={{ left: `${(((w?.reserveKg ?? 0) / scale) * 100).toFixed(2)}%` }} />
              <span className="t-mark-label" style={{ left: `${(((w?.reserveKg ?? 0) / scale) * 100).toFixed(2)}%`, color: 'var(--text)' }}>Reserve {int(w?.reserveKg ?? 0)} kg</span>
            </div>
          </div>
          <div className="t-kv">
            <div className="t-kv-row"><span className="t-kv-k">Warehouse reserve</span><span className="t-kv-v">{int(w?.reserveKg ?? 0)} kg</span></div>
            <div className="t-kv-row"><span className="t-kv-k">Tokenized outstanding</span><span className="t-kv-v">{int(w?.outstandingKg ?? 0)} kg</span></div>
            <div className="t-kv-row"><span className="t-kv-k">Headroom</span><span className="t-kv-v">{int((w?.reserveKg ?? 0) - (w?.outstandingKg ?? 0))} kg</span></div>
            <div className="t-kv-row">
              <span className="t-kv-k">Feed freshness</span>
              <span className="t-kv-v"><span className={`t-badge t-badge-word ${w?.fresh ? 't-success' : 't-warning'}`}><span className="t-dot" />{w?.fresh ? 'Fresh' : 'Stale'} · {ago(w?.reportedAt, now)}</span></span>
            </div>
            <div className="t-kv-row"><span className="t-kv-k">Warehouse status</span><span className="t-kv-v">{w?.frozen ? `Frozen · ${w.frozenReason ?? 'reserve review'}` : w?.active ? 'Active · not frozen' : 'Inactive'}</span></div>
          </div>
        </div>
      </section>

      <section className="t-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 1px minmax(0, 1fr)', gap: '32px', padding: '32px' }}>
        <div className="t-stack" style={{ gap: '18px' }}>
          <div className="t-between">
            <span className="t-h4">Financial</span>
            <span className="t-cap">Reference price · {lot.region ?? '—'}</span>
          </div>
          <div className="t-metrics" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="t-metric"><span className="t-cap">Lot value</span><span className="t-num-md t-lum">{lot.valueUsd != null ? `$${money(lot.valueUsd)}` : '—'}</span></div>
            <div className="t-metric"><span className="t-cap">Price / t</span><span className="t-num-md">{lot.priceUsdPerTonne != null ? `$${money(lot.priceUsdPerTonne)}` : '—'}</span></div>
            <div className="t-metric"><span className="t-cap">Current debt</span><span className="t-num-md" style={{ color: 'var(--info-text)' }}>0.00 USDC</span></div>
          </div>
          <div style={{ paddingBottom: '16px' }}>
            <div className="t-between" style={{ paddingBottom: '10px' }}><span className="t-label">LTV</span><span className="t-num-md">0.00%</span></div>
            <div className="t-meter">
              <div className="t-meter-fill" style={{ width: '0%', background: 'linear-gradient(90deg, rgba(141,185,242,.6), var(--data-2))', boxShadow: '0 0 14px -2px rgba(141,185,242,.6)' }} />
              <span className="t-mark t-mark-warn" style={{ left: '65%' }} />
              <span className="t-mark-label" style={{ left: '65%' }}>Max 65%</span>
              <span className="t-mark t-mark-danger" style={{ left: '77%' }} />
              <span className="t-mark-label" style={{ left: '83%' }}>Liquidation 77%</span>
            </div>
          </div>
          <div className="t-kv">
            <div className="t-kv-row"><span className="t-kv-k">Borrowed (principal)</span><span className="t-kv-v">0.00 USDC</span></div>
            <div className="t-kv-row"><span className="t-kv-k">Maximum borrowing capacity</span><span className="t-kv-v">{lot.maxBorrowUsdc != null ? `${money(lot.maxBorrowUsdc)} USDC · 65.00% LTV` : '—'}</span></div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(180deg, transparent, rgba(215,252,253,.09), transparent)' }} />
        <div className="t-stack" style={{ gap: '20px' }}>
          <span className="t-h4">Ownership and encumbrance</span>
          <div className="t-between">
            <div className="t-row" style={{ gap: '12px' }}>
              <span className="t-avatar" style={{ width: '40px', height: '40px' }}>{lot.ownerName ? initials(lot.ownerName) : lot.owner.slice(2, 4).toUpperCase()}</span>
              <div className="t-stack">
                <span className="t-body" style={{ fontWeight: '500' }}>{ownerName}</span>
                <span className="t-mono-sm t-muted" style={{ fontWeight: '400' }}>Owner since {owned?.at?.slice(0, 10) ?? '—'} · {shortAddress(lot.owner)}</span>
              </div>
            </div>
            <span className="t-badge t-badge-word t-brand">{mine ? 'You' : 'Owner'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '4px', padding: '4px', borderRadius: '18px', background: 'rgba(0,10,11,.32)', boxShadow: 'inset 0 0 0 1px rgba(215,252,253,.06)' }}>
            {enc.map(([label, d, tone, on]) => (
              <div key={label} className="t-stack" style={{ gap: '4px', padding: '12px 14px', borderRadius: '14px', background: on ? `linear-gradient(180deg, var(--${tone}-subtle), rgba(215,252,253,.03))` : 'transparent', boxShadow: on ? `inset 0 1px 0 rgba(240,255,255,.14), inset 0 0 0 1px var(--${tone}-border), 0 8px 20px -10px var(--${tone}-border)` : 'none' }}>
                <span className="t-mono-sm" style={{ color: on ? `var(--${tone}-text)` : 'var(--text-muted)' }}>{label}</span>
                <span className="t-cap" style={{ color: on ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{d}</span>
              </div>
            ))}
          </div>
          <span className="t-sm t-sec">{encCopy}</span>
        </div>
      </section>

      <section className="t-card t-stack" style={{ gap: '24px', padding: '32px' }}>
        <div className="t-between t-wrap">
          <div className="t-stack" style={{ gap: '4px' }}>
            <span className="t-h3">Lifecycle</span>
            <span className="t-sm t-sec">Every event is signed by its actor and carries its evidence.</span>
          </div>
          <button className="t-btn t-btn-sm t-btn-secondary" onClick={() => exportRecord(lot)}>Export provenance record</button>
        </div>
        <div className="t-tl">
          {life.map((e, i) => (
            <div key={i} className="t-tl-item">
              <div className="t-tl-rail">
                <span className={`t-tl-node ${e.node}`} />
                {e.line ? <span className="t-tl-line" /> : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr) 220px 170px', gap: '16px', alignItems: 'baseline' }}>
                <span className="t-sm" style={{ fontWeight: '600' }}>{e.t}</span>
                <span className="t-sm t-sec">{e.d || '—'}</span>
                <span className="t-sm">{e.actor}</span>
                <span className="t-mono-sm t-muted t-right" style={{ fontWeight: '400' }}>{e.at}</span>
              </div>
            </div>
          ))}
          {!life.length ? <span className="t-cap">History appears as the indexer records this lot's events.</span> : null}
        </div>
      </section>
    </Shell>
  );
}
