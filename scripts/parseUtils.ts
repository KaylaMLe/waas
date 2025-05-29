import { ElementHandle, Page } from 'puppeteer';

import logger from './logger.js';

/**
 * Parses the page for all anchor tags with hrefs starting with "https://www.workatastartup.com/jobs/"
 * 
 * @param page - The Puppeteer page object to search within.
 * @returns A promise that resolves to an array of job links.
 */
export async function getAllJobLinks(page: Page): Promise<string[]> {
	const jobLinks = await page.evaluate(() => {
		const jobDivs = Array.from(document.querySelectorAll('div.job-name'));
		const anchors = jobDivs.flatMap(div =>
			Array.from(div.querySelectorAll('a[href^="https://www.workatastartup.com/jobs/"]'))
		);
		return anchors.map(anchor => anchor.getAttribute('href'));
	});

	return jobLinks as string[];
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
