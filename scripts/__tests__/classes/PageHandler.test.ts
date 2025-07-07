import { jest } from '@jest/globals';
import { Browser, Page } from 'puppeteer';
import logger from '../../utils/logger';

// Mock puppeteer
jest.mock('puppeteer', () => ({
	default: {
		launch: jest.fn(),
	},
}));

// Mock logger
jest.mock('../../utils/logger.js', () => ({
	__esModule: true,
	default: { log: jest.fn() },
}));

// Mock utils
jest.mock('../../utils/utils.js', () => ({
	withTimeout: jest.fn(),
}));

// Import PageHandler after mocks
const { PageHandler } = require('../../classes/PageHandler.js');

// Simple object mocks for Puppeteer Browser and Page
const createMockPage = () => ({
	goto: jest.fn(),
	close: jest.fn(),
	evaluate: jest.fn(),
	content: jest.fn(),
	waitForSelector: jest.fn(),
	waitForFunction: jest.fn(),
});

const createMockBrowser = (mockPage: any) => ({
	newPage: jest.fn(() => Promise.resolve(mockPage)),
	close: jest.fn(),
});

jest.mock('../../utils/logger', () => ({
	log: jest.fn(),
}));

// Remove puppeteer mock, test only PageHandler logic

describe('PageHandler', () => {
	let mockBrowser: any;
	let mockPage: any;
	let mockPuppeteer: any;

	beforeEach(() => {
		jest.clearAllMocks();

		mockPage = {
			goto: jest.fn(),
			close: jest.fn(),
		} as any;

		mockBrowser = {
			newPage: jest.fn(),
			close: jest.fn(),
		} as any;

		mockPuppeteer = require('puppeteer');
		// @ts-ignore
		mockPuppeteer.default.launch = jest.fn().mockResolvedValue(mockBrowser);
		mockBrowser.newPage.mockResolvedValue(mockPage);
	});

	describe('constructor', () => {
		it('should initialize without browser parameter', () => {
			jest.resetModules();
			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler();

			expect(handler).toBeInstanceOf(PageHandler);
			expect(handler['browserLoading']).toBeDefined();
		});

		it('should initialize with browser parameter', () => {
			jest.resetModules();
			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler(mockBrowser as any);

			expect(handler).toBeInstanceOf(PageHandler);
			expect(handler['browser']).toBe(mockBrowser);
			expect(handler['headless']).toBe(true);
		});
	});

	describe('init', () => {
		it('should handle browser initialization failure', async () => {
			jest.resetModules();
			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler();

			// Wait for initialization
			const result = await handler['browserLoading'];

			expect(result).toBe(false);
		});
	});

	describe('openUrl', () => {
		it('should open URL successfully', async () => {
			const { withTimeout } = require('../../utils/utils.js');

			withTimeout.mockResolvedValue(true);

			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler(mockBrowser as any);

			const result = await handler.openUrl('https://example.com');

			expect(result).toBe(true);
			expect(mockBrowser.newPage).toHaveBeenCalled();
			expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', { waitUntil: 'domcontentloaded' });
			expect(handler.pages).toHaveLength(1);
		});

		it('should handle browser not initialized', async () => {
			const { withTimeout } = require('../../utils/utils.js');

			withTimeout.mockResolvedValue(false);

			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler();

			const result = await handler.openUrl('https://example.com');

			expect(result).toBe(false);
		});

		it('should handle page creation failure', async () => {
			const { withTimeout } = require('../../utils/utils.js');

			withTimeout.mockResolvedValue(true);
			// @ts-ignore
			mockBrowser.newPage.mockRejectedValue(new Error('Page creation failed'));

			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler(mockBrowser as any);

			const result = await handler.openUrl('https://example.com');

			expect(result).toBe(false);
		});

		it('should handle URL opening failure', async () => {
			const { withTimeout } = require('../../utils/utils.js');

			withTimeout.mockResolvedValue(true);
			// @ts-ignore
			mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler(mockBrowser as any);

			const result = await handler.openUrl('https://example.com');

			expect(result).toBe(false);
			expect(mockPage.close).toHaveBeenCalled();
		});

		it('should handle timeout during browser loading', async () => {
			const { withTimeout } = require('../../utils/utils.js');

			withTimeout.mockRejectedValue(new Error('Timeout'));

			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler();

			const result = await handler.openUrl('https://example.com');

			expect(result).toBe(false);
		});
	});

	describe('getMostRecentPage', () => {
		it('should return most recent page', () => {
			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler(mockBrowser as any);

			handler.pages = [mockPage, {} as Page];

			const result = handler.getMostRecentPage();

			expect(result).toBe(handler.pages[1]);
		});

		it('should throw error when no pages are open', () => {
			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler(mockBrowser as any);

			handler.pages = [];

			expect(() => handler.getMostRecentPage()).toThrow('⚠️ No pages are currently open.');
		});
	});

	describe('closeMostRecentPage', () => {
		it('should close most recent page', async () => {
			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler(mockBrowser as any);

			handler.pages = [mockPage];

			await handler.closeMostRecentPage();

			expect(mockPage.close).toHaveBeenCalled();
			expect(handler.pages).toHaveLength(0);
		});

		it('should handle no pages to close', async () => {
			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler(mockBrowser as any);

			handler.pages = [];

			await handler.closeMostRecentPage();

			expect(mockPage.close).not.toHaveBeenCalled();
		});
	});

	describe('closeBrowser', () => {
		it('should close all pages and browser', async () => {
			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler(mockBrowser as any);

			const mockPage2 = { close: jest.fn() } as any;
			handler.pages = [mockPage, mockPage2];

			await handler.closeBrowser();

			expect(mockPage.close).toHaveBeenCalled();
			expect(mockPage2.close).toHaveBeenCalled();
			expect(mockBrowser.close).toHaveBeenCalled();
			expect(handler.pages).toHaveLength(0);
			expect(handler['browser']).toBeNull();
		});

		it('should handle no browser to close', async () => {
			const { PageHandler } = require('../../classes/PageHandler.js');
			const handler = new PageHandler();

			handler['browser'] = null;
			handler.pages = [];

			await handler.closeBrowser();

			expect(mockBrowser.close).not.toHaveBeenCalled();
		});
	});
});
