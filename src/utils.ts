import { Address, Pair } from "./pair"


export const filterPairsByWhitelist = (pairs: Pair[], tokenWhitelist: Address[]) => {
	return pairs.filter((p) => (
		tokenWhitelist.indexOf(p.tokenA) >= 0 &&
		tokenWhitelist.indexOf(p.tokenB) >= 0
	))
}