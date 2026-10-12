/* Live top bar: the design's markup (src/design/TopBar.tsx) wired to the chain, wallet and session. */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnect, useConnectors } from 'wagmi';

import { ago, int, since } from '../lib/format';
import { shortAddress } from '../lib/web3';
import { useNotifications, useSearch } from '../state/account';
import { useNow, useSync, useWarehouses } from '../state/protocol';
import { errorMessage, useSession } from '../state/session';
import Popover from './Popover';
import './shell.css';

const pill = {
  gap: '10px',
  height: '40px',
  padding: '0 5px 0 14px',
  borderRadius: '999px',
  border: '0',
  background: 'linear-gradient(180deg, rgba(215,252,253,.09), rgba(215,252,253,.03))',
  boxShadow: 'inset 0 1px 0 rgba(240,255,255,.12), inset 0 0 0 1px rgba(215,252,253,.09)',
  color: 'var(--text)',
  cursor: 'pointer',
} as const;

interface NetworkStatus {
  tone: 't-success' | 't-warning' | 't-danger' | 't-info' | 't-neutral';
  label: string;
  pulse: boolean;
  lines: string[];
}

/** The network badge: is the indexer keeping up, and are the reserve feeds fresh? */
function useNetworkStatus(): NetworkStatus {
  const { chain } = useSession();
  const sync = useSync();
  const { data: wh } = useWarehouses();
  const now = useNow(1000);
  const s = sync.data;
  if (!s) {
    return sync.isError
      ? { tone: 't-warning', label: 'API unreachable', pulse: true, lines: [] }
      : { tone: 't-neutral', label: `${chain.name} · connecting…`, pulse: true, lines: [] };
  }
  const lines = [
    s.indexedBlock != null ? `Indexed to block ${int(s.indexedBlock)}${s.catchingUp && s.lagBlocks ? ` · ${int(s.lagBlocks)} behind` : ''}` : 'Not indexed yet',
    `Worker ${s.workerLive ? 'live' : 'offline'}${s.upkeepAt ? ` · last check ${ago(s.upkeepAt, now)}` : ''}${s.lowGas ? ' · low gas' : ''}`,
  ];
  const last = since(s.indexedAt, now) < since(s.snapshotAt, now) ? s.indexedAt : s.snapshotAt;
  if (!s.indexerLive || since(last, now) > 120_000) return { tone: 't-warning', label: `${chain.name} · indexer offline`, pulse: true, lines };
  if (s.catchingUp) return { tone: 't-info', label: `${chain.name} · syncing`, pulse: true, lines };
  const list = wh?.warehouses ?? [];
  const frozen = list.filter((w) => w.frozen).length;
  const stale = list.filter((w) => !w.frozen && !w.fresh).length;
  if (frozen) return { tone: 't-danger', label: `${frozen} warehouse${frozen > 1 ? 's' : ''} frozen`, pulse: true, lines };
  if (stale) return { tone: 't-warning', label: `${stale} reserve feed${stale > 1 ? 's' : ''} stale`, pulse: true, lines };
  return { tone: 't-success', label: `${chain.name} · synced ${ago(last, now)}`, pulse: false, lines };
}

