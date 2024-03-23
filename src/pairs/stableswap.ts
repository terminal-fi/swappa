import Web3 from "web3"
import BigNumber from "bignumber.js"

import { ISwap, newISwap } from "../../types/web3-v1-contracts/ISwap"
import { newERC20 } from '../../types/web3-v1-contracts/ERC20';

import { Address, Pair, Snapshot, BigNumberString } from "../pair"
import { selectAddress } from "../utils"
import { address as pairStableSwapAddress } from "../../tools/deployed/mainnet.PairStableSwap.addr.json"

interface PairStableSwapSnapshot extends Snapshot {
	paused: boolean
	tokenPrecisionMultipliers: BigNumberString[]
	balancesWithAdjustedPrecision: BigNumberString[]
	swapFee: BigNumberString
	preciseA: BigNumberString
}

const SWAP_FEE_DENOM = new BigNumber(10).pow(10)

export class PairStableSwap extends Pair {
	allowRepeats = false
	private swapPool: ISwap

	private paused: boolean = false
	private tokenPrecisionMultipliers: BigNumber[] = []
	private balancesWithAdjustedPrecision: BigNumber[] = []
	private swapFee: BigNumber = new BigNumber(0)
	private preciseA: BigNumber = new BigNumber(0)

	static readonly POOL_PRECISION_DECIMALS = 18
	static readonly A_PRECISION = 100

	constructor(
		chainId: number,
		private web3: Web3,
		private swapPoolAddr: Address,
	) {
		super(web3, selectAddress(chainId, {mainnet: pairStableSwapAddress}))
		this.swapPool = newISwap(web3, swapPoolAddr)
	}

	protected async _init() {
		const [
			tokenA,
			tokenB,
		] = await Promise.all([
			this.swapPool.methods.getToken(0).call(),
			this.swapPool.methods.getToken(1).call(),
		])
		const erc20A = newERC20(this.web3, tokenA)
		const erc20B = newERC20(this.web3, tokenB)
		const [
			decimalsA,
			decimalsB,
		] = await Promise.all([
			erc20A.methods.decimals().call(),
			erc20B.methods.decimals().call(),
		])
		this.tokenPrecisionMultipliers = [
			new BigNumber(10).pow(PairStableSwap.POOL_PRECISION_DECIMALS - Number.parseInt(decimalsA)),
			new BigNumber(10).pow(PairStableSwap.POOL_PRECISION_DECIMALS - Number.parseInt(decimalsB)),
		]
		return {
			pairKey: this.swapPoolAddr,
			tokenA, tokenB,
		}
	}

	public async refresh() {
		const [
			paused,
			balances,
			swapFee,
			preciseA,
		 ] = await Promise.all([
			this.swapPool.methods.paused().call(),
			this.swapPool.methods.getBalances().call(),
			this.swapPool.methods.getSwapFee().call(),
			this.swapPool.methods.getAPrecise().call(),
		])
		if (balances.length !== 2) {
			throw new Error("pool must have only 2 tokens!")
		}
		this.paused = paused
		this.balancesWithAdjustedPrecision = balances.map((b, idx) => this.tokenPrecisionMultipliers[idx].multipliedBy(b))
		this.swapFee = new BigNumber(swapFee)
		this.preciseA = new BigNumber(preciseA)
	}

	public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
		if (this.paused) {
			return new BigNumber(0)
		}

		// See: https://github.com/mobiusAMM/mobiusV1/blob/master/contracts/SwapUtils.sol#L617
		const [tokenIndexFrom, tokenIndexTo] = inputToken === this.tokenA ? [0, 1] : [1, 0]
		const x = inputAmount
			.multipliedBy(this.tokenPrecisionMultipliers[tokenIndexFrom])
			.plus(this.balancesWithAdjustedPrecision[tokenIndexFrom])
		const y = this.getY(
			x,
			this.balancesWithAdjustedPrecision,
			this.preciseA)
		const outputAmountWithFee = this.balancesWithAdjustedPrecision[tokenIndexTo].minus(y).minus(1)
		const fee = outputAmountWithFee.multipliedBy(this.swapFee).idiv(SWAP_FEE_DENOM)
  	const outputAmount = outputAmountWithFee.minus(fee).idiv(this.tokenPrecisionMultipliers[tokenIndexTo])
		return outputAmount
	}

	private getY = (x: BigNumber, xp: BigNumber[], a: BigNumber) => {
		// See: https://github.com/mobiusAMM/mobiusV1/blob/master/contracts/SwapUtils.sol#L531
		const d = this.getD(xp, a)
		const nTokens = xp.length
		const nA = a.multipliedBy(nTokens)

		const s = x
		const c = d
			.multipliedBy(d).idiv(x.multipliedBy(nTokens))
			.multipliedBy(d).multipliedBy(PairStableSwap.A_PRECISION).idiv(nA.multipliedBy(nTokens))
		const b = s.plus(d.multipliedBy(PairStableSwap.A_PRECISION).idiv(nA))

		let yPrev
		let y = d
		for (let i = 0; i < 256; i++) {
			yPrev = y
			y = y.multipliedBy(y).plus(c).idiv(y.multipliedBy(2).plus(b).minus(d))
			if (y.minus(yPrev).abs().lte(1)) {
				return y
			}
		}
		throw new Error("SwapPool approximation did not converge!")
	}

	private getD (xp: BigNumber[], a: BigNumber) {
		// See: https://github.com/mobiusAMM/mobiusV1/blob/master/contracts/SwapUtils.sol#L393
		const s = BigNumber.sum(...xp)
		if (s.eq(0)) {
			return s
		}

		let prevD
		let d = s
		const nTokens = xp.length
		const nA = a.multipliedBy(nTokens)

		for (let i = 0; i < 256; i++) {
			let dP = d
			xp.forEach((x) => {
				dP = dP.multipliedBy(d).idiv(x.multipliedBy(nTokens))
			})
			prevD = d
			d = nA.multipliedBy(s).idiv(PairStableSwap.A_PRECISION).plus(dP.multipliedBy(nTokens)).multipliedBy(d).idiv(
				nA.minus(PairStableSwap.A_PRECISION).multipliedBy(d).idiv(PairStableSwap.A_PRECISION).plus(
					new BigNumber(nTokens).plus(1).multipliedBy(dP)
				)
			)
			if (d.minus(prevD).abs().lte(1)) {
				return d
			}
		}
		throw new Error("SwapPool D does not converge!")
	}

	protected swapExtraData() {
		return this.swapPoolAddr
	}

	public snapshot(): PairStableSwapSnapshot {
		return {
			paused: this.paused,
			tokenPrecisionMultipliers: this.tokenPrecisionMultipliers.map(n => n.toFixed()),
			balancesWithAdjustedPrecision: this.balancesWithAdjustedPrecision.map(n => n.toFixed()),
			swapFee: this.swapFee.toFixed(),
			preciseA: this.preciseA.toFixed()
		}
	}

	public restore(snapshot: PairStableSwapSnapshot): void {
		this.paused = snapshot.paused
		this.tokenPrecisionMultipliers = snapshot.tokenPrecisionMultipliers.map(r => new BigNumber(r))
		this.balancesWithAdjustedPrecision = snapshot.balancesWithAdjustedPrecision.map(r => new BigNumber(r))
		this.swapFee = new BigNumber(snapshot.swapFee)
		this.preciseA = new BigNumber(snapshot.preciseA)
	}
}
