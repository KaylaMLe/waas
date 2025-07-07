import { jest } from '@jest/globals';
import { searchForJobs } from '../core/jobSearch';
import { PageHandler } from '../classes/PageHandler';
import * as utils from '../utils/utils';
import * as parseUtils from '../utils/parseUtils';

// Mock dependencies
jest.mock('../logger', () => ({
	log: jest.fn(),
}));

jest.mock('../utils', () => ({
	consolePrompt: jest.fn(),
	waitTime: jest.fn(),
}));

jest.mock('../parseUtils', () => ({
	filterJobLinks: jest.fn(),
}));

jest.mock('../classes/PageHandler', () => {
	return {
		PageHandler: jest.fn().mockImplementation(() => ({
			openUrl: jest.fn(),
			getMostRecentPage: jest.fn().mockReturnValue({
				evaluate: jest.fn(),
				waitForFunction: jest.fn(),
			}),
		})),
	};
});

describe('jobSearch', () => {
	let mockPageHandler: any;
	let mockPage: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockPage = {
			evaluate: jest.fn(),
			waitForFunction: jest.fn(),
		};
		mockPageHandler = {
			openUrl: jest.fn(),
			getMostRecentPage: jest.fn().mockReturnValue(mockPage),
		};
	});

	describe('searchForJobs', () => {
		it('should return empty object if page fails to open', async () => {
			mockPageHandler.openUrl.mockResolvedValueOnce(false);

			const result = await searchForJobs(mockPageHandler);

			expect(result).toEqual({});
		});

		it('should use default search URL when SEARCH_URL is not set', async () => {
			const originalEnv = process.env.SEARCH_URL;
			delete process.env.SEARCH_URL;

			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			(parseUtils.filterJobLinks as any).mockResolvedValue({});

			await searchForJobs(mockPageHandler);

			expect(mockPageHandler.openUrl).toHaveBeenCalledWith('https://www.workatastartup.com/companies');

			// Restore environment
			if (originalEnv) {
				process.env.SEARCH_URL = originalEnv;
			}
		});

		it('should use SEARCH_URL from environment when set', async () => {
			const originalEnv = process.env.SEARCH_URL;
			process.env.SEARCH_URL = 'https://custom-search-url.com';

			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			(parseUtils.filterJobLinks as any).mockResolvedValue({});

			await searchForJobs(mockPageHandler);

			expect(mockPageHandler.openUrl).toHaveBeenCalledWith('https://custom-search-url.com');

			// Restore environment
			if (originalEnv) {
				process.env.SEARCH_URL = originalEnv;
			} else {
				delete process.env.SEARCH_URL;
			}
		});

		it('should handle infinite scroll count', async () => {
			const originalEnv = process.env.SCROLL_COUNT;
			process.env.SCROLL_COUNT = 'inf';

			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			mockPage.evaluate.mockResolvedValueOnce(false); // No loading indicator
			(parseUtils.filterJobLinks as any).mockResolvedValue({});

			await searchForJobs(mockPageHandler);

			expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function));

			// Restore environment
			if (originalEnv) {
				process.env.SCROLL_COUNT = originalEnv;
			} else {
				delete process.env.SCROLL_COUNT;
			}
		});

		it('should return job links from filterJobLinks', async () => {
			const mockJobLinks = { 'Company A': ['job1.com', 'job2.com'] };

			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			mockPage.evaluate.mockResolvedValueOnce(false); // No loading indicator
			(parseUtils.filterJobLinks as any).mockResolvedValue(mockJobLinks);

			const result = await searchForJobs(mockPageHandler);

			expect(result).toEqual(mockJobLinks);
			expect(parseUtils.filterJobLinks).toHaveBeenCalledWith(mockPage);
		});

		it('should handle scroll count of 0', async () => {
			const originalEnv = process.env.SCROLL_COUNT;
			process.env.SCROLL_COUNT = '0';

			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			(parseUtils.filterJobLinks as any).mockResolvedValue({});

			await searchForJobs(mockPageHandler);

			// Should not call scroll-related functions
			expect(mockPage.evaluate).not.toHaveBeenCalledWith(expect.stringContaining('loading'));

			// Restore environment
			if (originalEnv) {
				process.env.SCROLL_COUNT = originalEnv;
			} else {
				delete process.env.SCROLL_COUNT;
			}
		});

		it('should break early if loading indicator disappears immediately', async () => {
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			// First call: loading indicator not present
			mockPage.evaluate.mockResolvedValueOnce(false);
			(parseUtils.filterJobLinks as any).mockResolvedValue({});
			process.env.SCROLL_COUNT = '2';

			await searchForJobs(mockPageHandler);

			// Should only call evaluate once for loading indicator
			expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function));
		});

		it('should handle scroll height increase and continue scrolling', async () => {
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			// 1st: loading present, 2nd: scrollHeight, 3rd: scroll action, 4th: loading present, 5th: scrollHeight, 6th: scroll action, 7th: loading gone
			mockPage.evaluate
				.mockResolvedValueOnce(true) // loading present
				.mockResolvedValueOnce(1000) // scrollHeightBefore
				.mockResolvedValueOnce(undefined) // scroll action
				.mockResolvedValueOnce(true) // loading present again
				.mockResolvedValueOnce(1200) // scrollHeightBefore
				.mockResolvedValueOnce(undefined) // scroll action
				.mockResolvedValueOnce(false); // loading gone
			// waitForFunction: height increases both times
			mockPage.waitForFunction.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
			(parseUtils.filterJobLinks as any).mockResolvedValue({});
			process.env.SCROLL_COUNT = '3';

			await searchForJobs(mockPageHandler);

			// Should have scrolled twice before loading disappears
			expect(mockPage.waitForFunction).toHaveBeenCalledTimes(2);
		});

		it('should break if scroll height does not increase', async () => {
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			// 1st: loading present, 2nd: scrollHeight, 3rd: scroll action
			mockPage.evaluate
				.mockResolvedValueOnce(true) // loading present
				.mockResolvedValueOnce(1000) // scrollHeightBefore
				.mockResolvedValueOnce(undefined); // scroll action
			// waitForFunction: height does not increase
			mockPage.waitForFunction.mockRejectedValueOnce(new Error('timeout'));
			(parseUtils.filterJobLinks as any).mockResolvedValue({});
			process.env.SCROLL_COUNT = '2';

			await searchForJobs(mockPageHandler);

			// Should break after first failed height increase
			expect(mockPage.waitForFunction).toHaveBeenCalledTimes(1);
		});

		it('should handle infinite scroll (SCROLL_COUNT=inf) and break when loading gone', async () => {
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			// Simulate 3 scrolls, then loading gone
			mockPage.evaluate
				.mockResolvedValueOnce(true) // loading present
				.mockResolvedValueOnce(1000) // scrollHeightBefore
				.mockResolvedValueOnce(undefined) // scroll action
				.mockResolvedValueOnce(true) // loading present again
				.mockResolvedValueOnce(1200) // scrollHeightBefore
				.mockResolvedValueOnce(undefined) // scroll action
				.mockResolvedValueOnce(true) // loading present again
				.mockResolvedValueOnce(1400) // scrollHeightBefore
				.mockResolvedValueOnce(undefined) // scroll action
				.mockResolvedValueOnce(false); // loading gone
			mockPage.waitForFunction.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(true);
			(parseUtils.filterJobLinks as any).mockResolvedValue({});
			process.env.SCROLL_COUNT = 'inf';

			await searchForJobs(mockPageHandler);

			// Should have scrolled three times before loading disappears
			expect(mockPage.waitForFunction).toHaveBeenCalledTimes(3);
		});
	});
});
