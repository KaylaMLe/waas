import { ElementHandle, Page } from 'puppeteer';

import logger from './logger.js';
import { consolePrompt, waitTime } from './utils.js';
import { PageHandler } from './classes/PageHandler.js';

/**
 * Retrieves all job links from the page by parsing anchor tags with hrefs starting with a specific URL pattern.
 * 
 * @param pageHandler - An instance of PageHandler to manage Puppeteer pages.
 * @returns A promise that resolves to an array of job link URLs.
 */
export async function getJobLinks(pageHandler: PageHandler): Promise<string[]> {
	if (!process.env.SEARCH_URL) {
		logger.log('warn', '❌ No SEARCH_URL found in environment variables.');
		await consolePrompt('🔵 Press CTRL + C to quit or any key to use the default search URL.');
	}

	const searchUrl = process.env.SEARCH_URL || 'https://www.workatastartup.com/companies';
	const searchPageOpened = await pageHandler.openUrl(searchUrl);

	if (!searchPageOpened) {
		return [];
	}

	await waitTime();

	// Scroll to the bottom of the page to load all job listings
	const page = pageHandler.getMostRecentPage();
	await page.evaluate(async () => {
		await new Promise<void>((resolve) => {
			let totalHeight = 0;
			const distance = 500;
			const timer = setInterval(() => {
				const scrollHeight = document.body.scrollHeight;
				window.scrollBy(0, distance);
				totalHeight += distance;
				if (totalHeight >= scrollHeight) {
					clearInterval(timer);
					resolve();
				}
			}, 200);
		});
	});
	// Optionally wait a bit for dynamic content to load
	await new Promise(r => setTimeout(r, 1000));

	const jobLinks = await page.evaluate(() => {
		const jobDivs = Array.from(document.querySelectorAll('div.job-name'));
		const anchors = jobDivs.flatMap(div =>
			Array.from(div.querySelectorAll('a[href^="https://www.workatastartup.com/jobs/"]'))
		);
		return anchors.map(anchor => anchor.getAttribute('href'));
	}) as string[];

	if (jobLinks.length > 0) {
		logger.log('info', `✅ Found ${jobLinks.length} job links.\n`);
	} else {
		logger.log('error', '⚠️ No job links found.');
	}

	return jobLinks;
}

/**
 * Parses all the divs in the page for a div with an ID beginning with the input string.
 * 
 * @param page - The Puppeteer page object to search within.
 * @param idPrefix - The prefix of the ID to search for.
 * @returns A promise that resolves to the div if found, or null if not found.
 */
export async function findDivByIdPrefix(page: Page, idPrefix: string): Promise<ElementHandle<HTMLDivElement> | null> {
	try {
		const divElement = await page.$(`div[id^="${idPrefix}"]`);

		if (divElement) {
			logger.log('debug', `✅ Found div element with ID starting with: "${idPrefix}"\n`);
			return divElement;
		} else {
			logger.log('warn', `❌ No div element found with ID starting with: "${idPrefix}"\n`);
			return null;
		}
	} catch (error) {
		logger.log('error', `⚠️ Unexpected error: ${error}`);
		return null;
	}
}

export async function findBtnByTxt(page: Page, innerText: string): Promise<ElementHandle<HTMLButtonElement> | null> {
	try {
		const btnElement = await page.evaluateHandle((text) => {
			return Array.from(document.querySelectorAll('button')).find(btn => btn.textContent?.trim() === text);
		}, innerText);

		if (btnElement instanceof ElementHandle) {
			logger.log('debug', `✅ Found button element with text: "${innerText}"\n`);
			return btnElement;
		} else {
			logger.log('warn', `❌ No button element found with text: "${innerText}"\n`);
			return null;
		}
	} catch (error) {
		logger.log('error', `⚠️ Error: ${error}`);
		return null;
	}
}
