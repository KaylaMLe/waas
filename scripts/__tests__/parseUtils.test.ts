import puppeteer, { Browser, Page } from 'puppeteer';
import { PageHandler } from '../classes/PageHandler';
import {
	getJobLinks,
	findDivByIdPrefix,
	findBtnByTxt,
} from '../parseUtils';

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
		pageHandler = new PageHandler(true, browser); // Initialize PageHandler with the browser instance
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