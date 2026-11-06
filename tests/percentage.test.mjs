import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  percentOf,
  addPercent,
  subtractPercent,
  removeAddedPercent,
  wholeFromPart,
  percentChangeBps,
  shareBps,
  applyPercentChain,
  compoundBps,
  ratio,
  parsePercent,
  formatBps,
  percentChangeNumber,
  percentOfNumber,
  PercentError,
  MAX_MAGNITUDE,
} from '../dist/esm/index.js';

test('percentOf rounds exactly with every mode, including negative ties', () => {
  assert.equal(percentOf(1050, 1000), 105n);
  assert.equal(percentOf(25, 1000), 2n); // 2.5 -> even
  assert.equal(percentOf(35, 1000), 4n);
  assert.equal(percentOf(25, 1000, 'half-up'), 3n);
  assert.equal(percentOf(-25, 1000, 'half-up'), -3n);
  assert.equal(percentOf(-25, 1000, 'floor'), -3n);
  assert.equal(percentOf(-25, 1000, 'ceil'), -2n);
  assert.equal(percentOf(-25, 1000, 'trunc'), -2n);
  assert.equal(percentOf(25, -1000, 'half-even'), -2n);
  assert.equal(percentOf(0, 1234), 0n);
  assert.throws(() => percentOf(1, 1, 'nearest'), { code: 'invalid-option' });
});

test('percentOf matches a rational oracle over a grid', () => {
  for (let a = -120; a <= 120; a += 7) {
    for (const bps of [-2500, -1, 0, 1, 333, 1250, 10000, 25000]) {
      const exact = (a * bps) / 10000;
      assert.equal(percentOf(a, bps, 'floor'), BigInt(Math.floor(exact + 0)), `${a} ${bps}`);
      assert.equal(percentOf(a, bps, 'ceil'), BigInt(Math.ceil(exact)));
    }
  }
});

test('add, subtract, and reverse percentages', () => {
  assert.equal(addPercent(10_000, 825), 10_825n);
  assert.equal(subtractPercent(10_000, 2000), 8_000n);
  assert.equal(addPercent(10_000, -500), 9_500n);
  assert.equal(removeAddedPercent(10_825, 825), 10_000n);
  assert.equal(removeAddedPercent(10_000, 2000), 8_333n);
  assert.equal(removeAddedPercent(10_000, 2000, 'ceil'), 8_334n);
  assert.equal(wholeFromPart(250, 2500), 1000n);
  assert.equal(wholeFromPart(-250, 2500), -1000n);
  assert.throws(() => removeAddedPercent(1, -10000), { code: 'invalid-percent' });
  assert.throws(() => wholeFromPart(1, 0), { code: 'division-by-zero' });
});

test('percent change and share allow negatives and reject zero denominators', () => {
  assert.equal(percentChangeBps(200, 250), 2500n);
  assert.equal(percentChangeBps(200, 150), -2500n);
  assert.equal(percentChangeBps(-200, -150), 2500n); // improved by 25% of magnitude
  assert.equal(percentChangeBps(-200, -250), -2500n);
  assert.equal(percentChangeBps(3, 4), 3333n);
  assert.equal(shareBps(1, 3), 3333n);
  assert.equal(shareBps(2, 3), 6667n);
  assert.equal(shareBps(-1, 4), -2500n);
  assert.equal(shareBps(1, -4), -2500n);
  assert.throws(() => percentChangeBps(0, 5), { code: 'division-by-zero' });
  assert.throws(() => shareBps(5, 0), PercentError);
});

test('chains round once and compound exactly', () => {
  assert.equal(applyPercentChain(10_000, [1000, -1000]), 9_900n);
  assert.equal(compoundBps([1000, -1000]), -100n);
  assert.equal(compoundBps([5000, 5000]), 12500n);
  // 3 steps of +0.01% on 1: round once vs naive per-step rounding
  assert.equal(applyPercentChain(1_000_000, [1, 1, 1]), 1_000_300n);
  assert.equal(applyPercentChain(100, [1, 1, 1]), 100n);
  assert.throws(() => applyPercentChain(1, []), PercentError);
  assert.throws(() => compoundBps(new Array(101).fill(1)), PercentError);
});

test('ratio reduces and normalises signs; percent text is strict', () => {
  assert.deepEqual(ratio(6, -8), { numerator: -3n, denominator: 4n });
  assert.deepEqual(ratio(0, 5), { numerator: 0n, denominator: 1n });
  assert.throws(() => ratio(1, 0), PercentError);
  assert.equal(parsePercent('12.34%'), 1234n);
  assert.equal(parsePercent('7'), 700n);
  assert.equal(parsePercent('-0.5%'), -50n);
  assert.equal(parsePercent('+100%'), 10000n);
  for (const bad of ['', '%', '1.234%', '1e2', ' 5', '5 %', '.5', '5.', 'abc', '--1']) {
    assert.throws(() => parsePercent(bad), { code: 'invalid-percent' }, bad);
  }
  assert.equal(formatBps(1234), '12.34%');
  assert.equal(formatBps(-5), '-0.05%');
  assert.equal(formatBps(0), '0.00%');
});

test('explicit overflow and malformed input handling', () => {
  assert.throws(() => percentOf(MAX_MAGNITUDE + 1n, 1), { code: 'overflow' });
  assert.throws(() => percentOf(MAX_MAGNITUDE, 20000), { code: 'overflow' });
  assert.equal(percentOf(MAX_MAGNITUDE, 10000), MAX_MAGNITUDE);
  for (const bad of [1.5, NaN, '5', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => percentOf(bad, 100), { code: 'invalid-input' });
    assert.throws(() => percentOf(100, bad), { code: 'invalid-input' });
  }
});

test('floating-point helpers demand finite input and output', () => {
  assert.equal(percentChangeNumber(50, 75), 50);
  assert.equal(percentChangeNumber(-50, -25), 50);
  assert.equal(percentOfNumber(200, 12.5), 25);
  assert.throws(() => percentChangeNumber(0, 1), { code: 'division-by-zero' });
  assert.throws(() => percentChangeNumber(NaN, 1), { code: 'invalid-input' });
  assert.throws(() => percentOfNumber(Infinity, 1), { code: 'invalid-input' });
  assert.throws(() => percentOfNumber(Number.MAX_VALUE, Number.MAX_VALUE), { code: 'overflow' });
  assert.equal(
    createRequire(import.meta.url)('@lp-labs/percentage-math').percentOf(1000, 500),
    50n,
  );
});
