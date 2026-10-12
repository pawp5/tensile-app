/* Tokenize (F-1): pieces shared by the draft and request views. Markup and classes from Tokenize.dc.html. */
import type { ReactNode } from 'react';

import { money, tonnes } from '../../lib/format';
import type { MintStep, MintStepKey } from '../../lib/types';
import Sidebar from '../../shell/Sidebar';
import TopBar, { WalletArea } from '../../shell/TopBar';
import { useMintDrafts, useMintRequests } from '../../state/minting';
import { useSession } from '../../state/session';

// ------------------------------------------------------------------ formatting and constants

export const STEP_LABELS: [MintStepKey, string][] = [
  ['details', 'Material details'], ['evidence', 'Evidence'], ['review', 'Automated review'], ['inspection', 'Inspection'],
  ['custody', 'Warehouse custody'], ['reserve', 'Reserve confirmation'], ['mint', 'Mint passport'],
];
export const NEXT_LABEL: Partial<Record<MintStepKey, string>> = {
  review: 'Continue', inspection: 'Continue', custody: 'Check reserve', reserve: 'Continue to mint',
};
export const CERT_RE = /^[A-Za-z0-9][A-Za-z0-9 ._/-]{2,63}$/;
export const REJECT_REASONS: [string, string][] = [
  ['EVIDENCE_INCONSISTENT', 'Evidence is inconsistent'],
  ['CERTIFICATE_INVALID', 'Certificate is not valid'],
  ['QUANTITY_MISMATCH', 'Quantity does not match'],
  ['WAREHOUSE_REFUSED', 'Warehouse refused custody'],
  ['RISK_DECLINED', 'Declined by risk'],
];
export const STATUS_BADGE: Record<string, [label: string, tone: string, pulse: boolean]> = {
  NEW: ['NEW', 't-neutral', false],
  DRAFT: ['DRAFT', 't-neutral', false],
  SUBMITTING: ['SUBMITTING', 't-info', true],
  REQUESTED: ['REQUESTED', 't-info', true],
  FINALIZED: ['FINALIZED', 't-success', false],
  REJECTED: ['REJECTED', 't-danger', false],
  CANCELLED: ['CANCELLED', 't-neutral', false],
  EXPIRED: ['EXPIRED', 't-neutral', false],
};

