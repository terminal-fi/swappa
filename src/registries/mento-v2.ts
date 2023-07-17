import Web3 from "web3"
import { ContractKit, CeloContract } from "@celo/contractkit";
import { Mento } from "@mento-protocol/mento-sdk";
import { ethers, providers } from "ethers";
import { Address } from "../pair";
import { Registry } from "../registry";
import { PairMentoV2 } from "../pairs/mento-v2";
import { initPairsAndFilterByWhitelist } from "../utils";

export class RegistryMentoV2 extends Registry {
  private provider: ethers.providers.Provider;

  constructor(private kit: ContractKit) {
    super("mentoV2");
    this.provider = new providers.Web3Provider(kit.web3.currentProvider as any);
  }

  findPairs = async (tokenWhitelist: Address[]) => {
    const chainId = await this.kit.web3.eth.getChainId();
    const sortedOracelsAddress = await this.kit.registry.addressFor(CeloContract.SortedOracles)
    const mento = await Mento.create(this.provider);
    const exchanges = await mento.getExchanges();
    const pairs: PairMentoV2[] = exchanges.map(
      (exchange) => new PairMentoV2(chainId, this.kit.web3 as unknown as Web3, mento, exchange, sortedOracelsAddress)
    );
    return initPairsAndFilterByWhitelist(pairs, tokenWhitelist);
  };
}