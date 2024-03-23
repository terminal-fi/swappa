import Web3 from "web3"
import BigNumber from "bignumber.js"

import { ISymmetricSwap, newISymmetricSwap } from "../../types/web3-v1-contracts/ISymmetricSwap"
import { IERC20, newIERC20 } from '../../types/web3-v1-contracts/IERC20';
import { Address, Pair, Snapshot, BigNumberString } from "../pair"
import { selectAddress } from "../utils"
import { address as pairSymmetricSwapAddress } from "../../tools/deployed/mainnet.PairSymmetricSwap.addr.json"

interface PairSymmetricSwapSnapshot extends Snapshot {
	paused: boolean,
	balanceA: BigNumberString,
	balanceB: BigNumberString
}

const ZERO = new BigNumber(0)

export class PairSymmetricSwap extends Pair {
	allowRepeats = false
	private swapPool: ISymmetricSwap

	private paused: boolean = false
	private ercA: IERC20
	private ercB: IERC20
	private balanceA: BigNumber = ZERO
	private balanceB: BigNumber = ZERO

	constructor(
		chainId: number,
		web3: Web3,
		private swapPoolAddr: Address,
		public tokenA: Address,
		public tokenB: Address,
	) {
		super(web3, selectAddress(chainId, {mainnet: pairSymmetricSwapAddress}))
		// Unfortunately SymmetricSwap contract doesn't expose token addresses that it stores,
		// thus they have to be hardcoded in the constructor and can't be fetched from swapPool
		// directly.
		this.swapPool = newISymmetricSwap(web3, swapPoolAddr)
		this.ercA = newIERC20(web3, tokenA)
		this.ercB = newIERC20(web3, tokenB)
	}

	protected async _init() {
		return {
			pairKey: this.swapPoolAddr,
			tokenA: this.tokenA,
			tokenB: this.tokenB,
		}
	}

	public async refresh() {
		let balanceA, balanceB
		[
			this.paused,
			balanceA,
			balanceB
		] = await Promise.all([
			this.swapPool.methods.paused().call(),
			this.ercA.methods.balanceOf(this.swapPoolAddr).call(),
			this.ercB.methods.balanceOf(this.swapPoolAddr).call(),
		])
		this.balanceA = new BigNumber(balanceA)
		this.balanceB = new BigNumber(balanceB)
	}

	public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
		if (this.paused) {
			return ZERO
		}

		let outputBalance
		if (inputToken === this.tokenA) {
			outputBalance = this.balanceB
		} else if (inputToken === this.tokenB) {
			outputBalance = this.balanceA
		} else {
			// invalid input token
			return ZERO
		}

		if (outputBalance.lt(inputAmount)) {
			return ZERO
		}

		return inputAmount
	}

	protected swapExtraData() {
		return this.swapPoolAddr
	}

	public snapshot(): PairSymmetricSwapSnapshot {
		return {
			paused: this.paused,
			balanceA: this.balanceA.toFixed(),
			balanceB: this.balanceB.toFixed()
		}
	}

	public restore(snapshot: PairSymmetricSwapSnapshot): void {
		this.paused = snapshot.paused
		this.balanceA = new BigNumber(snapshot.balanceA)
		this.balanceB = new BigNumber(snapshot.balanceB)
	}
}
