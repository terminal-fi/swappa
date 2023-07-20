import path from "path"
import fs from "fs"
import BigNumber from "bignumber.js"
import Web3 from "web3"

import { RegistryHelperUniswapV2, newRegistryHelperUniswapV2 } from "../../types/web3-v1-contracts/RegistryHelperUniswapV2"
import { IUniswapV2Factory, newIUniswapV2Factory } from "../../types/web3-v1-contracts/IUniswapV2Factory"
import { Address, Pair } from "../pair"
import { PairUniswapV2 } from "../pairs/uniswapv2"
import { Registry } from "../registry"
import { initPairsAndFilterByWhitelist } from "../utils"
import { fastConcurrentMap } from "../utils/async"
import { fetchEvents } from "../utils/events"

import * as mainnetUbeswapCachedData from "../../tools/caches/swappa.uniswapv2.42220.0x62d5b84bE28a183aBB507E125B384122D2C25fAE.pairs.json"
import * as mainnetSushiSwapCachedData from "../../tools/caches/swappa.uniswapv2.42220.0xc35DADB65012eC5796536bD9864eD8773aBc74C4.pairs.json"
import * as mainnetCeloDexCachedData from "../../tools/caches/swappa.uniswapv2.42220.0x31bD38d982ccDf3C2D95aF45a3456d319f0Ee1b6.pairs.json"

interface UniV2Pair {
	token0: string
	token1: string
	pair: string
}

interface CachedData {
	blockN: number
	pairs: UniV2Pair[]
}

const cachedDataGlobal: {[key: number]: {[key: string]: CachedData | undefined} | undefined} = {
	42220: {
		"0x62d5b84bE28a183aBB507E125B384122D2C25fAE": mainnetUbeswapCachedData,
		"0xc35DADB65012eC5796536bD9864eD8773aBc74C4": mainnetSushiSwapCachedData,
		"0x31bD38d982ccDf3C2D95aF45a3456d319f0Ee1b6": mainnetCeloDexCachedData,
	}
}

const cacheDataFileName = (chainId: number, factoryAddr: Address) => {
	return path.join("/tmp", `swappa.uniswapv2.${chainId}.${factoryAddr}.pairs.json`)
}

export class RegistryUniswapV2 extends Registry {
	private factory: IUniswapV2Factory
	private helper?: RegistryHelperUniswapV2

	constructor(
		name: string,
		private web3: Web3,
		private factoryAddr: Address,
		private opts?: {
			fixedFee?: BigNumber,
			fetchUsing?: "PairEvents" | "RegistryHelper" | "TokenList"
			registryHelperAddr?: Address
		},
	) {
		super(name)
		this.factory = newIUniswapV2Factory(web3, factoryAddr)
		if (opts?.registryHelperAddr) {
			this.helper = newRegistryHelperUniswapV2(web3, opts.registryHelperAddr)
		}
	}

	findPairs = async (tokenWhitelist: Address[]): Promise<Pair[]> =>	{
		const chainId = await this.web3.eth.getChainId()
		const fetchUsing = this.opts?.fetchUsing || "PairEvents"
		switch (fetchUsing) {
			case "RegistryHelper": {
				// registry helper contract is available for fast discovery of pairs
				const nPairs = Number.parseInt(await this.factory.methods.allPairsLength().call())
				const limit = 100
				const pairsFetched = []
				for (let offset = 0; offset < nPairs; offset += limit) {
					const result = await this.helper!.methods.findPairs(this.factoryAddr, offset, limit).call()
					for (let pairInfo of result) {
						if (tokenWhitelist.indexOf(pairInfo.token0) === -1 && tokenWhitelist.indexOf(pairInfo.token1) === -1) {
							continue
						}
						pairsFetched.push(new PairUniswapV2(chainId, this.web3, pairInfo.pair, this.opts?.fixedFee))
					}
				}
				return initPairsAndFilterByWhitelist(pairsFetched, tokenWhitelist)
			}
			case "TokenList": {
				const pairsToFetch: {tokenA: Address, tokenB: Address}[] = []
				for (let i = 0; i < tokenWhitelist.length - 1; i += 1) {
					for (let j = i + 1; j < tokenWhitelist.length; j += 1) {
						pairsToFetch.push({tokenA: tokenWhitelist[i], tokenB: tokenWhitelist[j]})
					}
				}
				const pairsFetched = await fastConcurrentMap(
					10,
					pairsToFetch,
					async (toFetch) => {
						const pairAddr = await this.factory.methods.getPair(toFetch.tokenA, toFetch.tokenB).call()
						if (pairAddr === "0x0000000000000000000000000000000000000000") {
							return null
						}
						return new PairUniswapV2(chainId, this.web3, pairAddr, this.opts?.fixedFee)
					})
				return initPairsAndFilterByWhitelist(pairsFetched.filter((p) => p !== null) as Pair[], tokenWhitelist)
			}
			case "PairEvents": {
				let cachedData = cachedDataGlobal[chainId]?.[this.factory.options.address]
				const cachedDataFile = cacheDataFileName(chainId, this.factory.options.address)
				try {
					if (fs.existsSync(cachedDataFile)) {
						const cachedDataFromFile: CachedData = JSON.parse(fs.readFileSync(cachedDataFile).toString())
						if (!cachedData || cachedDataFromFile.blockN > cachedData.blockN) {
							cachedData = cachedDataFromFile
						}
					}
				} catch (e) {
					console.warn(`UniV2Registry: Error while trying to read cache file: ${cachedDataFile}: ${e}`)
				}

				let pairs: UniV2Pair[] = []
				let fromBlock = 0
				if (cachedData) {
					pairs.push(...cachedData.pairs)
					fromBlock = cachedData.blockN + 1
				}
				const pairAddrSet = new Set<string>()
				pairs = pairs.filter((p) => {
					if (pairAddrSet.has(p.pair)) {
						return false
					}
					pairAddrSet.add(p.pair)
					return true
				})
				const endBlock = await this.web3.eth.getBlockNumber()
				await fetchEvents(
					async (fromBlock, toBlock) => {
						const events = await this.factory.getPastEvents("PairCreated", {fromBlock, toBlock})
						return events.map(
							(v) => ({
								token0: v.returnValues.token0 as string,
								token1: v.returnValues.token1 as string,
								pair: v.returnValues.pair as string,
							} as UniV2Pair)
						)
					},
					fromBlock,
					endBlock,
					(fromBlock: number, toBlock: number, batch: UniV2Pair[]) => {
						batch = batch.filter((p) => {
							if (pairAddrSet.has(p.pair)) {
								return false
							}
							pairAddrSet.add(p.pair)
							return true
						})
						pairs.push(...batch)
						const toCache: CachedData = {
							blockN: toBlock,
							pairs: pairs,
						}
						fs.writeFileSync(cachedDataFile, JSON.stringify(toCache))
					},
					"UNIV2REGISTRY",
				)
				pairs = pairs.filter((p) => tokenWhitelist.indexOf(p.token0) >= 0 && tokenWhitelist.indexOf(p.token1) >= 0);
				const pairsFetched = pairs.map((p) => new PairUniswapV2(chainId, this.web3, p.pair))
				return initPairsAndFilterByWhitelist(pairsFetched, tokenWhitelist)
			}
		}
	}
}
