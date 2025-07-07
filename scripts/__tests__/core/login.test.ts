import { jest } from '@jest/globals';
import { loggingIn } from '../../core/login';
import { PageHandler } from '../../classes/PageHandler';
import * as utils from '../../utils/utils';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
	log: jest.fn(),
}));

jest.mock('../../utils/utils', () => ({
	consolePrompt: jest.fn(),
}));

jest.mock('../../classes/PageHandler', () => {
	return {
		PageHandler: jest.fn().mockImplementation(() => ({
			openUrl: jest.fn(),
			getMostRecentPage: jest.fn().mockReturnValue({
				evaluate: jest.fn(),
			}),
			closeMostRecentPage: jest.fn(),
		})),
	};
});

describe('login', () => {
	let mockPageHandler: any;
	let mockPage: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockPage = {
			evaluate: jest.fn(),
		};
		mockPageHandler = {
			openUrl: jest.fn(),
			getMostRecentPage: jest.fn().mockReturnValue(mockPage),
			closeMostRecentPage: jest.fn(),
		};
	});

	describe('loggingIn', () => {
		it('should return true on successful login', async () => {
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			mockPage.evaluate.mockResolvedValueOnce(true); // User is logged in
			(utils.consolePrompt as any).mockResolvedValue(undefined);

			const result = await loggingIn(mockPageHandler);

			expect(result).toBe(true);
			expect(mockPageHandler.openUrl).toHaveBeenCalledWith(
				'https://account.ycombinator.com/?continue=https%3A%2F%2Fwww.workatastartup.com%2F'
			);
			expect(mockPage.evaluate).toHaveBeenCalled();
			expect(mockPageHandler.closeMostRecentPage).toHaveBeenCalled();
		});

		it('should return false if login page fails to open', async () => {
			mockPageHandler.openUrl.mockResolvedValueOnce(false);

			const result = await loggingIn(mockPageHandler);

			expect(result).toBe(false);
		});

		it('should return false if login unsuccessful', async () => {
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			mockPage.evaluate.mockResolvedValueOnce(false); // User is not logged in
			(utils.consolePrompt as any).mockResolvedValue(undefined);

			const result = await loggingIn(mockPageHandler);

			expect(result).toBe(false);
		});
	});
});
