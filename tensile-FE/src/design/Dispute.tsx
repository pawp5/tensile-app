// @ts-nocheck
/* Generated from Dispute.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic } from './runtime';
import Sidebar from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import './Dispute.css';

class DisputeLogic extends DCLogic {
  state = { phase: 'after' };
  renderVals() {
    const p = this.state.phase;
    const phases = [['before', 'Before SLA'], ['after', 'SLA passed'], ['disputed', 'Disputed']].map(([k, label]) => ({ label, on: p === k ? 'true' : 'false', pick: () => this.setState({ phase: k }) }));
    const before = p === 'before', disputed = p === 'disputed';
    const C = (t, at, who, d, node) => ({ t, at, who, d, node });
    const chron = [
      C('Redemption requested', '09-29 10:00', 'Halden Metals', 'Lot locked as REDEEMING', 't-node-done'),
      C('Collector verified', '09-29 10:20', 'Halden Metals', 'Pasir Freight · code issued', 't-node-done'),
      C('Collector on site', '10-05 08:40', 'Bayhead Terminals', 'Bags not located; no release', before ? '' : 't-node-done'),
      C('SLA expired', '10-06 10:00', 'Tensile protocol', 'No release proof posted', before ? '' : 't-node-danger'),
      C('Reserve feed stale', '10-07 10:00', 'DUR-BAY-01 feed', 'No attestation for 26 h', before ? '' : 't-node-done'),
      ...(disputed ? [C('Dispute raised', '10-08 12:05', 'Halden Metals', 'DS-0012 · operations alerted', 't-node-danger'), C('Operations review', '10-08 12:09', 'A. Mensah, Tensile ops', 'Assigned; evidence requested', 't-node-active')] : [])
    ].map((e, i, a) => ({ ...e, line: i < a.length - 1 }));
    return {
      phases, chron, isBefore: before, isAfter: p === 'after', disputed,
      rdState: disputed ? 'DISPUTED' : 'PENDING', rdTone: disputed ? 't-danger' : 't-info',
      elapsed: before ? '5 d 20 h' : '9 d 2 h',
      slaNote: before ? 'In 1 d 4 h' : 'Missed by 2 d 2 h', slaFg: before ? '' : 't-fg-danger',
      slaBig: before ? '1 d 4 h remaining' : 'Overdue 2 d 2 h',
      slaW: before ? '64.8%' : '100%', slaColor: before ? 'var(--info)' : 'var(--danger)',
      dState: disputed ? 'DISPUTED' : (before ? 'NOT AVAILABLE' : 'AVAILABLE'), dTone: disputed ? 't-danger' : (before ? 't-neutral' : 't-warning'),
      raise: () => this.setState({ phase: 'disputed' })
    };
  }
}

export default class Dispute extends DisputeLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-app">
        <div style={{ flex: "0 0 248px", display: "flex", background: "var(--bg-sunken)" }}>
          <Sidebar active="redemptions" role="owner" />
        </div>
        <div className="t-main">
          <TopBar section="Redemptions" crumb="RD-0097" network="degraded" />
          {$v.disputed ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 32px", background: "var(--danger-subtle)", borderBottom: "1px solid var(--danger-border)", color: "var(--danger-text)", fontSize: "13px", fontWeight: "500" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
                </svg>
                {" DISPUTED · RD-0097 is under operations review. Durban Bayhead 01 is not frozen."}
              </div>
            </>
          ) : null}
          <main className="t-content">
            <div className="t-between t-wrap" style={{ alignItems: "flex-end" }}>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-eyebrow">
                  Redemption dispute · F-5b
                </span>
                <h1 className="t-h1">
                  RD-0097 · 50.000 t zinc
                </h1>
                <span className="t-sm t-sec">
                  <span className="t-mono">
                    TNS-ZN-00051
                  </span>
                  {" · Durban Bayhead 01 · Bayhead Terminals (Pty) Ltd"}
                </span>
              </div>
              <div className="t-seg" role="group" aria-label="Preview">
                {($v.phases ?? []).map((p, $i0) => (
                  <Fragment key={$i0}>
                    <button aria-pressed={p?.on} onClick={p?.pick}>
                      <span className="sc-interp">{p?.label}</span>
                    </button>
                  </Fragment>
                ))}
              </div>
            </div>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "18px", overflow: "hidden" }}>
              <div className="t-metric" style={{ gap: "6px" }}>
                <span className="t-label">
                  Redemption request
                </span>
                <span className="t-num">
                  2026-09-29 10:00
                </span>
                <span className={`t-badge ${$v.rdTone ?? ''}`} style={{ alignSelf: "flex-start" }}>
                  <span className="sc-interp">{$v.rdState}</span>
                </span>
              </div>
              <div className="t-metric" style={{ gap: "6px" }}>
                <span className="t-label">
                  Time elapsed
                </span>
                <span className="t-num-md">
                  <span className="sc-interp">{$v.elapsed}</span>
                </span>
              </div>
              <div className="t-metric" style={{ gap: "6px" }}>
                <span className="t-label">
                  SLA deadline
                </span>
                <span className="t-num">
                  2026-10-06 10:00
                </span>
                <span className={`t-cap ${$v.slaFg ?? ''}`}>
                  <span className="sc-interp">{$v.slaNote}</span>
                </span>
              </div>
              <div className="t-metric" style={{ gap: "6px" }}>
                <span className="t-label">
                  Current warehouse
                </span>
                <span className="t-sm">
                  Durban Bayhead 01
                </span>
                <span className="t-mono-sm t-muted" style={{ fontWeight: "400" }}>
                  DUR-BAY-01 · Active
                </span>
              </div>
              <div className="t-metric" style={{ gap: "6px" }}>
                <span className="t-label">
                  Reserve health
                </span>
                <span className="t-badge t-badge-word t-warning" style={{ alignSelf: "flex-start" }}>
                  <span className="t-dot" />
                  Stale reserve feed
                </span>
                <span className="t-cap">
                  Last update 26 h ago · 104.00%
                </span>
              </div>
              <div className="t-metric" style={{ gap: "6px" }}>
                <span className="t-label">
                  Dispute status
                </span>
                <span className={`t-badge ${$v.dTone ?? ''}`} style={{ alignSelf: "flex-start" }}>
                  <span className="sc-interp">{$v.dState}</span>
                </span>
              </div>
            </section>
            <section className="t-card t-stack" style={{ gap: "12px" }}>
              <div className="t-between">
                <span className="t-h4">
                  Release SLA
                </span>
                <span className={`t-num ${$v.slaFg ?? ''}`}>
                  <span className="sc-interp">{$v.slaBig}</span>
                </span>
              </div>
              <div className="t-meter" style={{ height: "12px" }}>
                <div className="t-meter-fill" style={{ width: $v.slaW, background: $v.slaColor }} />
                <span className="t-mark" style={{ left: "77.78%" }} />
                <span className="t-mark-label" style={{ left: "77.78%", color: "var(--text)" }}>
                  SLA 7 d
                </span>
              </div>
              <div className="t-between t-cap" style={{ paddingTop: "12px" }}>
                <span>
                  Requested 09-29
                </span>
                <span>
                  Today 10-08
                </span>
              </div>
            </section>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-start" }}>
              <section style={{ flex: "999 1 560px", minWidth: "0", display: "flex", flexDirection: "column", gap: "24px" }}>
                <div className="t-card t-stack" style={{ gap: "16px" }}>
                  <span className="t-h3">
                    Raise a dispute
                  </span>
                  {" "}
                  <span className="t-sm t-sec">
                    A dispute asks Tensile operations to step in when a warehouse has not released metal within the SLA. It does not move funds or freeze the warehouse by itself.
                  </span>
                  {" "}
                  {$v.isBefore ? (
                    <>
                      <button className="t-btn t-btn-lg" disabled style={{ alignSelf: "flex-start" }}>
                        Raise dispute
                      </button>
                      {" "}
                      <span className="t-reason t-reason-muted">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: "none", marginTop: "2px" }}>
                          <path d="M12 3a9 9 0 100 18 9 9 0 100-18zM12 7v5l3 2" />
                        </svg>
                        Redemption dispute unavailable: SLA has not expired. You can raise one after 2026-10-06 10:00 UTC, in 1 d 4 h.
                      </span>
                    </>
                  ) : null}
                  {" "}
                  {$v.isAfter ? (
                    <>
                      <label className="t-field">
                        <span className="t-label">
                          What happened
                        </span>
                        <textarea className="t-input" style={{ height: "88px", padding: "10px 12px", resize: "vertical" }} defaultValue="Collector arrived 2026-10-05 with release code. Warehouse said bags were not yet located. No release since." />
                      </label>
                      <div className="t-row">
                        <button className="t-btn t-btn-danger t-btn-lg" onClick={$v.raise}>
                          Raise dispute
                        </button>
                        <span className="t-cap">
                          Operations are alerted at once. You can attach collector evidence next.
                        </span>
                      </div>
                    </>
                  ) : null}
                  {" "}
                  {$v.disputed ? (
                    <>
                      <div className="t-alert t-danger">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
                          <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
                        </svg>
                        <div>
                          <p className="t-alert-title">
                            Dispute DS-0012 raised · operations alerted
                          </p>
                          <p className="t-alert-body">
                            Raised 2026-10-08 12:05 UTC. Operations aim to respond within 4 business hours. Your lot stays REDEEMING and cannot be transferred.
                          </p>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="t-card t-stack" style={{ gap: "16px" }}>
                  <span className="t-h4">
                    What a dispute does
                  </span>
                  <div className="t-hflow">
                    <div className="t-hflow-node" style={{ borderColor: "var(--danger-border)" }}>
                      <span className="t-mono-sm t-fg-danger">
                        01
                      </span>
                      <div className="t-sm" style={{ fontWeight: "500" }}>
                        Redemption dispute
                      </div>
                      <div className="t-cap">
                        Raised by the owner after SLA
                      </div>
                    </div>
                    <div className="t-hflow-arrow">
                      →
                    </div>
                    <div className="t-hflow-node">
                      <span className="t-mono-sm t-muted">
                        02
                      </span>
                      <div className="t-sm" style={{ fontWeight: "500" }}>
                        Operations review
                      </div>
                      <div className="t-cap">
                        Evidence from warehouse and collector
                      </div>
                    </div>
                    <div className="t-hflow-arrow">
                      →
                    </div>
                    <div className="t-hflow-node" style={{ borderStyle: "dashed" }}>
                      <span className="t-mono-sm t-muted">
                        03 · OPTIONAL
                      </span>
                      <div className="t-sm" style={{ fontWeight: "500" }}>
                        Warehouse freeze
                      </div>
                      <div className="t-cap">
                        Separate decision, only if review finds reserve risk
                      </div>
                    </div>
                    <div className="t-hflow-arrow">
                      →
                    </div>
                    <div className="t-hflow-node">
                      <span className="t-mono-sm t-muted">
                        04
                      </span>
                      <div className="t-sm" style={{ fontWeight: "500" }}>
                        Release or further action
                      </div>
                      <div className="t-cap">
                        Metal released, or escalation
                      </div>
                    </div>
                  </div>
                </div>
                {$v.disputed ? (
                  <>
                    <div className="t-card t-card-flush">
                      <div className="t-hazard" />
                      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div className="t-between">
                          <span className="t-h4">
                            Operational actions
                          </span>
                          <span className="t-mono-sm t-muted">
                            OPERATIONS ROLE
                          </span>
                        </div>
                        <div className="t-metrics" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", rowGap: "16px" }}>
                          <div className="t-metric" style={{ gap: "8px" }}>
                            <span className="t-sm" style={{ fontWeight: "500" }}>
                              Request release evidence
                            </span>
                            <span className="t-cap">
                              Ask Bayhead Terminals for stock location and release plan, due in 24 h.
                            </span>
                            <button className="t-btn t-btn-sm t-btn-secondary" style={{ alignSelf: "flex-start" }}>
                              Send request
                            </button>
                          </div>
                          <div className="t-metric" style={{ gap: "8px" }}>
                            <span className="t-sm" style={{ fontWeight: "500" }}>
                              Order reinspection
                            </span>
                            <span className="t-cap">
                              Meridian Survey to verify the 50.000 t is on site.
                            </span>
                            <button className="t-btn t-btn-sm t-btn-secondary" style={{ alignSelf: "flex-start" }}>
                              Order reinspection
                            </button>
                          </div>
                          <div className="t-metric" style={{ gap: "8px", borderColor: "var(--danger-border)" }}>
                            <span className="t-sm" style={{ fontWeight: "500" }}>
                              Freeze warehouse (optional)
                            </span>
                            <span className="t-cap">
                              Blocks new mint, borrowing and transfers for all 41 lots at DUR-BAY-01. Not required to resolve this dispute.
                            </span>
                            <a href="/reserve" className="t-btn t-btn-sm t-btn-danger-outline" style={{ alignSelf: "flex-start" }}>
                              Review freeze
                            </a>
                          </div>
                          <div className="t-metric" style={{ gap: "8px" }}>
                            <span className="t-sm" style={{ fontWeight: "500" }}>
                              Resolve dispute
                            </span>
                            <span className="t-cap">
                              Mark released once proof is posted, or escalate to the custody agreement.
                            </span>
                            <div className="t-row">
                              <button className="t-btn t-btn-sm t-btn-secondary">
                                Mark released
                              </button>
                              <button className="t-btn t-btn-sm t-btn-ghost">
                                Escalate
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </section>
              <aside className="t-card" style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <span className="t-h4">
                  Chronology
                </span>
                <div className="t-tl">
                  {($v.chron ?? []).map((e, $i0) => (
                    <Fragment key={$i0}>
                      <div className="t-tl-item">
                        <div className="t-tl-rail">
                          <span className={`t-tl-node ${e?.node ?? ''}`} />
                          {e?.line ? (
                            <>
                              <span className="t-tl-line" />
                            </>
                          ) : null}
                        </div>
                        <div className="t-stack" style={{ gap: "2px" }}>
                          <span className="t-sm" style={{ fontWeight: "500" }}>
                            <span className="sc-interp">{e?.t}</span>
                          </span>
                          <span className="t-mono-sm t-muted" style={{ fontWeight: "400" }}>
                            <span className="sc-interp">{e?.at}</span>
                            {" · "}
                            <span className="sc-interp">{e?.who}</span>
                          </span>
                          <span className="t-cap">
                            <span className="sc-interp">{e?.d}</span>
                          </span>
                        </div>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </aside>
            </div>
          </main>
        </div>
      </div>
    );
  }
}
