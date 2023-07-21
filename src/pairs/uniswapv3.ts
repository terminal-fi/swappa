import BigNumber from "bignumber.js";
import Web3 from "web3";
import JSBI from "jsbi"
import invariant from 'tiny-invariant'

import {
  FeeAmount, LiquidityMath, SwapMath,
  TICK_SPACINGS, Tick, TickConstructorArgs, TickList, TickMath
} from "@uniswap/v3-sdk";

import { Address, Pair, Snapshot } from "../pair";
import {
  PairUniswapV3 as PairUniswapV3Contract,
  newPairUniswapV3,
} from "../../types/web3-v1-contracts/PairUniswapV3";
import {
  IUniswapV3Pool,
  newIUniswapV3Pool,
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

type JSBIString = string

interface PairUniswapV3Snapshot extends Snapshot {
  fee: FeeAmount
  sqrtRatioX96: JSBIString
  liquidity: JSBIString
  tickCurrent: number
  ticks: TickConstructorArgs[],
}

let _REFRESH_MAX_LOOP_N = 64
export const configureUniV3RefreshMaxLoopN = (n: number) => {
  _REFRESH_MAX_LOOP_N = n
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

  constructor(
    chainId: number,
    private web3: Web3,
    private pairAddr: Address,
    private initData?: {tokenA: Address, tokenB: Address, fee: FeeAmount},
  ) {
    super(web3, selectAddress(chainId, { mainnet: pairUniV3Address }));
    const univ3SwappaPairAddr = selectAddress(chainId, { mainnet: pairUniV3Address });

    this.pairKey = pairAddr;

    this.swapPool = newIUniswapV3Pool(this.web3, pairAddr)
    this.swappaPool = newPairUniswapV3(this.web3, univ3SwappaPairAddr)
  }

  protected async _init() {
    if (this.initData) {
      this.fee = this.initData.fee
      return {
        pairKey: this.pairAddr,
        tokenA: this.initData.tokenA,
        tokenB: this.initData.tokenB,
      }
    }

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
    let info = await this.swappaPool.methods.getPoolTicks(this.pairAddr, _REFRESH_MAX_LOOP_N).call()
    this.tickCurrent = Number.parseInt(info.tick)
    this.sqrtRatioX96 = JSBI.BigInt(info.sqrtPriceX96)
    this.liquidity = JSBI.BigInt(info.liquidity)

    const tickCurrentSqrtRatioX96 = TickMath.getSqrtRatioAtTick(this.tickCurrent)
    const nextTickSqrtRatioX96 = TickMath.getSqrtRatioAtTick(this.tickCurrent + 1)

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
    if (this.ticks.length > 0) {
      try {
        invariant(
          JSBI.greaterThanOrEqual(JSBI.BigInt(this.sqrtRatioX96), tickCurrentSqrtRatioX96) &&
          JSBI.lessThanOrEqual(JSBI.BigInt(this.sqrtRatioX96), nextTickSqrtRatioX96),
          'Univ3: PRICE_BOUNDS')

        invariant(this.ticks.every(({ index }) => index % this.tickSpacing === 0), 'Univ3: TICK_SPACING')
        invariant(this.ticks.every(({ index }, idx) => idx === 0 || this.ticks[idx - 1].index < index), 'Univ3: TICK_DUPLICATES')

        invariant(JSBI.lessThan(JSBI.add(TickMath.MIN_SQRT_RATIO, ONE), this.sqrtRatioX96), 'RATIO_CURRENT')
        invariant(JSBI.greaterThan(JSBI.subtract(TickMath.MAX_SQRT_RATIO, ONE), this.sqrtRatioX96), 'RATIO_CURRENT')
      } catch (e) {
        console.warn(`Univ3 ${this.tokenA}/${this.tokenB}/${this.fee.toString()}: REFRESH ERR: ${e}`)
        this.ticks = []
      }
    }
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

      if (
        (
          (zeroForOne && state.tick < this.ticks[0].index) ||
          (!zeroForOne && state.tick > this.ticks[this.ticks.length - 1].index)
        )) {
        // NOTE(zviad): our `this.ticks` array might be incomplete, thus it is dangerous to go beyond
        // its bounds because total liquidity could become incorrect after that.
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

  public snapshot(): PairUniswapV3Snapshot {
    return {
      fee: this.fee,
      sqrtRatioX96: this.sqrtRatioX96.toString(),
      liquidity: this.liquidity.toString(),
      tickCurrent: this.tickCurrent,
      ticks: this.ticks.map((t) => ({
        index: t.index,
        liquidityGross: t.liquidityGross.toString(),
        liquidityNet: t.liquidityNet.toString(),
      })),
    }
  }
  public restore(snapshot: PairUniswapV3Snapshot): void {
    this.fee = snapshot.fee
    this.sqrtRatioX96 = JSBI.BigInt(snapshot.sqrtRatioX96)
    this.liquidity = JSBI.BigInt(snapshot.liquidity)
    this.tickCurrent = snapshot.tickCurrent
    this.ticks = snapshot.ticks.map((t) => new Tick(t))
  }
}

