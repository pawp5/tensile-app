/* Number and time formatting shared by the screens (en-US grouping, as in the designs). */

const fixed = (v: number, digits: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** kg -> "5,330.000" (tonnes, 3 decimals) */
export const tonnes = (kg: number, digits = 3) => fixed(kg / 1000, digits);

/** 48_250_000 -> "48.25M" */
export function compact(v: number, digits = 2): string {
  const a = Math.abs(v);
  if (a >= 1e9) return fixed(v / 1e9, digits) + 'B';
  if (a >= 1e6) return fixed(v / 1e6, digits) + 'M';
  if (a >= 1e3) return fixed(v / 1e3, digits) + 'K';
  return fixed(v, 0);
}

/** 112_480_000 -> "$112.48M" */
export const usdCompact = (v: number) => '$' + compact(v);

/** 1.1111 -> "111.11%" */
export const pct = (ratio: number, digits = 2) => fixed(ratio * 100, digits) + '%';

export const int = (v: number) => fixed(v, 0);

/** ISO time -> "4 s" / "12 min" / "3 h" / "2 d" */
export function age(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

/** ISO time -> "4 s ago" */
export const ago = (iso: string | null | undefined, now = Date.now()) => (iso ? `${age(iso, now)} ago` : 'never');

/** Milliseconds since an ISO time (Infinity when missing). */
export const since = (iso: string | null | undefined, now = Date.now()) => (iso ? now - Date.parse(iso) : Infinity);

/** 952819 -> "952,819.00" */
export const money = (v: number, digits = 2) => fixed(v, digits);

/** 952819.5 -> ["952,819", ".50"]: the designs render cents smaller. */
export function moneyParts(v: number): [string, string] {
  const [whole, frac = '00'] = fixed(v, 2).split('.');
  return [whole, '.' + frac];
}

/** "2026-10-08T12:00:00Z" -> "2026-10-08 12:00 UTC" */
export const utc = (iso: string | null | undefined) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : '—');

/** lat/lon -> "51.880 N 4.310 E" */
export const coords = (lat: number | null | undefined, lon: number | null | undefined) =>
  lat == null || lon == null ? '—' : `${Math.abs(lat).toFixed(3)} ${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(3)} ${lon >= 0 ? 'E' : 'W'}`;
