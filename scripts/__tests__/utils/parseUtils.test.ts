/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Mock logger
jest.mock('../../utils/logger.js', () => ({
	__esModule: true,
	default: { log: jest.fn() },
}));

// Mock process.env
const originalEnv = process.env;

describe('parseUtils', () => {
	let mockPage: any;
	let mockElementHandle: any;

	beforeEach(() => {
		jest.clearAllMocks();
		process.env = { ...originalEnv };

		mockElementHandle = {
			textContent: 'Test Button',
		};

		mockPage = {
			$: jest.fn(),
			$$: jest.fn(),
			evaluate: jest.fn(),
			evaluateHandle: jest.fn(),
		};
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('findDivByIdPrefix', () => {
		it('should find div element with matching ID prefix', async () => {
			const { findDivByIdPrefix } = await import('../../utils/parseUtils.js');

			// @ts-ignore
			mockPage.$ = jest.fn().mockResolvedValue(mockElementHandle);

			const result = await findDivByIdPrefix(mockPage, 'test-prefix');

			expect(mockPage.$).toHaveBeenCalledWith("div[id^='test-prefix']");
			expect(result).toBe(mockElementHandle);
		});

		it('should return null when no div found', async () => {
			const { findDivByIdPrefix } = await import('../../utils/parseUtils.js');

			// @ts-ignore
			mockPage.$ = jest.fn().mockResolvedValue(null);

			const result = await findDivByIdPrefix(mockPage, 'nonexistent');

			expect(result).toBeNull();
		});

		it('should handle errors and return null', async () => {
			const { findDivByIdPrefix } = await import('../../utils/parseUtils.js');

			// @ts-ignore
			mockPage.$ = jest.fn().mockRejectedValue(new Error('Test error'));

			const result = await findDivByIdPrefix(mockPage, 'test-prefix');

			expect(result).toBeNull();
		});
	});

	describe('findBtnByTxt', () => {
		it('should find button with matching text using Puppeteer', async () => {
			const { findBtnByTxt } = await import('../../utils/parseUtils.js');

			const mockButton = { textContent: 'Apply Now' };
			// @ts-ignore
			mockPage.$$ = jest.fn().mockResolvedValue([mockButton]);
			// @ts-ignore
			mockPage.evaluate = jest.fn().mockResolvedValue('Apply Now');

			const result = await findBtnByTxt(mockPage, 'Apply Now');

			expect(mockPage.$$).toHaveBeenCalledWith('button');
			expect(result).toBe(mockButton);
		});

		it('should return null when no matching button found using Puppeteer', async () => {
			const { findBtnByTxt } = await import('../../utils/parseUtils.js');

			// @ts-ignore
			mockPage.$$ = jest.fn().mockResolvedValue([]);

			const result = await findBtnByTxt(mockPage, 'Nonexistent Button');

			expect(result).toBeNull();
		});

		it('should handle errors and return null', async () => {
			const { findBtnByTxt } = await import('../../utils/parseUtils.js');

			// @ts-ignore
			mockPage.$$ = jest.fn().mockRejectedValue(new Error('Test error'));

			const result = await findBtnByTxt(mockPage, 'Apply Now');

			expect(result).toBeNull();
		});

		it('should find button with matching text using DOM fallback', async () => {
			const { findBtnByTxt } = await import('../../utils/parseUtils.js');

			// Mock document.querySelectorAll
			const mockButton = { textContent: 'Apply Now' };
			Object.defineProperty(document, 'querySelectorAll', {
				value: jest.fn().mockReturnValue([mockButton]),
				writable: true,
			});

			const result = await findBtnByTxt({}, 'Apply Now');

			expect(result).toBe(mockButton);
		});

		it('should return null when no matching button found using DOM fallback', async () => {
			const { findBtnByTxt } = await import('../../utils/parseUtils.js');

			Object.defineProperty(document, 'querySelectorAll', {
				value: jest.fn().mockReturnValue([]),
				writable: true,
			});

			const result = await findBtnByTxt({}, 'Nonexistent Button');

			expect(result).toBeNull();
		});
	});

	describe('filterJobLinks', () => {
		beforeEach(() => {
			// Remove the mockPage.evaluate for filterJobLinks from here
			// It will be set up in the specific test instead
		});

		it('should filter job links successfully', async () => {
			const { filterJobLinks } = await import('../../utils/parseUtils.js');

			process.env.APPLIED = '';

			// @ts-ignore
			mockPage.evaluate = jest.fn().mockResolvedValue({
				'Test Company Batch 1': ['https://www.workatastartup.com/jobs/test-job'],
			});

			const result = await filterJobLinks(mockPage);

			expect(result).toEqual({
				'Test Company Batch 1': ['https://www.workatastartup.com/jobs/test-job'],
			});
		});

		it('should skip companies that have already been applied to', async () => {
			const { filterJobLinks } = await import('../../utils/parseUtils.js');

			process.env.APPLIED = 'Test Company Batch 1';

			const result = await filterJobLinks(mockPage);

			expect(result).toEqual({});
		});

		it('should handle multiple applied companies', async () => {
			const { filterJobLinks } = await import('../../utils/parseUtils.js');

			process.env.APPLIED = 'Company A Batch 1, Company B Batch 2';

			const result = await filterJobLinks(mockPage);

			expect(result).toEqual({});
		});

		it('should handle errors and return empty object', async () => {
			const { filterJobLinks } = await import('../../utils/parseUtils.js');

			// @ts-ignore
			mockPage.evaluate = jest.fn().mockRejectedValue(new Error('Test error'));

			const result = await filterJobLinks(mockPage);

			expect(result).toEqual({});
		});

		it('should handle companies without proper spans', async () => {
			const { filterJobLinks } = await import('../../utils/parseUtils.js');

			process.env.APPLIED = '';

			// Mock company block with insufficient spans
			const mockCompanyBlock = {
				querySelectorAll: jest.fn().mockReturnValue([
					{
						querySelectorAll: jest.fn().mockReturnValue([
							{
								querySelectorAll: jest.fn().mockReturnValue([
									{ textContent: 'Test Company' }, // Only one span
								]),
							},
						]),
					},
				]),
			};

			mockPage.evaluate = jest.fn().mockImplementation((fn, appliedCompanies) => {
				const mockDocument = {
					querySelectorAll: jest.fn().mockReturnValue([mockCompanyBlock]),
				};

				const mockConsole = {
					log: jest.fn(),
				};

				return (fn as Function).call({ document: mockDocument, console: mockConsole }, appliedCompanies);
			});

			const result = await filterJobLinks(mockPage);

			expect(result).toEqual({});
		});

		it('should handle companies without job links', async () => {
			const { filterJobLinks } = await import('../../utils/parseUtils.js');

			process.env.APPLIED = '';

			// Mock company block with no job links
			const mockCompanyBlock = {
				querySelectorAll: jest.fn().mockReturnValue([
					{
						querySelectorAll: jest.fn().mockReturnValue([
							{
								querySelectorAll: jest
									.fn()
									.mockReturnValue([{ textContent: 'Test Company' }, { textContent: 'Batch 1' }]),
							},
						]),
					},
				]),
			};

			mockPage.evaluate = jest.fn().mockImplementation((fn, appliedCompanies) => {
				const mockDocument = {
					querySelectorAll: jest.fn().mockReturnValue([mockCompanyBlock]),
				};

				const mockConsole = {
					log: jest.fn(),
				};

				return (fn as Function).call({ document: mockDocument, console: mockConsole }, appliedCompanies);
			});

			const result = await filterJobLinks(mockPage);

			expect(result).toEqual({});
		});
	});

	describe('checkJobApplicationStatus', () => {
		let originalQuerySelector: any;
		let originalQuerySelectorAll: any;
		let mockPage: any;

		beforeEach(() => {
			originalQuerySelector = document.querySelector;
			originalQuerySelectorAll = document.querySelectorAll;
			mockPage = {
				$: jest.fn() as jest.Mock,
				$$: jest.fn() as jest.Mock,
				evaluate: jest.fn() as jest.Mock,
				evaluateHandle: jest.fn() as jest.Mock,
			};
		});

		afterEach(() => {
			document.querySelector = originalQuerySelector;
			document.querySelectorAll = originalQuerySelectorAll;
		});

		it('should return true when Puppeteer finds a div with id^=ApplyButton and anchor with text "Applied"', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			const mockAnchor = {} as unknown as never;
			const mockDiv = {} as unknown as never;
			mockPage.$ = jest.fn().mockResolvedValue(mockDiv);
			mockPage.evaluateHandle = jest.fn().mockResolvedValue(mockAnchor);
			mockPage.evaluate = jest.fn().mockResolvedValue('Applied' as unknown as never);

			const result = await checkJobApplicationStatus(mockPage);

			expect(mockPage.$).toHaveBeenCalledWith("div[id^='ApplyButton']");
			expect(mockPage.evaluateHandle).toHaveBeenCalledWith(expect.any(Function), mockDiv);
			expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), mockAnchor);
			expect(result).toBe(true);
		});

		it('should return false when Puppeteer finds anchor with text not "Applied"', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			const mockAnchor = {} as unknown as never;
			const mockDiv = {} as unknown as never;
			mockPage.$ = jest.fn().mockResolvedValue(mockDiv);
			mockPage.evaluateHandle = jest.fn().mockResolvedValue(mockAnchor);
			mockPage.evaluate = jest.fn().mockResolvedValue('Apply' as unknown as never);

			const result = await checkJobApplicationStatus(mockPage);

			expect(result).toBe(false);
		});

		it('should return false when Puppeteer finds no div', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			mockPage.$ = jest.fn().mockResolvedValue(null as unknown as never);

			const result = await checkJobApplicationStatus(mockPage);

			expect(result).toBe(false);
		});

		it('should return false when Puppeteer finds div but no anchor', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			const mockDiv = {} as unknown as never;
			mockPage.$ = jest.fn().mockResolvedValue(mockDiv);
			mockPage.evaluateHandle = jest.fn().mockResolvedValue(null as unknown as never);

			const result = await checkJobApplicationStatus(mockPage);

			expect(result).toBe(false);
		});

		it('should return true in DOM fallback when div and anchor with text "Applied" are found', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			const mockAnchor = { textContent: 'Applied' } as unknown as never;
			const mockDiv = { querySelector: jest.fn().mockReturnValue(mockAnchor) } as unknown as never;
			document.querySelector = jest.fn().mockImplementation((selector) => {
				if (selector === "div[id^='ApplyButton']") return mockDiv;
				return null as unknown as never;
			});

			const result = await checkJobApplicationStatus({});

			expect(result).toBe(true);
		});

		it('should return false in DOM fallback when anchor text is not "Applied"', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			const mockAnchor = { textContent: 'Apply' } as unknown as never;
			const mockDiv = { querySelector: jest.fn().mockReturnValue(mockAnchor) } as unknown as never;
			document.querySelector = jest.fn().mockImplementation((selector) => {
				if (selector === "div[id^='ApplyButton']") return mockDiv;
				return null as unknown as never;
			});

			const result = await checkJobApplicationStatus({});

			expect(result).toBe(false);
		});

		it('should return false in DOM fallback when no div is found', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			document.querySelector = jest.fn().mockReturnValue(null as unknown as never);

			const result = await checkJobApplicationStatus({});

			expect(result).toBe(false);
		});

		it('should return false in DOM fallback when div has no anchor', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			const mockDiv = { querySelector: jest.fn().mockReturnValue(null as unknown as never) } as unknown as never;
			document.querySelector = jest.fn().mockImplementation((selector) => {
				if (selector === "div[id^='ApplyButton']") return mockDiv;
				return null as unknown as never;
			});

			const result = await checkJobApplicationStatus({});

			expect(result).toBe(false);
		});

		it('should handle errors and return false', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			mockPage.$ = jest.fn().mockRejectedValue(new Error('Test error') as unknown as never);

			const result = await checkJobApplicationStatus(mockPage);

			expect(result).toBe(false);
		});
	});
});
