# @lp-labs/percentage-math

Percentage arithmetic on integers. Rates are `bigint` basis points (1% = 100 bps), amounts are
integers (such as cents), and every result is rounded once with a mode you can choose. Negative
amounts and rates are allowed, and results beyond a documented magnitude fail loudly.

## Install

```bash
npm install @lp-labs/percentage-math
```

ES2022 ESM and CommonJS builds ship with TypeScript declarations. There are no runtime dependencies.

## Quickstart

```js
import {
  percentOf,
  addPercent,
  removeAddedPercent,
  parsePercent,
  percentChangeBps,
} from '@lp-labs/percentage-math';

const rate = parsePercent('8.25%'); // 825n basis points
const gross = addPercent(10_000, rate);
if (gross !== 10_825n) throw new Error('unexpected total');
console.log(
  removeAddedPercent(gross, rate),
  percentOf(1999, 1250, 'ceil'),
  percentChangeBps(200, 250),
);
```

## API

```ts
type RoundingMode = 'floor' | 'ceil' | 'half-even' | 'half-up' | 'trunc';
interface Ratio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}
type PercentErrorCode =
  'invalid-input' | 'invalid-option' | 'overflow' | 'division-by-zero' | 'invalid-percent';
class PercentError extends Error {
  readonly code: PercentErrorCode;
}

const BPS_PER_UNIT: 10000n;
const MAX_MAGNITUDE: bigint; // 10n ** 36n
const MAX_CHAIN_LENGTH: 100;

type Int = bigint | number; // numbers must be safe integers
function percentOf(amount: Int, bps: Int, mode?: RoundingMode): bigint;
function addPercent(amount: Int, bps: Int, mode?: RoundingMode): bigint;
function subtractPercent(amount: Int, bps: Int, mode?: RoundingMode): bigint;
function removeAddedPercent(total: Int, bps: Int, mode?: RoundingMode): bigint;
function wholeFromPart(part: Int, bps: Int, mode?: RoundingMode): bigint;
function percentChangeBps(from: Int, to: Int, mode?: RoundingMode): bigint;
function shareBps(part: Int, total: Int, mode?: RoundingMode): bigint;
function applyPercentChain(amount: Int, bpsList: readonly Int[], mode?: RoundingMode): bigint;
function compoundBps(bpsList: readonly Int[], mode?: RoundingMode): bigint;
function ratio(numerator: Int, denominator: Int): Ratio;
function parsePercent(text: string): bigint;
function formatBps(bps: Int): string;
function percentChangeNumber(from: number, to: number): number;
function percentOfNumber(amount: number, percent: number): number;
```

- The default rounding mode is `half-even` everywhere; pass another mode when your rules differ.
  `half-up` rounds ties away from zero; `floor`, `ceil`, `trunc` are directional.
- `removeAddedPercent` inverts `addPercent` (for example, removing a sales-tax rate); because of
  rounding the round trip can differ by one unit.
- `percentChangeBps` divides by `|from|`, so a negative start that rises toward zero is a positive
  change. `from = 0` is an error.
- `applyPercentChain` multiplies exact factors and rounds only at the end; `compoundBps` returns the
  equivalent single rate.
- `parsePercent` accepts `[+-]digits[.dd][%]` with at most two decimals (exact bps only).
- `percentChangeNumber` / `percentOfNumber` are ordinary floating point returning percent values;
  they only add finite-input and finite-result checks.

## Limits and errors

All bigint inputs and results must satisfy `|x| <= 10^36` (`MAX_MAGNITUDE`), else `overflow`. Invalid
numbers (fractions, NaN, strings) throw `invalid-input`, zero denominators `division-by-zero`.

## Performance

Constant-time bigint operations; chains are at most 100 steps.

## Honest scope

Pure arithmetic. It knows nothing of currencies, tax jurisdictions, or legal rounding rules; check
that the rounding mode you choose matches the rule you need to follow.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
