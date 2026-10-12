// @ts-nocheck
/* Generated from Marketplace.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic } from './runtime';
import Orb from './Orb';
import Sidebar from '../shell/Sidebar';
import TopBar from '../shell/TopBar';
import './Marketplace.css';

class MarketplaceLogic extends DCLogic {
  state = { view: 'cards', mat: 'all', sel: 'TNS-CU-00427' };
  renderVals() {
    const ok = (t) => ({ t, tone: 't-success' });
    const P = (a) => a.map((x) => typeof x === 'string' ? ok(x) : x);
    const all = [
      { sym: 'AL', id: 'TNS-AL-00233', mat: 'Aluminium ingot P1020', k: 'al', wh: 'Antwerp Deurganck 03', whc: 'ANR-DEL-03', region: 'Europe', qty: '100.000 t', price: '$260,000', ppt: '$2,600.00', insp: '2026-09-30', res: '118.20%', seller: 'Varga Resources AG', exp: 'Expires 2026-10-15', expShort: '10-15', st: 'LISTED', stTone: 't-brand', lien: 'FREE', lienD: 'No debt', lienShort: 'FREE', lienTone: 't-success', prov: P(['Certificate', 'Review 93', 'Inspected', 'Custody']), v: 'Verified', vTone: 't-success', state: 'ok' },
      { sym: 'CU', id: 'TNS-CU-00427', mat: 'Copper cathode, Grade A', k: 'cu', wh: 'Rotterdam Botlek 04', whc: 'RTM-BOT-04', region: 'Europe', qty: '25.000 t', price: '$246,250', ppt: '$9,850.00', insp: '2026-10-02', res: '111.11%', seller: 'Northgate Refining Co.', exp: 'Expires 2026-10-12', expShort: '10-12', st: 'LISTED', stTone: 't-brand', lien: 'PLEDGED · LN-2310', lienD: '120,412.50 USDC paid off at settlement', lienShort: 'PLEDGED', lienTone: 't-info', prov: P(['Certificate', 'Review 95', 'Inspected', 'Custody']), v: 'Verified', vTone: 't-success', state: 'ok', pledged: true },
      { sym: 'NI', id: 'TNS-NI-00104', mat: 'Nickel briquette', k: 'ni', wh: 'Singapore Jurong 01', whc: 'SIN-JUR-01', region: 'Asia', qty: '10.000 t', price: '$165,000', ppt: '$16,500.00', insp: '2026-09-21', res: '124.30%', seller: 'Straits Alloy Pte. Ltd.', exp: 'Expires 2026-10-20', expShort: '10-20', st: 'LISTED', stTone: 't-brand', lien: 'FREE', lienD: 'No debt', lienShort: 'FREE', lienTone: 't-success', prov: P(['Certificate', 'Review 91', 'Inspected', 'Custody']), v: 'Verified', vTone: 't-success', state: 'ok' },
      { sym: 'ZN', id: 'TNS-ZN-00057', mat: 'Zinc SHG', k: 'zn', wh: 'Houston Ship Channel 05', whc: 'HOU-SHP-05', region: 'Americas', qty: '50.000 t', price: '$145,000', ppt: '$2,900.00', insp: '2026-09-15', res: '109.75%', seller: 'Gulf Metals Trading LLC', exp: 'Expires in 21 h', expShort: 'in 21 h', expFg: 't-fg-warning', st: 'LISTED', stTone: 't-brand', lien: 'FREE', lienD: 'No debt', lienShort: 'FREE', lienTone: 't-success', prov: P(['Certificate', 'Review 89', 'Inspected', 'Custody']), v: 'Verified', vTone: 't-success', state: 'ok' },
      { sym: 'CU', id: 'TNS-CU-00422', mat: 'Copper cathode, Grade A', k: 'cu', wh: 'Rotterdam Botlek 04', whc: 'RTM-BOT-04', region: 'Europe', qty: '20.000 t', price: '$200,000', ppt: '$10,000.00', insp: '2026-10-07', res: '111.11%', seller: 'You', exp: 'Expires 2026-10-12', expShort: '10-12', st: 'YOUR LISTING', stTone: 't-neutral', lien: 'PLEDGED · LN-2302', lienD: '90,554.12 USDC paid off at settlement', lienShort: 'PLEDGED', lienTone: 't-info', prov: P(['Certificate', 'Review 94', 'Inspected', 'Custody']), v: 'Verified', vTone: 't-success', state: 'own', pledged: true },
      { sym: 'AL', id: 'TNS-AL-00240', mat: 'Aluminium ingot P1020', k: 'al', wh: 'Port Klang West 02', whc: 'PKL-WST-02', region: 'Asia', qty: '60.000 t', price: '$153,000', ppt: '$2,550.00', insp: '2026-08-28', res: '83.33%', resFg: 't-fg-danger', seller: 'Malacca Base Metals Sdn Bhd', exp: 'Expires 2026-10-18', expShort: '10-18', st: 'FROZEN', stTone: 't-solid-danger', lien: 'FREE', lienD: 'No debt', lienShort: 'FREE', lienTone: 't-success', prov: P(['Certificate', 'Review 90', 'Inspected', { t: 'Reserve breach', tone: 't-danger' }]), v: 'Breach', vTone: 't-danger', state: 'blocked', why: 'Purchase unavailable: Port Klang West 02 is frozen after a reserve breach. Transfers resume when operations reconcile the reserve.' },
      { sym: 'CU', id: 'TNS-CU-00398', mat: 'Copper cathode, Grade A', k: 'cu', wh: 'Durban Bayhead 01', whc: 'DUR-BAY-01', region: 'Africa', qty: '15.000 t', price: '$148,500', ppt: '$9,900.00', insp: '2026-09-02', res: '104.00%', seller: 'Cape Refiners (Pty) Ltd', exp: 'Expired 2026-10-07', expShort: 'Expired', expFg: 't-fg-danger', st: 'EXPIRED', stTone: 't-neutral', lien: 'FREE', lienD: 'No debt', lienShort: 'FREE', lienTone: 't-success', prov: P(['Certificate', 'Review 92', 'Inspected', { t: 'Stale feed', tone: 't-warning' }]), v: 'Stale feed', vTone: 't-warning', state: 'blocked', why: 'Purchase unavailable: listing has expired. The seller can relist it, or you can place an RFQ bid.' }
    ];
    const m = this.state.mat;
    const lots = all.filter((l) => m === 'all' || l.k === m).map((l) => ({ ...l, on: this.state.sel === l.id ? 'true' : 'false', locC: this.state.sel === l.id ? 'var(--brand)' : 'var(--text-muted)', locate: () => this.setState({ sel: l.id }), ok: l.state === 'ok', own: l.state === 'own', blocked: l.state === 'blocked', op: l.state === 'blocked' ? '0.78' : '1', lienBd: l.pledged ? 'var(--info-border)' : 'var(--border)', resFg: l.resFg || '', expFg: l.expFg || '' }));
    const counts = { all: 7, cu: 3, al: 2, ni: 1, zn: 1 };
    const mats = [['all', 'All'], ['cu', 'Copper'], ['al', 'Aluminium'], ['ni', 'Nickel'], ['zn', 'Zinc']].map(([k, label]) => ({ label, n: k === 'zn' && false ? 0 : counts[k], on: m === k ? 'true' : 'false', pick: () => this.setState({ mat: k }) }));
    const cards = this.state.view === 'cards';
    const S = all.find((l) => l.id === this.state.sel) || all[0];
    return { selWh: S.whc, selId: S.id, selL1: S.mat + ' · ' + S.qty, selL2: S.price + ' · ' + S.ppt + ' / t', mapTitle: S.wh, pickWh: (code) => { const hit = all.find((l) => l.whc === code); if (hit) this.setState({ sel: hit.id }); }, lots, mats, count: lots.length, isEmpty: lots.length === 0, isCards: cards && lots.length > 0, isTable: !cards && lots.length > 0, cardsOn: cards ? 'true' : 'false', tableOn: cards ? 'false' : 'true', toCards: () => this.setState({ view: 'cards' }), toTable: () => this.setState({ view: 'table' }), clear: () => this.setState({ mat: 'all' }) };
  }
}

export default class Marketplace extends MarketplaceLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-app">
        <div style={{ flex: "0 0 248px", display: "flex", background: "var(--bg-sunken)" }}>
          <Sidebar active="marketplace" role="buyer" />
        </div>
        <div className="t-main">
          <TopBar section="Marketplace" crumb="Listed lots" />
          <main className="t-content">
            <div className="t-between t-wrap" style={{ alignItems: "flex-end" }}>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-eyebrow">
                  Marketplace · F-3
                </span>
                <h1 className="t-h1">
                  Verified material for sale
                </h1>
                <span className="t-sm t-sec">
                  Every listing is a passported lot in bonded custody. Settlement is atomic: payment, any loan payoff and ownership move in one transaction.
                </span>
              </div>
              <div className="t-row">
                <a href="/marketplace/rfq" className="t-btn t-btn-secondary">
                  My bids · 2 open
                </a>
                <div className="t-seg" role="group" aria-label="Layout">
                  <button aria-pressed={$v.cardsOn} onClick={$v.toCards}>
                    Cards
                  </button>
                  <button aria-pressed={$v.tableOn} onClick={$v.toTable}>
                    Table
                  </button>
                </div>
              </div>
            </div>
            <section className="t-card t-card-dense" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="t-row t-wrap" style={{ gap: "8px" }}>
                <span className="t-label" style={{ width: "72px" }}>
                  Material
                </span>
                {" "}
                {($v.mats ?? []).map((m, $i0) => (
                  <Fragment key={$i0}>
                    <button className="t-chip" aria-pressed={m?.on} onClick={m?.pick}>
                      <span className="sc-interp">{m?.label}</span>
                      {" "}
                      <span className="t-mono-sm t-muted">
                        <span className="sc-interp">{m?.n}</span>
                      </span>
                    </button>
                  </Fragment>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "10px" }}>
                <label className="t-field" style={{ gap: "4px" }}>
                  <span className="t-cap">
                    Region
                  </span>
                  <select className="t-input t-select" style={{ height: "36px", fontSize: "13px" }}>
                    <option>
                      All regions
                    </option>
                    <option>
                      Europe
                    </option>
                    <option>
                      Asia
                    </option>
                    <option>
                      Americas
                    </option>
                    <option>
                      Africa
                    </option>
                  </select>
                </label>
                {" "}
                <label className="t-field" style={{ gap: "4px" }}>
                  <span className="t-cap">
                    Warehouse
                  </span>
                  <select className="t-input t-select" style={{ height: "36px", fontSize: "13px" }}>
                    <option>
                      All warehouses
                    </option>
                    <option>
                      RTM-BOT-04
                    </option>
                    <option>
                      ANR-DEL-03
                    </option>
                  </select>
                </label>
                {" "}
                <label className="t-field" style={{ gap: "4px" }}>
                  <span className="t-cap">
                    Quantity (t)
                  </span>
                  <input className="t-input" style={{ height: "36px", fontSize: "13px" }} defaultValue="5 – 100" />
                </label>
                {" "}
                <label className="t-field" style={{ gap: "4px" }}>
                  <span className="t-cap">
                    Price (USD)
                  </span>
                  <input className="t-input" style={{ height: "36px", fontSize: "13px" }} defaultValue="Any" />
                </label>
                {" "}
                <label className="t-field" style={{ gap: "4px" }}>
                  <span className="t-cap">
                    Status
                  </span>
                  <select className="t-input t-select" style={{ height: "36px", fontSize: "13px" }}>
                    <option>
                      Purchasable
                    </option>
                    <option>
                      All, incl. expired
                    </option>
                  </select>
                </label>
                {" "}
                <label className="t-field" style={{ gap: "4px" }}>
                  <span className="t-cap">
                    Verification
                  </span>
                  <select className="t-input t-select" style={{ height: "36px", fontSize: "13px" }}>
                    <option>
                      Inspected ≤ 30 d
                    </option>
                    <option>
                      Any
                    </option>
                  </select>
                </label>
                {" "}
                <label className="t-field" style={{ gap: "4px" }}>
                  <span className="t-cap">
                    Debt
                  </span>
                  <select className="t-input t-select" style={{ height: "36px", fontSize: "13px" }}>
                    <option>
                      Free and pledged
                    </option>
                    <option>
                      Free only
                    </option>
                    <option>
                      Pledged only
                    </option>
                  </select>
                </label>
              </div>
              <div className="t-between">
                <span className="t-cap">
                  <span className="sc-interp">{$v.count}</span>
                  {" listings · sorted by newest"}
                </span>
                <button className="t-btn t-btn-ghost t-btn-sm" onClick={$v.clear}>
                  Clear filters
                </button>
              </div>
            </section>
            <section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "32px", padding: "4px 8px" }}>
              <div className="t-stack" style={{ gap: "10px", flex: "1 1 260px", maxWidth: "380px" }}>
                <span className="t-eyebrow">
                  Where the metal is
                </span>
                {" "}
                <span className="t-h2">
                  <span className="sc-interp">{$v.mapTitle}</span>
                </span>
                {" "}
                <span className="t-sm t-sec">
                  Each point is a warehouse holding listed lots. Select a listing’s pin, or a point on the globe, to bring it into view.
                </span>
              </div>
              <div className="t-parallax">
                <Orb mode="market" focus={$v.selWh} lot={$v.selId} l1={$v.selL1} l2={$v.selL2} onFocus={$v.pickWh} w="620" />
              </div>
            </section>
            {$v.isEmpty ? (
              <>
                <div className="t-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "64px" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4" />
                  </svg>
                  {" "}
                  <span className="t-h4">
                    No lots match these filters
                  </span>
                  {" "}
                  <span className="t-sm t-sec">
                    Widen the quantity range or include pledged lots. You can also place an RFQ bid and sellers will see it.
                  </span>
                  <div className="t-row">
                    <button className="t-btn t-btn-secondary" onClick={$v.clear}>
                      Clear filters
                    </button>
                    <a href="/marketplace/rfq" className="t-btn t-btn-primary">
                      Place an RFQ
                    </a>
                  </div>
                </div>
              </>
            ) : null}
            {" "}
            {$v.isCards ? (
              <>
                <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: "24px" }}>
                  {($v.lots ?? []).map((l, $i0) => (
                    <Fragment key={$i0}>
                      <article className="t-card t-card-flush" style={{ display: "flex", flexDirection: "column", opacity: l?.op }}>
                        <div className="t-ruled" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="t-row" style={{ gap: "10px" }}>
                            <span className="t-mono" style={{ fontSize: "20px", fontWeight: "500", background: "var(--surface)", padding: "0 4px" }}>
                              <span className="sc-interp">{l?.sym}</span>
                            </span>
                            <span className="t-mono t-sec" style={{ background: "var(--surface)", padding: "0 4px" }}>
                              <span className="sc-interp">{l?.id}</span>
                            </span>
                          </span>
                          {" "}
                          <span className="t-row" style={{ gap: "6px" }}>
                            <button className="t-btn t-btn-ghost t-btn-sm" onClick={l?.locate} aria-label={`Locate ${l?.id ?? ''} on the globe`} aria-pressed={l?.on} style={{ height: "28px", color: l?.locC }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 21s-6-5.6-6-11a6 6 0 0112 0c0 5.4-6 11-6 11zM12 12a2 2 0 100-4 2 2 0 000 4z" />
                              </svg>
                            </button>
                            <span className={`t-badge ${l?.stTone ?? ''}`}>
                              <span className="sc-interp">{l?.st}</span>
                            </span>
                          </span>
                        </div>
                        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px", flex: "1" }}>
                          <div className="t-between" style={{ alignItems: "flex-start" }}>
                            <div className="t-stack">
                              <span className="t-h4">
                                <span className="sc-interp">{l?.mat}</span>
                              </span>
                              <span className="t-cap">
                                <span className="sc-interp">{l?.wh}</span>
                                {" · "}
                                <span className="sc-interp">{l?.region}</span>
                              </span>
                            </div>
                            <div className="t-stack" style={{ alignItems: "flex-end" }}>
                              <span className="t-num-md">
                                <span className="sc-interp">{l?.price}</span>
                              </span>
                              <span className="t-cap">
                                <span className="sc-interp">{l?.ppt}</span>
                                {" / t"}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
                            <div className="t-stack">
                              <span className="t-cap">
                                Quantity
                              </span>
                              <span className="t-num">
                                <span className="sc-interp">{l?.qty}</span>
                              </span>
                            </div>
                            <div className="t-stack">
                              <span className="t-cap">
                                Inspected
                              </span>
                              <span className="t-num">
                                <span className="sc-interp">{l?.insp}</span>
                              </span>
                            </div>
                            <div className="t-stack">
                              <span className="t-cap">
                                Reserve
                              </span>
                              <span className={`t-num ${l?.resFg ?? ''}`}>
                                <span className="sc-interp">{l?.res}</span>
                              </span>
                            </div>
                          </div>
                          <div className="t-row" style={{ gap: "4px" }}>
                            {(l?.prov ?? []).map((p, $i1) => (
                              <Fragment key={$i1}>
                                <span className={`t-badge t-badge-word ${p?.tone ?? ''}`} style={{ height: "20px", fontSize: "11px" }}>
                                  <span className="sc-interp">{p?.t}</span>
                                </span>
                              </Fragment>
                            ))}
                          </div>
                          <div className="t-well" style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: "12px", borderColor: l?.lienBd }}>
                            <span className="t-sm">
                              <span className="t-label">
                                Lien
                              </span>
                              <span className="sc-interp">{l?.lien}</span>
                            </span>
                            <span className="t-cap" style={{ textAlign: "right" }}>
                              <span className="sc-interp">{l?.lienD}</span>
                            </span>
                          </div>
                          <div className="t-between">
                            <span className="t-cap">
                              {"Seller "}
                              <span className="t-strong">
                                <span className="sc-interp">{l?.seller}</span>
                              </span>
                            </span>
                            <span className={`t-cap ${l?.expFg ?? ''}`}>
                              <span className="sc-interp">{l?.exp}</span>
                            </span>
                          </div>
                        </div>
                        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {l?.ok ? (
                            <>
                              <div className="t-row">
                                <a href="/marketplace/buy" className="t-btn t-btn-primary" style={{ flex: "1" }}>
                                  {"Buy for "}
                                  <span className="sc-interp">{l?.price}</span>
                                </a>
                                <a href="/marketplace/rfq" className="t-btn t-btn-secondary">
                                  Bid
                                </a>
                              </div>
                            </>
                          ) : null}
                          {" "}
                          {l?.own ? (
                            <>
                              <a href="/marketplace/rfq" className="t-btn t-btn-secondary t-btn-block">
                                Your listing · 2 bids
                              </a>
                            </>
                          ) : null}
                          {" "}
                          {l?.blocked ? (
                            <>
                              <button className="t-btn t-btn-block" disabled>
                                Buy
                              </button>
                              <span className="t-reason">
                                <span className="sc-interp">{l?.why}</span>
                              </span>
                            </>
                          ) : null}
                        </div>
                      </article>
                    </Fragment>
                  ))}
                </section>
              </>
            ) : null}
            {" "}
            {$v.isTable ? (
              <>
                <div className="t-table-wrap">
                  <table className="t-table t-dense">
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
                        <th>
                          Warehouse
                        </th>
                        <th className="t-right">
                          Price
                        </th>
                        <th className="t-right">
                          Price / t
                        </th>
                        <th>
                          Verification
                        </th>
                        <th>
                          Loan status
                        </th>
                        <th>
                          Expiry
                        </th>
                        <th>
                          Seller
                        </th>
                        <th />
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
                            <td>
                              <span className="t-mono t-sec">
                                <span className="sc-interp">{l?.whc}</span>
                              </span>
                            </td>
                            <td className="t-right">
                              <span className="sc-interp">{l?.price}</span>
                            </td>
                            <td className="t-right">
                              <span className="sc-interp">{l?.ppt}</span>
                            </td>
                            <td>
                              <span className={`t-badge t-badge-word ${l?.vTone ?? ''}`}>
                                <span className="sc-interp">{l?.v}</span>
                              </span>
                            </td>
                            <td>
                              <span className={`t-badge ${l?.lienTone ?? ''}`}>
                                <span className="sc-interp">{l?.lienShort}</span>
                              </span>
                            </td>
                            <td>
                              <span className={l?.expFg}>
                                <span className="sc-interp">{l?.expShort}</span>
                              </span>
                            </td>
                            <td className="t-sec">
                              <span className="sc-interp">{l?.seller}</span>
                            </td>
                            <td className="t-right">
                              {l?.ok ? (
                                <>
                                  <a href="/marketplace/buy" className="t-btn t-btn-sm t-btn-ghost">
                                    Buy
                                  </a>
                                </>
                              ) : null}
                              {l?.blocked ? (
                                <>
                                  <span className="t-cap">
                                    Unavailable
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
              </>
            ) : null}
          </main>
        </div>
      </div>
    );
  }
}
