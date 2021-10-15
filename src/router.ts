import BigNumber from "bignumber.js"
import { Address, Pair } from "./pair"

export interface Route {
	pairs: Pair[]
	path: Address[]
	outputToken: Address
	outputAmount: BigNumber
}

export const findBestRoutesForFixedInputAmount = (
	pairsByToken: Map<Address, Pair[]>,
	inputToken: Address,
	outputToken: Address,
	inputAmount: BigNumber,
	maxSwaps = 10) => {

	const completedRoutes: Route[] = []
	let currentRoutes = new Map<Address, Route>([
		[
			inputToken, {
				pairs: [],
				path: [inputToken],
				outputToken: inputToken,
				outputAmount: inputAmount,
			}
		]
	])
	for (let d = 0; d < maxSwaps; d += 1) {
		const nextRoutes = new Map<string, Route>()
		for (const route of currentRoutes.values()) {
			const matchingPairs = pairsByToken.get(route.outputToken) || []
			for (const pair of matchingPairs) {
				const outputT =
					pair.tokenA === route.outputToken ? pair.tokenB :
					pair.tokenB === route.outputToken ? pair.tokenA : null
				if (!outputT) {
					throw new Error(`pairsByToken is invalid? ${pair.tokenA}/${pair.tokenB} !== ${route.outputToken}`)
				}
				if (route.pairs.indexOf(pair) >= 0) {
					continue // skip already used pairs.
				}
				const outputTAmount = pair.outputAmount(route.outputToken, route.outputAmount)
				if (outputTAmount.eq(0)) {
					continue // not enough liquidity to actually trade.
				}
				const routeT: Route = {
					pairs: [...route.pairs, pair],
					path: [...route.path, outputT],
					outputToken: outputT,
					outputAmount: outputTAmount,
				}
				if (outputT === outputToken) {
					completedRoutes.push(routeT)
				}

				const nextRoute = nextRoutes.get(outputT)
				if (!nextRoute || nextRoute.outputAmount.lt(outputTAmount)) {
					nextRoutes.set(outputT, routeT)
				}
			}
		}
		currentRoutes = nextRoutes
		// console.debug(`UBE ROUTER: Depth: ${d+1}, routes: ${currentRoutes.size}, completed: ${completedRoutes.length}`)
		if (currentRoutes.size === 0) {
			break
		}
	}
	completedRoutes.sort((a, b) => a.outputAmount.gt(b.outputAmount) ? -1 : 1)
	return completedRoutes
}
