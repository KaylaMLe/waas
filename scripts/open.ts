import puppeteer, { Page } from 'puppeteer';

/**
 * opens the specified URL in a headless browser and returns the page object
 * 
 * @param {string} url - the URL to open
 * @returns {Promise<Page | null>} - a promise that resolves to the page object if successful, or null if an error occurs
 */
export async function openUrl(url: string): Promise<Page | null> {
	const browser = await puppeteer.launch({ headless: true });
	const page = await browser.newPage();

	try {
		console.log(`Opening ${url}...`);
		await page.goto(url, { waitUntil: 'domcontentloaded' });
		return page;
	} catch (error) {
		console.error('⚠️ Error:', error);
		await browser.close();
		return null;
	}
}
