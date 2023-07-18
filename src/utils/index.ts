import { Address, Pair } from "../pair"
import { fastConcurrentMap } from "./async"

export const initPairsAndFilterByWhitelist = async (pairs: Pair[], tokenWhitelist: Address[]) => {
	await fastConcurrentMap(10, pairs, (p) => p.init())
	return pairs.filter((p) => (
		tokenWhitelist.indexOf(p.tokenA) >= 0 &&
		tokenWhitelist.indexOf(p.tokenB) >= 0
	))
}

interface AddressesByNetwork {
	mainnet?: Address,
	baklava?: Address,
	alfajores?: Address,
}

export const selectAddress = (chainId: number, addresses: AddressesByNetwork) => {
	switch (chainId) {
	case 42220:
		if (!addresses.mainnet) {
			throw new Error(`no address provided for Mainnet (${chainId})!`)
		}
		return addresses.mainnet
	case 62320:
		if (!addresses.baklava) {
			throw new Error(`no address provided for Baklava (${chainId})!`)
		}
		return addresses.baklava
	case 44787:
		if (!addresses.alfajores) {
			throw new Error(`no address provided for Alfajores (${chainId})!`)
		}
		return addresses.alfajores
	default:
		throw new Error(`unknown chainId: ${chainId}!`)
	}
}
