import puppeteer, { Browser, Page } from 'puppeteer';

import logger from '../../logger';
import { PageHandler } from '../../classes/PageHandler';


jest.mock('puppeteer', () => {
	const actual = jest.requireActual('puppeteer');
	return {
		...actual,
		launch: jest.fn(), // override launch early
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
		pageHandler = new PageHandler(mockBrowser);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	test('should initialize the browser', async () => {
		await pageHandler['browserLoading'];
		expect(pageHandler['browser']).toBe(mockBrowser);
	});

	test('should open a URL successfully', async () => {
		const url = 'https://example.com';
		const result = await pageHandler.openUrl(url);

		expect(mockBrowser.newPage).toHaveBeenCalled();
		expect(mockPage.goto).toHaveBeenCalledWith(url, { waitUntil: 'domcontentloaded' });
		expect(pageHandler.pages).toContain(mockPage);
		expect(result).toBe(true);
	});

	test('should handle errors when opening a URL', async () => {
		const url = 'https://example.com';
		mockPage.goto.mockRejectedValue(new Error('Navigation error'));

		const result = await pageHandler.openUrl(url);

		expect(mockPage.goto).toHaveBeenCalledWith(url, { waitUntil: 'domcontentloaded' });
		expect(mockPage.close).toHaveBeenCalled();
		expect(pageHandler.pages).not.toContain(mockPage);
		expect(result).toBe(false);

		expect(logger.log).toHaveBeenCalledWith(
			'error',
			'❌ Failed to open URL:',
			expect.any(Error)
		);
	});

	test('should return the most recent page', async () => {
		await pageHandler.openUrl('https://example.com');
		const recentPage = pageHandler.getMostRecentPage();

		expect(recentPage).toBe(mockPage);
	});

	test('should close the most recent page', async () => {
		await pageHandler.openUrl('https://example.com');
		await pageHandler.closeMostRecentPage();

		expect(mockPage.close).toHaveBeenCalled();
		expect(pageHandler.pages).not.toContain(mockPage);
	});

	test('should close all pages and the browser', async () => {
		await pageHandler.openUrl('https://example.com');
		await pageHandler.closeBrowser();

		expect(mockPage.close).toHaveBeenCalled();
		expect(mockBrowser.close).toHaveBeenCalled();
		expect(pageHandler.pages).toHaveLength(0);
		expect(pageHandler['browser']).toBeNull();
	});

	test('should return false if the browser is not yet loaded', async () => {
		pageHandler['browserLoading'] = new Promise(() => { }); // Never resolves

		const url = 'https://example.com';
		const result = await pageHandler.openUrl(url);

		expect(result).toBe(false);
		expect(logger.log).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('⚠️ Browser is not initialized or failed to load.')
		);
	});
});
