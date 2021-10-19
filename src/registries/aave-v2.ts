import { ContractKit } from "@celo/contractkit"
import { AbiItem } from "@celo/connect"

import * as LendingPoolJson from "@aave/protocol-v2/artifacts/contracts/protocol/lendingpool/LendingPool.sol/LendingPool.json"
import * as LendingPoolAddressesProviderJson from "@aave/protocol-v2/artifacts/contracts/protocol/configuration/LendingPoolAddressesProvider.sol/LendingPoolAddressesProvider.json"

import { Address } from "../pair"
import { initPairsAndFilterByWhitelist } from "../utils"
import { PairATokenV2 } from "../pairs/atoken-v2"

export class RegistryAaveV2 {
	private provider

	constructor(private kit: ContractKit, lendingPoolAddrProviderAddr: string) {
		this.provider = new kit.web3.eth.Contract(
			LendingPoolAddressesProviderJson.abi as AbiItem[], lendingPoolAddrProviderAddr)
	}

	findPairs = async (tokenWhitelist: Address[]) => {
		const poolAddr: string = await this.provider.methods.getLendingPool().call()
		const lendingPool = new this.kit.web3.eth.Contract(LendingPoolJson.abi as AbiItem[], poolAddr)
		const reserves: Address[] = await lendingPool.methods.getReservesList().call()
		const reservesMatched = reserves.filter((r) => tokenWhitelist.indexOf(r) >= 0)
		const pairs = reservesMatched.map((r) => (new PairATokenV2(this.kit, poolAddr, r)))
		return initPairsAndFilterByWhitelist(pairs, tokenWhitelist)
	}
}
