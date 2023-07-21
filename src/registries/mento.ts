import { ContractKit, StableToken } from "@celo/contractkit"

import { Address } from "../pair"
import { PairMento } from "../pairs/mento"
import { Registry } from "../registry"
import { fastConcurrentMap } from "../utils/async"

export class RegistryMento extends Registry{
	constructor(private kit: ContractKit) {
		super("mento")
	}

	findPairsWithoutInitialzing = async (tokenWhitelist: Address[]) => {
		const cSTBs = await fastConcurrentMap(
			5,
			Object.values(StableToken),
			(stableToken) => {
				return this.kit.contracts.getStableToken(stableToken).then((wrapper) => ({
					name: stableToken,
					wrapper: wrapper,
				}))
			})
		const chainId = await this.kit.web3.eth.getChainId()
		const pairs = cSTBs.map((cSTB) => (new PairMento(chainId, this.kit, cSTB.name)))
		return pairs
	}
}
