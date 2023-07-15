import { ContractKit } from '@celo/contractkit';
import {
	mainnetRegistryCeloDex,
	mainnetRegistryCurve,
	mainnetRegistryMisc,
	mainnetRegistryMobius,
	mainnetRegistryMoola,
	mainnetRegistryMoolaV2,
	mainnetRegistrySavingsCELO,
	mainnetRegistryStCelo,
	mainnetRegistrySushiswap,
	mainnetRegistrySymmetric,
	mainnetRegistryUbeswap,
	mainnetRegistryUniswapV3,
} from '../registry-cfg';
import { RegistryMento } from '../registries/mento';
import { Registry } from '../registry';

export const registriesByName: {[name: string]: (kit: ContractKit) => Registry} = {
	// Sorted by importance based on TVL.
	"mento":       (kit: ContractKit) => new RegistryMento(kit),
	"curve":       mainnetRegistryCurve,
	"uniswap-v3":  mainnetRegistryUniswapV3,
	"moola-v2":    mainnetRegistryMoolaV2,
	"stcelo":      mainnetRegistryStCelo,
	"ubeswap":     mainnetRegistryUbeswap,
	"sushiswap":   mainnetRegistrySushiswap,
	"mobius":      mainnetRegistryMobius,
	"misc":        mainnetRegistryMisc,

	// DEPRECATED stuff:
	"savingscelo": mainnetRegistrySavingsCELO,
	"moola":       mainnetRegistryMoola,
	"celodex":     mainnetRegistryCeloDex,
	"symmetric":   mainnetRegistrySymmetric,
}
