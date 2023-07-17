import Web3 from "web3";
import {
  PairUniswapV3 as PairUniswapV3Contract,
  ABI as PairUniswapV3ABI,
} from "../../types/web3-v1-contracts/PairUniswapV3";

import { Address } from "../pair";
import {
  IUniswapV3Pool,
  ABI as V3PoolABI,
} from "../../types/web3-v1-contracts/IUniswapV3Pool";
import { PairContentratedLiquidity } from "./concentrated-liquidity/pair-concentrated-liquidity";
import { UniV3FeeAmount } from "../utils/concentrated-liquidity/swapMath";
import { selectAddress } from "../utils";
import { address as pairUniV3Address } from "../../tools/deployed/mainnet.PairUniswapV3.addr.json";

export class PairUniswapV3 extends PairContentratedLiquidity {
  allowRepeats = false;
  private swappaPool: PairUniswapV3Contract;
  private swapPool: IUniswapV3Pool;

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

    // this.swapPool.methods.
    this.swapFee = parseInt(fee.toString()) as UniV3FeeAmount;
    return {
      pairKey: this.pairAddr,
      tokenA,
      tokenB,
    };
  }

  public async refresh() {
    const [info, liquidity] = await Promise.all([
      this.swappaPool.methods.getSpotTicks(this.pairAddr).call(),
      this.swapPool.methods.liquidity().call(),
    ]);

    const { ticks, tickToIndex, sqrtPriceX96, tick } =
      PairUniswapV3.transformGetSpotTicksPayload(info);

    this.tick = tick;
    this.tickToIndex = tickToIndex;
    this.tickIndex = this.tickToIndex[tick];
    this.ticks = ticks;
    this.sqrtRatioX96 = sqrtPriceX96;
    this.liquidity = BigInt(liquidity.toString());
  }

  protected swapExtraData() {
    return this.pairAddr;
  }
}
