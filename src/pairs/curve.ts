import Web3 from "web3"
import BigNumber from "bignumber.js"

import { ICurve, newICurve } from "../../types/web3-v1-contracts/ICurve"
import { newERC20 } from '../../types/web3-v1-contracts/ERC20';

import { Address, Pair, Snapshot, BigNumberString } from "../pair"
import { selectAddress } from "../utils"
import { address as pairCurveAddress } from "../../tools/deployed/mainnet.PairCurve.addr.json"

interface PairCurveSnapshot extends Snapshot {
	paused: boolean
	tokenPrecisionMultipliers: BigNumberString[]
	balancesWithAdjustedPrecision: BigNumberString[]
	swapFee: BigNumberString
	preciseA: BigNumberString
}

const SWAP_FEE_DENOM = new BigNumber(10).pow(10)

export class PairCurve extends Pair {
	allowRepeats = false
	private curvePool: ICurve

	private paused: boolean = false
	private tokenPrecisionMultipliers: BigNumber[] = []
	private balancesWithAdjustedPrecision: BigNumber[] = []
	private swapFee: BigNumber = new BigNumber(0)
	private preciseA: BigNumber = new BigNumber(0)

	private token0Idx: number
	private token1Idx: number
	private nCoins: number

	static readonly POOL_PRECISION_DECIMALS = 18
	static readonly A_PRECISION = 100

	constructor(
		chainId: number,
		private web3: Web3,
		private poolAddr: Address,
		opts?: {nCoins: number, token0Idx: number, token1Idx: number},
	) {
		super(web3, selectAddress(chainId, {mainnet: pairCurveAddress}))
		this.curvePool = newICurve(web3, poolAddr)
		this.nCoins = opts ? opts.nCoins : 2
		this.token0Idx = opts ? opts.token0Idx : 0
		this.token1Idx = opts ? opts.token1Idx : 1
	}

	protected async _init() {
		const coins: string[] = []
		this.tokenPrecisionMultipliers = []
		for (let i = 0; i < this.nCoins; i += 1) {
			const coin = await this.curvePool.methods.coins(i).call()
			coins.push(coin)
			const erc20 = newERC20(this.web3, coin)
			const decimals = await erc20.methods.decimals().call()
			this.tokenPrecisionMultipliers.push(
				new BigNumber(10).pow(PairCurve.POOL_PRECISION_DECIMALS - Number.parseInt(decimals)),
			)
		}
		return {
			pairKey: this.poolAddr,
			tokenA: coins[this.token0Idx],
			tokenB: coins[this.token1Idx],
		}
	}

	public async refresh() {
		const [
			paused,
			balances,
			swapFee,
			preciseA,
		 ] = await Promise.all([
			false,
			Promise.all([...Array(this.nCoins).keys()].map((i) => this.curvePool.methods.balances(i).call())),
			this.curvePool.methods.fee().call(),
			this.curvePool.methods.A_precise().call(),
		])
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
		const [tokenIndexFrom, tokenIndexTo] = inputToken === this.tokenA ?
			[this.token0Idx, this.token1Idx] : [this.token1Idx, this.token0Idx]
		const x = inputAmount
			.multipliedBy(this.tokenPrecisionMultipliers[tokenIndexFrom])
			.plus(this.balancesWithAdjustedPrecision[tokenIndexFrom])
		const y = this.getY(
			tokenIndexFrom,
			tokenIndexTo,
			x,
			this.balancesWithAdjustedPrecision,
			this.preciseA)
		const outputAmountWithFee = this.balancesWithAdjustedPrecision[tokenIndexTo].minus(y).minus(1)
		const fee = outputAmountWithFee.multipliedBy(this.swapFee).idiv(SWAP_FEE_DENOM)
		const outputAmount = outputAmountWithFee.minus(fee).idiv(this.tokenPrecisionMultipliers[tokenIndexTo])
		return outputAmount
	}

