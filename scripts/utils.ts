import Company from './Company';

/**
 * Waits for a random amount of time between rangeMin and rangeMax seconds.
 * 
 * @param rangeMin - The minimum number of seconds to wait (default 20)
 * @param rangeMax - The maximum number of seconds to wait (default 30)
 * @returns A promise that resolves after the wait time has passed.
 */
export async function waitTime(rangeMin: number = 20, rangeMax: number = 30): Promise<void> {
	const rangeDiff = rangeMax - rangeMin;

	if (rangeDiff < 0) {
		console.log('❌ rangeMin is greater than rangeMax. Skipping this wait.');
		return;
	}

	const seconds = Math.floor(Math.random() * (rangeDiff + 1)) + rangeMin;
	console.log(`⏳ Waiting for ${seconds} seconds...`);
	await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Loads the environment variable of companies already applied to
 * 
 * @returns A Record with company names as keys and Company objects as values.
 *          If no companies are found, an empty object is returned.
 */
export function loadApplied(): Record<string, Company> {
	const applied = process.env.APPLIED || '';

	if (applied === '') {
		return {};
	}

	const companyRecords: Record<string, Company> = {};

	applied.split(',').forEach(company => {
		companyRecords[company] = new Company(true);
	});

	return companyRecords;
}
