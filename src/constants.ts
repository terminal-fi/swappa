// constants used internally but not expected to be used externally
export const NEGATIVE_ONE = BigInt(-1);
export const ZERO = BigInt(0);
export const ONE = BigInt(1);

// used in liquidity amount math
export const Q96 = BigInt(2) ** BigInt(96);
export const Q192 = Q96 ** BigInt(2);

export const MaxUint256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);
