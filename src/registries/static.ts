import { Address, Pair } from "../pair"
import { Registry } from "../registry"

export class RegistryStatic extends Registry{
	constructor(name: string, private pairsAll: Promise<Pair[]>) {
		super(name)
	}

	findPairsWithoutInitialzing = async (tokenWhitelist: Address[]) => {
		return this.pairsAll
	}
}
