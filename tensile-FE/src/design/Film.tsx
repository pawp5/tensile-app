// @ts-nocheck
/* Generated from Film.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
import { Fragment } from 'react';
import { DCLogic, css } from './runtime';
import Borrow from './Borrow';
import Lend from './Lend';
import LotPassport from './LotPassport';
import Marketplace from './Marketplace';
import Redemption from './Redemption';
import ReserveHealth from './ReserveHealth';
import './Film.css';

class FilmLogic extends DCLogic {
  state = { t: 0, playing: false, captions: true };
  DUR = 92;
  WH = [
    { code: 'RTM-BOT-04', short: 'ROTTERDAM', lat: 51.88, lon: 4.31, h: 'ok' },
    { code: 'ANR-DEL-03', short: 'ANTWERP', lat: 51.22, lon: 4.40, h: 'ok' },
    { code: 'SIN-JUR-01', short: 'SINGAPORE', lat: 1.33, lon: 103.70, h: 'ok' },
    { code: 'PKL-WST-02', short: 'PORT KLANG', lat: 3.00, lon: 101.39, h: 'breach' },
    { code: 'HOU-SHP-05', short: 'HOUSTON', lat: 29.73, lon: -95.27, h: 'ok' },
    { code: 'DUR-BAY-01', short: 'DURBAN', lat: -29.88, lon: 31.03, h: 'stale' }
  ];
  // globe camera keyframes: [time, cx, cy, R, lon, lat, opacity]
  K = [
    [0, 960, 560, 380, -40, 18, 0], [2.5, 960, 560, 380, -26, 18, 1], [8, 960, 540, 380, -2, 22, 1],
    [12.5, 960, 520, 330, 8, 32, 0.55], [15.6, 960, 520, 340, 4, 46, 1], [17.4, 960, 560, 1500, 4, 52, 0],
    [26.8, 1770, 150, 84, -10, 40, 0], [28.2, 1770, 150, 84, -10, 40, 0.9], [66.4, 1770, 150, 84, -10, 40, 0.9],
    [67.8, 600, 560, 360, 6, 38, 1], [69.2, 600, 560, 360, 10, 36, 1], [69.8, 600, 560, 360, 10, 36, 0],
    [70.8, 1770, 150, 84, 60, 25, 0], [71.6, 1770, 150, 84, 70, 22, 0.9], [75.6, 1770, 150, 84, 95, 12, 0.9],
    [77.0, 1770, 150, 84, 20, 40, 0.9], [80.6, 1770, 150, 84, 0, 44, 0.9], [82.2, 860, 540, 360, 0, 46, 1],
    [84.2, 960, 500, 330, 10, 38, 1], [92, 960, 450, 300, 36, 28, 1]
  ];
  CAPS = [
    [1.0, 4.4, 'The world’s industrial metal sits in warehouses.'],
    [4.4, 8.3, 'Proving what it is, and who owns it, is hard.'],
    [9.8, 15.4, 'Tensile connects that physical material to digital ownership — and to liquidity.'],
    [17.4, 21.0, 'It starts with thirty tonnes of copper in Rotterdam.'],
    [21.4, 26.4, 'Its evidence is reviewed, inspected, held in custody, and checked against reserves.'],
    [27.5, 30.0, 'The result is a material passport.'],
    [31.4, 38.8, 'A verified record of a real asset: what it is, where it sits, and who owns it.'],
    [39.6, 42.0, 'Owners can borrow against it.'],
    [44.2, 49.0, 'The lot becomes collateral and USDC arrives. The metal never moves.'],
    [49.6, 52.8, 'That credit comes from lenders.'],
    [53.4, 57.2, 'Their capital funds loans backed by specific, inspected lots.'],
    [57.8, 60.6, 'Lots can be sold, even while pledged.'],
    [62.0, 66.6, 'One settlement repays the loan, pays the seller, and transfers ownership.'],
    [67.8, 71.0, 'Tensile also watches the metal itself.'],
    [71.6, 76.2, 'If a reserve falls short, the warehouse is frozen until reconciled.'],
    [76.8, 79.6, 'And every lot can return to metal.'],
    [80.2, 83.6, 'The warehouse releases it. The record remains.'],
    [87.0, 89.8, 'Tensile. Real assets. Real liquidity.']
  ];
  SCENES = [[0, 'The physical world'], [8, 'Tensile'], [16, 'Verify'], [27, 'Passport'], [39, 'Borrow'], [49, 'Lend'], [57, 'Trade'], [67, 'Reserve health'], [76, 'Redeem'], [84, 'Close']];
  componentDidMount() {
    const at = Number(this.props.at ?? 0);
    this.tNow = at;
    this.setState({ t: at, playing: this.props.autoplay ?? true });
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (this.state.playing) {
        this.tNow += dt;
        if (this.tNow >= this.DUR) { this.tNow = this.DUR; this.setState({ t: this.DUR, playing: false }); }
        else if (!this.acc || now - this.acc > 30) { this.acc = now; this.setState({ t: this.tNow }); }
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  componentWillUnmount() { cancelAnimationFrame(this.raf); }
  renderVals() {
    const t = this.state.t;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const ease = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    const P = (a, b) => ease((t - a) / (b - a));
    const W = (a, b, fi, fo) => Math.min(P(a, a + (fi ?? 0.7)), 1 - P(b - (fo ?? 0.7), b));
    const on = (a, b) => t >= a && t <= b;
    const f2 = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const px = (n) => n.toFixed(1);

    // ---------- globe ----------
    const K = this.K;
    let k = 0; while (k < K.length - 2 && t > K[k + 1][0]) k++;
    const A = K[k], B = K[k + 1];
    const u = ease((t - A[0]) / Math.max(0.001, B[0] - A[0]));
    const L = (i) => A[i] + (B[i] - A[i]) * u;
    const gx = L(1), gy = L(2), gR = L(3), lon0 = L(4) + Math.sin(t / 6) * 0.8, lat0 = L(5);
    // the globe yields to the real screens
    const shotWin = [[27, 30.6], [39, 42.2], [49, 51.6], [57, 60], [69.4, 71.8], [76, 78.6]];
    const shotO = Math.max(...shotWin.map(([a, b]) => W(a, b, 0.6, 0.8)));
    const gOp = L(6) * (1 - shotO);
    const rad = Math.PI / 180, lam0 = lon0 * rad, ph0 = lat0 * rad;
    const PR = (lat, lon) => { const la = lat * rad, lo = lon * rad - lam0; const z = Math.sin(ph0) * Math.sin(la) + Math.cos(ph0) * Math.cos(la) * Math.cos(lo); return { x: gx + gR * Math.cos(la) * Math.sin(lo), y: gy - gR * (Math.cos(ph0) * Math.sin(la) - Math.sin(ph0) * Math.cos(la) * Math.cos(lo)), z }; };
    let gFront = '', gBack = '';
    const trace = (pts) => { let prev = null; pts.forEach((q) => { const vis = q.z > 0; const s = ((prev === null || prev !== vis) ? 'M' : 'L') + px(q.x) + ' ' + px(q.y); if (vis) gFront += s; else gBack += s; prev = vis; }); };
    if (gOp > 0.01) {
      for (let lo = -180; lo < 180; lo += 20) { const a = []; for (let la = -84; la <= 84; la += 6) a.push(PR(la, lo)); trace(a); }
      [-60, -40, -20, 0, 20, 40, 60].forEach((la) => { const a = []; for (let lo = -180; lo <= 180; lo += 5) a.push(PR(la, lo)); trace(a); });
    }
    const gNodes = [];
    if (gOp > 0.01) [-20, 20].forEach((la) => { for (let lo = -180; lo < 180; lo += 60) { const q = PR(la, lo); if (q.z > 0.2) gNodes.push({ x: px(q.x), y: px(q.y), o: (0.12 + q.z * 0.3).toFixed(2) }); } });
    const big = gR > 200;
    const reserveMode = on(67, 76.2);
    const focusRTM = on(13, 17.6) || on(27, 67) || on(67, 70) || on(76, 85);
    const tone = { ok: '#d7fcfd', stale: '#f0b860', breach: '#ff8b7b' };
    const proj = {};
    const gPts = this.WH.map((w, i) => {
      const q = PR(w.lat, w.lon); proj[w.code] = q;
      const appear = P(1.4 + i * 0.6, 2.2 + i * 0.6);
      const isF = focusRTM && w.code === 'RTM-BOT-04';
      const vis = q.z > 0 ? 1 : 0.1;
      const o = appear * vis * (focusRTM && !isF ? 0.45 : 1);
      const c = reserveMode ? tone[w.h] : '#d7fcfd';
      const showLab = big && q.z > 0.1 && (on(1.5, 12.5) || isF || (reserveMode && w.h !== 'ok'));
      return { x: px(q.x), y: px(q.y), r: big ? (isF ? 6 : 4) : (isF ? 3.6 : 2), hr: q.z > 0 ? (big ? (isF ? 22 : 11 * appear) : (isF ? 9 : 0)) : 0, o: o.toFixed(2), c, delay: (i * 0.5) + 's',
        label: w.short, lx: px(q.x + 12), ly: px(q.y - 12), lo: (showLab ? appear * (isF ? 0.95 : 0.6) : 0).toFixed(2), fs: isF ? 14 : 12 };
    });
    const pairs = [['RTM-BOT-04', 'SIN-JUR-01'], ['ANR-DEL-03', 'HOU-SHP-05'], ['RTM-BOT-04', 'DUR-BAY-01'], ['SIN-JUR-01', 'DUR-BAY-01']];
    const arcO = Math.max(W(3, 13, 1.4, 1.2) * 0.32, W(85, 92.5, 2, 0.1) * 0.2);
    const gArcs = arcO > 0.01 ? pairs.map(([a, b]) => { const p = proj[a], q = proj[b]; if (!(p.z > 0 && q.z > 0)) return null; const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2; const c = { x: mx + (mx - gx) * 0.45, y: my + (my - gy) * 0.45 - 30 }; return { d: 'M' + px(p.x) + ' ' + px(p.y) + ' Q' + px(c.x) + ' ' + px(c.y) + ' ' + px(q.x) + ' ' + px(q.y), o: arcO.toFixed(2) }; }).filter(Boolean) : [];
    // redemption: line runs from the retired passport back to the warehouse
    const gLinks = [];
    const linkO = W(81.6, 85.2, 0.8, 1.2);
    const R0 = proj['RTM-BOT-04'];
    if (linkO > 0.01 && R0 && R0.z > 0) { const ax = 1440, ay = 520; gLinks.push({ d: 'M' + ax + ' ' + ay + ' Q' + px((ax + R0.x) / 2) + ' ' + px(Math.min(ay, R0.y) - 90) + ' ' + px(R0.x) + ' ' + px(R0.y), o: (linkO * 0.9).toFixed(2) }); }

    // ---------- scene 1 ----------
    const qs = [['What is it?', 330, 330], ['Where is it?', 1380, 280], ['Who owns it?', 1330, 760]].map(([q, x, y], i) => { const o = W(4.4 + i * 0.5, 8.4, 0.8, 0.8); return { t: q, x, y, o: o.toFixed(2), dy: px((1 - o) * 14), b: px((1 - o) * 6) }; });

    // ---------- scene 2 ----------
    const logoO = W(8.2, 12.2, 1.2, 1.0);
    const spineO = W(11.6, 16.2, 0.9, 0.7);
    const spine = ['Physical material', 'Verified', 'Digital', 'Liquid'].map((x, i, a) => ({ t: x, o: P(11.6 + i * 0.45, 12.4 + i * 0.45).toFixed(2), arrow: i < a.length - 1 }));

    // ---------- scene 3 ----------
    const s3o = W(16.8, 27.6, 0.9, 0.8);
    const stepIdx = Math.floor((t - 17.6) / 1.25);
    const SL = ['Material details', 'Evidence', 'Automated review', 'Inspection', 'Warehouse custody', 'Reserve confirmation', 'Mint passport'];
    const steps = SL.map((l, i) => ({ l, n: String(i + 1).padStart(2, '0'), cls: i < stepIdx ? 't-step-done' : (i === stepIdx ? 't-step-current' : '') }));
    const LG = [
      ['Material', 'Copper cathode, Grade A · CU-CATH-A · 30.000 t · Rotterdam Botlek 04', 'RECORDED', 't-success'],
      ['Evidence', 'Certificate COA-RTM-2026-077310 · warehouse receipt · weighbridge · photographs', 'PINNED', 't-success'],
      ['Automated review', 'Score 92 / 100 · threshold 80 · advisory', 'PASSED', 't-success'],
      ['Inspection', 'Meridian Survey BV · 30.006 t measured · 12 bundles sealed', 'ATTESTED', 't-success'],
      ['Custody', 'Portline Warehousing · receipt PWR-26-0044120 · Hall C, bay 14', 'CONFIRMED', 't-success'],
      ['Reserve', 'Warehouse reserve covers the lot · coverage after mint 108.40%', 'HEALTHY', 't-success'],
      ['Passport', 'TNS-CU-00418 issued to Halden Metals Ltd', 'FINALIZED', 't-brand']
    ];
    const ledger = LG.map(([kk, v, s, tn], i) => { const o = P(17.9 + i * 1.25, 18.6 + i * 1.25); return { k: kk, v, s, tone: tn, o: o.toFixed(2), dx: px((1 - o) * -16) }; });

    // ---------- shots ----------
    const shotFor = (a, b, y0, y1) => { const o = W(a, b, 0.6, 0.8); const p = clamp((t - a) / (b - a), 0, 1); return { o: o.toFixed(3), b: px((1 - o) * 10), s: (1 + p * 0.05).toFixed(4), y: px(y0 + (y1 - y0) * ease(p)) }; };
    let shot = { o: 0, b: 0, s: 1, y: 0 };
    const rLot = on(27, 30.8), rBorrow = on(39, 42.4), rLend = on(49, 51.8), rMarket = on(57, 60.2), rReserve = on(69.4, 72), rRedeem = on(76, 78.8);
    if (rLot) shot = shotFor(27, 30.6, 0, -120);
    if (rBorrow) shot = shotFor(39, 42.2, 0, -60);
    if (rLend) shot = shotFor(49, 51.6, 0, -40);
    if (rMarket) shot = shotFor(57, 60, 0, -60);
    if (rReserve) shot = shotFor(69.4, 71.8, 0, -40);
    if (rRedeem) shot = shotFor(76, 78.6, 0, -40);

    // ---------- scene 4 · passport ----------
    const s4o = W(30.0, 39.6, 0.9, 0.8);
    const foci = [[30.9, 32.6, [0, 1]], [32.6, 34.4, [2]], [34.4, 35.9, [3]], [35.9, 37.4, [4]], [37.4, 39.6, [5]]];
    const fNames = ['Material identity and location', 'Certificates and attestations', 'Reserve coverage', 'Ownership and encumbrance', 'Financial valuation'];
    let fi = -1; foci.forEach(([a, b], i) => { if (on(a, b)) fi = i; });
    const focusSet = fi >= 0 ? foci[fi][2] : [];
    const pledgedNow = t > 45.4;
    const RG = [
      ['Material identity', [['Material', 'Copper cathode'], ['Grade / class', 'Grade A · Cu 99.9941%'], ['Quantity', '30.000 t net · 12 bundles']]],
      ['Location and custody', [['Warehouse', 'Rotterdam Botlek 04'], ['Operator', 'Portline Warehousing'], ['Position', 'Hall C · bay 14 · row 3']]],
      ['Attestations', [['Certificate', 'VERIFIED', '#7fe0b0'], ['Inspection · reinspection', 'ATTESTED', '#7fe0b0'], ['Custody evidence', 'CONFIRMED', '#7fe0b0']]],
      ['Reserve coverage', [['Coverage', '111.11%', '#7fe0b0'], ['Reserve · tokenized', '500,000 · 450,000 kg']], true],
      ['Ownership and encumbrance', [['Owner', 'Halden Metals Ltd'], ['Lien', 'FREE · no debt', '#7fe0b0'], ['Transfers', 'Through the marketplace']]],
      ['Financial valuation', [['Indicative value', '$300,000.00'], ['Price per tonne', '$10,000.00'], ['Max borrowing', '195,000.00 USDC · 65%']]]
    ];
    const regions = RG.map(([kk, rows, meter], i) => { const f = focusSet.includes(i); const dim = fi >= 0 && !f; return { k: kk, meter: !!meter, rows: rows.map(([a, b, c]) => ({ a, b, c: c || 'var(--text)' })), o: dim ? '0.32' : '1', bg: f ? 'linear-gradient(180deg, rgba(215,252,253,.10), rgba(215,252,253,.03))' : 'rgba(1,22,22,.35)', sh: f ? 'inset 0 1px 0 rgba(240,255,255,.18), inset 0 0 0 1px rgba(215,252,253,.16), 0 20px 50px -24px rgba(120,230,230,.5)' : 'inset 0 0 0 1px rgba(215,252,253,.04)' }; });
    const centers = [[500, 640], [960, 640], [1420, 640], [500, 860], [960, 860], [1420, 860]];
    let camX = 0, camY = 0, camS = 1;
    if (focusSet.length) { const cx = focusSet.reduce((s, i) => s + centers[i][0], 0) / focusSet.length; const cy = focusSet.reduce((s, i) => s + centers[i][1], 0) / focusSet.length; const p = P(foci[fi][0], foci[fi][0] + 0.9); camX = (960 - cx) * 0.16 * p; camY = (560 - cy) * 0.22 * p; camS = 1 + 0.05 * p; }
    if (this._cam && fi >= 0) { camX = this._cam[0] + (camX - this._cam[0]) * 0.35; camY = this._cam[1] + (camY - this._cam[1]) * 0.35; camS = this._cam[2] + (camS - this._cam[2]) * 0.35; }
    this._cam = [camX, camY, camS];
    const s4in = P(30, 30.9);

    // ---------- scene 5 · borrow ----------
    const s5o = W(41.6, 49.6, 0.8, 0.8);
    const amtP = P(42.4, 44.0);
    const amt = 140000 * amtP;
    const chain5 = [
      ['Material lot', 'TNS-CU-00418', '30.000 t copper · Rotterdam', 41.6],
      ['Collateral', pledgedNow ? 'PLEDGED' : 'Ready to pledge', 'Lien recorded on the passport', 44.6],
      ['Credit vault', '140,000.00 USDC', 'Supplied against this lot', 45.8],
      ['USDC received', '139,300.00', 'To 0x7a3f…c91e after the 0.50% fee', 47.0]
    ].map(([kk, v, d, at], i, a) => ({ k: kk, v, d, cls: t >= at ? 'fm-on' : 'fm-off', arrow: i < a.length - 1, fill: (P(at, a[Math.min(i + 1, a.length - 1)][3]) * 100).toFixed(1) + '%' }));
    const txStep = t < 44.6 ? 0 : t < 45.8 ? 1 : t < 47.0 ? 2 : 3;
    const s5dy = (1 - P(41.6, 42.5)) * 20;

    // ---------- scene 6 · lend ----------
    const s6o = W(51.0, 57.6, 0.8, 0.8);
    const chain6 = [['Deposit', '250,000.00', 'USDC', 51.4], ['Vault shares', '244,733.53', 'tvUSDC', 52.3], ['Position today', '254,819.00', 'USDC · share value 1.041210', 53.2]]
      .map(([kk, v, uu, at], i, a) => ({ k: kk, v, u: uu, cls: t >= at ? 'fm-on' : 'fm-off', arrow: i < a.length - 1, fill: (P(at, a[Math.min(i + 1, a.length - 1)][3]) * 100).toFixed(1) + '%' }));
    const dep = P(53.6, 55.0);
    const metO6 = P(55.2, 56.0);

    // ---------- scene 7 · trade ----------
    const s7o = W(59.4, 67.6, 0.8, 0.8);
    const setO = P(61.2, 61.9);
    const bars = P(61.6, 62.6);
    const ST = [
      ['Buyer payment', 'From Kestrel Commodities', '300,000.00', 62.4, '#f2ffff'],
      ['Loan payoff', 'LN-2291 repaid in full · lien released', '−140,630.14', 63.2, '#a9cbf6'],
      ['Settlement fee', '0.25% to the protocol', '−750.00', 64.0, '#f5c97f'],
      ['Seller proceeds', 'To Halden Metals Ltd', '158,619.86', 64.8, '#f2ffff'],
      ['Ownership transferred', 'TNS-CU-00418 → Kestrel Commodities', 'FREE', 65.6, '#7fe0b0']
    ];
    const settle = ST.map(([tt, d, v, at, c]) => ({ t: tt, d, v, c, cls: t >= at ? 'fm-on' : 'fm-off' }));
    const press = W(60.6, 61.4, 0.3, 0.4);

    // ---------- scene 8 · reserve ----------
    const s8o = W(71.4, 76.6, 0.8, 0.8);
    const g1 = P(71.6, 72.6), g2 = P(73.2, 74.2), frozen = t >= 74.0;
    const whs = [
      { name: 'Rotterdam Botlek 04', code: 'RTM-BOT-04', res: '500,000', out: '450,000', rw: (100 * g1).toFixed(1) + '%', ow: (90 * g1).toFixed(1) + '%', cov: '111.11%', covC: '#7fe0b0', glow: 'rgba(95,211,154,.35)', status: 'Healthy', tone: 't-success', o: P(71.4, 72.1).toFixed(2), dy: px((1 - P(71.4, 72.1)) * 16), sh: 'var(--g-edge), var(--g-depth)' },
      { name: 'Port Klang West 02', code: 'PKL-WST-02', res: '250,000', out: '300,000', rw: (83.33 * g2).toFixed(1) + '%', ow: (100 * g2).toFixed(1) + '%', cov: '83.33%', covC: '#ffa597', glow: 'rgba(255,139,123,.35)', status: frozen ? 'Reserve breach · frozen' : 'Reserve breach', tone: 't-solid-danger', o: P(73.0, 73.7).toFixed(2), dy: px((1 - P(73.0, 73.7)) * 16), sh: frozen ? 'inset 0 1px 0 rgba(255,220,214,.14), inset 0 0 0 1px rgba(255,139,123,.4), 0 30px 70px -36px rgba(255,139,123,.45)' : 'var(--g-edge), var(--g-depth)' }
    ];
    const CS = ['Reserve breach', 'Warehouse frozen', 'New mint blocked', 'New borrowing blocked', 'Transfers blocked', 'Reconciliation', 'Unfreeze'];
    const chain8 = CS.map((tt, i) => { const lit = t >= 74.0 + i * 0.3; const red = i <= 4; return { n: String(i + 1).padStart(2, '0'), t: tt, bg: lit ? (red ? (i === 1 ? 'rgba(255,139,123,.22)' : 'rgba(255,139,123,.10)') : 'rgba(95,211,154,.10)') : 'rgba(215,252,253,.03)', sh: lit ? (red ? 'inset 0 0 0 1px rgba(255,139,123,.35)' : 'inset 0 0 0 1px rgba(95,211,154,.3)') : 'inset 0 0 0 1px rgba(215,252,253,.05)', fg: lit ? (red ? '#ffb3a8' : '#7fe0b0') : 'var(--text-muted)' }; });
    const chainO8 = P(73.8, 74.3);

    // ---------- scene 9 · redemption ----------
    const s9o = W(78.2, 84.6, 0.8, 1.0);
    const moveP = P(81.8, 83.0);
    const burned = t >= 81.2;
    const TL = [['Requested', 'By Kestrel Commodities', 78.9], ['SLA deadline', '7 days to release', 79.5], ['Warehouse release', 'Portline Warehousing', 80.1], ['Release proof', 'Signed release note', 80.7], ['Completed', '30.006 t collected', 81.3]];
    const tl9 = TL.map(([tt, d, at], i, a) => { const lit = t >= at; const last = i === a.length - 1; return { t: tt, d, dot: lit ? (last ? '#7fe0b0' : '#d7fcfd') : 'rgba(215,252,253,.18)', glow: lit ? '0 0 14px rgba(215,252,253,.6)' : 'none', line: last ? 'transparent' : (t >= a[i + 1][2] ? 'rgba(215,252,253,.45)' : 'rgba(215,252,253,.10)'), fg: lit ? 'var(--text)' : 'var(--text-muted)' }; });
    const redeeming = t >= 78.6;
    const pass9style = burned ? 'background: transparent; box-shadow: none; border: 1px dashed rgba(215,252,253,.3);' : 'background: linear-gradient(160deg, rgba(215,252,253,.10), rgba(215,252,253,.03)), rgba(9,40,42,.55); -webkit-backdrop-filter: blur(22px); backdrop-filter: blur(22px); box-shadow: inset 0 1px 0 rgba(240,255,255,.2), inset 0 0 0 1px rgba(191,240,239,.14), 0 30px 80px -40px rgba(110,225,225,.35);';

    // ---------- scene 10 ----------
    const closeIn = P(85.2, 86.6);
    const tagO = P(86.6, 87.8);

    // ---------- titles ----------
    const TT = [
      [0.8, 7.6, 'The physical world', 'Material sits in warehouses', 'Six example locations'],
      [16.6, 27.0, '01 · Verify', 'From warehouse to verified lot', 'Tokenize · F-1'],
      [30.2, 39.2, '02 · Passport', fi >= 0 ? fNames[fi] : 'Material passport', 'TNS-CU-00418'],
      [41.8, 49.2, '03 · Borrow', 'Lot → collateral → credit', 'Borrow · F-2'],
      [51.2, 57.2, '04 · Lend', 'Deposits become credit', 'Tensile credit vault'],
      [59.6, 67.2, '05 · Trade', 'Sold while pledged', 'Atomic settlement'],
      [67.4, 76.2, '06 · Reserve health', 'Physical backing, monitored', 'Reserve health · F-6'],
      [78.4, 84.2, '07 · Redeem', 'Back to metal', 'Redemption · F-5']
    ];
    let titleO = 0, titleE = '', titleH = '', titleSub = '', titleDy = 0;
    TT.forEach(([a, b, e, h, s]) => { const o = W(a, b, 0.7, 0.6); if (o > titleO) { titleO = o; titleE = e; titleH = h; titleSub = s; titleDy = (1 - o) * 10; } });
    // the real-screen shots carry their own chrome: hide the title over them
    titleO *= (1 - shotO);

    // ---------- captions ----------
    let cap = '', capO = 0;
    this.CAPS.forEach(([a, b, s]) => { const o = W(a, b, 0.3, 0.3); if (o > capO) { capO = o; cap = s; } });
    const controls = this.props.controls ?? true;

    const mm = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    const chapters = this.SCENES.map(([at, label], i) => ({ n: String(i + 1).padStart(2, '0'), label, fg: (t >= at && (i === this.SCENES.length - 1 || t < this.SCENES[i + 1][0])) ? 'var(--brand)' : 'var(--text-muted)', go: () => { this.tNow = at + 0.01; this.setState({ t: this.tNow }); } }));

    return {
      t: t.toFixed(1), gx: px(gx), gy: px(gy), gR: px(gR), gOp: gOp.toFixed(3), gFront, gBack, gNodes, gPts, gArcs, gLinks,
      gGlowX: px(gx - gR * 1.3), gGlowY: px(gy - gR * 1.3), gGlowS: px(gR * 2.6),
      specX: px(gx - gR * 0.34), specY: px(gy - gR * 0.55), specRx: px(gR * 0.6), specRy: px(gR * 0.31), specT: 'rotate(-26 ' + px(gx - gR * 0.34) + ' ' + px(gy - gR * 0.55) + ')',
      miniLabelO: (gR < 120 ? gOp : 0).toFixed(2),
      s1: on(0, 8.6), qs,
      s2: on(7.8, 16.4), logoO: logoO.toFixed(3), logoS: (0.92 + P(8.2, 9.6) * 0.08).toFixed(3), logoB: px((1 - P(8.2, 9.4)) * 12), wordO: W(8.8, 12.2, 1, 1).toFixed(3), spineO: spineO.toFixed(3), spineDy: px((1 - spineO) * 12), spine,
      s3: on(16.6, 27.8), s3o: s3o.toFixed(3), s3dy: px((1 - P(16.8, 17.7)) * 30), s3s: (0.97 + P(16.8, 17.7) * 0.03).toFixed(4), s3b: px((1 - s3o) * 10), steps, ledger,
      mintState: t >= 25.6 ? 'FINALIZED' : 'REQUESTED', mintTone: t >= 25.6 ? 't-success' : 't-info',
      rLot, rBorrow, rLend, rMarket, rReserve, rRedeem, shot,
      s4: on(29.8, 39.8), s4o: s4o.toFixed(3), s4b: px((1 - s4o) * 10), camX: px(camX), camY: px(camY + (1 - s4in) * 30), camS: (camS * (0.97 + s4in * 0.03)).toFixed(4), regions,
      encLabel: 'FREE', encTone: 't-success',
      s5: on(41.4, 49.8), s5o: s5o.toFixed(3), s5b: px((1 - s5o) * 10), s5dy: px(s5dy), chain5,
      amt5: f2(amt), ltv5: (amt / 3000).toFixed(2) + '%', ltvW5: (amt / 3000).toFixed(2) + '%',
      feeO: P(46.0, 46.6).toFixed(2), netO: P(47.0, 47.6).toFixed(2), txO: P(44.4, 44.8).toFixed(2),
      txLabel: ['READY', 'PROCESSING', 'CONFIRMING', 'COMPLETED'][txStep], txTone: txStep === 3 ? 't-success' : 't-info',
      txCopy: ['', 'Pledging TNS-CU-00418', 'Credit moving from the vault', '139,300.00 USDC received'][txStep], txPct: ['0%', '34%', '68%', '100%'][txStep],
      s6: on(50.8, 57.8), s6o: s6o.toFixed(3), s6b: px((1 - s6o) * 10), s6dy: px((1 - P(51, 51.8)) * 20), chain6,
      depW: (75 * dep).toFixed(1) + '%', depPct: (75 * dep).toFixed(2) + '%', lnO: P(54.6, 55.2).toFixed(2), metO6: metO6.toFixed(2), metDy6: px((1 - metO6) * 14),
      s7: on(59.2, 67.8), s7o: s7o.toFixed(3), s7b: px((1 - s7o) * 10), cardDy: px((1 - P(59.4, 60.3)) * 20), provO: P(59.9, 60.5).toFixed(2), buyS: (1 - press * 0.03).toFixed(3), buyBr: (1 + press * 0.12).toFixed(3),
      setO: setO.toFixed(2), barA: (46.88 * bars).toFixed(2) + '%', barB: (0.6 * bars).toFixed(2) + '%', barC: (52.87 * bars).toFixed(2) + '%', settle,
      s8: on(71.2, 76.8), s8o: s8o.toFixed(3), s8b: px((1 - s8o) * 10), whs, chain8, chainO8: chainO8.toFixed(2),
      s9: on(78, 85), s9o: s9o.toFixed(3), s9b: px((1 - s9o) * 10), tl9, tl9O: Math.min(P(78.2, 78.9), 1 - moveP).toFixed(3),
      pass9x: px(240 + (1440 - 240) * moveP), pass9y: px(270 + (420 - 270) * moveP), pass9s: (1 - moveP * 0.3).toFixed(3), pass9style,
      redLabel: burned ? 'BURNED' : (redeeming ? 'REDEEMING' : 'FREE'), redTone: burned ? 't-burned' : (redeeming ? 't-info' : 't-success'), redStrike: burned ? 'line-through' : 'none',
      redNote: burned ? 'Passport retired · full history retained on the ledger' : (redeeming ? 'Transfers locked until the warehouse releases the metal' : 'Owned by Kestrel Commodities since settlement'),
      lockO: W(78.9, 81.0, 0.4, 0.4).toFixed(2),
      s10: on(84.8, 92), closeO: closeIn.toFixed(3), closeDy: px((1 - closeIn) * 14), closeB: px((1 - closeIn) * 8), tagO: tagO.toFixed(3),
      titleO: titleO.toFixed(3), titleE, titleH, titleSub, titleDy: px(titleDy),
      showCap: this.state.captions && capO > 0.01, cap, capO: capO.toFixed(2), capBottom: controls ? 92 : 56,
      showIllus: on(16.6, 84.2), illusBottom: controls ? 80 : 32,
      controls, clock: mm(t) + ' / 1:32',
      playIcon: this.state.playing ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5l11 7-11 7z', playLabel: this.state.playing ? 'Pause' : 'Play',
      toggle: () => { if (this.tNow >= this.DUR) this.tNow = 0; this.setState({ playing: !this.state.playing, t: this.tNow }); },
      restart: () => { this.tNow = 0; this.setState({ t: 0, playing: true }); },
      scrub: (e) => { this.tNow = Number(e.target.value); this.setState({ t: this.tNow, playing: false }); },
      chapters, toggleCap: () => this.setState({ captions: !this.state.captions }), capPressed: this.state.captions ? 'true' : 'false', capFg: this.state.captions ? 'var(--brand)' : 'var(--text-muted)'
    };
  }
}

export default class Film extends FilmLogic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
      <div className="t-atmos fm-film" style={{ width: "1920px", height: "1080px", position: "relative", overflow: "hidden", color: "var(--text)", fontFamily: "var(--sans)" }}>
        <div style={{ position: "absolute", left: `${$v.gGlowX ?? ''}px`, top: `${$v.gGlowY ?? ''}px`, width: `${$v.gGlowS ?? ''}px`, height: `${$v.gGlowS ?? ''}px`, borderRadius: "999px", background: "radial-gradient(circle, rgba(80,200,200,.17) 0%, rgba(30,120,130,.09) 42%, transparent 68%)", filter: "blur(16px)", opacity: $v.gOp, pointerEvents: "none" }} />
        <svg viewBox="0 0 1920 1080" width="1920" height="1080" className="fm-layer" style={{ overflow: "visible", opacity: $v.gOp, pointerEvents: "none" }} aria-hidden="true">
          <defs>
            <radialGradient id="fmFill" cx="36%" cy="30%" r="78%">
              <stop offset="0%" stopColor="#d7fcfd" stopOpacity=".15" />
              <stop offset="34%" stopColor="#2a8a8a" stopOpacity=".14" />
              <stop offset="72%" stopColor="#06302f" stopOpacity=".55" />
              <stop offset="100%" stopColor="#011616" stopOpacity=".88" />
            </radialGradient>
            <radialGradient id="fmRim" cx="50%" cy="50%" r="50%">
              <stop offset="84%" stopColor="#d7fcfd" stopOpacity="0" />
              <stop offset="97%" stopColor="#bff0ef" stopOpacity=".14" />
              <stop offset="100%" stopColor="#d7fcfd" stopOpacity=".26" />
            </radialGradient>
            <linearGradient id="fmSpec" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity=".2" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle cx={$v.gx} cy={$v.gy} r={$v.gR} fill="url(#fmFill)" />
          <path d={$v.gBack} fill="none" stroke="#d7fcfd" strokeOpacity=".06" strokeWidth="1" />
          <path d={$v.gFront} fill="none" stroke="#d7fcfd" strokeOpacity=".28" strokeWidth="1.2" strokeLinecap="round" />
          {($v.gNodes ?? []).map((n, $i0) => (
            <Fragment key={$i0}>
              <circle cx={n?.x} cy={n?.y} r="2.6" fill="#d7fcfd" fillOpacity={n?.o} />
            </Fragment>
          ))}
          <circle cx={$v.gx} cy={$v.gy} r={$v.gR} fill="url(#fmRim)" />
          <circle cx={$v.gx} cy={$v.gy} r={$v.gR} fill="none" stroke="#d7fcfd" strokeOpacity=".15" strokeWidth="1" />
          <ellipse cx={$v.specX} cy={$v.specY} rx={$v.specRx} ry={$v.specRy} fill="url(#fmSpec)" transform={$v.specT} />
          {($v.gArcs ?? []).map((a, $i0) => (
            <Fragment key={$i0}>
              <path d={a?.d} fill="none" stroke="#d7fcfd" strokeOpacity={a?.o} strokeWidth="1.1" className="fm-flow" />
            </Fragment>
          ))}
          {($v.gLinks ?? []).map((l, $i0) => (
            <Fragment key={$i0}>
              <path d={l?.d} fill="none" stroke="#d7fcfd" strokeOpacity={l?.o} strokeWidth="1.5" className="fm-flow" />
            </Fragment>
          ))}
          {($v.gPts ?? []).map((p, $i0) => (
            <Fragment key={$i0}>
              <circle cx={p?.x} cy={p?.y} r={p?.hr} fill={p?.c} className="fm-halo" style={{ animationDelay: p?.delay }} />
              <circle cx={p?.x} cy={p?.y} r={p?.r} fill={p?.c} fillOpacity={p?.o} />
              <text x={p?.lx} y={p?.ly} fill="#d7fcfd" fillOpacity={p?.lo} fontSize={p?.fs} fontFamily="IBM Plex Mono, monospace" letterSpacing=".08em">
                <span className="sc-interp">{p?.label}</span>
              </text>
            </Fragment>
          ))}
        </svg>
        <div style={{ position: "absolute", right: "64px", top: "248px", textAlign: "right", opacity: $v.miniLabelO }} className="t-stack">
          <span className="t-mono-sm" style={{ color: "var(--steel)" }}>
            RTM-BOT-04
          </span>
          <span className="t-cap">
            Rotterdam · 30.000 t copper
          </span>
        </div>
        {$v.s1 ? (
          <>
            <div className="fm-layer" style={{ pointerEvents: "none" }}>
              {($v.qs ?? []).map((q, $i0) => (
                <Fragment key={$i0}>
                  <div className="fm-glass" style={{ position: "absolute", left: `${q?.x ?? ''}px`, top: `${q?.y ?? ''}px`, padding: "12px 22px", borderRadius: "999px", opacity: q?.o, transform: `translateY(${q?.dy ?? ''}px)`, filter: `blur(${q?.b ?? ''}px)` }}>
                    <span style={{ fontSize: "22px", fontWeight: "400", letterSpacing: "-.01em" }}>
                      <span className="sc-interp">{q?.t}</span>
                    </span>
                  </div>
                </Fragment>
              ))}
            </div>
          </>
        ) : null}
        {" "}
        {$v.s2 ? (
          <>
            <div className="fm-layer" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "28px", pointerEvents: "none" }}>
              <img src="/design-assets/f7ab157752a5014c52926e68ee69f6c6.png" alt="Tensile" style={{ width: "260px", height: "252px", opacity: $v.logoO, transform: `scale(${$v.logoS ?? ''})`, filter: `blur(${$v.logoB ?? ''}px) drop-shadow(0 0 40px rgba(215,252,253,.45))` }} />
              {" "}
              <span className="t-wordmark" style={{ fontSize: "46px", letterSpacing: ".36em", opacity: $v.wordO, marginTop: "-8px" }}>
                TENSILE
              </span>
            </div>
            <div style={{ position: "absolute", left: "0", right: "0", bottom: "210px", display: "flex", justifyContent: "center", gap: "18px", opacity: $v.spineO, transform: `translateY(${$v.spineDy ?? ''}px)` }}>
              {($v.spine ?? []).map((s, $i0) => (
                <Fragment key={$i0}>
                  <span className="t-row" style={{ gap: "18px" }}>
                    <span className="fm-glass" style={{ padding: "10px 20px", borderRadius: "999px", fontSize: "18px", opacity: s?.o }}>
                      <span className="sc-interp">{s?.t}</span>
                    </span>
                    {s?.arrow ? (
                      <>
                        <span style={{ color: "rgba(215,252,253,.5)", fontSize: "20px" }}>
                          →
                        </span>
                      </>
                    ) : null}
                  </span>
                </Fragment>
              ))}
            </div>
          </>
        ) : null}
        {" "}
        {$v.s3 ? (
          <>
            <section className="t-float" style={{ position: "absolute", left: "260px", top: "200px", width: "1400px", padding: "40px 48px", display: "flex", flexDirection: "column", gap: "30px", opacity: $v.s3o, transform: `translateY(${$v.s3dy ?? ''}px) scale(${$v.s3s ?? ''})`, filter: `blur(${$v.s3b ?? ''}px)` }}>
              <div className="t-between">
                <div className="t-stack" style={{ gap: "6px" }}>
                  <span className="t-eyebrow">
                    Mint request MR-0844 · Rotterdam Botlek 04
                  </span>
                  <span className="t-h2" style={{ fontSize: "32px", lineHeight: "40px" }}>
                    Tokenize 30.000 t copper cathode
                  </span>
                </div>
                <span className={`t-badge ${$v.mintTone ?? ''}`} style={{ height: "28px", padding: "0 14px", fontSize: "12px" }}>
                  <span className="t-dot" />
                  <span className="sc-interp">{$v.mintState}</span>
                </span>
              </div>
              <div className="t-steps">
                {($v.steps ?? []).map((s, $i0) => (
                  <Fragment key={$i0}>
                    <div className={`t-step ${s?.cls ?? ''}`} style={{ cursor: "default" }}>
                      <span className="t-step-n">
                        <span className="sc-interp">{s?.n}</span>
                      </span>
                      <span className="t-step-l" style={{ fontSize: "15px" }}>
                        <span className="sc-interp">{s?.l}</span>
                      </span>
                    </div>
                  </Fragment>
                ))}
              </div>
              <div className="t-stack" style={{ gap: "0" }}>
                {($v.ledger ?? []).map((r, $i0) => (
                  <Fragment key={$i0}>
                    <div style={{ display: "grid", gridTemplateColumns: "230px minmax(0, 1fr) 190px", gap: "24px", alignItems: "center", padding: "13px 0", borderTop: "1px solid rgba(215,252,253,.05)", opacity: r?.o, transform: `translateX(${r?.dx ?? ''}px)` }}>
                      <span style={{ fontSize: "17px", fontWeight: "500" }}>
                        <span className="sc-interp">{r?.k}</span>
                      </span>
                      {" "}
                      <span style={{ fontSize: "17px", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        <span className="sc-interp">{r?.v}</span>
                      </span>
                      {" "}
                      <span className={`t-badge ${r?.tone ?? ''}`} style={{ justifySelf: "end", height: "26px", padding: "0 12px", fontSize: "12px" }}>
                        <span className="t-dot" />
                        <span className="sc-interp">{r?.s}</span>
                      </span>
                    </div>
                  </Fragment>
                ))}
              </div>
            </section>
          </>
        ) : null}
        {" "}
        {$v.rLot ? (
          <>
            <div style={{ position: "absolute", left: "240px", top: "0", width: "1440px", height: "1080px", overflow: "hidden", opacity: $v.shot?.o, filter: `blur(${$v.shot?.b ?? ''}px)`, transform: `scale(${$v.shot?.s ?? ''})`, transformOrigin: "50% 35%", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)" }}>
              <div style={{ width: "1440px", transform: `translateY(${$v.shot?.y ?? ''}px)` }}>
                <LotPassport />
              </div>
            </div>
          </>
        ) : null}
        {" "}
        {$v.rBorrow ? (
          <>
            <div style={{ position: "absolute", left: "240px", top: "0", width: "1440px", height: "1080px", overflow: "hidden", opacity: $v.shot?.o, filter: `blur(${$v.shot?.b ?? ''}px)`, transform: `scale(${$v.shot?.s ?? ''})`, transformOrigin: "50% 35%", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)" }}>
              <div style={{ width: "1440px", transform: `translateY(${$v.shot?.y ?? ''}px)` }}>
                <Borrow />
              </div>
            </div>
          </>
        ) : null}
        {" "}
        {$v.rLend ? (
          <>
            <div style={{ position: "absolute", left: "240px", top: "0", width: "1440px", height: "1080px", overflow: "hidden", opacity: $v.shot?.o, filter: `blur(${$v.shot?.b ?? ''}px)`, transform: `scale(${$v.shot?.s ?? ''})`, transformOrigin: "50% 35%", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)" }}>
              <div style={{ width: "1440px", transform: `translateY(${$v.shot?.y ?? ''}px)` }}>
                <Lend />
              </div>
            </div>
          </>
        ) : null}
        {" "}
        {$v.rMarket ? (
          <>
            <div style={{ position: "absolute", left: "240px", top: "0", width: "1440px", height: "1080px", overflow: "hidden", opacity: $v.shot?.o, filter: `blur(${$v.shot?.b ?? ''}px)`, transform: `scale(${$v.shot?.s ?? ''})`, transformOrigin: "50% 35%", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)" }}>
              <div style={{ width: "1440px", transform: `translateY(${$v.shot?.y ?? ''}px)` }}>
                <Marketplace />
              </div>
            </div>
          </>
        ) : null}
        {" "}
        {$v.rReserve ? (
          <>
            <div style={{ position: "absolute", left: "240px", top: "0", width: "1440px", height: "1080px", overflow: "hidden", opacity: $v.shot?.o, filter: `blur(${$v.shot?.b ?? ''}px)`, transform: `scale(${$v.shot?.s ?? ''})`, transformOrigin: "50% 35%", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)" }}>
              <div style={{ width: "1440px", transform: `translateY(${$v.shot?.y ?? ''}px)` }}>
                <ReserveHealth />
              </div>
            </div>
          </>
        ) : null}
        {" "}
        {$v.rRedeem ? (
          <>
            <div style={{ position: "absolute", left: "240px", top: "0", width: "1440px", height: "1080px", overflow: "hidden", opacity: $v.shot?.o, filter: `blur(${$v.shot?.b ?? ''}px)`, transform: `scale(${$v.shot?.s ?? ''})`, transformOrigin: "50% 35%", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)" }}>
              <div style={{ width: "1440px", transform: `translateY(${$v.shot?.y ?? ''}px)` }}>
                <Redemption />
              </div>
            </div>
          </>
        ) : null}
        {" "}
        {$v.s4 ? (
          <>
            <div className="fm-layer" style={{ opacity: $v.s4o, filter: `blur(${$v.s4b ?? ''}px)`, transform: `translate(${$v.camX ?? ''}px, ${$v.camY ?? ''}px) scale(${$v.camS ?? ''})`, transformOrigin: "50% 55%" }}>
              <article className="t-plate" style={{ position: "absolute", left: "230px", top: "200px", width: "1460px", padding: "40px 48px", display: "flex", flexDirection: "column", gap: "26px" }}>
                <span className="t-reg t-reg-tl" />
                <span className="t-reg t-reg-tr" />
                <span className="t-reg t-reg-bl" />
                <span className="t-reg t-reg-br" />
                <div className="t-between" style={{ alignItems: "flex-start" }}>
                  <div className="t-row" style={{ gap: "16px" }}>
                    <img src="/design-assets/f7ab157752a5014c52926e68ee69f6c6.png" alt="" style={{ width: "40px", height: "39px", filter: "drop-shadow(0 0 12px rgba(215,252,253,.4))" }} />
                    <div className="t-stack">
                      <span className="t-eyebrow" style={{ color: "var(--steel)" }}>
                        Material passport
                      </span>
                      <span className="t-mono-sm" style={{ color: "var(--steel)", fontWeight: "400" }}>
                        SERIAL 000418 · ISSUED 2026-06-05
                      </span>
                    </div>
                  </div>
                  <span className={`t-badge ${$v.encTone ?? ''}`} style={{ height: "28px", padding: "0 14px", fontSize: "12px" }}>
                    <span className="t-dot" />
                    <span className="sc-interp">{$v.encLabel}</span>
                  </span>
                </div>
                <div className="t-stack" style={{ gap: "4px" }}>
                  <span className="t-mono" style={{ color: "var(--steel)", fontSize: "16px", letterSpacing: ".06em" }}>
                    TNS-CU-00418 · CU-CATH-A
                  </span>
                  <span style={{ fontSize: "54px", lineHeight: "60px", fontWeight: "400", letterSpacing: "-.025em" }}>
                    Copper cathode, Grade A
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "22px" }}>
                  {($v.regions ?? []).map((g, $i0) => (
                    <Fragment key={$i0}>
                      <div style={{ padding: "20px 22px", borderRadius: "18px", minHeight: "196px", display: "flex", flexDirection: "column", gap: "14px", opacity: g?.o, background: g?.bg, boxShadow: g?.sh, transition: "none" }}>
                        <span className="t-spec-k">
                          <span className="sc-interp">{g?.k}</span>
                        </span>
                        {" "}
                        {(g?.rows ?? []).map((r, $i1) => (
                          <Fragment key={$i1}>
                            <div className="t-between" style={{ fontSize: "16px" }}>
                              <span className="t-muted">
                                <span className="sc-interp">{r?.a}</span>
                              </span>
                              <span style={{ fontVariantNumeric: "tabular-nums", color: r?.c }}>
                                <span className="sc-interp">{r?.b}</span>
                              </span>
                            </div>
                          </Fragment>
                        ))}
                        {" "}
                        {g?.meter ? (
                          <>
                            <div className="t-meter" style={{ height: "8px", marginTop: "4px" }}>
                              <div className="t-meter-fill" style={{ width: "81.82%" }} />
                              <span className="t-mark" style={{ left: "90.91%" }} />
                            </div>
                          </>
                        ) : null}
                      </div>
                    </Fragment>
                  ))}
                </div>
              </article>
            </div>
          </>
        ) : null}
        {" "}
        {$v.s5 ? (
          <>
            <div className="fm-layer" style={{ opacity: $v.s5o, filter: `blur(${$v.s5b ?? ''}px)`, transform: `translateY(${$v.s5dy ?? ''}px)` }}>
              <div style={{ position: "absolute", left: "230px", top: "176px", width: "1460px", display: "grid", gridTemplateColumns: "1fr 60px 1fr 60px 1fr 60px 1fr", alignItems: "center" }}>
                {($v.chain5 ?? []).map((c, $i0) => (
                  <Fragment key={$i0}>
                    <div className={`fm-node ${c?.cls ?? ''}`}>
                      <span className="t-eyebrow" style={{ fontSize: "10px" }}>
                        <span className="sc-interp">{c?.k}</span>
                      </span>
                      <span style={{ fontSize: "19px", fontWeight: "500" }}>
                        <span className="sc-interp">{c?.v}</span>
                      </span>
                      <span className="t-cap">
                        <span className="sc-interp">{c?.d}</span>
                      </span>
                    </div>
                    {c?.arrow ? (
                      <>
                        <div style={{ height: "2px", margin: "0 10px", borderRadius: "999px", background: "rgba(215,252,253,.08)", position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: "0", top: "0", bottom: "0", width: c?.fill, background: "#d7fcfd", boxShadow: "0 0 10px #d7fcfd" }} />
                        </div>
                      </>
                    ) : null}
                  </Fragment>
                ))}
              </div>
              <section className="t-float" style={{ position: "absolute", left: "230px", top: "330px", width: "1460px", padding: "40px 48px", display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: "56px" }}>
                <div className="t-stack" style={{ gap: "30px" }}>
                  <div className="t-metrics" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                    <div className="t-metric">
                      <span className="t-cap">
                        Collateral value
                      </span>
                      <span className="t-num-md" style={{ fontSize: "24px", lineHeight: "30px" }}>
                        $300,000.00
                      </span>
                    </div>
                    <div className="t-metric">
                      <span className="t-cap">
                        Maximum LTV
                      </span>
                      <span className="t-num-md" style={{ fontSize: "24px", lineHeight: "30px" }}>
                        65.00%
                      </span>
                    </div>
                    <div className="t-metric t-metric-accent">
                      <span className="t-cap">
                        Available
                      </span>
                      <span className="t-num-md" style={{ fontSize: "24px", lineHeight: "30px" }}>
                        195,000.00
                      </span>
                    </div>
                  </div>
                  <div className="t-stack" style={{ gap: "8px" }}>
                    <span className="t-label">
                      Borrow amount
                    </span>
                    <span style={{ fontSize: "64px", lineHeight: "70px", fontWeight: "400", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", color: "#f2ffff", textShadow: "0 0 30px rgba(170,245,245,.25)" }}>
                      <span className="sc-interp">{$v.amt5}</span>
                      <span style={{ fontSize: "22px", color: "var(--text-muted)", marginLeft: "12px" }}>
                        USDC
                      </span>
                    </span>
                  </div>
                  <div className="t-stack" style={{ gap: "12px" }}>
                    <div className="t-between" style={{ alignItems: "flex-end" }}>
                      <span className="t-label">
                        Loan-to-value
                      </span>
                      <span style={{ fontSize: "40px", lineHeight: "44px", fontVariantNumeric: "tabular-nums", textShadow: "0 0 24px rgba(141,185,242,.4)" }}>
                        <span className="sc-interp">{$v.ltv5}</span>
                      </span>
                    </div>
                    <div style={{ position: "relative", height: "16px", borderRadius: "999px", background: "linear-gradient(90deg, rgba(215,252,253,.06) 0 65%, rgba(240,184,96,.14) 65% 77%, rgba(255,139,123,.16) 77% 100%)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.45)" }}>
                      <div style={{ position: "absolute", left: "0", top: "0", bottom: "0", width: $v.ltvW5, borderRadius: "999px", background: "linear-gradient(90deg, rgba(141,185,242,.55), #8db9f2)", boxShadow: "0 0 18px -2px rgba(141,185,242,.6), inset 0 1px 0 rgba(255,255,255,.4)" }} />
                      <span className="t-mark t-mark-warn" style={{ left: "65%" }} />
                      <span className="t-mark t-mark-danger" style={{ left: "77%" }} />
                    </div>
                    <div className="t-between t-cap" style={{ fontSize: "13px" }}>
                      <span>
                        0%
                      </span>
                      <span style={{ marginLeft: "45%", color: "var(--warning-text)" }}>
                        Max 65%
                      </span>
                      <span style={{ color: "var(--danger-text)" }}>
                        Liquidation 77%
                      </span>
                      <span>
                        100%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="t-stack" style={{ gap: "18px" }}>
                  <span className="t-h4" style={{ fontSize: "18px" }}>
                    Transaction preview
                  </span>
                  <div className="t-kv" style={{ fontSize: "16px" }}>
                    <div className="t-kv-row" style={{ fontSize: "16px" }}>
                      <span className="t-kv-k">
                        Collateral
                      </span>
                      <span className="t-kv-v">
                        TNS-CU-00418
                      </span>
                    </div>
                    <div className="t-kv-row" style={{ fontSize: "16px" }}>
                      <span className="t-kv-k">
                        USDC borrowed
                      </span>
                      <span className="t-kv-v">
                        <span className="sc-interp">{$v.amt5}</span>
                      </span>
                    </div>
                    <div className="t-kv-row" style={{ fontSize: "16px", opacity: $v.feeO }}>
                      <span className="t-kv-k">
                        Origination fee 0.50%
                      </span>
                      <span className="t-kv-v">
                        −700.00
                      </span>
                    </div>
                    <div className="t-kv-row t-kv-total" style={{ fontSize: "18px", opacity: $v.netO }}>
                      <span>
                        Net received
                      </span>
                      <span className="t-num" style={{ fontSize: "20px", color: "#f2ffff", textShadow: "0 0 20px rgba(170,245,245,.35)" }}>
                        139,300.00 USDC
                      </span>
                    </div>
                  </div>
                  <div className="t-stack" style={{ gap: "10px", opacity: $v.txO }}>
                    <div className="t-txstate" style={{ fontSize: "15px" }}>
                      <span className={`t-badge ${$v.txTone ?? ''}`} style={{ height: "24px" }}>
                        <span className="t-dot" />
                        <span className="sc-interp">{$v.txLabel}</span>
                      </span>
                      <span>
                        <span className="sc-interp">{$v.txCopy}</span>
                      </span>
                    </div>
                    <div className="t-txbar">
                      <span style={{ width: $v.txPct, transition: "none" }} />
                    </div>
                  </div>
                  <span className="t-cap" style={{ fontSize: "14px" }}>
                    The metal stays in custody at Rotterdam Botlek 04.
                  </span>
                </div>
              </section>
            </div>
          </>
        ) : null}
        {" "}
        {$v.s6 ? (
          <>
            <div className="fm-layer" style={{ opacity: $v.s6o, filter: `blur(${$v.s6b ?? ''}px)`, transform: `translateY(${$v.s6dy ?? ''}px)` }}>
              <div style={{ position: "absolute", left: "230px", top: "200px", width: "1460px", display: "grid", gridTemplateColumns: "1fr 70px 1fr 70px 1fr", alignItems: "center" }}>
                {($v.chain6 ?? []).map((c, $i0) => (
                  <Fragment key={$i0}>
                    <div className={`fm-node ${c?.cls ?? ''}`} style={{ padding: "22px 26px" }}>
                      <span className="t-eyebrow" style={{ fontSize: "10px" }}>
                        <span className="sc-interp">{c?.k}</span>
                      </span>
                      <span style={{ fontSize: "30px", lineHeight: "36px", fontWeight: "400", fontVariantNumeric: "tabular-nums" }}>
                        <span className="sc-interp">{c?.v}</span>
                        <span style={{ fontSize: "15px", color: "var(--text-muted)", marginLeft: "8px" }}>
                          <span className="sc-interp">{c?.u}</span>
                        </span>
                      </span>
                    </div>
                    {c?.arrow ? (
                      <>
                        <div style={{ height: "2px", margin: "0 12px", borderRadius: "999px", background: "rgba(215,252,253,.08)", position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: "0", top: "0", bottom: "0", width: c?.fill, background: "#d7fcfd", boxShadow: "0 0 10px #d7fcfd" }} />
                        </div>
                      </>
                    ) : null}
                  </Fragment>
                ))}
              </div>
              <section className="t-glass" style={{ position: "absolute", left: "230px", top: "420px", width: "1460px", padding: "36px 44px", borderRadius: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div className="t-between">
                  <span className="t-h4" style={{ fontSize: "18px" }}>
                    Tensile credit vault · 48,250,000.00 USDC
                  </span>
                  <span className="t-cap" style={{ fontSize: "14px" }}>
                    Illustrative vault figures
                  </span>
                </div>
                <div style={{ display: "flex", height: "34px", gap: "3px", borderRadius: "999px", overflow: "hidden", background: "rgba(215,252,253,.05)" }}>
                  <div style={{ width: $v.depW, background: "linear-gradient(90deg, rgba(141,185,242,.5), #8db9f2)", boxShadow: "0 0 20px -4px rgba(141,185,242,.6)" }} />
                  <div style={{ flex: "1", background: "rgba(215,252,253,.16)" }} />
                </div>
                <div className="t-between" style={{ fontSize: "17px" }}>
                  <span>
                    <span style={{ color: "var(--info-text)" }}>
                      Deployed to borrowers
                    </span>
                    {" · 36,187,500.00 · "}
                    <span className="sc-interp">{$v.depPct}</span>
                  </span>
                  <span className="t-sec">
                    Cash available · 12,062,500.00
                  </span>
                </div>
                <div className="t-row" style={{ gap: "10px", opacity: $v.lnO }}>
                  <span className="t-badge t-info" style={{ height: "24px" }}>
                    LN-2291
                  </span>
                  <span className="t-sm t-sec" style={{ fontSize: "15px" }}>
                    e.g. 140,000.00 USDC lent against TNS-CU-00418 · 30.000 t copper, Rotterdam
                  </span>
                </div>
              </section>
              <div className="t-metrics" style={{ position: "absolute", left: "230px", top: "760px", width: "1460px", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", opacity: $v.metO6, transform: `translateY(${$v.metDy6 ?? ''}px)` }}>
                <div className="t-metric">
                  <span className="t-cap" style={{ fontSize: "14px" }}>
                    Accrued earnings
                  </span>
                  <span style={{ fontSize: "40px", lineHeight: "46px", fontVariantNumeric: "tabular-nums", color: "#effefe", textShadow: "0 0 24px rgba(170,245,245,.3)" }}>
                    4,819.00
                    <span style={{ fontSize: "16px", color: "var(--text-muted)", marginLeft: "8px" }}>
                      USDC
                    </span>
                  </span>
                </div>
                <div className="t-metric">
                  <span className="t-cap" style={{ fontSize: "14px" }}>
                    Net yield, 30 days · variable
                  </span>
                  <span style={{ fontSize: "40px", lineHeight: "46px", fontVariantNumeric: "tabular-nums" }}>
                    6.12%
                  </span>
                </div>
                <div className="t-metric">
                  <span className="t-cap" style={{ fontSize: "14px" }}>
                    Available to withdraw
                  </span>
                  <span style={{ fontSize: "40px", lineHeight: "46px", fontVariantNumeric: "tabular-nums" }}>
                    254,819.00
                    <span style={{ fontSize: "16px", color: "var(--text-muted)", marginLeft: "8px" }}>
                      USDC
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {" "}
        {$v.s7 ? (
          <>
            <div className="fm-layer" style={{ opacity: $v.s7o, filter: `blur(${$v.s7b ?? ''}px)` }}>
              <article className="t-card t-card-flush" style={{ position: "absolute", left: "200px", top: "220px", width: "560px", transform: `translateY(${$v.cardDy ?? ''}px)` }}>
                <div className="t-ruled" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="t-row" style={{ gap: "12px" }}>
                    <span className="t-mono" style={{ fontSize: "24px", fontWeight: "500" }}>
                      CU
                    </span>
                    <span className="t-mono t-sec" style={{ fontSize: "15px" }}>
                      TNS-CU-00418
                    </span>
                  </span>
                  <span className="t-badge t-brand" style={{ height: "24px" }}>
                    LISTED
                  </span>
                </div>
                <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="t-between" style={{ alignItems: "flex-start" }}>
                    <div className="t-stack">
                      <span className="t-h3">
                        Copper cathode, Grade A
                      </span>
                      <span className="t-cap" style={{ fontSize: "14px" }}>
                        Rotterdam Botlek 04 · 30.000 t
                      </span>
                    </div>
                    <div className="t-stack" style={{ alignItems: "flex-end" }}>
                      <span style={{ fontSize: "26px", fontVariantNumeric: "tabular-nums" }}>
                        $300,000
                      </span>
                      <span className="t-cap">
                        $10,000.00 / t
                      </span>
                    </div>
                  </div>
                  <div className="t-row" style={{ gap: "6px", opacity: $v.provO }}>
                    <span className="t-badge t-badge-word t-success" style={{ height: "24px" }}>
                      <span className="t-dot" />
                      Certificate
                    </span>
                    <span className="t-badge t-badge-word t-success" style={{ height: "24px" }}>
                      <span className="t-dot" />
                      Inspected 10-07
                    </span>
                    <span className="t-badge t-badge-word t-success" style={{ height: "24px" }}>
                      <span className="t-dot" />
                      Custody
                    </span>
                    <span className="t-badge t-badge-word t-success" style={{ height: "24px" }}>
                      <span className="t-dot" />
                      Reserve 111.11%
                    </span>
                  </div>
                  <div className="t-well" style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px" }}>
                    <span style={{ fontSize: "15px" }}>
                      <span className="t-label">
                        Lien
                      </span>
                      PLEDGED · LN-2291
                    </span>
                    <span className="t-cap" style={{ fontSize: "13px" }}>
                      Paid off at settlement
                    </span>
                  </div>
                  <div className="t-between">
                    <span className="t-cap" style={{ fontSize: "14px" }}>
                      {"Seller "}
                      <span className="t-strong">
                        Halden Metals Ltd
                      </span>
                    </span>
                    <span className="t-cap" style={{ fontSize: "14px" }}>
                      {"Buyer "}
                      <span className="t-strong">
                        Kestrel Commodities
                      </span>
                    </span>
                  </div>
                  <div className="t-btn t-btn-primary t-btn-lg" style={{ transform: `scale(${$v.buyS ?? ''})`, filter: `brightness(${$v.buyBr ?? ''})` }}>
                    Buy for 300,000.00 USDC
                  </div>
                </div>
              </article>
              <section style={{ position: "absolute", left: "860px", top: "200px", width: "860px", display: "flex", flexDirection: "column", gap: "22px", opacity: $v.setO }}>
                <div style={{ display: "flex", height: "30px", gap: "3px", borderRadius: "999px", overflow: "hidden", background: "rgba(215,252,253,.05)" }}>
                  <div style={{ width: $v.barA, background: "#8db9f2" }} />
                  <div style={{ width: $v.barB, background: "#f0b860" }} />
                  <div style={{ width: $v.barC, background: "#d7fcfd" }} />
                </div>
                <div style={{ position: "relative", borderRadius: "22px", padding: "26px 22px 18px", boxShadow: "inset 0 0 0 1px rgba(191,240,239,.25)", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span className="t-mono-sm" style={{ position: "absolute", top: "-9px", left: "20px", padding: "0 10px", background: "#021a1a", color: "var(--brand-text)", fontSize: "12px" }}>
                    ONE TRANSACTION · ALL OR NOTHING
                  </span>
                  {" "}
                  {($v.settle ?? []).map((n, $i0) => (
                    <Fragment key={$i0}>
                      <div className={`fm-node ${n?.cls ?? ''}`} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: "14px 20px" }}>
                        <div className="t-stack" style={{ gap: "2px" }}>
                          <span style={{ fontSize: "18px", fontWeight: "500" }}>
                            <span className="sc-interp">{n?.t}</span>
                          </span>
                          <span className="t-cap" style={{ fontSize: "14px" }}>
                            <span className="sc-interp">{n?.d}</span>
                          </span>
                        </div>
                        <span style={{ fontSize: "22px", fontVariantNumeric: "tabular-nums", color: n?.c }}>
                          <span className="sc-interp">{n?.v}</span>
                        </span>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : null}
        {" "}
        {$v.s8 ? (
          <>
            <div className="fm-layer" style={{ opacity: $v.s8o, filter: `blur(${$v.s8b ?? ''}px)` }}>
              <div style={{ position: "absolute", left: "230px", top: "210px", width: "1460px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "40px" }}>
                {($v.whs ?? []).map((w, $i0) => (
                  <Fragment key={$i0}>
                    <section className="t-glass" style={{ padding: "32px 36px", borderRadius: "24px", display: "flex", flexDirection: "column", gap: "22px", opacity: w?.o, transform: `translateY(${w?.dy ?? ''}px)`, boxShadow: w?.sh }}>
                      <div className="t-between">
                        <div className="t-stack">
                          <span className="t-h3" style={{ fontSize: "24px" }}>
                            <span className="sc-interp">{w?.name}</span>
                          </span>
                          <span className="t-mono-sm" style={{ color: "var(--steel)" }}>
                            <span className="sc-interp">{w?.code}</span>
                          </span>
                        </div>
                        <span className={`t-badge t-badge-word ${w?.tone ?? ''}`} style={{ height: "28px", padding: "0 14px", fontSize: "13px" }}>
                          <span className="t-dot" />
                          <span className="sc-interp">{w?.status}</span>
                        </span>
                      </div>
                      <div className="t-stack" style={{ gap: "8px" }}>
                        <div className="t-between" style={{ fontSize: "16px" }}>
                          <span className="t-muted">
                            Physical reserve
                          </span>
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>
                            <span className="sc-interp">{w?.res}</span>
                            {" kg"}
                          </span>
                        </div>
                        <div style={{ height: "14px", borderRadius: "999px", background: "rgba(215,252,253,.06)" }}>
                          <div style={{ height: "100%", width: w?.rw, borderRadius: "999px", background: "#d7fcfd", boxShadow: "0 0 14px -2px rgba(215,252,253,.5)" }} />
                        </div>
                      </div>
                      <div className="t-stack" style={{ gap: "8px" }}>
                        <div className="t-between" style={{ fontSize: "16px" }}>
                          <span className="t-muted">
                            Tokenized outstanding
                          </span>
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>
                            <span className="sc-interp">{w?.out}</span>
                            {" kg"}
                          </span>
                        </div>
                        <div style={{ height: "14px", borderRadius: "999px", background: "rgba(215,252,253,.06)" }}>
                          <div style={{ height: "100%", width: w?.ow, borderRadius: "999px", background: "#8db9f2", boxShadow: "0 0 14px -2px rgba(141,185,242,.5)" }} />
                        </div>
                      </div>
                      <div className="t-between" style={{ alignItems: "flex-end" }}>
                        <span className="t-label" style={{ fontSize: "15px" }}>
                          Coverage
                        </span>
                        <span style={{ fontSize: "48px", lineHeight: "52px", fontVariantNumeric: "tabular-nums", color: w?.covC, textShadow: `0 0 26px ${w?.glow ?? ''}` }}>
                          <span className="sc-interp">{w?.cov}</span>
                        </span>
                      </div>
                    </section>
                  </Fragment>
                ))}
              </div>
              <div style={{ position: "absolute", left: "230px", top: "740px", width: "1460px", display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "8px", opacity: $v.chainO8 }}>
                {($v.chain8 ?? []).map((c, $i0) => (
                  <Fragment key={$i0}>
                    <div style={{ padding: "14px 14px", borderRadius: "16px", background: c?.bg, boxShadow: c?.sh, color: c?.fg, display: "flex", flexDirection: "column", gap: "4px", minHeight: "84px" }}>
                      <span className="t-mono-sm">
                        <span className="sc-interp">{c?.n}</span>
                      </span>
                      <span style={{ fontSize: "15px", fontWeight: "600" }}>
                        <span className="sc-interp">{c?.t}</span>
                      </span>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        ) : null}
        {" "}
        {$v.s9 ? (
          <>
            <div className="fm-layer" style={{ opacity: $v.s9o, filter: `blur(${$v.s9b ?? ''}px)` }}>
              <article style={css(`position: absolute; left: ${$v.pass9x ?? ''}px; top: ${$v.pass9y ?? ''}px; width: 500px; padding: 28px 32px; border-radius: 24px; display: flex; flex-direction: column; gap: 14px; transform: scale(${$v.pass9s ?? ''}); transform-origin: 0 0; ${$v.pass9style ?? ''}`)}>
                <div className="t-between">
                  <span className="t-eyebrow" style={{ color: "var(--steel)" }}>
                    Material passport
                  </span>
                  <span className={`t-badge ${$v.redTone ?? ''}`} style={{ height: "26px", padding: "0 12px", fontSize: "12px" }}>
                    <span className="t-dot" />
                    <span className="sc-interp">{$v.redLabel}</span>
                  </span>
                </div>
                <span className="t-mono" style={{ color: "var(--steel)", fontSize: "15px", textDecoration: $v.redStrike }}>
                  TNS-CU-00418
                </span>
                {" "}
                <span style={{ fontSize: "30px", lineHeight: "36px" }}>
                  Copper cathode, Grade A
                </span>
                {" "}
                <span className="t-sm t-sec" style={{ fontSize: "15px" }}>
                  30.000 t · Rotterdam Botlek 04 · owner Kestrel Commodities
                </span>
                {" "}
                <span className="t-cap" style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                  <span className="sc-interp">{$v.redNote}</span>
                </span>
              </article>
              <section style={{ position: "absolute", left: "820px", top: "270px", width: "900px", display: "flex", flexDirection: "column", gap: "26px", opacity: $v.tl9O }}>
                <div className="t-between">
                  <span className="t-h3" style={{ fontSize: "24px" }}>
                    Redemption RD-0104
                  </span>
                  <span className="t-cap" style={{ fontSize: "14px" }}>
                    Illustrative timeline
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0" }}>
                  {($v.tl9 ?? []).map((e, $i0) => (
                    <Fragment key={$i0}>
                      <div className="t-stack" style={{ gap: "10px", position: "relative", paddingRight: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span style={{ width: "14px", height: "14px", borderRadius: "999px", flex: "none", background: e?.dot, boxShadow: e?.glow }} />
                          <span style={{ flex: "1", height: "2px", marginLeft: "6px", background: e?.line }} />
                        </div>
                        <span style={{ fontSize: "16px", fontWeight: "600", color: e?.fg }}>
                          <span className="sc-interp">{e?.t}</span>
                        </span>
                        {" "}
                        <span className="t-cap" style={{ fontSize: "13px" }}>
                          <span className="sc-interp">{e?.d}</span>
                        </span>
                      </div>
                    </Fragment>
                  ))}
                </div>
                <div className="t-alert t-info" style={{ opacity: $v.lockO }}>
                  <span className="t-dot t-pulse" style={{ color: "var(--info)", marginTop: "7px" }} />
                  <p className="t-alert-title" style={{ fontSize: "15px" }}>
                    REDEEMING · this lot cannot be transferred while physical release is pending.
                  </p>
                </div>
              </section>
            </div>
          </>
        ) : null}
        {" "}
        {$v.s10 ? (
          <>
            <div style={{ position: "absolute", left: "0", right: "0", top: "820px", display: "flex", flexDirection: "column", alignItems: "center", gap: "18px", opacity: $v.closeO, transform: `translateY(${$v.closeDy ?? ''}px)`, filter: `blur(${$v.closeB ?? ''}px)` }}>
              <div className="t-row" style={{ gap: "18px" }}>
                <img src="/design-assets/f7ab157752a5014c52926e68ee69f6c6.png" alt="" style={{ width: "48px", height: "47px", filter: "drop-shadow(0 0 14px rgba(215,252,253,.5))" }} />
                <span className="t-wordmark" style={{ fontSize: "40px", letterSpacing: ".36em" }}>
                  TENSILE
                </span>
              </div>
              <span className="t-wordmark" style={{ fontSize: "17px", letterSpacing: ".34em", color: "#bff0ef", opacity: $v.tagO }}>
                REAL ASSETS. REAL LIQUIDITY.
              </span>
            </div>
          </>
        ) : null}
        {" "}
        <div style={{ position: "absolute", left: "72px", top: "60px", display: "flex", flexDirection: "column", gap: "8px", opacity: $v.titleO, transform: `translateY(${$v.titleDy ?? ''}px)`, pointerEvents: "none" }}>
          <span className="t-eyebrow" style={{ fontSize: "12px", color: "var(--brand-text)" }}>
            <span className="sc-interp">{$v.titleE}</span>
          </span>
          {" "}
          <span style={{ fontSize: "30px", lineHeight: "36px", fontWeight: "400", letterSpacing: "-.015em" }}>
            <span className="sc-interp">{$v.titleH}</span>
          </span>
          {" "}
          <span className="t-sm t-sec" style={{ fontSize: "16px" }}>
            <span className="sc-interp">{$v.titleSub}</span>
          </span>
        </div>
        {$v.showCap ? (
          <>
            <div style={{ position: "absolute", left: "0", right: "0", bottom: `${$v.capBottom ?? ''}px`, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ maxWidth: "1240px", padding: "12px 26px", borderRadius: "18px", background: "rgba(1,14,15,.55)", WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)", fontSize: "26px", lineHeight: "36px", textAlign: "center", color: "#f2ffff", opacity: $v.capO }}>
                <span className="sc-interp">{$v.cap}</span>
              </div>
            </div>
          </>
        ) : null}
        {" "}
        {$v.showIllus ? (
          <>
            <span className="t-mono-sm" style={{ position: "absolute", right: "64px", bottom: `${$v.illusBottom ?? ''}px`, color: "var(--text-muted)", letterSpacing: ".14em" }}>
              ILLUSTRATIVE DATA
            </span>
          </>
        ) : null}
        <div style={{ position: "absolute", inset: "0", pointerEvents: "none", background: "radial-gradient(120% 90% at 50% 45%, transparent 60%, rgba(0,6,6,.55) 100%)" }} />
        {$v.controls ? (
          <>
            <div style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "64px", padding: "0 28px", display: "flex", alignItems: "center", gap: "14px", background: "linear-gradient(180deg, transparent, rgba(0,8,8,.7))" }}>
              <button className="fm-ctl" onClick={$v.toggle} aria-label={$v.playLabel}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d={$v.playIcon} />
                </svg>
              </button>
              {" "}
              <button className="fm-ctl" onClick={$v.restart} aria-label="Restart">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 12a8 8 0 108-8H8M8 1l-3 3 3 3" />
                </svg>
              </button>
              {" "}
              <span className="t-mono-sm" style={{ width: "92px", fontWeight: "400" }}>
                <span className="sc-interp">{$v.clock}</span>
              </span>
              <div style={{ flex: "1", position: "relative", display: "flex", alignItems: "center" }}>
                <input type="range" className="fm-range" min="0" max="92" step="0.1" value={$v.t} onChange={$v.scrub} aria-label="Scrub timeline" />
              </div>
              <div className="t-row" style={{ gap: "2px" }}>
                {($v.chapters ?? []).map((c, $i0) => (
                  <Fragment key={$i0}>
                    <button className="fm-ctl" onClick={c?.go} style={{ minWidth: "30px", padding: "0 8px", fontSize: "11px", color: c?.fg }} aria-label={c?.label}>
                      <span className="sc-interp">{c?.n}</span>
                    </button>
                  </Fragment>
                ))}
              </div>
              <button className="fm-ctl" onClick={$v.toggleCap} aria-pressed={$v.capPressed} style={{ fontSize: "12px", color: $v.capFg }}>
                CC
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  }
}
