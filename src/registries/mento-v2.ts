import Web3 from "web3"
import { ContractKit, CeloContract } from "@celo/contractkit";
import { Mento } from "@mento-protocol/mento-sdk";
import { ethers, providers } from "ethers";
import { Registry } from "../registry";
import { PairMentoV2 } from "../pairs/mento-v2";
import { Address } from "../pair";

export class RegistryMentoV2 extends Registry {

  constructor(private kit: ContractKit) {
    super("mento-v2");
  }

  findPairsWithoutInitialzing = async (tokenWhitelist: Address[]) => {
    const chainId = await this.kit.web3.eth.getChainId();
    const sortedOracelsAddress = await this.kit.registry.addressFor(CeloContract.SortedOracles)
    const mento = await Mento.create(new providers.Web3Provider(this.kit.web3.currentProvider as any));
    const exchanges = (await mento.getExchanges()).filter(
      (e) => e.assets.every((asset) => tokenWhitelist.indexOf(asset) >= 0))
    const pairs: PairMentoV2[] = exchanges.map(
      (exchange) => new PairMentoV2(chainId, this.kit.web3 as unknown as Web3, mento, exchange, sortedOracelsAddress)
    )
    return pairs
  }
}
