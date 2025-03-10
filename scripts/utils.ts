export async function waitTime(rangeMin: number = 20, rangeMax: number = 30): Promise<void> {
	const rangeDiff = rangeMax - rangeMin;

	if (rangeDiff < 0) {
		console.log('❌ rangeMin is greater than rangeMax');
		return;
	}

	const seconds = Math.floor(Math.random() * (rangeDiff + 1)) + rangeMin;
	console.log(`⏳ Waiting for ${seconds} seconds...`);
	await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
