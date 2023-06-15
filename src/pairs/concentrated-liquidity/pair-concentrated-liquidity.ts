import { Address, BigNumberString, Pair, Snapshot } from "../../pair";

import { TickMath } from "../../utils/concentrated-liquidity/tickMath";
import { SwapMath } from "../../utils/concentrated-liquidity/swapMath";
import { LiquidityMath } from "../../utils/concentrated-liquidity/liquidityMath";

import { NEGATIVE_ONE, ONE, UniV3FeeAmount, ZERO } from "../../constants";
import { JSBI_BN } from "../../utils/JSBI_BN";
import BigNumber from "bignumber.js";
import { SwappaMathError } from "../../errors";

export interface SpotTicksPayload {
  sqrtPriceX96: string;
  tick: string;
  populatedTicksTwiceAbove: {
    tick: string;
    liquidityNet: string;
    liquidityGross: string;
  }[];
  populatedTicksAbove: {
    tick: string;
    liquidityNet: string;
    liquidityGross: string;
  }[];
  populatedTicksSpot: {
    tick: string;
    liquidityNet: string;
    liquidityGross: string;
  }[];
  populatedTicksBelow: {
    tick: string;
    liquidityNet: string;
    liquidityGross: string;
  }[];
  populatedTicksTwiceBelow: {
    tick: string;
    liquidityNet: string;
    liquidityGross: string;
  }[];
}

interface PairConcentratedLiquiditySnapshot extends Snapshot {
  tick: number;
  liquidity: BigNumberString;
  ticks: (Omit<PopulatedTick, "liquidityNet" | "liquidityGross"> & {
    liquidityNet: BigNumberString;
    liquidityGross: BigNumberString;
  })[];
  sqrtRatioX96: BigNumberString;
  tickIndex: number;
  swapFee: UniV3FeeAmount;
}

interface PopulatedTick {
  bitPos: number;
  wordPos: number;
  tick: number;
  liquidityNet: bigint;
  liquidityGross: bigint;
}

interface StepComputations {
  sqrtPriceStartX96: bigint;
  tickIndexNext: number;
  tickNext: number;
  initialized: boolean;
  sqrtPriceNextX96: bigint;
  amountIn: bigint;
  amountOut: bigint;
  feeAmount: bigint;
}

export abstract class PairContentratedLiquidity extends Pair {
  protected swapFee: UniV3FeeAmount = UniV3FeeAmount.LOW; // in 100 bps
  protected tick?: number;
  protected liquidity?: bigint;

  // Ticks is sorted primarily by wordPosition, and then by bitPosition.
  // In this way, decreasing the index by 1 shifts to the left tick and increasing shifts to the right
  // Without having to worry about stepping up between words
  protected ticks: PopulatedTick[] = [];
  protected tickToIndex: { [tick: number]: number } = {};
  protected sqrtRatioX96?: bigint;

  // Tick index is calculated based on the positon of the current tick within the tick's wordPosition
  protected tickIndex?: number;

  public abstract outputAmountAsync(
    inputToken: Address,
    inputAmount: bigint,
    outputToken: string
  ): Promise<bigint>;

  public static transformGetSpotTicksPayload({
    sqrtPriceX96,
    tick,
    populatedTicksTwiceAbove,
    populatedTicksAbove,
    populatedTicksBelow,
    populatedTicksSpot,
    populatedTicksTwiceBelow,
  }: SpotTicksPayload) {
    const tickToIndex: { [tick: number]: number } = {};
    const foundTick: Set<number> = new Set();
    const ticks: PopulatedTick[] = [
      ...populatedTicksTwiceBelow,
      ...populatedTicksBelow,
      ...populatedTicksSpot,
      ...populatedTicksAbove,
      ...populatedTicksTwiceAbove,
      {
        tick,
        liquidityNet: 0,
        liquidityGross: 0,
      },
    ]
      .map(({ tick: tick_bn, liquidityNet, liquidityGross }) => {
        const tick = parseInt(tick_bn.toString());
        const { wordPos, bitPos } = TickMath.position(tick);
        return {
          wordPos,
          bitPos,
          tick,
          liquidityNet: BigInt(liquidityNet.toString()),
          liquidityGross: BigInt(liquidityGross.toString()),
        };
      })
      .filter(({ tick }) => {
        if (foundTick.has(tick)) return false;
        foundTick.add(tick);
        return true;
      })
      .sort((t1, t2) => {
        if (t1.wordPos < t2.wordPos) return -1;
        else if (t1.wordPos > t2.wordPos) return 1;
        if (t1.bitPos < t2.bitPos) return -1;
        return 1;
      });
    for (let i = 0; i < ticks.length; i++) {
      tickToIndex[ticks[i].tick] = i;
    }

    return {
      ticks,
      tickToIndex,
      tick: parseInt(tick.toString()),
      sqrtPriceX96: BigInt(sqrtPriceX96.toString()),
    };
  }

  // TODO: change from native BigInt to BigNumber, so that this wrapper is not needed
  public outputAmount(inputToken: string, inputAmount: BigNumber): BigNumber {
    const bnOutput = this._outputAmount(
      inputToken,
      BigInt(inputAmount.toFixed(0))
    );

    return new BigNumber(bnOutput.toString());
  }