function ChainSwitcher() {
  const { chains, chain, selectChain, wrongNetwork, setError } = useSession();
  const status = useNetworkStatus();
  return (
    <Popover
      width={280}
      trigger={({ open, toggle }) =>
        wrongNetwork ? (
          <button className="t-badge t-badge-word t-warning ts-pill-btn" aria-expanded={open} onClick={toggle} style={{ height: '28px', padding: '0 12px' }}>
            <span className="t-dot t-pulse" />
            Wrong network · switch
          </button>
        ) : (
          <button className={`t-badge t-badge-word ${status.tone} ts-pill-btn`} aria-expanded={open} onClick={toggle} title="Network status · switch chain" style={{ height: '28px', padding: '0 12px' }}>
            <span className={status.pulse ? 't-dot t-pulse' : 't-dot'} />
            {status.label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )
      }
    >
      {(close) => (
        <>
          <span className="ts-menu-label">Network</span>
          {chains.map((c) => (
            <button
              key={c.chainId}
              className="ts-menu-item"
              role="menuitemradio"
              aria-checked={!wrongNetwork && c.chainId === chain.chainId}
              onClick={async () => {
                close();
                try {
                  await selectChain(c.chainId);
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              <span className="t-dot" style={{ color: c.chainId === chain.chainId ? 'var(--success)' : 'var(--text-disabled)' }} />
              <span style={{ flex: 1 }}>{c.name}</span>
              {c.testnet ? <span className="t-badge t-neutral" style={{ height: '18px', fontSize: '10px' }}>TESTNET</span> : null}
            </button>
          ))}
          {status.lines.length ? (
            <>
              <div className="ts-menu-hr" />
              <span className="ts-menu-label">{chain.name} sync</span>
              {status.lines.map((line) => (
                <span key={line} className="ts-menu-note">{line}</span>
              ))}
            </>
          ) : null}
        </>
      )}
    </Popover>
  );
}

function ConnectButton() {
  const connectors = useConnectors();
  const { mutateAsync: connectAsync, isPending } = useConnect();
  const { signIn, setError } = useSession();
  // Browser wallets announce themselves (EIP-6963). Fall back to the generic entry only if a wallet is injected.
  const named = connectors.filter((c) => c.id !== 'injected');
  const hasInjected = typeof window !== 'undefined' && 'ethereum' in window;
  const list = named.length ? named : hasInjected ? connectors : [];

  return (
    <Popover
      trigger={({ toggle }) => (
        <button className="t-btn t-btn-primary" onClick={toggle} disabled={isPending}>
          {isPending ? 'Connecting…' : 'Connect wallet'}
        </button>
      )}
    >
      {(close) => (
        <>
          <span className="ts-menu-label">Connect a wallet</span>
          {list.length === 0 ? (
            <p className="t-cap" style={{ padding: '6px 10px' }}>No browser wallet found. Install MetaMask or Rabby, then reload.</p>
          ) : (
            list.map((c) => (
              <button
                key={c.uid}
                className="ts-menu-item"
                onClick={async () => {
                  close();
                  try {
                    const res = await connectAsync({ connector: c });
                    await signIn(res.accounts[0], res.chainId);
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                {c.icon ? <img src={c.icon} alt="" width={20} height={20} /> : <span className="t-avatar" style={{ width: 20, height: 20 }} />}
                {c.name}
              </button>
            ))
          )}
        </>
      )}
    </Popover>
  );
}

function AccountButton() {
  const { address, chain, me, signOut } = useSession();
  const id = me?.identity;
  const label = {
    verified: `Verified · Tier ${id?.tier}`,
    in_review: 'In review',
    expired: 'Verification expired',
    rejected: 'Verification declined',
    not_started: 'Not verified',
  }[id?.status ?? 'not_started'];
  return (
    <Popover
      trigger={({ toggle }) => (
        <button className="t-row" onClick={toggle} style={pill}>
          <span className="t-stack" style={{ alignItems: 'flex-end' }}>
            <span style={{ fontSize: '13px', lineHeight: '16px', fontWeight: '500' }}>{label}</span>
            <span className="t-mono-sm t-muted" style={{ fontWeight: '400' }}>{shortAddress(address)}</span>
          </span>
          <span className="t-avatar" style={{ width: '30px', height: '30px' }}>{address?.slice(2, 4).toUpperCase()}</span>
        </button>
      )}
    >
      {(close) => (
        <>
          <span className="ts-menu-label">{shortAddress(address)}</span>
          <button className="ts-menu-item" onClick={() => { navigator.clipboard?.writeText(address ?? ''); close(); }}>Copy address</button>
          {chain.explorerUrl ? (
            <a className="ts-menu-item" href={`${chain.explorerUrl}/address/${address}`} target="_blank" rel="noreferrer" onClick={close}>View on explorer</a>
          ) : null}
          <div className="ts-menu-hr" />
          <button className="ts-menu-item" onClick={() => { close(); signOut(); }}>Sign out</button>
        </>
      )}
    </Popover>
  );
}

export function WalletArea() {
  const { isConnected, signedIn, signingIn, signIn, setError } = useSession();
  if (!isConnected) return <ConnectButton />;
  if (!signedIn)
    return (
      <button className="t-btn t-btn-primary" disabled={signingIn} onClick={() => signIn().catch((e) => setError(errorMessage(e)))}>
        {signingIn ? 'Check your wallet…' : 'Sign in'}
      </button>
    );
  return <AccountButton />;
}

const SEARCH_TYPE: Record<string, string> = { lot: 'LOT', warehouse: 'WAREHOUSE', address: 'WALLET', request: 'REQUEST' };

/** "/" focuses it; arrows + Enter pick a result. Searches lot IDs, MR- requests, warehouses, materials and addresses. */
function SearchBox() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { data, isFetching } = useSearch(text);
  const results = text.trim() ? data?.results ?? [] : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setActive(0), [data]);

  const go = (href: string) => {
    setOpen(false);
    setText('');
    input.current?.blur();
    navigate(href);
  };

  return (
    <div style={{ position: 'relative' }}>
      <label className="t-row" style={{ gap: '8px', height: '36px', width: '280px', padding: '0 8px 0 14px', borderRadius: '999px', background: 'linear-gradient(180deg, rgba(215,252,253,.06), rgba(215,252,253,.02)), rgba(4,28,30,.36)', WebkitBackdropFilter: 'blur(20px) saturate(140%)', backdropFilter: 'blur(20px) saturate(140%)', boxShadow: 'inset 0 1px 0 rgba(240,255,255,.08), 0 10px 24px -16px rgba(0,0,0,.6)', color: 'var(--text-muted)', transition: 'box-shadow .28s cubic-bezier(.22,1,.36,1)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4" />
        </svg>
        <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Search</span>
        <input
          ref={input}
          value={text}
          placeholder="Lot ID, warehouse, address"
          role="combobox"
          aria-expanded={open && !!text.trim()}
          aria-controls="ts-search-results"
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            else if (e.key === 'Enter' && results[active]) go(results[active].href);
            else if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
          }}
          style={{ flex: '1', minWidth: '0', background: 'transparent', border: '0', color: 'var(--text)', fontSize: '13px', outline: 'none' }}
        />
        <span className="t-mono-sm" style={{ width: '22px', height: '22px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '999px', background: 'rgba(215,252,253,.06)' }}>/</span>
      </label>
      {open && text.trim() ? (
        <div id="ts-search-results" className="ts-menu" role="listbox" style={{ width: 380, left: 0 }}>
          <span className="ts-menu-label">{isFetching && !results.length ? 'Searching…' : results.length ? 'Results' : 'No matches'}</span>
          {results.map((r, i) => (
            <button
              key={r.type + r.id}
              className="ts-menu-item"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r.href)}
              style={{ minHeight: '48px', background: i === active ? 'var(--surface-hover)' : undefined }}
            >
              <span className="t-stack" style={{ flex: 1, minWidth: 0 }}>
                <span className="t-sm" style={{ fontWeight: 500, color: 'var(--text)' }}>{r.title}</span>
                {r.subtitle ? <span className="t-cap" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.subtitle}</span> : null}
              </span>
              <span className="t-badge t-neutral" style={{ height: '18px', fontSize: '10px' }}>{SEARCH_TYPE[r.type] ?? r.type}</span>
            </button>
          ))}
          {!results.length && !isFetching ? <span className="ts-menu-note">Try TNS-CU-00001, MR-0001, a warehouse code or a wallet address.</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function NotificationsBell() {
  const navigate = useNavigate();
  const { signedIn } = useSession();
  const { data, markSeen } = useNotifications();
  const now = useNow(30_000);
  const unread = signedIn ? data?.unread ?? 0 : 0;
  const items = data?.items ?? [];
  return (
    <Popover
      width={380}
      trigger={({ open, toggle }) => (
        <button
          className="t-btn t-btn-ghost"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          aria-expanded={open}
          onClick={() => {
            toggle();
            if (!open && unread) markSeen.mutate();
          }}
          style={{ width: '40px', padding: '0', position: 'relative', color: 'var(--text-secondary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20h4" />
          </svg>
          {unread ? <span style={{ position: 'absolute', top: '9px', right: '10px', width: '7px', height: '7px', borderRadius: '999px', background: 'var(--info)', boxShadow: '0 0 8px var(--info)' }} /> : null}
        </button>
      )}
    >
      {(close) => (
        <>
          <span className="ts-menu-label">Notifications</span>
          {!signedIn ? <span className="ts-menu-note">Sign in to see activity on your lots, requests and identity.</span> : null}
          {signedIn && !items.length ? <span className="ts-menu-note">Nothing yet. Activity on your lots, mint requests and identity shows up here.</span> : null}
          <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {items.map((n) => (
              <button
                key={n.id}
                className="ts-menu-item"
                onClick={() => { close(); if (n.href) navigate(n.href); }}
                style={{ alignItems: 'flex-start', padding: '8px 10px' }}
              >
                <span className="t-stack" style={{ flex: 1, minWidth: 0 }}>
                  <span className="t-sm" style={{ fontWeight: 500, color: 'var(--text)' }}>
                    {n.title}
                    {n.ref ? <span className="t-mono-sm t-muted" style={{ marginLeft: 6 }}>{n.ref}</span> : null}
                  </span>
                  <span className="t-cap">{[n.actor, n.amount].filter(Boolean).join(' · ') || '—'}</span>
                </span>
                <span className="t-mono-sm t-muted" style={{ whiteSpace: 'nowrap', fontWeight: 400 }}>{ago(n.at, now)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Popover>
  );
}

export function Toast() {
  const { error, setError } = useSession();
  if (!error) return null;
  return (
    <div className="ts-toast" role="alert">
      <span className="t-dot" style={{ color: 'var(--danger)', marginTop: '9px' }} />
      <span style={{ flex: 1 }}>{error}</span>
      <button className="t-btn t-btn-ghost t-btn-sm" onClick={() => setError(null)}>Dismiss</button>
    </div>
  );
}

export default function TopBar({ section = 'Tensile', crumb = 'Overview' }: { section?: string; crumb?: string; [k: string]: unknown }) {
  return (
    <div style={{ height: '64px', padding: '12px 24px 0', boxSizing: 'border-box', fontFamily: 'var(--sans)', color: 'var(--text)', position: 'relative', zIndex: 20 }}>
      <header style={{ height: '52px', display: 'flex', alignItems: 'center', gap: '14px', padding: '0 0 0 8px', background: 'transparent', boxSizing: 'border-box' }}>
        <nav aria-label="Breadcrumb" className="t-row" style={{ gap: '8px', flex: '1 1 200px', minWidth: '0' }}>
          <span className="t-sm t-muted">{section}</span>
          <span className="t-muted" aria-hidden="true">/</span>
          <span className="t-sm" style={{ fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{crumb}</span>
        </nav>
        <SearchBox />
        <ChainSwitcher />
        <NotificationsBell />
        <WalletArea />
      </header>
    </div>
  );
}
