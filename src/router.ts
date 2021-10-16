import BigNumber from "bignumber.js"
import { Address, Pair } from "./pair"

export interface Route {
	pairs: Pair[]
	path: Address[]
	outputToken: Address
	outputAmount: BigNumber
}

export interface RouterOpts {
	maxSwaps?: number,
}

export const findBestRoutesForFixedInputAmount = (
	pairsByToken: Map<Address, Pair[]>,
	inputToken: Address,
	outputToken: Address,
	inputAmount: BigNumber,
	opts?: RouterOpts) => {

	const maxSwaps = opts?.maxSwaps || 10

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
	const maxOutputAmounts = new Map<Address, BigNumber>([
		[inputToken, inputAmount],
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
				const outputTAmount = pair.outputAmount(route.outputToken, route.outputAmount)
				const maxOutputAmount = maxOutputAmounts.get(outputT) || new BigNumber(0)
				if (maxOutputAmount.gte(outputTAmount)) {
					continue // we have already explored better routes before.
				}
				maxOutputAmounts.set(outputT, outputTAmount)
				const routeT: Route = {
					pairs: [...route.pairs, pair],
					path: [...route.path, outputT],
					outputToken: outputT,
					outputAmount: outputTAmount,
				}
				nextRoutes.set(outputT, routeT)
				if (outputT === outputToken) {
					completedRoutes.push(routeT)
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
