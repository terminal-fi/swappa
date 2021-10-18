#!/usr/bin/env node
import { newKit, StableToken } from '@celo/contractkit';
import BigNumber from 'bignumber.js';
import commander from 'commander';
import { PairStableSwap } from '../pairs/stableswap';
import { PairUniswapV2 } from '../pairs/uniswapv2';

const program = commander.program
	.option("--network <network>", "Celo client URL to connect to.", "http://localhost:8545")

process.on('unhandledRejection', (reason: any, _promise: any) => {
	// @ts-ignore
	console.error('Unhandled Rejection for promise:', _promise, 'at:', reason.stack || reason)
	process.exit(1)
})

async function main() {
	const opts = program.opts()
	const kit = await newKit(opts.network)
	const chainId = await kit.web3.eth.getChainId()
	if (chainId !== 42220) {
		throw new Error(`invalid chainId: ${chainId}!`)
	}

	const celo = await kit.contracts.getGoldToken()
	const cUSD = await kit.contracts.getStableToken(StableToken.cUSD)
	const inputAmount = new BigNumber(1337e18)

	const ubeswap_CELO_mcUSD = new PairUniswapV2(kit, "0xf5b1BC6C9c180b64F5711567b1d6a51A350f8422")
	await ubeswap_CELO_mcUSD.init()
	const outputAmount_mcUSD = ubeswap_CELO_mcUSD.outputAmount(celo.address, inputAmount)
	console.info(`ubeswap: CELO/mcUSD: ${inputAmount} CELO -> ${outputAmount_mcUSD} mcUSD`)

	const mobius_cUSD_USDC = new PairStableSwap(kit, "0xA5037661989789d0310aC2B796fa78F1B01F195D")
	await mobius_cUSD_USDC.init()
	const outputAmount_USDC = mobius_cUSD_USDC.outputAmount(cUSD.address, inputAmount)
	console.info(`mobius: cUSD/USDC: ${inputAmount} cUSD -> ${outputAmount_USDC} USDC`)
}

main()