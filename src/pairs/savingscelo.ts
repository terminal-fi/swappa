import BigNumber from "bignumber.js"
import Web3 from "web3"
import { ContractKit } from "@celo/contractkit"

import { Address, Pair, Snapshot, BigNumberString } from "../pair"
import { selectAddress } from "../utils"
import { address as pairSavingsCELOAddress } from "../../tools/deployed/mainnet.PairSavingsCELO.addr.json"
import { celoToSavings, SavingsKit } from "@terminal-fi/savingscelo";

interface PairSavingsCELOSnapshot extends Snapshot {
	celoTotal: BigNumberString
	savingsTotal: BigNumberString
}

export class PairSavingsCELO extends Pair {
	allowRepeats = true

	private savingsKit: SavingsKit
	private totalSupplies?: {celoTotal: BigNumber, savingsTotal: BigNumber}

	constructor(
		chainId: number,
		private kit: ContractKit,
		savingsCELOAddr: Address,
	) {
		super(kit.web3 as unknown as Web3, selectAddress(chainId, {mainnet: pairSavingsCELOAddress}))
		this.savingsKit = new SavingsKit(kit, savingsCELOAddr)
	}

	protected async _init() {
		const celo = await this.kit.contracts.getGoldToken()
		const tokenA = celo.address
		const tokenB = this.savingsKit.contractAddress
		return {
			pairKey: null,
			tokenA, tokenB,
		}
	}
	public async refresh(): Promise<void> {
		this.totalSupplies = await this.savingsKit.totalSupplies()
	}

	protected swapExtraData(inputToken: Address) {
		return this.savingsKit.contractAddress
	}

	public outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber {
		if (inputToken === this.tokenA) {
			return celoToSavings(inputAmount, this.totalSupplies!.celoTotal, this.totalSupplies!.savingsTotal)
		} else if (inputToken === this.tokenB) {
			return new BigNumber(0)
		} else {
			throw new Error(`unsupported input: ${inputToken}, pair: ${this.tokenA}/${this.tokenB}!`)
		}
	}

	public snapshot(): PairSavingsCELOSnapshot {
		return {
			celoTotal: this.totalSupplies?.celoTotal.toFixed() || '',
			savingsTotal: this.totalSupplies?.savingsTotal.toFixed() || ''
		}
	}

	public restore(snapshot: PairSavingsCELOSnapshot): void {
		this.totalSupplies = {
			celoTotal: new BigNumber(snapshot.celoTotal),
			savingsTotal: new BigNumber(snapshot.savingsTotal)
		}
	}
}
