import { ContractKit } from "@celo/contractkit";
import { concurrentMap } from '@celo/utils/lib/async'

import { IbRegistry, ABI as IbRegistryABI } from "../../types/web3-v1-contracts/IBRegistry";
import { Address, Pair } from "../pair";
import { PairBPool } from "../pairs/bpool";
import { initPairsAndFilterByWhitelist } from "../utils";

export class RegistryBalancer {
	private registry: IbRegistry

	constructor(
		private kit: ContractKit,
		registryAddr: Address
	) {
		this.registry = new kit.web3.eth.Contract(IbRegistryABI, registryAddr) as unknown as IbRegistry
	}

	findPairs = async (tokenWhitelist: Address[]): Promise<Pair[]> =>  {
        const pairsToFetch: {tokenA: Address, tokenB: Address}[] = []
        for (let i = 0; i < tokenWhitelist.length - 1; i += 1) {
            for (let j = i + 1; j < tokenWhitelist.length; j += 1) {
                pairsToFetch.push({tokenA: tokenWhitelist[i], tokenB: tokenWhitelist[j]})
            }
        }
        const poolPairs = new Map<string, PairBPool>()
        await concurrentMap(
            10,
            pairsToFetch,
            async (toFetch) => {
                const pools = await this.registry.methods.getBestPools(toFetch.tokenA, toFetch.tokenB).call()
                if (pools.length == 0) {
                    return null
                }

                for (const poolAddr of pools) {
                    const pool = new PairBPool(this.kit, poolAddr, toFetch.tokenA, toFetch.tokenB)
                    if (pool.pairKey == null) {
                        throw new Error(`Invalid pairKey: ${poolAddr}!`)
                    }
                    const pairKey = pool.pairKey
                    if (poolPairs.has(pairKey)) {
                        // already seen this pool and token combination
                        continue
                    }
                    poolPairs.set(pairKey, pool)
                }
            })
		return initPairsAndFilterByWhitelist(Array.from(poolPairs.values()), tokenWhitelist)
	}
}