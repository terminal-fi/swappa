import { ContractKit } from "@celo/contractkit";
import BigNumber from "bignumber.js";
import { IUniswapV2Pair } from "../../types/web3-v1-contracts/IUniswapV2Pair";
import { abi as PairABI } from "../../build/contracts/IUniswapV2Pair.json";
import { Address, PairXYeqK } from "../pair";
import { address as pairUniswapV2Address } from "../../tools/deployed/mainnet.PairUniswapV2.addr.json";
import { selectAddress } from "../utils";
import { AbiItem } from "web3-utils";

export class PairUniswapV2 extends PairXYeqK {
  allowRepeats = false;

  private pair: IUniswapV2Pair;
  private feeKData: string;

  constructor(
    private kit: ContractKit,
    private pairAddr: Address,
    private fixedFee: BigNumber = new BigNumber(0.997)
  ) {
    super();
    this.pair = new this.kit.web3.eth.Contract(
      PairABI as AbiItem[],
      pairAddr
    ) as unknown as IUniswapV2Pair;
    const feeKInv = new BigNumber(1000).minus(this.fixedFee.multipliedBy(1000));
    if (!feeKInv.isInteger() || !feeKInv.gt(0) || !feeKInv.lt(100)) {
      throw new Error(`Invalida fixedFee: ${this.fixedFee}!`);
    }
    this.feeKData = feeKInv.toString(16).padStart(2, "0");
  }

  protected async _init() {
    const [tokenA, tokenB, swappaPairAddress] = await Promise.all([
      this.pair.methods.token0().call(),
      this.pair.methods.token1().call(),
      selectAddress(this.kit, { mainnet: pairUniswapV2Address }),
    ]);
    return {
      pairKey: this.pairAddr,
      tokenA,
      tokenB,
      swappaPairAddress,
    };
  }

  public async refresh(): Promise<void> {
    if (!this.pair) {
      throw new Error(`not initialized!`);
    }
    const reserves = await this.pair.methods.getReserves().call();
    this.refreshBuckets(
      this.fixedFee,
      new BigNumber(reserves[0]),
      new BigNumber(reserves[1])
    );
  }

  protected swapExtraData() {
    return `${this.pair!.options.address}${this.feeKData}`;
  }
}
