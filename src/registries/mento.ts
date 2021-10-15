import { ContractKit, StableToken } from "@celo/contractkit"
import { Address } from "../pair"
import { PairMento } from "../pairs/mento"
import { filterPairsByWhitelist } from "../utils"

export class RegistryMento {
	constructor(private kit: ContractKit) {}

	findPairs = async (tokenWhitelist: Address[]) => {
		const cSTBs = await Promise.all(
			Object.values(StableToken).map(
				(stableToken) => {
					return this.kit.contracts.getStableToken(stableToken).then((wrapper) => ({
						name: stableToken,
						wrapper: wrapper,
					}))
			}))
		const celo = await this.kit.contracts.getGoldToken()
		const pairs = cSTBs.map((cSTB) => {
			return new PairMento(this.kit, cSTB.name, celo.address, cSTB.wrapper.address)
		})
		return filterPairsByWhitelist(pairs, tokenWhitelist)
	}
}
