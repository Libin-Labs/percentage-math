export type RoundingMode = 'floor' | 'ceil' | 'half-even' | 'half-up' | 'trunc';

export interface Ratio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export type PercentErrorCode =
  'invalid-input' | 'invalid-option' | 'overflow' | 'division-by-zero' | 'invalid-percent';

export class PercentError extends Error {
  readonly code: PercentErrorCode;
  constructor(code: PercentErrorCode, message: string) {
    super(message);
    this.name = 'PercentError';
    this.code = code;
  }
}

/** One percent is 100 basis points; 100% is 10000. */
export const BPS_PER_UNIT = 10000n;
/** Largest magnitude accepted for any bigint input or produced by any bigint result. */
export const MAX_MAGNITUDE = 10n ** 36n;
export const MAX_CHAIN_LENGTH = 100;

const MODES: readonly RoundingMode[] = ['floor', 'ceil', 'half-even', 'half-up', 'trunc'];

function check(value: unknown, name: string): bigint {
  let result: bigint;
  if (typeof value === 'bigint') result = value;
  else if (typeof value === 'number' && Number.isSafeInteger(value)) result = BigInt(value);
  else throw new PercentError('invalid-input', `${name} must be a bigint or safe integer.`);
  if (result > MAX_MAGNITUDE || result < -MAX_MAGNITUDE) {
    throw new PercentError('overflow', `${name} exceeds the supported magnitude of 10^36.`);
  }
  return result;
}

function out(value: bigint): bigint {
  if (value > MAX_MAGNITUDE || value < -MAX_MAGNITUDE) {
    throw new PercentError('overflow', 'Result exceeds the supported magnitude of 10^36.');
  }
  return value;
}

function divRound(n: bigint, d: bigint, mode: RoundingMode): bigint {
  if (!MODES.includes(mode)) throw new PercentError('invalid-option', 'Unknown rounding mode.');
  if (d === 0n) throw new PercentError('division-by-zero', 'Division by zero.');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const q = n / d;
  const r = n % d;
  if (r === 0n) return q;
  const negative = n < 0n;
  const away = negative ? q - 1n : q + 1n;
  const twice = (r < 0n ? -r : r) * 2n;
  switch (mode) {
    case 'trunc':
      return q;
    case 'floor':
      return negative ? away : q;
    case 'ceil':
      return negative ? q : away;
    case 'half-up':
      return twice >= d ? away : q;
    case 'half-even':
      return twice > d || (twice === d && q % 2n !== 0n) ? away : q;
  }
}

/** `amount * bps / 10000`, rounded once. Negative amounts and rates are allowed. */
export function percentOf(
  amount: bigint | number,
  bps: bigint | number,
  mode: RoundingMode = 'half-even',
): bigint {
  return out(divRound(check(amount, 'amount') * check(bps, 'bps'), BPS_PER_UNIT, mode));
}

/** `amount * (10000 + bps) / 10000`. */
export function addPercent(
  amount: bigint | number,
  bps: bigint | number,
  mode: RoundingMode = 'half-even',
): bigint {
  return out(
    divRound(check(amount, 'amount') * (BPS_PER_UNIT + check(bps, 'bps')), BPS_PER_UNIT, mode),
  );
}

export function subtractPercent(
  amount: bigint | number,
  bps: bigint | number,
  mode: RoundingMode = 'half-even',
): bigint {
  return out(
    divRound(check(amount, 'amount') * (BPS_PER_UNIT - check(bps, 'bps')), BPS_PER_UNIT, mode),
  );
}

/** Inverse of `addPercent`: the base that grew by `bps` to reach `total` (e.g. strip tax). */
export function removeAddedPercent(
  total: bigint | number,
  bps: bigint | number,
  mode: RoundingMode = 'half-even',
): bigint {
  const rate = check(bps, 'bps');
  if (BPS_PER_UNIT + rate <= 0n) {
    throw new PercentError('invalid-percent', 'bps must be greater than -10000.');
  }
  return out(divRound(check(total, 'total') * BPS_PER_UNIT, BPS_PER_UNIT + rate, mode));
}

/** The whole that `part` represents at `bps` percent: `part * 10000 / bps`. */
export function wholeFromPart(
  part: bigint | number,
  bps: bigint | number,
  mode: RoundingMode = 'half-even',
): bigint {
  const rate = check(bps, 'bps');
  if (rate === 0n) throw new PercentError('division-by-zero', 'bps must not be zero.');
  return out(divRound(check(part, 'part') * BPS_PER_UNIT, rate, mode));
}

