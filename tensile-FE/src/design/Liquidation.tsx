// @ts-nocheck
/* Generated from Liquidation.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic } from './runtime';
import Sidebar from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import './Liquidation.css';

class LiquidationLogic extends DCLogic {
  state = { p: 10000 };
  renderVals() {
    const p = this.state.p;
    const debt = 140630.14;
    const val = p * 30;
    const ltvN = debt / val * 100;
    const fmt = (n, dp = 2) => n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    const scen = [[10000, '$10,000 today'], [8000, '$8,000'], [6800, '$6,800'], [5900, '$5,900']].map(([v, label]) => ({ label, on: p === v ? 'true' : 'false', pick: () => this.setState({ p: v }) }));
    const lvlIdx = ltvN < 55 ? 0 : ltvN < 65 ? 1 : ltvN < 77 ? 2 : 3;
    const B = [['Healthy', 'below 55%', 'var(--success)', 'var(--success-text)'], ['Caution', '55–65%', 'var(--warning)', 'var(--warning-text)'], ['At risk', '65–77%', 'var(--danger)', 'var(--danger-text)'], ['Liquidation eligible', '77% and above', 'var(--danger-active, #f06f5e)', 'var(--danger-text)']];
    const bands = B.map(([t, r, c, fg], i) => ({ t, r, c, fg: i === lvlIdx ? fg : 'var(--text-muted)', op: i === lvlIdx ? '1' : '.3', ol: i === lvlIdx ? '1px solid var(--text)' : 'none' }));
    const tones = ['t-success', 't-warning', 't-danger', 't-solid-danger'];
    const book = [
      { id: 'LN-2236', lot: 'TNS-AL-00236', wh: 'PKL-WST-02', c: '$65,790.00', d: '27,989.60', l: '42.54%', r: 'Partially liquidated', tone: 't-danger' },
      { id: 'LN-2288', lot: 'TNS-NI-00087', wh: 'SIN-JUR-01', c: '$214,500.00', d: '150,150.00', l: '70.00%', r: 'At risk', tone: 't-danger' },
      { id: 'LN-2279', lot: 'TNS-CU-00402', wh: 'ANR-DEL-03', c: '$246,250.00', d: '148,981.25', l: '60.50%', r: 'Caution', tone: 't-warning' },
      { id: 'LN-2291', lot: 'TNS-CU-00418', wh: 'RTM-BOT-04', c: '$300,000.00', d: '140,630.14', l: '46.88%', r: 'Healthy', tone: 't-success' },
      { id: 'LN-2302', lot: 'TNS-CU-00422', wh: 'RTM-BOT-04', c: '$200,000.00', d: '90,554.12', l: '45.28%', r: 'Healthy', tone: 't-success' }
    ];
    return {
      scen, bands, book,
      price: '$' + fmt(p) + ' / t', val: '$' + fmt(val), ltv: ltvN.toFixed(2) + '%',
      ltvFg: lvlIdx >= 2 ? 't-fg-danger' : (lvlIdx === 1 ? 't-fg-warning' : ''),
      liqVal: '$' + fmt(debt / 0.77) + ' value',
      cap: fmt(Math.max(0, val * 0.65 - debt)),
      lvl: ['Healthy', 'Caution', 'At risk', 'Liquidation eligible'][lvlIdx], lvlTone: tones[lvlIdx],
      pin: Math.min(ltvN, 99) + '%',
      isLiq: lvlIdx === 3, isRisk: lvlIdx === 2
    };
  }
}

export default class Liquidation extends LiquidationLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-app">
        <div style={{ flex: "0 0 248px", display: "flex", background: "var(--bg-sunken)" }}>
          <Sidebar active="risk" role="ops" />
        </div>
        <div className="t-main">
          <TopBar section="Operations" crumb="Risk and liquidation" />
          <main className="t-content">
            <div className="t-between t-wrap" style={{ alignItems: "flex-end" }}>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-eyebrow">
                  Credit risk
                </span>
                <h1 className="t-h1">
                  {"LN-2291 · "}
                  <span className="t-mono" style={{ fontSize: "30px" }}>
                    TNS-CU-00418
                  </span>
                </h1>
                <span className="t-sm t-sec">
                  Stress the loan against the copper price. Liquidation is eligible once LTV reaches 77.00%.
                </span>
              </div>
              <div className="t-stack" style={{ gap: "6px", alignItems: "flex-end" }}>
                <span className="t-label">
                  Copper price scenario
                </span>
                <div className="t-seg" role="group" aria-label="Price scenario">
                  {($v.scen ?? []).map((s, $i0) => (
                    <Fragment key={$i0}>
                      <button aria-pressed={s?.on} onClick={s?.pick}>
                        <span className="sc-interp">{s?.label}</span>
                      </button>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
            {$v.isLiq ? (
              <>
                <div className="t-alert" style={{ background: "var(--danger)", borderColor: "var(--danger)", color: "var(--on-danger)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
                    <path d="M12 3l9 16H3zM12 10v4M12 17v.5" />
                  </svg>
                  <div>
                    <p className="t-alert-title">
                      Liquidation risk · LTV 79.45% is above the 77.00% threshold
                    </p>
                    <p className="t-alert-body" style={{ color: "var(--on-danger)" }}>
                      Copper at $5,900.00 / t values the lot at $177,000.00 against 140,630.14 USDC of debt. Liquidators may now repay part of the debt and take collateral units. Repay 16,730.14 USDC to return below 70.00%.
                    </p>
                  </div>
                </div>
              </>
            ) : null}
            {" "}
            {$v.isRisk ? (
              <>
                <div className="t-alert t-warning">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
                    <path d="M12 3l9 16H3zM12 10v4M12 17v.5" />
                  </svg>
                  <div>
                    <p className="t-alert-title">
                      Borrow capacity reduced · LTV above the 65.00% maximum
                    </p>
                    <p className="t-alert-body">
                      No new borrowing on this lot. Liquidation starts at 77.00%; copper would need to fall a further 10.47% to $6,087.89 / t.
                    </p>
                  </div>
                </div>
              </>
            ) : null}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "18px", overflow: "hidden" }}>
              <div className="t-metric" style={{ gap: "6px" }}>
                <span className="t-label">
                  Collateral value
                </span>
                <span className="t-num-md">
                  <span className="sc-interp">{$v.val}</span>
                </span>
                <span className="t-cap">
                  {"30.000 t × "}
                  <span className="sc-interp">{$v.price}</span>
                </span>
              </div>
              <div className="t-metric" style={{ gap: "6px" }}>
                <span className="t-label">
                  Current debt
                </span>
                <span className="t-num-md">
                  140,630.14
                </span>
                <span className="t-cap">
                  USDC
                </span>
              </div>
              <div className="t-metric" style={{ gap: "6px" }}>
                <span className="t-label">
                  LTV
                </span>
                <span className={`t-num-lg ${$v.ltvFg ?? ''}`}>
                  <span className="sc-interp">{$v.ltv}</span>
                </span>
              </div>
              <div className="t-metric" style={{ gap: "6px" }}>
                <span className="t-label">
                  Liquidation threshold
                </span>
                <span className="t-num-md">
                  77.00%
                </span>
                <span className="t-cap">
                  {"at "}
                  <span className="sc-interp">{$v.liqVal}</span>
                </span>
              </div>
              <div className="t-metric" style={{ gap: "6px" }}>
                <span className="t-label">
                  Remaining capacity
                </span>
                <span className="t-num-md">
                  <span className="sc-interp">{$v.cap}</span>
                </span>
                <span className="t-cap">
                  to 65.00% max
                </span>
              </div>
              <div className="t-metric" style={{ gap: "6px" }}>
                <span className="t-label">
                  Risk level
                </span>
                <span className={`t-badge t-badge-word ${$v.lvlTone ?? ''}`} style={{ alignSelf: "flex-start", height: "26px", fontSize: "13px" }}>
                  <span className="t-dot" />
                  <span className="sc-interp">{$v.lvl}</span>
                </span>
              </div>
            </section>
            <section className="t-card t-stack" style={{ gap: "16px" }}>
              <span className="t-h4">
                Risk progression
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "55fr 10fr 12fr 23fr", gap: "3px" }}>
                {($v.bands ?? []).map((b, $i0) => (
                  <Fragment key={$i0}>
                    <div className="t-stack" style={{ gap: "6px" }}>
                      <div style={{ height: "12px", borderRadius: "2px", background: b?.c, opacity: b?.op, outline: b?.ol, outlineOffset: "2px" }} />
                      <span className="t-sm" style={{ fontWeight: "600", color: b?.fg }}>
                        <span className="sc-interp">{b?.t}</span>
                      </span>
                      {" "}
                      <span className="t-cap">
                        <span className="sc-interp">{b?.r}</span>
                      </span>
                    </div>
                  </Fragment>
                ))}
              </div>
              <div style={{ position: "relative", height: "20px" }}>
                <span style={{ position: "absolute", left: $v.pin, transform: "translateX(-50%)", top: "0" }} className="t-mono-sm">
                  {"▲ "}
                  <span className="sc-interp">{$v.ltv}</span>
                </span>
              </div>
            </section>
            <section className="t-card t-stack" style={{ gap: "20px" }}>
              <div className="t-between t-wrap">
                <div className="t-stack" style={{ gap: "4px" }}>
                  <span className="t-eyebrow">
                    Partially liquidated
                  </span>
                  <span className="t-h3">
                    {"LN-2236 · "}
                    <span className="t-mono">
                      TNS-AL-00236
                    </span>
                    {" · 40.000 t aluminium"}
                  </span>
                </div>
                <span className="t-badge t-danger">
                  PARTIALLY LIQUIDATED
                </span>
              </div>
              <div className="t-alert t-neutral">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
                  <path d="M12 3a9 9 0 100 18 9 9 0 100-18zM12 11v5M12 8v.5" />
                </svg>
                <div>
                  <p className="t-alert-title">
                    Partial collateral remains
                  </p>
                  <p className="t-alert-body">
                    The physical lot is not divided in the warehouse. When the loan was opened, the passport was wrapped into 40,000 collateral units (1 unit = 1 kg). A liquidation transferred some units, so ownership of this lot is now shared.
                  </p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "24px" }}>
                <div className="t-stack" style={{ gap: "12px" }}>
                  <span className="t-label">
                    Original physical lot
                  </span>
                  <div className="t-plate" style={{ padding: "20px" }}>
                    <span className="t-reg t-reg-tl" />
                    <span className="t-reg t-reg-br" />
                    <div className="t-between">
                      <span className="t-mono">
                        TNS-AL-00236
                      </span>
                      <span className="t-badge t-info">
                        PLEDGED
                      </span>
                    </div>
                    <div className="t-num-lg" style={{ paddingTop: "8px" }}>
                      40.000
                      <span className="t-u">
                        t
                      </span>
                    </div>
                    <span className="t-cap">
                      Port Klang West 02 · one passport, one physical lot
                    </span>
                  </div>
                </div>
                <div className="t-stack" style={{ gap: "12px" }}>
                  <span className="t-label">
                    {"Collateral units · "}
                    <span className="t-mono">
                      cTNS-AL-00236
                    </span>
                  </span>
                  <div style={{ display: "flex", height: "40px", gap: "2px", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ width: "64.5%", background: "var(--data-4)", display: "flex", alignItems: "center", padding: "0 10px" }}>
                      <span className="t-mono-sm" style={{ color: "var(--brand-abyss)" }}>
                        OWNER 25,800
                      </span>
                    </div>
                    <div style={{ width: "35.5%", background: "var(--data-3)", display: "flex", alignItems: "center", padding: "0 10px" }}>
                      <span className="t-mono-sm" style={{ color: "var(--brand-abyss)" }}>
                        LIQUIDATOR 14,200
                      </span>
                    </div>
                  </div>
                  <div className="t-kv">
                    <div className="t-kv-row">
                      <span className="t-kv-k">
                        Ardent Metals FZE (original owner)
                      </span>
                      <span className="t-kv-v">
                        25,800 units · still pledged
                      </span>
                    </div>
                    <div className="t-kv-row">
                      <span className="t-kv-k">
                        Kestrel Commodities (liquidator)
                      </span>
                      <span className="t-kv-v">
                        14,200 units · unencumbered
                      </span>
                    </div>
                    <div className="t-kv-row">
                      <span className="t-kv-k">
                        Debt repaid by liquidation
                      </span>
                      <span className="t-kv-v">
                        33,890.40 USDC
                      </span>
                    </div>
                    <div className="t-kv-row">
                      <span className="t-kv-k">
                        Remaining debt
                      </span>
                      <span className="t-kv-v">
                        27,989.60 USDC · LTV 42.54%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <span className="t-sm t-sec">
                Units can be sold or pledged separately. Redeeming the physical 40.000 t requires one holder to hold all 40,000 units and the remaining debt to be repaid.
              </span>
            </section>
            <section className="t-stack" style={{ gap: "12px" }}>
              <div className="t-between">
                <span className="t-h4">
                  Loans by risk
                </span>
                <span className="t-cap">
                  231 active loans · 36,187,500.00 USDC
                </span>
              </div>
              <div className="t-table-wrap">
                <table className="t-table t-dense">
                  <thead>
                    <tr>
                      <th>
                        Loan
                      </th>
                      <th>
                        Lot
                      </th>
                      <th>
                        Warehouse
                      </th>
                      <th className="t-right">
                        Collateral
                      </th>
                      <th className="t-right">
                        Debt
                      </th>
                      <th className="t-right">
                        LTV
                      </th>
                      <th>
                        Risk
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {($v.book ?? []).map((b, $i0) => (
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
                          <td>
                            <span className="t-mono t-sec">
                              <span className="sc-interp">{b?.wh}</span>
                            </span>
                          </td>
                          <td className="t-right">
                            <span className="sc-interp">{b?.c}</span>
                          </td>
                          <td className="t-right">
                            <span className="sc-interp">{b?.d}</span>
                          </td>
                          <td className="t-right">
                            <span className="sc-interp">{b?.l}</span>
                          </td>
                          <td>
                            <span className={`t-badge t-badge-word ${b?.tone ?? ''}`}>
                              <span className="t-dot" />
                              <span className="sc-interp">{b?.r}</span>
                            </span>
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }
}
