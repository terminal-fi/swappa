import BigNumber from "bignumber.js"
import { Address, BigNumberString, Pair, Snapshot } from "../pair"

interface PairXYeqKSnapshot extends Snapshot {
	fee: BigNumberString
	bucketA: BigNumberString
	bucketB: BigNumberString
}

export abstract class PairXYeqK extends Pair {
	private fee: BigNumber = new BigNumber(0)
	private bucketA: BigNumber = new BigNumber(0)
	private bucketB: BigNumber = new BigNumber(0)

	public refreshBuckets(fee: BigNumber, bucketA: BigNumber, bucketB: BigNumber) {
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
		if (this.bucketA.lt(1) || this.bucketB.lt(1)) {
			return new BigNumber(0)
		}
		const amountWithFee = inputAmount.multipliedBy(this.fee)
		const outputAmount = buckets[1].multipliedBy(amountWithFee).idiv(buckets[0].plus(amountWithFee))
		return !outputAmount.isNaN() ? outputAmount : new BigNumber(0)
	}

	public inputAmount(outputToken: Address, outputAmount: BigNumber): BigNumber {
		const buckets =
			outputToken === this.tokenB ? [this.bucketA, this.bucketB] :
			outputToken === this.tokenA ? [this.bucketB, this.bucketA] : null
		if (buckets === null) {
			throw new Error(`unsupported output: ${outputToken}, pair: ${this.tokenA}/${this.tokenB}!`)
		}
		return buckets[0].multipliedBy(outputAmount).idiv(
			buckets[1].minus(outputAmount).multipliedBy(this.fee))
	}

	public snapshot(): PairXYeqKSnapshot {
		return {
			fee: this.fee.toFixed(),
			bucketA: this.bucketA.toFixed(),
			bucketB: this.bucketB.toFixed(),
		}
	}

	public restore(snapshot: PairXYeqKSnapshot): void {
		this.fee = new BigNumber(snapshot.fee)
		this.bucketA = new BigNumber(snapshot.bucketA)
		this.bucketB = new BigNumber(snapshot.bucketB)
	}
}