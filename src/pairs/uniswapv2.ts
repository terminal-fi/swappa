import Web3 from "web3"
import BigNumber from "bignumber.js"

import { IUniswapV2Pair, ABI as PairABI } from "../../types/web3-v1-contracts/IUniswapV2Pair"
import { Address, PairXYeqK } from "../pair"
import { address as pairUniswapV2Address } from "../../tools/deployed/mainnet.PairUniswapV2.addr.json"
import { selectAddress } from "../utils"

export class PairUniswapV2 extends PairXYeqK {
	allowRepeats = false

	private pair: IUniswapV2Pair
	private feeKData: string

	constructor(
		chainId: number,
		private web3: Web3,
		private pairAddr: Address,
		private fixedFee: BigNumber = new BigNumber(0.997),
	) {
		super(web3, selectAddress(chainId, { mainnet: pairUniswapV2Address }))
		this.pair = new this.web3.eth.Contract(PairABI, pairAddr) as unknown as IUniswapV2Pair
		const feeKInv = new BigNumber(10000).minus(this.fixedFee.multipliedBy(10000))
		if (!feeKInv.isInteger() || !feeKInv.gt(0) || !feeKInv.lt(256)) {
			// feeKInv must fit into uint8
			throw new Error(`Invalid fixedFee: ${this.fixedFee}!`)
		}
		this.feeKData = feeKInv.toString(16).padStart(2, "0")
	}

	protected async _init() {
		const [tokenA, tokenB] = await Promise.all([
			this.pair.methods.token0().call(),
			this.pair.methods.token1().call(),
		])
		return {
			pairKey: this.pairAddr,
			tokenA, tokenB,
		}
	}

	public async refresh(): Promise<void> {
		if (!this.pair) {
			throw new Error(`not initialized!`)
		}
		const reserves = await this.pair.methods.getReserves().call()
		this.refreshBuckets(this.fixedFee, new BigNumber(reserves[0]), new BigNumber(reserves[1]))
	}

	protected swapExtraData() {
		return `${this.pair!.options.address}${this.feeKData}`
	}
}
