import { Address, ContractKit } from "@celo/contractkit"

import { PairStableSwap } from "../pairs/stableswap"
import { initPairsAndFilterByWhitelist } from "../utils"

export class RegistryMobius {
	constructor(private kit: ContractKit) {}

	findPairs = async (tokenWhitelist: Address[]) => {
		// Source: https://github.com/mobiusAMM/mobiusV1
		const pairs = [
			new PairStableSwap(this.kit, "0x0ff04189Ef135b6541E56f7C638489De92E9c778"), // cUSD <-> bUSDC
			new PairStableSwap(this.kit, "0xdBF27fD2a702Cc02ac7aCF0aea376db780D53247"), // cUSD <-> cUSDT
			new PairStableSwap(this.kit, "0xE0F2cc70E52f05eDb383313393d88Df2937DA55a"), // cETH <-> WETH
			new PairStableSwap(this.kit, "0x19260b9b573569dDB105780176547875fE9fedA3"), //  BTC <-> WBTC
			new PairStableSwap(this.kit, "0xA5037661989789d0310aC2B796fa78F1B01F195D"), // cUSD <-> USDC
			new PairStableSwap(this.kit, "0x2080AAa167e2225e1FC9923250bA60E19a180Fb2"), // cUSD <-> pUSDC
			new PairStableSwap(this.kit, "0x63C1914bf00A9b395A2bF89aaDa55A5615A3656e"), // cUSD <-> asUSDC
		]
		return initPairsAndFilterByWhitelist(pairs, tokenWhitelist)
	}
}
