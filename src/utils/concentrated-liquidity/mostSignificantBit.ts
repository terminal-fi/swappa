import { ZERO, MaxUint256 } from "../../constants";
import { JSBI_BN } from "../JSBI_BN";
import { SwappaMathError } from "../../errors";

const TWO = BigInt(2);
const POWERS_OF_2 = [128, 64, 32, 16, 8, 4, 2, 1].map(
  (pow: number): [number, bigint] => [
    pow,
    JSBI_BN.exponentiate(TWO, BigInt(pow)),
  ]
);

export function mostSignificantBit(x: bigint): number {
  if (JSBI_BN.lessThanOrEqual(x, ZERO)) throw new SwappaMathError("mostSignificantBit must be gt 0")
  if (JSBI_BN.greaterThan(x, MaxUint256)) throw new SwappaMathError("mostSignificantBit must be lt MaxUint256")

  let msb: number = 0;
  for (const [power, min] of POWERS_OF_2) {
    if (JSBI_BN.greaterThanOrEqual(x, min)) {
      x = JSBI_BN.signedRightShift(x, BigInt(power));
      msb += power;
    }
  }
  return msb;
}
