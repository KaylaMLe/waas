import { createInterface } from 'readline';

import Company from './classes/Company.js';

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
		console.log('❌ rangeMin is greater than rangeMax. Skipping this wait.\n');
		return;
	}

	const seconds = Math.floor(Math.random() * (rangeDiff + 1)) + rangeMin;
	console.log(`⏳ Waiting for ${seconds} seconds...\n`);
	await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Prompts the user for input in the console and returns the trimmed response.
 * 
 * @param prompt - The prompt to display to the user.
 * @returns A promise that resolves to the user's input, trimmed of whitespace.
 */
export async function consolePrompt(prompt: string): Promise<string> {
	const answer = await new Promise<string>((resolve) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		rl.question(prompt,
			(answer: string) => {
				rl.close();
				resolve(answer.trim());
			}
		);
	});

	return answer;
}

/**
 * Loads the environment variable of the login credentials
 * 
 * @returns An array with username and password. If either credential is not found, null is returned.
 */
export function loadLogin(): string[] | null {
	const userName = process.env.YCUSER;

	if (!userName) {
		console.log('⚠️ No username (YCUSER) found in environment variables.');
		return null;
	}

	const password = process.env.YCPSWD;

	if (!password) {
		console.log('⚠️ No password (YCPSWD) found in environment variables.');
		return null;
	}

	return [userName, password];
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
