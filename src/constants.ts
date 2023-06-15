// constants used internally but not expected to be used externally
export const NEGATIVE_ONE = BigInt(-1);
export const ZERO = BigInt(0);
export const ONE = BigInt(1);

// used in liquidity amount math
export const Q96 = BigInt(2) ** BigInt(96);
export const Q192 = Q96 ** BigInt(2);

/**
 * The default factory enabled fee amounts, denominated in hundredths of bips.
 */
export enum UniV3FeeAmount {
  LOWEST = 100,
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

/**
 * The default factory tick spacings by fee amount.
 */
export const TICK_SPACINGS: { [amount in UniV3FeeAmount]: number } = {
  [UniV3FeeAmount.LOWEST]: 1,
  [UniV3FeeAmount.LOW]: 10,
  [UniV3FeeAmount.MEDIUM]: 60,
  [UniV3FeeAmount.HIGH]: 200,
};

export const MaxUint256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

export const KNOWN_FEE_ON_TRANSFER_TOKENS: Partial<{
  [chain: number]: string[];
}> = {
  [42220]: [
    "0x22401536505dd5d85F7d57f8B37172feDa8f499d",
    "0xD90BBdf5904cb7d275c41f897495109B9A5adA58",
    "0x918146359264C492BD6934071c6Bd31C854EDBc3",
    "0xE273Ad7ee11dCfAA87383aD5977EE1504aC07568",
    "0x7D00cd74FF385c955EA3d79e47BF06bD7386387D",
    "0x9802d866fdE4563d088a6619F7CeF82C0B991A55",
  ].map((s) => s.toLowerCase()),
};
