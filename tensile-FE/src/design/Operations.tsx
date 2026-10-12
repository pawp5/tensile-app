/* Operations console. Built from Operations.dc.html (same markup and classes); the work queue comes from
 * /ops/queue (identity reviews, reserve feeds, mint requests so far; later stages add their modules).
 * The risk-parameter table is still the design's sample until the risk stage wires it. */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../lib/api';
import { age, since } from '../lib/format';
import type { OpsRow } from '../lib/types';
import Sidebar, { PERSONA_LABEL } from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import { useOpsQueue } from '../state/account';
import { useNow, useWarehouses } from '../state/protocol';
import { useSession } from '../state/session';
import './Operations.css';

const QUEUES: [key: OpsRow['queue'], label: string, tone: string][] = [
  ['pending', 'Pending', 't-info'], ['attention', 'Attention required', 't-warning'], ['frozen', 'Frozen', 't-solid-danger'],
  ['disputed', 'Disputed', 't-danger'], ['expired', 'Expired', 't-neutral'], ['completed', 'Completed', 't-success'],
];
const MODULES = ['Identity', 'Warehouses', 'Mint requests', 'Inspections', 'AI reviews', 'Attestations', 'Reserve feeds', 'Loans', 'Liquidations', 'Redemptions', 'Disputes', 'Risk parameters', 'Fees'];
const PARAMS = [
  { m: 'Copper cathode', c: 'CU', max: '65.00%', liq: '77.00%', of: '0.50%', sf: '0.25%', feed: '24 h', rf: '10.00%', pend: '' },
  { m: 'Aluminium ingot', c: 'AL', max: '60.00%', liq: '72.00%', of: '0.50%', sf: '0.25%', feed: '24 h', rf: '10.00%', pend: '' },
  { m: 'Nickel briquette', c: 'NI', max: '65.00%', liq: '77.00%', of: '0.60%', sf: '0.25%', feed: '24 h', rf: '10.00%', pend: 'Max 65% → 60% · in 31 h' },
  { m: 'Zinc SHG', c: 'ZN', max: '60.00%', liq: '72.00%', of: '0.50%', sf: '0.25%', feed: '24 h', rf: '10.00%', pend: '' },
];
const OPEN = new Set(['pending', 'attention', 'frozen', 'disputed']);

