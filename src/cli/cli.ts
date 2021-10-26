#!/usr/bin/env node
import commander from 'commander';
import { newKit } from '@celo/contractkit';
import BigNumber from 'bignumber.js';
import { toTransactionObject } from '@celo/connect';

import * as ubeswapTokens from '@ubeswap/default-token-list/ubeswap.token-list.json'
import { Ierc20, ABI as Ierc20ABI } from '../../types/web3-v1-contracts/IERC20';
import { address as swappaRouterV1Address} from '../../tools/deployed/mainnet.SwappaRouterV1.addr.json';

import { SwappaManager } from '../swappa-manager';
import { mainnetRegistriesAll } from '../registry-cfg';

const program = commander.program
	.option("--network <network>", "Celo client URL to connect to.", "http://localhost:8545")
	.option("--input <input>", "Input token address.")
	.option("--output <output>", "Output token address.")
	.option("--amount <amount>", "Input amount.", "0.001e18")
	.option("--from <from>", "Account to execute trade from.")
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
	// HAX(zviadm): manually add MoolaV2 tokens since they don't exist in Ubeswap Token list just yet.
	tokenWhitelist.push(
		"0x7D00cd74FF385c955EA3d79e47BF06bD7386387D", // mCELO v2
		"0x918146359264C492BD6934071c6Bd31C854EDBc3", // mcUSD v2
		"0xE273Ad7ee11dCfAA87383aD5977EE1504aC07568", // mcEUR v2
	)
	const inputToken = opts.input
	if (tokenWhitelist.indexOf(inputToken) < 0) {
		throw new Error("invalid --input token!")
	}
	const outputToken = opts.output
	if (tokenWhitelist.indexOf(outputToken) < 0) {
		throw new Error("invalid --output token!")
	}
	const inputAmount = new BigNumber(opts.amount)
	const registries = mainnetRegistriesAll(kit)
	const manager = new SwappaManager(kit, swappaRouterV1Address, registries)
	console.info(`Finding & initializing pairs...`)
	const pairs = await manager.reinitializePairs(tokenWhitelist)
	console.info(`Pairs (${pairs.length}):`)
	for (const pair of pairs) {
		console.info(`${(pair as any).constructor?.name}:${pair.pairKey}: ${pair.tokenA} / ${pair.tokenB}`)
	}

	console.info(`Finding routes...`)
	const startT0 = Date.now()
	const routes = manager.findBestRoutesForFixedInputAmount(
		inputToken,
		outputToken,
		inputAmount,
	)

	console.info(`Top 5 routes (elapsed: ${Date.now() - startT0}ms):`)
	for (const route of routes.slice(0, 5)) {
		const path = route.pairs.map((p, idx) => `${(p as any).constructor.name}:${route.path[idx + 1]}`)
		const outInfo = ubeswapTokens.tokens.find((t) => t.address === outputToken)
		console.info(`Output: ${route.outputAmount.shiftedBy(-(outInfo?.decimals || 18)).toFixed(6)} ${outInfo?.symbol}, ${path.join(" -> ")}`)
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
			console.info(`sending approve TX...`)
			const approveReceipt = await approveTX.sendAndWaitForReceipt({from: from})
			console.info(`TX Done: ${approveReceipt.transactionHash}`)
		}

		const tx = manager.swap(
			route, inputAmount, route.outputAmount.multipliedBy(0.995), from)
		console.info(`sending TX...`)
		const receipt = await tx.sendAndWaitForReceipt({from: from})
		console.info(`TX Done: ${receipt.transactionHash}`)
	}
}

main()
