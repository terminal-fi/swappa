import Web3 from "web3"

import { ILendingPoolV2 } from "../../types/web3-v1-contracts/ILendingPoolV2";
import { abi as ILendingPoolV2ABI } from "../../build/contracts/ILendingPoolV2.json";
import { ILendingPoolAddressesProviderV2 } from "../../types/web3-v1-contracts/ILendingPoolAddressesProviderV2";
import { abi as ILendingPoolAddressesProviderV2ABI } from "../../build/contracts/ILendingPoolAddressesProviderV2.json";

import { Address } from "../pair";
import { initPairsAndFilterByWhitelist } from "../utils";
import { PairATokenV2 } from "../pairs/atoken-v2";
import { AbiItem } from "web3-utils";

export class RegistryAaveV2 {
  private provider: ILendingPoolAddressesProviderV2;

  constructor(private web3: Web3, lendingPoolAddrProviderAddr: string) {
    this.provider = new web3.eth.Contract(
      ILendingPoolAddressesProviderV2ABI as AbiItem[],
      lendingPoolAddrProviderAddr
    ) as unknown as ILendingPoolAddressesProviderV2;
  }

  findPairs = async (tokenWhitelist: Address[]) => {
    const poolAddr: string = await this.provider.methods
      .getLendingPool()
      .call();
    const lendingPool = new this.web3.eth.Contract(
      ILendingPoolV2ABI as AbiItem[],
      poolAddr
    ) as unknown as ILendingPoolV2;
    const reserves: Address[] = await lendingPool.methods
      .getReservesList()
      .call();
    const reservesMatched = reserves.filter(
      (r) => tokenWhitelist.indexOf(r) >= 0
    );
    const pairs = reservesMatched.map(
      (r) => new PairATokenV2(this.web3, poolAddr, r)
    );
    return initPairsAndFilterByWhitelist(pairs, tokenWhitelist);
  };
}
