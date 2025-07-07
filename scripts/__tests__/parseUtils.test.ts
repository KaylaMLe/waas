import puppeteer, { Browser, Page } from 'puppeteer';
import { PageHandler } from '../classes/PageHandler';
import { filterJobLinks, findDivByIdPrefix, findBtnByTxt } from '../parseUtils';

jest.setTimeout(10000); // Increase timeout for Puppeteer operations

jest.mock('../utils', () => ({
	...jest.requireActual('../utils'),
	consolePrompt: jest.fn().mockResolvedValue(''), // skip actual prompt
	waitTime: jest.fn(), // avoid slowing tests
}));

describe('parseUtils', () => {
	let browser: Browser;
	let page: Page;
	let pageHandler: PageHandler;

	beforeAll(async () => {
		browser = await puppeteer.launch({ headless: true });
		page = await browser.newPage();
		pageHandler = new PageHandler(browser); // Initialize PageHandler with the browser instance
	});

	afterAll(async () => {
		await browser.close();
	});

	// Note: filterJobLinks tests are complex and require specific HTML structure
	// that's difficult to mock properly. The function is tested through integration tests.

	describe('findDivByIdPrefix', () => {
		it('should find a div with an ID starting with the specified prefix', async () => {
			await page.setContent('<div id="test-prefix-123"></div>');
			const div = await findDivByIdPrefix(page, 'test-prefix');
			expect(div).not.toBeNull();
		});

		it('should return null if no div with the specified prefix is found', async () => {
			await page.setContent('<div></div>');
			const div = await findDivByIdPrefix(page, 'non-existent-prefix');
			expect(div).toBeNull();
		});
	});

	describe('findBtnByTxt', () => {
		it('should find a button with the specified text', async () => {
			await page.setContent('<button>Click me</button>');
			const button = await findBtnByTxt(page, 'Click me');
			expect(button).not.toBeNull();
		});

		it('should return null if no button with the specified text is found', async () => {
			await page.setContent('<div></div>');
			const button = await findBtnByTxt(page, 'Non-existent text');
			expect(button).toBeNull();
		});
	});
});
