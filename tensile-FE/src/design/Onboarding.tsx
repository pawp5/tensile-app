/* Identity verification (KYC). Built from Onboarding.dc.html; the design's markup and classes, driven by /kyc.
 *   /onboarding                   the signed-in wallet's own application
 *   /onboarding/review/:address   KYC staff review of one application (approve / reject)
 */
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '../lib/api';
import type { DocKind, EntityType, KycApplication, KycApplicationIn, KycRequirement } from '../lib/types';
import { shortAddress } from '../lib/web3';
import { WalletArea } from '../shell/TopBar';
import { openKycDocument, useKycActions, useKycApplication, useKycMe, useKycReview } from '../state/account';
import { errorMessage, useSession } from '../state/session';
import './Onboarding.css';

// ------------------------------------------------------------------ reference data

const COUNTRY_CODES =
  'AD AE AF AG AI AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FR GA GB GD GE GH GI GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NZ OM PA PE PG PH PK PL PR PS PT PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TW TZ UA UG US UY UZ VC VE VN VU WS YE ZA ZM ZW'.split(' ');
const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
const countryName = (code?: string | null) => (code ? regionNames?.of(code) ?? code : '—');
const COUNTRIES = COUNTRY_CODES.map((c) => [c, countryName(c)] as const).sort((a, b) => a[1].localeCompare(b[1]));

const ENTITY_TYPES: [EntityType, string][] = [['corporate', 'Corporate'], ['partnership', 'Partnership'], ['fund', 'Fund'], ['individual', 'Individual']];
const entityLabel = (e?: string | null) => ENTITY_TYPES.find(([k]) => k === e)?.[1] ?? '—';
const TIERS: [number, string, string, string][] = [
  [1, 'TIER 1', 'Lender', 'Deposit USDC into the credit vault and withdraw.'],
  [2, 'TIER 2', 'Institution', 'Own, tokenize, borrow, trade and redeem material lots.'],
  [3, 'TIER 3', 'Operator', 'Warehouse operators and inspectors who attest to custody.'],
];
const tierLabel = (t?: number | null) => (t ? `Tier ${t} · ${TIERS.find(([k]) => k === t)?.[2] ?? ''}` : 'Not assigned');
const DEFAULT_REQUIREMENTS: KycRequirement[] = [
  { key: 'wallet', title: 'Wallet ownership', detail: 'Sign in with your wallet', state: 'required' },
  { key: 'registration', title: 'Company registration', detail: 'Certificate of incorporation or equivalent', state: 'required' },
  { key: 'owners', title: 'Beneficial owners', detail: 'All owners above 25% identified', state: 'required' },
  { key: 'screening', title: 'Sanctions and PEP screening', detail: 'Runs automatically when you submit', state: 'required' },
  { key: 'directors', title: 'Register of directors', detail: 'Current register, dated within 12 months', state: 'required' },
];
const DOC_KINDS: DocKind[] = ['registration', 'owners', 'directors'];
const ICON = { ok: 'M5 12l5 5 9-10', wait: 'M12 7v5l3 2', todo: 'M8 12h8', bad: 'M7 7l10 10M17 7L7 17' };
const REQ_STATE: Record<KycRequirement['state'], [string, string, string, string, string, string]> = {
  complete: ['Complete', 't-success', ICON.ok, 'var(--success-subtle)', 'var(--success-text)', 'var(--success-border)'],
  in_review: ['In review', 't-info', ICON.wait, 'var(--info-subtle)', 'var(--info-text)', 'var(--info-border)'],
  required: ['Required', 't-neutral', ICON.todo, 'var(--neutral-subtle)', 'var(--neutral-text)', 'var(--neutral-border)'],
  failed: ['Failed', 't-danger', ICON.bad, 'var(--danger-subtle)', 'var(--danger-text)', 'var(--danger-border)'],
};
const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10) : '—');
const fmtTime = (iso?: string | null) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : '—');

type View = 'signin' | 'edit' | 'review' | 'attesting' | 'verified' | 'expired';
const STATUS: Record<string, [label: string, tone: string, pulse: string]> = {
  signin: ['NOT VERIFIED', 't-neutral', ''],
  edit: ['NOT VERIFIED', 't-neutral', ''],
  rejected: ['DECLINED', 't-danger', ''],
  review: ['PENDING', 't-info', 't-pulse'],
  attesting: ['APPROVED', 't-info', 't-pulse'],
  verified: ['VERIFIED', 't-success', ''],
  expired: ['EXPIRED', 't-danger', ''],
};

