import Web3 from "web3";
import { concurrentMap } from "@celo/utils/lib/async";

import { Address, Pair } from "../pair";
import { Registry } from "../registry";
import {
  IAlgebraFactory,
  ABI as FactoryABI,
} from "../../types/web3-v1-contracts/IAlgebraFactory";
import { PairAlgebra } from "../pairs/concentrated-liquidity/algebra";

export class RegistryAlgebra extends Registry {
  private factory: IAlgebraFactory;

  constructor(
    name: string,
    private web3: Web3,
    factoryAddr: Address,
    private opts?: {
      fixedFee?: number;
      fetchUsingAllPairs?: boolean;
    }
  ) {
    super(name);
    this.factory = new web3.eth.Contract(
      FactoryABI,
      factoryAddr
    ) as unknown as IAlgebraFactory;
  }

  findNumberOfPools = async (): Promise<number> => {
    const poolEvents = await this.factory.getPastEvents("Pool");
    return poolEvents.length;
  };

  findPairs = async (tokenWhitelist: Address[] = []): Promise<Pair[]> => {
    const chainId = await this.web3.eth.getChainId();

    if (!this.opts?.fetchUsingAllPairs) {
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
          const pairAddr = await this.factory.methods
            .poolByPair(pairInfo.tokenA, pairInfo.tokenB)
            .call();

          if (pairAddr === "0x0000000000000000000000000000000000000000")
            return null;
          const pair = new PairAlgebra(chainId, this.web3, pairAddr);
          pair.pairKey = pairAddr;

          return pair;
        }
      );
      const pairs = fetched.filter((p) => p !== null) as Pair[];

      return pairs;
    } else {
      const pools = (await this.factory.getPastEvents("Pool")).map(
        (v) => v.returnValues.pool
      );
      const pairMap = new Map<String, Pair>();
      await concurrentMap(5, pools, async (pairAddr) => {
        const pair = new PairAlgebra(chainId, this.web3, pairAddr);
        if (pair !== null) {
          pairMap.set(pairAddr, pair);
        }
        return pair;
      });
      return Array.from(pairMap.values());
    }
  };
}