export const t3 = (kg: number | null | undefined) => (kg == null ? '—' : tonnes(kg));
export const usd = (v: number | null | undefined) => (v == null ? '—' : '$' + money(v));
export const usdc = (v: number | null | undefined) => (v == null ? '—' : money(v) + ' USDC');
export const mrId = (id: number) => `MR-${String(id).padStart(4, '0')}`;
export const shortSha = (s: string | null | undefined) => (s ? `${s.slice(0, 8)}…${s.slice(-4)}` : '—');
export const fileSize = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${Math.round(n / 1e3)} KB` : `${n} B`);
export const what = (title: string) => title.replace(/^Tokenize /, '');
/** "25.000" -> 25000 kg; null when it is not a number */
export function parseTonnes(text: string): number | null {
  const v = Number(text.replace(/[,\s]/g, ''));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 1000) : null;
}

// ------------------------------------------------------------------ shared pieces

export function Page({ crumb, children }: { crumb: string; children: ReactNode }) {
  return (
    <div className="t-app">
      <div style={{ flex: '0 0 248px', display: 'flex', background: 'var(--bg-sunken)' }}>
        <Sidebar active="tokenize" role="owner" />
      </div>
      <div className="t-main">
        <TopBar section="Tokenize" crumb={crumb} />
        <main className="t-content">{children}</main>
      </div>
    </div>
  );
}

export function Head({ title, sub, status }: { title: string; sub: ReactNode; status: string }) {
  const [label, tone, pulse] = STATUS_BADGE[status] ?? STATUS_BADGE.NEW;
  return (
    <div className="t-between t-wrap" style={{ alignItems: 'flex-end' }}>
      <div className="t-stack" style={{ gap: '8px' }}>
        <span className="t-eyebrow">Tokenize material · F-1</span>
        <h1 className="t-h1">{title}</h1>
        <span className="t-sm t-sec">{sub}</span>
      </div>
      <span className={`t-badge ${tone}`}>
        <span className={`t-dot ${pulse ? 't-pulse' : ''}`} />
        {label}
      </span>
    </div>
  );
}

export type StepState = MintStep['state'] | 'next';
export const STEP_CLASS: Record<StepState, [cls: string, word: string]> = {
  done: ['t-step-done', 'DONE'], current: ['t-step-current', 'NOW'], waiting: ['', 'NEXT'], next: ['', 'NEXT'],
  failed: ['t-step-failed', 'FAILED'], blocked: ['t-step-blocked', 'BLOCKED'],
};

export function Stepper({ steps, sel, onPick }: {
  steps: { key: MintStepKey; label: string; state: StepState; disabled?: boolean; title?: string }[];
  sel: MintStepKey;
  onPick: (key: MintStepKey) => void;
}) {
  return (
    <nav aria-label="Tokenization progress" className="t-steps">
      {steps.map((s, i) => {
        const [cls, word] = STEP_CLASS[s.state];
        return (
          <button
            key={s.key}
            className={`t-step ${cls} ${sel === s.key ? 'tk-step-sel' : ''}`}
            onClick={() => !s.disabled && onPick(s.key)}
            aria-current={s.state === 'current' ? 'step' : 'false'}
            aria-disabled={s.disabled ? 'true' : undefined}
            title={s.title}
          >
            <span className="t-step-n">{String(i + 1).padStart(2, '0')} · {word}</span>
            <span className="t-step-l">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function Columns({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
      <section style={{ flex: '999 1 560px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '24px' }}>{main}</section>
      <aside style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>{aside}</aside>
    </div>
  );
}

export const CardHead = ({ title, sub, right }: { title: string; sub: string; right?: ReactNode }) => (
  <div className="t-between" style={{ alignItems: 'flex-start', gap: '16px' }}>
    <div className="t-stack" style={{ gap: '4px', minWidth: '0' }}>
      <span className="t-h3">{title}</span>
      <span className="t-sm t-sec">{sub}</span>
    </div>
    {right ? <span style={{ flex: 'none' }}>{right}</span> : null}
  </div>
);

export const Badge = ({ tone, pulse, children, word }: { tone: string; pulse?: boolean; children: ReactNode; word?: boolean }) => (
  <span className={`t-badge ${word ? 't-badge-word' : ''} ${tone}`}>
    <span className={`t-dot ${pulse ? 't-pulse' : ''}`} />
    {children}
  </span>
);

export function Alert({ tone, title, children, action }: { tone: 'info' | 'success' | 'warning' | 'danger'; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`t-alert t-${tone}`}>
      {tone === 'info' ? (
        <span className="t-spinner" style={{ color: 'var(--info)', marginTop: '2px', flex: 'none' }} />
      ) : tone === 'success' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flex: 'none' }}><path d="M5 12l5 5 9-10" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={`var(--${tone})`} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: 'none' }}><path d="M12 3l9 16H3zM12 10v4M12 17v.5" /></svg>
      )}
      <div style={{ flex: '1', minWidth: '0' }}>
        <p className="t-alert-title">{title}</p>
        {children ? <div className="t-alert-body">{children}</div> : null}
        {action ? <div className="t-row" style={{ gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>{action}</div> : null}
      </div>
    </div>
  );
}

export const Kv = ({ k, children, mono }: { k: string; children: ReactNode; mono?: boolean }) => (
  <div className="t-kv-row">
    <span className="t-kv-k">{k}</span>
    <span className={`t-kv-v ${mono ? 't-mono' : ''}`}>{children}</span>
  </div>
);

export function Summary({ rows }: { rows: [string, ReactNode, boolean?][] }) {
  return (
    <div className="t-card t-stack" style={{ gap: '12px' }}>
      <span className="t-eyebrow">Request summary</span>
      <div className="t-kv">
        {rows.map(([k, v, mono]) => <Kv key={k} k={k} mono={mono}>{v}</Kv>)}
      </div>
    </div>
  );
}

export const NextCard = ({ copy }: { copy: string }) => (
  <div className="t-card t-card-dense t-stack" style={{ gap: '8px' }}>
    <span className="t-h4">What happens next</span>
    <span className="t-sm t-sec">{copy}</span>
  </div>
);

export function Nav({ back, hint, next, nextLabel, nextDisabled, busy }: {
  back?: () => void; hint: ReactNode; next?: () => void; nextLabel: string; nextDisabled?: boolean; busy?: string | null;
}) {
  return (
    <div className="t-between t-wrap" style={{ gap: '12px' }}>
      <button className="t-btn t-btn-secondary" onClick={back} disabled={!back}>Back</button>
      <div className="t-row" style={{ gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <span className="t-cap">{hint}</span>
        {next ? (
          <button className="t-btn t-btn-primary" onClick={next} disabled={nextDisabled || !!busy}>
            {busy ? <><span className="t-spinner" />{busy}</> : nextLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SignInCard() {
  const { signedIn } = useSession();
  return (
    <Alert
      tone="warning"
      title={signedIn ? 'Verify your wallet to submit' : 'Sign in to tokenize material'}
      action={signedIn ? <a href="/onboarding" className="t-btn t-btn-sm t-btn-secondary">Verify identity</a> : <WalletArea />}
    >
      {signedIn
        ? 'You can prepare a draft now. Submitting a mint request needs a verified (Tier 2) wallet on this network.'
        : 'Mint requests are signed by the wallet that will own the passport. Connect and sign in to start or resume one.'}
    </Alert>
  );
}

// ------------------------------------------------------------------ your drafts and requests

export function YourRequests({ currentDraft, currentRequest }: { currentDraft?: string; currentRequest?: number }) {
  const { signedIn } = useSession();
  const drafts = useMintDrafts('open');
  const requests = useMintRequests('mine', 'all');
  if (!signedIn) return null;
  const rows = [
    ...(drafts.data?.drafts ?? []).map((d) => ({
      key: `d${d.id}`, href: `/tokenize?draft=${d.id}`, ref: 'Draft', on: d.id === currentDraft,
      title: `${t3(d.quantityKg)} t ${d.materialName ?? d.material ?? 'material'}`,
      state: d.status === 'submitted' ? 'Submitting' : d.missing.length ? 'Evidence needed' : 'Ready to submit',
      tone: d.status === 'submitted' ? 't-info' : 't-neutral',
    })),
    ...(requests.data?.requests ?? []).map((r) => ({
      key: `r${r.request.requestId}`, href: `/tokenize?request=${r.request.requestId}`, ref: r.request.displayId,
      on: r.request.requestId === currentRequest, title: what(r.title),
      // the list does not read the reserve: once inspected and in custody, minting is the owner's next move
      state: r.request.status !== 'REQUESTED' ? r.request.status.toLowerCase().replace(/^./, (c) => c.toUpperCase())
        : r.currentStep === 'reserve' && r.inspected && r.custody ? 'Ready to mint' : r.currentLabel.split(' · ')[0],
      tone: STATUS_BADGE[r.request.status]?.[1] ?? 't-neutral',
    })),
  ].slice(0, 8);
  return (
    <div className="t-card t-card-dense t-stack" style={{ gap: '8px' }}>
      <div className="t-between">
        <span className="t-h4">Your requests</span>
        {currentDraft || currentRequest ? <a href="/tokenize" className="t-sm">New request</a> : null}
      </div>
      {rows.length ? rows.map((r) => (
        <a key={r.key} href={r.href} className="t-stack" style={{ gap: '2px', padding: '8px 0', borderTop: '1px solid var(--border)', color: 'var(--text)' }}>
          <span className="t-between" style={{ gap: '8px' }}>
            <span className="t-mono-sm" style={{ color: r.on ? 'var(--brand)' : undefined, whiteSpace: 'nowrap' }}>{r.ref}</span>
            <span className={`t-badge t-badge-word ${r.tone}`} style={{ height: '18px', fontSize: '10px', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', lineHeight: '18px' }}>{r.state}</span>
          </span>
          <span className="t-sm">{r.title}</span>
        </a>
      )) : <span className="t-cap">Nothing yet. Your drafts and mint requests show up here.</span>}
    </div>
  );
}
