import BigNumber from "bignumber.js"
import Web3 from "web3"
import { ISwappaPairV1, ABI as ISwappaPairV1ABI } from "../types/web3-v1-contracts/ISwappaPairV1"

export type Address = string

export abstract class Snapshot {}
export type BigNumberString = string

export interface SwapData {
	addr: string
	extra: string
}

export abstract class Pair {
	// pairKey is used to identify conflicting pairs. In a single route, every non-null pairKey must
	// be unique. On the otherhand, Pair-s with null pairKey can be used unlimited amount of times in
	// a single route.
	public pairKey: string | null = null
	public tokenA: Address = ""
	public tokenB: Address = ""
	private swappaPairAddress: Address
	private swappaPair: ISwappaPairV1

	constructor(web3: Web3, swappaPairAddress: Address) {
		this.swappaPairAddress = swappaPairAddress
		this.swappaPair = new web3.eth.Contract(ISwappaPairV1ABI, this.swappaPairAddress) as unknown as ISwappaPairV1
	}

	public async init(): Promise<void> {
		const r = await this._init()
		this.pairKey = r.pairKey
		this.tokenA = r.tokenA
		this.tokenB = r.tokenB
		return this.refresh()
	}
	protected abstract _init(): Promise<{
		pairKey: string | null,
		tokenA: Address,
		tokenB: Address,
	}>;
	public abstract refresh(): Promise<void>;
	public swapData(inputToken: Address): SwapData {
		return {
			addr: this.swappaPairAddress,
			extra: this.swapExtraData(inputToken),
		}
	}
	protected abstract swapExtraData(inputToken: Address): string;
	public abstract outputAmount(inputToken: Address, inputAmount: BigNumber): BigNumber;

	public outputAmountAsync = async (inputToken: Address, inputAmount: BigNumber): Promise<BigNumber> => {
		const outputToken = inputToken === this.tokenA ? this.tokenB : this.tokenA
		const out = await this.swappaPair.methods.getOutputAmount(
			inputToken,
			outputToken,
			inputAmount.toFixed(0),
			this.swapExtraData(inputToken),
		).call()
		return new BigNumber(out)
	}

	public abstract snapshot(): Snapshot;
	public abstract restore(snapshot: Snapshot): void;
}
