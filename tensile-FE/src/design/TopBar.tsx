// @ts-nocheck
/* Generated from TopBar.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import React from 'react';
import { DCLogic } from './runtime';
import './TopBar.css';

class TopBarLogic extends DCLogic {
  renderVals() {
    const w = this.props.wallet ?? 'connected';
    const n = this.props.network ?? 'synced';
    return {
      section: this.props.section ?? 'Tensile',
      crumb: this.props.crumb ?? 'Overview',
      isConnected: w === 'connected', isDisconnected: w !== 'connected',
      isSynced: n === 'synced', isDegraded: n !== 'synced'
    };
  }
}

export default class TopBar extends TopBarLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div style={{ height: "64px", padding: "12px 24px 0", boxSizing: "border-box", fontFamily: "var(--sans)", color: "var(--text)" }}>
        <header style={{ height: "52px", display: "flex", alignItems: "center", gap: "14px", padding: "0 0 0 8px", background: "transparent", boxSizing: "border-box" }}>
          <nav aria-label="Breadcrumb" className="t-row" style={{ gap: "8px", flex: "1 1 200px", minWidth: "0" }}>
            <span className="t-sm t-muted">
              <span className="sc-interp">{$v.section}</span>
            </span>
            {" "}
            <span className="t-muted" aria-hidden="true">
              /
            </span>
            {" "}
            <span className="t-sm" style={{ fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span className="sc-interp">{$v.crumb}</span>
            </span>
          </nav>
          <label className="t-row" style={{ gap: "8px", height: "36px", width: "280px", padding: "0 8px 0 14px", borderRadius: "999px", background: "linear-gradient(180deg, rgba(215,252,253,.06), rgba(215,252,253,.02)), rgba(4,28,30,.36)", WebkitBackdropFilter: "blur(20px) saturate(140%)", backdropFilter: "blur(20px) saturate(140%)", boxShadow: "inset 0 1px 0 rgba(240,255,255,.08), 0 10px 24px -16px rgba(0,0,0,.6)", color: "var(--text-muted)", transition: "box-shadow .28s cubic-bezier(.22,1,.36,1)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4" />
            </svg>
            {" "}
            <span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>
              Search
            </span>
            {" "}
            <input placeholder="Lot ID, warehouse, address" style={{ flex: "1", minWidth: "0", background: "transparent", border: "0", color: "var(--text)", fontSize: "13px", outline: "none" }} />
            {" "}
            <span className="t-mono-sm" style={{ width: "22px", height: "22px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "rgba(215,252,253,.06)" }}>
              /
            </span>
          </label>
          {" "}
          {$v.isSynced ? (
            <>
              <span className="t-badge t-badge-word t-success" title="Chain and reserve feeds synced" style={{ height: "28px", padding: "0 12px" }}>
                <span className="t-dot" />
                Mainnet · synced 4 s ago
              </span>
            </>
          ) : null}
          {" "}
          {$v.isDegraded ? (
            <>
              <span className="t-badge t-badge-word t-warning" style={{ height: "28px", padding: "0 12px" }}>
                <span className="t-dot t-pulse" />
                1 reserve feed stale
              </span>
            </>
          ) : null}
          {" "}
          <button className="t-btn t-btn-ghost" aria-label="Notifications, 3 unread" style={{ width: "40px", padding: "0", position: "relative", color: "var(--text-secondary)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20h4" />
            </svg>
            {" "}
            <span style={{ position: "absolute", top: "9px", right: "10px", width: "7px", height: "7px", borderRadius: "999px", background: "var(--info)", boxShadow: "0 0 8px var(--info)" }} />
          </button>
          {" "}
          {$v.isConnected ? (
            <>
              <button className="t-row" style={{ gap: "10px", height: "40px", padding: "0 5px 0 14px", borderRadius: "999px", border: "0", background: "linear-gradient(180deg, rgba(215,252,253,.09), rgba(215,252,253,.03))", boxShadow: "inset 0 1px 0 rgba(240,255,255,.12), inset 0 0 0 1px rgba(215,252,253,.09)", color: "var(--text)", cursor: "pointer" }}>
                <span className="t-stack" style={{ alignItems: "flex-end" }}>
                  <span style={{ fontSize: "13px", lineHeight: "16px", fontWeight: "500" }}>
                    Halden Metals Ltd
                  </span>
                  <span className="t-mono-sm t-muted" style={{ fontWeight: "400" }}>
                    0x7a3f…c91e
                  </span>
                </span>
                {" "}
                <span className="t-avatar" style={{ width: "30px", height: "30px" }}>
                  HM
                </span>
              </button>
            </>
          ) : null}
          {" "}
          {$v.isDisconnected ? (
            <>
              <button className="t-btn t-btn-primary">
                Connect wallet
              </button>
            </>
          ) : null}
        </header>
      </div>
    );
  }
}
