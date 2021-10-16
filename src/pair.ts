import BigNumber from "bignumber.js";

export type Address = string

export interface PairData {
	addr: string
	extra: string
}

export abstract class Pair {
	public data?: PairData

	constructor(
		public readonly tokenA: Address,
		public readonly tokenB: Address,
		) {
	}

	public async init(): Promise<void> {
		this.data = await this._init()
		return this.refresh()
	}
	public abstract _init(): Promise<PairData>;
	public abstract refresh(): Promise<void>;
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