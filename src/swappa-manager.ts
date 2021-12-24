import { concurrentMap } from "@celo/utils/lib/async";
import BigNumber from "bignumber.js";
import Web3 from "web3";
import { AbiItem } from "web3-utils";

import { SwappaRouterV1 } from "../types/web3-v1-contracts/SwappaRouterV1";
import SwappaRouterMetadata from "../build/contracts/SwappaRouterV1.json";

import { Address, Pair } from "./pair";
import { Registry } from "./registry";
import { findBestRoutesForFixedInputAmount, RouterOpts } from "./router";

export class SwappaManager {
  private pairs: Pair[] = [];
  private pairsByToken = new Map<string, Pair[]>();

  constructor(
    private web3: Web3,
    public readonly routerAddr: Address,
    private registries: Registry[]
  ) {}

  public reinitializePairs = async (tokenWhitelist: Address[]) => {
    const pairsAll = await concurrentMap(5, this.registries, (r) =>
      r.findPairs(tokenWhitelist)
    );
    this.pairs = [];
    this.pairsByToken = new Map<string, Pair[]>();
    pairsAll.forEach((pairs) => {
      pairs.forEach((p) => {
        this.pairs.push(p);
        for (const token of [p.tokenA, p.tokenB]) {
          const x = this.pairsByToken.get(token);
          if (x) {
            x.push(p);
          } else {
            this.pairsByToken.set(token, [p]);
          }
        }
      });
    });
    return this.pairs;
  };

  public refreshPairs = async () => {
    await concurrentMap(10, this.pairs, (p) => p.refresh());
    return this.pairs;
  };

  public findBestRoutesForFixedInputAmount = (
    inputToken: Address,
    outputToken: Address,
    inputAmount: BigNumber,
    opts?: RouterOpts
  ) => {
    return findBestRoutesForFixedInputAmount(
      this.pairsByToken,
      inputToken,
      outputToken,
      inputAmount,
      opts
    );
  };

  public swap = (
    route: {
      pairs: Pair[];
      path: Address[];
    },
    inputAmount: BigNumber,
    minOutputAmount: BigNumber,
    to: Address,
    opts?: {
      precheckOutputAmount?: boolean;
      deadlineMs?: number;
    }
  ) => {
    return swapTX(
      this.web3,
      this.routerAddr,
      route,
      inputAmount,
      minOutputAmount,
      to,
      opts
    );
  };
}

export const swapTX = (
  web3: Web3,
  routerAddr: Address,
  route: {
    pairs: Pair[];
    path: Address[];
  },
  inputAmount: BigNumber,
  minOutputAmount: BigNumber,
  to: Address,
  opts?: {
    precheckOutputAmount?: boolean;
    deadlineMs?: number;
  }
) => {
  const router = new web3.eth.Contract(
    SwappaRouterMetadata.abi as AbiItem[],
    routerAddr
  ) as unknown as SwappaRouterV1;
  const routeData = route.pairs.map((p, idx) => p.swapData(route.path[idx]));
  const deadlineMs = opts?.deadlineMs || Date.now() / 1000 + 60;
  const swapF = opts?.precheckOutputAmount
    ? router.methods.swapExactInputForOutputWithPrecheck
    : router.methods.swapExactInputForOutput;
  return swapF(
    route.path,
    routeData.map((d) => d.addr),
    routeData.map((d) => d.extra),
    inputAmount.toFixed(0),
    minOutputAmount.toFixed(0),
    to,
    deadlineMs.toFixed(0)
  );
};
