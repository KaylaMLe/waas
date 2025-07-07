import { waitTime, consolePrompt, loadApplied } from '../utils';
import Company from '../classes/Company';
import logger from '../logger';

jest.mock('readline');
jest.mock('../logger');

describe('utils.ts', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('waitTime', () => {
		jest.useFakeTimers();

		it('should wait for a random time within the specified range', async () => {
			const logSpy = jest.spyOn(logger, 'log');
			const rangeMin = 5;
			const rangeMax = 10;

			const waitPromise = waitTime(rangeMin, rangeMax);
			jest.runAllTimers();
			await waitPromise;

			expect(logSpy).toHaveBeenCalledWith('info', expect.stringMatching(/⏳ Waiting for \d+ seconds/));
		});

		it('should log an error if rangeMin is greater than rangeMax', async () => {
			const logSpy = jest.spyOn(logger, 'log');

			await waitTime(10, 5);

			expect(logSpy).toHaveBeenCalledWith('error', '⚠️ rangeMin is greater than rangeMax. Skipping this wait.');
		});
	});

	describe('consolePrompt', () => {
		it('should prompt the user and return the trimmed input', async () => {
			const readline = require('readline');
			const mockQuestion = jest.fn((prompt, callback) => callback('  user input  '));
			readline.createInterface.mockReturnValue({
				question: mockQuestion,
				close: jest.fn(),
			});

			const result = await consolePrompt('Enter something: ');

			expect(result).toBe('user input');
			expect(mockQuestion).toHaveBeenCalledWith('Enter something: ', expect.any(Function));
		});
	});

	describe('loadApplied', () => {
		it('should return an empty object if no companies are found in environment variables', () => {
			const logSpy = jest.spyOn(logger, 'log');
			delete process.env.APPLIED;

			const result = loadApplied();

			expect(result).toEqual({});
			expect(logSpy).toHaveBeenCalledWith('warn', '❌ No companies (APPLIED) found in environment variables.');
		});

		it('should return a record of companies if they are found in environment variables', () => {
			process.env.APPLIED = 'CompanyA,CompanyB';

			const result = loadApplied();

			expect(result).toEqual({
				CompanyA: expect.any(Company),
				CompanyB: expect.any(Company),
			});
		});
	});
});
