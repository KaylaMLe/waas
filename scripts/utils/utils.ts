import { createInterface } from 'readline';

import logger from './logger.js';
import Company from '../classes/Company.js';

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
		logger.log('error', '⚠️ rangeMin is greater than rangeMax. Skipping this wait.');
		return;
	}

	const seconds = Math.floor(Math.random() * (rangeDiff + 1)) + rangeMin;
	logger.log('info', `⏳ Waiting for ${seconds} seconds...\n`);
	await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * Waits for a fixed duration (no-op if ms is zero or negative).
 *
 * @param ms - Milliseconds to wait
 */
export async function sleepMs(ms: number): Promise<void> {
	if (ms <= 0) return;
	await new Promise((resolve) => setTimeout(resolve, ms));
}

export type WaitOrSkipResult = 'completed' | 'skipped';

/**
 * Waits up to `ms` while the JD page stays open. In an interactive TTY, press **S** to skip
 * this job (same intent as the later approval prompt). Non-TTY (e.g. CI) behaves like {@link sleepMs}.
 */
export async function waitMsOrSkipJob(ms: number): Promise<WaitOrSkipResult> {
	if (ms <= 0) return 'completed';

	if (!process.stdin.isTTY) {
		await sleepMs(ms);
		return 'completed';
	}

	return new Promise<WaitOrSkipResult>((resolve) => {
		let settled = false;
		let timer: NodeJS.Timeout | undefined;

		const cleanup = () => {
			if (timer !== undefined) clearTimeout(timer);
			try {
				if (process.stdin.isTTY) process.stdin.setRawMode(false);
			} catch {
				/* ignore */
			}
			process.stdin.removeListener('data', onData);
		};

		const finish = (result: WaitOrSkipResult) => {
			if (settled) return;
			settled = true;
			cleanup();
			resolve(result);
		};

		const onData = (buf: Buffer) => {
			const code = buf[0];
			if (code === 3) {
				if (settled) return;
				settled = true;
				cleanup();
				process.exit(130);
			}
			const ch = String.fromCharCode(code ?? 0);
			if (ch === 's' || ch === 'S') finish('skipped');
		};

		try {
			process.stdin.setRawMode(true);
		} catch {
			void sleepMs(ms).then(() => finish('completed'));
			return;
		}

		process.stdin.resume();
		process.stdin.on('data', onData);
		timer = setTimeout(() => finish('completed'), ms);
	});
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

		rl.question(prompt, (answer: string) => {
			rl.close();
			resolve(answer.trim());
		});
	});

	return answer;
}

/**
 * Loads the environment variable of companies already applied to and creates Company objects.
 *
 * @returns A Record with company names as keys and Company objects as values.
 *          If no companies are found, an empty object is returned.
 */
export function loadApplied(): Record<string, Company> {
	const applied = process.env.APPLIED || '';

	if (applied === '') {
		logger.log('warn', '❌ No companies (APPLIED) found in environment variables.');
		return {};
	}

	const companyRecords: Record<string, Company> = {};

	applied.split(',').forEach((company) => {
		companyRecords[company] = new Company(true);
	});

	return companyRecords;
}

/**
 * A helper function to add a timeout to a promise.
 * @param promise - The promise to wrap with a timeout.
 * @param ms - The timeout duration in milliseconds.
 * @returns A promise that rejects if the timeout is exceeded.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timeout: NodeJS.Timeout;

	const timeoutPromise = new Promise<T>((_, reject) => {
		timeout = setTimeout(() => {
			reject(new Error(`Operation timed out after ${ms} ms`));
		}, ms);
	});

	return Promise.race([promise.finally(() => clearTimeout(timeout)), timeoutPromise]);
}
