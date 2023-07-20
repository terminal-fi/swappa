import BigNumber from "bignumber.js"
import Web3 from "web3"

import { IbPool, newIbPool } from "../../types/web3-v1-contracts/IBPool"
import { Address, Pair, Snapshot, BigNumberString } from "../pair"
import { address as pairBPoolAddress } from "../../tools/deployed/mainnet.PairBPool.addr.json"
import { selectAddress } from "../utils"

const ZERO = new BigNumber(0)
const ONE = new BigNumber(1)
const BONE = new BigNumber(10 ** 18)

interface PairBPoolSnapshot extends Snapshot {
	balanceA: BigNumberString
	balanceB: BigNumberString
}

export class PairBPool extends Pair {
	allowRepeats = false
	private bPool: IbPool
	private swapFee: BigNumber = ZERO
	private weightA: BigNumber = ZERO
	private weightB: BigNumber = ZERO
	private balanceA: BigNumber = ZERO
	private balanceB: BigNumber = ZERO

	constructor(
		chainId: number,
		web3: Web3,
		private poolAddr: Address,
		public tokenA: Address,
		public tokenB: Address,
	) {
		super(web3, selectAddress(chainId, {mainnet: pairBPoolAddress}))
		this.bPool = newIbPool(web3, poolAddr)
	}

	protected async _init() {
		const [
			swapFee,
			weightA,
			weightB
		] = await Promise.all([
			this.bPool.methods.getSwapFee().call(),
			this.bPool.methods.getDenormalizedWeight(this.tokenA).call(),
			this.bPool.methods.getDenormalizedWeight(this.tokenB).call(),
		])
		this.swapFee = new BigNumber(swapFee)
		this.weightA = new BigNumber(weightA)
		this.weightB = new BigNumber(weightB)

		return {
			pairKey: this.poolAddr,
			tokenA: this.tokenA,
			tokenB: this.tokenB,
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
		if (this.balanceA.lt(1) || this.balanceB.lt(1)) {
			return ZERO
		}

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

		// https://github.com/balancer/balancer-core/blob/f4ed5d65362a8d6cec21662fb6eae233b0babc1f/contracts/BMath.sol#L55
		const weightRatio = bdiv(tokenWeightIn, tokenWeightOut)
		const adjustedIn = bmul(inputAmount, BONE.minus(this.swapFee))
		const y = bdiv(tokenBalanceIn, tokenBalanceIn.plus(adjustedIn))
		// NOTE(zviadm): this `bpow` isn't exactly same as in smart contract, thus output isn't fully precise.
		const negM = bpow(y, weightRatio)
		const multiplier = BONE.minus(negM)
		return bmul(tokenBalanceOut, multiplier)
	}

	protected swapExtraData() {
		return this.poolAddr
	}

	public snapshot(): PairBPoolSnapshot {
		return {
			balanceA: this.balanceA.toFixed(),
			balanceB: this.balanceB.toFixed()
		}
	}
	public restore(snapshot: PairBPoolSnapshot): void {
		this.balanceA = new BigNumber(snapshot.balanceA)
		this.balanceB = new BigNumber(snapshot.balanceB)
	}
}

function bmul(a: BigNumber, b: BigNumber) {
	return a.multipliedBy(b).plus(BONE.idiv(2)).idiv(BONE)
}

function bdiv(a: BigNumber, b: BigNumber) {
	return a.multipliedBy(BONE).plus(b.idiv(2)).idiv(b)
}

// NOTE(zviadm): this `bpow` isn't exactly same as in the smart contract. Cloning exact `bpow` is possible but
// would require quite a bit of work.
function bpow(a: BigNumber, exp: BigNumber) {
	return new BigNumber(
		Math.pow(a.div(BONE).toNumber(), exp.div(BONE).toNumber()))
		.multipliedBy(BONE).integerValue(BigNumber.ROUND_UP)
	// const expWhole = exp.idiv(BONE).multipliedBy(BONE)
	// const expRemain = exp.minus(expWhole)

	// const powWhole = a.div(BONE).pow(expWhole.idiv(BONE)).multipliedBy(BONE).integerValue(BigNumber.ROUND_UP)
	// if (expRemain.eq(0)) {
	// 	return powWhole
	// }
	// const powRemainApprox = new BigNumber(
	// 	Math.pow(a.div(BONE).toNumber(), expRemain.div(BONE).toNumber()))
	// 	.multipliedBy(BONE)
	// 	.integerValue(BigNumber.ROUND_UP)
	// return bmul(powWhole, powRemainApprox)
}