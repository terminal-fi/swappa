import Web3 from "web3"

import { ILendingPoolV2, ABI as ILendingPoolV2ABI } from "../../types/web3-v1-contracts/ILendingPoolV2"
import { ILendingPoolAddressesProviderV2, ABI as ILendingPoolAddressesProviderV2ABI } from "../../types/web3-v1-contracts/ILendingPoolAddressesProviderV2"

import { Address } from "../pair"
import { initPairsAndFilterByWhitelist } from "../utils"
import { PairATokenV2 } from "../pairs/atoken-v2"

export class RegistryAaveV2 {
	private provider: ILendingPoolAddressesProviderV2

	constructor(private web3: Web3, lendingPoolAddrProviderAddr: string) {
		this.provider = new web3.eth.Contract(ILendingPoolAddressesProviderV2ABI, lendingPoolAddrProviderAddr) as unknown as ILendingPoolAddressesProviderV2
	}

	findPairs = async (tokenWhitelist: Address[]) => {
		const poolAddr: string = await this.provider.methods.getLendingPool().call()
		const lendingPool: ILendingPoolV2 = new this.web3.eth.Contract(ILendingPoolV2ABI, poolAddr) as unknown as ILendingPoolV2
		const reserves: Address[] = await lendingPool.methods.getReservesList().call()
		const reservesMatched = reserves.filter((r) => tokenWhitelist.indexOf(r) >= 0)
		const pairs = reservesMatched.map((r) => (new PairATokenV2(this.web3, poolAddr, r)))
		return initPairsAndFilterByWhitelist(pairs, tokenWhitelist)
	}
}
