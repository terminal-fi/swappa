import BigNumber from "bignumber.js";
import { ContractKit } from "@celo/contractkit";
import { concurrentMap } from "@celo/utils/lib/async";
import { AbiItem } from "web3-utils";

import { IUniswapV2Factory } from "../../types/web3-v1-contracts/IUniswapV2Factory";
import { abi as FactoryABI } from "../../build/contracts/IUniswapV2Factory.json";
import { Address, Pair } from "../pair";
import { PairUniswapV2 } from "../pairs/uniswapv2";
import { initPairsAndFilterByWhitelist } from "../utils";

export class RegistryUniswapV2 {
  private factory: IUniswapV2Factory;

  constructor(
    private kit: ContractKit,
    factoryAddr: Address,
    private opts?: {
      fixedFee?: BigNumber;
      fetchUsingAllPairs?: boolean;
    }
  ) {
    this.factory = new kit.web3.eth.Contract(
      FactoryABI as AbiItem[],
      factoryAddr
    ) as unknown as IUniswapV2Factory;
  }

  findPairs = async (tokenWhitelist: Address[]): Promise<Pair[]> => {
    let pairsFetched;
    if (!this.opts?.fetchUsingAllPairs) {
      const pairsToFetch: { tokenA: Address; tokenB: Address }[] = [];
      for (let i = 0; i < tokenWhitelist.length - 1; i += 1) {
        for (let j = i + 1; j < tokenWhitelist.length; j += 1) {
          pairsToFetch.push({
            tokenA: tokenWhitelist[i],
            tokenB: tokenWhitelist[j],
          });
        }
      }
      pairsFetched = await concurrentMap(10, pairsToFetch, async (toFetch) => {
        const pairAddr = await this.factory.methods
          .getPair(toFetch.tokenA, toFetch.tokenB)
          .call();
        if (pairAddr === "0x0000000000000000000000000000000000000000") {
          return null;
        }
        return new PairUniswapV2(this.kit, pairAddr, this.opts?.fixedFee);
      });
    } else {
      const nPairs = Number.parseInt(
        await this.factory.methods.allPairsLength().call()
      );
      pairsFetched = await concurrentMap(
        10,
        [...Array(nPairs).keys()],
        async (idx) => {
          const pairAddr = await this.factory.methods.allPairs(idx).call();
          return new PairUniswapV2(this.kit, pairAddr, this.opts?.fixedFee);
        }
      );
    }
    const pairs = pairsFetched.filter((p) => p !== null) as Pair[];
    return initPairsAndFilterByWhitelist(pairs, tokenWhitelist);
  };
}
