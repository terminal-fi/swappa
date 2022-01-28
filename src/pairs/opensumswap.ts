import Web3 from "web3"
import BigNumber from "bignumber.js"

import { IOpenSumSwap, ABI as SwapABI } from "../../types/web3-v1-contracts/IOpenSumSwap"
import { Address, Pair, Snapshot, BigNumberString } from "../pair"
import { selectAddress } from "../utils"
import { address as pairOpenSumSwapAddress } from "../../tools/deployed/mainnet.PairOpenSumSwap.addr.json"

interface PairOpenSumSwapSnapshot extends Snapshot {
	paused: boolean
	balances: BigNumberString[]
}

const ZERO = new BigNumber(0)

export class PairOpenSumSwap extends Pair {
	allowRepeats = false
	private swapPool: IOpenSumSwap

	private paused: boolean = false
	private balances: BigNumber[] = []

	constructor(
		private web3: Web3,
		private swapPoolAddr: Address,
	) {
		super()
		this.swapPool = new web3.eth.Contract(SwapABI, swapPoolAddr) as unknown as IOpenSumSwap
	}

	protected async _init() {
		const [
			tokenA,
			tokenB,
			swappaPairAddress,
		] = await Promise.all([
			this.swapPool.methods.getToken(0).call(),
			this.swapPool.methods.getToken(1).call(),
			selectAddress(this.web3, {mainnet: pairOpenSumSwapAddress}),
		])
		return {
			pairKey: this.swapPoolAddr,
			tokenA,  tokenB, swappaPairAddress}
	}

	public async refresh() {
		const [
			paused,
			balances
		 ] = await Promise.all([
			this.swapPool.methods.paused().call(),
			this.swapPool.methods.getBalances().call(),
		])
		if (balances.length !== 2) {
			throw new Error("pool must have only 2 tokens!")
		}
		this.paused = paused
		this.balances = balances.map(b => new BigNumber(b))
	}

	public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
		if (this.paused) {
			return ZERO
		}
		if (inputToken === this.tokenA && inputAmount.gt(this.balances[1])) {
			// not enough for conversion
			return ZERO
		} else if (inputToken === this.tokenB && inputAmount.gt(this.balances[0])) {
			// not enough for conversion
			return ZERO
		}
		return inputAmount
	}

	protected swapExtraData() {
		return this.swapPoolAddr
	}

	public snapshot(): PairOpenSumSwapSnapshot {
		return {
			paused: this.paused,
			balances: this.balances.map(b => b.toFixed())
		}
	}

	public restore(snapshot: PairOpenSumSwapSnapshot): void {
		this.paused = snapshot.paused
		this.balances = snapshot.balances.map(b => new BigNumber(b))
	}
}
