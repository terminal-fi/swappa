import path from "path";
import fs from "fs";
import Web3 from "web3";
import { concurrentMap } from "@celo/utils/lib/async";

import { Address, Pair } from "../pair";
import { Registry } from "../registry";
import {
  ABI as FactoryABI,
	IUniswapV3Factory,
} from "../../types/web3-v1-contracts/IUniswapV3Factory";
import { PairUniswapV3 } from "../pairs/uniswapv3";
import { UniV3FeeAmounts } from "../utils/concentrated-liquidity/swapMath";
import { initPairsAndFilterByWhitelist } from "../utils";

interface UniV3Pool {
  token0: string
  token1: string
  pool: string
}

interface CachedData {
  blockN: number
  pools: UniV3Pool[]
}

export class RegistryUniswapV3 extends Registry {
  private factory: IUniswapV3Factory;

  constructor(
    name: string,
    private web3: Web3,
    factoryAddr: Address,
    private opts?: {
      fetchUsingPoolEvents?: boolean;
    }
  ) {
    super(name);
    this.factory = new web3.eth.Contract(
      FactoryABI,
      factoryAddr
    ) as unknown as IUniswapV3Factory;
  }

  findNumberOfPools = async (): Promise<number> => {
    const poolEvents = await this.factory.getPastEvents("Pool");
    return poolEvents.length;
  };

  findPairs = async (tokenWhitelist: Address[] = []): Promise<Pair[]> => {
    const chainId = await this.web3.eth.getChainId();

    if (!this.opts?.fetchUsingPoolEvents) {
      const pairsToFetch: { tokenA: Address; tokenB: Address; feeAmount: number }[] = [];
      const nPairs = tokenWhitelist.length;
      for (let i = 0; i < nPairs - 1; i += 1) {
        for (let j = i + 1; j < nPairs; j += 1) {
					for (const feeAmount of UniV3FeeAmounts) {
            pairsToFetch.push({
              tokenA: tokenWhitelist[i],
              tokenB: tokenWhitelist[j],
              feeAmount,
            });
          }
        }
      }

      const fetched = await concurrentMap(
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
      return initPairsAndFilterByWhitelist(pairs, tokenWhitelist);
    } else {
      const cachedDataFile = path.join("/tmp", `swappa.uniswapv3.${chainId}.pools.json`)
      let pools: {token0: string, token1: string, pool: string}[] = []
      let fromBlock = 0
      try {
        if (fs.existsSync(cachedDataFile)) {
          const cachedData: CachedData = JSON.parse(fs.readFileSync(cachedDataFile).toString())
          pools.push(...cachedData.pools)
          fromBlock = cachedData.blockN + 1
        }
      } catch (e) {
        console.warn(`UniV3Registry: Error while trying to read cache file: ${cachedDataFile}: ${e}`)
      }

      const batchSize = 1_000_000
      const endBlock = await this.web3.eth.getBlockNumber()
      while (fromBlock < endBlock) {
        const toBlock = Math.min(fromBlock + batchSize - 1, endBlock)
        pools.push(...(await this.factory.getPastEvents("PoolCreated", {fromBlock, toBlock})).map(
          (v) => ({
            token0: v.returnValues.token0 as string,
            token1: v.returnValues.token1 as string,
            pool: v.returnValues.pool as string,
          })
        ))
        console.info(`UniV3Registry: Fetching events: ${fromBlock}...${toBlock}, Pools: ${pools.length}...`)
        fromBlock = toBlock + 1
      }
      const poolAddrSet = new Set<string>()
      pools = pools.filter((p) => {
        if (poolAddrSet.has(p.pool)) {
          return false
        }
        poolAddrSet.add(p.pool)
        return true
      })
      const toCache: CachedData = {
        blockN: endBlock,
        pools: pools,
      }
      console.info(`UniV3Registry: BlockN: ${toCache.blockN}, Pools: ${toCache.pools.length} -> ${cachedDataFile}`)
      fs.writeFileSync(cachedDataFile, JSON.stringify(toCache))

      pools = pools.filter((p) => tokenWhitelist.indexOf(p.token0) >= 0 && tokenWhitelist.indexOf(p.token1) >= 0);
      const pairs = pools.map((p) => new PairUniswapV3(chainId, this.web3, p.pool))
      return initPairsAndFilterByWhitelist(pairs, tokenWhitelist)
    }
  };
}