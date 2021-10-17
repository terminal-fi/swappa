import BigNumber from "bignumber.js";

export type Address = string

export interface SwapData {
	addr: string
	extra: string
}

export abstract class Pair {
	public abstract readonly allowRepeats: boolean;
	protected swappaPairAddress: Address = "";

	constructor(
		public readonly tokenA: Address,
		public readonly tokenB: Address,
		) {
	}

	public async init(): Promise<void> {
		const r = await this._init()
		this.swappaPairAddress = r.swappaPairAddress
		return this.refresh()
	}
	protected abstract _init(): Promise<{swappaPairAddress: Address}>;
	public abstract refresh(): Promise<void>;
	public swapData(inputToken: Address): SwapData {
		return {
			addr: this.swappaPairAddress,
			extra: this.swapExtraData(inputToken),
		}
	}
	protected abstract swapExtraData(inputToken: Address): string;
	public abstract outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber;
}

export abstract class PairXYeqK extends Pair {
	private fee: BigNumber = new BigNumber(0)
	private bucketA: BigNumber = new BigNumber(0)
	private bucketB: BigNumber = new BigNumber(0)

	constructor(
		public readonly tokenA: Address,
		public readonly tokenB: Address,
		) {
		super(tokenA, tokenB)
	}

	protected refreshBuckets(fee: BigNumber, bucketA: BigNumber, bucketB: BigNumber) {
		this.fee = fee
		this.bucketA = bucketA
		this.bucketB = bucketB
	}

	public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
		const buckets =
			inputToken === this.tokenA ? [this.bucketA, this.bucketB] :
			inputToken === this.tokenB ? [this.bucketB, this.bucketA] : null
		if (buckets === null) {
			throw new Error(`unsupported input: ${inputToken}, pair: ${this.tokenA}/${this.tokenB}!`)
		}
		const amountWithFee = inputAmount.multipliedBy(this.fee)
		const outputAmount = buckets[1].multipliedBy(amountWithFee).dividedToIntegerBy(buckets[0].plus(amountWithFee))
		return !outputAmount.isNaN() ? outputAmount : new BigNumber(0)
	}
}