import { Address, Pair } from "./pair";
import { initPairsAndFilterByWhitelist } from "./utils";

export abstract class Registry {
	private name: string

	constructor(name: string) {
		this.name = name
	}

	public getName(): string {
		return this.name
	}

	public async findPairs(tokenWhitelist: Address[]): Promise<Pair[]> {
		const pairs = await this.findPairsWithoutInitialzing(tokenWhitelist)
		return initPairsAndFilterByWhitelist(pairs, tokenWhitelist)
	}
	public abstract findPairsWithoutInitialzing(tokenWhitelist: Address[]): Promise<Pair[]>
}
