#!/usr/bin/env node
import commander from 'commander';
import { newKit } from '@celo/contractkit';
import BigNumber from 'bignumber.js';

import { address as swappaRouterV1Address} from '../../tools/deployed/mainnet.SwappaRouterV1.addr.json';

import { SwappaManager } from '../swappa-manager';
import { initAllTokens, tokenByAddrOrSymbol } from './tokens';
import { registriesByName } from './registries';

const program = commander.program
	.option("--network <network>", "Celo client URL to connect to.", "http://localhost:8545")
	.option("--registry <registry>", "Registry to use for testing.", "")
	.option("--amount <amount>", "Input amount.", "0.01")
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
	const allTokens = await initAllTokens(chainId)

	const tokenWhitelist = allTokens.filter((v) => v.chainId === chainId).map((v) => v.address)

	const registries = [registriesByName[opts.registry](kit)]
	const manager = new SwappaManager(kit, swappaRouterV1Address, registries)
	console.info(`Finding & initializing pairs...`)
	const pairs = await manager.reinitializePairs(tokenWhitelist)
	console.info(`Pairs (${pairs.length}):`)
	for (const registry of registries) {
		for (const pair of manager.getPairsByRegistry(registry.getName())) {
			console.info(
				`${registry.getName().padEnd(12)}` +
				`${(pair as any).constructor?.name}:${pair.pairKey}: ` +
				`${tokenByAddrOrSymbol(pair.tokenA).symbol} / ${tokenByAddrOrSymbol(pair.tokenB).symbol}`)
		}
	}

	const initBlockN = await kit.web3.eth.getBlockNumber()
	console.info("Waiting for new block before running tests...")
	while (true) {
		const blockN = await kit.web3.eth.getBlockNumber()
		if (blockN > initBlockN) {
			break
		}
		await new Promise(resolve => setTimeout(resolve, 100))
	}

	console.info("Running tests...")
	const testT0 = Date.now()
	let passedN = 0
	let failedN = 0
	let highN = 0
	let refreshTotalMs = 0
	for (const pair of pairs) {
		const inputAmountA = new BigNumber(opts.amount).shiftedBy(tokenByAddrOrSymbol(pair.tokenA).decimals)
		const inputAmountB = new BigNumber(opts.amount).shiftedBy(tokenByAddrOrSymbol(pair.tokenB).decimals)
		const refreshT0 = Date.now()
		const [
			expectedOutputB,
			expectedOutputA,
			_
		] = await Promise.all([
			pair.outputAmountAsync(pair.tokenA, inputAmountA).catch(() => { return 0 }),
			pair.outputAmountAsync(pair.tokenB, inputAmountB).catch(() => { return 0 }),
			pair.refresh()
		])
		refreshTotalMs += Date.now() - refreshT0
		const outputB = pair.outputAmount(pair.tokenA, inputAmountA)
		const outputA = pair.outputAmount(pair.tokenB, inputAmountB)
		const passed = outputB.eq(expectedOutputB) && outputA.eq(expectedOutputA)
		const highOutput =
			outputB.multipliedBy(0.999999).gt(expectedOutputB) || outputA.multipliedBy(0.999999).gt(expectedOutputA)
		const tokenA = tokenByAddrOrSymbol(pair.tokenA)
		const tokenB = tokenByAddrOrSymbol(pair.tokenB)
		if (!passed) {
			console.warn(
				`Mismatch (HIGH?: ${highOutput}): ${tokenA.symbol}/${tokenB.symbol}: ` +
				`${outputB.shiftedBy(-tokenB.decimals)} vs ${new BigNumber(expectedOutputB).shiftedBy(-tokenB.decimals)} (${outputB.eq(expectedOutputB)}), ` +
				`${outputA.shiftedBy(-tokenA.decimals)} vs ${new BigNumber(expectedOutputA).shiftedBy(-tokenA.decimals)} (${outputA.eq(expectedOutputA)})`)
			failedN += 1
			if (highOutput) {
				console.warn(`SNAPSHOT:`, JSON.stringify(pair.snapshot()))
				highN += 1
			}
		} else {
			passedN += 1
		}

		if ("inputAmount" in pair) {
			const inputA: BigNumber = (pair.inputAmount as any)(pair.tokenB, outputB)
			const inputB: BigNumber = (pair.inputAmount as any)(pair.tokenA, outputA)
			if (
				!inputA.minus(inputAmountA).abs().lte(inputAmountA.multipliedBy(0.0000001)) ||
				!inputB.minus(inputAmountB).abs().lte(inputAmountB.multipliedBy(0.0000001))
				) {
				console.warn(
					`Mismatch INPUT: ${tokenA.symbol}/${tokenB.symbol}: ` +
					`${inputA.shiftedBy(-tokenA.decimals)} vs ${new BigNumber(inputAmountA).shiftedBy(-tokenA.decimals)}, `+
					`${inputB.shiftedBy(-tokenB.decimals)} vs ${new BigNumber(inputAmountB).shiftedBy(-tokenB.decimals)}`)
			}
		}
	}

	console.info(`--------------------------------------------------------------------------------`)
	console.info(`PASSED: ${passedN}, FAILED: ${failedN}, HIGH?: ${highN}, Elapsed: ${Date.now()-testT0}ms / Refresh: ${refreshTotalMs}ms`)
	kit.stop()
}

main()
