import BigNumber from "bignumber.js"
import Web3 from "web3"

import { ILendingPoolV2, ABI as ILendingPoolV2ABI } from "../../types/web3-v1-contracts/ILendingPoolV2"

import { Address, Pair } from "../pair"
import { selectAddress } from "../utils"
import { address as pairATokenV2Address } from "../../tools/deployed/mainnet.PairATokenV2.addr.json"

export class PairATokenV2 extends Pair {
	allowRepeats = true

	private pool: ILendingPoolV2

	constructor(
		private web3: Web3,
		private poolAddr: Address,
		private reserve: Address,
	) {
		super()
		this.pool = new this.web3.eth.Contract(ILendingPoolV2ABI, this.poolAddr) as unknown as ILendingPoolV2
	}

	protected async _init() {
		const data = await this.pool.methods.getReserveData(this.reserve).call()
		const tokenA = data.aTokenAddress
		const tokenB = this.reserve
		return {
			pairKey: null,
			tokenA, tokenB,
			swappaPairAddress: await selectAddress(this.web3, {mainnet: pairATokenV2Address})
		}
	}
	public async refresh(): Promise<void> {}

	protected swapExtraData(inputToken: Address) {
		const swapType = inputToken === this.tokenA ? "01" : "02"
		return `${this.poolAddr}${swapType}`
	}

	public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
		if (inputToken !== this.tokenA && inputToken !== this.tokenB) {
			throw new Error(`unsupported input: ${inputToken}, pair: ${this.tokenA}/${this.tokenB}!`)
		}
		return inputAmount
	}
}
