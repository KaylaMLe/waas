import puppeteer, { Browser, Page } from 'puppeteer';

export class PageHandler {
	private browser: Browser | null = null;
	private browserLoading: Promise<void> | null = null;
	public pages: Page[] = [];

	// start launching browser
	constructor() {
		this.browserLoading = this.init();
	}

	private async init() {
		this.browser = await puppeteer.launch({ headless: true });
	}

	/**
	 * opens the specified URL in a headless browser and stores it in the pages array
	 * 
	 * @param {string} url - the URL to open
	 * @returns {Promise<boolean>} - a promise that resolves to true if the URL was opened successfully, false otherwise
	 */

	public async openUrl(url: string): Promise<boolean> {
		await this.browserLoading; // Wait for the browser to initialize

		if (!this.browser) {
			console.error('❌ Browser is not initialized.');
			return false;
		}

		const page = await this.browser.newPage();

		try {
			console.log(`🔵 Opening ${url}...`);
			await page.goto(url, { waitUntil: 'domcontentloaded' });
			this.pages.push(page);

			console.log('✅ Page opened successfully.');
			return true;
		} catch (error) {
			console.error('⚠️ Error:', error);
			await page.close();

			return false;
		}
	}

	public async closePage(index: number): Promise<void> {
		if (this.pages[index]) {
			await this.pages[index].close();
			this.pages.splice(index, 1);
		}
	}

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
