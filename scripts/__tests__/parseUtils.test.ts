import puppeteer, { Browser, Page } from 'puppeteer';
import { PageHandler } from '../classes/PageHandler';
import { getJobLinks, findDivByIdPrefix, findBtnByTxt } from '../parseUtils';

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

	describe('getJobLinks', () => {
		it('should return all job links on the page', async () => {
			// Mock opening a URL in PageHandler
			jest.spyOn(pageHandler, 'openUrl').mockResolvedValue(true);
			jest.spyOn(pageHandler, 'getMostRecentPage').mockReturnValue(page);

			await page.setContent(`
        <div class="job-name">
          <a href="https://www.workatastartup.com/jobs/1">Job 1</a>
          <a href="https://www.workatastartup.com/jobs/2">Job 2</a>
        </div>
      `);

			const links = await getJobLinks(pageHandler);
			expect(links).toEqual([
				'https://www.workatastartup.com/jobs/1',
				'https://www.workatastartup.com/jobs/2',
			]);
		});

		it('should return an empty array if no job links are found', async () => {
			// Mock opening a URL in PageHandler
			jest.spyOn(pageHandler, 'openUrl').mockResolvedValue(true);
			jest.spyOn(pageHandler, 'getMostRecentPage').mockReturnValue(page);

			await page.setContent('<div></div>');
			const links = await getJobLinks(pageHandler);
			expect(links).toEqual([]);
		});

		it('should scroll to the bottom before extracting job links', async () => {
			process.env.SCROLL_COUNT = '2'; // Ensure scrolling is triggered

			jest.spyOn(pageHandler, 'openUrl').mockResolvedValue(true);
			jest.spyOn(pageHandler, 'getMostRecentPage').mockReturnValue(page);

			// Mock waitForFunction to simulate scroll height increasing
			page.waitForFunction = jest.fn().mockResolvedValue(true);

			const evaluateMock = jest.spyOn(page, 'evaluate');
			evaluateMock
				.mockImplementationOnce(async () => true) // loading indicator present (first iteration)
				.mockImplementationOnce(async () => 1000) // scroll height before (first iteration)
				.mockImplementationOnce(async () => undefined) // scroll to loading indicator (first iteration)
				.mockImplementationOnce(async () => true) // loading indicator present (second iteration)
				.mockImplementationOnce(async () => 1500) // scroll height before (second iteration)
				.mockImplementationOnce(async () => undefined) // scroll to loading indicator (second iteration)
				.mockImplementationOnce(async () => [
					'https://www.workatastartup.com/jobs/1',
					'https://www.workatastartup.com/jobs/2',
				]); // extract job links

			const links = await getJobLinks(pageHandler);
			expect(links).toEqual([
				'https://www.workatastartup.com/jobs/1',
				'https://www.workatastartup.com/jobs/2',
			]);
			expect(evaluateMock).toHaveBeenCalledTimes(7); // 6 scroll-related + 1 extraction

			// Check that scroll calls contain the loading indicator logic
			const scrollCall1 = evaluateMock.mock.calls[2][0].toString(); // First scroll call
			const scrollCall2 = evaluateMock.mock.calls[5][0].toString(); // Second scroll call
			expect(scrollCall1).toMatch(
				/querySelector|getBoundingClientRect|scrollBy/
			);
			expect(scrollCall2).toMatch(
				/querySelector|getBoundingClientRect|scrollBy/
			);
		});

		it('should scroll infinitely until no more results when SCROLL_COUNT is "inf"', async () => {
			process.env.SCROLL_COUNT = 'inf'; // Test infinite scrolling

			jest.spyOn(pageHandler, 'openUrl').mockResolvedValue(true);
			jest.spyOn(pageHandler, 'getMostRecentPage').mockReturnValue(page);

			// Mock waitForFunction to always resolve (scroll height always increases when loading indicator is present)
			page.waitForFunction = jest.fn().mockResolvedValue(true);

			const evaluateMock = jest.spyOn(page, 'evaluate');
			evaluateMock
				.mockImplementationOnce(async () => true) // loading indicator present (first iteration)
				.mockImplementationOnce(async () => 1000) // scroll height before (first iteration)
				.mockImplementationOnce(async () => undefined) // scroll to loading indicator (first iteration)
				.mockImplementationOnce(async () => true) // loading indicator present (second iteration)
				.mockImplementationOnce(async () => 1500) // scroll height before (second iteration)
				.mockImplementationOnce(async () => undefined) // scroll to loading indicator (second iteration)
				.mockImplementationOnce(async () => false) // loading indicator no longer present (third iteration - should break)
				.mockImplementationOnce(async () => [
					'https://www.workatastartup.com/jobs/1',
					'https://www.workatastartup.com/jobs/2',
				]); // extract job links

			const links = await getJobLinks(pageHandler);
			expect(links).toEqual([
				'https://www.workatastartup.com/jobs/1',
				'https://www.workatastartup.com/jobs/2',
			]);

			// Verify that evaluate was called at least once for loading indicator check
			expect(evaluateMock).toHaveBeenCalled();

			// Verify that the function eventually called the job links extraction
			const jobLinksCall = evaluateMock.mock.calls.find(
				(call) =>
					call[0].toString().includes('querySelectorAll') &&
					call[0].toString().includes('job-name')
			);
			expect(jobLinksCall).toBeDefined();
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
