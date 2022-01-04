import { Address, Pair } from "../pair"
import { Registry } from "../registry"
import { initPairsAndFilterByWhitelist } from "../utils"

export class RegistryStatic extends Registry{
	constructor(name: string, private pairsAll: Pair[]) {
		super(name)
	}

	findPairs = async (tokenWhitelist: Address[]) => {
		return initPairsAndFilterByWhitelist(this.pairsAll, tokenWhitelist)
	}
}
