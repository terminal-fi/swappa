import Web3 from "web3";
import { ContractKit } from "@celo/contractkit";
import { SavingsCELOAddressMainnet } from "@terminal-fi/savingscelo";
import { PairSavingsCELO } from "./pairs/savingscelo";
import { PairStableSwap } from "./pairs/stableswap";
import { PairOpenSumSwap } from "./pairs/opensumswap";
import { PairSymmetricSwap } from "./pairs/symmetricswap";
import { RegistryAave } from "./registries/aave";
import { RegistryAaveV2 } from "./registries/aave-v2";
import { RegistryMento } from "./registries/mento";
import { RegistryStatic } from "./registries/static";
import { RegistryUniswapV2 } from "./registries/uniswapv2";
import { RegistryBalancer } from "./registries/balancer";
import { address as registryHelperUniswapV2 } from "../tools/deployed/mainnet.RegistryHelperUniswapV2.addr.json";
import { createCurvePairs } from "./pairs/curve";
import { RegistryUniswapV3 } from "./registries/uniswapv3";

export const mainnetRegistryMoola = (kit: ContractKit) =>
  new RegistryAave("moola", kit, "0x7AAaD5a5fa74Aec83b74C2a098FBC86E17Ce4aEA");
export const mainnetRegistryUbeswap = (kit: ContractKit) =>
  new RegistryUniswapV2(
    "ubeswap",
    kit.web3 as unknown as Web3,
    "0x62d5b84bE28a183aBB507E125B384122D2C25fAE",
    { registryHelperAddr: registryHelperUniswapV2 }
  );
export const mainnetRegistrySushiswap = (kit: ContractKit) =>
  new RegistryUniswapV2(
    "sushiswap",
    kit.web3 as unknown as Web3,
    "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
    { registryHelperAddr: registryHelperUniswapV2 }
  );
export const mainnetRegistryMobius = (kit: ContractKit) => {
  const web3 = kit.web3 as unknown as Web3;
  return new RegistryStatic(
    "mobius",
    web3.eth.getChainId().then((chainId) => [
      // Source: https://github.com/mobiusAMM/mobius-interface/blob/main/src/constants/StablePools.ts
      new PairStableSwap(
        chainId,
        web3,
        "0xC0BA93D4aaf90d39924402162EE4a213300d1d60"
      ), // cUSD <-> wUSDC
      new PairStableSwap(
        chainId,
        web3,
        "0x9F4AdBD0af281C69a582eB2E6fa2A594D4204CAe"
      ), // cUSD <-> atUST
      new PairStableSwap(
        chainId,
        web3,
        "0x9906589Ea8fd27504974b7e8201DF5bBdE986b03"
      ), // cUSD <-> USDCv2
      new PairStableSwap(
        chainId,
        web3,
        "0xF3f65dFe0c8c8f2986da0FEc159ABE6fd4E700B4"
      ), // cUSD <-> DAIv2
      new PairStableSwap(
        chainId,
        web3,
        "0x74ef28D635c6C5800DD3Cd62d4c4f8752DaACB09"
      ), // cETH <-> WETHv2
      new PairStableSwap(
        chainId,
        web3,
        "0xaEFc4e8cF655a182E8346B24c8AbcE45616eE0d2"
      ), // cBTC <-> WBTCv2
      new PairStableSwap(
        chainId,
        web3,
        "0xcCe0d62Ce14FB3e4363Eb92Db37Ff3630836c252"
      ), // cUSD <-> pUSDCv2
      new PairStableSwap(
        chainId,
        web3,
        "0xA5037661989789d0310aC2B796fa78F1B01F195D"
      ), // cUSD <-> USDCv1
      new PairStableSwap(
        chainId,
        web3,
        "0x0986B42F5f9C42FeEef66fC23eba9ea1164C916D"
      ), // cUSD <-> aaUSDC
      new PairStableSwap(
        chainId,
        web3,
        "0xa2F0E57d4cEAcF025E81C76f28b9Ad6E9Fbe8735"
      ), // cUSD <-> pUSDv2
      new PairStableSwap(
        chainId,
        web3,
        "0xFc9e2C63370D8deb3521922a7B2b60f4Cff7e75a"
      ), // CELO <-> pCELOv2
      new PairStableSwap(
        chainId,
        web3,
        "0x23C95678862a229fAC088bd9705622d78130bC3e"
      ), // cEUR <-> pEURv2
      new PairStableSwap(
        chainId,
        web3,
        "0x02Db089fb09Fda92e05e92aFcd41D9AAfE9C7C7C"
      ), // cUSD <-> pUSD
      new PairStableSwap(
        chainId,
        web3,
        "0x63C1914bf00A9b395A2bF89aaDa55A5615A3656e"
      ), // cUSD <-> asUSDC
      new PairStableSwap(
        chainId,
        web3,
        "0x2080AAa167e2225e1FC9923250bA60E19a180Fb2"
      ), // cUSD <-> pUSDC
      new PairStableSwap(
        chainId,
        web3,
        "0x19260b9b573569dDB105780176547875fE9fedA3"
      ), //  BTC <-> WBTC
      new PairStableSwap(
        chainId,
        web3,
        "0xE0F2cc70E52f05eDb383313393d88Df2937DA55a"
      ), // cETH <-> WETH
      new PairStableSwap(
        chainId,
        web3,
        "0xdBF27fD2a702Cc02ac7aCF0aea376db780D53247"
      ), // cUSD <-> cUSDT
      new PairStableSwap(
        chainId,
        web3,
        "0x0ff04189Ef135b6541E56f7C638489De92E9c778"
      ), // cUSD <-> bUSDC
      new PairStableSwap(
        chainId,
        web3,
        "0x413FfCc28e6cDDE7e93625Ef4742810fE9738578"
      ), // CELO <-> pCELO
      new PairStableSwap(
        chainId,
        web3,
        "0x382Ed834c6b7dBD10E4798B08889eaEd1455E820"
      ), // cEUR <-> pEUR
    ])
  );
};
export const mainnetRegistryMisc = (kit: ContractKit) => {
  const web3 = kit.web3 as unknown as Web3;
  return new RegistryStatic(
    "misc",
    web3.eth.getChainId().then((chainId) => [
      // Optics V1 <-> V2 migration
      new PairOpenSumSwap(
        chainId,
        web3,
        "0xb1a0BDe36341065cA916c9f5619aCA82A43659A3"
      ), // wETH <-> wETHv2
      new PairOpenSumSwap(
        chainId,
        web3,
        "0xd5ab1BA8b2Ec70752068d1d728e728eAd0E19CBA"
      ), // wBTC <-> wBTCv2
      new PairOpenSumSwap(
        chainId,
        web3,
        "0x70bfA1C8Ab4e42B9BE74f65941EFb6e5308148c7"
      ), // USDC <-> USDCv2
      // Symmetric V1 <-> V2 migration
      new PairSymmetricSwap(
        chainId,
        web3,
        "0xF21150EC57c360dA61cE7900dbaFdE9884198026",
        "0x7c64aD5F9804458B8c9F93f7300c15D55956Ac2a",
        "0x8427bD503dd3169cCC9aFF7326c15258Bc305478"
      ),
    ])
  );
};
export const mainnetRegistrySavingsCELO = (kit: ContractKit) =>
  new RegistryStatic(
    "savingscelo",
    kit.web3.eth
      .getChainId()
      .then((chainId) => [
        new PairSavingsCELO(chainId, kit, SavingsCELOAddressMainnet),
      ])
  );
