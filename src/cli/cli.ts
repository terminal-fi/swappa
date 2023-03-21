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
	mainnetRegistryMobius, mainnetRegistryMoola, mainnetRegistryMoolaV2,
	mainnetRegistrySavingsCELO, mainnetRegistrySushiswap, mainnetRegistryUbeswap,
	mainnetRegistryCeloDex, mainnetRegistrySymmetric, mainnetRegistryMisc, mainnetRegistryCurve,
} from '../registry-cfg';
import { RegistryMento } from '../registries/mento';
import { RegistryMentoV2 } from '../registries/mento-v2';
import { Registry } from '../registry';

const program = commander.program
	.option("--network <network>", "Celo client URL to connect to.", "http://localhost:8545")
	.option("--registries <registries>", "Registries to use for routing.", "all")
	.option("--input <input>", "Input token address or symbol.", "CELO")
	.option("--output <output>", "Output token address or symbol.", "cUSD")
	.option("--amount <amount>", "Input amount.", "0.001")
	.option("--max-swaps <max-swaps>", "Maximum number of swaps in a route.")
	.option("--from <from>", "If provided, will actally execute trade from given account.")
	.option("--max-slippage <max-slippage>", "Maximum allowed slippage.", "0.9999")
	.option("--no-precheck", "If provided, will skip expected output precheck.")
	.option("--benchmark <iterations>", "If non-zero, benchmark the route finding for N iterations.", "0")
	.option("--privateKey <private-key>", "Private key for the from", undefined)
	.parse(process.argv)

process.on('unhandledRejection', (reason: any, _promise: any) => {
	// @ts-ignore
	console.error('Unhandled Rejection for promise:', _promise, 'at:', reason.stack || reason)
	process.exit(1)
})

const registriesByName: {[name: string]: (kit: ContractKit) => Registry} = {
	// "mento":       (kit: ContractKit) => new RegistryMento(kit),
	"mentov2":	   (kit: ContractKit) => new RegistryMentoV2(kit),
	// "ubeswap":     mainnetRegistryUbeswap,
	// "sushiswap":   mainnetRegistrySushiswap,
	// "mobius":      mainnetRegistryMobius,
	// "moola":       mainnetRegistryMoola,
	// "moola-v2":    mainnetRegistryMoolaV2,
	// "savingscelo": mainnetRegistrySavingsCELO,
	// "celodex":     mainnetRegistryCeloDex,
	// "symmetric":   mainnetRegistrySymmetric,
	// "misc":        mainnetRegistryMisc,
	// "curve":       mainnetRegistryCurve,
}

interface Token {
	chainId: number,
	address: string,
	symbol: string,
	decimals: number,
}
let chainId: number
let ALL_TOKENS: Token[]

function tokenByAddrOrSymbol(addressOrSymbol: string) {
	const t = ALL_TOKENS.find((t) => t.chainId === chainId && (t.address === addressOrSymbol || t.symbol === addressOrSymbol))
	if (!t) {
		throw new Error(`Unrecognized token: ${addressOrSymbol}!`)
	}
	return t
}

