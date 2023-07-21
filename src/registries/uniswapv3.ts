import path from "path";
import fs from "fs";
import Web3 from "web3";
import { FeeAmount } from "@uniswap/v3-sdk";

import { Address, Pair } from "../pair";
import { Registry } from "../registry";
import {
	IUniswapV3Factory,
	newIUniswapV3Factory,
} from "../../types/web3-v1-contracts/IUniswapV3Factory";
import { PairUniswapV3 } from "../pairs/uniswapv3";
import { fastConcurrentMap } from "../utils/async";
import { fetchEvents } from "../utils/events";

import * as mainnetUniV3CachedData from "../../tools/caches/swappa.uniswapv3.42220.0xAfE208a311B21f13EF87E33A90049fC17A7acDEc.pools.json"

const FeeAmounts = Object.keys(FeeAmount).map((v) => Number(v)).filter((v) => !isNaN(v))

interface UniV3Pool {
	token0: string
	token1: string
	pool: string
	fee: string
}

interface CachedData {
	blockN: number
	pools: UniV3Pool[]
}

const cachedDataGlobal: {[key: number]: {[key: string]: CachedData | undefined} | undefined} = {
	42220: {
		"0xAfE208a311B21f13EF87E33A90049fC17A7acDEc": mainnetUniV3CachedData,
	}
}

const cacheDataFileName = (chainId: number, factoryAddr: Address) => {
	return path.join("/tmp", `swappa.uniswapv3.${chainId}.${factoryAddr}.pools.json`)
}

export class RegistryUniswapV3 extends Registry {
	private factory: IUniswapV3Factory;

	constructor(
		name: string,
		private web3: Web3,
		factoryAddr: Address,
		private opts?: {
			fetchUsing?: "PoolEvents" | "TokenList";
		}
	) {
		super(name);
		this.factory = newIUniswapV3Factory(web3, factoryAddr)
	}

	findNumberOfPools = async (): Promise<number> => {
		const poolEvents = await this.factory.getPastEvents("Pool");
		return poolEvents.length;
	};

	findPairsWithoutInitialzing = async (tokenWhitelist: Address[]): Promise<Pair[]> => {
		const chainId = await this.web3.eth.getChainId();
		const fetchUsing = this.opts?.fetchUsing || "PoolEvents"
		switch (fetchUsing) {
			case "TokenList": {
				const pairsToFetch: { tokenA: Address; tokenB: Address; feeAmount: number }[] = [];
				const nPairs = tokenWhitelist.length;
				for (let i = 0; i < nPairs - 1; i += 1) {
					for (let j = i + 1; j < nPairs; j += 1) {
						for (const feeAmount of FeeAmounts) {
							pairsToFetch.push({
								tokenA: tokenWhitelist[i],
								tokenB: tokenWhitelist[j],
								feeAmount,
							});
						}
					}
				}

				const fetched = await fastConcurrentMap(
					10,
					pairsToFetch,
					async (pairInfo) => {
						const pairAddr = await this.factory.methods
							.getPool(pairInfo.tokenA, pairInfo.tokenB, pairInfo.feeAmount)
							.call();

						if (pairAddr === "0x0000000000000000000000000000000000000000")
							return null;
						const pair = new PairUniswapV3(chainId, this.web3, pairAddr);
						pair.pairKey = pairAddr;
						return pair;
					}
				);
				const pairs = fetched.filter((p) => p !== null) as Pair[];
				return pairs
			}
			case "PoolEvents": {
				let cachedData = cachedDataGlobal[chainId]?.[this.factory.options.address]
				const cachedDataFile = cacheDataFileName(chainId, this.factory.options.address)
				try {
					if (fs.existsSync(cachedDataFile)) {
						const cachedDataFromFile: CachedData = JSON.parse(fs.readFileSync(cachedDataFile).toString())
						if (
							!cachedDataFromFile.blockN || !cachedDataFromFile.pools ||
							!cachedDataFromFile.pools.every((p) => p.pool && p.token0 && p.token1 && p.fee)
						) {
							throw new Error("CacheData invalid!")
						}
						if (!cachedData || cachedDataFromFile.blockN > cachedData.blockN) {
							cachedData = cachedDataFromFile
						}
					}
				} catch (e) {
					console.warn(`UniV3Registry: Error while trying to read cache file: ${cachedDataFile}: ${e}`)
				}

				let pools: UniV3Pool[] = []
				let fromBlock = 0
				if (cachedData) {
					pools.push(...cachedData.pools)
					fromBlock = cachedData.blockN + 1
				}
				const poolAddrSet = new Set<string>()
				pools = pools.filter((p) => {
					if (poolAddrSet.has(p.pool)) {
						return false
					}
					poolAddrSet.add(p.pool)
					return true
				})
				const endBlock = await this.web3.eth.getBlockNumber()
				await fetchEvents(
					async (fromBlock, toBlock) => {
						const events = await this.factory.getPastEvents("PoolCreated", {fromBlock, toBlock})
						return events.map(
							(v) => ({
								token0: v.returnValues.token0 as string,
								token1: v.returnValues.token1 as string,
								pool: v.returnValues.pool as string,
								fee: v.returnValues.fee as string,
							} as UniV3Pool)
						)
					},
					fromBlock,
					endBlock,
					(fromBlock: number, toBlock: number, batch: UniV3Pool[]) => {
						batch = batch.filter((p) => {
							if (poolAddrSet.has(p.pool)) {
								return false
							}
							poolAddrSet.add(p.pool)
							return true
						})
						pools.push(...batch)
						const toCache: CachedData = {
							blockN: toBlock,
							pools: pools,
						}
						fs.writeFileSync(cachedDataFile, JSON.stringify(toCache))
					},
					"UNIV3REGISTRY",
				)
				pools = pools.filter((p) => tokenWhitelist.indexOf(p.token0) >= 0 && tokenWhitelist.indexOf(p.token1) >= 0);
				const pairs = pools.map((p) => new PairUniswapV3(
					chainId, this.web3, p.pool,
					{tokenA: p.token0, tokenB: p.token1, fee: Number.parseInt(p.fee) as FeeAmount}
				))
				return pairs
			}
		}
	};
}