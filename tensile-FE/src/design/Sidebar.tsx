// @ts-nocheck
/* Generated from Sidebar.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic } from './runtime';
import './Sidebar.css';

class SidebarLogic extends DCLogic {
  renderVals() {
    const active = this.props.active ?? 'overview';
    const role = this.props.role ?? 'owner';
    const labels = { owner: ['Material owner', 'OWNER'], lender: ['Lender', 'LENDER'], buyer: ['Buyer / trader', 'BUYER'], inspector: ['Inspector', 'INSPECTOR'], ops: ['Operations / risk', 'OPS'] };
    const I = {
      overview: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
      portfolio: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
      lots: 'M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4',
      tokenize: 'M6 3h9l4 4v14H6zM14 3v5h5M12 11v6M9 14h6',
      borrow: 'M12 4v16M8 20h8M4 8h16M6 8l-3 6h6zM18 8l-3 6h6z',
      lend: 'M3 5h18v14H3zM12 9a3 3 0 100 6 3 3 0 100-6zM12 9V7M12 17v-2',
      marketplace: 'M4 8h15l-3-3M20 16H5l3 3',
      redemptions: 'M2 7h11v9H2zM13 10h5l3 3v3h-8M6 19a2 2 0 100-4 2 2 0 100 4zM17 19a2 2 0 100-4 2 2 0 100 4z',
      reserve: 'M3 10l9-6 9 6v10H3zM7 20v-7h10v7M7 16h10',
      risk: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 8v5M12 16v.5',
      disputes: 'M5 21V4M5 4h11l-2 4 2 4H5',
      inspections: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 12h8',
      console: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4'
    };
    const mk = (key, label, href, extra) => ({ key, label, href, d: I[key], current: active === key ? 'page' : 'false', cls: active === key ? 'sb-on' : '', ...extra });
    const items = [
      mk('overview', 'Overview', '/overview'),
      mk('portfolio', 'Portfolio', '/portfolio'),
      mk('lots', 'Lots', '/lots', { count: '3' }),
      mk('tokenize', 'Tokenize', '/tokenize'),
      mk('borrow', 'Borrow', '/borrow'),
      mk('lend', 'Lend', '/lend'),
      mk('marketplace', 'Marketplace', '/marketplace'),
      mk('redemptions', 'Redemptions', '/redemptions', { count: '1' })
    ];
    const staff = role === 'ops' || role === 'inspector';
    const opsList = [
      mk('reserve', 'Reserve health', '/reserve', { badge: '1 BREACH', badgeTone: 't-solid-danger', allow: ['ops'] }),
      mk('risk', 'Risk and liquidation', '/risk', { allow: ['ops'] }),
      mk('disputes', 'Disputes', '/disputes', { badge: '1', badgeTone: 't-danger', allow: ['ops'] }),
      mk('inspections', 'Inspections', '/inspections', { badge: '4', badgeTone: 't-info', allow: ['ops', 'inspector'] }),
      mk('console', 'Console', '/console', { allow: ['ops'] })
    ].map((o) => {
      const ok = o.allow.includes(role);
      return { ...o, locked: !ok, cls: ok ? o.cls : 'sb-locked', badge: ok ? o.badge : false, href: ok ? o.href : '/states' };
    });
    return { items, ops: opsList, roleLabel: labels[role][0], roleTag: labels[role][1], restricted: !staff };
  }
}

export default class Sidebar extends SidebarLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div style={{ width: "248px", minHeight: "1100px", height: "100%", padding: "14px 0 14px 14px", boxSizing: "border-box", display: "flex", fontFamily: "var(--sans)", color: "var(--text)" }}>
        <nav aria-label="Primary" style={{ flex: "1", display: "flex", flexDirection: "column", gap: "32px", padding: "22px 12px 16px", borderRadius: "28px", background: "radial-gradient(140% 50% at 0% 0%, rgba(110,225,225,.07), transparent 60%), linear-gradient(175deg, rgba(215,252,253,.05) 0%, rgba(215,252,253,.015) 40%, rgba(215,252,253,.008) 100%), rgba(4,28,30,.36)", WebkitBackdropFilter: "blur(26px) saturate(150%)", backdropFilter: "blur(26px) saturate(150%)", boxShadow: "inset 0 1px 0 rgba(240,255,255,.09), inset 1px 0 0 rgba(240,255,255,.03), 0 30px 60px -30px rgba(0,0,0,.55)", boxSizing: "border-box" }}>
          <a href="/overview" className="t-row" style={{ gap: "12px", padding: "4px 10px", height: "40px", color: "var(--brand-ice)" }}>
            <img src="/design-assets/f7ab157752a5014c52926e68ee69f6c6.png" alt="" style={{ width: "26px", height: "25px", filter: "drop-shadow(0 0 10px rgba(215,252,253,.35))" }} />
            {" "}
            <span className="t-wordmark" style={{ fontSize: "14px" }}>
              TENSILE
            </span>
          </a>
          <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
            <span className="t-eyebrow" style={{ fontSize: "10px" }}>
              Viewing as
            </span>
            <div className="t-between">
              <span className="t-sm" style={{ fontWeight: "500" }}>
                <span className="sc-interp">{$v.roleLabel}</span>
              </span>
              <span className="t-badge t-neutral" style={{ height: "18px", padding: "0 7px", fontSize: "10px" }}>
                <span className="sc-interp">{$v.roleTag}</span>
              </span>
            </div>
          </div>
          <div className="sb-group">
            <span className="sb-grouplabel">
              Workspace
            </span>
            {" "}
            {($v.items ?? []).map((it, $i0) => (
              <Fragment key={$i0}>
                <a href={it?.href} className={`sb-item ${it?.cls ?? ''}`} aria-current={it?.current}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={it?.d} />
                  </svg>
                  {" "}
                  <span style={{ flex: "1" }}>
                    <span className="sc-interp">{it?.label}</span>
                  </span>
                  {" "}
                  {it?.count ? (
                    <>
                      <span className="t-mono-sm t-muted">
                        <span className="sc-interp">{it?.count}</span>
                      </span>
                    </>
                  ) : null}
                </a>
              </Fragment>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="t-between" style={{ padding: "0 10px" }}>
              <span className="t-row" style={{ gap: "8px" }}>
                <span style={{ width: "14px", height: "4px", borderRadius: "999px", background: "repeating-linear-gradient(135deg, rgba(240,184,96,.9) 0 3px, transparent 3px 6px)" }} />
                <span className="t-eyebrow" style={{ fontSize: "10px" }}>
                  Operations
                </span>
              </span>
              <span className="t-mono-sm t-muted" style={{ fontSize: "10px" }}>
                STAFF
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {($v.ops ?? []).map((it, $i0) => (
                <Fragment key={$i0}>
                  <a href={it?.href} className={`sb-item ${it?.cls ?? ''}`} aria-current={it?.current} aria-disabled={it?.locked}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={it?.d} />
                    </svg>
                    {" "}
                    <span style={{ flex: "1" }}>
                      <span className="sc-interp">{it?.label}</span>
                    </span>
                    {" "}
                    {it?.badge ? (
                      <>
                        <span className={`t-badge ${it?.badgeTone ?? ''}`} style={{ height: "18px", padding: "0 7px", fontSize: "10px" }}>
                          <span className="sc-interp">{it?.badge}</span>
                        </span>
                      </>
                    ) : null}
                    {" "}
                    {it?.locked ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Restricted">
                          <path d="M6 11h12v9H6zM9 11V8a3 3 0 016 0v3" />
                        </svg>
                      </>
                    ) : null}
                  </a>
                </Fragment>
              ))}
            </div>
            {$v.restricted ? (
              <>
                <p className="t-cap" style={{ padding: "0 10px" }}>
                  {"Operations tools need a staff role. Your role: "}
                  <span className="sc-interp">{$v.roleLabel}</span>
                  .
                </p>
              </>
            ) : null}
          </div>
          <div style={{ flex: "1" }} />
          <a href="/onboarding" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px", borderRadius: "18px", color: "var(--text)", background: "rgba(215,252,253,.035)", boxShadow: "inset 0 1px 0 rgba(240,255,255,.06)" }}>
            <div className="t-row" style={{ gap: "10px" }}>
              <span className="t-avatar">
                HM
              </span>
              <div className="t-stack" style={{ minWidth: "0" }}>
                <span className="t-sm" style={{ fontWeight: "500" }}>
                  Halden Metals Ltd
                </span>
                <span className="t-mono-sm t-muted" style={{ fontWeight: "400" }}>
                  0x7a3f…c91e
                </span>
              </div>
            </div>
            <div className="t-between">
              <span className="t-badge t-badge-word t-success">
                <span className="t-dot" />
                Tier 2 verified
              </span>
              <span className="t-cap">
                to 2027-09-30
              </span>
            </div>
          </a>
        </nav>
      </div>
    );
  }
}
