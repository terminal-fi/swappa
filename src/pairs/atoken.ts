import BigNumber from "bignumber.js"
import { Address, Pair } from "../pair"
import { address as pairATokenAddress } from "../../tools/deployed/mainnet.PairAToken.addr.json"
import { selectAddress } from "../utils"
import { ContractKit } from "@celo/contractkit"

export class PairAToken extends Pair {
	allowRepeats = true

	constructor(
		private kit: ContractKit,
		private providerAddr: Address,
		private isUnderlyingCELO: boolean,
		private aToken: Address,
		underlyingToken: Address,
	) {
		super(aToken, underlyingToken)
	}

	protected async _init() {
		return {
			swappaPairAddress: await selectAddress(this.kit, {mainnet: pairATokenAddress})
		}
	}
	public async refresh(): Promise<void> {}

	protected swapExtraData(inputToken: Address) {
		const swapType =
			inputToken === this.aToken ? "01" :
			this.isUnderlyingCELO ? "02" : "03"
		return `${this.providerAddr}${swapType}`
	}

	public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
		if (inputToken !== this.tokenA && inputToken !== this.tokenB) {
			throw new Error(`unsupported input: ${inputToken}, pair: ${this.tokenA}/${this.tokenB}!`)
		}
		return inputAmount
	}
}
