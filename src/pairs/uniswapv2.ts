import { ContractKit } from "@celo/contractkit"
import BigNumber from "bignumber.js"
import { IUniswapV2Factory, ABI as FactoryABI } from "../../types/web3-v1-contracts/IUniswapV2Factory"
import { IUniswapV2Pair, ABI as PairABI } from "../../types/web3-v1-contracts/IUniswapV2Pair"
import { Address, PairXYeqK } from "../pair"
import { address as pairUniswapV2Address } from "../../tools/deployed/mainnet.PairUniswapV2.addr.json"
import { selectAddress } from "../utils"

export class PairUniswapV2 extends PairXYeqK {
	allowRepeats = false

	private pair: IUniswapV2Pair

	constructor(
		private kit: ContractKit,
		pairAddr: Address,
		private fixedFee: BigNumber = new BigNumber(0.997),
	) {
		super()
		this.pair = new this.kit.web3.eth.Contract(PairABI, pairAddr) as unknown as IUniswapV2Pair
	}

	protected async _init() {
		const [tokenA, tokenB, swappaPairAddress] = await Promise.all([
			this.pair.methods.token0().call(),
			this.pair.methods.token0().call(),
			selectAddress(this.kit, {mainnet: pairUniswapV2Address}),
		])
		return { tokenA, tokenB, swappaPairAddress }
	}

	public async refresh(): Promise<void> {
		if (!this.pair) {
			throw new Error(`not initialized!`)
		}
		const reserves = await this.pair.methods.getReserves().call()
		this.refreshBuckets(this.fixedFee, new BigNumber(reserves[0]), new BigNumber(reserves[1]))
	}

	protected swapExtraData() {
		return this.pair!.options.address
	}
}