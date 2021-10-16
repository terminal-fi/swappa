import BigNumber from "bignumber.js"
import { Address, Pair } from "../pair"
import { address as pairATokenAddress } from "../../tools/deployed/mainnet.PairAToken.addr.json"

export class PairAToken extends Pair {
	allowRepeats = true

	constructor(
		private providerAddr: Address,
		private isUnderlyingCELO: boolean,
		private aToken: Address,
		underlyingToken: Address,
	) {
		super(aToken, underlyingToken)
	}

	public async _init(): Promise<void> {}
	public async refresh(): Promise<void> {}

	public swapData(inputToken: Address) {
		const swapType =
			inputToken === this.aToken ? "01" :
			this.isUnderlyingCELO ? "02" : "03"
		return {addr: pairATokenAddress, extra: `${this.providerAddr}${swapType}`}
	}

	public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
		if (inputToken !== this.tokenA && inputToken !== this.tokenB) {
			throw new Error(`unsupported input: ${inputToken}, pair: ${this.tokenA}/${this.tokenB}!`)
		}
		return inputAmount
	}
}
