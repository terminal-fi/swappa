import { ContractKit } from "@celo/contractkit";
import { ILendingPool, ABI as LendingPoolABI } from "../../types/web3-v1-contracts/ILendingPool";
import { ILendingPoolAddressesProvider, ABI as LendingPoolAddressProviderABI } from "../../types/web3-v1-contracts/ILendingPoolAddressesProvider";
import { Address } from "../pair";
import { PairAToken } from "../pairs/atoken";
import { filterPairsByWhitelist } from "../utils";

export class RegistryAave {
	private lendingPoolAddrProvider: ILendingPoolAddressesProvider

	constructor(private kit: ContractKit, lendingPoolAddrProviderAddr: string) {
		this.lendingPoolAddrProvider = new kit.web3.eth.Contract(
			LendingPoolAddressProviderABI, lendingPoolAddrProviderAddr) as unknown as ILendingPoolAddressesProvider
	}

	findPairs = async (tokenWhitelist: Address[]) => {
		const lendingPoolAddr = await this.lendingPoolAddrProvider.methods.getLendingPool().call()
		const lendingPool = new this.kit.web3.eth.Contract(LendingPoolABI, lendingPoolAddr) as unknown as ILendingPool
		const celo = await this.kit.contracts.getGoldToken()
		const celoReserve = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
		const reserves = await lendingPool.methods.getReserves().call()
		const reservesMatched = [
			celoReserve,
			...reserves.filter((r) => tokenWhitelist.indexOf(r) >= 0),
		]
		const pairs = await Promise.all(
			reservesMatched.map(async (r) => {
				const data = await lendingPool.methods.getReserveData(r).call()
				const isUnderlyingCELO = r === celoReserve
				const underlying = !isUnderlyingCELO ? r : celo.address
				return new PairAToken(
					this.lendingPoolAddrProvider.options.address,
					isUnderlyingCELO,
					data.aTokenAddress,
					underlying,
				)
			})
		)
		return filterPairsByWhitelist(pairs, tokenWhitelist)
	}
}
