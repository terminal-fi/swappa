import { ONE, ZERO, Q96, MaxUint256 } from "../../constants";
import { FullMath } from "./fullMath";
import { JSBI_BN } from "../JSBI_BN";
import { SwappaMathError } from "../../errors";

const MaxUint160 = JSBI_BN.subtract(
  JSBI_BN.exponentiate(BigInt(2), BigInt(160)),
  ONE
);

function multiplyIn256(x: bigint, y: bigint): bigint {
  const product = JSBI_BN.multiply(x, y);
  return JSBI_BN.bitwiseAnd(product, MaxUint256);
}

function addIn256(x: bigint, y: bigint): bigint {
  const sum = JSBI_BN.add(x, y);
  return JSBI_BN.bitwiseAnd(sum, MaxUint256);
}

export abstract class SqrtPriceMath {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static getAmount0Delta(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
    roundUp: boolean
  ): bigint {
    if (JSBI_BN.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
      [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }

    const numerator1 = JSBI_BN.leftShift(liquidity, BigInt(96));
    const numerator2 = JSBI_BN.subtract(sqrtRatioBX96, sqrtRatioAX96);

    return roundUp
      ? FullMath.mulDivRoundingUp(
          FullMath.mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96),
          ONE,
          sqrtRatioAX96
        )
      : JSBI_BN.divide(
          JSBI_BN.divide(
            JSBI_BN.multiply(numerator1, numerator2),
            sqrtRatioBX96
          ),
          sqrtRatioAX96
        );
  }

  public static getAmount1Delta(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
    roundUp: boolean
  ): bigint {
    if (JSBI_BN.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
      [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }

    return roundUp
      ? FullMath.mulDivRoundingUp(
          liquidity,
          JSBI_BN.subtract(sqrtRatioBX96, sqrtRatioAX96),
          Q96
        )
      : JSBI_BN.divide(
          JSBI_BN.multiply(
            liquidity,
            JSBI_BN.subtract(sqrtRatioBX96, sqrtRatioAX96)
          ),
          Q96
        );
  }

  public static getNextSqrtPriceFromInput(
    sqrtPX96: bigint,
    liquidity: bigint,
    amountIn: bigint,
    zeroForOne: boolean
  ): bigint {
    if (JSBI_BN.lessThanOrEqual(sqrtPX96, ZERO)) throw new SwappaMathError('SQRT_PRICE must be greater than 0');
    if (JSBI_BN.lessThanOrEqual(liquidity, ZERO)) throw new SwappaMathError('LIQUIDITY must be greater than 0');

    return zeroForOne
      ? this.getNextSqrtPriceFromAmount0RoundingUp(
          sqrtPX96,
          liquidity,
          amountIn,
          true
        )
      : this.getNextSqrtPriceFromAmount1RoundingDown(
          sqrtPX96,
          liquidity,
          amountIn,
          true
        );
  }

  public static getNextSqrtPriceFromOutput(
    sqrtPX96: bigint,
    liquidity: bigint,
    amountOut: bigint,
    zeroForOne: boolean
  ): bigint {
    if (JSBI_BN.lessThanOrEqual(sqrtPX96, ZERO)) throw new SwappaMathError('SQRT_PRICE must be greater than 0');
    if (JSBI_BN.lessThanOrEqual(liquidity, ZERO)) throw new SwappaMathError('LIQUIDITY must be greater than 0');

    return zeroForOne
      ? this.getNextSqrtPriceFromAmount1RoundingDown(
          sqrtPX96,
          liquidity,
          amountOut,
          false
        )
      : this.getNextSqrtPriceFromAmount0RoundingUp(
          sqrtPX96,
          liquidity,
          amountOut,
          false
        );
  }

  private static getNextSqrtPriceFromAmount0RoundingUp(
    sqrtPX96: bigint,
    liquidity: bigint,
    amount: bigint,
    add: boolean
  ): bigint {
    if (JSBI_BN.equal(amount, ZERO)) return sqrtPX96;
    const numerator1 = JSBI_BN.leftShift(liquidity, BigInt(96));

    if (add) {
      let product = multiplyIn256(amount, sqrtPX96);
      if (JSBI_BN.equal(JSBI_BN.divide(product, amount), sqrtPX96)) {
        const denominator = addIn256(numerator1, product);
        if (JSBI_BN.greaterThanOrEqual(denominator, numerator1)) {
          return FullMath.mulDivRoundingUp(numerator1, sqrtPX96, denominator);
        }
      }

      return FullMath.mulDivRoundingUp(
        numerator1,
        ONE,
        JSBI_BN.add(JSBI_BN.divide(numerator1, sqrtPX96), amount)
      );
    } else {
      let product = multiplyIn256(amount, sqrtPX96);

      if (!JSBI_BN.equal(JSBI_BN.divide(product, amount), sqrtPX96)) throw new SwappaMathError('INVALID_PRODUCT');
      if (JSBI_BN.lessThanOrEqual(product, numerator1)) throw new SwappaMathError('INSUFFICIENT_LIQUIDITY');
      
      const denominator = JSBI_BN.subtract(numerator1, product);
      return FullMath.mulDivRoundingUp(numerator1, sqrtPX96, denominator);
    }
  }

  private static getNextSqrtPriceFromAmount1RoundingDown(
    sqrtPX96: bigint,
    liquidity: bigint,
    amount: bigint,
    add: boolean
  ): bigint {
    if (add) {
      const quotient = JSBI_BN.lessThanOrEqual(amount, MaxUint160)
        ? JSBI_BN.divide(
            JSBI_BN.leftShift(amount, BigInt(96)),
            liquidity
          )
        : JSBI_BN.divide(JSBI_BN.multiply(amount, Q96), liquidity);

      return JSBI_BN.add(sqrtPX96, quotient);
    } else {
      const quotient = FullMath.mulDivRoundingUp(amount, Q96, liquidity);

      if (JSBI_BN.lessThanOrEqual(sqrtPX96, quotient)) throw new SwappaMathError('INSUFFICIENT_LIQUIDITY');
      return JSBI_BN.subtract(sqrtPX96, quotient);
    }
  }
}
