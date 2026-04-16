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

	beforeEach(() => {
		jest.clearAllMocks();
		process.env = { ...originalEnv };

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

	describe('findBtnByTxt', () => {
		const realQuerySelectorAll = document.querySelectorAll.bind(document);

		afterEach(() => {
			Object.defineProperty(document, 'querySelectorAll', {
				value: realQuerySelectorAll,
				writable: true,
				configurable: true,
			});
		});

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

	describe('findApplyLink', () => {
		it('should return the first anchor whose text is exactly Apply', async () => {
			const { findApplyLink } = await import('../../utils/parseUtils.js');

			const mockA = {};
			mockPage.$$ = jest.fn().mockImplementation(() => Promise.resolve([mockA]));
			mockPage.evaluate = jest.fn().mockImplementation(() => Promise.resolve('Apply'));

			const result = await findApplyLink(mockPage);

			expect(mockPage.$$).toHaveBeenCalledWith('a');
			expect(result).toBe(mockA);
		});

		it('should skip anchors until exact Apply match', async () => {
			const { findApplyLink } = await import('../../utils/parseUtils.js');

			const mockOther = {};
			const mockApply = {};
			mockPage.$$ = jest.fn().mockImplementation(() => Promise.resolve([mockOther, mockApply]));
			mockPage.evaluate = jest
				.fn()
				.mockImplementationOnce(() => Promise.resolve('Careers'))
				.mockImplementationOnce(() => Promise.resolve('Apply'));

			const result = await findApplyLink(mockPage);

			expect(result).toBe(mockApply);
		});

		it('should return null when no Apply anchor exists', async () => {
			const { findApplyLink } = await import('../../utils/parseUtils.js');

			mockPage.$$ = jest.fn().mockImplementation(() => Promise.resolve([]));
			const result = await findApplyLink(mockPage);

			expect(result).toBeNull();
		});

		it('should handle errors and return null', async () => {
			const { findApplyLink } = await import('../../utils/parseUtils.js');

			mockPage.$$ = jest.fn().mockImplementation(() => Promise.reject(new Error('boom')));

			const result = await findApplyLink(mockPage);

			expect(result).toBeNull();
		});
	});

	describe('checkJobApplicationStatus', () => {
		let statusMockPage: any;

		beforeEach(() => {
			statusMockPage = {
				evaluate: jest.fn() as jest.Mock,
			};
		});

		it('should return true when evaluate finds Applied CTA', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			statusMockPage.evaluate = jest.fn().mockImplementation(() => Promise.resolve(true));

			const result = await checkJobApplicationStatus(statusMockPage);

			expect(statusMockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), 'Apply', 'Applied');
			expect(result).toBe(true);
		});

		it('should return false when evaluate finds Apply CTA', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			statusMockPage.evaluate = jest.fn().mockImplementation(() => Promise.resolve(false));

			const result = await checkJobApplicationStatus(statusMockPage);

			expect(result).toBe(false);
		});

		it('should use DOM when page has no evaluate', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			document.body.innerHTML = '<a href="#">Apply</a>';

			const result = await checkJobApplicationStatus({});

			expect(result).toBe(false);
		});

		it('should return true in DOM fallback when anchor text is Applied', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			document.body.innerHTML = '<a href="#">Applied</a>';

			const result = await checkJobApplicationStatus({});

			expect(result).toBe(true);
		});

		it('should handle errors and return false', async () => {
			const { checkJobApplicationStatus } = await import('../../utils/parseUtils.js');

			statusMockPage.evaluate = jest.fn().mockImplementation(() => Promise.reject(new Error('Test error')));

			const result = await checkJobApplicationStatus(statusMockPage);

			expect(result).toBe(false);
		});
	});
});
