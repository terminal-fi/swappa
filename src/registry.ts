import { Address, Pair } from "./pair";

export interface Registry {
	findPairs: (tokenWhitelist: Address[]) => Promise<Pair[]>
}