/** `(to - from) / |from|` in basis points. A negative `from` keeps the sign of the actual change. */
export function percentChangeBps(
  from: bigint | number,
  to: bigint | number,
  mode: RoundingMode = 'half-even',
): bigint {
  const start = check(from, 'from');
  if (start === 0n) throw new PercentError('division-by-zero', 'from must not be zero.');
  const magnitude = start < 0n ? -start : start;
  return out(divRound((check(to, 'to') - start) * BPS_PER_UNIT, magnitude, mode));
}

/** `part / total` in basis points. */
export function shareBps(
  part: bigint | number,
  total: bigint | number,
  mode: RoundingMode = 'half-even',
): bigint {
  return out(divRound(check(part, 'part') * BPS_PER_UNIT, check(total, 'total'), mode));
}

function chain(bpsList: readonly (bigint | number)[]): bigint[] {
  if (!Array.isArray(bpsList) || bpsList.length < 1 || bpsList.length > MAX_CHAIN_LENGTH) {
    throw new PercentError('invalid-input', `bpsList must hold 1 to ${MAX_CHAIN_LENGTH} entries.`);
  }
  return bpsList.map((value) => check(value, 'bps'));
}

/** Applies successive percentage changes and rounds only once at the end. */
export function applyPercentChain(
  amount: bigint | number,
  bpsList: readonly (bigint | number)[],
  mode: RoundingMode = 'half-even',
): bigint {
  const steps = chain(bpsList);
  let numerator = check(amount, 'amount');
  for (const step of steps) numerator *= BPS_PER_UNIT + step;
  return out(divRound(numerator, BPS_PER_UNIT ** BigInt(steps.length), mode));
}

/** The single equivalent change in basis points for successive changes, rounded once. */
export function compoundBps(
  bpsList: readonly (bigint | number)[],
  mode: RoundingMode = 'half-even',
): bigint {
  const steps = chain(bpsList);
  let numerator = 1n;
  for (const step of steps) numerator *= BPS_PER_UNIT + step;
  const scale = BPS_PER_UNIT ** BigInt(steps.length);
  return out(divRound((numerator - scale) * BPS_PER_UNIT, scale, mode));
}

export function ratio(numerator: bigint | number, denominator: bigint | number): Ratio {
  let n = check(numerator, 'numerator');
  let d = check(denominator, 'denominator');
  if (d === 0n) throw new PercentError('division-by-zero', 'denominator must not be zero.');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  let a = n < 0n ? -n : n;
  let b = d;
  while (b !== 0n) [a, b] = [b, a % b];
  return Object.freeze({ numerator: n / a, denominator: d / a });
}

/** Parses `"12.34%"` or `"12.34"` (also `+`/`-`) into basis points; at most two decimals. */
export function parsePercent(text: string): bigint {
  const match =
    typeof text === 'string' ? /^([+-]?)(\d{1,30})(?:\.(\d{1,2}))?%?$/.exec(text) : null;
  if (!match) throw new PercentError('invalid-percent', 'Expected a percent such as "12.5%".');
  const value = BigInt((match[2] ?? '0') + (match[3] ?? '').padEnd(2, '0'));
  return match[1] === '-' ? -value : value;
}

export function formatBps(bps: bigint | number): string {
  const value = check(bps, 'bps');
  const digits = (value < 0n ? -value : value).toString().padStart(3, '0');
  return `${value < 0n ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}%`;
}

function finite(value: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PercentError('invalid-input', `${name} must be a finite number.`);
  }
  return value;
}

function finiteResult(value: number): number {
  if (!Number.isFinite(value)) throw new PercentError('overflow', 'Result is not finite.');
  return value;
}

/** Floating-point percent change (as percent, not bps); inputs and result must be finite. */
export function percentChangeNumber(from: number, to: number): number {
  const start = finite(from, 'from');
  if (start === 0) throw new PercentError('division-by-zero', 'from must not be zero.');
  return finiteResult(((finite(to, 'to') - start) / Math.abs(start)) * 100);
}

/** Floating-point `percent`% of `amount`; inputs and result must be finite. */
export function percentOfNumber(amount: number, percent: number): number {
  return finiteResult((finite(amount, 'amount') * finite(percent, 'percent')) / 100);
}
