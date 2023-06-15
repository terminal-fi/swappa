import Web3 from "web3";
import {
  PairAlgebra as PairAlgebraContract,
  ABI as PairAlgebraABI,
} from "../../../types/web3-v1-contracts/PairAlgebra";

import { Address } from "../../pair";

import { UniV3FeeAmount } from "../../constants";
import { ABI as V3PoolABI } from "../../../types/web3-v1-contracts/IUniswapV3Pool";
import { PairContentratedLiquidity } from "./pair-concentrated-liquidity";
import { IAlgebraPool } from "../../../types/web3-v1-contracts/IAlgebraPool";
import { address as pairAlgebraAddress } from "../../../tools/deployed/mainnet.PairAlgebra.addr.json";
import { selectAddress } from "../../utils";

export class PairAlgebra extends PairContentratedLiquidity {
  allowRepeats = false;
  private swappaPool: PairAlgebraContract;
  private swapPool: IAlgebraPool;

  constructor(chainId: number, private web3: Web3, private pairAddr: Address) {
    const pairAddress = selectAddress(chainId, {
      mainnet: pairAlgebraAddress,
    });
    super(pairAddress);
    this.pairKey = pairAddr;
    this.swapPool = new this.web3.eth.Contract(
      V3PoolABI,
      pairAddr
    ) as unknown as IAlgebraPool;
    this.swappaPool = new this.web3.eth.Contract(
      PairAlgebraABI,
      pairAddress
    ) as unknown as PairAlgebraContract;
  }

  protected async _init() {
    const [tokenA, tokenB, { fee }] = await Promise.all([
      this.swapPool.methods.token0().call(),
      this.swapPool.methods.token1().call(),
      this.swapPool.methods.globalState().call(),
    ]);

    this.swapFee = parseInt(fee.toString()) as UniV3FeeAmount;
    return {
      pairKey: this.pairAddr,
      tokenA,
      tokenB,
    };
  }

  public async outputAmountAsync(
    inputToken: Address,
    inputAmount: bigint,
    outputToken: string
  ): Promise<bigint> {
    const res = await this.swappaPool.methods
      .getOutputAmount(
        inputToken,
        outputToken,
        inputAmount.toString(),
        this.swapData(inputToken).extra
      )
      .call();
    return BigInt(res);
  }

  public async refresh() {
    // Algebra pool fees are dynamic - so we do have to feth them on each refresh
    const [info, liquidity, { fee }] = await Promise.all([
      this.swappaPool.methods.getSpotTicks(this.pairAddr).call(),
      this.swapPool.methods.liquidity().call(),
      this.swapPool.methods.globalState().call(),
    ]);
    const { ticks, tickToIndex, sqrtPriceX96, tick } =
      PairAlgebra.transformGetSpotTicksPayload(info);

    this.tick = tick;
    this.tickToIndex = tickToIndex;
    this.tickIndex = this.tickToIndex[tick];
    this.ticks = ticks;
    this.sqrtRatioX96 = sqrtPriceX96;
    this.liquidity = BigInt(liquidity.toString());
    this.swapFee = parseInt(fee.toString()) as UniV3FeeAmount;
  }

  protected swapExtraData() {
    return this.pairAddr;
  }
}
