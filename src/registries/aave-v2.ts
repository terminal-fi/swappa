import { ContractKit } from "@celo/contractkit"

import { ILendingPoolV2, ABI as ILendingPoolV2ABI } from "../../types/web3-v1-contracts/ILendingPoolV2"
import { ILendingPoolAddressesProviderV2, ABI as ILendingPoolAddressesProviderV2ABI } from "../../types/web3-v1-contracts/ILendingPoolAddressesProviderV2"

import { Address } from "../pair"
import { initPairsAndFilterByWhitelist } from "../utils"
import { PairATokenV2 } from "../pairs/atoken-v2"
import { Registry } from "../registry"

export class RegistryAaveV2 extends Registry {
	private provider: ILendingPoolAddressesProviderV2

	constructor(name: string, private kit: ContractKit, lendingPoolAddrProviderAddr: string) {
		super(name)
		this.provider = new kit.web3.eth.Contract(ILendingPoolAddressesProviderV2ABI, lendingPoolAddrProviderAddr)
	}

	findPairs = async (tokenWhitelist: Address[]) => {
		const poolAddr: string = await this.provider.methods.getLendingPool().call()
		const lendingPool: ILendingPoolV2 = new this.kit.web3.eth.Contract(ILendingPoolV2ABI, poolAddr)
		const reserves: Address[] = await lendingPool.methods.getReservesList().call()
		const reservesMatched = reserves.filter((r) => tokenWhitelist.indexOf(r) >= 0)
		const pairs = reservesMatched.map((r) => (new PairATokenV2(this.kit, poolAddr, r)))
		return initPairsAndFilterByWhitelist(pairs, tokenWhitelist)
	}
}
