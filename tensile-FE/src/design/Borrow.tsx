// @ts-nocheck
/* Generated from Borrow.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic } from './runtime';
import Orb from './Orb';
import Sidebar from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import './Borrow.css';

class BorrowLogic extends DCLogic {
  state = { view: 'form', amt: 140000, shown: 140000, pending: false, txStep: 0 };
  tweenTo(target) {
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    cancelAnimationFrame(this.raf);
    const from = this.state.shown, t0 = performance.now(), dur = reduce ? 0 : 560;
    const step = (now) => {
      const p = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = 1 - Math.pow(1 - p, 3);
      this.setState({ shown: from + (target - from) * e });
      if (p < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  componentWillUnmount() { cancelAnimationFrame(this.raf); (this.timers || []).forEach(clearTimeout); }
  renderVals() {
    const v = this.state.view;
    const views = [['form', 'Borrow'], ['stale', 'Stale reserve'], ['over', 'Above max LTV'], ['active', 'Active loan']].map(([k, label]) => ({ label, on: v === k ? 'true' : 'false', pick: () => { const a = k === 'over' ? 210000 : (this.state.amt > 195000 ? 140000 : this.state.amt); this.setState({ view: k, pending: false, txStep: k === 'active' ? 4 : 0, amt: a }); this.tweenTo(a); } }));
    const amt = this.state.amt;
    const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const presets = [[48750, '25%'], [97500, '50%'], [140000, '140,000'], [195000, 'Max 195,000']].map(([a, label]) => ({ label, on: amt === a ? 'true' : 'false', pick: () => { this.setState({ amt: a, view: v === 'over' ? 'form' : v }); this.tweenTo(a); } }));
    const shown = this.state.shown;
    const ltvN = shown / 300000 * 100;
    const tx = this.state.txStep;
    const over = ltvN > 65;
    const fee = amt * 0.005;
    const stale = v === 'stale';
    const blocked = stale || over;
    const flow = [
      { t: 'Collateral', d: 'TNS-CU-00418 · 30.000 t copper', v: '$300,000.00' },
      { t: 'Lot pledged', d: 'Lien recorded to the credit vault', v: 'PLEDGED' },
      { t: 'Credit supplied', d: 'Tensile credit vault, lot market', v: fmt(amt) },
      { t: 'USDC borrowed', d: 'Debt opened at 7.85% APR', v: fmt(amt) },
      { t: 'Origination fee', d: '0.50% to the protocol', v: '−' + fmt(fee) },
      { t: 'Net USDC received', d: 'To 0x7a3f…c91e', v: fmt(amt - fee), last: true }
    ].map((f, i, a) => ({ ...f, arrow: i < a.length - 1, thr: [1, 1, 2, 2, 3, 4][i] })).map((f, i, a) => {
      const sOf = (n) => !tx ? '' : (tx >= 4 || n.thr < tx ? 'is-done' : (n.thr === tx ? 'is-live' : 'is-idle'));
      return { ...f, cls: sOf(f), acls: (tx && tx < 4 && sOf(f) !== 'is-idle' && i < a.length - 1 && sOf(a[i + 1]) === 'is-live') ? 'is-flowing' : '' };
    }).map((f) => ({ ...f,
      bg: f.last ? 'linear-gradient(180deg, rgba(215,252,253,.12), rgba(215,252,253,.05))' : 'rgba(215,252,253,.025)',
      sh: f.last ? 'inset 0 1px 0 rgba(240,255,255,.18), inset 0 0 0 1px rgba(215,252,253,.14), 0 10px 26px -14px rgba(120,230,230,.5)' : 'none',
      fg: f.last ? 'var(--brand)' : 'var(--text)' }));
    return {
      views, presets, flow,
      title: v === 'active' ? 'Loan LN-2291' : 'Borrow against TNS-CU-00418',
      isForm: v !== 'active', isActive: v === 'active',
      amount: fmt(shown), amountFinal: fmt(amt), available: '195,000.00',
      ltv: ltvN.toFixed(2) + '%', ltvW: Math.min(ltvN, 100).toFixed(2) + '%',
      ltvColor: over ? 'linear-gradient(90deg, rgba(255,139,123,.6), var(--danger))' : 'linear-gradient(90deg, rgba(141,185,242,.55), var(--data-2))',
      ltvGlow: over ? 'rgba(255,139,123,.6)' : 'rgba(141,185,242,.6)',
      ltvFg: over ? 't-fg-danger' : '', inputErr: over ? 't-input-error' : '',
      ltvCopy: over ? 'This amount would put the loan above the 65.00% limit.' : `You keep ${(65 - ltvN).toFixed(2)} points of headroom to the maximum and ${(77 - ltvN).toFixed(2)} points to liquidation.`,
      whTone: stale ? 't-warning' : 't-success', whLabel: stale ? 'Stale reserve feed' : 'Healthy · 111.11%',
      freshTone: stale ? 't-warning' : 't-success', freshLabel: stale ? 'Last update 26 h ago' : 'Fresh · 2 h ago',
      blocked, blockTone: 't-warning',
      blockTitle: stale ? 'Borrow unavailable: warehouse reserve data is stale.' : 'Borrow unavailable: this lot exceeds the configured LTV limit.',
      blockBody: stale ? 'Rotterdam Botlek 04 has not posted a reserve attestation for 26 hours; the limit is 24 hours. Borrowing resumes automatically when Portline Warehousing posts a fresh attestation. Your lot and any existing loan are unaffected.' : 'You asked for 210,000.00 USDC, which is 70.00% of the lot value. The maximum is 65.00%, or 195,000.00 USDC.',
      pending: this.state.pending, canSubmit: !blocked && !this.state.pending && tx === 0,
      yes: true, txStep: v === 'active' ? 4 : tx, orbCredit: fmt(amt - fee) + ' USDC to 0x7a3f…c91e',
      inTx: tx > 0 && v !== 'active',
      txLabel: ['', 'PROCESSING', 'CONFIRMING', 'CONFIRMING', 'COMPLETED'][tx] || '', txTone: tx >= 4 ? 't-success' : 't-info', txPulse: tx >= 4 ? '' : 't-pulse',
      txCopy: ['', 'Pledging TNS-CU-00418 to the credit vault', 'Credit supplied from the vault; USDC moving', 'Origination fee settled to the protocol', fmt(amt - fee) + ' USDC received in 0x7a3f…c91e'][tx] || '',
      txPct: ['0%', '22%', '52%', '78%', '100%'][tx] || '0%',
      submit: () => {
        const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        const gap = reduce ? 200 : 950;
        this.timers = [];
        this.setState({ pending: true, txStep: 1 });
        this.timers.push(setTimeout(() => this.setState({ txStep: 2 }), gap));
        this.timers.push(setTimeout(() => this.setState({ txStep: 3 }), gap * 2));
        this.timers.push(setTimeout(() => this.setState({ txStep: 4, pending: false }), gap * 3));
        this.timers.push(setTimeout(() => this.setState({ view: 'active' }), gap * 3 + (reduce ? 300 : 1600)));
      }
    };
  }
}

export default class Borrow extends BorrowLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-app">
        <div style={{ flex: "0 0 248px", display: "flex", background: "var(--bg-sunken)" }}>
          <Sidebar active="borrow" role="owner" />
        </div>
        <div className="t-main">
          <TopBar section="Borrow" crumb="TNS-CU-00418" />
          <main className="t-content">
            <div className="t-between t-wrap" style={{ alignItems: "flex-end" }}>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-eyebrow">
                  Borrow · F-2
                </span>
                <h1 className="t-h1">
                  <span className="sc-interp">{$v.title}</span>
                </h1>
              </div>
              <div className="t-seg" role="group" aria-label="Preview">
                {($v.views ?? []).map((v, $i0) => (
                  <Fragment key={$i0}>
                    <button aria-pressed={v?.on} onClick={v?.pick}>
                      <span className="sc-interp">{v?.label}</span>
                    </button>
                  </Fragment>
                ))}
              </div>
            </div>
            <section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "28px", padding: "4px 0" }}>
              <div className="t-row" style={{ gap: "14px", flex: "1 1 380px" }}>
                <div className="t-ruled" style={{ width: "52px", height: "52px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 0 rgba(240,255,255,.12), inset 0 0 0 1px rgba(215,252,253,.10)", backgroundColor: "rgba(215,252,253,.04)" }}>
                  <span className="t-mono" style={{ fontWeight: "500", color: "var(--brand)" }}>
                    CU
                  </span>
                </div>
                <div className="t-stack" style={{ gap: "6px", flex: "1" }}>
                  <label className="t-label" htmlFor="lotsel">
                    Selected lot
                  </label>
                  <select id="lotsel" className="t-input t-select" style={{ height: "38px", maxWidth: "360px", borderRadius: "999px", fontFamily: "var(--mono)", fontSize: "13px" }}>
                    <option>
                      TNS-CU-00418 · Copper cathode · 30.000 t
                    </option>
                    <option>
                      TNS-NI-00091 · Nickel briquette · 12.000 t
                    </option>
                  </select>
                </div>
              </div>
              <div className="t-metrics" style={{ gridTemplateColumns: "repeat(3, auto)" }}>
                <div className="t-metric">
                  <span className="t-label">
                    Current value
                  </span>
                  <span className="t-num-md t-lum">
                    $300,000.00
                  </span>
                </div>
                <div className="t-metric" style={{ gap: "8px" }}>
                  <span className="t-label">
                    Warehouse health
                  </span>
                  <span className={`t-badge t-badge-word ${$v.whTone ?? ''}`} style={{ alignSelf: "flex-start" }}>
                    <span className="t-dot" />
                    <span className="sc-interp">{$v.whLabel}</span>
                  </span>
                </div>
                <div className="t-metric" style={{ gap: "8px" }}>
                  <span className="t-label">
                    Attestation freshness
                  </span>
                  <span className={`t-badge t-badge-word ${$v.freshTone ?? ''}`} style={{ alignSelf: "flex-start" }}>
                    <span className="t-dot" />
                    <span className="sc-interp">{$v.freshLabel}</span>
                  </span>
                </div>
              </div>
            </section>
            {$v.isForm ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "28px", alignItems: "flex-start" }}>
                  <section className="t-float" style={{ flex: "999 1 560px", minWidth: "0", display: "flex", flexDirection: "column", gap: "30px", padding: "36px" }}>
                    <div className="t-metrics" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
                      <div className="t-metric">
                        <span className="t-cap">
                          Collateral value
                        </span>
                        <span className="t-num-md">
                          $300,000.00
                        </span>
                      </div>
                      <div className="t-metric">
                        <span className="t-cap">
                          Maximum LTV
                        </span>
                        <span className="t-num-md">
                          65.00%
                        </span>
                      </div>
                      <div className="t-metric">
                        <span className="t-cap">
                          Maximum borrow
                        </span>
                        <span className="t-num-md">
                          195,000.00
                        </span>
                      </div>
                      <div className="t-metric">
                        <span className="t-cap">
                          Existing debt
                        </span>
                        <span className="t-num-md">
                          0.00
                        </span>
                      </div>
                      <div className="t-metric">
                        <span className="t-cap" style={{ color: "var(--brand-text)" }}>
                          Available
                        </span>
                        <span className="t-num-md t-lum">
                          <span className="sc-interp">{$v.available}</span>
                        </span>
                      </div>
                    </div>
                    <div className="t-field" style={{ gap: "12px" }}>
                      <div className="t-between">
                        <label className="t-label" htmlFor="amt">
                          Borrow amount
                        </label>
                        <span className="t-cap">
                          {"Balance after: "}
                          <span className="sc-interp">{$v.amount}</span>
                          {" USDC in 0x7a3f…c91e"}
                        </span>
                      </div>
                      <div style={{ position: "relative" }}>
                        <input id="amt" className={`t-input t-input-lg ${$v.inputErr ?? ''}`} value={$v.amount} readOnly />
                        {" "}
                        <span className="t-row" style={{ position: "absolute", right: "8px", top: "12px", gap: "6px", height: "40px", padding: "0 14px", borderRadius: "999px", background: "rgba(215,252,253,.06)", boxShadow: "inset 0 1px 0 rgba(240,255,255,.08)" }}>
                          <span style={{ width: "16px", height: "16px", borderRadius: "999px", background: "linear-gradient(180deg, #8db9f2, #5a8fd6)" }} />
                          <span className="t-sm" style={{ fontWeight: "500" }}>
                            USDC
                          </span>
                        </span>
                      </div>
                      <div className="t-row t-wrap" style={{ gap: "8px" }}>
                        {($v.presets ?? []).map((p, $i0) => (
                          <Fragment key={$i0}>
                            <button className="t-chip" aria-pressed={p?.on} onClick={p?.pick}>
                              <span className="sc-interp">{p?.label}</span>
                            </button>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                    <div className="t-stack" style={{ gap: "14px" }}>
                      <div className="t-between" style={{ alignItems: "flex-end" }}>
                        <span className="t-label">
                          Loan-to-value after borrowing
                        </span>
                        <span className={`t-num-xl ${$v.ltvFg ?? ''}`} style={{ textShadow: "0 0 26px rgba(141,185,242,.35)" }}>
                          <span className="sc-interp">{$v.ltv}</span>
                        </span>
                      </div>
                      <div style={{ position: "relative", height: "14px", borderRadius: "999px", background: "linear-gradient(90deg, rgba(215,252,253,.06) 0 65%, rgba(240,184,96,.14) 65% 77%, rgba(255,139,123,.16) 77% 100%)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.45), inset 0 0 0 1px rgba(215,252,253,.05)" }}>
                        <div style={{ position: "absolute", left: "0", top: "0", bottom: "0", width: $v.ltvW, background: $v.ltvColor, borderRadius: "999px", transition: "width .3s ease", boxShadow: `0 0 18px -2px ${$v.ltvGlow ?? ''}, inset 0 1px 0 rgba(255,255,255,.4)` }} />
                        <span className="t-mark t-mark-warn" style={{ left: "65%" }} />
                        <span className="t-mark t-mark-danger" style={{ left: "77%" }} />
                      </div>
                      <div style={{ position: "relative", height: "32px" }}>
                        <span className="t-cap" style={{ position: "absolute", left: "0" }}>
                          0%
                        </span>
                        {" "}
                        <span className="t-cap" style={{ position: "absolute", left: "65%", transform: "translateX(-50%)", textAlign: "center", color: "var(--warning-text)" }}>
                          Max LTV 65%
                          <br />
                          $195,000
                        </span>
                        {" "}
                        <span className="t-cap" style={{ position: "absolute", left: "77%", transform: "translateX(-20%)", textAlign: "left", color: "var(--danger-text)" }}>
                          Liquidation 77%
                          <br />
                          $231,000
                        </span>
                        {" "}
                        <span className="t-cap" style={{ position: "absolute", right: "0" }}>
                          100%
                        </span>
                      </div>
                      <span className="t-sm t-sec">
                        <span className="sc-interp">{$v.ltvCopy}</span>
                      </span>
                    </div>
                    {$v.blocked ? (
                      <>
                        <div className={`t-alert ${$v.blockTone ?? ''}`}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: "none", marginTop: "1px", color: "var(--warning)" }}>
                            <path d="M12 3l9 16H3zM12 10v4M12 17v.5" />
                          </svg>
                          <div>
                            <p className="t-alert-title">
                              <span className="sc-interp">{$v.blockTitle}</span>
                            </p>
                            <p className="t-alert-body">
                              <span className="sc-interp">{$v.blockBody}</span>
                            </p>
                          </div>
                        </div>
                      </>
                    ) : null}
                    {" "}
                    {$v.inTx ? (
                      <>
                        <div className="t-stack" style={{ gap: "10px" }}>
                          <div className="t-txstate">
                            <span className={`t-badge ${$v.txTone ?? ''}`}>
                              <span className={`t-dot ${$v.txPulse ?? ''}`} />
                              <span className="sc-interp">{$v.txLabel}</span>
                            </span>
                            <span>
                              <span className="sc-interp">{$v.txCopy}</span>
                            </span>
                          </div>
                          <div className="t-txbar">
                            <span style={{ width: $v.txPct }} />
                          </div>
                        </div>
                      </>
                    ) : null}
                    {" "}
                    {$v.pending ? (
                      <>
                        <button className="t-btn t-btn-primary t-btn-lg t-btn-block" aria-disabled="true" style={{ color: "var(--on-primary)", background: "linear-gradient(180deg,#e6fefe,#c6f1f1)", opacity: ".9" }}>
                          <span className="t-spinner" />
                          Confirm in wallet…
                        </button>
                      </>
                    ) : null}
                    {" "}
                    {$v.canSubmit ? (
                      <>
                        <button className="t-btn t-btn-primary t-btn-lg t-btn-block" onClick={$v.submit}>
                          {"Borrow "}
                          <span className="sc-interp">{$v.amountFinal}</span>
                          {" USDC"}
                        </button>
                      </>
                    ) : null}
                    {" "}
                    {$v.blocked ? (
                      <>
                        <button className="t-btn t-btn-lg t-btn-block" disabled>
                          Borrow unavailable
                        </button>
                      </>
                    ) : null}
                  </section>
                  <aside style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Orb mode="borrow" focus="RTM-BOT-04" phase={$v.txStep} lot="TNS-CU-00418" l1={$v.orbCredit} compact={$v.yes} w="340" />
                    </div>
                    <div className="t-card t-stack" style={{ gap: "18px" }}>
                      <span className="t-h4">
                        Transaction preview
                      </span>
                      <div className="t-flow">
                        {($v.flow ?? []).map((f, $i0) => (
                          <Fragment key={$i0}>
                            <div className={`t-flow-node ${f?.cls ?? ''}`} style={{ background: f?.bg, boxShadow: f?.sh }}>
                              <div className="t-stack">
                                <span className="t-sm" style={{ fontWeight: "500" }}>
                                  <span className="sc-interp">{f?.t}</span>
                                </span>
                                <span className="t-cap">
                                  <span className="sc-interp">{f?.d}</span>
                                </span>
                              </div>
                              <span className="t-num" style={{ color: f?.fg }}>
                                <span className="sc-interp">{f?.v}</span>
                              </span>
                            </div>
                            {f?.arrow ? (
                              <>
                                <div className={`t-flow-arrow ${f?.acls ?? ''}`} />
                              </>
                            ) : null}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                    <div className="t-kv" style={{ padding: "0 8px" }}>
                      <div className="t-kv-row">
                        <span className="t-kv-k">
                          Borrow rate
                        </span>
                        <span className="t-kv-v">
                          7.85% APR, variable
                        </span>
                      </div>
                      <div className="t-kv-row">
                        <span className="t-kv-k">
                          Origination fee
                        </span>
                        <span className="t-kv-v">
                          0.50%
                        </span>
                      </div>
                      <div className="t-kv-row">
                        <span className="t-kv-k">
                          Market
                        </span>
                        <span className="t-kv-v">
                          CU-00418 / USDC
                        </span>
                      </div>
                      <div className="t-kv-row">
                        <span className="t-kv-k">
                          Repay
                        </span>
                        <span className="t-kv-v">
                          Any time, no penalty
                        </span>
                      </div>
                    </div>
                  </aside>
                </div>
              </>
            ) : null}
            {" "}
            {$v.isActive ? (
              <>
                <div className="t-alert t-success">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                  <div>
                    <p className="t-alert-title">
                      Loan LN-2291 opened
                    </p>
                    <p className="t-alert-body">
                      139,300.00 USDC was sent to 0x7a3f…c91e at 2026-10-03 11:25 UTC (tx 0x5c2e…a417). TNS-CU-00418 is now pledged to the credit vault.
                    </p>
                  </div>
                </div>
                <section className="t-float t-stack" style={{ gap: "32px", padding: "36px" }}>
                  <div className="t-metrics" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                    <div className="t-metric">
                      <span className="t-label">
                        Debt
                      </span>
                      <span className="t-num-lg t-lum">
                        140,630
                        <span className="t-f">
                          .14
                        </span>
                        <span className="t-u">
                          USDC
                        </span>
                      </span>
                      <span className="t-cap">
                        Principal 140,000.00 · interest 630.14
                      </span>
                    </div>
                    <div className="t-metric">
                      <span className="t-label">
                        LTV
                      </span>
                      <span className="t-num-lg">
                        46.88%
                      </span>
                      <span className="t-cap">
                        Max 65.00% · liquidation 77.00%
                      </span>
                    </div>
                    <div className="t-metric" style={{ gap: "10px" }}>
                      <span className="t-label">
                        Collateral status
                      </span>
                      <span className="t-badge t-info" style={{ alignSelf: "flex-start" }}>
                        PLEDGED · LN-2291
                      </span>
                      <span className="t-cap">
                        Owner: Halden Metals Ltd
                      </span>
                    </div>
                    <div className="t-metric">
                      <span className="t-label">
                        Interest
                      </span>
                      <span className="t-num-lg">
                        7.85%
                        <span className="t-u">
                          APR
                        </span>
                      </span>
                      <span className="t-cap">
                        Accruing 30.25 USDC per day
                      </span>
                    </div>
                  </div>
                  <div className="t-hr" />
                  <div className="t-stack" style={{ gap: "20px" }}>
                    <div className="t-between">
                      <span className="t-h4">
                        Position health
                      </span>
                      <span className="t-badge t-badge-word t-success">
                        <span className="t-dot" />
                        Healthy
                      </span>
                    </div>
                    <div className="t-meter" style={{ height: "12px" }}>
                      <div className="t-meter-fill" style={{ width: "46.88%", background: "linear-gradient(90deg, rgba(141,185,242,.6), var(--data-2))", boxShadow: "0 0 16px -2px rgba(141,185,242,.6)" }} />
                      <span className="t-mark t-mark-warn" style={{ left: "65%" }} />
                      <span className="t-mark-label" style={{ left: "65%" }}>
                        Max 65%
                      </span>
                      <span className="t-mark t-mark-danger" style={{ left: "77%" }} />
                      <span className="t-mark-label" style={{ left: "82%" }}>
                        Liquidation 77%
                      </span>
                    </div>
                    <span className="t-sm t-sec" style={{ paddingTop: "12px" }}>
                      Copper would need to fall 39.12%, to $6,087.89 per tonne, before this loan becomes eligible for liquidation.
                    </span>
                    <div className="t-row t-wrap" style={{ gap: "12px" }}>
                      <button className="t-btn t-btn-primary t-btn-lg">
                        Repay
                      </button>
                      {" "}
                      <button className="t-btn t-btn-secondary t-btn-lg">
                        Borrow more · up to 54,369.86 USDC
                      </button>
                      {" "}
                      <button className="t-btn t-btn-secondary t-btn-lg">
                        Close loan · repay 140,630.14 USDC
                      </button>
                    </div>
                  </div>
                </section>
              </>
            ) : null}
          </main>
        </div>
      </div>
    );
  }
}