export default function Operations() {
  const { me, persona, personas, setPersona, signedIn } = useSession();
  const now = useNow(30_000);
  // Opening the console means acting as staff: switch "Viewing as" to the staff persona this wallet holds.
  const staffPersona = personas.includes('ops') ? 'ops' : personas.includes('inspector') ? 'inspector' : null;
  useEffect(() => {
    if (staffPersona && persona !== 'ops' && persona !== 'inspector') setPersona(staffPersona);
  }, [staffPersona]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useOpsQueue();
  const frozen = (useWarehouses().data?.warehouses ?? []).filter((w) => w.frozen);
  const [queue, setQueue] = useState<OpsRow['queue']>('pending');
  const [mod, setMod] = useState('all');
  const [filter, setFilter] = useState('');
  const all = q.data?.rows ?? [];
  const forbidden = q.error instanceof ApiError && q.error.status === 403;

  const inMod = (r: OpsRow) => mod === 'all' || r.module === mod;
  const text = filter.trim().toLowerCase();
  const matches = (r: OpsRow) => !text || `${r.ref} ${r.warehouse} ${r.subject} ${r.who}`.toLowerCase().includes(text);
  const rows = all.filter((r) => r.queue === queue && inMod(r) && matches(r));
  const open = all.filter((r) => OPEN.has(r.queue));
  const oldest = open.reduce<string | null>((o, r) => (r.since && (!o || r.since < o) ? r.since : o), null);
  const mods = useMemo(
    () =>
      [['all', 'All modules'], ...MODULES.map((m) => [m, m])].map(([key, label]) => {
        const n = key === 'all' ? all.length : all.filter((r) => r.module === key).length;
        const hot = all.some((r) => r.module === key && (r.queue === 'frozen' || r.queue === 'disputed'));
        return { key, label, n, hot };
      }),
    [all],
  );
  const roleLabel = PERSONA_LABEL[persona][0];
  const qLabel = QUEUES.find(([k]) => k === queue)![1].toLowerCase();

  return (
    <div className="t-app">
      <div style={{ flex: '0 0 248px', display: 'flex', background: 'var(--bg-sunken)' }}>
        <Sidebar active="console" role="ops" />
      </div>
      <div className="t-main">
        <TopBar section="Operations" crumb="Console" />
        {frozen.map((w) => (
          <div key={w.warehouseId} className="t-banner-frozen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="M12 2v20M4 6l16 12M20 6L4 18" /></svg>
            <span>FROZEN · {w.name} · {(w.frozenReason ?? 'reserve review').replace(/_/g, ' ').toLowerCase()}</span>
            <a href={`/reserve?wh=${w.code ?? w.warehouseId}`} style={{ marginLeft: 'auto', color: 'var(--on-danger)', textDecoration: 'underline' }}>Open</a>
          </div>
        ))}
        <main className="t-content" style={{ maxWidth: '1440px' }}>
          <div className="t-between t-wrap" style={{ alignItems: 'flex-end' }}>
            <div className="t-stack" style={{ gap: '8px' }}>
              <span className="t-eyebrow">Operations console</span>
              <h1 className="t-h1">Protocol operations</h1>
              <span className="t-sm t-sec">{me?.identity.orgName ?? 'Staff'} · {roleLabel} · actions are signed and logged</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: '24px' }}>
              <div className="t-stack"><span className="t-cap">Open items</span><span className="t-num-md">{open.length}</span></div>
              <div className="t-stack"><span className="t-cap">Attention</span><span className="t-num-md t-fg-warning">{all.filter((r) => r.queue === 'attention').length}</span></div>
              <div className="t-stack"><span className="t-cap">Frozen</span><span className="t-num-md t-fg-danger">{all.filter((r) => r.queue === 'frozen').length}</span></div>
              <div className="t-stack"><span className="t-cap">Oldest open item</span><span className="t-num-md">{oldest ? age(oldest, now) : '—'}</span></div>
            </div>
          </div>

          {!signedIn || forbidden ? (
            <div className="t-alert t-warning">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: 'none', marginTop: '1px' }}><path d="M12 3l9 16H3zM12 10v4M12 17v.5" /></svg>
              <div>
                <p className="t-alert-title">{signedIn ? 'This console needs a staff role on this network' : 'Sign in with a staff wallet'}</p>
                <p className="t-alert-body">ADMIN, KYC_ADMIN, RISK_ADMIN or INSPECTOR on the selected network.</p>
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
            <nav aria-label="Modules" className="t-card t-card-dense" style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span className="t-eyebrow" style={{ padding: '4px 10px 8px' }}>Modules</span>
              {mods.map((m) => (
                <button key={m.key} className="ops-mod" onClick={() => setMod(m.key)} aria-pressed={mod === m.key ? 'true' : 'false'} style={{ background: mod === m.key ? 'var(--surface-active)' : 'transparent', color: mod === m.key ? 'var(--text)' : 'var(--text-secondary)' }}>
                  <span>{m.label}</span>
                  {m.n ? <span className="t-mono-sm" style={{ color: m.hot ? 'var(--danger-text)' : 'var(--text-muted)' }}>{m.n}</span> : null}
                </button>
              ))}
            </nav>
            <section style={{ flex: '999 1 640px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="t-tabs" role="tablist">
                {QUEUES.map(([k, label, tone]) => (
                  <button key={k} className="t-tab" role="tab" aria-selected={queue === k ? 'true' : 'false'} onClick={() => setQueue(k)}>
                    {label}
                    <span className={`t-badge ${tone}`} style={{ height: '18px', padding: '0 6px', marginLeft: '4px' }}>{all.filter((r) => r.queue === k && inMod(r)).length}</span>
                  </button>
                ))}
              </div>
              <div className="t-between">
                <span className="t-cap">{rows.length} items · {mod === 'all' ? 'all modules' : mod}</span>
                <div className="t-row" style={{ gap: '8px' }}>
                  <input className="t-input" style={{ height: '32px', width: '220px', fontSize: '13px' }} placeholder="Filter by ID or warehouse" value={filter} onChange={(e) => setFilter(e.target.value)} />
                  <button className="t-btn t-btn-sm t-btn-secondary" disabled title="Assignment arrives with the operations stage">Assign to me</button>
                </div>
              </div>
              {rows.length ? (
                <div className="t-table-wrap">
                  <table className="t-table t-dense">
                    <thead>
                      <tr>
                        <th>Reference</th><th>Subject</th><th>Warehouse</th><th>State</th><th className="t-right">Age</th><th>Assignee</th><th className="t-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const late = OPEN.has(r.queue) && since(r.since, now) > 24 * 3600_000;
                        return (
                          <tr key={`${r.module}:${r.ref}`}>
                            <td>
                              <span className="t-stack" style={{ gap: '2px' }}>
                                <span className="t-mono">{r.ref}</span>
                                <span className="t-cap">{r.module}</span>
                              </span>
                            </td>
                            <td style={{ whiteSpace: 'normal', minWidth: '200px' }}>{r.subject}</td>
                            <td><span className="t-mono t-sec">{r.warehouse}</span></td>
                            <td>
                              <span className={`t-badge ${r.tone}`}>
                                <span className={`t-dot ${r.queue === 'pending' ? 't-pulse' : ''}`} />
                                {r.state}
                              </span>
                            </td>
                            <td className={`t-right ${late ? 't-fg-warning' : ''}`}>{r.since ? age(r.since, now) : '—'}</td>
                            <td className="t-sec">{r.who}</td>
                            <td className="t-right"><Link to={r.href} className="t-btn t-btn-sm t-btn-ghost">{r.action}</Link></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="t-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '48px' }}>
                  <span className="t-h4">{q.isLoading ? 'Loading the queue…' : 'Nothing in this queue'}</span>
                  <span className="t-sm t-sec">No {mod === 'all' ? 'all modules' : mod} items are {qLabel}. New items appear here as they arrive.</span>
                </div>
              )}

              <div className="t-card t-card-flush" style={{ marginTop: '8px' }}>
                <div className="t-hazard" />
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="t-between t-wrap">
                    <div className="t-stack" style={{ gap: '4px' }}>
                      <span className="t-h4">Risk parameters and fees</span>
                      <span className="t-cap">Changes are proposed, need a second signer and take effect after a 48 h timelock. Existing loans keep their liquidation threshold until repaid.</span>
                    </div>
                    <button className="t-btn t-btn-sm t-btn-secondary" disabled>Propose change</button>
                  </div>
                  <div className="t-table-wrap">
                    <table className="t-table t-dense ops-wrap">
                      <thead>
                        <tr>
                          <th>Material</th><th className="t-right">Max LTV</th><th className="t-right">Liquidation LTV</th><th className="t-right">Origination fee</th>
                          <th className="t-right">Settlement fee</th><th className="t-right">Reserve feed limit</th><th className="t-right">Reserve factor</th><th>Pending</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PARAMS.map((p) => (
                          <tr key={p.c}>
                            <td>{p.m} <span className="t-mono-sm t-muted">{p.c}</span></td>
                            <td className="t-right">{p.max}</td>
                            <td className="t-right">{p.liq}</td>
                            <td className="t-right">{p.of}</td>
                            <td className="t-right">{p.sf}</td>
                            <td className="t-right">{p.feed}</td>
                            <td className="t-right">{p.rf}</td>
                            <td style={{ whiteSpace: 'normal' }}>{p.pend ? <span className="t-badge t-warning" style={{ height: 'auto', minHeight: '20px', whiteSpace: 'normal', lineHeight: '14px', padding: '3px 8px', borderRadius: '8px' }}>{p.pend}</span> : null}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
