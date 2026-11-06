import { shareBps, PercentError, MAX_MAGNITUDE } from '@lp-labs/percentage-math';

const share: bigint = shareBps(1, 3);
const code: string = new PercentError('overflow', 'x').code;
void [share, code, MAX_MAGNITUDE];
