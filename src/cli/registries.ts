import { ContractKit } from '@celo/contractkit';
import {
	mainnetRegistryCeloDex,
	mainnetRegistryCurve,
	mainnetRegistryMisc,
	mainnetRegistryMobius,
	mainnetRegistryMoola,
	mainnetRegistryMoolaV2,
	mainnetRegistryStCelo,
	mainnetRegistrySushiswap,
	mainnetRegistrySymmetric,
	mainnetRegistryUbeswap,
	mainnetRegistryUniswapV3,
} from '../registry-cfg';
import { Registry } from '../registry';
import { RegistryMentoV2 } from '../registries/mento-v2';

export const registriesByName: {[name: string]: (kit: ContractKit) => Registry} = {
	// Sorted by importance based on TVL.
	"mento-v2":    (kit: ContractKit) => new RegistryMentoV2(kit),
	"curve":       mainnetRegistryCurve,
	"uniswap-v3":  mainnetRegistryUniswapV3,
	"moola-v2":    mainnetRegistryMoolaV2,
	"stcelo":      mainnetRegistryStCelo,
	"ubeswap":     mainnetRegistryUbeswap,
	"sushiswap":   mainnetRegistrySushiswap,
	"mobius":      mainnetRegistryMobius,
	"misc":        mainnetRegistryMisc,

	// DEPRECATED stuff:
	"moola":       mainnetRegistryMoola,
	"celodex":     mainnetRegistryCeloDex,
	"symmetric":   mainnetRegistrySymmetric,
}
