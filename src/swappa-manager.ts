import { CeloTransactionObject, toTransactionObject } from "@celo/connect"
import { ContractKit } from "@celo/contractkit"
import { concurrentMap } from '@celo/utils/lib/async'
import BigNumber from "bignumber.js"

import { SwappaRouterV1, ABI as SwappaRouterABI } from '../types/web3-v1-contracts/SwappaRouterV1'

import { Address, Pair } from "./pair"
import { Registry } from "./registry"
import { findBestRoutesForFixedInputAmount, Route, RouterOpts } from "./router"

class SwappaManager {
	private swappaRouter: SwappaRouterV1
	private pairs: Pair[] = []
	private pairsByToken = new Map<string, Pair[]>()

	constructor(
		private kit: ContractKit,
		public readonly routerAddr: Address,
		private registries: Registry[],
	) {
		this.swappaRouter = new kit.web3.eth.Contract(SwappaRouterABI, routerAddr) as unknown as SwappaRouterV1
	}

	public reinitializePairs = async (tokenWhitelist: Address[]) => {
		const pairsAll = await concurrentMap(5, this.registries, (r) => r.findPairs(tokenWhitelist))
		this.pairs = []
		this.pairsByToken = new Map<string, Pair[]>()
		pairsAll.forEach((pairs) => {
			pairs.forEach((p) => {
				this.pairs.push(p)
				for (const token of [p.tokenA, p.tokenB]) {
					const x = this.pairsByToken.get(token)
					if (x) {
						x.push(p)
					} else {
						this.pairsByToken.set(token, [p])
					}
				}
			})
		})
		await concurrentMap(10, this.pairs, (p) => p.init())
		return this.pairs
	}

	public refreshPairs = async () => {
		await concurrentMap(10, this.pairs, (p) => p.refresh())
		return this.pairs
	}

	public findBestRoutesForFixedInputAmount = (
		inputToken: Address,
		outputToken: Address,
		inputAmount: BigNumber,
		opts?: RouterOpts) => {
		return findBestRoutesForFixedInputAmount(
			this.pairsByToken,
			inputToken,
			outputToken,
			inputAmount,
			opts)
	}

	public swap = (
		route: Route,
		inputAmount: BigNumber,
		minOutputAmount: BigNumber,
		to: Address,
		deadlineMs?: number,
		): CeloTransactionObject<unknown> => {
		const routeData = route.pairs.map((p, idx) => p.swapData(route.path[idx]))
		deadlineMs = deadlineMs || (Date.now() / 1000 + 60)
		const tx = toTransactionObject(
			this.kit.connection,
			this.swappaRouter.methods.swapExactInputForOutput(
				route.path,
				routeData.map((d) => d.addr),
				routeData.map((d) => d.extra),
				inputAmount.toFixed(0),
				minOutputAmount.multipliedBy(0.995).toFixed(0),
				to,
				deadlineMs.toFixed(0),
			))
		return tx
	}

}

export default SwappaManager