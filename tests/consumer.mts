import { percentOf, parsePercent, type Ratio, type RoundingMode } from '@lp-labs/percentage-math';

const mode: RoundingMode = 'ceil';
const tax: bigint = percentOf(10_000n, parsePercent('8.25%'), mode);
const fraction: Ratio = { numerator: 1n, denominator: 2n };
void [tax, fraction];
