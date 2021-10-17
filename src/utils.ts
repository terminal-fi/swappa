import { ContractKit } from "@celo/contractkit"
import { Address, Pair } from "./pair"


export const filterPairsByWhitelist = (pairs: Pair[], tokenWhitelist: Address[]) => {
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

export const selectAddress = async (kit: ContractKit, addresses: AddressesByNetwork) => {
	const chainId = await kit.web3.eth.getChainId()
	return selectAddressUsingChainId(chainId, addresses)
}

export const selectAddressUsingChainId = (chainId: number, addresses: AddressesByNetwork) => {
	switch (chainId) {
	case 42220:
		if (!addresses.mainnet) {
			throw new Error(`no address provided for Mainnet (422220)!`)
		}
		return addresses.mainnet
	case 62320:
		if (!addresses.baklava) {
			throw new Error(`no address provided for Baklava (62320)!`)
		}
		return addresses.baklava
	case 44787:
		if (!addresses.alfajores) {
			throw new Error(`no address provided for Alfajores (44787)!`)
		}
		return addresses.alfajores
	default:
		throw new Error(`unknown chainId: ${chainId}!`)
	}
}