import BigNumber from "bignumber.js";
import { ILendingPool } from "../../types/web3-v1-contracts/ILendingPool";
import { abi as LendingPoolABI } from "../../build/contracts/ILendingPool.json";
import { ILendingPoolAddressesProvider } from "../../types/web3-v1-contracts/ILendingPoolAddressesProvider";
import { abi as LendingPoolAddressProviderABI } from "../../build/contracts/ILendingPoolAddressesProvider.json";

import { Address, Pair } from "../pair";
import { selectAddress } from "../utils";
import { address as pairATokenAddress } from "../../tools/deployed/mainnet.PairAToken.addr.json";
import { AbiItem } from "web3-utils";
import Web3 from "web3";
import { CELO } from "../constants";

export const ReserveCELO = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export class PairAToken extends Pair {
  allowRepeats = true;

  private provider: ILendingPoolAddressesProvider;

  constructor(
    private web3: Web3,
    private providerAddr: Address,
    private reserve: Address
  ) {
    super();
    this.provider = new web3.eth.Contract(
      LendingPoolAddressProviderABI as AbiItem[],
      providerAddr
    ) as unknown as ILendingPoolAddressesProvider;
  }

  protected async _init() {
    const lendingPoolAddr = await this.provider.methods.getLendingPool().call();
    const lendingPool = new this.web3.eth.Contract(
      LendingPoolABI as AbiItem[],
      lendingPoolAddr
    ) as unknown as ILendingPool;
    const data = await lendingPool.methods.getReserveData(this.reserve).call();

    const chainId = await this.web3.eth.getChainId();
    const tokenA = data.aTokenAddress;
    const tokenB = this.reserve === ReserveCELO ? CELO[chainId] : this.reserve;
    return {
      pairKey: null,
      tokenA,
      tokenB,
      swappaPairAddress: await selectAddress(this.web3, {
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
