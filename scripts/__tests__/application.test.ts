import { jest } from '@jest/globals';
import { handleMessageApprovalAndApplication } from '../core/application';
import { PageHandler } from '../classes/PageHandler';
import Job from '../classes/Job';
import * as utils from '../utils/utils';
import * as parseUtils from '../utils/parseUtils';
import * as aiUtils from '../utils/aiUtils';
import { TimeoutError } from 'puppeteer';

// Mock dependencies
jest.mock('../logger', () => ({
	log: jest.fn(),
}));

jest.mock('../utils', () => ({
	consolePrompt: jest.fn(),
	waitTime: jest.fn(),
}));

jest.mock('../parseUtils', () => ({
	findBtnByTxt: jest.fn(),
	findDivByIdPrefix: jest.fn(),
}));

jest.mock('../aiUtils', () => ({
	writeAppMsg: jest.fn(),
}));

jest.mock('../classes/PageHandler', () => {
	return {
		PageHandler: jest.fn().mockImplementation(() => ({
			openUrl: jest.fn(),
			getMostRecentPage: jest.fn().mockReturnValue({
				waitForSelector: jest.fn(),
				$: jest.fn(),
				waitForFunction: jest.fn(),
			}),
			closeMostRecentPage: jest.fn(),
		})),
	};
});

jest.mock('../classes/Job', () => {
	return jest.fn().mockImplementation(() => ({
		link: 'https://example.com/job',
		desc: 'Job description',
	}));
});

