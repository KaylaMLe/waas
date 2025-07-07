import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '../utils/logger.js';
import { withTimeout } from '../utils/utils.js';

export class PageHandler {
	private browser: Browser | null = null;
	private browserLoading: Promise<boolean> | null = null;
	private headless: boolean = false;
	public pages: Page[] = [];

	constructor(browser?: Browser) {
		if (browser) {
			this.browser = browser;
			this.browserLoading = Promise.resolve(true);
			this.headless = true; // run tests in headless mode
		} else {
			this.browserLoading = this.init();
		}
	}

	private async init(): Promise<boolean> {
		try {
			this.browser = await puppeteer.launch({ headless: this.headless });
			return true;
		} catch (error) {
			logger.log('error', `⚠️ Failed to initialize browser: ${error}`);
			return false;
		}
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
			logger.log('info', `🔵 Opening ${url}...`);
			await page.goto(url, { waitUntil: 'domcontentloaded' });
			this.pages.push(page);
			logger.log('info', '✅ Page opened successfully.');
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
		if (page) {
			logger.log('info', '🔵 Closing most recent page...');
			await page.close();
		}
	}

	public async closeBrowser(): Promise<void> {
		logger.log('info', '🔵 Closing all pages and browser...');
		for (const page of this.pages) await page.close();
		if (this.browser) await this.browser.close();
		this.pages = [];
		this.browser = null;
	}
}
