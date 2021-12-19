import BigNumber from "bignumber.js"
import { ContractKit } from "@celo/contractkit"
import { SavingsCELOAddressMainnet } from "@terminal-fi/savingscelo"
import { PairSavingsCELO } from "./pairs/savingscelo"
import { PairStableSwap } from "./pairs/stableswap"
import { RegistryAave } from "./registries/aave"
import { RegistryAaveV2 } from "./registries/aave-v2"
import { RegistryMento } from "./registries/mento"
import { RegistryStatic } from "./registries/static"
import { RegistryUniswapV2 } from "./registries/uniswapv2"

export const mainnetRegistryMoola =
	(kit: ContractKit) => new RegistryAave(kit, "0x7AAaD5a5fa74Aec83b74C2a098FBC86E17Ce4aEA", "Moola")
export const mainnetRegistryUbeswap =
	(kit: ContractKit) => new RegistryUniswapV2(kit, "0x62d5b84bE28a183aBB507E125B384122D2C25fAE", undefined, "Ubeswap")
export const mainnetRegistrySushiswap =
	(kit: ContractKit) => new RegistryUniswapV2(kit, "0xc35DADB65012eC5796536bD9864eD8773aBc74C4", undefined, "Sushiswap")
export const mainnetRegistryMobius =
	(kit: ContractKit) => new RegistryStatic([
		// Source: https://github.com/mobiusAMM/mobiusV1
		new PairStableSwap(kit, "0x0ff04189Ef135b6541E56f7C638489De92E9c778"), // cUSD <-> bUSDC
		new PairStableSwap(kit, "0xdBF27fD2a702Cc02ac7aCF0aea376db780D53247"), // cUSD <-> cUSDT
		new PairStableSwap(kit, "0xE0F2cc70E52f05eDb383313393d88Df2937DA55a"), // cETH <-> WETH
		new PairStableSwap(kit, "0x19260b9b573569dDB105780176547875fE9fedA3"), //  BTC <-> WBTC
		new PairStableSwap(kit, "0xA5037661989789d0310aC2B796fa78F1B01F195D"), // cUSD <-> USDC
		new PairStableSwap(kit, "0x2080AAa167e2225e1FC9923250bA60E19a180Fb2"), // cUSD <-> pUSDC
		new PairStableSwap(kit, "0x63C1914bf00A9b395A2bF89aaDa55A5615A3656e"), // cUSD <-> asUSDC
		new PairStableSwap(kit, "0x382Ed834c6b7dBD10E4798B08889eaEd1455E820"), // cEUR <-> pEUR
		new PairStableSwap(kit, "0x413FfCc28e6cDDE7e93625Ef4742810fE9738578"), // CELO <-> pCELO
		new PairStableSwap(kit, "0x02Db089fb09Fda92e05e92aFcd41D9AAfE9C7C7C"), // cUSD <-> pUSD
		new PairStableSwap(kit, "0x0986B42F5f9C42FeEef66fC23eba9ea1164C916D"), // cUSD <-> aaUSDC
		// Opticsv2: https://github.com/mobiusAMM/mobius-interface/blob/main/src/constants/StablePools.ts
		new PairStableSwap(kit, "0x9906589Ea8fd27504974b7e8201DF5bBdE986b03"), // cUSD <-> USDCv2
		new PairStableSwap(kit, "0xF3f65dFe0c8c8f2986da0FEc159ABE6fd4E700B4"), // cUSD <-> DAIv2
		new PairStableSwap(kit, "0x74ef28D635c6C5800DD3Cd62d4c4f8752DaACB09"), // cETH <-> WETHv2
		new PairStableSwap(kit, "0xaEFc4e8cF655a182E8346B24c8AbcE45616eE0d2"), // cBTC <-> WBTCv2
		new PairStableSwap(kit, "0xcCe0d62Ce14FB3e4363Eb92Db37Ff3630836c252"), // cUSD <-> pUSDCv2
	], "Mobius")
export const mainnetRegistrySavingsCELO =
	(kit: ContractKit) =>  new RegistryStatic([
		new PairSavingsCELO(kit, SavingsCELOAddressMainnet),
	], "SavingsCELO")
export const mainnetRegistryMoolaV2 =
	(kit: ContractKit) => new RegistryAaveV2(kit, "0xD1088091A174d33412a968Fa34Cb67131188B332", "MoolaV2")
export const mainnetRegistryCeloDex =
	(kit: ContractKit) => new RegistryUniswapV2(kit, "0x31bD38d982ccDf3C2D95aF45a3456d319f0Ee1b6", {
		fixedFee: new BigNumber(0.997), // TODO(zviadm): Figure out actual fee for CeloDex pairs.
		fetchUsingAllPairs: true,
	}, "CeloDex")

// mainnetRegistriesWhitelist contains list of more established protocols with
// overall higher TVL.
export const mainnetRegistriesWhitelist = (kit: ContractKit) => ([
	new RegistryMento(kit),
	// Uniswap forks:
	mainnetRegistryUbeswap(kit),
	mainnetRegistrySushiswap(kit),
	// Stableswap forks:
	mainnetRegistryMobius(kit),
	// Direct conversion protocols:
	mainnetRegistryMoola(kit),
	mainnetRegistryMoolaV2(kit),
	mainnetRegistrySavingsCELO(kit),
])