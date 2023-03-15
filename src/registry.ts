import { Address, Pair } from "./pair";

export abstract class Registry {
	private name: string

	constructor(name: string) {
		this.name = name
	}

	public getName(): string {
		return this.name
	}

	// import exchanges type
	public abstract findPairs(tokenWhitelist: Address[]): Promise<Pair[]>
}
