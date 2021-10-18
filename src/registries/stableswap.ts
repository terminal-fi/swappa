import { Address, ContractKit } from "@celo/contractkit"

import { PairStableSwap } from "../pairs/stableswap"
import { initPairsAndFilterByWhitelist } from "../utils"

export class RegistryStableSwap {
	constructor(private kit: ContractKit, private poolAddrs: Address[]) {}

	findPairs = async (tokenWhitelist: Address[]) => {
		const pairs = this.poolAddrs.map((addr) => new PairStableSwap(this.kit, addr))
		return initPairsAndFilterByWhitelist(pairs, tokenWhitelist)
	}
}
