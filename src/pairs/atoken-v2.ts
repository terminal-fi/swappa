import BigNumber from "bignumber.js"
import Web3 from "web3"

import { ILendingPoolV2, newILendingPoolV2 } from "../../types/web3-v1-contracts/ILendingPoolV2"

import { Address, Pair, Snapshot } from "../pair"
import { selectAddress } from "../utils"
import { address as pairATokenV2Address } from "../../tools/deployed/mainnet.PairATokenV2.addr.json"

export class PairATokenV2 extends Pair {
	allowRepeats = true

	private pool: ILendingPoolV2
	private paused = false

	constructor(
		chainId: number,
		web3: Web3,
		private poolAddr: Address,
		private reserve: Address,
	) {
		super(web3, selectAddress(chainId, {mainnet: pairATokenV2Address}))
		this.pool = newILendingPoolV2(web3, this.poolAddr)
	}

	protected async _init() {
		const data = await this.pool.methods.getReserveData(this.reserve).call()
		const tokenA = data.aTokenAddress
		const tokenB = this.reserve
		return {
			pairKey: null,
			tokenA, tokenB,
		}
	}
	public async refresh(): Promise<void> {
		this.paused = await this.pool.methods.paused().call()
	}

	protected swapExtraData(inputToken: Address) {
		const swapType = inputToken === this.tokenA ? "01" : "02"
		return `${this.poolAddr}${swapType}`
	}

	public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
		if (inputToken !== this.tokenA && inputToken !== this.tokenB) {
			throw new Error(`unsupported input: ${inputToken}, pair: ${this.tokenA}/${this.tokenB}!`)
		}
		if (this.paused) {
			return new BigNumber(0)
		}
		return inputAmount
	}

	public snapshot(): Snapshot {
		return {}
	}

	public restore(snapshot: Snapshot): void {
		// do nothing
	}
}
