/* Overview: the signed-in owner's portfolio. Built from Overview.dc.html (same markup and classes), fed by
 * /portfolio, /activity and /protocol/stats. Loans and lending yield fill in with the credit stage. */
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { activityIcon } from '../lib/activityIcons';
import { ago, coords, int, money, moneyParts, pct, tonnes, utc } from '../lib/format';
import type { PortfolioOut, ValuePoint } from '../lib/types';
import Sidebar from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import { useActivity, usePortfolio } from '../state/account';
import { useNow, useProtocolStats } from '../state/protocol';
import { useSession } from '../state/session';
import Orb from './Orb';
import './Overview.css';

const RANGES: [label: string, days: number][] = [['30D', 30], ['90D', 90], ['1Y', 365], ['All', 1825]];
const COLORS = ['var(--data-1)', 'var(--data-4)', 'var(--data-3)', 'var(--data-2)', 'var(--data-5)', 'var(--data-6)'];

const axisUsd = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' });
const rowTime = (iso: string | null) => (iso ? `${iso.slice(5, 10)} ${iso.slice(11, 16)}` : '—');

function chart(points: ValuePoint[]) {
  const values = points.flatMap((p) => [p.grossUsd, p.netUsd]);
  let lo = values.length ? Math.min(...values) : 0;
  let hi = values.length ? Math.max(...values) : 0;
  if (hi - lo < 1) [lo, hi] = [Math.max(0, hi * 0.8), hi * 1.2 || 1]; // flat line: centre it
  else [lo, hi] = [Math.max(0, lo - (hi - lo) * 0.25), hi + (hi - lo) * 0.15];
  const y = (v: number) => (220 - ((v - lo) / (hi - lo)) * 220).toFixed(1);
  const x = (i: number) => ((i / Math.max(1, points.length - 1)) * 600).toFixed(1);
  const line = (key: 'grossUsd' | 'netUsd') => points.map((p, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(p[key])).join(' ');
  const gross = line('grossUsd');
  const first = points[0]?.grossUsd ?? 0, last = points[points.length - 1]?.grossUsd ?? 0;
  const n = points.length;
  const empty = !values.some((v) => v > 0);
  return {
    empty,
    gross,
    grossArea: gross ? gross + ' L600 220 L0 220 Z' : '',
    net: line('netUsd'),
    ticks: empty ? [] : [0, 1, 2, 3].map((i) => axisUsd(hi - ((hi - lo) * i) / 3)),
    dates: n ? [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1].map((i) => shortDate(points[i].at)) : [],
    last,
    change: first ? (last - first) / first : 0,
  };
}

function Money({ v, unit }: { v: number | null | undefined; unit?: string }) {
  if (v == null) return <>—</>;
  const [whole, frac] = moneyParts(v);
  return (
    <>
      {unit ? '' : '$'}
      {whole}
      <span className="t-f">{frac}</span>
      {unit ? <span className="t-u">{unit}</span> : null}
    </>
  );
}

export default function Overview() {
  const { signedIn, me } = useSession();
  const [range, setRange] = useState(90);
  const [site, setSite] = useState('');
  const now = useNow(5000);
  const portfolio = usePortfolio(range);
  const activity = useActivity('mine', 8);
  const stats = useProtocolStats().data;
  const p: PortfolioOut | undefined = signedIn ? portfolio.data : undefined;
  const c = chart(p?.history ?? []);
  const rangeLabel = RANGES.find(([, d]) => d === range)?.[0] ?? '';
  const unhealthy = (p?.sites ?? []).filter((s) => !s.healthy);
  const verified = me?.identity.verified;
  const mine = (p?.sites ?? []).map((s) => s.code).filter(Boolean) as string[];
  const holdings = Object.fromEntries((p?.sites ?? []).map((s) => [s.code, `${s.lots} lot${s.lots === 1 ? '' : 's'} · ${tonnes(s.quantityKg)} t`]));
  const pickSite = (code: string) => setSite((cur) => (cur === code ? '' : code));
  const v = stats?.vault;
  const stale = stats ? Math.max(0, stats.warehouses - stats.healthyWarehouses - stats.frozenWarehouses) : 0;
  const protocol = stats
    ? [
        { k: 'Total vault assets', v: `${money(v?.totalAssetsUsdc ?? 0)} USDC`, d: `${pct(v?.utilization ?? 0)} deployed` },
        { k: 'Total borrowed', v: `${money(v?.deployedUsdc ?? 0)} USDC`, d: `${pct(v?.utilization ?? 0)} of vault deployed` },
        { k: 'Material value represented', v: `$${money(stats.materialValueUsd)}`, d: `${tonnes(stats.tokenizedKg)} t of metal` },
        { k: 'Active lots', v: int(stats.activeLots), d: `${int(stats.lotsMinted)} minted in total` },
        { k: 'Healthy warehouses', v: `${stats.healthyWarehouses} of ${stats.warehouses}`, d: `${stale} stale feed · ${stats.frozenWarehouses} frozen` },
      ]
    : [];

  return (
    <div className="t-app">
      <div style={{ flex: '0 0 248px', display: 'flex', background: 'var(--bg-sunken)' }}>
        <Sidebar active="overview" role="owner" />
      </div>
      <div className="t-main">
        <TopBar section="Tensile" crumb="Overview" />
        <main className="t-content">
          <div className="t-between t-wrap" style={{ alignItems: 'flex-end' }}>
            <div className="t-stack" style={{ gap: '8px' }}>
              <span className="t-eyebrow">Overview</span>
              <h1 className="t-h1">{p?.displayName ?? me?.identity.orgName ?? 'Overview'}</h1>
              <span className="t-sm t-sec">
                {!signedIn
                  ? 'Connect and sign in to see your portfolio'
                  : p
                    ? p.lotCount
                      ? `${tonnes(p.quantityKg)} t of metal in ${p.lotCount} lot${p.lotCount === 1 ? '' : 's'} across ${p.sites.length} warehouse${p.sites.length === 1 ? '' : 's'} · valued at ${utc(p.valuedAt)}`
                      : 'No lots yet · tokenize material to get started'
                    : 'Loading your portfolio…'}
              </span>
            </div>
            <div className="t-row t-wrap">
              <div className="t-seg" role="group" aria-label="Range">
                {RANGES.map(([label, days]) => (
                  <button key={label} aria-pressed={range === days ? 'true' : 'false'} onClick={() => setRange(days)}>{label}</button>
                ))}
              </div>
              <Link to="/tokenize" className="t-btn t-btn-primary">Tokenize material</Link>
            </div>
          </div>

          <section className="t-metrics" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', padding: '4px 0 8px' }}>
            <div className="t-metric" style={{ gap: '10px' }}>
              <span className="t-label">Portfolio value</span>
              <span className="t-num-lg t-lum"><Money v={p?.portfolioValueUsd} /></span>
              <span className="t-cap">{p ? `Lots $${money(p.lotsValueUsd)} · vault $${money(p.vault?.assetsUsdc ?? 0)}` : '—'}</span>
            </div>
            <div className="t-metric" style={{ gap: '10px' }}>
              <span className="t-label">Owned material</span>
              <span className="t-num-lg t-lum">
                {p ? tonnes(p.quantityKg) : '—'}
                <span className="t-u">t</span>
              </span>
              <span className="t-cap">{p?.byMaterial.length ? p.byMaterial.map((m) => `${m.symbol ?? m.name} ${tonnes(m.quantityKg)} t`).join(' · ') : 'No lots yet'}</span>
            </div>
            <div className="t-metric" style={{ gap: '10px' }}>
              <span className="t-label">Outstanding debt</span>
              <span className="t-num-lg t-lum"><Money v={p?.debtUsdc} unit="USDC" /></span>
              <span className="t-cap">{p?.debtUsdc ? 'Across your active loans' : 'No active loans'}</span>
            </div>
            <div className="t-metric t-metric-accent" style={{ gap: '10px' }}>
              <span className="t-label">Available borrowing capacity</span>
              <span className="t-num-lg t-fg-brand"><Money v={p?.borrowCapacityUsdc} unit="USDC" /></span>
              <Link to="/borrow" className="t-sm">Borrow against a lot →</Link>
            </div>
          </section>

          {signedIn && me && !verified ? (
            <div className="t-alert t-info">
              <span className="t-dot" style={{ color: 'var(--info)', marginTop: '7px' }} />
              <div style={{ flex: '1' }}>
                <p className="t-alert-title">{me.identity.status === 'in_review' ? 'Your verification is in review' : 'Verify your organisation to hold, borrow and trade lots'}</p>
                <p className="t-alert-body">You can browse everything meanwhile. Tokenizing, borrowing, listing and redeeming unlock once your wallet is verified.</p>
              </div>
              <Link to="/onboarding" className="t-btn t-btn-sm t-btn-secondary" style={{ marginLeft: 'auto' }}>Open verification</Link>
            </div>
          ) : null}

          {unhealthy.length ? (
            <div className="t-alert t-warning">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: 'none', marginTop: '1px' }}>
                <path d="M12 3l9 16H3zM12 10v4M12 17v.5" />
              </svg>
              <div style={{ flex: '1' }}>
                <p className="t-alert-title">Reserve issue at {unhealthy.map((s) => s.name).join(', ')}</p>
                <p className="t-alert-body">New minting and borrowing against lots there are paused until the warehouse posts a fresh, covering attestation. Your lots and existing loans are unaffected.</p>
              </div>
            </div>
          ) : null}

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '24px' }}>
            <div className="t-card" style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
              <div className="t-between t-wrap">
                <div className="t-stack" style={{ gap: '4px' }}>
                  <span className="t-h4">Portfolio value</span>
                  <span className="t-cap">Gross value and net of debt, {rangeLabel === 'All' ? 'all time' : rangeLabel.replace('D', ' days').replace('1Y', '1 year')}</span>
                </div>
                <div className="t-row" style={{ gap: '16px' }}>
                  <span className="t-row t-cap" style={{ gap: '6px' }}><span style={{ width: '12px', height: '2px', background: 'var(--data-1)' }} />Gross</span>
                  <span className="t-row t-cap" style={{ gap: '6px' }}><span style={{ width: '12px', height: '2px', background: 'var(--data-2)' }} />Net of debt</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', gap: '8px' }}>
                <div className="t-stack t-cap" style={{ justifyContent: 'space-between', textAlign: 'right', height: '220px' }}>
                  {(c.ticks.length ? c.ticks : ['', '', '', '']).map((t, i) => <span key={i}>{t}</span>)}
                </div>
                <div style={{ position: 'relative', height: '220px', borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                  <svg viewBox="0 0 600 220" preserveAspectRatio="none" style={{ position: 'absolute', inset: '0', width: '100%', height: '100%' }} aria-label={`Line chart: portfolio value over ${rangeLabel}, now $${money(c.last)}`}>
                    <path d="M0 55H600M0 110H600M0 165H600" stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none" />
                    {c.gross ? (
                      <>
                        <path d={c.grossArea} fill="var(--brand-subtle)" opacity="0.6" />
                        <path key={`g${range}`} d={c.gross} pathLength={1} className="t-draw" stroke="var(--data-1)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
                        <path key={`n${range}`} d={c.net} pathLength={1} className="t-draw" stroke="var(--data-2)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
                      </>
                    ) : null}
                  </svg>
                  {p && c.empty ? (
                    <div style={{ position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                      <span className="t-cap">Your portfolio value charts here once you hold lots or vault shares.</span>
                    </div>
                  ) : null}
                  <div style={{ position: 'absolute', right: '8px', top: '-22px', height: '37px', width: '140px' }} className="t-stack">
                    <span className="t-num" style={{ textAlign: 'right' }}>{p ? `$${money(c.last)}` : '—'}</span>
                    <span className="t-cap t-right">{p ? `${c.change >= 0 ? '+' : ''}${pct(c.change)} · ${rangeLabel === 'All' ? 'all' : rangeLabel.toLowerCase().replace('d', ' d')}` : ''}</span>
                  </div>
                </div>
              </div>
              <div className="t-between t-cap" style={{ paddingLeft: '72px' }}>
                {(c.dates.length ? c.dates : ['', '', '', '']).map((d, i) => <span key={i}>{d}</span>)}
              </div>
            </div>

            <div className="t-card" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
              <div className="t-stack" style={{ gap: '4px' }}>
                <span className="t-h4">Material value by class</span>
                <span className="t-cap">Indicative value, your lots</span>
              </div>
              {(p?.byMaterial ?? []).map((m, i) => (
                <div key={m.material ?? i} className="t-stack" style={{ gap: '6px' }}>
                  <div className="t-between">
                    <span className="t-sm">
                      {m.name.split(',')[0]} <span className="t-mono-sm t-muted">{m.symbol}</span>
                    </span>
                    <span className="t-num">${money(m.valueUsd)}</span>
                  </div>
                  <div className="t-meter">
                    <div className="t-meter-fill" style={{ width: `${(m.share * 100).toFixed(1)}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                  <span className="t-cap">
                    {tonnes(m.quantityKg)} t · {m.lots} lot{m.lots === 1 ? '' : 's'} · {pct(m.share, 1)} of portfolio
                  </span>
                </div>
              ))}
              {p && !p.byMaterial.length ? <span className="t-cap">Your lots will be valued here at reference prices.</span> : null}
              <div className="t-hr" />
              <div className="t-between">
                <span className="t-sm t-sec">Vault position (USDC)</span>
                <span className="t-num">{p ? `$${money(p.vault?.assetsUsdc ?? 0)}` : '—'}</span>
              </div>
            </div>

            <div className="t-card" style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '0' }}>
              <div className="t-between">
                <div className="t-stack" style={{ gap: '4px' }}>
                  <span className="t-h4">Borrowing utilization</span>
                  <span className="t-cap">Debt against each pledged lot</span>
                </div>
                <Link to="/borrow" className="t-sm">Borrow</Link>
              </div>
              {(p?.lots ?? []).slice(0, 4).map((l) => (
                <div key={l.tokenId} className="t-stack" style={{ gap: '8px', paddingBottom: '20px' }}>
                  <div className="t-between">
                    <span className="t-row" style={{ gap: '8px' }}>
                      <a href={`/lots/${l.tokenId}`} className="t-mono">{l.displayId}</a>
                      <span className={`t-badge ${l.state === 'REDEEMING' ? 't-info' : 't-success'}`}>{l.state}</span>
                    </span>
                    <span className="t-num">0.00% <span className="t-muted">LTV</span></span>
                  </div>
                  <div className="t-meter">
                    <div className="t-meter-fill" style={{ width: '0%', background: 'var(--data-2)' }} />
                    <span className="t-mark t-mark-warn" style={{ left: '65%' }} />
                    <span className="t-mark-label" style={{ left: '65%' }}>Max 65%</span>
                    <span className="t-mark t-mark-danger" style={{ left: '77%' }} />
                    <span className="t-mark-label" style={{ left: '82%' }}>Liq. 77%</span>
                  </div>
                  <span className="t-cap" style={{ paddingTop: '8px' }}>
                    No debt · {l.maxBorrowUsdc != null ? `${money(l.maxBorrowUsdc)} USDC available to borrow` : 'no reference price yet'}
                  </span>
                </div>
              ))}
              {p && !p.lots.length ? <span className="t-cap">Pledge a lot to borrow USDC against it. Your loans will show here.</span> : null}
            </div>

            <div className="t-card" style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
              <div className="t-between">
                <div className="t-stack" style={{ gap: '4px' }}>
                  <span className="t-h4">Lending yield and accrual</span>
                  <span className="t-cap">Your vault shares and the credit vault</span>
                </div>
                <Link to="/lend" className="t-sm">Vault</Link>
              </div>
              <div className="t-row" style={{ gap: '32px' }}>
                <div className="t-stack">
                  <span className="t-label">Your position</span>
                  <span className="t-num-md">{p ? money(p.vault?.assetsUsdc ?? 0) : '—'} <span className="t-u">USDC</span></span>
                </div>
                <div className="t-stack">
                  <span className="t-label">Vault assets</span>
                  <span className="t-num-md">{v ? money(v.totalAssetsUsdc, 0) : '—'} <span className="t-u">USDC</span></span>
                </div>
                <div className="t-stack">
                  <span className="t-label">Utilization</span>
                  <span className="t-num-md">{v ? pct(v.utilization) : '—'}</span>
                </div>
              </div>
              <div className="t-bars" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', height: '120px', borderBottom: '1px solid var(--border)' }}>
                <span className="t-cap">{p?.vault?.assetsUsdc ? 'Daily accrual appears after a full day in the vault.' : 'Deposit USDC into the credit vault to start earning.'}</span>
              </div>
              <div className="t-between t-cap">
                <span />
                <span>Interest, USDC per day</span>
                <span />
              </div>
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="t-between">
              <div className="t-stack" style={{ gap: '4px' }}>
                <span className="t-eyebrow">Protocol</span>
                <span className="t-h3">Tensile today</span>
              </div>
              <span className="t-cap">{stats?.updatedAt ? `Updated ${ago(stats.updatedAt, now)}` : ''}</span>
            </div>
            <div className="t-metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              {protocol.map((m) => (
                <div key={m.k} className="t-metric" style={{ gap: '8px' }}>
                  <span className="t-label">{m.k}</span>
                  <span className="t-num-md">{m.v}</span>
                  <span className="t-cap">{m.d}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '24px' }}>
            <div className="t-card" style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
              <div className="t-stack" style={{ gap: '4px' }}>
                <span className="t-h4">Where your metal is</span>
                <span className="t-cap">Physical custody and reserve health · select a warehouse</span>
              </div>
              <div className="t-parallax" style={{ display: 'flex', justifyContent: 'center' }}>
                <Orb mode="portfolio" focus={site} compact w={380} onFocus={pickSite} mine={p ? mine : undefined} holdings={p ? holdings : undefined} />
              </div>
              {(p?.sites ?? []).map((s) => {
                const on = site === s.code;
                const health = !s.fresh ? ['Stale feed', 't-warning'] : !s.healthy ? ['Reserve issue', 't-danger'] : ['Healthy', 't-success'];
                return (
                  <button key={s.warehouseId} onClick={() => pickSite(s.code ?? '')} aria-pressed={on ? 'true' : 'false'} className="t-well t-lift" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', color: 'var(--text)', cursor: 'pointer', border: '0', font: 'inherit', background: on ? 'rgba(215,252,253,.07)' : 'rgba(0,10,11,.28)' }}>
                    <div className="t-between">
                      <div className="t-stack">
                        <span className="t-sm" style={{ fontWeight: '500' }}>{s.name}</span>
                        <span className="t-mono-sm t-muted">{s.code} · {coords(s.lat, s.lon)}</span>
                      </div>
                      <span className={`t-badge t-badge-word ${health[1]}`}><span className="t-dot" />{health[0]}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                      <div className="t-stack"><span className="t-cap">Your lots</span><span className="t-num">{s.lots} · {tonnes(s.quantityKg)} t</span></div>
                      <div className="t-stack"><span className="t-cap">Coverage</span><span className="t-num">{s.coverage != null ? pct(s.coverage) : '—'}</span></div>
                      <div className="t-stack"><span className="t-cap">Last attestation</span><span className="t-num">{ago(s.reportedAt, now)}</span></div>
                    </div>
                  </button>
                );
              })}
              {p && !p.sites.length ? <span className="t-cap">Warehouses holding your lots will be listed here.</span> : null}
            </div>

            <div className="t-card t-card-flush" style={{ gridColumn: 'span 7', minWidth: '0' }}>
              <div className="t-between" style={{ padding: '20px 20px 12px' }}>
                <span className="t-h4">Recent activity</span>
                <Link to="/portfolio" className="t-sm">All transactions</Link>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="t-table t-dense">
                  <tbody>
                    {(signedIn ? activity.data?.items ?? [] : []).map((a) => (
                      <tr key={a.id}>
                        <td style={{ whiteSpace: 'normal' }}>
                          <span className="t-row" style={{ gap: '10px' }}>
                            <span style={{ width: '28px', height: '28px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-sunken)', border: '1px solid var(--border)', color: 'var(--text-secondary)', flex: 'none' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={activityIcon(a.kind)} /></svg>
                            </span>
                            <span className="t-sm" style={{ fontWeight: '500' }}>{a.title}</span>
                          </span>
                        </td>
                        <td><span className="t-mono t-sec">{a.href && a.ref ? <Link to={a.href}>{a.ref}</Link> : a.ref ?? '—'}</span></td>
                        <td style={{ whiteSpace: 'normal', maxWidth: '160px' }}><span className="t-sm t-sec">{a.actor ?? '—'}</span></td>
                        <td className="t-right"><span className="t-num">{a.amount ?? ''}</span></td>
                        <td className="t-right"><span className="t-mono-sm t-muted" style={{ fontWeight: '400' }}>{rowTime(a.at)}</span></td>
                      </tr>
                    ))}
                    {signedIn && activity.data && !activity.data.items.length ? (
                      <tr><td colSpan={5}><span className="t-cap">No activity yet. Mint requests, inspections, loans and trades on your lots appear here.</span></td></tr>
                    ) : null}
                    {!signedIn ? (
                      <tr><td colSpan={5}><span className="t-cap">Sign in to see your activity.</span></td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
