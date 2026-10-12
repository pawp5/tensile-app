// @ts-nocheck
/* Generated from Landing.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { compact, int, pct, tonnes, usdCompact } from '../lib/format';
import { useProtocolStats, useWarehouses } from '../state/protocol';
import { useSession } from '../state/session';
import { DCLogic } from './runtime';
import './Landing.css';

// The design's warehouses: shown until the API answers (and if it has no coordinates yet).
const DESIGN_WH = [
  { code: 'RTM-BOT-04', short: 'RTM', lat: 51.88, lon: 4.31 },
  { code: 'ANR-DEL-03', short: 'ANR', lat: 51.22, lon: 4.40 },
  { code: 'SIN-JUR-01', short: 'SIN', lat: 1.33, lon: 103.70 },
  { code: 'PKL-WST-02', short: 'PKL', lat: 3.00, lon: 101.39 },
  { code: 'HOU-SHP-05', short: 'HOU', lat: 29.73, lon: -95.27 },
  { code: 'DUR-BAY-01', short: 'DUR', lat: -29.88, lon: 31.03 },
  { code: 'LOS-APA-01', short: 'LOS', lat: 6.45, lon: 3.36 }
];

class LandingLogic extends DCLogic {
  state = { f: 0, lon0: 10, lat0: 18 };
  // warehouses on the globe: live from the API (props.warehouses), else the design's list
  get WH() {
    const src = this.props.warehouses;
    if (src !== this._whSrc) {
      this._whSrc = src;
      const list = (src || []).filter((w) => w.lat != null && w.lon != null).map((w) => {
        const code = w.code || 'WH-' + w.warehouseId;
        return { code, short: code.split('-')[0], lat: w.lat, lon: w.lon };
      });
      this._wh = list.length ? list : null;
    }
    return this._wh || DESIGN_WH;
  }
  // live figures for the chapters and the protocol strip ('—' while loading)
  live() {
    const s = this.props.stats;
    if (!s) {
      const d = '—';
      return { custody: d, custodyNum: d, whCount: d, cov: [d, 'reserve coverage, RTM-BOT-04'], vault: d, deployed: d, lots: d, value: d,
        note: this.props.failed ? 'Live figures are unavailable right now.' : 'Loading live figures…' };
    }
    const rtm = (this.props.warehouses || []).find((w) => w.code === 'RTM-BOT-04');
    const cov = rtm && rtm.coverage != null
      ? [pct(rtm.coverage), 'reserve coverage, RTM-BOT-04']
      : [s.healthyWarehouses + ' / ' + s.warehouses, 'warehouses with fresh, covering reserves'];
    const v = s.vault;
    return {
      custody: tonnes(s.custodyKg) + ' t', custodyNum: tonnes(s.custodyKg), whCount: int(s.warehouses), cov,
      vault: v ? compact(v.totalAssetsUsdc) : '0', deployed: v ? pct(v.utilization) : '0.00%',
      lots: int(s.activeLots), value: usdCompact(s.materialValueUsd),
      note: 'Live figures from ' + (this.props.chainName || 'the network') + '.'
    };
  }
  // per chapter: globe centre, radius and the longitude/latitude it turns toward
  CH = [
    { cx: 900, cy: 470, R: 300, lon: null, lat: 18 },
    { cx: 930, cy: 470, R: 330, lon: 22, lat: 28 },
    { cx: 980, cy: 520, R: 420, lon: 14, lat: 42 },
    { cx: 760, cy: 470, R: 300, lon: -28, lat: 30 },
    { cx: 720, cy: 470, R: 280, lon: -30, lat: 30 },
    { cx: 860, cy: 480, R: 320, lon: 52, lat: 16 },
    { cx: 760, cy: 470, R: 340, lon: 80, lat: 8 }
  ];
  componentDidMount() {
    this.reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.cur = { lon: 10, lat: 18 };
    this.drift = 10;
    this.forced = null;
    this.lastTop = null;
    let last = 0;
    const tick = (now) => {
      if (now - last > 33) {
        last = now;
        let f = this.forced ?? 0;
        if (this.track) {
          const r = this.track.getBoundingClientRect();
          const span = Math.max(1, r.height - 900);
          if (this.lastTop !== null && Math.abs(r.top - this.lastTop) > 0.5) this.forced = null;
          this.lastTop = r.top;
          const p = Math.min(1, Math.max(0, -r.top / span));
          f = this.forced ?? p * 6;
        }
        const ci = Math.round(f);
        const tg = this.CH[ci];
        if (!this.reduce) this.drift += 0.04;
        const tLon = tg.lon === null ? this.drift : tg.lon;
        const dl = ((tLon - this.cur.lon + 540) % 360) - 180;
        const k = this.reduce ? 1 : 0.045;
        this.cur.lon += dl * k;
        this.cur.lat += (tg.lat - this.cur.lat) * k;
        const sway = this.reduce ? 0 : Math.sin(now / 8000) * 1.2;
        this.setState({ f, lon0: this.cur.lon + sway, lat0: this.cur.lat });
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  componentWillUnmount() { cancelAnimationFrame(this.raf); }
  goTo(i) {
    if (this.track) {
      const r = this.track.getBoundingClientRect();
      const span = Math.max(1, r.height - 900);
      const y = window.scrollY + r.top + span * (i / 6);
      const before = window.scrollY;
      window.scrollTo({ top: y, behavior: this.reduce ? 'auto' : 'smooth' });
      setTimeout(() => { if (Math.abs(window.scrollY - before) < 2 && Math.abs(y - before) > 2) { this.forced = i; this.lastTop = null; } }, 120);
    } else this.forced = i;
  }
  renderVals() {
    const f = this.state.f;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const ss = (t) => t * t * (3 - 2 * t);
    const i0 = clamp(Math.floor(f), 0, 6), i1 = clamp(i0 + 1, 0, 6), t = ss(clamp(f - i0, 0, 1));
    const lerp = (a, b) => a + (b - a) * t;
    const A = this.CH[i0], B = this.CH[i1];
    const cx = lerp(A.cx, B.cx), cy = lerp(A.cy, B.cy), R = lerp(A.R, B.R);
    const bell = (c, w) => clamp(1 - (Math.abs(f - c) - (w ?? 0.18)) * 2.6, 0, 1);
    const rad = Math.PI / 180, lam0 = this.state.lon0 * rad, ph0 = this.state.lat0 * rad;
    const P = (lat, lon) => {
      const la = lat * rad, lo = lon * rad - lam0;
      const z = Math.sin(ph0) * Math.sin(la) + Math.cos(ph0) * Math.cos(la) * Math.cos(lo);
      return { x: cx + R * Math.cos(la) * Math.sin(lo), y: cy - R * (Math.cos(ph0) * Math.sin(la) - Math.sin(ph0) * Math.cos(la) * Math.cos(lo)), z };
    };
    let front = '', back = '';
    const trace = (pts) => { let prev = null; pts.forEach((q) => { const vis = q.z > 0; const s = ((prev === null || prev !== vis) ? 'M' : 'L') + q.x.toFixed(1) + ' ' + q.y.toFixed(1); if (vis) front += s; else back += s; prev = vis; }); };
    for (let lo = -180; lo < 180; lo += 20) { const a = []; for (let la = -84; la <= 84; la += 6) a.push(P(la, lo)); trace(a); }
    [-60, -40, -20, 0, 20, 40, 60].forEach((la) => { const a = []; for (let lo = -180; lo <= 180; lo += 5) a.push(P(la, lo)); trace(a); });
    const nodes = [];
    [-20, 20].forEach((la) => { for (let lo = -180; lo < 180; lo += 60) { const q = P(la, lo); if (q.z > 0.2) nodes.push({ x: q.x.toFixed(1), y: q.y.toFixed(1), o: (0.12 + q.z * 0.3).toFixed(2) }); } });

    // warehouses: faint in the hero, lit from chapter 1, focus by chapter
    const lit = clamp((f - 0.5) * 2, 0, 1);
    const focusCode = f < 5.5 ? 'RTM-BOT-04' : 'SIN-JUR-01';
    const focusOn = f > 1.6;
    const proj = {};
    const pts = this.WH.map((w, i) => {
      const q = P(w.lat, w.lon); proj[w.code] = q;
      const isF = focusOn && w.code === focusCode;
      const vis = q.z > 0 ? 1 : 0.12;
      const base = (0.25 + lit * 0.7) * vis * (focusOn && !isF && f < 4.6 ? 0.45 : 1);
      return { x: q.x.toFixed(1), y: q.y.toFixed(1), r: isF ? 5 : 3.2, hr: q.z > 0 ? (isF ? 18 : 9 * lit) : 0, o: base.toFixed(2), c: '#d7fcfd', delay: (i * 0.55) + 's',
        short: w.short, lx: (q.x + 10).toFixed(1), ly: (q.y - 10).toFixed(1), lo: (q.z > 0 ? (isF ? 0.9 : lit * 0.55) : 0).toFixed(2) };
    });
    const F = proj[focusCode];

    // hero: floating information around the network
    const heroO = clamp(1 - (f - 0.25) * 2.4, 0, 1);
    const chipDefs = [
      ['MATERIAL', 'Copper cathode · 30.000 t', 690, 150, 0.6], ['WAREHOUSE', 'Rotterdam Botlek 04', 1190, 160, 1.0],
      ['VERIFICATION', 'Inspected · seals intact', 1290, 440, 0.8], ['OWNERSHIP', 'Halden Metals Ltd', 1210, 740, 1.2],
      ['CREDIT', 'LTV 46.88% · USDC', 880, 820, 0.7], ['LIQUIDITY', 'Settles atomically', 640, 650, 1.1]
    ];
    const chips = chipDefs.map(([k, v, x, y, d]) => ({ k, v, x, y, o: heroO.toFixed(2), dy: (-f * 140 * d).toFixed(1) }));
    const chipLines = chipDefs.map(([, , x, y, d]) => {
      const yy = y - f * 140 * d; const dx = cx - x, dy = cy - yy; const L = Math.hypot(dx, dy) || 1;
      return { x1: x.toFixed(1), y1: yy.toFixed(1), x2: (cx - dx / L * R).toFixed(1), y2: (cy - dy / L * R).toFixed(1), o: (heroO * 0.22).toFixed(2) };
    });

    // verification: rings around the warehouse and the attestations that orbit it
    const vO = bell(2, 0.3);
    const rings = F && F.z > 0 ? [26, 44, 66].map((r, i) => ({ x: F.x.toFixed(1), y: F.y.toFixed(1), r: (r * (0.6 + vO * 0.4)).toFixed(1), o: (vO * (0.5 - i * 0.12)).toFixed(2), dash: i === 1 ? '2 4' : '0' })) : [];
    const vNames = ['Certificate verified', 'Automated review 94', 'Inspection attested', 'Custody confirmed', 'Reserve 111.11%'];
    const vlabels = F ? vNames.map((tx, i) => { const ang = (-150 + i * 52) * rad; const rr = 130 + i * 6; return { t: tx, x: (F.x + Math.cos(ang) * rr).toFixed(1), y: (F.y + Math.sin(ang) * rr * 0.8).toFixed(1), o: clamp(vO * 1.4 - i * 0.12, 0, 1).toFixed(2), s: (0.94 + vO * 0.06).toFixed(3) }; }) : [];

    // digital → financeable → redeemable: the provenance line
    const passO = Math.max(bell(3, 0.3), bell(4, 0.3), bell(5, 0.2) * 0.35);
    const vaultO = bell(4, 0.25);
    const redO = bell(6, 0.4);
    const links = [];
    if (F && F.z > 0.05) {
      if (passO > 0.02 && f < 5.5) {
        const ax = 1060, ay = 330; const mx = (F.x + ax) / 2, my = Math.min(F.y, ay) - 70;
        links.push({ d: 'M' + F.x.toFixed(1) + ' ' + F.y.toFixed(1) + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + ax + ' ' + ay, o: (passO * 0.85).toFixed(2), cls: 'lp-flow' });
      }
      if (vaultO > 0.02) links.push({ d: 'M1220 560 L1220 610', o: (vaultO * 0.9).toFixed(2), cls: 'lp-flow' });
      if (redO > 0.02) {
        const ax = 1080, ay = 380; const mx = (F.x + ax) / 2, my = Math.min(F.y, ay) - 80;
        links.push({ d: 'M' + ax + ' ' + ay + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + F.x.toFixed(1) + ' ' + F.y.toFixed(1), o: (redO * 0.9).toFixed(2), cls: 'lp-flow' });
      }
    }

    // liquidity: trade arcs between warehouses and live listings
    const mO = bell(5, 0.3);
    const pairs = [['RTM-BOT-04', 'SIN-JUR-01'], ['ANR-DEL-03', 'DUR-BAY-01'], ['SIN-JUR-01', 'DUR-BAY-01'], ['RTM-BOT-04', 'DUR-BAY-01']];
    const arcs = mO > 0.02 ? pairs.map(([a, b]) => {
      const p = proj[a], q = proj[b];
      if (!p || !q || !(p.z > 0 && q.z > 0)) return null;
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2; const ox = mx - cx, oy = my - cy;
      const c = { x: mx + ox * 0.45, y: my + oy * 0.45 - 30 };
      return { d: 'M' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' Q' + c.x.toFixed(1) + ' ' + c.y.toFixed(1) + ' ' + q.x.toFixed(1) + ' ' + q.y.toFixed(1), o: (mO * 0.55).toFixed(2) };
    }).filter(Boolean) : [];
    const L = [['ANR-DEL-03', 'TNS-AL-00233', '$260,000', 'LISTED', 't-brand'], ['SIN-JUR-01', 'TNS-NI-00104', '$165,000', 'BID', 't-info'], ['RTM-BOT-04', 'TNS-CU-00427', '$246,250', 'SETTLED', 't-success']];
    const listings = L.filter(([code]) => proj[code]).map(([code, id, v, st, tone], i) => { const q = proj[code]; return { id, v, st, tone, x: (q.x + (i === 0 ? -40 : 30)).toFixed(1), y: (q.y - 18).toFixed(1), o: (q.z > 0 ? clamp(mO * 1.3 - i * 0.15, 0, 1) : 0).toFixed(2) }; });

    // chapters
    const m = this.live();
    const C = [
      ['Tensile', 'The operating system for real-world materials.', 'Physical metal, verified where it sits, held as a digital lot — then financed, traded and redeemed on one ledger.', null, 74, 640, 250],
      ['01 · Physical', 'It starts on a warehouse floor.', 'Copper cathode in Rotterdam. Nickel in Singapore. Zinc in Houston. Every lot is metal you can locate, weigh and inspect.', [[m.custody, 'in bonded custody'], [m.whCount, 'warehouses on the network']], 56, 520, 260],
      ['02 · Verified', 'Then it is proven.', 'A certificate, an automated review, an independent inspection, warehouse custody and a live reserve feed. Signed, timestamped, evidenced.', [['5', 'attestations per lot'], m.cov], 56, 460, 260],
      ['03 · Digital', 'It becomes a material passport.', 'One lot, one passport: what it is, where it is, who owns it, and every event in its life.', null, 56, 440, 280],
      ['04 · Financeable', 'It becomes collateral.', 'Borrow USDC against the lot at up to 65% LTV. The metal never moves; the lien is written on the passport.', [[m.vault, 'USDC in the credit vault'], [m.deployed, 'of it deployed']], 56, 420, 260],
      ['05 · Liquid', 'It trades — even when pledged.', 'Payment, loan payoff and change of ownership settle in a single transaction, between verified counterparties.', [[m.lots, 'active lots'], [m.value, 'material value represented']], 56, 460, 260],
      ['06 · Redeemable', 'And it always returns to metal.', 'Redeem, and the warehouse releases the material to your collector. The passport is burned; its history is kept.', null, 56, 460, 280]
    ];
    const chapters = C.map(([e, h, p, m, fs, w, top], i) => { const o = bell(i, i === 0 ? 0.25 : 0.18); return { e, h, p, fs, w, top, hasM: !!m, m: m ? m.map(([v, k]) => ({ v, k })) : [], hero: i === 0, o: o.toFixed(3), dy: ((i - f) * 70).toFixed(1), b: ((1 - o) * 8).toFixed(1), pe: o > 0.5 ? 'auto' : 'none' }; });
    const names = ['Intro', 'Physical', 'Verified', 'Digital', 'Finance', 'Liquid', 'Redeem'];
    const ci = Math.round(f);
    const rail = names.map((label, i) => ({ label, cur: i === ci ? 'step' : 'false', lo: i === ci ? '1' : '0', go: () => this.goTo(i) }));
    return {
      trackRef: (el) => { this.track = el; },
      cx: cx.toFixed(1), cy: cy.toFixed(1), R: R.toFixed(1), front, back, nodes, pts, chips, chipLines, rings, vlabels, links, arcs, listings, chapters, rail,
      specX: (cx - R * 0.34).toFixed(1), specY: (cy - R * 0.55).toFixed(1), specRx: (R * 0.6).toFixed(1), specRy: (R * 0.31).toFixed(1), specT: 'rotate(-26 ' + (cx - R * 0.34).toFixed(1) + ' ' + (cy - R * 0.55).toFixed(1) + ')',
      glowX: (cx - R * 1.3).toFixed(1), glowY: (cy - R * 1.3).toFixed(1), glowS: (R * 2.6).toFixed(1), glowA: (0.14 + vaultO * 0.06 + mO * 0.04).toFixed(2),
      passO: passO.toFixed(3), passDy: ((1 - passO) * 30).toFixed(1), passS: (0.96 + passO * 0.04).toFixed(3), passB: ((1 - passO) * 10).toFixed(1),
      passState: f > 3.5 ? 'PLEDGED' : 'FREE', passTone: f > 3.5 ? 't-info' : 't-success',
      vaultO: vaultO.toFixed(3), vaultDy: ((1 - vaultO) * 24).toFixed(1), ltvW: (46.88 * vaultO).toFixed(2) + '%',
      redO: redO.toFixed(3), redDy: ((1 - redO) * 24).toFixed(1),
      footO: (1 - heroO * 0.4).toFixed(2), chapLabel: String(ci).padStart(2, '0') + ' / 06',
      go1: () => this.goTo(1),
      custodyNum: m.custodyNum, valueUsd: m.value, lotsNum: m.lots, vaultNum: m.vault, figuresNote: m.note
    };
  }
}

class LandingView extends LandingLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-atmos" style={{ minHeight: "100%", color: "var(--text)", fontFamily: "var(--sans)", overflowX: "clip" }}>
        <header style={{ position: "sticky", top: "0", zIndex: "20", height: "0" }}>
          <div style={{ maxWidth: "1376px", margin: "0 auto", padding: "18px 32px 0", boxSizing: "border-box" }}>
            <nav aria-label="Site" className="lp-glass" style={{ height: "56px", display: "flex", alignItems: "center", gap: "8px", padding: "0 8px 0 20px", borderRadius: "999px" }}>
              <a href="#top" className="t-row" style={{ gap: "12px", color: "var(--brand-ice)", marginRight: "auto" }}>
                <img src="/design-assets/f7ab157752a5014c52926e68ee69f6c6.png" alt="" style={{ width: "26px", height: "25px", filter: "drop-shadow(0 0 10px rgba(215,252,253,.4))" }} />
                <span className="t-wordmark" style={{ fontSize: "14px" }}>
                  TENSILE
                </span>
              </a>
              {" "}
              <a href="#protocol" className="lp-navlink">
                Protocol
              </a>
              {" "}
              <a href="#owners" className="lp-navlink">
                Material owners
              </a>
              {" "}
              <a href="#owners" className="lp-navlink">
                Lenders
              </a>
              {" "}
              <a href="#owners" className="lp-navlink">
                Operators
              </a>
              {" "}
              <a href="#protocol" className="lp-navlink">
                Documentation
              </a>
              {" "}
              <a href="/overview" className="t-btn t-btn-primary" style={{ marginLeft: "8px" }}>
                Launch app
              </a>
            </nav>
          </div>
        </header>
        <section id="top" ref={$v.trackRef} style={{ position: "relative", height: "6300px" }}>
          <div style={{ position: "sticky", top: "0", height: "900px", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: "50%", top: "0", width: "1440px", height: "900px", marginLeft: "-720px" }}>
              <div style={{ position: "absolute", left: `${$v.glowX ?? ''}px`, top: `${$v.glowY ?? ''}px`, width: `${$v.glowS ?? ''}px`, height: `${$v.glowS ?? ''}px`, borderRadius: "999px", background: `radial-gradient(circle, rgba(80,200,200,${$v.glowA ?? ''}) 0%, rgba(30,120,130,.10) 42%, transparent 68%)`, filter: "blur(14px)", pointerEvents: "none" }} />
              <svg viewBox="0 0 1440 900" width="1440" height="900" style={{ position: "absolute", inset: "0", overflow: "visible" }} aria-hidden="true">
                <defs>
                  <radialGradient id="lpFill" cx="36%" cy="30%" r="78%">
                    <stop offset="0%" stopColor="#d7fcfd" stopOpacity=".15" />
                    <stop offset="34%" stopColor="#2a8a8a" stopOpacity=".14" />
                    <stop offset="72%" stopColor="#06302f" stopOpacity=".55" />
                    <stop offset="100%" stopColor="#011616" stopOpacity=".88" />
                  </radialGradient>
                  <radialGradient id="lpRim" cx="50%" cy="50%" r="50%">
                    <stop offset="84%" stopColor="#d7fcfd" stopOpacity="0" />
                    <stop offset="97%" stopColor="#bff0ef" stopOpacity=".14" />
                    <stop offset="100%" stopColor="#d7fcfd" stopOpacity=".26" />
                  </radialGradient>
                  <linearGradient id="lpSpec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity=".2" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {($v.chipLines ?? []).map((c, $i0) => (
                  <Fragment key={$i0}>
                    <line x1={c?.x1} y1={c?.y1} x2={c?.x2} y2={c?.y2} stroke="#d7fcfd" strokeOpacity={c?.o} strokeWidth="1" strokeDasharray="2 4" />
                  </Fragment>
                ))}
                <circle cx={$v.cx} cy={$v.cy} r={$v.R} fill="url(#lpFill)" />
                <path d={$v.back} fill="none" stroke="#d7fcfd" strokeOpacity=".06" strokeWidth="1" />
                <path d={$v.front} fill="none" stroke="#d7fcfd" strokeOpacity=".28" strokeWidth="1.2" strokeLinecap="round" />
                {($v.nodes ?? []).map((n, $i0) => (
                  <Fragment key={$i0}>
                    <circle cx={n?.x} cy={n?.y} r="2.6" fill="#d7fcfd" fillOpacity={n?.o} />
                  </Fragment>
                ))}
                <circle cx={$v.cx} cy={$v.cy} r={$v.R} fill="url(#lpRim)" />
                <circle cx={$v.cx} cy={$v.cy} r={$v.R} fill="none" stroke="#d7fcfd" strokeOpacity=".15" strokeWidth="1" />
                <ellipse cx={$v.specX} cy={$v.specY} rx={$v.specRx} ry={$v.specRy} fill="url(#lpSpec)" transform={$v.specT} />
                {($v.arcs ?? []).map((a, $i0) => (
                  <Fragment key={$i0}>
                    <path d={a?.d} fill="none" stroke="#d7fcfd" strokeOpacity={a?.o} strokeWidth="1.2" className="lp-flow" />
                  </Fragment>
                ))}
                {($v.rings ?? []).map((r, $i0) => (
                  <Fragment key={$i0}>
                    <circle cx={r?.x} cy={r?.y} r={r?.r} fill="none" stroke="#d7fcfd" strokeOpacity={r?.o} strokeWidth="1" strokeDasharray={r?.dash} />
                  </Fragment>
                ))}
                {($v.links ?? []).map((l, $i0) => (
                  <Fragment key={$i0}>
                    <path d={l?.d} fill="none" stroke="#d7fcfd" strokeOpacity={l?.o} strokeWidth="1.4" className={l?.cls} />
                  </Fragment>
                ))}
                {($v.pts ?? []).map((p, $i0) => (
                  <Fragment key={$i0}>
                    <circle cx={p?.x} cy={p?.y} r={p?.hr} fill={p?.c} className="lp-halo" style={{ animationDelay: p?.delay }} />
                    <circle cx={p?.x} cy={p?.y} r={p?.r} fill={p?.c} fillOpacity={p?.o} />
                    <text x={p?.lx} y={p?.ly} fill="#d7fcfd" fillOpacity={p?.lo} fontSize="11" fontFamily="IBM Plex Mono, monospace" letterSpacing=".08em">
                      <span className="sc-interp">{p?.short}</span>
                    </text>
                  </Fragment>
                ))}
              </svg>
              {" "}
              {($v.chips ?? []).map((c, $i0) => (
                <Fragment key={$i0}>
                  <div className="lp-glass lp-chip" style={{ left: `${c?.x ?? ''}px`, top: `${c?.y ?? ''}px`, opacity: c?.o, transform: `translate(-50%, -50%) translateY(${c?.dy ?? ''}px)` }}>
                    <span className="t-mono-sm" style={{ color: "var(--steel)", letterSpacing: ".14em", fontSize: "10px" }}>
                      <span className="sc-interp">{c?.k}</span>
                    </span>
                    {" "}
                    <span className="t-sm" style={{ fontWeight: "500" }}>
                      <span className="sc-interp">{c?.v}</span>
                    </span>
                  </div>
                </Fragment>
              ))}
              {" "}
              {($v.vlabels ?? []).map((v, $i0) => (
                <Fragment key={$i0}>
                  <div className="lp-glass" style={{ position: "absolute", left: `${v?.x ?? ''}px`, top: `${v?.y ?? ''}px`, opacity: v?.o, transform: `translate(-50%, -50%) scale(${v?.s ?? ''})`, padding: "6px 12px", borderRadius: "999px", whiteSpace: "nowrap", pointerEvents: "none" }}>
                    <span className="t-row" style={{ gap: "7px" }}>
                      <span className="t-dot" style={{ color: "var(--success)" }} />
                      <span className="t-sm" style={{ fontWeight: "500" }}>
                        <span className="sc-interp">{v?.t}</span>
                      </span>
                    </span>
                  </div>
                </Fragment>
              ))}
              <article className="t-plate" style={{ position: "absolute", left: "1060px", top: "230px", width: "320px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", opacity: $v.passO, transform: `translateY(${$v.passDy ?? ''}px) scale(${$v.passS ?? ''})`, filter: `blur(${$v.passB ?? ''}px)`, pointerEvents: "none" }}>
                <span className="t-reg t-reg-tl" />
                <span className="t-reg t-reg-br" />
                <div className="t-between">
                  <span className="t-eyebrow" style={{ color: "var(--steel)", fontSize: "10px" }}>
                    Material passport
                  </span>
                  <span className={`t-badge ${$v.passTone ?? ''}`}>
                    <span className="t-dot" />
                    <span className="sc-interp">{$v.passState}</span>
                  </span>
                </div>
                <div className="t-stack" style={{ gap: "2px" }}>
                  <span className="t-mono" style={{ color: "var(--steel)" }}>
                    TNS-CU-00418
                  </span>
                  <span className="t-h3">
                    Copper cathode, Grade A
                  </span>
                  <span className="t-num-lg t-lum" style={{ animation: "none" }}>
                    30.000
                    <span className="t-u">
                      t
                    </span>
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
                  <div className="t-spec">
                    <span className="t-spec-k">
                      Warehouse
                    </span>
                    <span className="t-spec-v" style={{ fontSize: "13px" }}>
                      Rotterdam Botlek 04
                    </span>
                  </div>
                  <div className="t-spec">
                    <span className="t-spec-k">
                      Owner
                    </span>
                    <span className="t-spec-v" style={{ fontSize: "13px" }}>
                      Halden Metals Ltd
                    </span>
                  </div>
                  <div className="t-spec">
                    <span className="t-spec-k">
                      Inspected
                    </span>
                    <span className="t-spec-v" style={{ fontSize: "13px" }}>
                      Seals intact
                    </span>
                  </div>
                  <div className="t-spec">
                    <span className="t-spec-k">
                      Reserve
                    </span>
                    <span className="t-spec-v" style={{ fontSize: "13px" }}>
                      111.11%
                    </span>
                  </div>
                </div>
              </article>
              <div className="lp-glass" style={{ position: "absolute", left: "1060px", top: "610px", width: "320px", padding: "18px 20px", borderRadius: "20px", display: "flex", flexDirection: "column", gap: "10px", opacity: $v.vaultO, transform: `translateY(${$v.vaultDy ?? ''}px)`, pointerEvents: "none" }}>
                <div className="t-between">
                  <span className="t-eyebrow" style={{ fontSize: "10px" }}>
                    Credit vault · LN-2291
                  </span>
                  <span className="t-badge t-info">
                    PLEDGED
                  </span>
                </div>
                <span className="t-num-lg t-lum" style={{ animation: "none" }}>
                  140,000
                  <span className="t-f">
                    .00
                  </span>
                  <span className="t-u">
                    USDC
                  </span>
                </span>
                <div className="t-meter" style={{ height: "8px" }}>
                  <div className="t-meter-fill" style={{ width: $v.ltvW, animation: "none", background: "linear-gradient(90deg, rgba(141,185,242,.55), #8db9f2)", boxShadow: "0 0 14px -2px rgba(141,185,242,.6)" }} />
                  <span className="t-mark t-mark-warn" style={{ left: "65%" }} />
                </div>
                <span className="t-cap">
                  LTV 46.88% · max 65% · the metal stays in custody
                </span>
              </div>
              {($v.listings ?? []).map((l, $i0) => (
                <Fragment key={$i0}>
                  <div className="lp-glass" style={{ position: "absolute", left: `${l?.x ?? ''}px`, top: `${l?.y ?? ''}px`, opacity: l?.o, transform: "translate(-50%, -100%)", padding: "8px 14px", borderRadius: "14px", whiteSpace: "nowrap", pointerEvents: "none" }}>
                    <div className="t-mono-sm" style={{ color: "var(--steel)" }}>
                      <span className="sc-interp">{l?.id}</span>
                    </div>
                    <div className="t-row" style={{ gap: "8px" }}>
                      <span className="t-sm" style={{ fontWeight: "500" }}>
                        <span className="sc-interp">{l?.v}</span>
                      </span>
                      <span className={`t-badge ${l?.tone ?? ''}`}>
                        <span className="sc-interp">{l?.st}</span>
                      </span>
                    </div>
                  </div>
                </Fragment>
              ))}
              <div className="lp-glass" style={{ position: "absolute", left: "1080px", top: "300px", width: "300px", padding: "20px", borderRadius: "22px", display: "flex", flexDirection: "column", gap: "12px", opacity: $v.redO, transform: `translateY(${$v.redDy ?? ''}px)`, pointerEvents: "none" }}>
                <div className="t-between">
                  <span className="t-eyebrow" style={{ fontSize: "10px" }}>
                    Redemption · RD-0101
                  </span>
                  <span className="t-badge t-success">
                    RELEASED
                  </span>
                </div>
                <div className="t-stack" style={{ gap: "4px" }}>
                  <div className="t-row t-sm" style={{ gap: "8px" }}>
                    <span className="t-badge t-burned">
                      BURNED
                    </span>
                    <span className="t-mono t-muted" style={{ textDecoration: "line-through" }}>
                      TNS-NI-00091
                    </span>
                  </div>
                  <span className="t-h4">
                    12.008 t nickel released
                  </span>
                  {" "}
                  <span className="t-cap">
                    Singapore Jurong 01 → Pasir Freight Services. Full history retained on the ledger.
                  </span>
                </div>
              </div>
              {($v.chapters ?? []).map((c, $i0) => (
                <Fragment key={$i0}>
                  <div style={{ position: "absolute", left: "96px", top: `${c?.top ?? ''}px`, width: `${c?.w ?? ''}px`, opacity: c?.o, transform: `translateY(${c?.dy ?? ''}px)`, filter: `blur(${c?.b ?? ''}px)`, pointerEvents: c?.pe, display: "flex", flexDirection: "column", gap: "20px" }}>
                    <span className="t-eyebrow" style={{ color: "var(--brand-text)" }}>
                      <span className="sc-interp">{c?.e}</span>
                    </span>
                    <h2 style={{ margin: "0", fontSize: `${c?.fs ?? ''}px`, lineHeight: "1.04", fontWeight: "400", letterSpacing: "-.028em", color: "#f2ffff" }}>
                      <span className="sc-interp">{c?.h}</span>
                    </h2>
                    <p className="t-lead" style={{ maxWidth: "460px" }}>
                      <span className="sc-interp">{c?.p}</span>
                    </p>
                    {c?.hasM ? (
                      <>
                        <div className="t-metrics" style={{ gridTemplateColumns: "repeat(2, auto)", justifyContent: "start", paddingTop: "8px" }}>
                          {(c?.m ?? []).map((m, $i1) => (
                            <Fragment key={$i1}>
                              <div className="t-metric">
                                <span className="t-num-lg t-lum" style={{ animation: "none" }}>
                                  <span className="sc-interp">{m?.v}</span>
                                </span>
                                <span className="t-cap">
                                  <span className="sc-interp">{m?.k}</span>
                                </span>
                              </div>
                            </Fragment>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {" "}
                    {c?.hero ? (
                      <>
                        <div className="t-row" style={{ gap: "16px", paddingTop: "8px" }}>
                          <a href="#close" className="t-btn t-btn-primary t-btn-lg">
                            Request access
                          </a>
                          <button className="t-btn t-btn-ghost" onClick={$v.go1}>
                            {"See how it works "}
                            <span className="lp-cue" style={{ display: "inline-block" }}>
                              ↓
                            </span>
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </Fragment>
              ))}
              <nav aria-label="Story" style={{ position: "absolute", right: "40px", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                {($v.rail ?? []).map((r, $i0) => (
                  <Fragment key={$i0}>
                    <button className="lp-dot" aria-current={r?.cur} aria-label={r?.label} onClick={r?.go}>
                      <em style={{ fontStyle: "normal", opacity: r?.lo }}>
                        <span className="sc-interp">{r?.label}</span>
                      </em>
                      <span />
                    </button>
                  </Fragment>
                ))}
              </nav>
              <div style={{ position: "absolute", left: "96px", bottom: "40px", right: "96px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: $v.footO }}>
                <span className="t-mono-sm t-muted" style={{ letterSpacing: ".16em" }}>
                  PHYSICAL → VERIFIED → DIGITAL → FINANCEABLE → LIQUID
                </span>
                {" "}
                <span className="t-mono-sm t-muted">
                  <span className="sc-interp">{$v.chapLabel}</span>
                </span>
              </div>
            </div>
          </div>
        </section>
        <section id="close" style={{ position: "relative", padding: "160px 32px 120px" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "72px" }}>
            <div className="t-stack" style={{ gap: "24px", maxWidth: "820px" }}>
              <span className="t-eyebrow" style={{ color: "var(--brand-text)" }}>
                Tensile protocol
              </span>
              <h2 style={{ margin: "0", fontSize: "88px", lineHeight: ".98", fontWeight: "400", letterSpacing: "-.035em", color: "#f2ffff" }}>
                Real assets.
                <br />
                Real liquidity.
              </h2>
              <p className="t-lead" style={{ maxWidth: "560px" }}>
                An infrastructure layer that lets physical industrial material be verified, owned, financed, traded and redeemed — with the warehouse floor and the ledger always in agreement.
              </p>
              <div className="t-row" style={{ gap: "16px" }}>
                <a href="/onboarding" className="t-btn t-btn-primary t-btn-lg">
                  Request access
                </a>
                <a href="/overview" className="t-btn t-btn-secondary t-btn-lg">
                  Launch app
                </a>
                <a href="#protocol" className="t-btn t-btn-ghost">
                  Read the protocol
                </a>
              </div>
            </div>
            <div id="protocol" className="t-metrics" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
              <div className="t-metric">
                <span className="t-num-xl t-lum">
                  {$v.custodyNum}
                  <span className="t-u">
                    t
                  </span>
                </span>
                <span className="t-cap">
                  Metal in bonded custody
                </span>
              </div>
              <div className="t-metric">
                <span className="t-num-xl t-lum">
                  {$v.valueUsd}
                </span>
                <span className="t-cap">
                  Material value represented
                </span>
              </div>
              <div className="t-metric">
                <span className="t-num-xl t-lum">
                  {$v.lotsNum}
                </span>
                <span className="t-cap">
                  Active material lots
                </span>
              </div>
              <div className="t-metric">
                <span className="t-num-xl t-lum">
                  {$v.vaultNum}
                </span>
                <span className="t-cap">
                  USDC in the credit vault
                </span>
              </div>
            </div>
            <div id="owners" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "48px", paddingTop: "24px" }}>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-mono-sm" style={{ color: "var(--steel)" }}>
                  MATERIAL OWNERS
                </span>
                <span className="t-body t-sec">
                  Turn metal in custody into a passport you can borrow against, sell or redeem.
                </span>
              </div>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-mono-sm" style={{ color: "var(--steel)" }}>
                  LENDERS
                </span>
                <span className="t-body t-sec">
                  Earn yield from loans each secured by one inspected, isolated lot.
                </span>
              </div>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-mono-sm" style={{ color: "var(--steel)" }}>
                  TRADERS
                </span>
                <span className="t-body t-sec">
                  Buy verified lots and settle in one transaction, liens included.
                </span>
              </div>
              <div className="t-stack" style={{ gap: "8px" }}>
                <span className="t-mono-sm" style={{ color: "var(--steel)" }}>
                  OPERATORS
                </span>
                <span className="t-body t-sec">
                  Warehouses and inspectors attest to custody, reserves and release.
                </span>
              </div>
            </div>
          </div>
        </section>
        <footer style={{ padding: "32px", maxWidth: "1264px", margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
          <div className="t-row" style={{ gap: "12px" }}>
            <img src="/design-assets/f7ab157752a5014c52926e68ee69f6c6.png" alt="" style={{ width: "22px", height: "21px" }} />
            <span className="t-wordmark" style={{ fontSize: "12px" }}>
              TENSILE
            </span>
          </div>
          <span className="t-cap">
            {$v.figuresNote} Tensile lots represent physical material held in bonded custody; yields are variable and not guaranteed.
          </span>
        </footer>
      </div>
    );
  }
}

/** Landing page with live figures for the selected chain. */
export default function Landing() {
  const { chain } = useSession();
  const stats = useProtocolStats();
  const warehouses = useWarehouses();
  return <LandingView stats={stats.data} warehouses={warehouses.data?.warehouses} chainName={chain.name} failed={stats.isError} />;
}
