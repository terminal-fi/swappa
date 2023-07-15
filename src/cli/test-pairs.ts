#!/usr/bin/env node
import commander from 'commander';
import axios from 'axios';
import { ContractKit, newKit } from '@celo/contractkit';
import BigNumber from 'bignumber.js';
import { toTransactionObject } from '@celo/connect';

import * as ubeswapTokens from '@ubeswap/default-token-list/ubeswap-experimental.token-list.json'
import { Ierc20, ABI as Ierc20ABI } from '../../types/web3-v1-contracts/IERC20';
import { address as swappaRouterV1Address} from '../../tools/deployed/mainnet.SwappaRouterV1.addr.json';

import { SwappaManager } from '../swappa-manager';
import {
	mainnetRegistryUniswapV3, mainnetRegistriesWhitelist,
} from '../registry-cfg';
import { RegistryMento } from '../registries/mento';
import { Registry } from '../registry';
import { initAllTokens, tokenByAddrOrSymbol } from './tokens';

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

const registriesByName: {[name: string]: (kit: ContractKit) => Registry} = {
	"uniswap-v3":  mainnetRegistryUniswapV3,
}

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

	let passedN = 0
	let failedN = 0
	let highN = 0
	for (const pair of pairs) {
		if (!("outputAmountAsync" in pair)) {
			continue
		}
		const inputAmountA = new BigNumber(opts.amount).shiftedBy(tokenByAddrOrSymbol(pair.tokenA).decimals)
		const inputAmountB = new BigNumber(opts.amount).shiftedBy(tokenByAddrOrSymbol(pair.tokenB).decimals)
		const [
			expectedOutputB,
			expectedOutputA,
			_
		] = await Promise.all([
			(pair.outputAmountAsync as any)(pair.tokenA, inputAmountA, pair.tokenB).catch(() => { return 0 }),
			(pair.outputAmountAsync as any)(pair.tokenB, inputAmountB, pair.tokenA).catch(() => { return 0 }),
			pair.refresh()
		])
		const outputB = pair.outputAmount(pair.tokenA, inputAmountA)
		const outputA = pair.outputAmount(pair.tokenB, inputAmountB)
		const passed = outputB.eq(expectedOutputB) && outputA.eq(expectedOutputA)
		const highOutput = outputB.gt(expectedOutputB) || outputA.gt(expectedOutputA)
		if (!passed) {
			console.warn(
				`Mismatch (HIGH?: ${highOutput}): ${pair.pairKey}: ` +
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
