// @ts-nocheck
/* Generated from States.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic } from './runtime';
import './States.css';

class StatesLogic extends DCLogic {
  renderVals() {
    const W = 'var(--warning-text)';
    const reasons = [
      ['Borrow', 'Borrow unavailable: warehouse reserve data is stale.', 'Resumes when Portline Warehousing posts a fresh attestation (limit 24 h).'],
      ['Borrow', 'Borrow unavailable: this lot exceeds the configured LTV limit.', 'Lower the amount to 195,000.00 USDC or less.'],
      ['Transfer', 'Transfer unavailable: this lot is currently pledged.', 'Repay LN-2291, or sell through the marketplace to settle the loan atomically.'],
      ['Raise dispute', 'Redemption dispute unavailable: SLA has not expired.', 'Available after 2026-10-06 10:00 UTC.'],
      ['Buy', 'Purchase unavailable: listing has expired.', 'Ask the seller to relist, or place an RFQ bid.'],
      ['Mint', 'Mint unavailable: warehouse reserve does not cover the additional material.', 'Reserve 460,000 kg; outstanding plus this lot would be 475,000 kg.'],
      ['Buy', 'Purchase unavailable: the warehouse is frozen after a reserve breach.', 'Transfers resume after reconciliation and unfreeze.'],
      ['Redeem', 'Redemption unavailable: this lot is pledged.', 'Repay the loan first; then the lot is FREE to redeem.'],
      ['Bid', 'Bid unavailable: your verification expired on 2026-09-30.', 'Renew verification to bid, borrow or list.'],
      ['Withdraw', 'Withdrawal limited: vault cash is 12,062,500.00 USDC.', 'The rest becomes withdrawable as borrowers repay.']
    ].map(([btn, t, fix]) => ({ btn, t, fix, fg: W }));
    const tx = [
      { t: 'Confirm in your wallet', d: 'Borrow 140,000.00 USDC against TNS-CU-00418', m: 'WAITING FOR SIGNATURE', c: 'var(--info)', bd: 'var(--info-border)', spin: true, dot: false },
      { t: 'Submitted', d: 'Waiting for 1 confirmation', m: '0x5c2e…a417 · 4 s', c: 'var(--info)', bd: 'var(--info-border)', spin: true, dot: false },
      { t: 'Confirmed', d: '139,300.00 USDC received. Lot pledged under LN-2291.', m: 'BLOCK 18,442,107', c: 'var(--success)', bd: 'var(--success-border)', spin: false, dot: true },
      { t: 'Reverted: reserve feed went stale', d: 'The attestation passed 24 h before your transaction landed. No funds moved.', m: '0x1f2a…66c3', c: 'var(--warning)', bd: 'var(--warning-border)', spin: false, dot: true },
      { t: 'Rejected in wallet', d: 'You declined the signature. Nothing was submitted.', m: 'NO TRANSACTION', c: 'var(--neutral)', bd: 'var(--border)', spin: false, dot: true }
    ];
    const expired = [
      { t: 'Listing TNS-CU-00398', d: 'Ended 2026-10-07 18:00 UTC' },
      { t: 'Bid Q-5461', d: 'Escrow of 228,000.00 USDC returned' },
      { t: 'Payoff quote LN-2310', d: 'Valid 10 minutes; request a new quote' },
      { t: 'Mint request MR-1102', d: 'No inspection within 30 days' }
    ];
    return { reasons, tx, expired, skel: ['38%', '30%', '44%', '34%'] };
  }
}

export default class States extends StatesLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-atmos" style={{ color: "var(--text)", fontFamily: "var(--sans)", minHeight: "100%" }}>
        <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "48px 32px 80px", display: "flex", flexDirection: "column", gap: "48px" }}>
          <div className="t-stack" style={{ gap: "8px" }}>
            <span className="t-eyebrow">
              System
            </span>
            <h1 className="t-h1">
              Global UX states
            </h1>
            <p className="t-lead">
              One pattern per state, used on every screen. When the protocol blocks an action, the reason is named in plain language — never a generic failure.
            </p>
          </div>
          <section className="t-stack" style={{ gap: "16px" }}>
            <span className="t-h3">
              Protocol reasons
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
              {($v.reasons ?? []).map((r, $i0) => (
                <Fragment key={$i0}>
                  <div className="t-card t-card-dense" style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <button className="t-btn t-btn-sm" disabled style={{ flex: "none", width: "112px" }}>
                      <span className="sc-interp">{r?.btn}</span>
                    </button>
                    <div className="t-stack" style={{ gap: "2px" }}>
                      <span className="t-sm" style={{ fontWeight: "500", color: r?.fg }}>
                        <span className="sc-interp">{r?.t}</span>
                      </span>
                      <span className="t-cap">
                        <span className="sc-interp">{r?.fix}</span>
                      </span>
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
          </section>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "24px" }}>
            <div className="t-stack" style={{ gap: "12px" }}>
              <span className="t-h4">
                Wallet and account
              </span>
              <div className="t-card t-stack" style={{ gap: "12px", alignItems: "flex-start" }}>
                <span className="t-badge t-badge-word t-neutral">
                  <span className="t-dot" />
                  Not connected
                </span>
                <span className="t-sm t-sec">
                  Connect a wallet to see your lots, loans and vault position. You can browse the marketplace without one.
                </span>
                <button className="t-btn t-btn-primary">
                  Connect wallet
                </button>
              </div>
              <div className="t-card t-stack" style={{ gap: "12px", alignItems: "flex-start" }}>
                <span className="t-badge t-badge-word t-info">
                  <span className="t-spinner" style={{ width: "10px", height: "10px", borderWidth: "1.5px" }} />
                  Connecting
                </span>
                <span className="t-sm t-sec">
                  Approve the connection request in your wallet.
                </span>
              </div>
              <div className="t-card t-stack" style={{ gap: "12px", alignItems: "flex-start" }}>
                <span className="t-badge t-badge-word t-warning">
                  <span className="t-dot" />
                  Wrong network
                </span>
                <span className="t-sm t-sec">
                  Your wallet is on another network. Tensile lots and the credit vault live on mainnet.
                </span>
                <button className="t-btn t-btn-secondary">
                  Switch network
                </button>
              </div>
              <div className="t-card t-stack" style={{ gap: "12px", alignItems: "flex-start" }}>
                <span className="t-badge t-badge-word t-warning">
                  <span className="t-dot" />
                  Address not verified
                </span>
                <span className="t-sm t-sec">
                  0x51c2…a0f7 is not linked to a verified identity. Holding, borrowing and trading need verification.
                </span>
                <a href="/onboarding" className="t-btn t-btn-primary">
                  Verify identity
                </a>
              </div>
            </div>
            <div className="t-stack" style={{ gap: "12px" }}>
              <span className="t-h4">
                Loading
              </span>
              <div className="t-card t-stack" style={{ gap: "12px" }}>
                <span className="t-label">
                  First load
                </span>
                <div className="t-skel" style={{ height: "28px", width: "60%" }} />
                <div className="t-skel" style={{ height: "12px", width: "40%" }} />
              </div>
              <div className="t-card t-card-flush">
                <div style={{ padding: "12px 16px", background: "var(--bg-sunken)", borderBottom: "1px solid var(--border)" }}>
                  <div className="t-skel" style={{ height: "10px", width: "50%" }} />
                </div>
                {($v.skel ?? []).map((s, $i0) => (
                  <Fragment key={$i0}>
                    <div className="t-row" style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", gap: "16px" }}>
                      <div className="t-skel" style={{ height: "12px", width: "26%" }} />
                      <div className="t-skel" style={{ height: "12px", width: s }} />
                      <div className="t-skel" style={{ height: "12px", width: "14%", marginLeft: "auto" }} />
                    </div>
                  </Fragment>
                ))}
              </div>
              <div className="t-card t-stack" style={{ gap: "8px" }}>
                <div className="t-between">
                  <span className="t-label">
                    Refreshing
                  </span>
                  <span className="t-row t-cap" style={{ gap: "6px" }}>
                    <span className="t-spinner" style={{ width: "10px", height: "10px", borderWidth: "1.5px" }} />
                    Updating prices
                  </span>
                </div>
                <span className="t-num-lg">
                  $300,000
                  <span className="t-f">
                    .00
                  </span>
                </span>
                <span className="t-cap">
                  Last value stays visible while refreshing
                </span>
              </div>
            </div>
            <div className="t-stack" style={{ gap: "12px" }}>
              <span className="t-h4">
                Empty
              </span>
              <div className="t-card t-stack" style={{ gap: "10px", alignItems: "center", textAlign: "center", padding: "32px 24px" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4" />
                </svg>
                {" "}
                <span className="t-h4">
                  No lots yet
                </span>
                <span className="t-sm t-sec">
                  Tokenize metal you hold in an approved warehouse, or buy a verified lot.
                </span>
                <div className="t-row">
                  <a href="/tokenize" className="t-btn t-btn-primary t-btn-sm">
                    Tokenize material
                  </a>
                  <a href="/marketplace" className="t-btn t-btn-secondary t-btn-sm">
                    Browse lots
                  </a>
                </div>
              </div>
              <div className="t-card t-stack" style={{ gap: "10px", alignItems: "center", textAlign: "center", padding: "32px 24px" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4v16M8 20h8M4 8h16M6 8l-3 6h6zM18 8l-3 6h6z" />
                </svg>
                {" "}
                <span className="t-h4">
                  No active loans
                </span>
                <span className="t-sm t-sec">
                  You can borrow up to 128,700.00 USDC against TNS-NI-00091.
                </span>
                {" "}
                <a href="/borrow" className="t-btn t-btn-secondary t-btn-sm">
                  Borrow against a lot
                </a>
              </div>
              <div className="t-card t-stack" style={{ gap: "10px", alignItems: "center", textAlign: "center", padding: "24px" }}>
                <span className="t-h4">
                  No bids on your listing
                </span>
                <span className="t-sm t-sec">
                  Listed 2 days ago. Bids from verified buyers appear here with escrow already funded.
                </span>
              </div>
            </div>
          </section>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "24px" }}>
            <div className="t-stack" style={{ gap: "12px" }}>
              <span className="t-h4">
                Transaction lifecycle
              </span>
              {" "}
              {($v.tx ?? []).map((t, $i0) => (
                <Fragment key={$i0}>
                  <div className="t-raised" style={{ padding: "14px 16px", display: "flex", gap: "12px", alignItems: "flex-start", borderRadius: "18px", boxShadow: "none", borderColor: t?.bd }}>
                    <span style={{ flex: "none", marginTop: "3px", color: t?.c }}>
                      {t?.spin ? (
                        <>
                          <span className="t-spinner" style={{ display: "block", width: "14px", height: "14px" }} />
                        </>
                      ) : null}
                      {t?.dot ? (
                        <>
                          <span className="t-dot" style={{ display: "block", width: "8px", height: "8px" }} />
                        </>
                      ) : null}
                    </span>
                    <div className="t-stack" style={{ gap: "2px", flex: "1" }}>
                      <span className="t-sm" style={{ fontWeight: "600" }}>
                        <span className="sc-interp">{t?.t}</span>
                      </span>
                      <span className="t-cap" style={{ color: "var(--text-secondary)" }}>
                        <span className="sc-interp">{t?.d}</span>
                      </span>
                      <span className="t-mono-sm t-muted" style={{ fontWeight: "400" }}>
                        <span className="sc-interp">{t?.m}</span>
                      </span>
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
            <div className="t-stack" style={{ gap: "12px" }}>
              <span className="t-h4">
                Success confirmation
              </span>
              <div className="t-card t-stack" style={{ gap: "16px", borderColor: "var(--success-border)" }}>
                <div className="t-row">
                  <span style={{ width: "32px", height: "32px", borderRadius: "999px", background: "var(--success)", color: "var(--on-success)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  </span>
                  <div className="t-stack">
                    <span className="t-h4">
                      Repaid 25,000.00 USDC
                    </span>
                    <span className="t-cap">
                      LN-2291 · 2026-10-08 12:40 UTC
                    </span>
                  </div>
                </div>
                <div className="t-kv">
                  <div className="t-kv-row">
                    <span className="t-kv-k">
                      Debt before
                    </span>
                    <span className="t-kv-v">
                      140,630.14
                    </span>
                  </div>
                  <div className="t-kv-row">
                    <span className="t-kv-k">
                      Debt after
                    </span>
                    <span className="t-kv-v">
                      115,630.14
                    </span>
                  </div>
                  <div className="t-kv-row">
                    <span className="t-kv-k">
                      LTV
                    </span>
                    <span className="t-kv-v">
                      46.88% → 38.54%
                    </span>
                  </div>
                  <div className="t-kv-row">
                    <span className="t-kv-k">
                      Transaction
                    </span>
                    <span className="t-kv-v t-mono">
                      0x8b7d…41fe
                    </span>
                  </div>
                </div>
                <div className="t-row">
                  <button className="t-btn t-btn-primary t-btn-sm">
                    Done
                  </button>
                  <button className="t-btn t-btn-ghost t-btn-sm">
                    Download receipt
                  </button>
                </div>
              </div>
              <span className="t-h4" style={{ paddingTop: "12px" }}>
                Service error
              </span>
              <div className="t-alert t-danger">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
                  <path d="M12 3l9 16H3zM12 10v4M12 17v.5" />
                </svg>
                <div style={{ flex: "1" }}>
                  <p className="t-alert-title">
                    Price feed unreachable
                  </p>
                  <p className="t-alert-body">
                    Values are from 11:00 UTC. Nothing was submitted and your funds have not moved.
                  </p>
                </div>
                <button className="t-btn t-btn-sm t-btn-secondary">
                  Retry
                </button>
              </div>
            </div>
            <div className="t-stack" style={{ gap: "12px" }}>
              <span className="t-h4">
                Role restriction
              </span>
              <div className="t-card t-stack" style={{ gap: "12px", alignItems: "flex-start" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 11h12v9H6zM9 11V8a3 3 0 016 0v3" />
                </svg>
                {" "}
                <span className="t-h4">
                  Operations console needs an operations role
                </span>
                {" "}
                <span className="t-sm t-sec">
                  You are signed in as Material owner. Freezing warehouses, resolving disputes and changing risk parameters are limited to Tensile operations staff.
                </span>
                {" "}
                <a href="/overview" className="t-btn t-btn-secondary t-btn-sm">
                  Back to overview
                </a>
              </div>
              <span className="t-h4" style={{ paddingTop: "12px" }}>
                Expired
              </span>
              {" "}
              {($v.expired ?? []).map((e, $i0) => (
                <Fragment key={$i0}>
                  <div className="t-well t-between" style={{ padding: "10px 14px" }}>
                    <div className="t-stack">
                      <span className="t-sm" style={{ fontWeight: "500" }}>
                        <span className="sc-interp">{e?.t}</span>
                      </span>
                      <span className="t-cap">
                        <span className="sc-interp">{e?.d}</span>
                      </span>
                    </div>
                    <span className="t-badge t-neutral">
                      EXPIRED
                    </span>
                  </div>
                </Fragment>
              ))}
            </div>
          </section>
          <section className="t-stack" style={{ gap: "16px" }}>
            <span className="t-h3">
              Button states
            </span>
            <div className="t-card" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "16px", alignItems: "center" }}>
              <div className="t-stack" style={{ gap: "6px" }}>
                <span className="t-cap">
                  Default
                </span>
                <button className="t-btn t-btn-primary">
                  Borrow 140,000.00 USDC
                </button>
              </div>
              <div className="t-stack" style={{ gap: "6px" }}>
                <span className="t-cap">
                  Hover
                </span>
                <button className="t-btn t-btn-primary" style={{ background: "var(--primary-hover)" }}>
                  Borrow 140,000.00 USDC
                </button>
              </div>
              <div className="t-stack" style={{ gap: "6px" }}>
                <span className="t-cap">
                  Focus
                </span>
                <button className="t-btn t-btn-primary" style={{ outline: "2px solid var(--focus-ring)", outlineOffset: "2px" }}>
                  Borrow 140,000.00 USDC
                </button>
              </div>
              <div className="t-stack" style={{ gap: "6px" }}>
                <span className="t-cap">
                  Signing
                </span>
                <button className="t-btn t-btn-primary" aria-disabled="true" style={{ background: "var(--primary)", color: "var(--on-primary)", opacity: ".85" }}>
                  <span className="t-spinner" />
                  Confirm in wallet…
                </button>
              </div>
              <div className="t-stack" style={{ gap: "6px" }}>
                <span className="t-cap">
                  Disabled with reason
                </span>
                <button className="t-btn" disabled>
                  Borrow unavailable
                </button>
              </div>
              <div className="t-stack" style={{ gap: "6px" }}>
                <span className="t-cap">
                  Destructive
                </span>
                <button className="t-btn t-btn-danger">
                  Freeze warehouse
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }
}
