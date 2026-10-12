// @ts-nocheck
/* Generated from Orb.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { age, pct } from '../lib/format';
import { shortAddress } from '../lib/web3';
import { useWarehouses } from '../state/protocol';
import { DCLogic } from './runtime';
import './Orb.css';

/** API warehouse -> the shape the design's globe and card use. */
function toOrb(w, now) {
  const h = w.frozen ? 'breach' : !w.fresh ? 'stale' : !w.healthy ? 'breach' : 'ok';
  const code = w.code || 'WH-' + w.warehouseId;
  return {
    name: w.name, lat: w.lat, lon: w.lon, op: w.operatorName || shortAddress(w.operator),
    cov: w.coverage != null ? pct(w.coverage) : 'No lots yet',
    feed: (w.fresh ? 'Fresh · ' : 'Stale · ') + age(w.reportedAt, now),
    h, mine: '—', short: code.split('-')[0]
  };
}

class OrbLogic extends DCLogic {
  state = { lon0: 10, lat0: 22, flip: false, key: '' };
  // the design's network: shown until the API answers
  STATIC_WH = {
    'RTM-BOT-04': { name: 'Rotterdam Botlek 04', lat: 51.88, lon: 4.31, op: 'Portline Warehousing', cov: '111.11%', feed: 'Fresh · 2 h', h: 'ok', mine: '2 lots · 50.000 t', short: 'RTM' },
    'ANR-DEL-03': { name: 'Antwerp Deurganck 03', lat: 51.22, lon: 4.40, op: 'Scheldt Bonded NV', cov: '118.20%', feed: 'Fresh · 1 h', h: 'ok', mine: '—', short: 'ANR' },
    'SIN-JUR-01': { name: 'Singapore Jurong 01', lat: 1.33, lon: 103.70, op: 'Jurong Bonded Logistics', cov: '124.30%', feed: 'Fresh · 41 min', h: 'ok', mine: '1 lot · 12.000 t', short: 'SIN' },
    'PKL-WST-02': { name: 'Port Klang West 02', lat: 3.00, lon: 101.39, op: 'Straits Bonded Storage', cov: '83.33%', feed: 'Fresh · 1 h', h: 'breach', mine: '—', short: 'PKL' },
    'HOU-SHP-05': { name: 'Houston Ship Channel 05', lat: 29.73, lon: -95.27, op: 'Gulfside Terminals', cov: '109.75%', feed: 'Fresh · 3 h', h: 'ok', mine: '—', short: 'HOU' },
    'DUR-BAY-01': { name: 'Durban Bayhead 01', lat: -29.88, lon: 31.03, op: 'Bayhead Terminals', cov: '104.00%', feed: 'Stale · 26 h', h: 'stale', mine: '—', short: 'DUR' },
    'LOS-APA-01': { name: 'Lagos Apapa 01', lat: 6.45, lon: 3.36, op: 'Apapa Bonded Terminals', cov: 'No lots yet', feed: 'Fresh · 1 h', h: 'ok', mine: '—', short: 'LOS' }
  };
  // live network from the API (props.network), keyed by warehouse code
  get WH() {
    const src = this.props.network;
    if (src !== this._src) {
      this._src = src;
      const now = Date.now();
      const map = {};
      for (const w of src || []) if (w.lat != null && w.lon != null) map[w.code || 'WH-' + w.warehouseId] = toOrb(w, now);
      this._wh = Object.keys(map).length ? map : null;
    }
    return this._wh || this.STATIC_WH;
  }
  target() {
    const f = this.WH[this.props.focus];
    if (f) return { lon: f.lon - (this.props.compact ? 0 : 24), lat: Math.max(-14, Math.min(34, f.lat * 0.62)), drift: false };
    return { lon: this.drift || 10, lat: 22, drift: true };
  }
  componentDidMount() {
    this.reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.drift = 10;
    const t = this.target();
    this.cur = { lon: t.lon, lat: t.lat };
    this.setState({ lon0: t.lon, lat0: t.lat });
    let last = 0;
    const tick = (now) => {
      if (now - last > 40) {
        last = now;
        const tg = this.target();
        if (tg.drift && !this.reduce) this.drift += 0.05;
        const dl = ((tg.lon - this.cur.lon + 540) % 360) - 180;
        const k = this.reduce ? 1 : 0.055;
        this.cur.lon += dl * k;
        this.cur.lat += (tg.lat - this.cur.lat) * k;
        const sway = this.reduce ? 0 : Math.sin(now / 7000) * 1.1;
        const nod = this.reduce ? 0 : Math.sin(now / 9500) * 0.7;
        this.setState({ lon0: this.cur.lon + sway, lat0: this.cur.lat + nod });
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  componentWillUnmount() { cancelAnimationFrame(this.raf); }
  componentDidUpdate() {
    const key = [this.props.mode, this.props.focus, this.props.phase].join('|');
    if (key !== this.state.key) this.setState({ key, flip: !this.state.flip });
  }
  renderVals() {
    const mode = this.props.mode ?? 'portfolio';
    const focus = this.props.focus ?? '';
    const phase = Number(this.props.phase ?? 0);
    const compact = !!this.props.compact;
    const w = this.props.w ?? (compact ? 320 : 620);
    const S = compact ? Math.min(w, 300) : 320;
    const R = 160, C = 200, rad = Math.PI / 180;
    const lam0 = this.state.lon0 * rad, ph0 = this.state.lat0 * rad;
    const P = (lat, lon) => {
      const la = lat * rad, lo = lon * rad - lam0;
      const z = Math.sin(ph0) * Math.sin(la) + Math.cos(ph0) * Math.cos(la) * Math.cos(lo);
      return { x: C + R * Math.cos(la) * Math.sin(lo), y: C - R * (Math.cos(ph0) * Math.sin(la) - Math.sin(ph0) * Math.cos(la) * Math.cos(lo)), z };
    };
    let front = '', back = '';
    const trace = (pts) => {
      let prev = null;
      pts.forEach((q) => {
        const vis = q.z > 0;
        const cmd = (prev === null || prev !== vis) ? 'M' : 'L';
        const s = cmd + q.x.toFixed(1) + ' ' + q.y.toFixed(1);
        if (vis) front += s; else back += s;
        prev = vis;
      });
    };
    for (let lo = -180; lo < 180; lo += 30) { const a = []; for (let la = -84; la <= 84; la += 6) a.push(P(la, lo)); trace(a); }
    [-60, -30, 0, 30, 60].forEach((la) => { const a = []; for (let lo = -180; lo <= 180; lo += 6) a.push(P(la, lo)); trace(a); });
    const nodes = [];
    [-30, 30].forEach((la) => { for (let lo = -180; lo < 180; lo += 60) { const q = P(la, lo); if (q.z > 0.15) nodes.push({ x: q.x.toFixed(1), y: q.y.toFixed(1), o: (0.18 + q.z * 0.32).toFixed(2) }); } });

    const tone = { ok: '#d7fcfd', stale: '#f0b860', breach: '#ff8b7b' };
    const showAll = mode === 'portfolio' || mode === 'reserve' || mode === 'market';
    const mine = this.props.mine ?? ['RTM-BOT-04', 'SIN-JUR-01']; // the caller's warehouses (Overview passes them)
    const pts = Object.keys(this.WH).map((code, i) => {
      const h = this.WH[code];
      const q = P(h.lat, h.lon);
      const isF = code === focus;
      let o = showAll ? (mode === 'portfolio' && !mine.includes(code) ? 0.35 : 0.85) : (isF ? 1 : 0.22);
      if (q.z <= 0) o *= 0.18;
      const c = (mode === 'reserve' || mode === 'market' || isF) ? tone[h.h] : '#d7fcfd';
      const label = isF && q.z > 0 ? h.short : false;
      return { x: q.x.toFixed(1), y: q.y.toFixed(1), z: q.z, r: isF ? 4.6 : 3, hr: isF ? 14 : (showAll && q.z > 0 ? 8 : 0), o: o.toFixed(2), c, label, lx: (q.x + 10).toFixed(1), ly: (q.y - 10).toFixed(1), delay: (i * 0.5) + 's',
        pick: () => { if (this.props.onFocus) this.props.onFocus(code); } };
    });

    // connection: warehouse → Tensile node at the card edge (reversed for redemption)
    const f = this.WH[focus];
    const ax = compact ? 200 : 392, ay = compact ? 392 : 200;
    let showLink = false, linkPath = '';
    if (f && mode !== 'portfolio') {
      const q = P(f.lat, f.lon);
      if (q.z > 0.05) {
        showLink = true;
        const mx = (q.x + ax) / 2 + (compact ? 40 : 0), my = (q.y + ay) / 2 - (compact ? 0 : 50);
        linkPath = 'M' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + ax + ' ' + ay;
      }
    }
    const redeem = mode === 'redeem';
    const linkClass = redeem ? 'orb-flow-rev' : 'orb-flow';
    const linkOp = mode === 'borrow' ? (0.35 + Math.min(phase, 4) * 0.15).toFixed(2) : (redeem ? (0.9 - Math.min(phase, 4) * 0.12).toFixed(2) : '0.8');

    // the card: what the globe is showing, in product terms
    const step = (t, d, s, last) => ({ t, d, line: !last, op: s === 'idle' ? '.45' : (s === 'gone' ? '.55' : '1'),
      dot: s === 'done' ? '#7fe0b0' : (s === 'live' ? '#d7fcfd' : (s === 'gone' ? 'transparent' : 'rgba(215,252,253,.25)')),
      glow: s === 'done' ? 'rgba(95,211,154,.6)' : (s === 'live' ? 'rgba(215,252,253,.8)' : 'transparent'),
      pulse: s === 'live' ? 't-pulse' : '', lineC: s === 'done' ? 'rgba(95,211,154,.35)' : 'rgba(215,252,253,.12)', strike: s === 'gone' ? 'line-through' : 'none' });
    const st = (i, litUpTo, live) => i < litUpTo ? 'done' : (i === live ? 'live' : 'idle');
    let eyebrow = 'Material network', title = '2 warehouses · 62.000 t', sub = 'RTM-BOT-04 · SIN-JUR-01', pill = 'All healthy', pillTone = 't-success', rows = [], chain = [], note = '';
    const H = f ? { ok: ['Healthy', 't-success'], stale: ['Stale feed', 't-warning'], breach: ['Reserve breach', 't-danger'] }[f.h] : null;
    const held = this.props.holdings; // { code: '2 lots · 50.000 t' } when the caller knows the user's lots
    if (mode === 'portfolio') {
      if (f) { eyebrow = 'Your metal here'; title = f.name; sub = focus + ' · ' + f.op; pill = H[0]; pillTone = H[1]; rows = [{ k: 'Your lots', v: held ? held[focus] ?? 'None here' : f.mine }, { k: 'Reserve coverage', v: f.cov }, { k: 'Feed', v: f.feed }]; note = 'Select another point, or a warehouse on the left.'; }
      else if (held) {
        const codes = Object.keys(held);
        const allOk = codes.every((c) => !this.WH[c] || this.WH[c].h === 'ok');
        title = codes.length ? codes.length + ' warehouse' + (codes.length === 1 ? '' : 's') : 'No lots yet';
        sub = codes.length ? codes.join(' · ') : 'Tokenize material to see it here';
        pill = codes.length ? (allOk ? 'All healthy' : 'Check reserves') : ''; pillTone = allOk ? 't-success' : 't-warning';
        rows = codes.map((c) => ({ k: this.WH[c] ? this.WH[c].name : c, v: held[c] }));
        note = codes.length ? 'Points are the warehouses that hold your lots.' : 'Points are the warehouses on the Tensile network.';
      }
      else { rows = [{ k: 'Rotterdam Botlek 04', v: '50.000 t' }, { k: 'Singapore Jurong 01', v: '12.000 t' }]; note = 'Points are the warehouses that hold your lots.'; }
    } else if (mode === 'reserve' && f) {
      eyebrow = 'Reserve feed'; title = f.name; sub = focus + ' · ' + f.op; pill = H[0]; pillTone = H[1];
      const all = Object.values(this.WH);
      rows = [{ k: 'Coverage', v: f.cov }, { k: 'Feed', v: f.feed }, { k: 'Network', v: all.length + ' warehouses · ' + all.filter((x) => x.h === 'ok').length + ' healthy' }];
      note = f.h === 'breach' ? 'Frozen: mint, borrowing and transfers blocked here.' : (f.h === 'stale' ? 'New mint and borrowing paused until a fresh attestation.' : 'Reserve covers every lot tokenized here.');
    } else if (mode === 'market') {
      eyebrow = 'Selected listing'; title = this.props.lot || 'Marketplace'; sub = f ? f.name : Object.keys(this.WH).length + ' warehouses on the network'; pill = f ? H[0] : 'Live'; pillTone = f ? H[1] : 't-info';
      rows = [{ k: 'Material', v: this.props.l1 || '—' }, { k: 'Price', v: this.props.l2 || '—' }, { k: 'Custody', v: f ? f.op : '—' }];
      note = 'Every point is metal on a warehouse floor available to buy.';
    } else if (mode === 'lot') {
      eyebrow = 'Custody chain'; title = this.props.lot || 'TNS-CU-00418'; sub = f ? f.name : ''; pill = phase >= 1 ? 'Pledged' : 'Free'; pillTone = phase >= 1 ? 't-info' : 't-success';
      chain = [step('Physical warehouse', f ? f.name + ' · ' + f.op : '', 'done'), step('Tensile', 'Verified · reserve ' + (f ? f.cov : ''), 'done'), step('Digital lot', (this.props.lot || '') + ' · Halden Metals Ltd', 'done', phase < 1)];
      if (phase >= 1) chain.push(step('Collateral', 'LN-2291 · credit vault', 'live', true));
      note = 'The line runs from the metal to its passport.';
    } else if (mode === 'borrow') {
      eyebrow = 'Collateral path'; title = this.props.lot || 'TNS-CU-00418'; sub = f ? f.name : '';
      const lit = [2, 2, 3, 4, 4][Math.min(phase, 4)], live = [-1, 2, 3, -1, -1][Math.min(phase, 4)];
      pill = ['Ready', 'Pledging', 'Credit moving', 'Confirmed', 'Credit active'][Math.min(phase, 4)]; pillTone = phase >= 3 ? 't-success' : (phase >= 1 ? 't-info' : 't-neutral');
      chain = [step('Warehouse', f ? f.name : '', st(0, lit, live)), step('Material lot', this.props.lot || '', st(1, lit, live)), step('Collateral', 'Pledged to the credit vault', st(2, lit, live)), step('Credit', this.props.l1 || 'USDC to your wallet', st(3, lit, live), true)];
      note = phase >= 3 ? 'The lot now secures the loan; it stays in custody.' : 'Borrowing pledges the lot. The metal does not move.';
    } else if (redeem) {
      eyebrow = 'Digital → physical'; title = this.props.lot || 'TNS-NI-00091'; sub = f ? f.name : '';
      const p = Math.min(phase, 4);
      pill = ['Active lot', 'Redeeming', 'Releasing', 'Proof posted', 'Released'][p]; pillTone = p >= 4 ? 't-success' : (p >= 1 ? 't-info' : 't-success');
      chain = [step('Digital ownership', 'Passport ' + (this.props.lot || ''), p >= 4 ? 'gone' : (p >= 1 ? 'done' : 'live')), step('Redeeming', 'Transfers locked', st(1, p, p >= 1 && p < 2 ? 1 : -1)), step('Warehouse release', f ? f.op : '', st(2, p, p === 2 ? 2 : -1)), step('Physical metal', 'Collected · history retained', p >= 4 ? 'done' : (p === 3 ? 'live' : 'idle'), true)];
      note = p >= 4 ? 'The passport is burned; its record stays on the ledger.' : 'Attention moves from the passport back to the metal.';
    }
    const atmo = redeem ? Math.max(0.10, 0.22 - phase * 0.02) : (mode === 'borrow' ? 0.16 + Math.min(phase, 4) * 0.03 : 0.18);
    const atmoColor = (f && f.h === 'breach' && (mode === 'reserve' || mode === 'market')) ? 'rgba(255,139,123,.16)' : 'rgba(80,200,200,' + atmo.toFixed(2) + ')';
    return {
      w, S, front, back, nodes, pts, showLink, linkPath, ax, ay, linkClass, linkOp, atmoColor,
      cardClass: this.state.flip ? 'orb-card-a' : 'orb-card-b', cardMax: compact ? '100%' : '280px',
      eyebrow, title, sub, pill, pillTone, rows, hasRows: rows.length > 0, chain, hasChain: chain.length > 0, note,
      aria: 'Globe of the Tensile warehouse network' + (f ? ', focused on ' + f.name : '')
    };
  }
}

class OrbView extends OrbLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div style={{ width: `${$v.w ?? ''}px`, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "24px", fontFamily: "var(--sans)", color: "var(--text)", boxSizing: "border-box" }}>
        <div style={{ position: "relative", width: `${$v.S ?? ''}px`, height: `${$v.S ?? ''}px`, flex: "none" }}>
          <div className="orb-atmo" style={{ position: "absolute", inset: "-16%", borderRadius: "999px", background: `radial-gradient(circle at 50% 50%, ${$v.atmoColor ?? ''} 0%, rgba(30,120,130,.10) 40%, transparent 68%)`, filter: "blur(10px)", pointerEvents: "none" }} />
          <svg viewBox="0 0 400 400" width={$v.S} height={$v.S} style={{ position: "relative", overflow: "visible", display: "block" }} role="img" aria-label={$v.aria}>
            <defs>
              <radialGradient id="tsOrbFill" cx="36%" cy="30%" r="78%">
                <stop offset="0%" stopColor="#d7fcfd" stopOpacity=".16" />
                <stop offset="34%" stopColor="#2a8a8a" stopOpacity=".16" />
                <stop offset="72%" stopColor="#06302f" stopOpacity=".55" />
                <stop offset="100%" stopColor="#011616" stopOpacity=".85" />
              </radialGradient>
              <radialGradient id="tsOrbRim" cx="50%" cy="50%" r="50%">
                <stop offset="84%" stopColor="#d7fcfd" stopOpacity="0" />
                <stop offset="97%" stopColor="#bff0ef" stopOpacity=".16" />
                <stop offset="100%" stopColor="#d7fcfd" stopOpacity=".28" />
              </radialGradient>
              <linearGradient id="tsOrbSpec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity=".22" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="tsOrbLink" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#d7fcfd" stopOpacity=".9" />
                <stop offset="100%" stopColor="#d7fcfd" stopOpacity=".25" />
              </linearGradient>
            </defs>
            <circle cx="200" cy="200" r="160" fill="url(#tsOrbFill)" />
            <path d={$v.back} fill="none" stroke="#d7fcfd" strokeOpacity=".07" strokeWidth="1" />
            <path d={$v.front} fill="none" stroke="#d7fcfd" strokeOpacity=".30" strokeWidth="1.25" strokeLinecap="round" />
            {($v.nodes ?? []).map((n, $i0) => (
              <Fragment key={$i0}>
                <circle cx={n?.x} cy={n?.y} r="2.4" fill="#d7fcfd" fillOpacity={n?.o} />
              </Fragment>
            ))}
            <circle cx="200" cy="200" r="160" fill="url(#tsOrbRim)" />
            <circle cx="200" cy="200" r="160.5" fill="none" stroke="#d7fcfd" strokeOpacity=".16" strokeWidth="1" />
            <ellipse cx="146" cy="112" rx="96" ry="50" fill="url(#tsOrbSpec)" transform="rotate(-26 146 112)" />
            {$v.showLink ? (
              <>
                <path d={$v.linkPath} fill="none" stroke="url(#tsOrbLink)" strokeOpacity=".35" strokeWidth="1" />
                <path d={$v.linkPath} fill="none" stroke="#d7fcfd" strokeOpacity={$v.linkOp} strokeWidth="1.4" className={$v.linkClass} />
                <circle cx={$v.ax} cy={$v.ay} r="9" fill="rgba(4,28,30,.9)" stroke="#d7fcfd" strokeOpacity=".5" />
                <circle cx={$v.ax} cy={$v.ay} r="3" fill="#d7fcfd" />
              </>
            ) : null}
            {($v.pts ?? []).map((p, $i0) => (
              <Fragment key={$i0}>
                <g className="orb-pt" onClick={p?.pick}>
                  <circle cx={p?.x} cy={p?.y} r={p?.hr} fill={p?.c} className="orb-halo" style={{ animationDelay: p?.delay }} />
                  <circle cx={p?.x} cy={p?.y} r={p?.r} fill={p?.c} fillOpacity={p?.o} />
                  {p?.label ? (
                    <>
                      <text x={p?.lx} y={p?.ly} fill="#d7fcfd" fillOpacity=".85" fontSize="11" fontFamily="IBM Plex Mono, monospace" letterSpacing=".06em">
                        <span className="sc-interp">{p?.label}</span>
                      </text>
                    </>
                  ) : null}
                </g>
              </Fragment>
            ))}
          </svg>
        </div>
        <div className={$v.cardClass} style={{ flex: "1 1 220px", minWidth: "220px", maxWidth: $v.cardMax, padding: "18px 20px", borderRadius: "20px", background: "linear-gradient(170deg, rgba(215,252,253,.10) 0%, rgba(215,252,253,.035) 45%, rgba(215,252,253,.02) 100%), rgba(10,44,46,.55)", WebkitBackdropFilter: "blur(22px) saturate(140%)", backdropFilter: "blur(22px) saturate(140%)", boxShadow: "inset 0 1px 0 rgba(240,255,255,.16), inset 0 0 0 1px rgba(215,252,253,.08), 0 24px 50px -26px rgba(0,0,0,.6), 0 18px 50px -24px rgba(110,225,225,.25)", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="t-between">
            <span className="t-eyebrow" style={{ fontSize: "10px" }}>
              <span className="sc-interp">{$v.eyebrow}</span>
            </span>
            {$v.pill ? (
              <>
                <span className={`t-badge t-badge-word ${$v.pillTone ?? ''}`}>
                  <span className="t-dot" />
                  <span className="sc-interp">{$v.pill}</span>
                </span>
              </>
            ) : null}
          </div>
          <div className="t-stack" style={{ gap: "2px" }}>
            <span className="t-h4">
              <span className="sc-interp">{$v.title}</span>
            </span>
            <span className="t-mono-sm t-muted" style={{ fontWeight: "400" }}>
              <span className="sc-interp">{$v.sub}</span>
            </span>
          </div>
          {$v.hasRows ? (
            <>
              <div className="t-stack" style={{ gap: "6px" }}>
                {($v.rows ?? []).map((r, $i0) => (
                  <Fragment key={$i0}>
                    <div className="t-between t-sm">
                      <span className="t-muted">
                        <span className="sc-interp">{r?.k}</span>
                      </span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        <span className="sc-interp">{r?.v}</span>
                      </span>
                    </div>
                  </Fragment>
                ))}
              </div>
            </>
          ) : null}
          {" "}
          {$v.hasChain ? (
            <>
              <div className="t-stack" style={{ gap: "0" }}>
                {($v.chain ?? []).map((c, $i0) => (
                  <Fragment key={$i0}>
                    <div className="orb-step" style={{ display: "grid", gridTemplateColumns: "14px minmax(0, 1fr)", gap: "10px", opacity: c?.op }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span className={`orb-step-dot ${c?.pulse ?? ''}`} style={{ width: "7px", height: "7px", marginTop: "6px", borderRadius: "999px", background: c?.dot, boxShadow: `0 0 10px ${c?.glow ?? ''}` }} />
                        {c?.line ? (
                          <>
                            <span style={{ flex: "1", width: "1px", minHeight: "14px", background: c?.lineC }} />
                          </>
                        ) : null}
                      </div>
                      <div className="t-stack" style={{ paddingBottom: "8px" }}>
                        <span className="t-sm" style={{ fontWeight: "500", textDecoration: c?.strike }}>
                          <span className="sc-interp">{c?.t}</span>
                        </span>
                        <span className="t-cap">
                          <span className="sc-interp">{c?.d}</span>
                        </span>
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
            </>
          ) : null}
          {" "}
          <span className="t-cap" style={{ color: "var(--text-secondary)" }}>
            <span className="sc-interp">{$v.note}</span>
          </span>
        </div>
      </div>
    );
  }
}

/** The globe, fed with the live warehouse network of the selected chain. */
export default function Orb(props) {
  const { data } = useWarehouses();
  return <OrbView {...props} network={data?.warehouses} />;
}
