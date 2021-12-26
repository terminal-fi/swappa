import Web3 from "web3"
import { concurrentMap } from '@celo/utils/lib/async'

import { Address, Pair } from "./pair"

export const initPairsAndFilterByWhitelist = async (pairs: Pair[], tokenWhitelist: Address[]) => {
	await concurrentMap(10, pairs, (p) => p.init())
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

export const selectAddress = async (web3: Web3, addresses: AddressesByNetwork) => {
	const chainId = await web3.eth.getChainId()
	return selectAddressUsingChainId(chainId, addresses)
}

export const selectAddressUsingChainId = (chainId: number, addresses: AddressesByNetwork) => {
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