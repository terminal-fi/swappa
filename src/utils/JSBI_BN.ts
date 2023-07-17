
// Helper class makes it easier to switch underlying bigint lib for univ3 math
export class JSBI_BN {
  private constructor() {}

  public static exponentiate = (n1: bigint, n2: bigint) =>
    n1 ** n2;

  public static toNumber = (num: bigint) => Math.floor(Number(num));

  public static greaterThanOrEqual = (n1: bigint, n2: bigint) =>
    n1 >= n2;

  public static divide = (numerator: bigint, denominator: bigint) =>
    numerator / denominator;

  public static remainder = (numerator: bigint, denominator: bigint) =>
    numerator % denominator;

  public static multiply = (left: bigint, right: bigint) =>
    left * right;

  public static subtract = (left: bigint, right: bigint) =>
    left - right;

  public static add = (left: bigint, right: bigint) =>
    left + right;

  public static greaterThan = (left: bigint, right: bigint) =>
    left > right;

  public static notEqual = (n1: bigint, n2: bigint) => n1 != n2;

  public static lessThanOrEqual = (left: bigint, right: bigint) =>
    left <= right;

  public static lessThan = (left: bigint, right: bigint) =>
    left < right;

  public static equal = (n1: bigint, n2: bigint) => n1 == n2;

  public static leftShift = (n: bigint, shiftBy: bigint) => {
    return n << shiftBy;
  };

  public static signedRightShift = (n: bigint, shiftBy: bigint) => {
    return n >> shiftBy;
  };

  public static bitwiseAnd = (n1: bigint, n2: bigint) => {
    return n1 & n2;
  };

  public static bitwiseOr = (n1: bigint, n2: bigint) => {
    return n1 | n2;
  };
}
