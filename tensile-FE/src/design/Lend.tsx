// @ts-nocheck
/* Generated from Lend.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic } from './runtime';
import Sidebar from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import './Lend.css';

class LendLogic extends DCLogic {
  state = { tab: 'dep' };
  renderVals() {
    const hero = [
      { k: 'Total vault assets', v: '48,250,000.00', u: 'USDC', d: '1,204 depositors' },
      { k: 'Your deposit', v: '250,000.00', u: 'USDC', d: 'Net of withdrawals' },
      { k: 'Your vault shares', v: '244,733.53', u: 'tvUSDC', d: '0.53% of vault' },
      { k: 'Share value', v: '1.041210', u: 'USDC', d: '+0.50% in 30 d' },
      { k: 'Accrued earnings', v: '4,819.00', u: 'USDC', d: 'Position 254,819.00' },
      { k: 'Available to withdraw', v: '254,819.00', u: 'USDC', d: 'Fully liquid now' }
    ];
    const ys = [5.41, 5.62, 5.80, 5.74, 5.95, 6.03, 5.88, 6.10, 6.21, 6.08, 6.15, 6.12];
    const yieldBars = ys.map((y) => ({ v: y.toFixed(2), h: (y / 8 * 100).toFixed(1) + '%' }));
    const alloc = [
      { m: 'Copper cathode', c: 'CU', d: '20,988,750.00', s: '58.00%', n: '134', l: '52.10%', r: '7.85%' },
      { m: 'Aluminium ingot', c: 'AL', d: '6,513,750.00', s: '18.00%', n: '47', l: '49.80%', r: '7.60%' },
      { m: 'Nickel briquette', c: 'NI', d: '5,066,250.00', s: '14.00%', n: '29', l: '47.25%', r: '8.40%' },
      { m: 'Zinc SHG', c: 'ZN', d: '3,618,750.00', s: '10.00%', n: '21', l: '50.65%', r: '7.90%' }
    ];
    const dep = this.state.tab === 'dep';
    return { hero, yieldBars, alloc, isDep: dep, isWd: !dep, depOn: dep ? 'true' : 'false', wdOn: dep ? 'false' : 'true', toDep: () => this.setState({ tab: 'dep' }), toWd: () => this.setState({ tab: 'wd' }) };
  }
}

export default class Lend extends LendLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-app">
        <div style={{ flex: "0 0 248px", display: "flex", background: "var(--bg-sunken)" }}>
          <Sidebar active="lend" role="lender" />
        </div>
        <div className="t-main">
          <TopBar section="Lend" crumb="Tensile credit vault" />
          <main className="t-content">
            <div className="t-between t-wrap" style={{ alignItems: "flex-end" }}>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-eyebrow">
                  Lend
                </span>
                <h1 className="t-h1">
                  Tensile credit vault
                </h1>
                <span className="t-sm t-sec">
                  USDC lent against verified metal in bonded custody. Every loan is over-collateralised by a specific lot.
                </span>
              </div>
              <div className="t-row">
                <span className="t-badge t-badge-word t-success">
                  <span className="t-dot" />
                  Vault open
                </span>
                <span className="t-mono t-muted">
                  tvUSDC · 0x91aa…e03c
                </span>
              </div>
            </div>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "18px", overflow: "hidden" }}>
              {($v.hero ?? []).map((h, $i0) => (
                <Fragment key={$i0}>
                  <div className="t-metric" style={{ gap: "6px" }}>
                    <span className="t-label">
                      <span className="sc-interp">{h?.k}</span>
                    </span>
                    <span className="t-num-md" style={{ fontSize: "22px", lineHeight: "28px" }}>
                      <span className="sc-interp">{h?.v}</span>
                      <span className="t-u">
                        <span className="sc-interp">{h?.u}</span>
                      </span>
                    </span>
                    <span className="t-cap">
                      <span className="sc-interp">{h?.d}</span>
                    </span>
                  </div>
                </Fragment>
              ))}
            </section>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-start" }}>
              <div style={{ flex: "999 1 560px", minWidth: "0", display: "flex", flexDirection: "column", gap: "24px" }}>
                <section className="t-card t-stack" style={{ gap: "20px" }}>
                  <div className="t-between">
                    <span className="t-h4">
                      Vault capital
                    </span>
                    <span className="t-cap">
                      48,250,000.00 USDC total
                    </span>
                  </div>
                  <div style={{ display: "flex", height: "28px", borderRadius: "2px", overflow: "hidden", gap: "2px" }}>
                    <div style={{ width: "75%", background: "var(--data-2)" }} />
                    <div style={{ width: "25%", background: "var(--data-1)" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}>
                    <div className="t-stack" style={{ gap: "4px" }}>
                      <span className="t-row t-label" style={{ gap: "6px" }}>
                        <span style={{ width: "10px", height: "10px", background: "var(--data-2)" }} />
                        Deployed to borrowers
                      </span>
                      <span className="t-num">
                        36,187,500.00
                      </span>
                      <span className="t-cap">
                        75.00% utilisation
                      </span>
                    </div>
                    <div className="t-stack" style={{ gap: "4px" }}>
                      <span className="t-row t-label" style={{ gap: "6px" }}>
                        <span style={{ width: "10px", height: "10px", background: "var(--data-1)" }} />
                        Cash available
                      </span>
                      <span className="t-num">
                        12,062,500.00
                      </span>
                      <span className="t-cap">
                        Withdrawable now
                      </span>
                    </div>
                    <div className="t-stack" style={{ gap: "4px" }}>
                      <span className="t-row t-label" style={{ gap: "6px" }}>
                        <span style={{ width: "10px", height: "10px", background: "var(--data-3)" }} />
                        Interest earned
                      </span>
                      <span className="t-num">
                        2,914,380.22
                      </span>
                      <span className="t-cap">
                        Since inception
                      </span>
                    </div>
                    <div className="t-stack" style={{ gap: "4px" }}>
                      <span className="t-label">
                        Reserve-factor fees
                      </span>
                      <span className="t-num">
                        291,438.02
                      </span>
                      <span className="t-cap">
                        10.00% of interest
                      </span>
                    </div>
                  </div>
                </section>
                <section className="t-card t-stack" style={{ gap: "16px" }}>
                  <div className="t-between">
                    <div className="t-stack" style={{ gap: "4px" }}>
                      <span className="t-h4">
                        Historical yield
                      </span>
                      <span className="t-cap">
                        Net yield to depositors after reserve factor, monthly
                      </span>
                    </div>
                    <span className="t-num-md">
                      {"6.12% "}
                      <span className="t-cap">
                        30 d
                      </span>
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", gap: "8px" }}>
                    <div className="t-stack t-cap" style={{ justifyContent: "space-between", height: "160px", textAlign: "right" }}>
                      <span>
                        8%
                      </span>
                      <span>
                        4%
                      </span>
                      <span>
                        0%
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: "160px", borderBottom: "1px solid var(--border)" }}>
                      {($v.yieldBars ?? []).map((b, $i0) => (
                        <Fragment key={$i0}>
                          <div className="t-stack" style={{ flex: "1", alignItems: "center", gap: "4px", height: "100%", justifyContent: "flex-end" }}>
                            <span className="t-cap" style={{ color: "var(--text-secondary)" }}>
                              <span className="sc-interp">{b?.v}</span>
                            </span>
                            <div style={{ width: "100%", height: b?.h, background: "var(--data-3)", borderRadius: "1px 1px 0 0" }} />
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="t-between t-cap" style={{ paddingLeft: "48px" }}>
                    <span>
                      Nov 2025
                    </span>
                    <span>
                      Oct 2026
                    </span>
                  </div>
                </section>
                <section className="t-card t-stack" style={{ gap: "20px" }}>
                  <div className="t-stack" style={{ gap: "4px" }}>
                    <span className="t-h4">
                      Where your capital goes
                    </span>
                    <span className="t-sm t-sec">
                      The vault lends into one market per lot. Each market only accepts that lot as collateral, so a problem with one lot cannot spread to another.
                    </span>
                  </div>
                  <div className="t-hflow">
                    <div className="t-hflow-node">
                      <span className="t-label">
                        Your USDC
                      </span>
                      <div className="t-num">
                        254,819.00
                      </div>
                    </div>
                    <div className="t-hflow-arrow">
                      →
                    </div>
                    <div className="t-hflow-node" style={{ borderColor: "var(--brand-border)" }}>
                      <span className="t-label">
                        Tensile credit vault
                      </span>
                      <div className="t-sm">
                        Allocates and caps exposure
                      </div>
                    </div>
                    <div className="t-hflow-arrow">
                      →
                    </div>
                    <div className="t-hflow-node">
                      <span className="t-label">
                        231 lot markets
                      </span>
                      <div className="t-sm">
                        Isolated, on Morpho
                      </div>
                    </div>
                    <div className="t-hflow-arrow">
                      →
                    </div>
                    <div className="t-hflow-node">
                      <span className="t-label">
                        Pledged lots
                      </span>
                      <div className="t-sm">
                        Inspected, in custody
                      </div>
                    </div>
                  </div>
                  <div className="t-table-wrap">
                    <table className="t-table t-dense">
                      <thead>
                        <tr>
                          <th>
                            Material
                          </th>
                          <th className="t-right">
                            Deployed (USDC)
                          </th>
                          <th className="t-right">
                            Share
                          </th>
                          <th className="t-right">
                            Markets
                          </th>
                          <th className="t-right">
                            Avg LTV
                          </th>
                          <th className="t-right">
                            Borrow rate
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {($v.alloc ?? []).map((a, $i0) => (
                          <Fragment key={$i0}>
                            <tr>
                              <td>
                                <span className="t-sm" style={{ fontWeight: "500" }}>
                                  <span className="sc-interp">{a?.m}</span>
                                </span>
                                {" "}
                                <span className="t-mono-sm t-muted">
                                  <span className="sc-interp">{a?.c}</span>
                                </span>
                              </td>
                              <td className="t-right">
                                <span className="sc-interp">{a?.d}</span>
                              </td>
                              <td className="t-right">
                                <span className="sc-interp">{a?.s}</span>
                              </td>
                              <td className="t-right">
                                <span className="sc-interp">{a?.n}</span>
                              </td>
                              <td className="t-right">
                                <span className="sc-interp">{a?.l}</span>
                              </td>
                              <td className="t-right">
                                <span className="sc-interp">{a?.r}</span>
                              </td>
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
              <aside className="t-card" style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div className="t-tabs" role="tablist">
                  <button className="t-tab" role="tab" aria-selected={$v.depOn} onClick={$v.toDep}>
                    Deposit
                  </button>
                  <button className="t-tab" role="tab" aria-selected={$v.wdOn} onClick={$v.toWd}>
                    Withdraw
                  </button>
                </div>
                {$v.isDep ? (
                  <>
                    <div className="t-stack" style={{ gap: "20px" }}>
                      <label className="t-field">
                        <div className="t-between">
                          <span className="t-label">
                            USDC amount
                          </span>
                          <span className="t-cap">
                            Wallet 412,500.00
                          </span>
                        </div>
                        <span style={{ position: "relative" }}>
                          <input className="t-input t-input-lg" defaultValue="100,000.00" readOnly />
                          <span className="t-sm t-sec" style={{ position: "absolute", right: "14px", top: "17px", fontWeight: "500" }}>
                            USDC
                          </span>
                        </span>
                      </label>
                      <div className="t-flow">
                        <div className="t-flow-node">
                          <span className="t-sm t-sec">
                            Deposit
                          </span>
                          <span className="t-num">
                            100,000.00 USDC
                          </span>
                        </div>
                        <div className="t-flow-arrow" />
                        <div className="t-flow-node">
                          <span className="t-sm t-sec">
                            Estimated shares at 1.041210
                          </span>
                          <span className="t-num">
                            96,042.10 tvUSDC
                          </span>
                        </div>
                        <div className="t-flow-arrow" />
                        <div className="t-flow-node" style={{ borderColor: "var(--brand-border)" }}>
                          <span className="t-sm t-sec">
                            New position
                          </span>
                          <span className="t-num" style={{ color: "var(--brand)" }}>
                            354,819.00 USDC
                          </span>
                        </div>
                      </div>
                      <div className="t-kv">
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Shares after
                          </span>
                          <span className="t-kv-v">
                            340,775.63 tvUSDC
                          </span>
                        </div>
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Deposit fee
                          </span>
                          <span className="t-kv-v">
                            0.00
                          </span>
                        </div>
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Current net yield
                          </span>
                          <span className="t-kv-v">
                            6.12%, variable
                          </span>
                        </div>
                      </div>
                      <button className="t-btn t-btn-primary t-btn-lg t-btn-block">
                        Deposit 100,000.00 USDC
                      </button>
                      {" "}
                      <span className="t-cap">
                        Two wallet steps: approve USDC, then deposit. Yield is variable and depends on borrower demand; it is not guaranteed.
                      </span>
                    </div>
                  </>
                ) : null}
                {" "}
                {$v.isWd ? (
                  <>
                    <div className="t-stack" style={{ gap: "20px" }}>
                      <div className="t-kv">
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Vault cash available
                          </span>
                          <span className="t-kv-v">
                            12,062,500.00 USDC
                          </span>
                        </div>
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Your position
                          </span>
                          <span className="t-kv-v">
                            254,819.00 USDC
                          </span>
                        </div>
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Maximum withdrawable now
                          </span>
                          <span className="t-kv-v" style={{ color: "var(--brand)" }}>
                            254,819.00 USDC
                          </span>
                        </div>
                      </div>
                      <label className="t-field">
                        <span className="t-label">
                          Withdraw amount
                        </span>
                        {" "}
                        <span style={{ position: "relative" }}>
                          <input className="t-input t-input-lg" defaultValue="50,000.00" readOnly />
                          <span className="t-sm t-sec" style={{ position: "absolute", right: "14px", top: "17px", fontWeight: "500" }}>
                            USDC
                          </span>
                        </span>
                      </label>
                      <div className="t-flow">
                        <div className="t-flow-node">
                          <span className="t-sm t-sec">
                            Shares redeemed
                          </span>
                          <span className="t-num">
                            48,021.05 tvUSDC
                          </span>
                        </div>
                        <div className="t-flow-arrow" />
                        <div className="t-flow-node" style={{ borderColor: "var(--brand-border)" }}>
                          <span className="t-sm t-sec">
                            You receive
                          </span>
                          <span className="t-num" style={{ color: "var(--brand)" }}>
                            50,000.00 USDC
                          </span>
                        </div>
                      </div>
                      <div className="t-kv">
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Remaining position
                          </span>
                          <span className="t-kv-v">
                            204,819.00 USDC · 196,712.48 tvUSDC
                          </span>
                        </div>
                      </div>
                      <button className="t-btn t-btn-primary t-btn-lg t-btn-block">
                        Withdraw 50,000.00 USDC
                      </button>
                      <div className="t-alert t-neutral">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: "none", marginTop: "2px" }}>
                          <path d="M12 3a9 9 0 100 18 9 9 0 100-18zM12 11v5M12 8v.5" />
                        </svg>
                        <p className="t-alert-body" style={{ margin: "0" }}>
                          If more is requested than the vault holds in cash, the rest becomes withdrawable as borrowers repay. Deployed capital is never recalled early.
                        </p>
                      </div>
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
