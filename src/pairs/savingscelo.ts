import BigNumber from "bignumber.js";
import { ContractKit } from "@celo/contractkit";

import { Address, Pair } from "../pair";
import { selectAddress } from "../utils";
import { address as pairSavingsCELOAddress } from "../../tools/deployed/mainnet.PairSavingsCELO.addr.json";
import { celoToSavings, SavingsKit } from "@terminal-fi/savingscelo";
import Web3 from "web3";

export class PairSavingsCELO extends Pair {
  allowRepeats = true;

  private savingsKit: SavingsKit;
  private totalSupplies?: { celoTotal: BigNumber; savingsTotal: BigNumber };

  constructor(private kit: ContractKit, savingsCELOAddr: Address) {
    super();
    this.savingsKit = new SavingsKit(kit, savingsCELOAddr);
  }

  protected async _init() {
    const celo = await this.kit.contracts.getGoldToken();
    const tokenA = celo.address;
    const tokenB = this.savingsKit.contractAddress;
    return {
      pairKey: null,
      tokenA,
      tokenB,
      swappaPairAddress: await selectAddress(this.kit.web3 as unknown as Web3, {
        mainnet: pairSavingsCELOAddress,
      }),
    };
  }
  public async refresh(): Promise<void> {
    this.totalSupplies = await this.savingsKit.totalSupplies();
  }

  protected swapExtraData(inputToken: Address) {
    return this.savingsKit.contractAddress;
  }

  public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
    if (inputToken === this.tokenA) {
      return celoToSavings(
        inputAmount,
        this.totalSupplies!.celoTotal,
        this.totalSupplies!.savingsTotal
      );
    } else if (inputToken === this.tokenB) {
      return new BigNumber(0);
    } else {
      throw new Error(
        `unsupported input: ${inputToken}, pair: ${this.tokenA}/${this.tokenB}!`
      );
    }
  }
}
