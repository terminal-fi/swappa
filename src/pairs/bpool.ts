import { ContractKit } from "@celo/contractkit"
import BigNumber from "bignumber.js"

import { IbPool, ABI as BPoolABI } from "../../types/web3-v1-contracts/IBPool"
import { Address, Pair } from "../pair"
import { selectAddress } from "../utils"

const ZERO = new BigNumber(0)
const ONE = new BigNumber(1)

export class PairBPool extends Pair {
	allowRepeats = false
	private bPool: IbPool
	private swapFee: BigNumber = ZERO
	private weightA: BigNumber = ZERO
	private weightB: BigNumber = ZERO
	private balanceA: BigNumber = ZERO
	private balanceB: BigNumber = ZERO

	constructor(
		private kit: ContractKit,
		private poolAddr: Address,
		public tokenA: Address,
		public tokenB: Address
	) {
		super()
		this.bPool = new kit.web3.eth.Contract(BPoolABI, poolAddr) as unknown as IbPool
	}

	protected async _init() {
		const [
			swapFee,
			weightA,
			weightB,
			swappaPairAddress
		] = await Promise.all([
			this.bPool.methods.getSwapFee().call(),
			this.bPool.methods.getDenormalizedWeight(this.tokenA).call(),
			this.bPool.methods.getDenormalizedWeight(this.tokenB).call(),
			// TODO: change this after merge to the actual deployed PairBPool swap address
			selectAddress(this.kit, {mainnet: ''})
		])
		this.swapFee = new BigNumber(swapFee).div(10**18)
		this.weightA = new BigNumber(weightA)
		this.weightB = new BigNumber(weightB)

		// bpool can be used for each input & output combination
		let pairKey
		if (this.tokenA.toLowerCase().localeCompare(this.tokenB.toLowerCase()) > 0) {
			pairKey = `${this.poolAddr}-${this.tokenA}:${this.tokenB}`
		} else {
			pairKey = `${this.poolAddr}-${this.tokenB}:${this.tokenA}`
		}

		return {
			pairKey: pairKey,
			tokenA: this.tokenA,
			tokenB: this.tokenB,
			swappaPairAddress
		}
	}

	public async refresh() {
		const [
			balanceA,
			balanceB
		] = await Promise.all([
			this.bPool.methods.getBalance(this.tokenA).call(),
			this.bPool.methods.getBalance(this.tokenB).call()
		])

		this.balanceA = new BigNumber(balanceA)
		this.balanceB = new BigNumber(balanceB)
	}

	public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
		let tokenBalanceIn, tokenBalanceOut, tokenWeightIn, tokenWeightOut
		if (inputToken === this.tokenA) {
			[tokenBalanceIn, tokenWeightIn, tokenBalanceOut, tokenWeightOut] = [
				this.balanceA, this.weightA,
				this.balanceB, this.weightB
			]
		} else {
			[tokenBalanceIn, tokenWeightIn, tokenBalanceOut, tokenWeightOut] = [
				this.balanceB, this.weightB,
				this.balanceA, this.weightA
			]
		}

		const weightRatio = new BigNumber(tokenWeightIn).div(tokenWeightOut)
		const adjustedIn = inputAmount.multipliedBy(ONE.minus(this.swapFee))
		const y = tokenBalanceIn.div(tokenBalanceIn.plus(adjustedIn))
		const foo = y.pow(weightRatio)
		const bar = ONE.minus(foo)
		return tokenBalanceOut.multipliedBy(bar)
	}

	protected swapExtraData() {
		return this.poolAddr
	}
}