export const mainnetRegistryMoolaV2 = (kit: ContractKit) =>
  new RegistryAaveV2(
    "moola-v2",
    kit.web3 as unknown as Web3,
    "0xD1088091A174d33412a968Fa34Cb67131188B332"
  );
export const mainnetRegistryCeloDex = (kit: ContractKit) =>
  new RegistryUniswapV2(
    "celodex",
    kit.web3 as unknown as Web3,
    "0x31bD38d982ccDf3C2D95aF45a3456d319f0Ee1b6",
    { registryHelperAddr: registryHelperUniswapV2 }
  );
export const mainnetRegistrySymmetric = (kit: ContractKit) =>
  new RegistryBalancer(
    "symmetric",
    kit.web3 as unknown as Web3,
    "0x3E30b138ecc85cD89210e1A19a8603544A917372"
  );
export const mainnetRegistryCurve = (kit: ContractKit) => {
  const web3 = kit.web3 as unknown as Web3;
  const pairs = web3.eth.getChainId().then((chainId) =>
    Promise.all([
      createCurvePairs(
        chainId,
        web3,
        "0xf4cab10dC19695AaCe14b7A16d7705b600ad5F73",
        2
      ), // cUSD <-> USDC
      createCurvePairs(
        chainId,
        web3,
        "0x32fD7e563c6521Ab4D59CE3277bcfBe3317CFd63",
        3
      ), // tripool: cUSD, USDT, USDC
      createCurvePairs(
        chainId,
        web3,
        "0xAF7Ee5Ba02dC9879D24cb16597cd854e13f3aDa8",
        2
      ), // agEUR <-> cEUR
      createCurvePairs(
        chainId,
        web3,
        "0x9Be5da31c7A42d7e045189ac1822D1fA5838e635",
        2
      ), // axlUSDC <-> cUSD
    ]).then((r) => r.flat())
  );
  return new RegistryStatic("curve", pairs);
};
export const mainnetRegistryUniswapV3 = (kit: ContractKit) =>
  new RegistryUniswapV3(
    "uniswap-v3",
    kit.web3 as unknown as Web3,
    "0xAfE208a311B21f13EF87E33A90049fC17A7acDEc",
    {fetchUsingPoolEvents: true},
  );

// mainnetRegistriesWhitelist contains list of more established protocols with
// overall higher TVL.
export const mainnetRegistriesWhitelist = (kit: ContractKit) => [
  new RegistryMento(kit),
  // Uniswap forks:
  mainnetRegistryUbeswap(kit),
  mainnetRegistrySushiswap(kit),
  // Curve forks:
  mainnetRegistryCurve(kit),
  // Stableswap forks:
  mainnetRegistryMobius(kit),
  // Balancer forks:
  mainnetRegistrySymmetric(kit),
  // Direct conversion protocols:
  mainnetRegistryMoola(kit),
  mainnetRegistryMoolaV2(kit),
  mainnetRegistryMisc(kit),
];
