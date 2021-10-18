import { ContractKit } from "@celo/contractkit";
import { concurrentMap } from '@celo/utils/lib/async'

import { IUniswapV2Factory, ABI as FactoryABI } from "../../types/web3-v1-contracts/IUniswapV2Factory";
import { Address, Pair } from "../pair";
import { PairUniswapV2 } from "../pairs/uniswapv2";
import { initPairsAndFilterByWhitelist } from "../utils";

export class RegistryUniswapV2 {
	private factory: IUniswapV2Factory

	constructor(
		private kit: ContractKit,
		factoryAddr: Address,
	) {
		this.factory = new kit.web3.eth.Contract(FactoryABI, factoryAddr) as unknown as IUniswapV2Factory
	}

	findPairs = async (tokenWhitelist: Address[]): Promise<Pair[]> =>  {
		const pairsToFetch: {tokenA: Address, tokenB: Address}[] = []

		for (let i = 0; i < tokenWhitelist.length - 1; i += 1) {
			for (let j = i + 1; j < tokenWhitelist.length; j += 1) {
				pairsToFetch.push({tokenA: tokenWhitelist[i], tokenB: tokenWhitelist[j]})
			}
		}
		const pairsFetched = await concurrentMap(
			10,
			pairsToFetch,
			async (toFetch) => {
				const pairAddr = await this.factory.methods.getPair(toFetch.tokenA, toFetch.tokenB).call()
				if (pairAddr === "0x0000000000000000000000000000000000000000") {
					return null
				}
				return new PairUniswapV2(this.kit, pairAddr)
			})
		const pairs = pairsFetched.filter((p) => p !== null) as Pair[]
		return initPairsAndFilterByWhitelist(pairs, tokenWhitelist)
	}
}