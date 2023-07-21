import Web3 from "web3"

import { ILendingPoolV2, newILendingPoolV2 } from "../../types/web3-v1-contracts/ILendingPoolV2"
import { ILendingPoolAddressesProviderV2, newILendingPoolAddressesProviderV2 } from "../../types/web3-v1-contracts/ILendingPoolAddressesProviderV2"

import { Address } from "../pair"
import { PairATokenV2 } from "../pairs/atoken-v2"
import { Registry } from "../registry"

export class RegistryAaveV2 extends Registry {
	private provider: ILendingPoolAddressesProviderV2

	constructor(name: string, private web3: Web3, lendingPoolAddrProviderAddr: string) {
		super(name)
		this.provider = newILendingPoolAddressesProviderV2(web3, lendingPoolAddrProviderAddr)
	}

	findPairsWithoutInitialzing = async (tokenWhitelist: Address[]) => {
		const chainId = await this.web3.eth.getChainId()
		const poolAddr: string = await this.provider.methods.getLendingPool().call()
		const lendingPool: ILendingPoolV2 = newILendingPoolV2(this.web3, poolAddr)
		const reserves: Address[] = await lendingPool.methods.getReservesList().call()
		const reservesMatched = reserves.filter((r) => tokenWhitelist.indexOf(r) >= 0)
		const pairs = reservesMatched.map((r) => (new PairATokenV2(chainId, this.web3, poolAddr, r)))
		return pairs
	}
}
