import BigNumber from "bignumber.js"
import { ContractKit } from "@celo/contractkit"

import * as LendingPoolJson from "@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json"

import { Address, Pair } from "../pair"
import { selectAddress } from "../utils"
import { address as pairATokenV2Address } from "../../tools/deployed/mainnet.PairATokenV2.addr.json"
import { AbiItem } from "web3-utils"

export class PairATokenV2 extends Pair {
	allowRepeats = true

	private pool

	constructor(
		private kit: ContractKit,
		private poolAddr: Address,
		private reserve: Address,
	) {
		super()
		this.pool = new this.kit.web3.eth.Contract(LendingPoolJson.abi as AbiItem[], this.poolAddr)
	}

	protected async _init() {
		const data = await this.pool.methods.getReserveData(this.reserve).call()
		const tokenA = data.aTokenAddress
		const tokenB = this.reserve
		return {
			pairKey: null,
			tokenA, tokenB,
			swappaPairAddress: await selectAddress(this.kit, {mainnet: pairATokenV2Address})
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
