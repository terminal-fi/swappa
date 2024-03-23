import Web3 from 'web3'

import { IBRegistry, newIBRegistry } from "../../types/web3-v1-contracts/IBRegistry"
import { Address, Pair } from "../pair"
import { PairBPool } from "../pairs/bpool"
import { Registry } from "../registry"
import { initPairsAndFilterByWhitelist } from "../utils"
import { fastConcurrentMap } from '../utils/async'

export class RegistryBalancer extends Registry {
	private registry: IBRegistry

	constructor(
		name: string,
		private web3: Web3,
		registryAddr: Address
	) {
		super(name)
		this.registry = newIBRegistry(web3, registryAddr)
	}

	findPairsWithoutInitialzing = async (tokenWhitelist: Address[]): Promise<Pair[]> =>  {
		const chainId = await this.web3.eth.getChainId()
		const pairsToFetch: {tokenA: Address, tokenB: Address}[] = []
		for (let i = 0; i < tokenWhitelist.length - 1; i += 1) {
			for (let j = i + 1; j < tokenWhitelist.length; j += 1) {
				pairsToFetch.push({tokenA: tokenWhitelist[i], tokenB: tokenWhitelist[j]})
			}
		}
		const poolPairs = new Map<string, PairBPool>()
		await fastConcurrentMap(
			10,
			pairsToFetch,
			async (toFetch) => {
				const pools = await this.registry.methods.getBestPools(toFetch.tokenA, toFetch.tokenB).call()
				if (pools.length == 0) {
					return null
				}

				for (const poolAddr of pools) {
					const pool = new PairBPool(chainId, this.web3, poolAddr, toFetch.tokenA, toFetch.tokenB)
					// bpool can be used for each input & output combination
					let key
					if (toFetch.tokenA.toLowerCase().localeCompare(toFetch.tokenB.toLowerCase()) > 0) {
						key = `${poolAddr}-${toFetch.tokenA}:${toFetch.tokenB}`
					} else {
						key = `${poolAddr}-${toFetch.tokenB}:${toFetch.tokenA}`
					}
					if (poolPairs.has(key)) {
						// already has this pool and token combination
						continue
					}
					poolPairs.set(key, pool)
				}
			})
		return Array.from(poolPairs.values())
	}
}
