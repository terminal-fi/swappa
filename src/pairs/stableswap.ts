import { ContractKit } from "@celo/contractkit";
import BigNumber from "bignumber.js";

import { ISwap } from "../../types/web3-v1-contracts/ISwap";
import { abi as SwapABI } from "../../build/contracts/ISwap.json";
import { ERC20 } from "../../types/web3-v1-contracts/ERC20";
import { abi as ERC20ABI } from "../../build/contracts/ERC20.json";

import { Address, Pair } from "../pair";
import { selectAddress } from "../utils";
import { address as pairStableSwapAddress } from "../../tools/deployed/mainnet.PairStableSwap.addr.json";
import { AbiItem } from "web3-utils";

export class PairStableSwap extends Pair {
  allowRepeats = false;
  private swapPool: ISwap;

  private paused: boolean = false;
  private tokenPrecisionMultipliers: BigNumber[] = [];
  private balancesWithAdjustedPrecision: BigNumber[] = [];
  private swapFee: BigNumber = new BigNumber(0);
  private preciseA: BigNumber = new BigNumber(0);

  static readonly POOL_PRECISION_DECIMALS = 18;
  static readonly A_PRECISION = 100;

  constructor(private kit: ContractKit, private swapPoolAddr: Address) {
    super();
    this.swapPool = new kit.web3.eth.Contract(
      SwapABI as AbiItem[],
      swapPoolAddr
    ) as unknown as ISwap;
  }

  protected async _init() {
    const [tokenA, tokenB, swappaPairAddress] = await Promise.all([
      this.swapPool.methods.getToken(0).call(),
      this.swapPool.methods.getToken(1).call(),
      selectAddress(this.kit, { mainnet: pairStableSwapAddress }),
    ]);
    const ERC20A = new this.kit.web3.eth.Contract(
      ERC20ABI as AbiItem[],
      tokenA
    ) as unknown as ERC20;
    const ERC20B = new this.kit.web3.eth.Contract(
      ERC20ABI as AbiItem[],
      tokenB
    ) as unknown as ERC20;
    const [decimalsA, decimalsB] = await Promise.all([
      ERC20A.methods.decimals().call(),
      ERC20B.methods.decimals().call(),
    ]);
    this.tokenPrecisionMultipliers = [
      new BigNumber(10).pow(
        PairStableSwap.POOL_PRECISION_DECIMALS - Number.parseInt(decimalsA)
      ),
      new BigNumber(10).pow(
        PairStableSwap.POOL_PRECISION_DECIMALS - Number.parseInt(decimalsB)
      ),
    ];
    return {
      pairKey: this.swapPoolAddr,
      tokenA,
      tokenB,
      swappaPairAddress,
    };
  }

  public async refresh() {
    const [paused, balances, swapFee, preciseA] = await Promise.all([
      this.swapPool.methods.paused().call(),
      this.swapPool.methods.getBalances().call(),
      this.swapPool.methods.getSwapFee().call(),
      this.swapPool.methods.getAPrecise().call(),
    ]);
    if (balances.length !== 2) {
      throw new Error("pool must have only 2 tokens!");
    }
    this.paused = paused;
    this.balancesWithAdjustedPrecision = balances.map((b, idx) =>
      this.tokenPrecisionMultipliers[idx].multipliedBy(b)
    );
    this.swapFee = new BigNumber(swapFee).div(new BigNumber(10).pow(10));
    this.preciseA = new BigNumber(preciseA);
  }

  public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
    if (this.paused) {
      return new BigNumber(0);
    }

    // See: https://github.com/mobiusAMM/mobiusV1/blob/master/contracts/SwapUtils.sol#L617
    const [tokenIndexFrom, tokenIndexTo] =
      inputToken === this.tokenA ? [0, 1] : [1, 0];
    const x = inputAmount
      .multipliedBy(this.tokenPrecisionMultipliers[tokenIndexFrom])
      .plus(this.balancesWithAdjustedPrecision[tokenIndexFrom]);
    const y = this.getY(x, this.balancesWithAdjustedPrecision, this.preciseA);
    const outputAmountWithFee = this.balancesWithAdjustedPrecision[tokenIndexTo]
      .minus(y)
      .minus(1);
    const fee = outputAmountWithFee.multipliedBy(this.swapFee);
    const outputAmount = outputAmountWithFee
      .minus(fee)
      .div(this.tokenPrecisionMultipliers[tokenIndexTo])
      .integerValue();
    return outputAmount;
  }

  private getY = (x: BigNumber, xp: BigNumber[], a: BigNumber) => {
    // See: https://github.com/mobiusAMM/mobiusV1/blob/master/contracts/SwapUtils.sol#L531
    const d = this.getD(xp, a);
    const nTokens = xp.length;
    const nA = a.multipliedBy(nTokens);

    const s = x;
    const c = d
      .multipliedBy(d)
      .div(x.multipliedBy(nTokens))
      .integerValue()
      .multipliedBy(d)
      .multipliedBy(PairStableSwap.A_PRECISION)
      .div(nA.multipliedBy(nTokens))
      .integerValue();
    const b = s
      .plus(d.multipliedBy(PairStableSwap.A_PRECISION).div(nA))
      .integerValue();

    let yPrev;
    let y = d;
    for (let i = 0; i < 256; i++) {
      yPrev = y;
      y = y
        .multipliedBy(y)
        .plus(c)
        .div(y.multipliedBy(2).plus(b).minus(d))
        .integerValue();
      if (y.minus(yPrev).abs().lte(1)) {
        return y;
      }
    }
    throw new Error("SwapPool approximation did not converge!");
  };

  private getD(xp: BigNumber[], a: BigNumber) {
    // See: https://github.com/mobiusAMM/mobiusV1/blob/master/contracts/SwapUtils.sol#L393
    const s = BigNumber.sum(...xp);
    if (s.eq(0)) {
      return s;
    }

    let prevD;
    let d = s;
    const nTokens = xp.length;
    const nA = a.multipliedBy(nTokens);

    for (let i = 0; i < 256; i++) {
      let dP = d;
      xp.forEach((x) => {
        dP = dP.multipliedBy(d).div(x.multipliedBy(nTokens)).integerValue();
      });
      prevD = d;
      d = nA
        .multipliedBy(s)
        .div(PairStableSwap.A_PRECISION)
        .plus(dP.multipliedBy(nTokens))
        .multipliedBy(d)
        .div(
          nA
            .minus(PairStableSwap.A_PRECISION)
            .multipliedBy(d)
            .div(PairStableSwap.A_PRECISION)
            .plus(new BigNumber(nTokens).plus(1).multipliedBy(dP))
        )
        .integerValue();
      if (d.minus(prevD).abs().lte(1)) {
        return d;
      }
    }
    throw new Error("SwapPool D does not converge!");
  }

  protected swapExtraData() {
    return this.swapPoolAddr;
  }
}
