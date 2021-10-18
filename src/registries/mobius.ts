import { Address, ContractKit } from "@celo/contractkit"

import { PairStableSwap } from "../pairs/stableswap"
import { initPairsAndFilterByWhitelist } from "../utils"

export class RegistryMobius {
	constructor(private kit: ContractKit) {}

	findPairs = async (tokenWhitelist: Address[]) => {
		const pairs = [
			new PairStableSwap(this.kit, "0xA5037661989789d0310aC2B796fa78F1B01F195D"), // cUSD <-> USDC
		]
		return initPairsAndFilterByWhitelist(pairs, tokenWhitelist)
	}
}