  // ref: https://github.com/Uniswap/v3-sdk/blob/main/src/entities/pool.ts
  private _outputAmount(inputToken: Address, inputAmount: bigint): bigint {
    const zeroForOne = inputToken === this.tokenA;
    const sqrtPriceLimitX96 = zeroForOne
      ? TickMath.MIN_SQRT_RATIO + ONE
      : TickMath.MAX_SQRT_RATIO - ONE;

    if (zeroForOne && sqrtPriceLimitX96 >= (this.sqrtRatioX96 ?? -1))
      throw new SwappaMathError("RATIO_CURRENT");
    else if (sqrtPriceLimitX96 <= (this.sqrtRatioX96 ?? -1))
      throw new SwappaMathError("RATIO_CURRENT");

    const state = {
      tickIndex: this.tickIndex ?? 1,
      amountSpecifiedRemaining: inputAmount,
      amountCalculated: ZERO,
      sqrtPriceX96: this.sqrtRatioX96,
      tick: this.tick,
      liquidity: this.liquidity,
    };

    while (
      state.amountSpecifiedRemaining != ZERO &&
      state.sqrtPriceX96 != sqrtPriceLimitX96
    ) {
      let step: Partial<StepComputations> = {};
      step.sqrtPriceStartX96 = state.sqrtPriceX96;

      step.tickIndexNext = zeroForOne
        ? state.tickIndex - 1
        : state.tickIndex + 1;

      // If we have exceeded the ticks then we cannot reasonably calculate any more. Output will be atleast what we have calculated so far
      // This indicates that the pool is not deep enough to handle the swap within the tick space we retrieved
      // In most cases, this will not happen, but it is possible if the pool is very shallow
      if (step.tickIndexNext < 0 || step.tickIndexNext >= this.ticks.length)
        return state.amountCalculated;

      step.tickNext = this.ticks[step.tickIndexNext].tick;

      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK;
      } else if (step.tickNext > TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK;
      }

      step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext);
      [state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] =
        SwapMath.computeSwapStep(
          state.sqrtPriceX96 as bigint,
          (
            zeroForOne
              ? step.sqrtPriceNextX96 < sqrtPriceLimitX96
              : step.sqrtPriceNextX96 > sqrtPriceLimitX96
          )
            ? sqrtPriceLimitX96
            : (step.sqrtPriceNextX96 as bigint),
          state.liquidity as bigint,
          state.amountSpecifiedRemaining,
          this.swapFee as UniV3FeeAmount
        );
      state.amountSpecifiedRemaining =
        state.amountSpecifiedRemaining - (step.amountIn + step.feeAmount);
      state.amountCalculated = state.amountCalculated + step.amountOut;

      if (JSBI_BN.equal(state.sqrtPriceX96, step.sqrtPriceNextX96 ?? 0)) {
        // if the tick is initialized, run the tick transition
        if (step.initialized) {
          let liquidityNet = BigInt(
            this.ticks[step.tickIndexNext].liquidityNet
          );

          // if we're moving leftward, we interpret liquidityNet as the opposite sign
          // safe because liquidityNet cannot be type(int128).min
          if (zeroForOne)
            liquidityNet = JSBI_BN.multiply(liquidityNet, NEGATIVE_ONE);

          state.liquidity = LiquidityMath.addDelta(
            state.liquidity ?? BigInt(0),
            liquidityNet
          );
        }

        state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext;
        state.tickIndex = this.tickToIndex[step.tickNext];
      } else if (
        JSBI_BN.notEqual(
          state.sqrtPriceX96,
          step.sqrtPriceStartX96 ?? BigInt(0)
        )
      ) {
        // updated comparison function
        // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
        state.tickIndex = this.tickToIndex[state.tick];
      }
    }

    return state.amountCalculated;
  }

  public getSwapFee() {
    return this.swapFee;
  }

  public restore(snapshot: PairConcentratedLiquiditySnapshot): void {
    this.swapFee = snapshot.swapFee;
    this.tick = snapshot.tick;
    this.liquidity = BigInt(snapshot.liquidity);
    this.sqrtRatioX96 = BigInt(snapshot.sqrtRatioX96);
    this.tickIndex = snapshot.tickIndex;

    const ticks: PopulatedTick[] = new Array(snapshot.ticks.length);
    const tickToIndex: Record<number, number> = {};

    for (let i = 0; i < snapshot.ticks.length; i++) {
      const { liquidityGross, liquidityNet, tick, ...rest } = snapshot.ticks[i];
      const populatedTick: PopulatedTick = {
        ...rest,
        liquidityGross: BigInt(liquidityGross),
        liquidityNet: BigInt(liquidityNet),
        tick,
      };

      ticks[i] = populatedTick;
      tickToIndex[populatedTick.tick] = i;
    }
  }

  public snapshot(): PairConcentratedLiquiditySnapshot {
    if (
      !this.tick ||
      !this.sqrtRatioX96 ||
      !this.liquidity ||
      this.tickIndex === undefined
    )
      throw new Error("Pair not initialized");
    return {
      swapFee: this.swapFee,
      tick: this.tick,
      liquidity: this.liquidity.toString(),
      sqrtRatioX96: this.sqrtRatioX96.toString(),
      ticks: this.ticks.map(({ liquidityGross, liquidityNet, ...rest }) => ({
        ...rest,
        liquidityGross: liquidityGross.toString(),
        liquidityNet: liquidityNet.toString(),
      })),
      tickIndex: this.tickIndex,
    };
  }
}
