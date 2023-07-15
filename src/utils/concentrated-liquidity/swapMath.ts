import { NEGATIVE_ONE, ZERO } from "../../constants";
import { FullMath } from "./fullMath";
import { SqrtPriceMath } from "./sqrtPriceMath";
import { JSBI_BN } from "../JSBI_BN";

const MAX_FEE = JSBI_BN.exponentiate(BigInt(10), BigInt(6));

/**
 * The default factory enabled fee amounts, denominated in hundredths of bips.
 */
export enum UniV3FeeAmount {
  LOWEST = 100,
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

export const UniV3FeeAmounts = Object.keys(UniV3FeeAmount).map((v) => Number(v)).filter((v) => !isNaN(v))

/**
 * The default factory tick spacings by fee amount.
 */
export const TICK_SPACINGS: { [amount in UniV3FeeAmount]: number } = {
  [UniV3FeeAmount.LOWEST]: 1,
  [UniV3FeeAmount.LOW]: 10,
  [UniV3FeeAmount.MEDIUM]: 60,
  [UniV3FeeAmount.HIGH]: 200,
};

export abstract class SwapMath {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static computeSwapStep(
    sqrtRatioCurrentX96: bigint,
    sqrtRatioTargetX96: bigint,
    liquidity: bigint,
    amountRemaining: bigint,
    feePips: UniV3FeeAmount
  ): [bigint, bigint, bigint, bigint] {
    const returnValues: Partial<{
      sqrtRatioNextX96: bigint;
      amountIn: bigint;
      amountOut: bigint;
      UniV3FeeAmount: bigint;
    }> = {};

    const zeroForOne = JSBI_BN.greaterThanOrEqual(
      sqrtRatioCurrentX96,
      sqrtRatioTargetX96
    );
    const exactIn = JSBI_BN.greaterThanOrEqual(amountRemaining, ZERO);

    if (exactIn) {
      const amountRemainingLessFee = JSBI_BN.divide(
        JSBI_BN.multiply(
          amountRemaining,
          JSBI_BN.subtract(MAX_FEE, BigInt(feePips))
        ),
        MAX_FEE
      );
      returnValues.amountIn = zeroForOne
        ? SqrtPriceMath.getAmount0Delta(
            sqrtRatioTargetX96,
            sqrtRatioCurrentX96,
            liquidity,
            true
          )
        : SqrtPriceMath.getAmount1Delta(
            sqrtRatioCurrentX96,
            sqrtRatioTargetX96,
            liquidity,
            true
          );
      if (
        JSBI_BN.greaterThanOrEqual(
          amountRemainingLessFee,
          returnValues.amountIn!
        )
      ) {
        returnValues.sqrtRatioNextX96 = sqrtRatioTargetX96;
      } else {
        returnValues.sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromInput(
          sqrtRatioCurrentX96,
          liquidity,
          amountRemainingLessFee,
          zeroForOne
        );
      }
    } else {
      returnValues.amountOut = zeroForOne
        ? SqrtPriceMath.getAmount1Delta(
            sqrtRatioTargetX96,
            sqrtRatioCurrentX96,
            liquidity,
            false
          )
        : SqrtPriceMath.getAmount0Delta(
            sqrtRatioCurrentX96,
            sqrtRatioTargetX96,
            liquidity,
            false
          );
      if (
        JSBI_BN.greaterThanOrEqual(
          JSBI_BN.multiply(amountRemaining, NEGATIVE_ONE),
          returnValues.amountOut ?? 0
        )
      ) {
        returnValues.sqrtRatioNextX96 = sqrtRatioTargetX96;
      } else {
        returnValues.sqrtRatioNextX96 =
          SqrtPriceMath.getNextSqrtPriceFromOutput(
            sqrtRatioCurrentX96,
            liquidity,
            JSBI_BN.multiply(amountRemaining, NEGATIVE_ONE),
            zeroForOne
          );
      }
    }

    const max = JSBI_BN.equal(
      sqrtRatioTargetX96,
      returnValues.sqrtRatioNextX96 ?? 0
    );

    if (zeroForOne) {
      returnValues.amountIn =
        max && exactIn
          ? returnValues.amountIn
          : SqrtPriceMath.getAmount0Delta(
              returnValues.sqrtRatioNextX96,
              sqrtRatioCurrentX96,
              liquidity,
              true
            );
      returnValues.amountOut =
        max && !exactIn
          ? returnValues.amountOut
          : SqrtPriceMath.getAmount1Delta(
              returnValues.sqrtRatioNextX96,
              sqrtRatioCurrentX96,
              liquidity,
              false
            );
    } else {
      returnValues.amountIn =
        max && exactIn
          ? returnValues.amountIn
          : SqrtPriceMath.getAmount1Delta(
              sqrtRatioCurrentX96,
              returnValues.sqrtRatioNextX96,
              liquidity,
              true
            );
      returnValues.amountOut =
        max && !exactIn
          ? returnValues.amountOut
          : SqrtPriceMath.getAmount0Delta(
              sqrtRatioCurrentX96,
              returnValues.sqrtRatioNextX96,
              liquidity,
              false
            );
    }

    if (
      !exactIn &&
      JSBI_BN.greaterThan(
        returnValues.amountOut!,
        JSBI_BN.multiply(amountRemaining, NEGATIVE_ONE)
      )
    ) {
      returnValues.amountOut = JSBI_BN.multiply(amountRemaining, NEGATIVE_ONE);
    }

    if (
      exactIn &&
      JSBI_BN.notEqual(sqrtRatioTargetX96, returnValues.sqrtRatioNextX96)
    ) {
      // we didn't reach the target, so take the remainder of the maximum input as fee
      returnValues.UniV3FeeAmount = JSBI_BN.subtract(
        amountRemaining,
        returnValues.amountIn!
      );
    } else {
      returnValues.UniV3FeeAmount = FullMath.mulDivRoundingUp(
        returnValues.amountIn!,
        BigInt(feePips),
        JSBI_BN.subtract(MAX_FEE, BigInt(feePips))
      );
    }

    return [
      returnValues.sqrtRatioNextX96!,
      returnValues.amountIn!,
      returnValues.amountOut!,
      returnValues.UniV3FeeAmount!,
    ];
  }
}
