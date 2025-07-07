import puppeteer, { Browser, Page } from 'puppeteer';
import { PageHandler } from '../classes/PageHandler';
import { filterJobLinks, findDivByIdPrefix, findBtnByTxt, checkJobApplicationStatus } from '../utils/parseUtils';

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

	describe('filterJobLinks', () => {
		beforeEach(() => {
			// Reset environment variables
			delete process.env.APPLIED;
		});

		it('should return empty object when no companies are found', async () => {
			await page.setContent('<div class="directory-list"></div>');

			const result = await filterJobLinks(page);

			expect(result).toEqual({});
		});

		it('should handle companies with no job links', async () => {
			await page.setContent(`
				<div class="directory-list">
					<div>
						<a href="/companies/test">
							<span>Test Company</span>
							<span>(W24)</span>
						</a>
					</div>
				</div>
			`);

			const result = await filterJobLinks(page);

			expect(result).toEqual({});
		});

		it('should filter out companies that have already been applied to', async () => {
			process.env.APPLIED = 'Test Company (W24)';

			await page.setContent(`
				<div class="directory-list">
					<div>
						<a href="/companies/test">
							<span>Test Company</span>
							<span>(W24)</span>
						</a>
						<div class="job-name">
							<a href="https://www.workatastartup.com/jobs/123">Job Title</a>
						</div>
					</div>
				</div>
			`);

			const result = await filterJobLinks(page);

			expect(result).toEqual({});
		});

		it('should handle error during evaluation', async () => {
			// Mock page.evaluate to throw an error
			const originalEvaluate = page.evaluate;
			page.evaluate = jest.fn().mockRejectedValue(new Error('Evaluation error'));

			const result = await filterJobLinks(page);

			expect(result).toEqual({});

			// Restore original function
			page.evaluate = originalEvaluate;
		});
	});

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

		it('should handle evaluation errors', async () => {
			// Mock page.$ to throw an error
			const originalQuerySelector = page.$;
			page.$ = jest.fn().mockRejectedValue(new Error('Query error'));

			const div = await findDivByIdPrefix(page, 'test-prefix');
			expect(div).toBeNull();

			// Restore original function
			page.$ = originalQuerySelector;
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

		it('should handle evaluation errors', async () => {
			// Mock page.evaluateHandle to throw an error
			const originalEvaluateHandle = page.evaluateHandle;
			page.evaluateHandle = jest.fn().mockRejectedValue(new Error('Evaluation error'));

			const button = await findBtnByTxt(page, 'Click me');
			expect(button).toBeNull();

			// Restore original function
			page.evaluateHandle = originalEvaluateHandle;
		});

		it('should handle case where evaluateHandle returns non-ElementHandle', async () => {
			// Mock page.evaluateHandle to return null
			const originalEvaluateHandle = page.evaluateHandle;
			page.evaluateHandle = jest.fn().mockResolvedValue(null);

			const button = await findBtnByTxt(page, 'Click me');
			expect(button).toBeNull();

			// Restore original function
			page.evaluateHandle = originalEvaluateHandle;
		});
	});

	describe('checkJobApplicationStatus', () => {
		it('should return true when job has been applied to', async () => {
			await page.setContent('<div id="ApplyButton">Applied</div>');
			const result = await checkJobApplicationStatus(page);
			expect(result).toBe(true);
		});

		it('should return false when job has not been applied to', async () => {
			await page.setContent('<div id="ApplyButton">Apply</div>');
			const result = await checkJobApplicationStatus(page);
			expect(result).toBe(false);
		});

		it('should return false when apply button is not found', async () => {
			await page.setContent('<div></div>');
			const result = await checkJobApplicationStatus(page);
			expect(result).toBe(false);
		});

		it('should handle evaluation errors', async () => {
			// Mock page.evaluate to throw an error
			const originalEvaluate = page.evaluate;
			page.evaluate = jest.fn().mockRejectedValue(new Error('Evaluation error'));

			const result = await checkJobApplicationStatus(page);
			expect(result).toBe(false);

			// Restore original function
			page.evaluate = originalEvaluate;
		});

		it('should handle case where findDivByIdPrefix returns null', async () => {
			// Mock findDivByIdPrefix to return null
			const originalFindDivByIdPrefix = require('../utils/parseUtils').findDivByIdPrefix;
			jest.spyOn(require('../utils/parseUtils'), 'findDivByIdPrefix').mockResolvedValue(null);

			const result = await checkJobApplicationStatus(page);
			expect(result).toBe(false);

			// Restore original function
			jest.restoreAllMocks();
		});
	});
});
