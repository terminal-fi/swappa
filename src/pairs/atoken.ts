import BigNumber from "bignumber.js";
import { ContractKit } from "@celo/contractkit";
import { ILendingPool } from "../../types/web3-v1-contracts/ILendingPool";
import { abi as LendingPoolABI } from "../../build/contracts/ILendingPool.json";
import { ILendingPoolAddressesProvider } from "../../types/web3-v1-contracts/ILendingPoolAddressesProvider";
import { abi as LendingPoolAddressProviderABI } from "../../build/contracts/ILendingPoolAddressesProvider.json";

import { Address, Pair } from "../pair";
import { selectAddress } from "../utils";
import { address as pairATokenAddress } from "../../tools/deployed/mainnet.PairAToken.addr.json";
import { AbiItem } from "web3-utils";

export const ReserveCELO = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export class PairAToken extends Pair {
  allowRepeats = true;

  private provider: ILendingPoolAddressesProvider;

  constructor(
    private kit: ContractKit,
    private providerAddr: Address,
    private reserve: Address
  ) {
    super();
    this.provider = new kit.web3.eth.Contract(
      LendingPoolAddressProviderABI as AbiItem[],
      providerAddr
    ) as unknown as ILendingPoolAddressesProvider;
  }

  protected async _init() {
    const lendingPoolAddr = await this.provider.methods.getLendingPool().call();
    const lendingPool = new this.kit.web3.eth.Contract(
      LendingPoolABI as AbiItem[],
      lendingPoolAddr
    ) as unknown as ILendingPool;
    const data = await lendingPool.methods.getReserveData(this.reserve).call();

    const tokenA = data.aTokenAddress;
    const tokenB =
      this.reserve === ReserveCELO
        ? (await this.kit.contracts.getGoldToken()).address
        : this.reserve;
    return {
      pairKey: null,
      tokenA,
      tokenB,
      swappaPairAddress: await selectAddress(this.kit, {
        mainnet: pairATokenAddress,
      }),
    };
  }
  public async refresh(): Promise<void> {}

  protected swapExtraData(inputToken: Address) {
    const swapType =
      inputToken === this.tokenA
        ? "01"
        : this.reserve === ReserveCELO
        ? "02"
        : "03";
    return `${this.providerAddr}${swapType}`;
  }

  public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
    if (inputToken !== this.tokenA && inputToken !== this.tokenB) {
      throw new Error(
        `unsupported input: ${inputToken}, pair: ${this.tokenA}/${this.tokenB}!`
      );
    }
    return inputAmount;
  }
}