async function main() {
	const opts = program.opts()
	const kit = await newKit(opts.network)
	chainId = await kit.web3.eth.getChainId()
	if (opts.privateKey) {
		kit.connection.addAccount(opts.privateKey);
	}

	const celoTokenListURI = "https://celo-org.github.io/celo-token-list/celo.tokenlist.json"
	const celoTokenList = (await axios.get<{tokens: Token[]}>(celoTokenListURI)).data
	ALL_TOKENS = [
		...ubeswapTokens.tokens,
		...celoTokenList.tokens,
		{
			chainId: 42220,
			address: "0x617f3112bf5397D0467D315cC709EF968D9ba546",
			symbol: "USDTxWormhole",
			decimals: 6,
		},
		{	// this is a Mock USDC on baklava created by the mento team 
			chainId: 62320,
			address: "0x4c6B046750F9aBF6F0f3B511217438451bc6Aa02",
			symbol: "mockBridgedUSDC",
			decimals: 18,
		},
		// add AxelarUSDC for mainnet that will be used
	]

	const inputToken = tokenByAddrOrSymbol(opts.input)
	const outputToken = tokenByAddrOrSymbol(opts.output)
	const inputAmount = new BigNumber(opts.amount).shiftedBy(inputToken.decimals)
	const tokenWhitelist = ALL_TOKENS.filter((v) => v.chainId === chainId).map((v) => v.address)

	const registryFs = opts.registries === "all" ?
		Object.values(registriesByName) :
		(opts.registries as string).split(",").map((x) => registriesByName[x])
	const registries = registryFs.map((f) => f(kit))
	const manager = new SwappaManager(kit, swappaRouterV1Address, registries)
	console.info(`Finding & initializing pairs...`)
	const pairs = await manager.reinitializePairs(tokenWhitelist)
	console.info(`Pairs (${pairs.length}):`)
	for (const registry of registries) {
		for (const pair of manager.getPairsByRegistry(registry.getName())) {
			console.info(
				`${registry.getName().padEnd(12)}` +
				`${(pair as any).constructor?.name}:${pair.pairKey}: ` +
				`${tokenByAddrOrSymbol(pair.tokenA).symbol} / ${tokenByAddrOrSymbol(pair.tokenB).symbol}` +
				`\n  snapshot: ${JSON.stringify(pair.snapshot())}`)
		}
	}

	console.info(`--------------------------------------------------------------------------------`)
	console.info(`Routes: ${inputAmount.shiftedBy(-inputToken.decimals)} ${inputToken.symbol} ${inputToken.address} -> ${outputToken.symbol} ${outputToken.address}...`)
	const startT0 = Date.now()

	if (opts.benchmark && parseInt(opts.benchmark) > 0) {
		// run the benchmark
		const benchIterations = parseInt(opts.benchmark)
		console.info(`Benchmarking for ${benchIterations} iterations`)
		for (let i = 0; i < benchIterations; i++) {
			manager.findBestRoutesForFixedInputAmount(
				inputToken.address,
				outputToken.address,
				inputAmount,
				{
					maxSwaps: opts.maxSwaps || undefined,
				}
			)
		}
		const elapsed = Date.now() - startT0
		console.info(`Benchmark elapsed ${elapsed / 1000}s, ${elapsed / benchIterations}ms per iteration`)
	}

	const routes = manager.findBestRoutesForFixedInputAmount(
		inputToken.address,
		outputToken.address,
		inputAmount,
		{
			maxSwaps: opts.maxSwaps || undefined,
		}
	)

	console.info(`Top 5 routes (elapsed: ${Date.now() - startT0}ms):`)
	for (const route of routes.slice(0, 5)) {
		const path = route.pairs.map((p, idx) => `${tokenByAddrOrSymbol(route.path[idx]).symbol}:${(p as any).constructor.name}`)
		console.info(
			`Output: ${route.outputAmount.shiftedBy(-(outputToken.decimals || 18)).toFixed(10)} -- ` +
			`${path.join(":")}:${outputToken.symbol}`)
	}

	const from = opts.from
	if (from && routes.length > 0) {
		const route = routes[0]
		const inputTKN = new kit.web3.eth.Contract(Ierc20ABI, route.path[0]) as unknown as Ierc20

		const allowance = await inputTKN.methods.allowance(from, manager.routerAddr).call()
		if (inputAmount.gt(allowance)) {
			const approveTX = toTransactionObject(
				kit.connection,
				inputTKN.methods.approve(manager.routerAddr, inputAmount.toFixed(0)))
			console.info(`Sending approve TX...`)
			const approveReceipt = await approveTX.sendAndWaitForReceipt({from: from})
			console.info(`TX Done: ${approveReceipt.transactionHash}`)
		}

		const precheck: boolean = !opts.noPrecheck
		const tx = manager.swap(
			route, inputAmount, route.outputAmount.multipliedBy(opts.maxSlippage), from, {precheckOutputAmount: precheck})
		console.info(`Sending TX...`)
		const receipt = await tx.sendAndWaitForReceipt({from: from})
		console.info(`TX Done: ${receipt.transactionHash}`)
	}
}

main()
