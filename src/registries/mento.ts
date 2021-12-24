import { ContractKit, StableToken } from "@celo/contractkit";
import { concurrentMap } from "@celo/utils/lib/async";

import { Address } from "../pair";
import { PairMento } from "../pairs/mento";
import { initPairsAndFilterByWhitelist } from "../utils";

export class RegistryMento {
  constructor(private kit: ContractKit) {}

  findPairs = async (tokenWhitelist: Address[]) => {
    const cSTBs = await concurrentMap(
      5,
      Object.values(StableToken),
      (stableToken) => {
        return this.kit.contracts
          .getStableToken(stableToken)
          .then((wrapper) => ({
            name: stableToken,
            wrapper: wrapper,
          }));
      }
    );
    const pairs = cSTBs.map((cSTB) => new PairMento(this.kit, cSTB.name));
    return initPairsAndFilterByWhitelist(pairs, tokenWhitelist);
  };
}
