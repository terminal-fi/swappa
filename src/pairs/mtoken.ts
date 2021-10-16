import BigNumber from "bignumber.js";
import { Address, Pair, PairData } from "../pair";

export class PairMToken extends Pair {
	constructor(
		mToken: Address,
		underlyingToken: Address,
	) {
		super(mToken, underlyingToken)
	}

	public async _init(): Promise<PairData> {
		return {addr: "", extra: ""}
	}
	public async refresh(): Promise<void> {}
	public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
		if (inputToken !== this.tokenA && inputToken !== this.tokenB) {
			throw new Error(`unsupported input: ${inputToken}, pair: ${this.tokenA}/${this.tokenB}!`)
		}
		return inputAmount
	}
}
