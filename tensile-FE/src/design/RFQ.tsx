// @ts-nocheck
/* Generated from RFQ.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic } from './runtime';
import Sidebar from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import './RFQ.css';

class RFQLogic extends DCLogic {
  state = { side: 'buy', exp: '48h', placed: false, accepted: false, rejected: false };
  renderVals() {
    const buy = this.state.side === 'buy';
    const expiries = [['24h', '24 hours', '2026-10-09 12:15 UTC'], ['48h', '48 hours', '2026-10-10 12:15 UTC'], ['7d', '7 days', '2026-10-15 12:15 UTC'], ['list', 'Until listing ends', '2026-10-20 18:00 UTC']]
      .map(([k, l, at]) => ({ l, at, on: this.state.exp === k ? 'true' : 'false', pick: () => this.setState({ exp: k }) }));
    const expAt = expiries.find((e) => e.on === 'true').at;
    const placed = this.state.placed;
    const myBids = [
      ...(placed ? [{ id: 'Q-5521', lot: 'TNS-NI-00104', amt: '158,000.00', esc: '158,000.00', exp: expAt.slice(5, 16), st: 'OPEN', tone: 't-info', pulse: 't-pulse', cancel: true }] : []),
      { id: 'Q-5507', lot: 'TNS-AL-00233', amt: '252,000.00', esc: '252,000.00', exp: '10-09 09:00', st: 'OPEN', tone: 't-info', pulse: 't-pulse', cancel: true },
      { id: 'Q-5482', lot: 'TNS-ZN-00051', amt: '139,500.00', esc: 'Released', escFg: 't-muted', exp: '10-05 16:00', st: 'SETTLED', tone: 't-success' },
      { id: 'Q-5470', lot: 'TNS-CU-00410', amt: '281,000.00', esc: 'Returned', escFg: 't-muted', exp: '10-03 12:00', st: 'CANCELLED', tone: 't-neutral' },
      { id: 'Q-5461', lot: 'TNS-AL-00228', amt: '228,000.00', esc: 'Returned', escFg: 't-muted', exp: '10-01 18:00', st: 'EXPIRED', tone: 't-neutral' }
    ].map((b) => ({ escFg: '', pulse: '', cancel: false, ...b }));
    const acc = this.state.accepted, rej = this.state.rejected;
    const incoming = [
      { who: 'Kestrel Commodities', v: 'Tier 2 verified', vTone: 't-success', amt: '196,000.00', vs: '−2.00%', esc: 'Escrowed', escTone: 't-info', exp: 'in 18 h', live: !acc, done: acc, st: 'ACCEPTED', tone: 't-success', bg: acc ? 'var(--success-subtle)' : 'transparent' },
      { who: 'Varga Resources AG', v: 'Tier 2 verified', vTone: 't-success', amt: '192,500.00', vs: '−3.75%', esc: acc || rej ? 'Returned' : 'Escrowed', escTone: acc || rej ? 't-neutral' : 't-info', exp: 'in 2 d', live: !acc && !rej, done: acc || rej, st: rej ? 'REJECTED' : 'CANCELLED', tone: rej ? 't-danger' : 't-neutral', bg: 'transparent' },
      { who: 'Ardent Metals FZE', v: 'Tier 2 verified', vTone: 't-success', amt: '188,000.00', vs: '−6.00%', esc: acc ? 'Returned' : 'Escrowed', escTone: acc ? 't-neutral' : 't-info', exp: 'in 5 d', live: !acc, done: acc, st: 'CANCELLED', tone: 't-neutral', bg: 'transparent' },
      { who: 'Halvorsen Trading AS', v: 'Verification expired', vTone: 't-warning', amt: '199,000.00', vs: '−0.50%', esc: 'Returned', escTone: 't-neutral', exp: 'Expired 10-07', live: false, done: true, st: 'EXPIRED', tone: 't-neutral', bg: 'transparent' }
    ].map((b) => ({ ...b, accept: () => this.setState({ accepted: true }), reject: () => this.setState({ rejected: true }) }));
    return {
      expiries, expAt, myBids, incoming, placed, notPlaced: !placed, accepted: acc,
      isBuy: buy, isSell: !buy, buyOn: buy ? 'true' : 'false', sellOn: buy ? 'false' : 'true',
      toBuy: () => this.setState({ side: 'buy' }), toSell: () => this.setState({ side: 'sell' }),
      title: buy ? 'Request a price' : 'Bids on your lot',
      sub: buy ? 'Bid on any listed lot. Your USDC is escrowed, so a seller can accept and settle instantly.' : 'Every bid is from a verified buyer and fully escrowed. Accepting settles the sale in one transaction.',
      escTone: placed ? 't-info' : 't-neutral', escLabel: placed ? 'Escrowed · 158,000.00 USDC' : 'Not yet funded',
      s1fg: placed ? 't-fg-success' : 't-muted', s2fg: placed ? 't-fg-success' : 't-muted', s3fg: placed ? 't-fg-success' : 't-muted',
      place: () => this.setState({ placed: true }),
      sideTitle: acc ? 'Settled' : 'If you accept the best bid'
    };
  }
}

export default class RFQ extends RFQLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-app">
        <div style={{ flex: "0 0 248px", display: "flex", background: "var(--bg-sunken)" }}>
          <Sidebar active="marketplace" role="buyer" />
        </div>
        <div className="t-main">
          <TopBar section="Marketplace" crumb="RFQ" />
          <main className="t-content">
            <div className="t-between t-wrap" style={{ alignItems: "flex-end" }}>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-eyebrow">
                  RFQ · F-3b
                </span>
                <h1 className="t-h1">
                  <span className="sc-interp">{$v.title}</span>
                </h1>
                <span className="t-sm t-sec">
                  <span className="sc-interp">{$v.sub}</span>
                </span>
              </div>
              <div className="t-seg" role="group" aria-label="Side">
                <button aria-pressed={$v.buyOn} onClick={$v.toBuy}>
                  Buyer
                </button>
                <button aria-pressed={$v.sellOn} onClick={$v.toSell}>
                  Seller
                </button>
              </div>
            </div>
            <section className="t-card t-stack" style={{ gap: "16px" }}>
              <span className="t-h4">
                Bid lifecycle
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "12px", alignItems: "center" }}>
                <div className="t-hflow-node" style={{ borderColor: "var(--info-border)" }}>
                  <span className="t-badge t-info">
                    <span className="t-dot t-pulse" />
                    OPEN
                  </span>
                  <div className="t-cap" style={{ paddingTop: "6px" }}>
                    USDC held in escrow
                  </div>
                </div>
                <div className="t-hflow-arrow" style={{ flex: "none", justifyContent: "flex-start" }}>
                  → seller accepts
                </div>
                <div className="t-hflow-node">
                  <span className="t-badge t-info">
                    ACCEPTED
                  </span>
                  <div className="t-cap" style={{ paddingTop: "6px" }}>
                    Escrow released to settlement
                  </div>
                </div>
                <div className="t-hflow-arrow" style={{ flex: "none", justifyContent: "flex-start" }}>
                  → atomic
                </div>
                <div className="t-hflow-node" style={{ borderColor: "var(--success-border)" }}>
                  <span className="t-badge t-success">
                    SETTLED
                  </span>
                  <div className="t-cap" style={{ paddingTop: "6px" }}>
                    Lot to buyer, proceeds to seller
                  </div>
                </div>
                <div />
                <div className="t-hflow-arrow" style={{ flex: "none", justifyContent: "flex-start" }}>
                  ↘ buyer cancels / time runs out
                </div>
                <div className="t-hflow-node">
                  <span className="t-badge t-neutral">
                    CANCELLED
                  </span>
                  {" "}
                  <span className="t-badge t-neutral">
                    EXPIRED
                  </span>
                  <div className="t-cap" style={{ paddingTop: "6px" }}>
                    Escrow returned to buyer in full
                  </div>
                </div>
              </div>
            </section>
            {$v.isBuy ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-start" }}>
                  <section className="t-card" style={{ flex: "1 1 380px", display: "flex", flexDirection: "column", gap: "20px" }}>
                    <span className="t-h3">
                      Place a bid
                    </span>
                    {" "}
                    <label className="t-field">
                      <span className="t-label">
                        Lot
                      </span>
                      <select className="t-input t-select" style={{ fontFamily: "var(--mono)", fontSize: "13px" }}>
                        <option>
                          TNS-NI-00104 · Nickel briquette · 10.000 t · ask $165,000
                        </option>
                      </select>
                      <span className="t-help">
                        Straits Alloy Pte. Ltd. · Singapore Jurong 01 · FREE · inspected 2026-09-21
                      </span>
                    </label>
                    {" "}
                    <label className="t-field">
                      <span className="t-label">
                        Your bid
                      </span>
                      <span style={{ position: "relative" }}>
                        <input className="t-input t-input-lg" defaultValue="158,000.00" readOnly />
                        <span className="t-sm t-sec" style={{ position: "absolute", right: "14px", top: "17px", fontWeight: "500" }}>
                          USDC
                        </span>
                      </span>
                      <span className="t-help">
                        $15,800.00 / t · 4.24% below ask
                      </span>
                    </label>
                    <div className="t-field">
                      <span className="t-label">
                        Bid expires
                      </span>
                      <div className="t-row" style={{ gap: "8px" }}>
                        {($v.expiries ?? []).map((e, $i0) => (
                          <Fragment key={$i0}>
                            <button className="t-chip" aria-pressed={e?.on} onClick={e?.pick}>
                              <span className="sc-interp">{e?.l}</span>
                            </button>
                          </Fragment>
                        ))}
                      </div>
                      <span className="t-help">
                        {"Expires "}
                        <span className="sc-interp">{$v.expAt}</span>
                        . Unaccepted bids return escrow automatically.
                      </span>
                    </div>
                    <div className="t-metric" style={{ gap: "10px" }}>
                      <div className="t-between">
                        <span className="t-sm" style={{ fontWeight: "500" }}>
                          Escrow
                        </span>
                        <span className={`t-badge t-badge-word ${$v.escTone ?? ''}`}>
                          <span className="t-dot" />
                          <span className="sc-interp">{$v.escLabel}</span>
                        </span>
                      </div>
                      <div className="t-row t-sm" style={{ gap: "8px" }}>
                        <span className={`t-mono-sm ${$v.s1fg ?? ''}`}>
                          01
                        </span>
                        <span className="t-sec">
                          Approve 158,000.00 USDC
                        </span>
                      </div>
                      <div className="t-row t-sm" style={{ gap: "8px" }}>
                        <span className={`t-mono-sm ${$v.s2fg ?? ''}`}>
                          02
                        </span>
                        <span className="t-sec">
                          Lock 158,000.00 USDC in the RFQ escrow
                        </span>
                      </div>
                      <div className="t-row t-sm" style={{ gap: "8px" }}>
                        <span className={`t-mono-sm ${$v.s3fg ?? ''}`}>
                          03
                        </span>
                        <span className="t-sec">
                          Bid becomes visible to the seller
                        </span>
                      </div>
                    </div>
                    {$v.notPlaced ? (
                      <>
                        <button className="t-btn t-btn-primary t-btn-lg t-btn-block" onClick={$v.place}>
                          Escrow and bid 158,000.00 USDC
                        </button>
                      </>
                    ) : null}
                    {" "}
                    {$v.placed ? (
                      <>
                        <div className="t-alert t-success">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                          <div>
                            <p className="t-alert-title">
                              Bid Q-5521 is OPEN
                            </p>
                            <p className="t-alert-body">
                              158,000.00 USDC is held in escrow. You can cancel any time before the seller accepts.
                            </p>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </section>
                  <section style={{ flex: "999 1 560px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <span className="t-h4">
                      Your bids
                    </span>
                    <div className="t-table-wrap">
                      <table className="t-table">
                        <thead>
                          <tr>
                            <th>
                              Bid
                            </th>
                            <th>
                              Lot
                            </th>
                            <th className="t-right">
                              Bid (USDC)
                            </th>
                            <th className="t-right">
                              Escrowed
                            </th>
                            <th>
                              Expiry
                            </th>
                            <th>
                              Status
                            </th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {($v.myBids ?? []).map((b, $i0) => (
                            <Fragment key={$i0}>
                              <tr>
                                <td>
                                  <span className="t-mono">
                                    <span className="sc-interp">{b?.id}</span>
                                  </span>
                                </td>
                                <td>
                                  <span className="t-mono t-sec">
                                    <span className="sc-interp">{b?.lot}</span>
                                  </span>
                                </td>
                                <td className="t-right">
                                  <span className="sc-interp">{b?.amt}</span>
                                </td>
                                <td className="t-right">
                                  <span className={b?.escFg}>
                                    <span className="sc-interp">{b?.esc}</span>
                                  </span>
                                </td>
                                <td className="t-sec">
                                  <span className="sc-interp">{b?.exp}</span>
                                </td>
                                <td>
                                  <span className={`t-badge ${b?.tone ?? ''}`}>
                                    <span className={`t-dot ${b?.pulse ?? ''}`} />
                                    <span className="sc-interp">{b?.st}</span>
                                  </span>
                                </td>
                                <td className="t-right">
                                  {b?.cancel ? (
                                    <>
                                      <button className="t-btn t-btn-sm t-btn-ghost">
                                        Cancel bid
                                      </button>
                                    </>
                                  ) : null}
                                </td>
                              </tr>
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              </>
            ) : null}
            {" "}
            {$v.isSell ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-start" }}>
                  <section style={{ flex: "999 1 560px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="t-between">
                      <span className="t-h4">
                        {"Incoming bids · "}
                        <span className="t-mono">
                          TNS-CU-00422
                        </span>
                      </span>
                      <span className="t-cap">
                        Ask $200,000.00 · PLEDGED LN-2302
                      </span>
                    </div>
                    <div className="t-table-wrap">
                      <table className="t-table">
                        <thead>
                          <tr>
                            <th>
                              Buyer
                            </th>
                            <th>
                              Verification
                            </th>
                            <th className="t-right">
                              Bid (USDC)
                            </th>
                            <th className="t-right">
                              vs ask
                            </th>
                            <th>
                              Escrow
                            </th>
                            <th>
                              Expiry
                            </th>
                            <th className="t-right">
                              Decision
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {($v.incoming ?? []).map((b, $i0) => (
                            <Fragment key={$i0}>
                              <tr style={{ background: b?.bg }}>
                                <td>
                                  <span className="t-sm" style={{ fontWeight: "500" }}>
                                    <span className="sc-interp">{b?.who}</span>
                                  </span>
                                </td>
                                <td>
                                  <span className={`t-badge t-badge-word ${b?.vTone ?? ''}`}>
                                    <span className="sc-interp">{b?.v}</span>
                                  </span>
                                </td>
                                <td className="t-right">
                                  <span className="sc-interp">{b?.amt}</span>
                                </td>
                                <td className="t-right t-sec">
                                  <span className="sc-interp">{b?.vs}</span>
                                </td>
                                <td>
                                  <span className={`t-badge t-badge-word ${b?.escTone ?? ''}`}>
                                    <span className="sc-interp">{b?.esc}</span>
                                  </span>
                                </td>
                                <td className="t-sec">
                                  <span className="sc-interp">{b?.exp}</span>
                                </td>
                                <td className="t-right">
                                  {b?.live ? (
                                    <>
                                      <span className="t-row" style={{ gap: "6px", justifyContent: "flex-end" }}>
                                        <button className="t-btn t-btn-sm t-btn-ghost" onClick={b?.reject}>
                                          Reject
                                        </button>
                                        <button className="t-btn t-btn-sm t-btn-primary" onClick={b?.accept}>
                                          Accept
                                        </button>
                                      </span>
                                    </>
                                  ) : null}
                                  {b?.done ? (
                                    <>
                                      <span className={`t-badge ${b?.tone ?? ''}`}>
                                        <span className="sc-interp">{b?.st}</span>
                                      </span>
                                    </>
                                  ) : null}
                                </td>
                              </tr>
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <aside className="t-card" style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <span className="t-h4">
                      <span className="sc-interp">{$v.sideTitle}</span>
                    </span>
                    <div className="t-kv">
                      <div className="t-kv-row">
                        <span className="t-kv-k">
                          Bid from Kestrel Commodities
                        </span>
                        <span className="t-kv-v">
                          196,000.00
                        </span>
                      </div>
                      <div className="t-kv-row">
                        <span className="t-kv-k">
                          Loan payoff · LN-2302
                        </span>
                        <span className="t-kv-v">
                          −90,554.12
                        </span>
                      </div>
                      <div className="t-kv-row">
                        <span className="t-kv-k">
                          Settlement fee 0.25%
                        </span>
                        <span className="t-kv-v">
                          −490.00
                        </span>
                      </div>
                      <div className="t-kv-row t-kv-total">
                        <span>
                          You receive
                        </span>
                        <span className="t-num">
                          104,955.88 USDC
                        </span>
                      </div>
                    </div>
                    <span className="t-cap">
                      Accepting settles at once: escrow pays the loan off, the fee and you, and the lot moves to the buyer. Other bids are returned to their buyers.
                    </span>
                    {" "}
                    {$v.accepted ? (
                      <>
                        <div className="t-alert t-success">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                          <div>
                            <p className="t-alert-title">
                              Q-5498 ACCEPTED → SETTLED
                            </p>
                            <p className="t-alert-body">
                              104,955.88 USDC received at 2026-10-08 12:20 UTC. LN-2302 closed. TNS-CU-00422 transferred to Kestrel Commodities.
                            </p>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </aside>
                </div>
              </>
            ) : null}
          </main>
        </div>
      </div>
    );
  }
}
