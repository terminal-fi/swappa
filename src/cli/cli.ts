#!/usr/bin/env node
import { newKit } from '@celo/contractkit';
import commander from 'commander';

import * as ubeswapTokens from '@ubeswap/default-token-list/ubeswap.token-list.json'
import { RegistryUniswapV2 } from '../registries/uniswapv2';
import { findBestRoutesForFixedInputAmount } from '../router';
import { Pair } from '../pair';
import BigNumber from 'bignumber.js';
import { RegistryMoola } from '../registries/moola';

const program = commander.program
	.option("--network <network>", "Celo client URL to connect to.", "https://forno.celo.org")
	.option("--input <input>", "Input token address.")
	.option("--output <output>", "Output token address.")
	.option("--amount <amount>", "Input amount.", "1e18")
	.parse(process.argv)

process.on('unhandledRejection', (reason: any, _promise: any) => {
	// @ts-ignore
	console.error('Unhandled Rejection for promise:', _promise, 'at:', reason.stack || reason)
	process.exit(1)
})

async function main() {
	const opts = program.opts()
	const kit = await newKit(opts.network)
	const chainId = await kit.web3.eth.getChainId()

	const tokenWhitelist = ubeswapTokens.tokens.filter((v) => v.chainId === chainId).map((v) => v.address)
	const inputToken = opts.input
	if (tokenWhitelist.indexOf(inputToken) < 0) {
		throw new Error("invalid --input token!")
	}
	const outputToken = opts.output
	if (tokenWhitelist.indexOf(outputToken) < 0) {
		throw new Error("invalid --output token!")
	}
	const inputAmount = new BigNumber(opts.amount)

	const registries = [
		new RegistryUniswapV2(kit, "0x62d5b84bE28a183aBB507E125B384122D2C25fAE"),
		new RegistryMoola(kit, "0x7AAaD5a5fa74Aec83b74C2a098FBC86E17Ce4aEA"),
	]
	const pairsAll = await Promise.all(registries.map((r) => r.findPairs(tokenWhitelist)))
	console.info(`Pairs:`)
	for (const pairs of pairsAll) {
		for (const pair of pairs) {
			console.info(`${(pair as any).constructor?.name}: ${pair.tokenA} / ${pair.tokenB}`)
		}
	}

	const pairsByToken = new Map<string, Pair[]>()
	pairsAll.forEach((pairs) => {
		pairs.forEach((p) => {
			for (const token of [p.tokenA, p.tokenB]) {
				const x = pairsByToken.get(token)
				if (x) {
					x.push(p)
				} else {
					pairsByToken.set(token, [p])
				}
			}
		})
	})

	const routes = findBestRoutesForFixedInputAmount(
		pairsByToken,
		inputToken,
		outputToken,
		inputAmount,
	)

	console.info(`Top 5 routes:`)
	for (const route of routes.slice(0, 5)) {
		console.info(`Output: ${route.outputAmount.shiftedBy(-18).toFixed(6)}, ${route.path.join(", ")}`)
	}
}

main()
