// @ts-nocheck
/* Generated from Redemption.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic } from './runtime';
import Orb from './Orb';
import Sidebar from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import './Redemption.css';

class RedemptionLogic extends DCLogic {
  state = { step: 3 };
  renderVals() {
    const st = this.state.step;
    const labels = ['Select lot', 'Confirm', 'Collector', 'REDEEMING', 'Warehouse release', 'Release proof', 'Passport burned', 'Record retained'];
    const steps = labels.map((label, i) => ({ label, n: String(i + 1).padStart(2, '0'), cls: i < st ? 't-step-done' : (i === st ? 't-step-current' : ''), go: () => this.setState({ step: i }) }));
    const lots = [
      { id: 'TNS-NI-00091', mat: 'Nickel briquette', qty: '12.000 t', wh: 'Singapore Jurong 01', lien: 'FREE', tone: 't-success', ok: true, no: false, bd: 'var(--brand-border)', op: '1' },
      { id: 'TNS-CU-00418', mat: 'Copper cathode', qty: '30.000 t', wh: 'Rotterdam Botlek 04', lien: 'PLEDGED', tone: 't-info', ok: false, no: true, why: 'Redemption unavailable: this lot is pledged to LN-2291. Repay the loan first.', bd: 'var(--border)', op: '.8' },
      { id: 'TNS-CU-00422', mat: 'Copper cathode', qty: '20.000 t', wh: 'Rotterdam Botlek 04', lien: 'PLEDGED · LISTED', tone: 't-info', ok: false, no: true, why: 'Redemption unavailable: this lot is pledged and listed. Cancel the listing and repay LN-2302 first.', bd: 'var(--border)', op: '.8' }
    ].map((l) => ({ why: false, ...l }));
    const mids = {
      3: ['Awaiting warehouse release', 'PENDING', 't-info', 't-pulse', 'Jurong Bonded Logistics has been notified and has 7 days to release the metal to your collector.', 'Simulate release'],
      4: ['Warehouse release in progress', 'PENDING', 't-info', 't-pulse', 'Collector arrived 2026-10-13 08:20 SGT. Seals checked and bags are being loaded.', 'Post release proof'],
      5: ['Release proof posted', 'RELEASED', 't-success', '', 'The warehouse posted signed proof. Tensile burns the passport once the proof is verified against the collector record.', 'Burn passport']
    };
    const m = mids[st] || mids[3];
    const proof = [
      { k: 'Release note', v: st >= 5 ? 'JBL-RN-26-3318 · signed' : 'Not yet posted', ref: st >= 5 ? 'bafybeic1…t4ha' : '—', op: st >= 5 ? '1' : '.55' },
      { k: 'Weighbridge out', v: st >= 4 ? '12.008 t gross-net' : 'Not yet weighed', ref: st >= 4 ? 'WB-0459120' : '—', op: st >= 4 ? '1' : '.55' },
      { k: 'Collector match', v: st >= 4 ? 'Code 7Q4-K9M · plate XD 4418 K' : 'Pending arrival', ref: st >= 4 ? 'hash 0x9b2…71e' : '—', op: st >= 4 ? '1' : '.55' }
    ];
    const T = (t, at, d, ok, now) => ({ t, at, d, node: ok ? 't-node-done' : (now ? 't-node-active' : '') });
    const tl = [
      T('Requested', '2026-10-08 12:00 UTC', 'By Halden Metals Ltd', st >= 2, st < 2),
      T('SLA deadline', '2026-10-15 12:00 UTC', '7 days to release', st >= 6, st >= 3 && st < 6),
      T('Warehouse release', st >= 5 ? '2026-10-13 09:55 UTC' : 'Pending', 'Jurong Bonded Logistics', st >= 5, st === 4),
      T('Release proof', st >= 5 ? '2026-10-13 10:30 UTC' : 'Pending', 'Signed release note', st >= 6, st === 5),
      T('Completed', st >= 6 ? '2026-10-13 10:42 UTC' : '—', 'Passport burned, history kept', st >= 6, false)
    ].map((e, i, a) => ({ ...e, line: i < a.length - 1 }));
    const redeeming = st >= 3 && st <= 5;
    return {
      steps, lots, proof, tl, yes: true, orbPhase: st < 3 ? 0 : (st >= 6 ? 4 : st - 2),
      title: st >= 6 ? 'Redeemed · TNS-NI-00091' : (st >= 3 ? 'Redeeming TNS-NI-00091' : 'Redeem a lot'),
      showState: st >= 3, stLabel: st >= 6 ? 'RELEASED' : 'REDEEMING', stTone: st >= 6 ? 't-success' : 't-info', stPulse: st >= 6 ? '' : 't-pulse',
      locked: redeeming, showSla: redeeming,
      s0: st === 0, s1: st === 1, s2: st === 2, mid: redeeming, done: st >= 6,
      midTitle: m[0], midBadge: m[1], midTone: m[2], midPulse: m[3], midCopy: m[4], midNext: m[5],
      next: () => this.setState({ step: Math.min(7, st + 1) }), back: () => this.setState({ step: Math.max(0, st - 1) })
    };
  }
}

export default class Redemption extends RedemptionLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-app">
        <div style={{ flex: "0 0 248px", display: "flex", background: "var(--bg-sunken)" }}>
          <Sidebar active="redemptions" role="owner" />
        </div>
        <div className="t-main">
          <TopBar section="Redemptions" crumb="RD-0101" />
          <main className="t-content">
            <div className="t-between t-wrap" style={{ alignItems: "flex-end" }}>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-eyebrow">
                  Redemption · F-5
                </span>
                <h1 className="t-h1">
                  <span className="sc-interp">{$v.title}</span>
                </h1>
                <span className="t-sm t-sec">
                  Take delivery of the physical metal. The warehouse releases it to your collector; the passport is then burned and its history kept.
                </span>
              </div>
              {$v.showState ? (
                <>
                  <span className={`t-badge ${$v.stTone ?? ''}`} style={{ height: "28px", fontSize: "13px", padding: "0 12px" }}>
                    <span className={`t-dot ${$v.stPulse ?? ''}`} />
                    <span className="sc-interp">{$v.stLabel}</span>
                  </span>
                </>
              ) : null}
            </div>
            <nav className="t-steps" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }} aria-label="Redemption progress">
              {($v.steps ?? []).map((s, $i0) => (
                <Fragment key={$i0}>
                  <button className={`t-step ${s?.cls ?? ''}`} onClick={s?.go}>
                    <span className="t-step-n">
                      <span className="sc-interp">{s?.n}</span>
                    </span>
                    <span className="t-step-l">
                      <span className="sc-interp">{s?.label}</span>
                    </span>
                  </button>
                </Fragment>
              ))}
            </nav>
            {$v.locked ? (
              <>
                <div className="t-alert t-info" style={{ padding: "18px 20px" }}>
                  <span className="t-dot t-pulse" style={{ color: "var(--info)", marginTop: "7px", width: "8px", height: "8px" }} />
                  <div>
                    <p className="t-alert-title" style={{ fontSize: "15px" }}>
                      REDEEMING · this lot cannot be transferred while physical release is pending.
                    </p>
                    <p className="t-alert-body">
                      Selling, pledging, bidding and transfers are blocked for TNS-NI-00091 until the warehouse posts release proof, or the request is cancelled.
                    </p>
                  </div>
                </div>
              </>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-start" }}>
              <section style={{ flex: "999 1 560px", minWidth: "0", display: "flex", flexDirection: "column", gap: "24px" }}>
                {$v.s0 ? (
                  <>
                    <div className="t-card t-stack" style={{ gap: "16px" }}>
                      <span className="t-h3">
                        Select a lot to redeem
                      </span>
                      {" "}
                      {($v.lots ?? []).map((l, $i0) => (
                        <Fragment key={$i0}>
                          <div className="t-well" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", borderColor: l?.bd, opacity: l?.op }}>
                            <div className="t-stack" style={{ gap: "2px" }}>
                              <span className="t-row" style={{ gap: "8px" }}>
                                <span className="t-mono">
                                  <span className="sc-interp">{l?.id}</span>
                                </span>
                                <span className={`t-badge ${l?.tone ?? ''}`}>
                                  <span className="sc-interp">{l?.lien}</span>
                                </span>
                              </span>
                              <span className="t-sm">
                                <span className="sc-interp">{l?.mat}</span>
                                {" · "}
                                <span className="sc-interp">{l?.qty}</span>
                                {" · "}
                                <span className="sc-interp">{l?.wh}</span>
                              </span>
                              {l?.why ? (
                                <>
                                  <span className="t-reason" style={{ paddingTop: "4px" }}>
                                    <span className="sc-interp">{l?.why}</span>
                                  </span>
                                </>
                              ) : null}
                            </div>
                            {l?.ok ? (
                              <>
                                <button className="t-btn t-btn-primary t-btn-sm" onClick={$v.next}>
                                  Select
                                </button>
                              </>
                            ) : null}
                            {" "}
                            {l?.no ? (
                              <>
                                <button className="t-btn t-btn-sm" disabled>
                                  Select
                                </button>
                              </>
                            ) : null}
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </>
                ) : null}
                {" "}
                {$v.s1 ? (
                  <>
                    <div className="t-card t-stack" style={{ gap: "20px" }}>
                      <span className="t-h3">
                        Confirm redemption
                      </span>
                      <div className="t-kv">
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Lot
                          </span>
                          <span className="t-kv-v">
                            <span className="t-mono">
                              TNS-NI-00091
                            </span>
                            {" · Nickel briquette"}
                          </span>
                        </div>
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Quantity to release
                          </span>
                          <span className="t-kv-v">
                            12.000 t · 6 sealed bags
                          </span>
                        </div>
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Warehouse
                          </span>
                          <span className="t-kv-v">
                            Singapore Jurong 01 · Jurong Bonded Logistics
                          </span>
                        </div>
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Release SLA
                          </span>
                          <span className="t-kv-v">
                            7 days from request
                          </span>
                        </div>
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Redemption fee
                          </span>
                          <span className="t-kv-v">
                            150.00 USDC + warehouse out-handling at cost
                          </span>
                        </div>
                      </div>
                      <div className="t-alert t-warning">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
                          <path d="M12 3l9 16H3zM12 10v4M12 17v.5" />
                        </svg>
                        <div>
                          <p className="t-alert-title">
                            Redemption ends the digital lot
                          </p>
                          <p className="t-alert-body">
                            Once the warehouse releases the metal, the passport is burned. You can cancel only before the collector is verified.
                          </p>
                        </div>
                      </div>
                      <div className="t-row" style={{ justifyContent: "flex-end" }}>
                        <button className="t-btn t-btn-secondary" onClick={$v.back}>
                          Back
                        </button>
                        <button className="t-btn t-btn-primary" onClick={$v.next}>
                          Request redemption
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
                {" "}
                {$v.s2 ? (
                  <>
                    <div className="t-card t-stack" style={{ gap: "20px" }}>
                      <div className="t-stack" style={{ gap: "4px" }}>
                        <span className="t-h3">
                          Collector verification
                        </span>
                        <span className="t-sm t-sec">
                          The warehouse releases only to the collector named here, against a one-time code.
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "20px" }}>
                        <label className="t-field">
                          <span className="t-label">
                            Collecting company
                          </span>
                          <input className="t-input" defaultValue="Pasir Freight Services Pte. Ltd." />
                        </label>
                        {" "}
                        <label className="t-field">
                          <span className="t-label">
                            Driver name
                          </span>
                          <input className="t-input" defaultValue="Tan Wei Ming" />
                        </label>
                        {" "}
                        <label className="t-field">
                          <span className="t-label">
                            Driver ID (last 4)
                          </span>
                          <input className="t-input" defaultValue="•••• 7741" />
                        </label>
                        {" "}
                        <label className="t-field">
                          <span className="t-label">
                            Vehicle registration
                          </span>
                          <input className="t-input" defaultValue="XD 4418 K" style={{ fontFamily: "var(--mono)" }} />
                        </label>
                        {" "}
                        <label className="t-field">
                          <span className="t-label">
                            Collection window
                          </span>
                          <input className="t-input" defaultValue="2026-10-13 08:00–12:00 SGT" />
                        </label>
                        <div className="t-field">
                          <span className="t-label">
                            Release code
                          </span>
                          <div className="t-well t-between" style={{ padding: "8px 12px" }}>
                            <span className="t-mono" style={{ letterSpacing: ".2em" }}>
                              7Q4-K9M
                            </span>
                            <span className="t-cap">
                              Share with driver only
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="t-cap">
                        Only a hash of these details is written on-chain. The warehouse sees them in full.
                      </span>
                      <div className="t-row" style={{ justifyContent: "flex-end" }}>
                        <button className="t-btn t-btn-secondary" onClick={$v.back}>
                          Back
                        </button>
                        <button className="t-btn t-btn-primary" onClick={$v.next}>
                          Verify collector
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
                {" "}
                {$v.mid ? (
                  <>
                    <div className="t-card t-stack" style={{ gap: "20px" }}>
                      <div className="t-between">
                        <span className="t-h3">
                          <span className="sc-interp">{$v.midTitle}</span>
                        </span>
                        <span className={`t-badge ${$v.midTone ?? ''}`}>
                          <span className={`t-dot ${$v.midPulse ?? ''}`} />
                          <span className="sc-interp">{$v.midBadge}</span>
                        </span>
                      </div>
                      <span className="t-sm t-sec">
                        <span className="sc-interp">{$v.midCopy}</span>
                      </span>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
                        {($v.proof ?? []).map((p, $i0) => (
                          <Fragment key={$i0}>
                            <div className="t-metric" style={{ gap: "6px", opacity: p?.op }}>
                              <span className="t-label">
                                <span className="sc-interp">{p?.k}</span>
                              </span>
                              <span className="t-sm">
                                <span className="sc-interp">{p?.v}</span>
                              </span>
                              <span className="t-mono-sm t-muted" style={{ fontWeight: "400" }}>
                                <span className="sc-interp">{p?.ref}</span>
                              </span>
                            </div>
                          </Fragment>
                        ))}
                      </div>
                      <div className="t-row" style={{ justifyContent: "flex-end" }}>
                        <button className="t-btn t-btn-secondary" onClick={$v.back}>
                          Back
                        </button>
                        <button className="t-btn t-btn-primary" onClick={$v.next}>
                          <span className="sc-interp">{$v.midNext}</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
                {" "}
                {$v.done ? (
                  <>
                    <div className="t-alert t-success">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                      <div>
                        <p className="t-alert-title">
                          Redemption RELEASED · completed 2026-10-13 10:42 UTC
                        </p>
                        <p className="t-alert-body">
                          12.008 t collected by Pasir Freight Services. The digital passport is no longer active; its full history is retained.
                        </p>
                      </div>
                    </div>
                    <article className="t-card" style={{ border: "1px dashed var(--border-strong)", background: "transparent", display: "flex", flexDirection: "column", gap: "20px", padding: "32px" }}>
                      <div className="t-between">
                        <div className="t-stack">
                          <span className="t-eyebrow">
                            Material passport · historical record
                          </span>
                          <span className="t-h3 t-sec">
                            Nickel briquette
                          </span>
                        </div>
                        <span className="t-badge t-burned">
                          BURNED
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
                        <div className="t-stack">
                          <span className="t-cap">
                            Lot
                          </span>
                          <span className="t-mono t-sec">
                            TNS-NI-00091
                          </span>
                        </div>
                        <div className="t-stack">
                          <span className="t-cap">
                            Quantity released
                          </span>
                          <span className="t-num t-sec">
                            12.008 t
                          </span>
                        </div>
                        <div className="t-stack">
                          <span className="t-cap">
                            Active
                          </span>
                          <span className="t-num t-sec">
                            2026-10-08 → 2026-10-13
                          </span>
                        </div>
                        <div className="t-stack">
                          <span className="t-cap">
                            Burn tx
                          </span>
                          <span className="t-mono t-sec">
                            0xe20c…5b81
                          </span>
                        </div>
                      </div>
                      <div className="t-row">
                        <a href="/lots" className="t-btn t-btn-secondary">
                          View full history
                        </a>
                        <button className="t-btn t-btn-ghost">
                          Download release certificate
                        </button>
                      </div>
                    </article>
                  </>
                ) : null}
              </section>
              <aside className="t-card" style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Orb mode="redeem" focus="SIN-JUR-01" phase={$v.orbPhase} lot="TNS-NI-00091" compact={$v.yes} w="320" />
                </div>
                <div className="t-between">
                  <span className="t-h4">
                    Redemption timeline
                  </span>
                  <span className="t-mono t-muted">
                    RD-0101
                  </span>
                </div>
                <div className="t-tl">
                  {($v.tl ?? []).map((e, $i0) => (
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
                          </span>
                          <span className="t-cap">
                            <span className="sc-interp">{e?.d}</span>
                          </span>
                        </div>
                      </div>
                    </Fragment>
                  ))}
                </div>
                {$v.showSla ? (
                  <>
                    <div className="t-metric" style={{ gap: "8px" }}>
                      <div className="t-between">
                        <span className="t-label">
                          SLA remaining
                        </span>
                        <span className="t-num">
                          4 d 21 h
                        </span>
                      </div>
                      <div className="t-meter">
                        <div className="t-meter-fill" style={{ width: "30%", background: "var(--info)" }} />
                      </div>
                      <span className="t-cap">
                        {"If the warehouse misses the deadline, you can raise a dispute. "}
                        <a href="/disputes">
                          How disputes work
                        </a>
                      </span>
                    </div>
                  </>
                ) : null}
              </aside>
            </div>
          </main>
        </div>
      </div>
    );
  }
}
