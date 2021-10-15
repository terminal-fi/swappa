import { ContractKit } from "@celo/contractkit";
import { IUniswapV2Factory, ABI as FactoryABI } from "../../types/web3-v1-contracts/IUniswapV2Factory";
import { Address, Pair } from "../pair";
import { PairUniswapV2 } from "../pairs/uniswapv2";

export class RegistryUniswapV2 {
	private factory: IUniswapV2Factory

	constructor(
		private kit: ContractKit,
		private factoryAddr: Address,
	) {
		this.factory = new kit.web3.eth.Contract(FactoryABI, factoryAddr) as unknown as IUniswapV2Factory
	}

	findPairs = async (tokenWhitelist: Address[]): Promise<Pair[]> =>  {
		const pairAddrsP: Promise<{pair: Address, tokenA: Address, tokenB: Address}>[] = []
		for (let i = 0; i < tokenWhitelist.length - 1; i += 1) {
			for (let j = i + 1; j < tokenWhitelist.length; j += 1) {
				pairAddrsP.push(
					this.factory.methods.getPair(tokenWhitelist[i], tokenWhitelist[j])
						.call()
						.then((r) => ({pair: r, tokenA: tokenWhitelist[i], tokenB: tokenWhitelist[j]}))
				)
			}
		}
		const pairAddrs = (await Promise.all(pairAddrsP)).filter((p) => p.pair !== "0x0000000000000000000000000000000000000000")
		const pairs = await Promise.all(pairAddrs.map((p) => new PairUniswapV2(this.kit, this.factoryAddr, p.tokenA, p.tokenB)))
		await Promise.all(pairs.map((p) => p.init()))
		return pairs
	}
}