// ------------------------------------------------------------------ shared pieces

function Steps({ at }: { at: number }) {
  const steps = [['Connect wallet', 'Sign in with your wallet'], ['Organisation details', 'Entity, country, tier'], ['Review', 'Identity provider checks'], ['Attestation', 'Written on-chain, then you enter the app']];
  return (
    <div className="t-tl">
      {steps.map(([t, d], i) => (
        <div key={t} className="t-tl-item">
          <div className="t-tl-rail">
            <span className={`t-tl-node ${i < at ? 't-node-done' : i === at ? 't-node-active' : ''}`} />
            {i < steps.length - 1 ? <span className="t-tl-line" /> : null}
          </div>
          <div className="t-stack" style={{ gap: '2px' }}>
            <span className="t-sm" style={{ fontWeight: '500' }}>{t}</span>
            <span className="t-cap">{i === 0 && at > 0 ? 'Done' : d}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusCard({ name, status, tier, country, entity, expiry }: { name: string; status: [string, string, string]; tier: string; country: string; entity: string; expiry: string }) {
  return (
    <section className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="t-between t-wrap">
        <div className="t-stack" style={{ gap: '4px' }}>
          <span className="t-eyebrow">Identity status</span>
          <span className="t-h3">{name}</span>
        </div>
        <span className={`t-badge ${status[1]}`}>
          <span className={`t-dot ${status[2]}`} />
          {status[0]}
        </span>
      </div>
      <div className="t-metrics" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', rowGap: '16px' }}>
        {[['Verification tier', tier], ['Country', country], ['Entity type', entity], ['Expiry', expiry]].map(([k, v]) => (
          <div key={k} className="t-metric" style={{ gap: '4px' }}>
            <span className="t-label">{k}</span>
            <span className="t-num-md">{v}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Requirements({ app, signedIn, editable, busyKind, onUpload, onError }: {
  app: KycApplication | null | undefined;
  signedIn: boolean;
  editable: boolean;
  busyKind?: DocKind | null;
  onUpload?: (kind: DocKind, file: File) => void;
  onError: (message: string) => void;
}) {
  const reqs = app?.requirements ?? DEFAULT_REQUIREMENTS.map((r) => (r.key === 'wallet' && signedIn ? { ...r, state: 'complete' as const, detail: 'Signed in with your wallet' } : r));
  const done = reqs.filter((r) => r.state === 'complete').length;
  const docs = new Map((app?.documents ?? []).map((d) => [d.kind, d]));
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  return (
    <section className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div className="t-between" style={{ paddingBottom: '12px' }}>
        <span className="t-h4">Verification requirements</span>
        <span className="t-cap">{done} of {reqs.length} complete</span>
      </div>
      {reqs.map((r) => {
        const [label, tone, icon, ibg, ifg, ibd] = REQ_STATE[r.state];
        const isDoc = (DOC_KINDS as string[]).includes(r.key);
        const doc = isDoc ? docs.get(r.key as DocKind) : undefined;
        return (
          <div key={r.key} className="t-between" style={{ padding: '12px 0', borderTop: '1px solid var(--border)', gap: '12px' }}>
            <div className="t-row" style={{ gap: '12px', minWidth: '0' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', background: ibg, color: ifg, border: `1px solid ${ibd}` }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
              </span>
              <div className="t-stack" style={{ minWidth: '0' }}>
                <span className="t-sm" style={{ fontWeight: '500' }}>{r.title}</span>
                <span className="t-cap" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detail}</span>
              </div>
            </div>
            <div className="t-row" style={{ gap: '8px', flex: 'none' }}>
              {doc ? (
                <button className="t-btn t-btn-sm t-btn-ghost" onClick={() => openKycDocument(doc.id).catch((e) => onError(errorMessage(e)))}>View</button>
              ) : null}
              {isDoc && editable && onUpload ? (
                <>
                  <input
                    ref={(el) => { inputs.current[r.key] = el; }}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) onUpload(r.key as DocKind, file);
                    }}
                  />
                  <button className="t-btn t-btn-sm t-btn-secondary" disabled={!app || busyKind === r.key} title={!app ? 'Save your organisation details first' : undefined} onClick={() => inputs.current[r.key]?.click()}>
                    {busyKind === r.key ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
                  </button>
                </>
              ) : null}
              <span className={`t-badge t-badge-word ${tone}`}>{label}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Layout({ aside, header, children }: { aside: ReactNode; header?: ReactNode; children: ReactNode }) {
  return (
    <div className="t-atmos" style={{ color: 'var(--text)', fontFamily: 'var(--sans)', minHeight: '100%' }}>
      <header style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '0 32px', background: 'transparent', flexWrap: 'wrap', position: 'relative', zIndex: 20 }}>
        <a href="/" className="t-row" style={{ gap: '12px', color: 'var(--text)' }}>
          <img src="/design-assets/f7ab157752a5014c52926e68ee69f6c6.png" alt="Tensile" style={{ width: '26px', height: '25px' }} />
          <span className="t-wordmark">TENSILE</span>
        </a>
        <div className="t-row" style={{ gap: '12px' }}>{header}</div>
      </header>
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '48px 32px 80px', display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'flex-start' }}>
        <aside style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '24px' }}>{aside}</aside>
        <main style={{ flex: '999 1 560px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '24px' }}>{children}</main>
      </div>
    </div>
  );
}

function Alert({ tone, title, children, action }: { tone: 'info' | 'danger' | 'warning' | 'success'; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`t-alert t-${tone}`}>
      {tone === 'info' ? (
        <span className="t-spinner" style={{ color: 'var(--info)', marginTop: '2px' }} />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={`var(--${tone})`} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: 'none', marginTop: '1px' }}>
          <path d="M12 3l9 16H3zM12 10v4M12 17v.5" />
        </svg>
      )}
      <div style={{ flex: '1' }}>
        <p className="t-alert-title">{title}</p>
        {children ? <div className="t-alert-body">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

function ChainStatuses({ app }: { app: KycApplication }) {
  const { chains } = useSession();
  if (!app.attestations.length) return null;
  return (
    <span className="t-row t-wrap" style={{ gap: '8px', marginTop: '8px' }}>
      {app.attestations.map((a) => {
        const explorer = chains.find((c) => c.chainId === a.chainId)?.explorerUrl;
        const tone = a.status === 'done' ? 't-success' : a.status === 'failed' ? 't-danger' : 't-info';
        const badge = (
          <span className={`t-badge t-badge-word ${tone}`} title={a.error ?? undefined}>
            <span className={`t-dot ${a.status === 'queued' || a.status === 'running' ? 't-pulse' : ''}`} />
            {a.chainName} · {a.status === 'done' ? 'written' : a.status}
          </span>
        );
        return a.txHash && explorer ? <a key={a.chainId} href={`${explorer}/tx/${a.txHash}`} target="_blank" rel="noreferrer">{badge}</a> : <Fragment key={a.chainId}>{badge}</Fragment>;
      })}
    </span>
  );
}

// ------------------------------------------------------------------ applicant

export default function Onboarding() {
  const { signedIn, address, me, setError } = useSession();
  const kyc = useKycMe();
  const actions = useKycActions();
  const app = kyc.data?.application ?? null;
  const identity = me?.identity;
  const [renewing, setRenewing] = useState(false);
  const [busyKind, setBusyKind] = useState<DocKind | null>(null);
  const [form, setForm] = useState<KycApplicationIn>({ orgName: '', country: 'NG', entityType: 'corporate', tier: 2, contactEmail: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (app) setForm({ orgName: app.orgName ?? '', country: app.country ?? 'NG', entityType: app.entityType ?? 'corporate', tier: app.tier ?? 2, contactEmail: app.contactEmail ?? '' });
  }, [app?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const view: View = !signedIn
    ? 'signin'
    : identity?.status === 'verified' && !renewing
      ? 'verified'
      : identity?.status === 'expired' && !renewing
        ? 'expired'
        : app?.status === 'in_review'
          ? 'review'
          : app?.status === 'approved' && !renewing
            ? 'attesting'
            : 'edit';
  const editable = view === 'edit';
  const status = view === 'edit' && app?.status === 'rejected' ? STATUS.rejected : STATUS[view];
  const stepAt = { signin: 0, edit: 1, review: 2, attesting: 3, verified: 4, expired: 1 }[view];
  const docsReady = DOC_KINDS.every((k) => app?.documents.some((d) => d.kind === k));
  const detailsSaved = !!app?.orgName;
  const dirty = !detailsSaved
    || form.orgName.trim() !== (app?.orgName ?? '')
    || form.country !== app?.country
    || form.entityType !== app?.entityType
    || form.tier !== app?.tier
    || (form.contactEmail ?? '').trim() !== (app?.contactEmail ?? '');
  const verifiedTier = identity?.verified ? identity.tier : null;
  const mutationError = [actions.save.error, actions.upload.error, actions.submit.error].find(Boolean);

  const upload = (kind: DocKind, file: File) => {
    if (file.size > 10 * 1024 * 1024) return setError('Files can be up to 10 MB');
    setBusyKind(kind);
    actions.upload.mutate({ kind, file }, { onSettled: () => setBusyKind(null) });
  };
  const save = () =>
    actions.save.mutate(
      { ...form, orgName: form.orgName.trim(), contactEmail: form.contactEmail?.trim() || null },
      { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); } },
    );

  return (
    <Layout
      header={
        address ? (
          <>
            <span className={`t-badge t-badge-word ${signedIn ? 't-success' : 't-warning'}`}>
              <span className="t-dot" />
              {signedIn ? 'Wallet connected' : 'Sign in to continue'}
            </span>
            <WalletArea />
          </>
        ) : (
          <WalletArea />
        )
      }
      aside={
        <>
          <div className="t-stack" style={{ gap: '12px' }}>
            <span className="t-eyebrow">Identity</span>
            <h1 className="t-h1">Verify your organisation</h1>
            <p className="t-lead" style={{ fontSize: '16px', lineHeight: '26px' }}>
              Tensile lots represent physical metal in bonded custody. Every owner, lender and buyer is verified before holding, financing or trading a lot.
            </p>
          </div>
          <Steps at={stepAt} />
        </>
      }
    >
      <StatusCard
        name={app?.orgName ?? identity?.orgName ?? (address ? shortAddress(address) : 'Your organisation')}
        status={status as [string, string, string]}
        tier={tierLabel(verifiedTier ?? app?.approvedTier ?? (editable ? form.tier : app?.tier))}
        country={countryName(identity?.verified ? identity.country : app?.country ?? (editable ? form.country : null))}
        entity={entityLabel(app?.entityType ?? (editable ? form.entityType : null))}
        expiry={fmtDate(identity?.expiresAt ?? app?.expiresAt)}
      />

      {view === 'signin' ? (
        <Alert tone="warning" title="Connect and sign in to start">
          Verification is tied to your wallet. Connect it and sign the message (no transaction, no gas), then fill in your organisation details.
        </Alert>
      ) : null}

      {editable && app?.status === 'rejected' ? (
        <Alert tone="danger" title="Verification not approved">
          {app.rejectReason ?? 'Your application was declined.'} Update your details or documents and submit again.
        </Alert>
      ) : null}

      {editable ? (
        <>
          <section className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="t-stack" style={{ gap: '4px' }}>
              <span className="t-h3">Organisation details</span>
              <span className="t-sm t-sec">As registered. Only a pass/fail attestation and your country are written on-chain.</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
              <label className="t-field" style={{ gridColumn: 'span 2' }}>
                <span className="t-label">Legal name</span>
                <input className="t-input" value={form.orgName} maxLength={120} placeholder="Halden Metals Ltd" onChange={(e) => setForm({ ...form, orgName: e.target.value })} />
              </label>
              <label className="t-field">
                <span className="t-label">Country of registration</span>
                <select className="t-input t-select" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                  {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </label>
              <label className="t-field">
                <span className="t-label">Entity type</span>
                <select className="t-input t-select" value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value as EntityType })}>
                  {ENTITY_TYPES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </label>
              <label className="t-field" style={{ gridColumn: 'span 2' }}>
                <span className="t-label">Contact email (optional)</span>
                <input className="t-input" type="email" value={form.contactEmail ?? ''} maxLength={200} placeholder="compliance@company.com" onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
              </label>
            </div>
            <div className="t-stack" style={{ gap: '4px', paddingTop: '4px' }}>
              <span className="t-h4">Choose a verification tier</span>
              <span className="t-sm t-sec">Your tier decides what you can do. You can upgrade later.</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
              {TIERS.map(([k, code, name, can]) => (
                <button key={k} onClick={() => setForm({ ...form, tier: k })} aria-pressed={form.tier === k} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', borderRadius: '12px', cursor: 'pointer', background: form.tier === k ? 'var(--brand-subtle)' : 'var(--bg-sunken)', border: `1px solid ${form.tier === k ? 'var(--brand-border)' : 'var(--border)'}`, color: 'var(--text)' }}>
                  <span className="t-mono-sm t-muted">{code}</span>
                  <span className="t-h4">{name}</span>
                  <span className="t-cap" style={{ color: 'var(--text-secondary)' }}>{can}</span>
                </button>
              ))}
            </div>
            <div className="t-row" style={{ justifyContent: 'flex-end', gap: '12px' }}>
              {saved ? <span className="t-cap" style={{ color: 'var(--success-text)' }}>Saved</span> : null}
              <button className="t-btn t-btn-secondary" disabled={form.orgName.trim().length < 2 || !dirty || actions.save.isPending} onClick={save}>
                {actions.save.isPending ? 'Saving…' : detailsSaved ? 'Save changes' : 'Save details'}
              </button>
            </div>
          </section>
        </>
      ) : null}

      <Requirements app={app} signedIn={signedIn} editable={editable} busyKind={busyKind} onUpload={upload} onError={setError} />

      {mutationError ? <Alert tone="danger" title={(mutationError as ApiError).message ?? 'Something went wrong'} /> : null}

      {editable ? (
        <div className="t-row t-wrap" style={{ justifyContent: 'flex-end', gap: '12px' }}>
          <span className="t-cap">
            {!detailsSaved ? 'Save your details, then upload the three documents.' : !docsReady ? 'Upload the three documents to submit.' : "Documents are reviewed by Tensile's identity provider. Only a pass/fail attestation is written on-chain."}
          </span>{' '}
          <button className="t-btn t-btn-primary t-btn-lg" disabled={!detailsSaved || !docsReady || actions.submit.isPending} onClick={() => actions.submit.mutate()}>
            {actions.submit.isPending ? 'Submitting…' : 'Submit for verification'}
          </button>
        </div>
      ) : null}

      {view === 'review' && app ? (
        <Alert tone="info" title="Verification in review">
          Submitted {fmtTime(app.submittedAt)}. Typical review time is under 4 business hours. You can browse lots and the marketplace meanwhile; holding, borrowing and trading unlock once verified.
        </Alert>
      ) : null}

      {view === 'attesting' && app ? (
        <Alert tone="info" title="Approved · writing your verification on-chain">
          Approved {fmtTime(app.reviewedAt)} at Tier {app.approvedTier}. This takes a few seconds per network.
          <ChainStatuses app={app} />
        </Alert>
      ) : null}

      {view === 'expired' ? (
        <Alert
          tone="danger"
          title={`Verification expired on ${fmtDate(identity?.expiresAt)}`}
          action={<button className="t-btn t-btn-primary t-btn-sm" onClick={() => setRenewing(true)}>Renew verification</button>}
        >
          You still own your lots, and existing loans keep running. New borrowing, listing, bidding and redemption are paused until you renew. Renewal needs an updated register of directors.
        </Alert>
      ) : null}

      {view === 'verified' ? (
        <section className="t-card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px', borderColor: 'var(--success-border)', background: 'var(--success-subtle)' }}>
          <span style={{ width: '48px', height: '48px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--success)', color: 'var(--on-success)', flex: 'none' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          <div style={{ flex: '1 1 280px' }} className="t-stack">
            <span className="t-h3">You are verified at Tier {identity?.tier}</span>
            <span className="t-sm t-sec">
              {app?.reviewedAt ? `Attestation written ${fmtTime(app.reviewedAt)}, valid` : 'Valid'} to {fmtDate(identity?.expiresAt)}. You can now tokenize material, borrow, lend, trade and redeem.
            </span>
            {app ? <ChainStatuses app={app} /> : null}
          </div>
          <a href="/overview" className="t-btn t-btn-primary t-btn-lg">Enter Tensile</a>
        </section>
      ) : null}
    </Layout>
  );
}

// ------------------------------------------------------------------ KYC staff review

export function OnboardingReview() {
  const { address: applicant } = useParams();
  const { signedIn, setError } = useSession();
  const q = useKycApplication(applicant);
  const review = useKycReview(applicant);
  const app = q.data;
  const [tier, setTier] = useState<number | null>(null);
  const [days, setDays] = useState(365);
  const [reason, setReason] = useState('');
  const forbidden = q.error instanceof ApiError && q.error.status === 403;
  const missing = q.error instanceof ApiError && q.error.status === 404;
  const status: [string, string, string] = !app
    ? STATUS.edit
    : app.status === 'in_review'
      ? STATUS.review
      : app.status === 'approved'
        ? app.attestations.every((a) => a.status === 'done') ? STATUS.verified : STATUS.attesting
        : app.status === 'rejected'
          ? STATUS.rejected
          : ['DRAFT', 't-neutral', ''];
  const err = review.approve.error ?? review.reject.error;

  return (
    <Layout
      header={
        <>
          <a href="/console" className="t-btn t-btn-ghost t-btn-sm">← Operations console</a>
          <WalletArea />
        </>
      }
      aside={
        <>
          <div className="t-stack" style={{ gap: '12px' }}>
            <span className="t-eyebrow">Identity review</span>
            <h1 className="t-h1">{app?.orgName ?? 'Application'}</h1>
            <p className="t-lead" style={{ fontSize: '16px', lineHeight: '26px' }}>
              Check the documents against the details, then approve or decline. Approval writes a pass attestation for this wallet on every Tensile network.
            </p>
            <span className="t-mono-sm t-muted" style={{ wordBreak: 'break-all' }}>{applicant}</span>
          </div>
          <Steps at={!app ? 1 : app.status === 'in_review' ? 2 : app.status === 'approved' ? (status === STATUS.verified ? 4 : 3) : 1} />
        </>
      }
    >
      {!signedIn ? <Alert tone="warning" title="Sign in with a KYC_ADMIN wallet to review applications" /> : null}
      {forbidden ? <Alert tone="danger" title="This needs the KYC_ADMIN role">Switch to a staff wallet, or ask an admin to grant the role.</Alert> : null}
      {missing ? <Alert tone="warning" title="No application for this wallet" /> : null}

      {app ? (
        <>
          <StatusCard
            name={app.orgName ?? shortAddress(app.address)}
            status={status}
            tier={tierLabel(app.approvedTier ?? app.tier)}
            country={countryName(app.country)}
            entity={entityLabel(app.entityType)}
            expiry={fmtDate(app.expiresAt)}
          />
          {app.screening === 'flagged' ? (
            <Alert tone="warning" title="Screening flagged this application">{app.screeningNotes.join('; ')}</Alert>
          ) : null}
          <Requirements app={app} signedIn editable={false} onError={setError} />
          <section className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span className="t-h4">Application</span>
            <div className="t-kv">
              {[
                ['Submitted', fmtTime(app.submittedAt)],
                ['Contact', app.contactEmail ?? '—'],
                ['Tier applied for', tierLabel(app.tier)],
                ['Reviewed', app.reviewedAt ? `${fmtTime(app.reviewedAt)} by ${shortAddress(app.reviewedBy)}` : '—'],
                ...(app.rejectReason ? [['Decline reason', app.rejectReason]] : []),
              ].map(([k, v]) => (
                <div key={k} className="t-kv-row">
                  <span className="t-kv-k">{k}</span>
                  <span className="t-kv-v">{v}</span>
                </div>
              ))}
            </div>
            {app.attestations.length ? <ChainStatuses app={app} /> : null}
          </section>

          {app.status === 'in_review' ? (
            <section className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <span className="t-h4">Decision</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
                <label className="t-field">
                  <span className="t-label">Tier to grant</span>
                  <select className="t-input t-select" value={tier ?? app.tier ?? 2} onChange={(e) => setTier(Number(e.target.value))}>
                    {TIERS.map(([k, code, name]) => <option key={k} value={k}>{code} · {name}</option>)}
                  </select>
                </label>
                <label className="t-field">
                  <span className="t-label">Valid for (days)</span>
                  <input className="t-input" type="number" min={1} max={1095} value={days} onChange={(e) => setDays(Math.max(1, Math.min(1095, Number(e.target.value) || 1)))} />
                </label>
              </div>
              <div className="t-row" style={{ justifyContent: 'flex-end' }}>
                <button className="t-btn t-btn-primary" disabled={review.approve.isPending} onClick={() => review.approve.mutate({ tier: tier ?? app.tier ?? undefined, validDays: days })}>
                  {review.approve.isPending ? 'Approving…' : 'Approve and attest on-chain'}
                </button>
              </div>
              <div className="t-hr" />
              <label className="t-field">
                <span className="t-label">Reason for declining (shown to the applicant)</span>
                <input className="t-input" value={reason} maxLength={500} placeholder="e.g. Register of directors is older than 12 months" onChange={(e) => setReason(e.target.value)} />
              </label>
              <div className="t-row" style={{ justifyContent: 'flex-end' }}>
                <button className="t-btn t-btn-danger-outline" disabled={reason.trim().length < 3 || review.reject.isPending} onClick={() => review.reject.mutate(reason.trim())}>
                  {review.reject.isPending ? 'Declining…' : 'Decline application'}
                </button>
              </div>
            </section>
          ) : null}
          {err ? <Alert tone="danger" title={errorMessage(err)} /> : null}
        </>
      ) : null}
    </Layout>
  );
}
