import Web3 from "web3"
import { ContractKit, CeloContract } from "@celo/contractkit";
import { Mento } from "@mento-protocol/mento-sdk";
import { providers } from "ethers";
import { Registry } from "../registry";
import { PairMentoV2 } from "../pairs/mento-v2";
import { Address } from "../pair";
import { newIBroker } from "../../types/web3-v1-contracts/IBroker"

export class RegistryMentoV2 extends Registry {

  constructor(private kit: ContractKit) {
    super("mento-v2");
  }

  findPairsWithoutInitialzing = async (tokenWhitelist: Address[]) => {
    const chainId = await this.kit.web3.eth.getChainId();
    const sortedOracelsAddress = await this.kit.registry.addressFor(CeloContract.SortedOracles)
    const mento = await Mento.create(new providers.Web3Provider(this.kit.web3.currentProvider as any));
    const brokerAddr = (await mento.getBroker()).address
    const broker = newIBroker(this.kit.web3 as any, brokerAddr)
    const reserveAddr = await broker.methods.reserve().call()

    const exchanges = (await mento.getExchanges()).filter(
      (e) => e.assets.every((asset) => tokenWhitelist.indexOf(asset) >= 0))
    const pairs: PairMentoV2[] = []
    for (const exchange of exchanges) {
      // NOTE(zviad): There is a really weird race conditiong somewhere between: ContractKit/Ethers/Mento when
      // using direct IPC. To avoid these race conditions, just create separate `mento` instances for each Pair.
      const mento_ = await Mento.create(new providers.Web3Provider(this.kit.web3.currentProvider as any));
      const pair = new PairMentoV2(chainId, this.kit.web3 as unknown as Web3, mento_, exchange, sortedOracelsAddress, reserveAddr)
      pairs.push(pair)
    }
    return pairs
  }
}
