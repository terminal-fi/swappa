export async function fastConcurrentMap<A, B>(
  concurrency: number,
  xs: A[],
  mapFn: (val: A, idx: number) => Promise<B>
): Promise<B[]> {
	let idx = 0
	let res = new Map<number, B>()
	const workerF = async () => {
		while (idx < xs.length) {
			const wIdx = idx
			const w = xs[wIdx]
			idx += 1
			const r = await mapFn(w, wIdx)
			res.set(wIdx, r)
		}
	}
	const r: Promise<void>[] = []
	for (let i = 0; i < concurrency; i += 1) {
		r.push(workerF())
	}
	await Promise.all(r)
	const resAsArray: B[] = []
	for (let i = 0; i < xs.length; i+= 1) {
		resAsArray.push(res.get(i)!)
	}
	return resAsArray
}