// @ts-nocheck
/* Generated from Portfolio.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic } from './runtime';
import Sidebar from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import './Portfolio.css';

class PortfolioLogic extends DCLogic {
  state = { tab: 'lots' };
  renderVals() {
    const t = this.state.tab;
    const tabs = [['lots', 'Lots', '3'], ['loans', 'Loans', '2'], ['lend', 'Lending', '1'], ['tx', 'Transactions', '48'], ['red', 'Redemptions', '2']].map(([k, label, n]) => ({ label, n, on: t === k ? 'true' : 'false', pick: () => this.setState({ tab: k }) }));
    const lots = [
      { id: 'TNS-CU-00418', mat: 'Copper cathode', qty: '30.000 t', val: '$300,000.00', enc: 'PLEDGED', encTone: 't-info', debt: '140,630.14', ltv: '46.88%', wh: 'RTM-BOT-04', whTone: 't-success', whState: 'Healthy', st: 'FREE', stTone: 't-success', pulse: '' },
      { id: 'TNS-CU-00422', mat: 'Copper cathode', qty: '20.000 t', val: '$200,000.00', enc: 'PLEDGED · LISTED', encTone: 't-info', debt: '90,554.12', ltv: '45.28%', wh: 'RTM-BOT-04', whTone: 't-success', whState: 'Healthy', st: 'FREE', stTone: 't-success', pulse: '' },
      { id: 'TNS-NI-00091', mat: 'Nickel briquette', qty: '12.000 t', val: '$198,000.00', enc: 'LOCKED · RD-0101', encTone: 't-info', debt: '0.00', ltv: '—', wh: 'SIN-JUR-01', whTone: 't-success', whState: 'Healthy', st: 'REDEEMING', stTone: 't-info', pulse: 't-pulse' },
      { id: 'TNS-CU-00376', mat: 'Copper cathode', qty: '25.000 t', val: '—', enc: 'RELEASED', encTone: 't-neutral', debt: '—', ltv: '—', wh: 'RTM-BOT-04', whTone: 't-neutral', whState: 'Released', st: 'BURNED', stTone: 't-burned', pulse: '' }
    ];
    const loans = [
      { id: 'LN-2291', lot: 'TNS-CU-00418', p: '140,000.00', d: '140,630.14', ltv: '46.88%', i: '7.85% · 630.14', st: 'ACTIVE', tone: 't-info', act: true },
      { id: 'LN-2302', lot: 'TNS-CU-00422', p: '90,000.00', d: '90,554.12', ltv: '45.28%', i: '7.85% · 554.12', st: 'ACTIVE', tone: 't-info', act: true },
      { id: 'LN-2274', lot: 'TNS-CU-00376', p: '110,000.00', d: '0.00', ltv: '—', i: 'Paid 1,882.40', st: 'CLOSED', tone: 't-neutral', act: false }
    ];
    const txs = [
      ['10-08 08:42', 'Mint', 'TNS-NI-00091', 'Singapore Jurong 01', '12.000 t', '0x3a1f…92c0', 'Confirmed', 't-success'],
      ['10-07 16:10', 'Reinspection', 'TNS-CU-00418', 'Meridian Survey BV', '—', '0x77b0…1d4e', 'Confirmed', 't-success'],
      ['10-05 10:02', 'Borrow', 'LN-2302', 'Credit vault', '+89,550.00', '0x0c9e…a51b', 'Confirmed', 't-success'],
      ['10-04 09:15', 'Borrow', 'LN-2302', 'Credit vault', '—', '0x1f2a…66c3', 'Reverted: reserve feed stale', 't-warning'],
      ['10-03 11:25', 'Borrow', 'LN-2291', 'Credit vault', '+139,300.00', '0x5c2e…a417', 'Confirmed', 't-success'],
      ['10-01 14:02', 'Repay', 'LN-2274', 'Credit vault', '−25,000.00', '0x9d8c…0b72', 'Confirmed', 't-success'],
      ['09-24 15:37', 'Redemption', 'RD-0093', 'Portline Warehousing', '25.000 t', '0x4e60…f8a9', 'Released', 't-success'],
      ['09-12 10:05', 'Purchase', 'TNS-CU-00418', 'Northgate Refining Co.', '−296,400.00', '0x6f11…3cd2', 'Settled', 't-success']
    ].map(([at, type, ref, cp, amt, tx, res, tone]) => ({ at, type, ref, cp, amt, tx, res, tone }));
    const reds = [
      { id: 'RD-0101', lot: 'TNS-NI-00091', q: '12.000 t', wh: 'SIN-JUR-01', req: '2026-10-08 12:00', sla: '2026-10-15 12:00', st: 'PENDING', tone: 't-info', pulse: 't-pulse', href: '/redemptions' },
      { id: 'RD-0093', lot: 'TNS-CU-00376', q: '25.000 t', wh: 'RTM-BOT-04', req: '2026-09-18 10:00', sla: '2026-09-25 10:00', st: 'RELEASED', tone: 't-success', pulse: '', href: '/redemptions' }
    ];
    return { tabs, lots, loans, txs, reds, isLots: t === 'lots', isLoans: t === 'loans', isLend: t === 'lend', isTx: t === 'tx', isRed: t === 'red' };
  }
}

export default class Portfolio extends PortfolioLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-app">
        <div style={{ flex: "0 0 248px", display: "flex", background: "var(--bg-sunken)" }}>
          <Sidebar active="portfolio" role="owner" />
        </div>
        <div className="t-main">
          <TopBar section="Tensile" crumb="Portfolio" />
          <main className="t-content">
            <div className="t-between t-wrap" style={{ alignItems: "flex-end" }}>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-eyebrow">
                  Portfolio
                </span>
                <h1 className="t-h1">
                  What you own and what you owe
                </h1>
              </div>
              <button className="t-btn t-btn-secondary">
                Export statement
              </button>
            </div>
            <section className="t-card t-stack" style={{ gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "20px" }}>
                <div className="t-stack" style={{ gap: "4px" }}>
                  <span className="t-label">
                    Gross value
                  </span>
                  <span className="t-num-md">
                    $952,819.00
                  </span>
                </div>
                <div className="t-stack" style={{ gap: "4px" }}>
                  <span className="t-label">
                    Debt
                  </span>
                  <span className="t-num-md">
                    −231,184.26
                  </span>
                </div>
                <div className="t-stack" style={{ gap: "4px" }}>
                  <span className="t-label">
                    Net position
                  </span>
                  <span className="t-num-md" style={{ color: "var(--brand)" }}>
                    $721,634.74
                  </span>
                </div>
                <div className="t-stack" style={{ gap: "4px" }}>
                  <span className="t-label">
                    Physical metal
                  </span>
                  <span className="t-num-md">
                    62.000 t
                  </span>
                </div>
                <div className="t-stack" style={{ gap: "4px" }}>
                  <span className="t-label">
                    Weighted LTV
                  </span>
                  <span className="t-num-md">
                    46.24%
                  </span>
                  <span className="t-cap">
                    on pledged lots
                  </span>
                </div>
              </div>
              <div className="t-stack" style={{ gap: "8px" }}>
                <div style={{ display: "flex", height: "14px", gap: "2px", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: "20.78%", background: "var(--data-1)" }} title="Free lots" />
                  <div style={{ width: "28.22%", background: "var(--data-4)" }} title="Equity in pledged lots" />
                  <div style={{ width: "24.26%", background: "var(--data-2)" }} title="Debt" />
                  <div style={{ width: "26.74%", background: "var(--data-3)" }} title="Vault position" />
                </div>
                <div className="t-row t-wrap t-cap" style={{ gap: "20px" }}>
                  <span className="t-row" style={{ gap: "6px" }}>
                    <span style={{ width: "10px", height: "10px", background: "var(--data-1)" }} />
                    Free lots $198,000.00
                  </span>
                  {" "}
                  <span className="t-row" style={{ gap: "6px" }}>
                    <span style={{ width: "10px", height: "10px", background: "var(--data-4)" }} />
                    Your equity in pledged lots $268,815.74
                  </span>
                  {" "}
                  <span className="t-row" style={{ gap: "6px" }}>
                    <span style={{ width: "10px", height: "10px", background: "var(--data-2)" }} />
                    Debt against pledged lots $231,184.26
                  </span>
                  {" "}
                  <span className="t-row" style={{ gap: "6px" }}>
                    <span style={{ width: "10px", height: "10px", background: "var(--data-3)" }} />
                    Vault position $254,819.00
                  </span>
                </div>
              </div>
            </section>
            <div className="t-tabs" role="tablist">
              {($v.tabs ?? []).map((t, $i0) => (
                <Fragment key={$i0}>
                  <button className="t-tab" role="tab" aria-selected={t?.on} onClick={t?.pick}>
                    <span className="sc-interp">{t?.label}</span>
                    {" "}
                    <span className="t-mono-sm t-muted">
                      <span className="sc-interp">{t?.n}</span>
                    </span>
                  </button>
                </Fragment>
              ))}
            </div>
            {$v.isLots ? (
              <>
                <div className="t-table-wrap">
                  <table className="t-table">
                    <thead>
                      <tr>
                        <th>
                          Lot ID
                        </th>
                        <th>
                          Material
                        </th>
                        <th className="t-right">
                          Quantity
                        </th>
                        <th className="t-right">
                          Current value
                        </th>
                        <th>
                          Ownership
                        </th>
                        <th className="t-right">
                          Debt
                        </th>
                        <th className="t-right">
                          LTV
                        </th>
                        <th>
                          Warehouse
                        </th>
                        <th>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {($v.lots ?? []).map((l, $i0) => (
                        <Fragment key={$i0}>
                          <tr>
                            <td>
                              <a href="/lots" className="t-mono">
                                <span className="sc-interp">{l?.id}</span>
                              </a>
                            </td>
                            <td>
                              <span className="sc-interp">{l?.mat}</span>
                            </td>
                            <td className="t-right">
                              <span className="sc-interp">{l?.qty}</span>
                            </td>
                            <td className="t-right">
                              <span className="sc-interp">{l?.val}</span>
                            </td>
                            <td>
                              <span className="t-badge t-badge-word t-brand">
                                Owner
                              </span>
                              {" "}
                              <span className={`t-badge ${l?.encTone ?? ''}`}>
                                <span className="sc-interp">{l?.enc}</span>
                              </span>
                            </td>
                            <td className="t-right">
                              <span className="sc-interp">{l?.debt}</span>
                            </td>
                            <td className="t-right">
                              <span className="sc-interp">{l?.ltv}</span>
                            </td>
                            <td>
                              <span className="t-mono t-sec">
                                <span className="sc-interp">{l?.wh}</span>
                              </span>
                              {" "}
                              <span className={`t-badge t-badge-word ${l?.whTone ?? ''}`} style={{ height: "20px" }}>
                                <span className="t-dot" />
                                <span className="sc-interp">{l?.whState}</span>
                              </span>
                            </td>
                            <td>
                              <span className={`t-badge ${l?.stTone ?? ''}`}>
                                <span className={`t-dot ${l?.pulse ?? ''}`} />
                                <span className="sc-interp">{l?.st}</span>
                              </span>
                            </td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            {" "}
            {$v.isLoans ? (
              <>
                <div className="t-table-wrap">
                  <table className="t-table">
                    <thead>
                      <tr>
                        <th>
                          Loan
                        </th>
                        <th>
                          Lot
                        </th>
                        <th className="t-right">
                          Principal
                        </th>
                        <th className="t-right">
                          Debt
                        </th>
                        <th className="t-right">
                          LTV
                        </th>
                        <th className="t-right">
                          Interest
                        </th>
                        <th>
                          Status
                        </th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {($v.loans ?? []).map((l, $i0) => (
                        <Fragment key={$i0}>
                          <tr>
                            <td>
                              <span className="t-mono">
                                <span className="sc-interp">{l?.id}</span>
                              </span>
                            </td>
                            <td>
                              <span className="t-mono t-sec">
                                <span className="sc-interp">{l?.lot}</span>
                              </span>
                            </td>
                            <td className="t-right">
                              <span className="sc-interp">{l?.p}</span>
                            </td>
                            <td className="t-right">
                              <span className="sc-interp">{l?.d}</span>
                            </td>
                            <td className="t-right">
                              <span className="sc-interp">{l?.ltv}</span>
                            </td>
                            <td className="t-right">
                              <span className="sc-interp">{l?.i}</span>
                            </td>
                            <td>
                              <span className={`t-badge ${l?.tone ?? ''}`}>
                                <span className="sc-interp">{l?.st}</span>
                              </span>
                            </td>
                            <td className="t-right">
                              {l?.act ? (
                                <>
                                  <a href="/borrow" className="t-btn t-btn-sm t-btn-ghost">
                                    Repay
                                  </a>
                                </>
                              ) : null}
                            </td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            {" "}
            {$v.isLend ? (
              <>
                <div className="t-card" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "20px", alignItems: "end" }}>
                  <div className="t-stack" style={{ gap: "4px" }}>
                    <span className="t-label">
                      Deposited
                    </span>
                    <span className="t-num-md">
                      250,000.00
                    </span>
                  </div>
                  <div className="t-stack" style={{ gap: "4px" }}>
                    <span className="t-label">
                      Shares
                    </span>
                    <span className="t-num-md">
                      {"244,733.53 "}
                      <span className="t-u">
                        tvUSDC
                      </span>
                    </span>
                  </div>
                  <div className="t-stack" style={{ gap: "4px" }}>
                    <span className="t-label">
                      Current value
                    </span>
                    <span className="t-num-md">
                      254,819.00
                    </span>
                  </div>
                  <div className="t-stack" style={{ gap: "4px" }}>
                    <span className="t-label">
                      Earnings
                    </span>
                    <span className="t-num-md t-fg-success">
                      +4,819.00
                    </span>
                  </div>
                  <div className="t-stack" style={{ gap: "4px" }}>
                    <span className="t-label">
                      Available withdrawal
                    </span>
                    <span className="t-num-md">
                      254,819.00
                    </span>
                    <a href="/lend" className="t-sm">
                      Manage →
                    </a>
                  </div>
                </div>
              </>
            ) : null}
            {" "}
            {$v.isTx ? (
              <>
                <div className="t-table-wrap">
                  <table className="t-table t-dense">
                    <thead>
                      <tr>
                        <th>
                          Time (UTC)
                        </th>
                        <th>
                          Type
                        </th>
                        <th>
                          Reference
                        </th>
                        <th>
                          Counterparty
                        </th>
                        <th className="t-right">
                          Amount
                        </th>
                        <th>
                          Tx
                        </th>
                        <th>
                          Result
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {($v.txs ?? []).map((t, $i0) => (
                        <Fragment key={$i0}>
                          <tr>
                            <td>
                              <span className="t-mono-sm t-muted" style={{ fontWeight: "400" }}>
                                <span className="sc-interp">{t?.at}</span>
                              </span>
                            </td>
                            <td>
                              <span className="sc-interp">{t?.type}</span>
                            </td>
                            <td>
                              <span className="t-mono">
                                <span className="sc-interp">{t?.ref}</span>
                              </span>
                            </td>
                            <td className="t-sec">
                              <span className="sc-interp">{t?.cp}</span>
                            </td>
                            <td className="t-right">
                              <span className="sc-interp">{t?.amt}</span>
                            </td>
                            <td>
                              <a href="#" className="t-mono">
                                <span className="sc-interp">{t?.tx}</span>
                              </a>
                            </td>
                            <td>
                              <span className={`t-badge t-badge-word ${t?.tone ?? ''}`}>
                                <span className="sc-interp">{t?.res}</span>
                              </span>
                            </td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            {" "}
            {$v.isRed ? (
              <>
                <div className="t-table-wrap">
                  <table className="t-table">
                    <thead>
                      <tr>
                        <th>
                          Redemption
                        </th>
                        <th>
                          Lot
                        </th>
                        <th className="t-right">
                          Quantity
                        </th>
                        <th>
                          Warehouse
                        </th>
                        <th>
                          Requested
                        </th>
                        <th>
                          SLA deadline
                        </th>
                        <th>
                          Status
                        </th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {($v.reds ?? []).map((r, $i0) => (
                        <Fragment key={$i0}>
                          <tr>
                            <td>
                              <span className="t-mono">
                                <span className="sc-interp">{r?.id}</span>
                              </span>
                            </td>
                            <td>
                              <span className="t-mono t-sec">
                                <span className="sc-interp">{r?.lot}</span>
                              </span>
                            </td>
                            <td className="t-right">
                              <span className="sc-interp">{r?.q}</span>
                            </td>
                            <td>
                              <span className="t-mono t-sec">
                                <span className="sc-interp">{r?.wh}</span>
                              </span>
                            </td>
                            <td className="t-sec">
                              <span className="sc-interp">{r?.req}</span>
                            </td>
                            <td className="t-sec">
                              <span className="sc-interp">{r?.sla}</span>
                            </td>
                            <td>
                              <span className={`t-badge ${r?.tone ?? ''}`}>
                                <span className={`t-dot ${r?.pulse ?? ''}`} />
                                <span className="sc-interp">{r?.st}</span>
                              </span>
                            </td>
                            <td className="t-right">
                              <a href={r?.href} className="t-btn t-btn-sm t-btn-ghost">
                                Open
                              </a>
                            </td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </main>
        </div>
      </div>
    );
  }
}
