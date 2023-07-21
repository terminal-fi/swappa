import { ContractKit } from "@celo/contractkit"

import { newILendingPool } from "../../types/web3-v1-contracts/ILendingPool"
import { ILendingPoolAddressesProvider, newILendingPoolAddressesProvider } from "../../types/web3-v1-contracts/ILendingPoolAddressesProvider"
import { Address } from "../pair"
import { PairAToken, ReserveCELO } from "../pairs/atoken"
import { Registry } from "../registry"

export class RegistryAave extends Registry {
	private lendingPoolAddrProvider: ILendingPoolAddressesProvider

	constructor(name: string, private kit: ContractKit, lendingPoolAddrProviderAddr: string) {
		super(name)
		this.lendingPoolAddrProvider = newILendingPoolAddressesProvider(kit.web3 as any, lendingPoolAddrProviderAddr)
	}

	findPairsWithoutInitialzing = async (tokenWhitelist: Address[]) => {
		const chainId = await this.kit.web3.eth.getChainId()
		const lendingPoolAddr = await this.lendingPoolAddrProvider.methods.getLendingPool().call()
		const lendingPool = newILendingPool(this.kit.web3 as any, lendingPoolAddr)
		const reserves = await lendingPool.methods.getReserves().call()
		const reservesMatched = [
			ReserveCELO,
			...reserves.filter((r) => tokenWhitelist.indexOf(r) >= 0),
		]
		const pairs = reservesMatched.map((r) => (
			new PairAToken(chainId, this.kit, this.lendingPoolAddrProvider.options.address, r)))
		return pairs
	}
}
