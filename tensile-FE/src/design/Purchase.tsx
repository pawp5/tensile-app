// @ts-nocheck
/* Generated from Purchase.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic } from './runtime';
import Sidebar from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import './Purchase.css';

class PurchaseLogic extends DCLogic {
  state = { kind: 'enc', phase: 'review', lit: -1 };
  componentWillUnmount() { clearInterval(this.iv); }
  renderVals() {
    const enc = this.state.kind === 'enc';
    const ph = this.state.phase;
    const d = enc
      ? { id: 'TNS-CU-00427', mat: 'Copper cathode, Grade A', qty: '25.000 t', wh: 'Rotterdam Botlek 04', insp: '2026-10-02', price: '$246,250', priceFull: '246,250.00', ppt: '$9,850.00', lien: 'PLEDGED · LN-2310', lienTone: 't-info', lienD: 'Debt 120,412.50 USDC at quote', seller: 'Northgate Refining Co.', exp: '2026-10-12 18:00 UTC', fee: '615.63' }
      : { id: 'TNS-AL-00233', mat: 'Aluminium ingot P1020', qty: '100.000 t', wh: 'Antwerp Deurganck 03', insp: '2026-09-30', price: '$260,000', priceFull: '260,000.00', ppt: '$2,600.00', lien: 'FREE', lienTone: 't-success', lienD: 'No debt', seller: 'Varga Resources AG', exp: '2026-10-15 18:00 UTC', fee: '650.00' };
    const flowEnc = [
      { n: '01', t: 'Buyer payment', d: 'From Halden Metals Ltd', v: '246,250.00' },
      { n: '02', t: 'Loan payoff', d: 'LN-2310 repaid in full to the credit vault; lien released', v: '−120,412.50', fg: 'var(--info-text)' },
      { n: '03', t: 'Settlement fee', d: '0.25% to the protocol', v: '−615.63', fg: 'var(--warning-text)' },
      { n: '04', t: 'Seller proceeds', d: 'To Northgate Refining Co.', v: '125,221.87' },
      { n: '05', t: 'Lot ownership transferred', d: 'TNS-CU-00427 to 0x7a3f…c91e, FREE of lien', v: 'FREE', fg: 'var(--success-text)', last: true }
    ];
    const flowFree = [
      { n: '01', t: 'Buyer payment', d: 'From Halden Metals Ltd', v: '260,000.00' },
      { n: '02', t: 'Settlement fee', d: '0.25% to the protocol', v: '−650.00', fg: 'var(--warning-text)' },
      { n: '03', t: 'Seller proceeds', d: 'To Varga Resources AG', v: '259,350.00' },
      { n: '04', t: 'Lot ownership transferred', d: 'TNS-AL-00233 to 0x7a3f…c91e', v: 'FREE', fg: 'var(--success-text)', last: true }
    ];
    const lit = this.state.lit;
    const sOf = (i) => ph === 'done' ? 'is-done' : (ph !== 'pending' ? '' : (i < lit ? 'is-done' : (i === lit ? 'is-live' : 'is-idle')));
    const flow = (enc ? flowEnc : flowFree).map((f, i, a) => ({ ...f, fg: f.fg || 'var(--text)', arrow: i < a.length - 1, bd: f.last ? 'var(--success-border)' : 'var(--border)', cls: sOf(i), acls: (ph === 'pending' && i === lit - 1) ? 'is-flowing' : '' }));
    const split = enc
      ? [{ label: 'Loan payoff', short: 'PAYOFF', v: '120,412.50', w: '48.9%', c: 'var(--data-2)' }, { label: 'Fee', short: '', v: '615.63', w: '0.6%', c: 'var(--data-3)' }, { label: 'Seller', short: 'SELLER', v: '125,221.87', w: '50.5%', c: 'var(--data-1)' }]
      : [{ label: 'Fee', short: '', v: '650.00', w: '0.6%', c: 'var(--data-3)' }, { label: 'Seller', short: 'SELLER', v: '259,350.00', w: '99.4%', c: 'var(--data-1)' }];
    const checks = ['Your identity is verified (Tier 2)', 'USDC balance 412,500.00 covers the price', 'Listing is valid and unexpired', enc ? 'Payoff amount locked for 10 minutes' : 'Warehouse ANR-DEL-03 is healthy'];
    return {
      ...d, flow, split, checks,
      settleCopy: enc ? 'This lot is collateral for a loan. You do not need to deal with the lender: your payment first repays the loan in full, then the fee, and the rest goes to the seller. You receive the lot free of any lien.' : 'This lot carries no debt. Your payment goes to the seller less the settlement fee, and the lot moves to you.',
      freeOn: enc ? 'false' : 'true', encOn: enc ? 'true' : 'false',
      toFree: () => { clearInterval(this.iv); this.setState({ kind: 'free', phase: 'review', lit: -1 }); }, toEnc: () => { clearInterval(this.iv); this.setState({ kind: 'enc', phase: 'review', lit: -1 }); },
      litN: Math.min(this.state.lit + 1, flow.length), flowN: flow.length,
      isReview: ph === 'review', isPending: ph === 'pending', isDone: ph === 'done',
      buy: () => {
        const n = flow.length;
        const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        this.setState({ phase: 'pending', lit: 0 });
        clearInterval(this.iv);
        this.iv = setInterval(() => {
          const next = this.state.lit + 1;
          if (next >= n) { clearInterval(this.iv); this.setState({ phase: 'done', lit: n }); } else this.setState({ lit: next });
        }, reduce ? 120 : 720);
      }
    };
  }
}

export default class Purchase extends PurchaseLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-app">
        <div style={{ flex: "0 0 248px", display: "flex", background: "var(--bg-sunken)" }}>
          <Sidebar active="marketplace" role="buyer" />
        </div>
        <div className="t-main">
          <TopBar section="Marketplace" crumb={$v.id} />
          <main className="t-content">
            <div className="t-between t-wrap" style={{ alignItems: "flex-end" }}>
              <div className="t-stack" style={{ gap: "8px" }}>
                <a href="/marketplace" className="t-sm">
                  ← Marketplace
                </a>
                <span className="t-eyebrow">
                  Lot sale · atomic settlement
                </span>
                <h1 className="t-h1">
                  {"Buy "}
                  <span className="t-mono" style={{ fontSize: "32px" }}>
                    <span className="sc-interp">{$v.id}</span>
                  </span>
                </h1>
              </div>
              <div className="t-seg" role="group" aria-label="Lot type">
                <button aria-pressed={$v.freeOn} onClick={$v.toFree}>
                  Free lot
                </button>
                <button aria-pressed={$v.encOn} onClick={$v.toEnc}>
                  Pledged lot
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-start" }}>
              <section style={{ flex: "999 1 560px", minWidth: "0", display: "flex", flexDirection: "column", gap: "24px" }}>
                <div className="t-card" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "20px" }}>
                  <div className="t-stack" style={{ gap: "4px", gridColumn: "span 2" }}>
                    <span className="t-label">
                      Lot
                    </span>
                    <span className="t-h4">
                      <span className="sc-interp">{$v.mat}</span>
                    </span>
                    <span className="t-cap">
                      <span className="sc-interp">{$v.qty}</span>
                      {" · "}
                      <span className="sc-interp">{$v.wh}</span>
                      {" · inspected "}
                      <span className="sc-interp">{$v.insp}</span>
                    </span>
                  </div>
                  <div className="t-stack" style={{ gap: "4px" }}>
                    <span className="t-label">
                      Price
                    </span>
                    <span className="t-num-md">
                      <span className="sc-interp">{$v.price}</span>
                    </span>
                    <span className="t-cap">
                      <span className="sc-interp">{$v.ppt}</span>
                      {" / t"}
                    </span>
                  </div>
                  <div className="t-stack" style={{ gap: "4px" }}>
                    <span className="t-label">
                      Encumbrance
                    </span>
                    <span className={`t-badge ${$v.lienTone ?? ''}`} style={{ alignSelf: "flex-start" }}>
                      <span className="sc-interp">{$v.lien}</span>
                    </span>
                    <span className="t-cap">
                      <span className="sc-interp">{$v.lienD}</span>
                    </span>
                  </div>
                  <div className="t-stack" style={{ gap: "4px", gridColumn: "span 2" }}>
                    <span className="t-label">
                      Seller
                    </span>
                    <span className="t-sm">
                      <span className="sc-interp">{$v.seller}</span>
                      {" "}
                      <span className="t-badge t-badge-word t-success" style={{ height: "20px" }}>
                        Tier 2
                      </span>
                    </span>
                  </div>
                  <div className="t-stack" style={{ gap: "4px", gridColumn: "span 2" }}>
                    <span className="t-label">
                      Listing
                    </span>
                    <span className="t-sm">
                      {"Valid until "}
                      <span className="sc-interp">{$v.exp}</span>
                      {" · "}
                      <a href="/lots">
                        View passport
                      </a>
                    </span>
                  </div>
                </div>
                <div className="t-card t-stack" style={{ gap: "20px" }}>
                  <div className="t-stack" style={{ gap: "4px" }}>
                    <span className="t-h3">
                      How this sale settles
                    </span>
                    <span className="t-sm t-sec">
                      <span className="sc-interp">{$v.settleCopy}</span>
                    </span>
                  </div>
                  <div className="t-stack" style={{ gap: "8px" }}>
                    <div style={{ display: "flex", height: "36px", gap: "2px", borderRadius: "2px", overflow: "hidden" }}>
                      {($v.split ?? []).map((s, $i0) => (
                        <Fragment key={$i0}>
                          <div style={{ width: s?.w, background: s?.c, display: "flex", alignItems: "center", padding: "0 10px", minWidth: "6px" }}>
                            <span className="t-mono-sm" style={{ color: "var(--brand-abyss)", whiteSpace: "nowrap", overflow: "hidden" }}>
                              <span className="sc-interp">{s?.short}</span>
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                    <div className="t-row t-wrap t-cap" style={{ gap: "16px" }}>
                      {($v.split ?? []).map((s, $i0) => (
                        <Fragment key={$i0}>
                          <span className="t-row" style={{ gap: "6px" }}>
                            <span style={{ width: "10px", height: "10px", background: s?.c }} />
                            <span className="sc-interp">{s?.label}</span>
                            {" "}
                            <span className="sc-interp">{s?.v}</span>
                          </span>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div style={{ border: "1px dashed var(--brand-border)", borderRadius: "18px", padding: "20px", position: "relative", display: "flex", flexDirection: "column", gap: "0" }}>
                    <span className="t-mono-sm" style={{ position: "absolute", top: "-9px", left: "16px", padding: "0 8px", background: "var(--surface)", color: "var(--brand-text)" }}>
                      ONE TRANSACTION · ALL OR NOTHING
                    </span>
                    {" "}
                    {($v.flow ?? []).map((f, $i0) => (
                      <Fragment key={$i0}>
                        <div className={`t-flow-node ${f?.cls ?? ''}`} style={{ borderColor: f?.bd }}>
                          <div className="t-row" style={{ gap: "12px" }}>
                            <span className="t-mono-sm t-muted" style={{ width: "20px" }}>
                              <span className="sc-interp">{f?.n}</span>
                            </span>
                            <div className="t-stack">
                              <span className="t-sm" style={{ fontWeight: "500" }}>
                                <span className="sc-interp">{f?.t}</span>
                              </span>
                              <span className="t-cap">
                                <span className="sc-interp">{f?.d}</span>
                              </span>
                            </div>
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
                  <span className="t-cap">
                    If any step cannot complete — the listing expires, the warehouse is frozen, or the payoff amount changes — the whole transaction reverts and no funds move.
                  </span>
                </div>
              </section>
              <aside style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="t-card t-stack" style={{ gap: "16px" }}>
                  <span className="t-h4">
                    Your purchase
                  </span>
                  <div className="t-kv">
                    <div className="t-kv-row">
                      <span className="t-kv-k">
                        Lot price
                      </span>
                      <span className="t-kv-v">
                        <span className="sc-interp">{$v.priceFull}</span>
                      </span>
                    </div>
                    <div className="t-kv-row">
                      <span className="t-kv-k">
                        Settlement fee (0.25%, paid by seller)
                      </span>
                      <span className="t-kv-v">
                        <span className="sc-interp">{$v.fee}</span>
                      </span>
                    </div>
                    <div className="t-kv-row">
                      <span className="t-kv-k">
                        Network fee
                      </span>
                      <span className="t-kv-v">
                        ≈ 0.61 USDC
                      </span>
                    </div>
                    <div className="t-kv-row t-kv-total">
                      <span>
                        Final amount you pay
                      </span>
                      <span className="t-num">
                        <span className="sc-interp">{$v.priceFull}</span>
                        {" USDC"}
                      </span>
                    </div>
                  </div>
                  <div className="t-stack" style={{ gap: "8px" }}>
                    {($v.checks ?? []).map((c, $i0) => (
                      <Fragment key={$i0}>
                        <div className="t-row t-sm" style={{ gap: "8px" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                          <span className="t-sec">
                            <span className="sc-interp">{c}</span>
                          </span>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                  {$v.isReview ? (
                    <>
                      <button className="t-btn t-btn-primary t-btn-lg t-btn-block" onClick={$v.buy}>
                        {"Buy for "}
                        <span className="sc-interp">{$v.priceFull}</span>
                        {" USDC"}
                      </button>
                    </>
                  ) : null}
                  {" "}
                  {$v.isPending ? (
                    <>
                      <button className="t-btn t-btn-primary t-btn-lg t-btn-block" aria-disabled="true" style={{ background: "var(--primary)", color: "var(--on-primary)", opacity: ".85" }}>
                        <span className="t-spinner" />
                        {"Settling · step "}
                        <span className="sc-interp">{$v.litN}</span>
                        {" of "}
                        <span className="sc-interp">{$v.flowN}</span>
                      </button>
                      {" "}
                      <span className="t-cap" style={{ textAlign: "center" }}>
                        Transaction 0xa83f…2c10 submitted · waiting for 1 confirmation
                      </span>
                    </>
                  ) : null}
                  {" "}
                  <span className="t-cap">
                    Ownership of the lot passes to Halden Metals Ltd (0x7a3f…c91e) in the same transaction.
                  </span>
                </div>
                {$v.isDone ? (
                  <>
                    <div className="t-card t-stack" style={{ gap: "14px", borderColor: "var(--success-border)", background: "var(--success-subtle)" }}>
                      <div className="t-row">
                        <span style={{ width: "32px", height: "32px", borderRadius: "999px", background: "var(--success)", color: "var(--on-success)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                        </span>
                        <span className="t-h4">
                          {"Settled · you own "}
                          <span className="sc-interp">{$v.id}</span>
                        </span>
                      </div>
                      <div className="t-kv">
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Settled
                          </span>
                          <span className="t-kv-v">
                            2026-10-08 12:11 UTC
                          </span>
                        </div>
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Transaction
                          </span>
                          <span className="t-kv-v t-mono">
                            0xa83f…2c10
                          </span>
                        </div>
                        <div className="t-kv-row">
                          <span className="t-kv-k">
                            Lien after sale
                          </span>
                          <span className="t-kv-v">
                            FREE
                          </span>
                        </div>
                      </div>
                      <div className="t-row">
                        <a href="/lots" className="t-btn t-btn-primary" style={{ flex: "1" }}>
                          Open passport
                        </a>
                        <a href="/portfolio" className="t-btn t-btn-secondary">
                          Receipt
                        </a>
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
