import puppeteer, { Browser, Page } from 'puppeteer';

import logger from '../logger.js';

export class PageHandler {
	private browser: Browser | null = null;
	private browserLoading: Promise<void> | null = null;
	public pages: Page[] = [];

	constructor() {
		this.browserLoading = this.init();
	}

	private async init() {
		this.browser = await puppeteer.launch({ headless: true });
	}

	/**
	 * opens the specified URL in a headless browser and stores it in the pages array
	 * 
	 * Pages that are not successfully opened are closed and not stored before returning false.
	 * 
	 * @param url - the URL to open
	 * @returns a promise that resolves to true if the URL was opened successfully, false otherwise
	 */

	public async openUrl(url: string): Promise<boolean> {
		await this.browserLoading;

		if (!this.browser) {
			logger.log('error', '⚠️ Browser is not initialized.');
			return false;
		}

		const page = await this.browser.newPage();

		try {
			logger.log('debug', `🔵 Opening ${url}...`);
			await page.goto(url, { waitUntil: 'domcontentloaded' });
			this.pages.push(page);

			logger.log('debug', '✅ Page opened successfully.');
			return true;
		} catch (error) {
			logger.log('error', '⚠️ Unexpected error:', error);
			await page.close();

			return false;
		}
	}

	public getMostRecentPage(): Page {
		return this.pages[this.pages.length - 1];
	}

	public async closeMostRecentPage(): Promise<void> {
		if (this.pages.length > 0) {
			await this.pages[this.pages.length - 1].close();
			this.pages.pop();
		}
	}

	/**
	 * Closes all open pages and the browser itself.
	 * 
	 * This method ensures that all pages are closed before closing the browser.
	 * It also resets the pages array to an empty state.
	 */
	public async closeBrowser() {
		if (this.pages.length > 0) {
			await Promise.all(this.pages.map(page => page.close()));
			this.pages = [];
		}

		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}
	}
}