describe('application', () => {
	let mockPageHandler: any;
	let mockPage: any;
	let mockJob: any;
	let mockApplyBtn: any;
	let mockTextArea: any;
	let mockSendBtn: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockApplyBtn = {
			click: jest.fn(),
		};
		mockTextArea = {
			type: jest.fn(),
		};
		mockSendBtn = {
			click: jest.fn(),
		};
		mockPage = {
			waitForSelector: jest.fn(),
			$: jest.fn(),
			waitForFunction: jest.fn(),
		};
		mockPageHandler = {
			openUrl: jest.fn(),
			getMostRecentPage: jest.fn().mockReturnValue(mockPage),
			closeMostRecentPage: jest.fn(),
		};
		mockJob = new Job('Test Job', 'https://example.com/job', 'Job description');
	});

	describe('handleMessageApprovalAndApplication', () => {
		it('should return false if job page fails to open', async () => {
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');
			(utils.consolePrompt as any).mockResolvedValue('Y');
			mockPageHandler.openUrl.mockResolvedValueOnce(false);

			const result = await handleMessageApprovalAndApplication(mockPageHandler, 'Test Company', mockJob);

			expect(result).toBe(false);
		});

		it('should return false if apply button not found', async () => {
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');
			(utils.consolePrompt as any).mockResolvedValue('Y');
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			(parseUtils.findDivByIdPrefix as any).mockResolvedValue(null);

			const result = await handleMessageApprovalAndApplication(mockPageHandler, 'Test Company', mockJob);

			expect(result).toBe(false);
		});

		it('should return false if textarea not found', async () => {
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');
			(utils.consolePrompt as any).mockResolvedValue('Y');
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			(parseUtils.findDivByIdPrefix as any).mockResolvedValue(mockApplyBtn);
			mockPage.waitForSelector.mockResolvedValue(undefined);
			mockPage.$.mockResolvedValue(null);

			const result = await handleMessageApprovalAndApplication(mockPageHandler, 'Test Company', mockJob);

			expect(result).toBe(false);
		});

		it('should return false if send button not found', async () => {
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');
			(utils.consolePrompt as any).mockResolvedValue('Y');
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			(parseUtils.findDivByIdPrefix as any).mockResolvedValue(mockApplyBtn);
			mockPage.waitForSelector.mockResolvedValue(undefined);
			mockPage.$.mockResolvedValue(mockTextArea);
			(parseUtils.findBtnByTxt as any).mockResolvedValue(null);

			const result = await handleMessageApprovalAndApplication(mockPageHandler, 'Test Company', mockJob);

			expect(result).toBe(false);
		});

		it('should return false if send button has no click function', async () => {
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');
			(utils.consolePrompt as any).mockResolvedValue('Y');
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			(parseUtils.findDivByIdPrefix as any).mockResolvedValue(mockApplyBtn);
			mockPage.waitForSelector.mockResolvedValue(undefined);
			mockPage.$.mockResolvedValue(mockTextArea);
			(parseUtils.findBtnByTxt as any).mockResolvedValue({}); // No click function

			const result = await handleMessageApprovalAndApplication(mockPageHandler, 'Test Company', mockJob);

			expect(result).toBe(false);
		});

		it('should return false on timeout error during textarea wait', async () => {
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');
			(utils.consolePrompt as any).mockResolvedValue('Y');
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			(parseUtils.findDivByIdPrefix as any).mockResolvedValue(mockApplyBtn);
			mockPage.waitForSelector.mockRejectedValue(new TimeoutError('Timeout'));

			const result = await handleMessageApprovalAndApplication(mockPageHandler, 'Test Company', mockJob);

			expect(result).toBe(false);
		});

		it('should return false on timeout error during applied wait', async () => {
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');
			(utils.consolePrompt as any).mockResolvedValue('Y');
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			(parseUtils.findDivByIdPrefix as any).mockResolvedValue(mockApplyBtn);
			mockPage.waitForSelector.mockResolvedValue(undefined);
			mockPage.$.mockResolvedValue(mockTextArea);
			(parseUtils.findBtnByTxt as any).mockResolvedValue(mockSendBtn);
			mockPage.waitForFunction.mockRejectedValue(new TimeoutError('Timeout'));

			const result = await handleMessageApprovalAndApplication(mockPageHandler, 'Test Company', mockJob);

			expect(result).toBe(false);
		});

		it('should return false when user skips application', async () => {
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');
			(utils.consolePrompt as any).mockResolvedValue('S');

			const result = await handleMessageApprovalAndApplication(mockPageHandler, 'Test Company', mockJob);

			expect(result).toBe(false);
		});

		it('should return true on successful application', async () => {
			(aiUtils.writeAppMsg as any).mockResolvedValue('Test message');
			(utils.consolePrompt as any).mockResolvedValue('Y');
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			(parseUtils.findDivByIdPrefix as any).mockResolvedValue(mockApplyBtn);
			mockPage.waitForSelector.mockResolvedValue(undefined);
			mockPage.$.mockResolvedValue(mockTextArea);
			(parseUtils.findBtnByTxt as any).mockResolvedValue(mockSendBtn);
			mockPage.waitForFunction.mockResolvedValue(undefined);

			const result = await handleMessageApprovalAndApplication(mockPageHandler, 'Test Company', mockJob);

			expect(result).toBe(true);
			expect(mockApplyBtn.click).toHaveBeenCalled();
			expect(mockTextArea.type).toHaveBeenCalledWith('Test message');
			expect(mockSendBtn.click).toHaveBeenCalled();
			expect(mockPageHandler.closeMostRecentPage).toHaveBeenCalled();
		});

		it('should handle user entering new message', async () => {
			(aiUtils.writeAppMsg as any).mockResolvedValue('Original message');
			(utils.consolePrompt as any)
				.mockResolvedValueOnce('N') // User wants to enter new message
				.mockResolvedValueOnce('New custom message') // User enters new message
				.mockResolvedValueOnce('Y'); // User approves new message
			mockPageHandler.openUrl.mockResolvedValueOnce(true);
			(utils.waitTime as any).mockResolvedValue(undefined);
			(parseUtils.findDivByIdPrefix as any).mockResolvedValue(mockApplyBtn);
			mockPage.waitForSelector.mockResolvedValue(undefined);
			mockPage.$.mockResolvedValue(mockTextArea);
			(parseUtils.findBtnByTxt as any).mockResolvedValue(mockSendBtn);
			mockPage.waitForFunction.mockResolvedValue(undefined);

			const result = await handleMessageApprovalAndApplication(mockPageHandler, 'Test Company', mockJob);

			expect(result).toBe(true);
			expect(mockTextArea.type).toHaveBeenCalledWith('New custom message');
		});
	});
});
