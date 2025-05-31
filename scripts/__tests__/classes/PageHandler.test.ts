import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '../../logger';
import { PageHandler } from '../../classes/PageHandler';

jest.mock('puppeteer', () => {
	const actual = jest.requireActual('puppeteer');
	return {
		...actual,
		launch: jest.fn(),
	};
});
jest.mock('../../logger', () => ({
	log: jest.fn(),
}));

describe('PageHandler', () => {
	let pageHandler: PageHandler;
	let mockBrowser: jest.Mocked<Browser>;
	let mockPage: jest.Mocked<Page>;

	beforeEach(() => {
		mockPage = {
			goto: jest.fn(),
			close: jest.fn(),
			evaluate: jest.fn(),
			content: jest.fn(),
			waitForSelector: jest.fn(),
			waitForFunction: jest.fn(),
		} as unknown as jest.Mocked<Page>;

		mockBrowser = {
			newPage: jest.fn().mockResolvedValue(mockPage),
			close: jest.fn(),
		} as unknown as jest.Mocked<Browser>;

		(puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
		pageHandler = new PageHandler(true, mockBrowser);
	});

	afterEach(async () => {
		jest.clearAllMocks();

		if (pageHandler) {
			await pageHandler.closeBrowser();
		}
	});

	test('should initialize with an existing browser instance', async () => {
		const customBrowser = mockBrowser;
		const handler = new PageHandler(true, customBrowser);

		await handler['browserLoading'];
		expect(handler['browser']).toBe(customBrowser);
	});

	test('should handle errors in init method', async () => {
		(puppeteer.launch as jest.Mock).mockRejectedValue(new Error('Launch error'));
		const handler = new PageHandler();

		await expect(handler['browserLoading']).resolves.toBe(false);
		expect(logger.log).toHaveBeenCalledWith('error', expect.stringContaining('Failed to initialize browser'));
	});

	test('should handle errors when creating a new page', async () => {
		mockBrowser.newPage.mockRejectedValue(new Error('New page error'));

		const result = await pageHandler.openUrl('https://example.com');

		expect(result).toBe(false);
		expect(logger.log).toHaveBeenCalledWith('error', '⚠️ Failed to create a new page:', expect.any(Error));
	});

	test('should relaunch the browser with a new headless mode', async () => {
		await pageHandler.relaunchBrowser(false);

		expect(mockBrowser.close).toHaveBeenCalled();
		expect(puppeteer.launch).toHaveBeenCalledWith({ headless: false });
	});

	test('should return false if browser fails to load', async () => {
		(puppeteer.launch as jest.Mock).mockRejectedValueOnce(new Error('fail'));
		const handler = new PageHandler();
		handler['browserLoading'] = Promise.resolve(false); // Simulate load failure

		const result = await handler.openUrl('https://example.com');
		expect(result).toBe(false);
		expect(logger.log).toHaveBeenCalledWith('error', '⚠️ Browser is not initialized or failed to load.');
	});

	test('openUrl successfully opens a page and returns true', async () => {
		const result = await pageHandler.openUrl('https://example.com');

		expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', { waitUntil: 'domcontentloaded' });
		expect(pageHandler['pages']).toContain(mockPage);
		expect(result).toBe(true);
	});

	test('should handle error in page.goto()', async () => {
		mockPage.goto.mockRejectedValueOnce(new Error('goto failed'));
		const result = await pageHandler.openUrl('https://example.com');

		expect(result).toBe(false);
		expect(mockPage.close).toHaveBeenCalled();
		expect(logger.log).toHaveBeenCalledWith('error', '❌ Failed to open URL:', expect.any(Error));
	});

	test('closeMostRecentPage closes a page if present, does nothing if not', async () => {
		// Case: one page exists
		pageHandler['pages'] = [mockPage];
		await pageHandler.closeMostRecentPage();
		expect(mockPage.close).toHaveBeenCalled();
		expect(pageHandler['pages'].length).toBe(0);

		// Case: no pages left
		await expect(pageHandler.closeMostRecentPage()).resolves.not.toThrow();
	});

	test('getMostRecentPage returns the last page if pages exist', () => {
		pageHandler['pages'] = [mockPage];
		const result = pageHandler.getMostRecentPage();

		expect(result).toBe(mockPage);
	});
});
