import BigNumber from "bignumber.js";

export type Address = string;

export interface SwapData {
  addr: string;
  extra: string;
}

export abstract class Pair {
  // pairKey is used to identify conflicting pairs. In a single route, every non-null pairKey must
  // be unique. On the otherhand, Pair-s with null pairKey can be used unlimited amount of times in
  // a single route.
  public pairKey: string | null = null;
  public tokenA: Address = "";
  public tokenB: Address = "";
  protected swappaPairAddress: Address = "";

  public async init(): Promise<void> {
    const r = await this._init();
    this.pairKey = r.pairKey;
    this.tokenA = r.tokenA;
    this.tokenB = r.tokenB;
    this.swappaPairAddress = r.swappaPairAddress;
    return this.refresh();
  }
  protected abstract _init(): Promise<{
    pairKey: string | null;
    tokenA: Address;
    tokenB: Address;
    swappaPairAddress: Address;
  }>;
  public abstract refresh(): Promise<void>;
  public swapData(inputToken: Address): SwapData {
    return {
      addr: this.swappaPairAddress,
      extra: this.swapExtraData(inputToken),
    };
  }
  protected abstract swapExtraData(inputToken: Address): string;
  public abstract outputAmount(
    inputToken: Address,
    inputAmount: BigNumber
  ): BigNumber;
}

export abstract class PairXYeqK extends Pair {
  private fee: BigNumber = new BigNumber(0);
  private bucketA: BigNumber = new BigNumber(0);
  private bucketB: BigNumber = new BigNumber(0);

  public refreshBuckets(
    fee: BigNumber,
    bucketA: BigNumber,
    bucketB: BigNumber
  ) {
    this.fee = fee;
    this.bucketA = bucketA;
    this.bucketB = bucketB;
  }

  public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
    const buckets =
      inputToken === this.tokenA
        ? [this.bucketA, this.bucketB]
        : inputToken === this.tokenB
        ? [this.bucketB, this.bucketA]
        : null;
    if (buckets === null) {
      throw new Error(
        `unsupported input: ${inputToken}, pair: ${this.tokenA}/${this.tokenB}!`
      );
    }
    const amountWithFee = inputAmount.multipliedBy(this.fee);
    const outputAmount = buckets[1]
      .multipliedBy(amountWithFee)
      .dividedToIntegerBy(buckets[0].plus(amountWithFee));
    return !outputAmount.isNaN() ? outputAmount : new BigNumber(0);
  }

  public inputAmount(outputToken: Address, outputAmount: BigNumber): BigNumber {
    const buckets =
      outputToken === this.tokenB
        ? [this.bucketA, this.bucketB]
        : outputToken === this.tokenA
        ? [this.bucketB, this.bucketA]
        : null;
    if (buckets === null) {
      throw new Error(
        `unsupported output: ${outputToken}, pair: ${this.tokenA}/${this.tokenB}!`
      );
    }
    return buckets[0]
      .multipliedBy(outputAmount)
      .div(buckets[1].minus(outputAmount).multipliedBy(this.fee));
  }
}
