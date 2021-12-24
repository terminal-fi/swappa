import { ContractKit } from "@celo/contractkit";

import { ILendingPool } from "../../types/web3-v1-contracts/ILendingPool";
import { abi as LendingPoolABI } from "../../build/contracts/ILendingPool.json";
import { ILendingPoolAddressesProvider } from "../../types/web3-v1-contracts/ILendingPoolAddressesProvider";
import { abi as LendingPoolAddressProviderABI } from "../../build/contracts/ILendingPoolAddressesProvider.json";
import { Address } from "../pair";
import { PairAToken, ReserveCELO } from "../pairs/atoken";
import { initPairsAndFilterByWhitelist } from "../utils";
import { AbiItem } from "web3-utils";

export class RegistryAave {
  private lendingPoolAddrProvider: ILendingPoolAddressesProvider;

  constructor(private kit: ContractKit, lendingPoolAddrProviderAddr: string) {
    this.lendingPoolAddrProvider = new kit.web3.eth.Contract(
      LendingPoolAddressProviderABI as AbiItem[],
      lendingPoolAddrProviderAddr
    ) as unknown as ILendingPoolAddressesProvider;
  }

  findPairs = async (tokenWhitelist: Address[]) => {
    const lendingPoolAddr = await this.lendingPoolAddrProvider.methods
      .getLendingPool()
      .call();
    const lendingPool = new this.kit.web3.eth.Contract(
      LendingPoolABI as AbiItem[],
      lendingPoolAddr
    ) as unknown as ILendingPool;
    const reserves = await lendingPool.methods.getReserves().call();
    const reservesMatched = [
      ReserveCELO,
      ...reserves.filter((r) => tokenWhitelist.indexOf(r) >= 0),
    ];
    const pairs = reservesMatched.map(
      (r) =>
        new PairAToken(
          this.kit,
          this.lendingPoolAddrProvider.options.address,
          r
        )
    );
    return initPairsAndFilterByWhitelist(pairs, tokenWhitelist);
  };
}
