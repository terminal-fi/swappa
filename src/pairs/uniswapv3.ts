import BigNumber from "bignumber.js";
import Web3 from "web3";
import JSBI from "jsbi"
import invariant from 'tiny-invariant'

import {
  FeeAmount, LiquidityMath, SwapMath,
  TICK_SPACINGS, Tick, TickList, TickMath, isSorted
} from "@uniswap/v3-sdk";

import { Address, Pair, Snapshot } from "../pair";
import {
  PairUniswapV3 as PairUniswapV3Contract,
  ABI as PairUniswapV3ABI,
} from "../../types/web3-v1-contracts/PairUniswapV3";
import {
  IUniswapV3Pool,
  ABI as V3PoolABI,
} from "../../types/web3-v1-contracts/IUniswapV3Pool";
import { selectAddress } from "../utils";
import { address as pairUniV3Address } from "../../tools/deployed/mainnet.PairUniswapV3.addr.json";

const ONE = JSBI.BigInt(1)
const NEGATIVE_ONE = JSBI.BigInt(-1)
const ZERO = JSBI.BigInt(0)

interface StepComputations {
  sqrtPriceStartX96: JSBI
  tickNext: number
  initialized: boolean
  sqrtPriceNextX96: JSBI
  amountIn: JSBI
  amountOut: JSBI
  feeAmount: JSBI
}

export class PairUniswapV3 extends Pair {
  allowRepeats = false;
  private swappaPool: PairUniswapV3Contract;
  private swapPool: IUniswapV3Pool;

  private fee: FeeAmount = FeeAmount.LOW
  private sqrtRatioX96: JSBI = ZERO
  private liquidity: JSBI = ZERO
  private tickCurrent: number = 0
  private ticks: Tick[] = []

  constructor(chainId: number, private web3: Web3, private pairAddr: Address) {
    super(web3, selectAddress(chainId, { mainnet: pairUniV3Address }));
    const univ3SwappaPairAddr = selectAddress(chainId, { mainnet: pairUniV3Address });

    this.pairKey = pairAddr;

    this.swapPool = new this.web3.eth.Contract(
      V3PoolABI,
      pairAddr
    ) as unknown as IUniswapV3Pool;
    this.swappaPool = new this.web3.eth.Contract(
      PairUniswapV3ABI,
      univ3SwappaPairAddr
    ) as unknown as PairUniswapV3Contract;
  }

  protected async _init() {
    const [tokenA, tokenB, fee] = await Promise.all([
      this.swapPool.methods.token0().call(),
      this.swapPool.methods.token1().call(),
      this.swapPool.methods.fee().call(),
    ]);
    this.fee = parseInt(fee.toString()) as FeeAmount;
    return {
      pairKey: this.pairAddr,
      tokenA,
      tokenB,
    };
  }

  public async refresh() {
    let info = await this.swappaPool.methods.getPoolTicks(this.pairAddr, 20).call()
    this.tickCurrent = Number.parseInt(info.tick)
    this.sqrtRatioX96 = JSBI.BigInt(info.sqrtPriceX96)
    this.liquidity = JSBI.BigInt(info.liquidity)

    this.ticks = [
      ...info.populatedTicks0,
      ...info.populatedTicks1,
      ...info.populatedTicks2,
      ...info.populatedTicks3,
      ...info.populatedTicks4,
    ].map((i) => new Tick({
      index: Number.parseInt(i.tick),
      liquidityGross: i.liquidityGross,
      liquidityNet: i.liquidityNet,
    }))
    .sort((a, b) => a.index - b.index)
    invariant(this.ticks.every(({ index }) => index % this.tickSpacing === 0), 'Univ3: TICK_SPACING')
    invariant(this.ticks.every(({ index }, idx) => idx === 0 || this.ticks[idx - 1].index < index), 'Univ3: TICK_DUPLICATES')
  }

  protected swapExtraData() {
    return this.pairAddr;
  }

  private get tickSpacing(): number {
    return TICK_SPACINGS[this.fee]
  }