	public inputAmount(outputToken: Address, outputAmount: BigNumber): BigNumber {
		if (this.paused) {
			return new BigNumber(0)
		}

		// https://github.com/curvefi/curve-pool-registry/blob/master/contracts/CurveCalc.vy#L146
		const [tokenIndexFrom, tokenIndexTo] = outputToken === this.tokenB ?
			[this.token0Idx, this.token1Idx] : [this.token1Idx, this.token0Idx]
		const yAfterTrade =
			this.balancesWithAdjustedPrecision[tokenIndexTo].minus(
				outputAmount
					.multipliedBy(this.tokenPrecisionMultipliers[tokenIndexTo])
					.multipliedBy(SWAP_FEE_DENOM).div(SWAP_FEE_DENOM.minus(this.swapFee)))
		const _x = this.getY(
			tokenIndexTo,
			tokenIndexFrom,
			yAfterTrade,
			this.balancesWithAdjustedPrecision,
			this.preciseA)
		const inputAmount = _x.minus(this.balancesWithAdjustedPrecision[tokenIndexFrom]).idiv(this.tokenPrecisionMultipliers[tokenIndexFrom])
		return inputAmount
	}

	private getY = (fromIdx: number, toIdx: number, x: BigNumber, xp: BigNumber[], a: BigNumber) => {
		// See: https://github.com/mobiusAMM/mobiusV1/blob/master/contracts/SwapUtils.sol#L531
		const d = this.getD(xp, a)
		const nTokens = xp.length
		const nA = a.multipliedBy(nTokens)

		let s = new BigNumber(0)
		let c = d
		for (let idx = 0; idx < xp.length; idx += 1) {
			let _x
			if (idx === fromIdx) {
				_x = x
			} else if (idx !== toIdx) {
				_x = xp[idx]
			} else {
				continue
			}
			s = s.plus(_x)
			c = c.multipliedBy(d).idiv(_x.multipliedBy(nTokens))
		}
		c = c
			.multipliedBy(d).multipliedBy(PairCurve.A_PRECISION).idiv(nA.multipliedBy(nTokens))
		const b = s.plus(d.multipliedBy(PairCurve.A_PRECISION).idiv(nA))

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
			d = nA.multipliedBy(s).idiv(PairCurve.A_PRECISION).plus(dP.multipliedBy(nTokens)).multipliedBy(d).idiv(
				nA.minus(PairCurve.A_PRECISION).multipliedBy(d).idiv(PairCurve.A_PRECISION).plus(
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
		return this.poolAddr
	}

	public snapshot(): PairCurveSnapshot {
		return {
			paused: this.paused,
			tokenPrecisionMultipliers: this.tokenPrecisionMultipliers.map(n => n.toFixed()),
			balancesWithAdjustedPrecision: this.balancesWithAdjustedPrecision.map(n => n.toFixed()),
			swapFee: this.swapFee.toFixed(),
			preciseA: this.preciseA.toFixed()
		}
	}

	public restore(snapshot: PairCurveSnapshot): void {
		this.paused = snapshot.paused
		this.tokenPrecisionMultipliers = snapshot.tokenPrecisionMultipliers.map(r => new BigNumber(r))
		this.balancesWithAdjustedPrecision = snapshot.balancesWithAdjustedPrecision.map(r => new BigNumber(r))
		this.swapFee = new BigNumber(snapshot.swapFee)
		this.preciseA = new BigNumber(snapshot.preciseA)
	}
}

export async function createCurvePairs(
	chainId: number,
	web3: Web3,
	poolAddr: Address,
	nCoins: number,
): Promise<Pair[]> {
	const r: Pair[] = []
	for (let token0Idx = 0; token0Idx < nCoins - 1; token0Idx++) {
		for (let token1Idx = token0Idx+1; token1Idx < nCoins; token1Idx++) {
			r.push(new PairCurve(chainId, web3, poolAddr, {nCoins, token0Idx, token1Idx}))
		}
	}
	return r
}
