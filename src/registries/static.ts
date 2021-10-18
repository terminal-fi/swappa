import { Address, Pair } from "../pair"
import { initPairsAndFilterByWhitelist } from "../utils"

export class RegistryStatic {
	constructor(private pairsAll: Pair[]) {}

	findPairs = async (tokenWhitelist: Address[]) => {
		return initPairsAndFilterByWhitelist(this.pairsAll, tokenWhitelist)
	}
}