  public outputAmount(inputToken: string, inputAmount: BigNumber): BigNumber {
    if (this.ticks.length === 0) {
      return new BigNumber(0)
    }
    // Based ON: https://github.com/Uniswap/v3-sdk/blob/81d66099f07d1ec350767f497ef73222575fe032/src/entities/pool.ts#L215
    const zeroForOne = inputToken === this.tokenA
    const sqrtPriceLimitX96 = zeroForOne
      ? JSBI.add(TickMath.MIN_SQRT_RATIO, ONE)
      : JSBI.subtract(TickMath.MAX_SQRT_RATIO, ONE)

    if (zeroForOne) {
      invariant(JSBI.greaterThan(sqrtPriceLimitX96, TickMath.MIN_SQRT_RATIO), 'RATIO_MIN')
      invariant(JSBI.lessThan(sqrtPriceLimitX96, this.sqrtRatioX96), 'RATIO_CURRENT')
    } else {
      invariant(JSBI.lessThan(sqrtPriceLimitX96, TickMath.MAX_SQRT_RATIO), 'RATIO_MAX')
      invariant(JSBI.greaterThan(sqrtPriceLimitX96, this.sqrtRatioX96), 'RATIO_CURRENT')
    }

    const amountSpecified = JSBI.BigInt(inputAmount.toFixed())
    // keep track of swap state
    const state = {
      amountSpecifiedRemaining: amountSpecified,
      amountCalculated: ZERO,
      sqrtPriceX96: this.sqrtRatioX96,
      tick: this.tickCurrent,
      liquidity: this.liquidity
    }

    // start swap while loop
    while (JSBI.notEqual(state.amountSpecifiedRemaining, ZERO) && state.sqrtPriceX96 != sqrtPriceLimitX96) {
      let step: Partial<StepComputations> = {}
      step.sqrtPriceStartX96 = state.sqrtPriceX96

      if ((zeroForOne && (state.tick >> 8) <= (this.ticks[0].index >> 8)) ||
        (!zeroForOne && (state.tick >> 8) >= (this.ticks[this.ticks.length - 1].index >> 8))) {
        // NOTE(zviad): for whatever reason, when we get to last word position in our `this.ticks` this loop
        // performs an incorrect extra iteration, giving us a wrong answer.
        return new BigNumber(state.amountCalculated.toString())
      }

      // because each iteration of the while loop rounds, we can't optimize this code (relative to the smart contract)
      // by simply traversing to the next available tick, we instead need to exactly replicate
      // tickBitmap.nextInitializedTickWithinOneWord
      ;[step.tickNext, step.initialized] = TickList.nextInitializedTickWithinOneWord(
        this.ticks,
        state.tick,
        zeroForOne,
        this.tickSpacing
      )

      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK
      } else if (step.tickNext > TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK
      }

      step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext)
      ;[state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] = SwapMath.computeSwapStep(
        state.sqrtPriceX96,
        (zeroForOne
        ? JSBI.lessThan(step.sqrtPriceNextX96, sqrtPriceLimitX96)
        : JSBI.greaterThan(step.sqrtPriceNextX96, sqrtPriceLimitX96))
          ? sqrtPriceLimitX96
          : step.sqrtPriceNextX96,
        state.liquidity,
        state.amountSpecifiedRemaining,
        this.fee
      )

      state.amountSpecifiedRemaining = JSBI.subtract(
        state.amountSpecifiedRemaining,
        JSBI.add(step.amountIn, step.feeAmount)
      )
      state.amountCalculated = JSBI.add(state.amountCalculated, step.amountOut)

      if (JSBI.equal(state.sqrtPriceX96, step.sqrtPriceNextX96)) {
        // if the tick is initialized, run the tick transition
        if (step.initialized) {
          let liquidityNet = JSBI.BigInt((TickList.getTick(this.ticks, step.tickNext)).liquidityNet)
          // if we're moving leftward, we interpret liquidityNet as the opposite sign
          // safe because liquidityNet cannot be type(int128).min
          if (zeroForOne) liquidityNet = JSBI.multiply(liquidityNet, NEGATIVE_ONE)
          state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet)
        }

        state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext
      } else if (JSBI.notEqual(state.sqrtPriceX96, step.sqrtPriceStartX96)) {
        // updated comparison function
        // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96)
      }
    }

    return new BigNumber(state.amountCalculated.toString())
  }

	// public outputAmountAsync = async (inputToken: Address, inputAmount: BigNumber): Promise<BigNumber> => {
	// 	const outputToken = inputToken === this.tokenA ? this.tokenB : this.tokenA
	// 	const out = await this.swappaPool.methods.getOutputAmount2(
	// 		inputToken,
	// 		outputToken,
	// 		inputAmount.toFixed(0),
	// 		this.swapExtraData(),
	// 	).call()
	// 	return new BigNumber(out)
	// }

  public snapshot(): Snapshot {
    throw new Error("not implemented")
  }
  public restore(snapshot: Snapshot): void {
    throw new Error("not implemented")
  }
}
