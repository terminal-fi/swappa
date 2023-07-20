import Web3 from "web3";
import { Address, BigNumberString, Pair, Snapshot } from "../pair";
import {
  IStakedCelo,
  newIStakedCelo,
} from "../../types/web3-v1-contracts/IStakedCelo";
import {
  IAccount,
  newIAccount,
} from "../../types/web3-v1-contracts/IAccount";
import { address as pairStCeloAddress } from "../../tools/deployed/mainnet.PairStCelo.addr.json";
import { address as pairRstCeloAddress } from "../../tools/deployed/mainnet.PairRStCelo.addr.json";

import { selectAddress } from "../utils";
import BigNumber from "bignumber.js";

interface PairStakedCeloSnapshot extends Snapshot {
  stCeloSupply: BigNumberString;
  celoBalance: BigNumberString;
}

abstract class PairStakedCelo extends Pair {
  allowRepeats = true;

  private stCeloContract: IStakedCelo;
  private accountContract: IAccount;
  private stCeloSupply: bigint = BigInt(0);
  private celoBalance: bigint = BigInt(0);

  constructor(
    private web3: Web3,
    swappaPairAddress: Address,
    private stakedCeloAddress: Address,
    private accountAddress: Address
  ) {
    super(web3, swappaPairAddress);
    this.stCeloContract = newIStakedCelo(web3, this.stakedCeloAddress)
    this.accountContract = newIAccount(web3, this.accountAddress)
  }

  protected async _fetchSupplies() {
    const [stCeloSupply, celoBalace] = await Promise.all([
      this.stCeloContract.methods.totalSupply().call(),
      this.accountContract.methods.getTotalCelo().call(),
    ]);
    this.stCeloSupply = BigInt(stCeloSupply.toString());
    this.celoBalance = BigInt(celoBalace.toString());
  }
  public async refresh(): Promise<void> {
    await this._fetchSupplies();
  }

  protected toStakedCelo(celoAmount: bigint): bigint {
    return (celoAmount * this.stCeloSupply) / this.celoBalance;
  }

  protected toCelo(stCeloAmount: bigint): bigint {
    return (stCeloAmount * this.celoBalance) / this.stCeloSupply;
  }

  public snapshot(): PairStakedCeloSnapshot {
    return {
      stCeloSupply: this.stCeloSupply.toString(),
      celoBalance: this.celoBalance.toString(),
    };
  }

  public restore({ stCeloSupply, celoBalance }: PairStakedCeloSnapshot): void {
    this.stCeloSupply = BigInt(stCeloSupply);
    this.celoBalance = BigInt(celoBalance);
  }
}

export class PairStCelo extends PairStakedCelo {
  constructor(
    chainId: number,
    web3: Web3,
    accountAddress: Address,
    private managerAddress: Address,
    private celoAddr: Address,
    private stCeloAddr: Address
  ) {
    super(
      web3,
      selectAddress(chainId, { mainnet: pairStCeloAddress }),
      stCeloAddr,
      accountAddress
    );
  }

  protected async _init() {
    return {
      pairKey: this.managerAddress,
      tokenA: this.celoAddr,
      tokenB: this.stCeloAddr,
    };
  }

  public outputAmount(inputToken: string, inputAmount: BigNumber): BigNumber {
    const bnOutput = this._outputAmount(
      inputToken,
      BigInt(inputAmount.toFixed(0))
    );

    return new BigNumber(bnOutput.toString());
  }

  private _outputAmount(inputToken: string, inputAmount: bigint): bigint {
    if (inputToken === this.tokenB) return BigInt(0);
    return this.toStakedCelo(inputAmount);
  }

  protected swapExtraData(): string {
    return this.managerAddress;
  }
}

export class PairRebasedStCelo extends PairStakedCelo {
  constructor(
    chainId: number,
    web3: Web3,
    accountAddress: Address,
    private rstCeloAddr: Address,
    private stCeloAddr: Address
  ) {
    super(
      web3,
      selectAddress(chainId, { mainnet: pairRstCeloAddress }),
      stCeloAddr,
      accountAddress
    );
  }

  protected async _init() {
    await this._fetchSupplies();
    return {
      pairKey: this.rstCeloAddr,
      tokenA: this.rstCeloAddr,
      tokenB: this.stCeloAddr,
    };
  }

  public outputAmount(inputToken: string, inputAmount: BigNumber): BigNumber {
    const bnOutput = this._outputAmount(
      inputToken,
      BigInt(inputAmount.toFixed(0))
    );

    return new BigNumber(bnOutput.toString());
  }

  private _outputAmount(inputToken: string, inputAmount: bigint): bigint {
    if (inputToken === this.tokenB) return this.toCelo(inputAmount);
    return this.toStakedCelo(inputAmount);
  }

  protected swapExtraData(inputToken: string): string {
    const swapType = inputToken === this.tokenA ? "01" : "02";

    return `${this.rstCeloAddr}${swapType}`;
  }
}
