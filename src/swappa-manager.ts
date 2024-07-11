import { CeloTransactionObject, toTransactionObject } from "@celo/connect"
import { ContractKit } from "@celo/contractkit"
import BigNumber from "bignumber.js"

import { newSwappaRouterV1 } from '../types/web3-v1-contracts/SwappaRouterV1'

import { Address, Pair } from "./pair"
import { Registry } from "./registry"
import { findBestRoutesForFixedInputAmount, RouterOpts } from "./router"
import { fastConcurrentMap } from "./utils/async"
import { initPairsAndFilterByWhitelist } from "./utils"

export class SwappaManager {
	private pairs: Pair[] = []
	private pairsByToken = new Map<string, Pair[]>()
	private pairsByRegistry = new Map<string, Pair[]>()

	constructor(
		private kit: ContractKit,
		public readonly routerAddr: Address,
		private registries: Registry[],
	) {
	}

	public reinitializePairs = async (tokenWhitelist: Address[]) => {
		this.pairsByRegistry = new Map<string, Pair[]>()
		const initT0 = Date.now()
		const registryByPair = new Map<Pair, string>()
		const pairsAll = await fastConcurrentMap(5, this.registries, (r) =>
			r.findPairsWithoutInitialzing(tokenWhitelist).then(pairs => {
				console.log(`SwappaManager: initialized ${r.getName()} in ${Date.now() - initT0}ms...`)
				pairs.forEach((p) => { registryByPair.set(p, r.getName()) })
				return pairs
			}))
		this.pairs = []
		pairsAll.forEach((pairs) => { this.pairs.push(...pairs) })
		console.log(`SwappaManager: initializing pairs: ${this.pairs.length}...`)
		const initPairsT0 = Date.now()
		this.pairs = await initPairsAndFilterByWhitelist(this.pairs, tokenWhitelist)
		console.log(`SwappaManager: initialized pairs: ${this.pairs.length}, elapsed: ${Date.now() - initPairsT0}ms...`)

		this.pairsByToken = new Map<string, Pair[]>()
		this.pairs.forEach((p) => {
			const rName = registryByPair.get(p)!
			const pairsByR = this.pairsByRegistry.get(rName)
			if (!pairsByR) {
				this.pairsByRegistry.set(rName, [p])
			} else {
				pairsByR.push(p)
			}
			for (const token of [p.tokenA, p.tokenB]) {
				const x = this.pairsByToken.get(token)
				if (x) {
					x.push(p)
				} else {
					this.pairsByToken.set(token, [p])
				}
			}
		})
		return this.pairs
	}

	public refreshPairs = async () => {
		await fastConcurrentMap(10, this.pairs, (p) => p.refresh())
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
		route: {
			pairs: Pair[],
			path: Address[],
		},
		inputAmount: BigNumber,
		minOutputAmount: BigNumber,
		to: Address,
		opts?: {
			precheckOutputAmount?: boolean,
			deadlineMs?: number,
		}
		): CeloTransactionObject<unknown> => {
		return swapTX(this.kit, this.routerAddr, route, inputAmount, minOutputAmount, to, opts)
	}

	public calcSwapOutput = async (
		route: {
			pairs: Pair[],
			path: Address[],
		},
		inputAmount: BigNumber,
		): Promise<BigNumber> => {
		return calcSwapOutput(this.kit, this.routerAddr, route, inputAmount)
	}

	public getPairsByRegistry(registry: string): Pair[] {
		return this.pairsByRegistry.get(registry) || []
	}
}

export const swapTX = (
	kit: ContractKit,
	routerAddr: Address,
	route: {
		pairs: Pair[],
		path: Address[],
	},
	inputAmount: BigNumber,
	minOutputAmount: BigNumber,
	to: Address,
	opts?: {
		precheckOutputAmount?: boolean,
		deadlineMs?: number,
	}
	): CeloTransactionObject<unknown> => {
	const router = newSwappaRouterV1(kit.web3 as any, routerAddr)
	const routeData = route.pairs.map((p, idx) => p.swapData(route.path[idx]))
	const deadlineMs = opts?.deadlineMs || (Date.now() + 60 * 1000)
	const swapF = opts?.precheckOutputAmount ? router.methods.swapExactInputForOutputWithPrecheck : router.methods.swapExactInputForOutput
	const tx = toTransactionObject(
		kit.connection,
		swapF(
			route.path,
			routeData.map((d) => d.addr),
			routeData.map((d) => d.extra),
			inputAmount.toFixed(0),
			minOutputAmount.toFixed(0),
			to,
			(deadlineMs / 1000).toFixed(0),
		))
	return tx
}

export const calcSwapOutput = async (
	kit: ContractKit,
	routerAddr: Address,
	route: {
		pairs: Pair[],
		path: Address[],
	},
	inputAmount: BigNumber,
	): Promise<BigNumber> => {
	const router = newSwappaRouterV1(kit.web3 as any, routerAddr)
	const routeData = route.pairs.map((p, idx) => p.swapData(route.path[idx]))
	const out = await router.methods.getOutputAmount(
		route.path,
		routeData.map((d) => d.addr),
		routeData.map((d) => d.extra),
		inputAmount.toFixed(0),
		).call()
	return new BigNumber(out)
}
