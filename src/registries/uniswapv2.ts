import BigNumber from "bignumber.js"
import Web3 from "web3"

import { RegistryHelperUniswapV2, newRegistryHelperUniswapV2 } from "../../types/web3-v1-contracts/RegistryHelperUniswapV2"
import { IUniswapV2Factory, newIUniswapV2Factory } from "../../types/web3-v1-contracts/IUniswapV2Factory"
import { Address, Pair } from "../pair"
import { PairUniswapV2 } from "../pairs/uniswapv2"
import { Registry } from "../registry"
import { initPairsAndFilterByWhitelist } from "../utils"
import { fastConcurrentMap } from "../utils/async"

export class RegistryUniswapV2 extends Registry {
	private factory: IUniswapV2Factory
	private helper?: RegistryHelperUniswapV2

	constructor(
		name: string,
		private web3: Web3,
		private factoryAddr: Address,
		private opts?: {
			fixedFee?: BigNumber,
			registryHelperAddr?: Address
			fetchUsingTokenList?: boolean,
		},
	) {
		super(name)
		this.factory = newIUniswapV2Factory(web3, factoryAddr)
		if (opts?.registryHelperAddr) {
			this.helper = newRegistryHelperUniswapV2(web3, opts.registryHelperAddr)
		}
	}

	findPairs = async (tokenWhitelist: Address[]): Promise<Pair[]> =>  {
		const chainId = await this.web3.eth.getChainId()
		let pairsFetched
		if (this.helper) {
			// registry helper contract is available for fast discovery of pairs
			const nPairs = Number.parseInt(await this.factory.methods.allPairsLength().call())
			const limit = 100
			pairsFetched = []
			for (let offset = 0; offset < nPairs; offset += limit) {
				const result = await this.helper.methods.findPairs(this.factoryAddr, offset, limit).call()
				for (let pairInfo of result) {
					if (tokenWhitelist.indexOf(pairInfo.token0) === -1 && tokenWhitelist.indexOf(pairInfo.token1) === -1) {
						continue
					}
					pairsFetched.push(new PairUniswapV2(chainId, this.web3, pairInfo.pair, this.opts?.fixedFee))
				}
			}
		} else if (this.opts?.fetchUsingTokenList) {
			const pairsToFetch: {tokenA: Address, tokenB: Address}[] = []
			for (let i = 0; i < tokenWhitelist.length - 1; i += 1) {
				for (let j = i + 1; j < tokenWhitelist.length; j += 1) {
					pairsToFetch.push({tokenA: tokenWhitelist[i], tokenB: tokenWhitelist[j]})
				}
			}
			pairsFetched = await fastConcurrentMap(
				10,
				pairsToFetch,
				async (toFetch) => {
					const pairAddr = await this.factory.methods.getPair(toFetch.tokenA, toFetch.tokenB).call()
					if (pairAddr === "0x0000000000000000000000000000000000000000") {
						return null
					}
					return new PairUniswapV2(chainId, this.web3, pairAddr, this.opts?.fixedFee)
				})
		} else {
			const nPairs = Number.parseInt(await this.factory.methods.allPairsLength().call())
			pairsFetched = await fastConcurrentMap(
				10,
				[...Array(nPairs).keys()],
				async (idx) => {
					const pairAddr = await this.factory.methods.allPairs(idx).call()
					return new PairUniswapV2(chainId, this.web3, pairAddr, this.opts?.fixedFee)
				})
		}
		const pairs = pairsFetched.filter((p) => p !== null) as Pair[]
		return initPairsAndFilterByWhitelist(pairs, tokenWhitelist)
	}
}
