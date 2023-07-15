#!/usr/bin/env node
import commander from 'commander';
import { ContractKit, newKit, setImplementationOnProxy } from '@celo/contractkit';
import BigNumber from 'bignumber.js';

import { address as swappaRouterV1Address} from '../../tools/deployed/mainnet.SwappaRouterV1.addr.json';

import { SwappaManager } from '../swappa-manager';
import { initAllTokens, tokenByAddrOrSymbol } from './tokens';
import { registriesByName } from './registries';

const program = commander.program
	.option("--network <network>", "Celo client URL to connect to.", "http://localhost:8545")
	.option("--registry <registry>", "Registry to use for testing.", "")
	.option("--amount <amount>", "Input amount.", "0.001")
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
	let passedN = 0
	let failedN = 0
	let highN = 0
	for (const pair of pairs) {
		const inputAmountA = new BigNumber(opts.amount).shiftedBy(tokenByAddrOrSymbol(pair.tokenA).decimals)
		const inputAmountB = new BigNumber(opts.amount).shiftedBy(tokenByAddrOrSymbol(pair.tokenB).decimals)
		const [
			expectedOutputB,
			expectedOutputA,
			_
		] = await Promise.all([
			pair.outputAmountAsync(pair.tokenA, inputAmountA).catch(() => { return 0 }),
			pair.outputAmountAsync(pair.tokenB, inputAmountB).catch(() => { return 0 }),
			pair.refresh()
		])
		const outputB = pair.outputAmount(pair.tokenA, inputAmountA)
		const outputA = pair.outputAmount(pair.tokenB, inputAmountB)
		const passed = outputB.eq(expectedOutputB) && outputA.eq(expectedOutputA)
		const highOutput = outputB.gt(expectedOutputB) || outputA.gt(expectedOutputA)
		if (!passed) {
			console.warn(
				`Mismatch (HIGH?: ${highOutput}): ${tokenByAddrOrSymbol(pair.tokenA).symbol}/${tokenByAddrOrSymbol(pair.tokenB).symbol}: ` +
				`${outputB.toFixed(0)} vs ${expectedOutputB} (${outputB.eq(expectedOutputB)}), ` +
				`${outputA.toFixed(0)} vs ${expectedOutputA} (${outputA.eq(expectedOutputA)})`)
			failedN += 1
			if (highOutput) {
				highN += 1
			}
		} else {
			passedN += 1
		}
	}

	console.info(`--------------------------------------------------------------------------------`)
	console.info(`PASSED: ${passedN}, FAILED: ${failedN}, HIGH?: ${highN}`)
	kit.stop()
}

main()
