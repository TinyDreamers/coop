/** Small formatting helpers shared across the UI. */

export function money(n: number | undefined | null): string {
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function num(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

/** Convert inches to a "6′ 4″" style string for cut lists. */
export function inchesToFtIn(inches: number): string {
  const whole = Math.round(inches * 16) / 16; // nearest 1/16"
  const ft = Math.floor(whole / 12);
  const rem = whole - ft * 12;
  const inchWhole = Math.floor(rem);
  const frac = rem - inchWhole;
  const sixteenths = Math.round(frac * 16);
  let fracStr = '';
  if (sixteenths > 0) {
    const g = gcd(sixteenths, 16);
    fracStr = ` ${sixteenths / g}/${16 / g}`;
  }
  const parts: string[] = [];
  if (ft > 0) parts.push(`${ft}′`);
  if (inchWhole > 0 || fracStr || ft === 0) parts.push(`${inchWhole}${fracStr}″`);
  return parts.join(' ');
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : plural ?? `${singular}s`;
}

export const PRICE_SOURCE_LABEL: Record<string, string> = {
  default: 'Cached',
  cached: 'Cached',
  live: 'Live',
  manual: 'Manual',
  failed: 'Unavailable',
};

export const PRICE_SOURCE_STYLE: Record<string, string> = {
  default: 'bg-slate-100 text-slate-600',
  cached: 'bg-slate-100 text-slate-600',
  live: 'bg-moss-100 text-moss-700',
  manual: 'bg-blueprint-100 text-blueprint-700',
  failed: 'bg-amber-100 text-amber-700',
};
