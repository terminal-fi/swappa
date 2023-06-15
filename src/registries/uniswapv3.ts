import Web3 from "web3";
import { concurrentMap } from "@celo/utils/lib/async";

import { Address, Pair } from "../pair";
import { Registry } from "../registry";
import {
  ABI as FactoryABI,
	IUniswapV3Factory,
} from "../../types/web3-v1-contracts/IUniswapV3Factory";
import { PairUniswapV3 } from "../pairs/uniswapv3";
import { UniV3FeeAmount } from "../utils/concentrated-liquidity/swapMath";
import { initPairsAndFilterByWhitelist } from "../utils";

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
      const pairsToFetch: { tokenA: Address; tokenB: Address }[] = [];
      const nPairs = tokenWhitelist.length;
      for (let i = 0; i < nPairs - 1; i += 1) {
        for (let j = i + 1; j < nPairs; j += 1) {
          pairsToFetch.push({
            tokenA: tokenWhitelist[i],
            tokenB: tokenWhitelist[j],
          });
        }
      }

      const fetched = await concurrentMap(
        10,
        pairsToFetch,
        async (pairInfo) => {
					for (const feeAmount of Object.keys(UniV3FeeAmount)) {
						const pairAddr = await this.factory.methods
							.getPool(pairInfo.tokenA, pairInfo.tokenB, feeAmount)
							.call();

						if (pairAddr === "0x0000000000000000000000000000000000000000")
							return null;
						const pair = new PairUniswapV3(chainId, this.web3, pairAddr);
						pair.pairKey = pairAddr;
						return pair;
					}
        }
      );
      const pairs = fetched.filter((p) => p !== null) as Pair[];
      return initPairsAndFilterByWhitelist(pairs, tokenWhitelist);
    } else {
      throw new Error("Not implemented!")
      // const pools = (await this.factory.getPastEvents("Pool")).map(
      //   (v) => v.returnValues.pool
      // );
      // const pairMap = new Map<String, Pair>();
      // await concurrentMap(5, pools, async (pairAddr) => {
      //   const pair = new PairUniswapV3(chainId, this.web3, pairAddr);
      //   if (pair !== null) {
      //     pairMap.set(pairAddr, pair);
      //   }
      //   return pair;
      // });
      // return initPairsAndFilterByWhitelist(Array.from(pairMap.values()), tokenWhitelist)
    }
  };
}