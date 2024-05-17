#!/usr/bin/env node
import { program } from "commander"
import fs from "fs"
import path from "path"
import { ContractKit, newKit } from "@celo/contractkit"

import SwappaRouterV1Json from "../build/contracts/SwappaRouterV1.json"
import RegistryHelperUniswapV2 from "../build/contracts/RegistryHelperUniswapV2.json"

import PairUniswapV2 from "../build/contracts/PairUniswapV2.json"
import PairAToken from "../build/contracts/PairAToken.json"
import PairStableSwap from "../build/contracts/PairStableSwap.json"
import PairATokenV2 from "../build/contracts/PairATokenV2.json"
import PairBPool from "../build/contracts/PairBPool.json"
import PairOpenSumSwap from "../build/contracts/PairOpenSumSwap.json"
import PairSymmetricSwap from "../build/contracts/PairSymmetricSwap.json"
import PairCurve from "../build/contracts/PairCurve.json"
import PairUniswapV3 from "../build/contracts/PairUniswapV3.json"
import PairStCelo from "../build/contracts/PairStCelo.json"
import PairRStCelo from "../build/contracts/PairRStCelo.json"
import PairMentoV2 from "../build/contracts/PairMentoV2.json"

process.on('unhandledRejection', (reason, _promise) => {
	// @ts-ignore
	console.error('Unhandled Rejection at:', reason.stack || reason)
	process.exit(0)
})

program
	.option("-n --network <name>", "Network to deploy to. Options: ganache, alfajores, baklava, mainnet", "ganache")
	.option("--from <address>", "Deployer address")
	.parse()

const networks: {[key: string]: string} = {
	// "ganache": "http://127.0.0.1:7545",
	// "alfajores": "https://alfajores-forno.celo-testnet.org",
	"baklava": "http://127.0.0.1:8546",
	"mainnet": "http://127.0.0.1:8545",
}

// Relative path to the deploy folder changes depending on if it is run directly or using ts-node.
const contractsPath = path.join(__dirname, "deployed")

function contractAddress(
	network: string,
	contractName: string) {
	const fpath = path.join(contractsPath, `${network}.${contractName}.addr.json`)
	if (!fs.existsSync(fpath)) {
		return null
	}
	const data = JSON.parse(fs.readFileSync(fpath).toString())
	return data.address
}

function storeContractAddress(
	network: string,
	contractName: string,
	contractAddress: string) {
	fs.writeFileSync(
		path.join(contractsPath, `${network}.${contractName}.addr.json`),
		JSON.stringify({address: contractAddress}))
}

async function readAddressOrDeployContract(
	kit: ContractKit,
	network: string,
	contractName: string,
	contractData: string) {

	let address = contractAddress(network, contractName)
	if (!address) {
		console.info("DEPLOYING:", contractName, "...")
		const receipt = await (await kit
			.sendTransaction({data: contractData}))
			.waitReceipt()
		address = receipt.contractAddress
		if (!address) {
			throw new Error("Contract address not found?")
		}
		storeContractAddress(network, contractName, address)
	}
	console.info("DEPLOYED:", contractName, "ADDRESS:", address)
	return address
}

async function main() {
	const opts = program.opts()
	const networkURL = networks[opts.network]
	if (!networkURL) {
		throw new Error(`Unsupported network: ${opts.network}`)
	}

	const kit = newKit(networkURL)
	kit.defaultAccount = opts.from

	// Main Router
	await readAddressOrDeployContract(
		kit, opts.network, "SwappaRouterV1", SwappaRouterV1Json.bytecode)

	// Helper contracts
	await readAddressOrDeployContract(
		kit, opts.network, "RegistryHelperUniswapV2", RegistryHelperUniswapV2.bytecode)

	// Pairs
	await readAddressOrDeployContract(
		kit, opts.network, "PairUniswapV2", PairUniswapV2.bytecode)
	await readAddressOrDeployContract(
		kit, opts.network, "PairAToken", PairAToken.bytecode)
	await readAddressOrDeployContract(
		kit, opts.network, "PairStableSwap", PairStableSwap.bytecode)
	await readAddressOrDeployContract(
		kit, opts.network, "PairATokenV2", PairATokenV2.bytecode)
	await readAddressOrDeployContract(
		kit, opts.network, "PairBPool", PairBPool.bytecode)
	await readAddressOrDeployContract(
		kit, opts.network, "PairOpenSumSwap", PairOpenSumSwap.bytecode)
	await readAddressOrDeployContract(
		kit, opts.network, "PairSymmetricSwap", PairSymmetricSwap.bytecode)
	await readAddressOrDeployContract(
		kit, opts.network, "PairCurve", PairCurve.bytecode)
	await readAddressOrDeployContract(
		kit, opts.network, "PairUniswapV3", PairUniswapV3.bytecode)
	await readAddressOrDeployContract(
		kit, opts.network, "PairStCelo", PairStCelo.bytecode)
	await readAddressOrDeployContract(
		kit, opts.network, "PairRStCelo", PairRStCelo.bytecode)
	await readAddressOrDeployContract(
		kit, opts.network, "PairMentoV2", PairMentoV2.bytecode)
}

main()