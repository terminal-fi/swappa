import { ContractKit, StableToken } from "@celo/contractkit"
import { concurrentMap } from '@celo/utils/lib/async'

import { Address } from "../pair"
import { PairMento } from "../pairs/mento"
import { Registry } from "../registry"
import { initPairsAndFilterByWhitelist } from "../utils"

export class RegistryMento extends Registry{
	constructor(private kit: ContractKit) {
		super("mento")
	}

	findPairs = async (tokenWhitelist: Address[]) => {
		const cSTBs = await concurrentMap(
			5,
			Object.values(StableToken),
			(stableToken) => {
				return this.kit.contracts.getStableToken(stableToken).then((wrapper) => ({
					name: stableToken,
					wrapper: wrapper,
				}))
			})
			console.log(cSTBs, "cSTBs")
		const chainId = await this.kit.web3.eth.getChainId()
		const pairs = cSTBs.map((cSTB) => (new PairMento(chainId, this.kit, cSTB.name)))
		// console.log(pairs, "pairs")
		// console.log(tokenWhitelist, "tokenWhiteList")
		// console.log(chainId, pairs)
		return initPairsAndFilterByWhitelist(pairs, tokenWhitelist)
	}
}
