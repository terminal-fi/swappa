import axios from 'axios';
import * as ubeswapTokens from '@ubeswap/default-token-list/ubeswap-experimental.token-list.json'

export interface Token {
	chainId: number,
	address: string,
	symbol: string,
	decimals: number,
}
let _CHAIN_ID: number
let _ALL_TOKENS: Token[]

export async function initAllTokens(chainId: number) {
	_CHAIN_ID = chainId
	const celoTokenListURI = "https://celo-org.github.io/celo-token-list/celo.tokenlist.json"
	const celoTokenList = (await axios.get<{tokens: Token[]}>(celoTokenListURI)).data
	_ALL_TOKENS = [
		...ubeswapTokens.tokens,
		...celoTokenList.tokens,
		{
			chainId: 42220,
			address: "0x617f3112bf5397D0467D315cC709EF968D9ba546",
			symbol: "USDTxWormhole",
			decimals: 6,
		}, {
			chainId: 42220,
			address: "0xDc5762753043327d74e0a538199c1488FC1F44cf",
			symbol: "rstCELO",
			decimals: 18,
		}, {
			chainId: 42220,
			address: "0xEB466342C4d449BC9f53A865D5Cb90586f405215",
			symbol: "axlUSDC",
			decimals: 6,
		}, {
			chainId: 42220,
			address: "0xC16B81Af351BA9e64C1a069E3Ab18c244A1E3049",
			symbol: "agEUR",
			decimals: 18,
		}, {
			chainId: 42220,
			address: "0x061cc5a2C863E0C1Cb404006D559dB18A34C762d",
			symbol: "axlEUROC",
			decimals: 6,
		}, {
			chainId: 42220,
			address: "0x061cc5a2C863E0C1Cb404006D559dB18A34C762d",
			symbol: "axlEUROC",
			decimals: 6,
		}, {
			chainId: 42220,
			address: "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08",
			symbol: "eXOF",
			decimals: 18,
		}, {
			chainId: 42220,
			address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
			symbol: "USDC",
			decimals: 6,
		}, {
			chainId: 42220,
			address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
			symbol: "USD₮",
			decimals: 6,
		},
	]
	return _ALL_TOKENS
}

export function tokenByAddrOrSymbol(addressOrSymbol: string) {
	const t = _ALL_TOKENS.find((t) => t.chainId === _CHAIN_ID && (t.address === addressOrSymbol || t.symbol === addressOrSymbol))
	if (!t) {
		throw new Error(`Unrecognized token: ${addressOrSymbol}!`)
	}
	return t
}
