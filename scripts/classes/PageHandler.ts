// PageHandler.ts
import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '../logger.js';
import { withTimeout } from '../utils.js';

export class PageHandler {
	private browser: Browser | null = null;
	private browserLoading: Promise<boolean> | null = null;
	public pages: Page[] = [];

	constructor(browser?: Browser) {
		if (browser) {
			this.browser = browser;
			this.browserLoading = Promise.resolve(true);
		} else {
			this.browserLoading = this.init();
		}
	}

	private async init() {
		this.browser = await puppeteer.launch({ headless: true });

		return true;
	}

	public async openUrl(url: string): Promise<boolean> {
		const browserLoaded = await withTimeout(this.browserLoading!, 4000).catch(() => false);
		if (!browserLoaded || !this.browser) {
			logger.log('error', '⚠️ Browser is not initialized or failed to load.');
			return false;
		}

		const page = await this.browser.newPage().catch((error) => {
			logger.log('error', '⚠️ Failed to create a new page:', error);
			return null;
		});

		if (!page) return false;

		try {
			logger.log('debug', `🔵 Opening ${url}...`);
			await page.goto(url, { waitUntil: 'domcontentloaded' });
			this.pages.push(page);
			logger.log('debug', '✅ Page opened successfully.');
			return true;
		} catch (error) {
			logger.log('error', '❌ Failed to open URL:', error);
			await page.close();
			return false;
		}
	}

	public getMostRecentPage(): Page {
		if (this.pages.length === 0) {
			throw new Error('⚠️ No pages are currently open.');
		}

		return this.pages[this.pages.length - 1];
	}

	public async closeMostRecentPage(): Promise<void> {
		const page = this.pages.pop();
		if (page) await page.close();
	}

	public async closeBrowser(): Promise<void> {
		for (const page of this.pages) await page.close();
		if (this.browser) await this.browser.close();
		this.pages = [];
		this.browser = null;
	}
}
