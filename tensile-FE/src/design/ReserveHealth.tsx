// @ts-nocheck
/* Generated from ReserveHealth.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic } from './runtime';
import Orb from './Orb';
import Sidebar from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import './ReserveHealth.css';

class ReserveHealthLogic extends DCLogic {
  state = { sel: 'PKL-WST-02', stage: 'frozen' };
  renderVals() {
    const stage = this.state.stage;
    const pklHealthy = stage === 'healthy';
    const W = [
      { code: 'RTM-BOT-04', name: 'Rotterdam Botlek 04', region: 'Europe · NL', op: 'Portline Warehousing B.V.', res: '500,000', out: '450,000', cov: '111.11%', fill: '90%', mark: '100%', feed: 'fresh', upd: '2 h ago', status: 'Healthy', kind: 'ok' },
      { code: 'ANR-DEL-03', name: 'Antwerp Deurganck 03', region: 'Europe · BE', op: 'Scheldt Bonded NV', res: '1,280,000', out: '1,082,900', cov: '118.20%', fill: '84.6%', mark: '100%', feed: 'fresh', upd: '1 h ago', status: 'Healthy', kind: 'ok' },
      { code: 'SIN-JUR-01', name: 'Singapore Jurong 01', region: 'Asia · SG', op: 'Jurong Bonded Logistics', res: '620,000', out: '498,800', cov: '124.30%', fill: '80.5%', mark: '100%', feed: 'fresh', upd: '41 min ago', status: 'Healthy', kind: 'ok' },
      { code: 'HOU-SHP-05', name: 'Houston Ship Channel 05', region: 'Americas · US', op: 'Gulfside Terminals LLC', res: '900,000', out: '820,050', cov: '109.75%', fill: '91.1%', mark: '100%', feed: 'fresh', upd: '3 h ago', status: 'Healthy', kind: 'ok' },
      { code: 'DUR-BAY-01', name: 'Durban Bayhead 01', region: 'Africa · ZA', op: 'Bayhead Terminals (Pty) Ltd', res: '780,000', out: '750,000', cov: '104.00%', fill: '96.2%', mark: '100%', feed: 'stale', upd: '26 h ago', status: 'Stale reserve feed', kind: 'stale', note: 'No attestation for 26 hours (limit 24 h). New mint and borrowing at this warehouse pause until a fresh attestation arrives. Transfers continue. An open redemption dispute (DS-0012) also involves this warehouse.' },
      pklHealthy
        ? { code: 'PKL-WST-02', name: 'Port Klang West 02', region: 'Asia · MY', op: 'Straits Bonded Storage Sdn Bhd', res: '312,000', out: '300,000', cov: '104.00%', fill: '96.2%', mark: '100%', feed: 'fresh', upd: '12 min ago', status: 'Reconciled', kind: 'ok' }
        : { code: 'PKL-WST-02', name: 'Port Klang West 02', region: 'Asia · MY', op: 'Straits Bonded Storage Sdn Bhd', res: stage === 'recon' ? '312,000' : '250,000', out: '300,000', cov: stage === 'recon' ? '104.00%' : '83.33%', fill: stage === 'recon' ? '96.2%' : '100%', mark: stage === 'recon' ? '100%' : '83.33%', feed: 'fresh', upd: stage === 'recon' ? '12 min ago' : '1 h ago', status: stage === 'recon' ? 'Frozen · reconciled' : 'Reserve breach · frozen', kind: stage === 'recon' ? 'frozenok' : 'breach' }
    ];
    const look = {
      ok: ['t-success', 'var(--border)', 'var(--data-1)', 'var(--success)', 't-fg-success'],
      stale: ['t-warning', 'var(--warning-border)', 'var(--data-1)', 'var(--warning)', ''],
      breach: ['t-solid-danger', 'var(--danger)', 'var(--danger)', 'var(--success)', 't-fg-danger'],
      frozenok: ['t-danger', 'var(--danger-border)', 'var(--data-1)', 'var(--success)', 't-fg-success']
    };
    const whs = W.map((w) => { const L = look[w.kind]; const sel = this.state.sel === w.code; return { ...w, tone: L[0], bd: sel ? 'var(--brand)' : L[1], fillC: L[2], feedC: L[3], covFg: L[4], ring: sel ? '0 0 0 1px var(--brand)' : 'none', pick: () => this.setState({ sel: w.code }) }; });
    const d = whs.find((w) => w.code === this.state.sel);
    const isPkl = d.code === 'PKL-WST-02';
    const stages = [['frozen', 'Breach'], ['recon', 'Reconciled'], ['healthy', 'Unfrozen']].map(([k, label]) => ({ label, on: stage === k ? 'true' : 'false', pick: () => this.setState({ stage: k }) }));
    const steps = [
      ['Reserve breach', 'Coverage 83.33% at 2026-10-08 10:58 UTC'],
      ['Warehouse frozen', 'Automatic, same block'],
      ['New mint blocked', 'Pending request MR-1190 held'],
      ['New borrowing blocked', '3 open loans unaffected'],
      ['Transfers blocked', 'Listings paused; RFQ escrow kept'],
      ['Reconciliation', 'Physical count and new attestation'],
      ['Unfreeze', 'Two operators sign']
    ];
    const reached = { frozen: 4, recon: 5, healthy: 6 }[stage];
    const chain = steps.map(([t, d2], i) => {
      const done = i <= reached;
      const danger = i <= 4 && stage === 'frozen';
      const cur = i === reached;
      return { n: String(i + 1).padStart(2, '0'), t, d: d2, st: cur ? 'NOW' : (done ? 'DONE' : 'NEXT'),
        bg: danger ? (i === 1 ? 'var(--danger)' : 'var(--danger-subtle)') : (done ? 'var(--success-subtle)' : 'var(--bg-sunken)'),
        bd: danger ? 'var(--danger-border)' : (done ? 'var(--success-border)' : 'var(--border)'),
        fg: danger ? (i === 1 ? 'var(--on-danger)' : 'var(--danger-text)') : (done ? 'var(--success-text)' : 'var(--text-muted)') };
    });
    const affected = [
      { id: 'TNS-AL-00240', o: 'Malacca Base Metals', q: '60,000 kg', l: 'FREE', tone: 't-success' },
      { id: 'TNS-AL-00236', o: 'Ardent Metals FZE', q: '40,000 kg', l: 'PLEDGED', tone: 't-info' },
      { id: 'TNS-ZN-00049', o: 'Kestrel Commodities', q: '25,000 kg', l: 'PLEDGED', tone: 't-info' },
      { id: 'TNS-AL-00231', o: 'Straits Alloy Pte. Ltd.', q: '35,000 kg', l: 'FREE', tone: 't-success' }
    ];
    const recon = [
      { s: stage === 'frozen' ? 'IN PROGRESS' : 'DONE', tone: stage === 'frozen' ? 't-info' : 't-success', t: 'Physical recount by Meridian Survey' },
      { s: stage === 'frozen' ? 'PENDING' : 'DONE', tone: stage === 'frozen' ? 't-neutral' : 't-success', t: 'Operator explains variance: 62,000 kg mis-booked to another client' },
      { s: stage === 'frozen' ? 'PENDING' : 'DONE', tone: stage === 'frozen' ? 't-neutral' : 't-success', t: 'Fresh reserve attestation ≥ 300,000 kg' },
      { s: stage === 'healthy' ? 'DONE' : 'PENDING', tone: stage === 'healthy' ? 't-success' : 't-neutral', t: 'Two-operator unfreeze' }
    ];
    return {
      pickWh: (code) => this.setState({ sel: code }), whs, d, isPkl, notPkl: !isPkl, stages, chain, affected, recon,
      dBd: d.kind === 'breach' ? 'var(--danger)' : (d.kind === 'stale' ? 'var(--warning-border)' : 'var(--border)'),
      frozen: !pklHealthy, breachCount: pklHealthy ? '0 frozen' : '1 frozen',
      isFrozenStage: stage === 'frozen', isReconciled: stage === 'recon', isHealthyStage: stage === 'healthy',
      unfreeze: () => this.setState({ stage: 'healthy' })
    };
  }
}

export default class ReserveHealth extends ReserveHealthLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-app">
        <div style={{ flex: "0 0 248px", display: "flex", background: "var(--bg-sunken)" }}>
          <Sidebar active="reserve" role="ops" />
        </div>
        <div className="t-main">
          <TopBar section="Operations" crumb="Reserve health" network="degraded" />
          {$v.frozen ? (
            <>
              <div className="t-banner-frozen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 2v20M4 6l16 12M20 6L4 18" />
                </svg>
                {" "}
                <span>
                  FROZEN · Port Klang West 02 · reserve breach at 83.33% coverage. Mint, borrowing and transfers are blocked for 9 lots.
                </span>
                {" "}
                <a href="#detail" style={{ marginLeft: "auto", color: "var(--on-danger)", textDecoration: "underline" }}>
                  Investigate
                </a>
              </div>
            </>
          ) : null}
          <main className="t-content">
            <div className="t-between t-wrap" style={{ alignItems: "flex-end" }}>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-eyebrow">
                  Reserve health · F-6
                </span>
                <h1 className="t-h1">
                  Warehouses and reserve feeds
                </h1>
                <span className="t-sm t-sec">
                  Every warehouse must hold at least as much metal as Tensile has tokenized there. Coverage below 100% freezes the warehouse.
                </span>
              </div>
              <div className="t-row" style={{ gap: "8px" }}>
                <span className="t-badge t-badge-word t-success">
                  <span className="t-dot" />
                  4 healthy
                </span>
                <span className="t-badge t-badge-word t-warning">
                  <span className="t-dot" />
                  1 stale
                </span>
                <span className="t-badge t-badge-word t-solid-danger">
                  <span className="t-dot" />
                  <span className="sc-interp">{$v.breachCount}</span>
                </span>
              </div>
            </div>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
              {($v.whs ?? []).map((w, $i0) => (
                <Fragment key={$i0}>
                  <button onClick={w?.pick} className="t-card" style={{ textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: "14px", color: "var(--text)", borderColor: w?.bd, boxShadow: w?.ring }}>
                    <div className="t-between" style={{ alignItems: "flex-start" }}>
                      <div className="t-stack">
                        <span className="t-h4">
                          <span className="sc-interp">{w?.name}</span>
                        </span>
                        <span className="t-mono-sm t-muted" style={{ fontWeight: "400" }}>
                          <span className="sc-interp">{w?.code}</span>
                          {" · "}
                          <span className="sc-interp">{w?.region}</span>
                        </span>
                      </div>
                      <span className={`t-badge t-badge-word ${w?.tone ?? ''}`}>
                        <span className="t-dot" />
                        <span className="sc-interp">{w?.status}</span>
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
                      <div className="t-stack">
                        <span className="t-cap">
                          Physical reserve
                        </span>
                        <span className="t-num">
                          <span className="sc-interp">{w?.res}</span>
                          {" kg"}
                        </span>
                      </div>
                      <div className="t-stack">
                        <span className="t-cap">
                          Tokenized
                        </span>
                        <span className="t-num">
                          <span className="sc-interp">{w?.out}</span>
                          {" kg"}
                        </span>
                      </div>
                      <div className="t-stack">
                        <span className="t-cap">
                          Coverage
                        </span>
                        <span className={`t-num-md ${w?.covFg ?? ''}`}>
                          <span className="sc-interp">{w?.cov}</span>
                        </span>
                      </div>
                    </div>
                    <div style={{ paddingBottom: "6px" }}>
                      <div className="t-meter">
                        <div className="t-meter-fill" style={{ width: w?.fill, background: w?.fillC }} />
                        <span className="t-mark" style={{ left: w?.mark }} />
                      </div>
                    </div>
                    <div className="t-between t-cap">
                      <span className="t-row" style={{ gap: "6px" }}>
                        <span className="t-dot" style={{ color: w?.feedC }} />
                        {"Feed "}
                        <span className="sc-interp">{w?.feed}</span>
                      </span>
                      <span>
                        {"Updated "}
                        <span className="sc-interp">{w?.upd}</span>
                      </span>
                    </div>
                  </button>
                </Fragment>
              ))}
            </section>
            <section id="detail" className="t-card t-stack" style={{ gap: "24px", borderColor: $v.dBd }}>
              <div className="t-between t-wrap">
                <div className="t-stack" style={{ gap: "4px" }}>
                  <span className="t-eyebrow">
                    Investigation
                  </span>
                  <span className="t-h2">
                    <span className="sc-interp">{$v.d?.name}</span>
                  </span>
                  <span className="t-sm t-sec">
                    <span className="sc-interp">{$v.d?.code}</span>
                    {" · "}
                    <span className="sc-interp">{$v.d?.region}</span>
                    {" · operator "}
                    <span className="sc-interp">{$v.d?.op}</span>
                  </span>
                </div>
                {$v.isPkl ? (
                  <>
                    <div className="t-seg" role="group" aria-label="Stage">
                      {($v.stages ?? []).map((s, $i0) => (
                        <Fragment key={$i0}>
                          <button aria-pressed={s?.on} onClick={s?.pick}>
                            <span className="sc-interp">{s?.label}</span>
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Orb mode="reserve" focus={$v.d?.code} onFocus={$v.pickWh} w="640" />
              </div>
              <div className="t-metrics" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))", rowGap: "16px" }}>
                <div className="t-metric" style={{ gap: "4px" }}>
                  <span className="t-label">
                    Physical reserve
                  </span>
                  <span className="t-num-md">
                    <span className="sc-interp">{$v.d?.res}</span>
                    <span className="t-u">
                      kg
                    </span>
                  </span>
                </div>
                <div className="t-metric" style={{ gap: "4px" }}>
                  <span className="t-label">
                    Tokenized outstanding
                  </span>
                  <span className="t-num-md">
                    <span className="sc-interp">{$v.d?.out}</span>
                    <span className="t-u">
                      kg
                    </span>
                  </span>
                </div>
                <div className="t-metric" style={{ gap: "4px", borderColor: $v.dBd }}>
                  <span className="t-label">
                    Coverage
                  </span>
                  <span className={`t-num-lg ${$v.d?.covFg ?? ''}`}>
                    <span className="sc-interp">{$v.d?.cov}</span>
                  </span>
                </div>
                <div className="t-metric" style={{ gap: "4px" }}>
                  <span className="t-label">
                    Feed freshness
                  </span>
                  <span className="t-num-md">
                    <span className="sc-interp">{$v.d?.feed}</span>
                  </span>
                  <span className="t-cap">
                    <span className="sc-interp">{$v.d?.upd}</span>
                  </span>
                </div>
                <div className="t-metric" style={{ gap: "4px" }}>
                  <span className="t-label">
                    Health status
                  </span>
                  <span className={`t-badge t-badge-word ${$v.d?.tone ?? ''}`} style={{ alignSelf: "flex-start" }}>
                    <span className="t-dot" />
                    <span className="sc-interp">{$v.d?.status}</span>
                  </span>
                </div>
              </div>
              {$v.isPkl ? (
                <>
                  <div className="t-stack" style={{ gap: "12px" }}>
                    <span className="t-h4">
                      Breach response
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "6px" }}>
                      {($v.chain ?? []).map((c, $i0) => (
                        <Fragment key={$i0}>
                          <div className="t-stack" style={{ gap: "6px", padding: "14px 12px", borderRadius: "12px", background: c?.bg, border: `1px solid ${c?.bd ?? ''}`, color: c?.fg, minHeight: "112px" }}>
                            <span className="t-mono-sm">
                              <span className="sc-interp">{c?.n}</span>
                              {" · "}
                              <span className="sc-interp">{c?.st}</span>
                            </span>
                            {" "}
                            <span className="t-sm" style={{ fontWeight: "600" }}>
                              <span className="sc-interp">{c?.t}</span>
                            </span>
                            {" "}
                            <span className="t-cap" style={{ color: "inherit", opacity: ".85" }}>
                              <span className="sc-interp">{c?.d}</span>
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "24px" }}>
                    <div className="t-stack" style={{ gap: "8px" }}>
                      <span className="t-h4">
                        Affected lots
                      </span>
                      <div className="t-table-wrap">
                        <table className="t-table t-dense">
                          <thead>
                            <tr>
                              <th>
                                Lot
                              </th>
                              <th>
                                Owner
                              </th>
                              <th className="t-right">
                                Quantity
                              </th>
                              <th>
                                Lien
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {($v.affected ?? []).map((a, $i0) => (
                              <Fragment key={$i0}>
                                <tr>
                                  <td>
                                    <span className="t-mono">
                                      <span className="sc-interp">{a?.id}</span>
                                    </span>
                                  </td>
                                  <td className="t-sec">
                                    <span className="sc-interp">{a?.o}</span>
                                  </td>
                                  <td className="t-right">
                                    <span className="sc-interp">{a?.q}</span>
                                  </td>
                                  <td>
                                    <span className={`t-badge ${a?.tone ?? ''}`}>
                                      <span className="sc-interp">{a?.l}</span>
                                    </span>
                                  </td>
                                </tr>
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <span className="t-cap">
                        9 lots · 300,000 kg · 3 pledged, 61,880.00 USDC debt. Loans keep accruing; liquidations are paused while frozen.
                      </span>
                    </div>
                    <div className="t-card t-card-flush" style={{ background: "var(--bg-sunken)" }}>
                      <div className="t-hazard" />
                      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div className="t-between">
                          <span className="t-h4">
                            Warehouse controls
                          </span>
                          <span className="t-mono-sm t-muted">
                            PROTOCOL-WIDE
                          </span>
                        </div>
                        <div className="t-stack" style={{ gap: "8px" }}>
                          {($v.recon ?? []).map((r, $i0) => (
                            <Fragment key={$i0}>
                              <div className="t-row t-sm" style={{ gap: "10px" }}>
                                <span className={`t-badge t-badge-word ${r?.tone ?? ''}`} style={{ width: "84px", justifyContent: "center" }}>
                                  <span className="sc-interp">{r?.s}</span>
                                </span>
                                <span className="t-sec">
                                  <span className="sc-interp">{r?.t}</span>
                                </span>
                              </div>
                            </Fragment>
                          ))}
                        </div>
                        {$v.isFrozenStage ? (
                          <>
                            <button className="t-btn" disabled>
                              Unfreeze warehouse
                            </button>
                            {" "}
                            <span className="t-reason">
                              Unfreeze unavailable: coverage is 83.33%. A reconciled reserve attestation of at least 300,000 kg is required.
                            </span>
                          </>
                        ) : null}
                        {" "}
                        {$v.isReconciled ? (
                          <>
                            <button className="t-btn t-btn-primary" onClick={$v.unfreeze}>
                              Unfreeze Port Klang West 02
                            </button>
                            {" "}
                            <span className="t-cap">
                              Requires a second operator's signature. Both are recorded in the warehouse log.
                            </span>
                          </>
                        ) : null}
                        {" "}
                        {$v.isHealthyStage ? (
                          <>
                            <button className="t-btn t-btn-danger-outline">
                              Freeze warehouse
                            </button>
                            {" "}
                            <span className="t-cap">
                              Unfrozen 2026-10-08 12:30 UTC by A. Mensah and R. Okoye.
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
              {" "}
              {$v.notPkl ? (
                <>
                  <div className="t-row t-wrap" style={{ gap: "12px" }}>
                    <span className="t-sm t-sec">
                      <span className="sc-interp">{$v.d?.note}</span>
                    </span>
                    <button className="t-btn t-btn-sm t-btn-secondary">
                      Open feed log
                    </button>
                    <button className="t-btn t-btn-sm t-btn-danger-outline">
                      Freeze warehouse
                    </button>
                  </div>
                </>
              ) : null}
            </section>
          </main>
        </div>
      </div>
    );
  }
}
