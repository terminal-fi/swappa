import Web3 from "web3"
import BigNumber from "bignumber.js"

import { ISymmetricSwap, ABI as SwapABI } from "../../types/web3-v1-contracts/ISymmetricSwap"
import { Address, Pair, Snapshot } from "../pair"
import { selectAddress } from "../utils"
import { address as pairSymmetricSwapAddress } from "../../tools/deployed/mainnet.PairSymmetricSwap.addr.json"

interface PairSymmetricSwapSnapshot extends Snapshot {
	paused: boolean
}

const ZERO = new BigNumber(0)

export class PairSymmetricSwap extends Pair {
	allowRepeats = false
	private swapPool: ISymmetricSwap

	private paused: boolean = false

	constructor(
		private web3: Web3,
		private swapPoolAddr: Address,
        public tokenA: Address,
        public tokenB: Address
	) {
		super()
		this.swapPool = new web3.eth.Contract(SwapABI, swapPoolAddr) as unknown as ISymmetricSwap
	}

	protected async _init() {
        const swappaPairAddress = await selectAddress(this.web3, {mainnet: pairSymmetricSwapAddress})
		return {
			pairKey: this.swapPoolAddr,
			tokenA: this.tokenA,
            tokenB: this.tokenA,
            swappaPairAddress
        }
	}

	public async refresh() {
		this.paused = await this.swapPool.methods.paused().call()
	}

	public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
		if (this.paused || (inputToken !== this.tokenA && inputToken !== this.tokenB)) {
			return ZERO
		}
		return inputAmount
	}

	protected swapExtraData() {
		return this.swapPoolAddr
	}

	public snapshot(): PairSymmetricSwapSnapshot {
		return {
			paused: this.paused
		}
	}

	public restore(snapshot: PairSymmetricSwapSnapshot): void {
		this.paused = snapshot.paused
	}
}
