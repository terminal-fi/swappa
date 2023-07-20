const EVENTS_FETCH_BATCH_SIZE_MIN = 100
const EVENTS_FETCH_BATCH_SIZE_MAX = 1_000_000
const EVENTS_FETCH_TARGET_MS = 2_000

export async function fetchEvents<T>(
	fetchF: (fromBlock: number, toBlock: number) => Promise<T[]>,
	fromBlock: number,
	endBlock: number,
	fetchCb?: (fromBlock: number, toBlock:number, events: T[]) => void,
	consolePrefix?: string,
	): Promise<T[]> {

	let batchSize = EVENTS_FETCH_BATCH_SIZE_MIN
	const r: T[] = []
	while (fromBlock < endBlock) {
		const toBlock = Math.min(fromBlock + batchSize - 1, endBlock)
		const fetchT0 = Date.now()
		try {
			const batchR = await fetchF(fromBlock, toBlock)
			r.push(...batchR)
			if (fetchCb) {
				fetchCb(fromBlock, toBlock, batchR)
			}
			const fetchMs = Date.now() - fetchT0
			if (fetchMs > EVENTS_FETCH_TARGET_MS * 2 || fetchMs < EVENTS_FETCH_TARGET_MS / 2) {
				const batchSizeMX =
					Math.max(Math.min(EVENTS_FETCH_TARGET_MS / fetchMs, 10), 1/10)
				batchSize = Math.min(
					EVENTS_FETCH_BATCH_SIZE_MAX,
					Math.max(EVENTS_FETCH_BATCH_SIZE_MIN, Math.floor(batchSize * batchSizeMX)))
			}
			if (consolePrefix) {
				console.info(`${consolePrefix}: fetched: ${fromBlock}...${toBlock}, events: ${batchR.length}, elapsed: ${fetchMs}ms...`)
			}
			fromBlock = toBlock + 1
		} catch (e) {
			batchSize = EVENTS_FETCH_BATCH_SIZE_MIN
			if (consolePrefix) {
				const fetchMs = Date.now() - fetchT0
				console.warn(`${consolePrefix}: fetch error: ${fromBlock}...${toBlock}, elapsed: ${fetchMs}ms, ${e}...`)
			}
		}
	}
	return r
}
