import Web3 from "web3"
import BigNumber from "bignumber.js"

import { ISwap, ABI as SwapABI } from "../../types/web3-v1-contracts/ISwap"
import { Erc20, ABI as Erc20ABI } from '../../types/web3-v1-contracts/ERC20';

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

export class PairStableSwap extends Pair {
	allowRepeats = false
	private swapPool: ISwap

	private paused: boolean = false
	private tokenPrecisionMultipliers: BigNumber[] = []
	private balancesWithAdjustedPrecision: BigNumber[] = []
	private swapFee: BigNumber = new BigNumber(0)
	private preciseA: BigNumber = new BigNumber(0)

	private token0Idx: number
	private token1Idx: number

	static readonly POOL_PRECISION_DECIMALS = 18
	static readonly A_PRECISION = 100

	constructor(
		chainId: number,
		private web3: Web3,
		private swapPoolAddr: Address,
		tokenIdxs?: [number, number],
	) {
		super(selectAddress(chainId, {mainnet: pairStableSwapAddress}))
		this.swapPool = new web3.eth.Contract(SwapABI, swapPoolAddr) as unknown as ISwap
		this.token0Idx = tokenIdxs ? tokenIdxs[0] : 0
		this.token1Idx = tokenIdxs ? tokenIdxs[1] : 1
	}

	protected async _init() {
		const [
			tokenA,
			tokenB,
		] = await Promise.all([
			this.swapPool.methods.getToken(this.token0Idx).call(),
			this.swapPool.methods.getToken(this.token1Idx).call(),
		])
		const erc20A = new this.web3.eth.Contract(Erc20ABI, tokenA) as unknown as Erc20
		const erc20B = new this.web3.eth.Contract(Erc20ABI, tokenB) as unknown as Erc20
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
		this.paused = paused
		this.balancesWithAdjustedPrecision = balances.map((b, idx) => this.tokenPrecisionMultipliers[idx].multipliedBy(b))
		this.swapFee = new BigNumber(swapFee).div(new BigNumber(10).pow(10))
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
			x,
			this.balancesWithAdjustedPrecision,
			this.preciseA)
		const outputAmountWithFee = this.balancesWithAdjustedPrecision[tokenIndexTo].minus(y).minus(1)
		const fee = outputAmountWithFee.multipliedBy(this.swapFee)
  	const outputAmount = outputAmountWithFee.minus(fee).div(this.tokenPrecisionMultipliers[tokenIndexTo]).integerValue()
		return outputAmount
	}

	private getY = (x: BigNumber, xp: BigNumber[], a: BigNumber) => {
		// See: https://github.com/mobiusAMM/mobiusV1/blob/master/contracts/SwapUtils.sol#L531
		const d = this.getD(xp, a)
		const nTokens = xp.length
		const nA = a.multipliedBy(nTokens)

		const s = x
		const c = d
			.multipliedBy(d).div(x.multipliedBy(nTokens))
			.integerValue()
			.multipliedBy(d).multipliedBy(PairStableSwap.A_PRECISION).div(nA.multipliedBy(nTokens))
			.integerValue()
		const b = s.plus(d.multipliedBy(PairStableSwap.A_PRECISION).div(nA)).integerValue()

		let yPrev
		let y = d
		for (let i = 0; i < 256; i++) {
			yPrev = y
			y = y.multipliedBy(y).plus(c).div(
				y.multipliedBy(2).plus(b).minus(d))
				.integerValue()
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
				dP = dP.multipliedBy(d).div(x.multipliedBy(nTokens)).integerValue()
			})
			prevD = d
			d = nA.multipliedBy(s).div(PairStableSwap.A_PRECISION).plus(dP.multipliedBy(nTokens)).multipliedBy(d).div(
				nA.minus(PairStableSwap.A_PRECISION).multipliedBy(d).div(PairStableSwap.A_PRECISION).plus(
					new BigNumber(nTokens).plus(1).multipliedBy(dP)
				)
			).integerValue()
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

export async function createStableSwapPairs(
	chainId: number,
	web3: Web3,
	swapPoolAddr: Address,
): Promise<Pair[]> {
	const swapPool = new web3.eth.Contract(SwapABI, swapPoolAddr) as unknown as ISwap
	const balances = await swapPool.methods.getBalances().call()
	const nTokens = balances.length
	const r: Pair[] = []
	for (let i = 0; i < nTokens - 1; i++) {
		for (let j = i+1; j < nTokens; j++) {
			r.push(new PairStableSwap(chainId, web3, swapPoolAddr, [i, j]))
		}
	}
	return r
}
