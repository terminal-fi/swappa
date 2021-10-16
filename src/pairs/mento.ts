import { ContractKit, StableToken } from "@celo/contractkit";
import { ExchangeWrapper } from "@celo/contractkit/lib/wrappers/Exchange";
import BigNumber from "bignumber.js";
import { Address, PairXYeqK } from "../pair";
import { address as pairMentoAddress } from "../../tools/deployed/mainnet.PairMento.addr.json"

export class PairMento extends PairXYeqK {
	private exchange?: ExchangeWrapper

	constructor(
		private kit: ContractKit,
		private stableToken: StableToken,
		celo: Address,
		cSTB: Address,
	) {
		super(celo, cSTB)
	}

	public async _init() {
		if ((await this.kit.web3.eth.getChainId()) !== 42220) {
			throw new Error(`PairMento only exists on mainnet!`)
		}
		const celo = await this.kit.contracts.getGoldToken()
		if (celo.address !== this.tokenA) {
			throw new Error(`invalid celo: ${this.tokenA} !== ${celo.address}`)
		}
		const cSTB = await this.kit.contracts.getStableToken(this.stableToken)
		if (cSTB.address !== this.tokenB) {
			throw new Error(`invalid cSTB: ${this.tokenB} !== ${cSTB.address}`)
		}
		this.exchange = await this.kit.contracts.getExchange(this.stableToken)
	}

	public async refresh(): Promise<void> {
		if (!this.exchange) {
			throw new Error(`not initialized!`)
		}
		// TODO(zviad): Detect upcoming bucket change.
		const [
			spread,
			[bucketCELO, bucketSTB],
		] = await Promise.all([
			this.exchange.spread(),
			this.exchange.getBuyAndSellBuckets(false),
		])
		this.refreshBuckets(new BigNumber(1).minus(spread), bucketCELO, bucketSTB)
	}

	public swapData() {
		return {addr: pairMentoAddress, extra: this.exchange!.address}
	}
}