import { jest } from '@jest/globals';
import { handleMessageApprovalAndApplication } from '../mainStages';
import { PageHandler } from '../classes/PageHandler';
import Job from '../classes/Job';
import * as aiUtils from '../aiUtils';
import * as parseUtils from '../parseUtils';
import * as utils from '../utils';

// Mock all dependencies
jest.mock('../logger', () => ({
	log: jest.fn(),
}));

jest.mock('../aiUtils', () => ({
	writeAppMsg: jest.fn(),
}));

jest.mock('../parseUtils', () => ({
	findBtnByTxt: jest.fn(),
	findDivByIdPrefix: jest.fn(),
}));

jest.mock('../utils', () => ({
	consolePrompt: jest.fn(),
	waitTime: jest.fn(),
}));

jest.mock('../classes/PageHandler', () => {
	return {
		PageHandler: jest.fn().mockImplementation(() => ({
			openUrl: jest.fn(),
			getMostRecentPage: jest.fn().mockReturnValue({
				waitForSelector: jest.fn(),
				$: jest.fn(),
				waitForFunction: jest.fn(),
				evaluate: jest.fn(),
			}),
			closeMostRecentPage: jest.fn(),
		})),
	};
});

describe('mainStages', () => {
	let mockPageHandler: any;
	let mockJob: Job;
	let mockPage: any;

	beforeEach(() => {
		jest.clearAllMocks();

		mockPageHandler = new PageHandler();
		mockJob = new Job('https://test-job.com', 'Test job description');
		mockPage = {
			waitForSelector: jest.fn(),
			$: jest.fn(),
			waitForFunction: jest.fn(),
			evaluate: jest.fn(),
		};

		mockPageHandler.getMostRecentPage.mockReturnValue(mockPage);
	});

	describe('handleMessageApprovalAndApplication', () => {
		it('should handle skip option and return false', async () => {
			// Mock the AI response
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');

			// Mock user input to skip
			(utils.consolePrompt as any).mockResolvedValue('S');

			const result = await handleMessageApprovalAndApplication(
				mockPageHandler,
				'TestCompany',
				mockJob
			);

			expect(result).toBe(false);
			expect(utils.consolePrompt).toHaveBeenCalledWith(
				expect.stringContaining(
					'Type "Y" to approve, "N" to enter a different message, or "S" to skip'
				)
			);
		});

		it('should handle approval and return true on successful application', async () => {
			// Mock the AI response
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');

			// Mock user input to approve
			(utils.consolePrompt as any).mockResolvedValue('Y');

			// Mock successful page operations
			mockPageHandler.openUrl.mockResolvedValue(true);
			(parseUtils.findDivByIdPrefix as any).mockResolvedValue({
				click: jest.fn(),
			});
			mockPage.waitForSelector.mockResolvedValue(undefined);
			mockPage.$.mockResolvedValue({ type: jest.fn() });

			// Mock the send button - just return a simple object
			(parseUtils.findBtnByTxt as any).mockResolvedValue({ click: jest.fn() });

			mockPage.waitForFunction.mockResolvedValue(undefined);

			const result = await handleMessageApprovalAndApplication(
				mockPageHandler,
				'TestCompany',
				mockJob
			);

			expect(result).toBe(true);
			expect(mockPageHandler.openUrl).toHaveBeenCalledWith(
				'https://test-job.com'
			);
		});

		it('should handle new message input and continue until approved', async () => {
			// Mock the AI response
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');

			// Mock user input: first N (reject), then new message, then Y (approve)
			(utils.consolePrompt as any)
				.mockResolvedValueOnce('N') // Reject initial message
				.mockResolvedValueOnce('Custom message') // Enter new message
				.mockResolvedValueOnce('Y'); // Approve new message

			// Mock successful page operations
			mockPageHandler.openUrl.mockResolvedValue(true);
			(parseUtils.findDivByIdPrefix as any).mockResolvedValue({
				click: jest.fn(),
			});
			mockPage.waitForSelector.mockResolvedValue(undefined);
			mockPage.$.mockResolvedValue({ type: jest.fn() });

			// Mock the send button - just return a simple object
			(parseUtils.findBtnByTxt as any).mockResolvedValue({ click: jest.fn() });

			mockPage.waitForFunction.mockResolvedValue(undefined);

			const result = await handleMessageApprovalAndApplication(
				mockPageHandler,
				'TestCompany',
				mockJob
			);

			expect(result).toBe(true);
			expect(utils.consolePrompt).toHaveBeenCalledTimes(3);
		});

		it('should return false when page fails to open', async () => {
			// Mock the AI response
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');

			// Mock user input to approve
			(utils.consolePrompt as any).mockResolvedValue('Y');

			// Mock page open failure
			mockPageHandler.openUrl.mockResolvedValue(false);

			const result = await handleMessageApprovalAndApplication(
				mockPageHandler,
				'TestCompany',
				mockJob
			);

			expect(result).toBe(false);
		});

		it('should return false when apply button is not found', async () => {
			// Mock the AI response
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');

			// Mock user input to approve
			(utils.consolePrompt as any).mockResolvedValue('Y');

			// Mock successful page open but no apply button
			mockPageHandler.openUrl.mockResolvedValue(true);
			(parseUtils.findDivByIdPrefix as any).mockResolvedValue(null);

			const result = await handleMessageApprovalAndApplication(
				mockPageHandler,
				'TestCompany',
				mockJob
			);

			expect(result).toBe(false);
		});
	});
});
