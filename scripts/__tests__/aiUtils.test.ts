import fs from 'fs';
import logger from '../logger';
import * as aiUtils from '../aiUtils';
import openai from '../openAiClient'; // Import the OpenAI client to mock
import Job from '../classes/Job';

jest.mock('fs');
jest.mock('../logger', () => ({
	log: jest.fn((level, message) => {
		// Redirect logs to the console
		console.log(`[${level.toUpperCase()}] ${message}`);
	}),
}));
jest.mock('../openaiClient', () => ({
	chat: {
		completions: {
			create: jest.fn(),
		},
	},
}));

describe('aiUtils.ts', () => {
	let mockCreate: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		mockCreate = openai.chat.completions.create as jest.Mock;
	});

	describe('getResponse', () => {
		it('should return the response content from OpenAI', async () => {
			mockCreate.mockResolvedValueOnce({
				choices: [
					{
						message: {
							content: 'Mocked response content',
						},
					},
				],
			});

			const result = await aiUtils.getResponse('Test prompt');

			expect(result).toBe('Mocked response content');
			expect(mockCreate).toHaveBeenCalledWith({
				model: 'gpt-4o-mini',
				messages: [{ role: 'user', content: 'Test prompt' }],
			});
		});

		it('should return null if the response is null', async () => {
			mockCreate.mockResolvedValueOnce({
				choices: [{ message: { content: null } }],
			});

			const result = await aiUtils.getResponse('Test prompt');

			expect(result).toBeNull();
		});
	});

	describe('getResponseWithFile', () => {
		it('should return the response content from OpenAI with a file', async () => {
			// Mock file system behavior
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue(
				Buffer.from('PDF content')
			);

			// Mock OpenAI response
			mockCreate.mockResolvedValueOnce({
				choices: [
					{
						message: {
							content: 'Mocked response content',
						},
					},
				],
			});

			const result = await aiUtils.getResponseWithFile(
				'Test prompt',
				'resume.pdf'
			);

			// Assertions
			expect(result).toBe('Mocked response content');
			expect(mockCreate).toHaveBeenCalledWith({
				model: 'gpt-4o-mini',
				messages: [
					{
						role: 'user',
						content: [
							{
								// @ts-ignore
								type: 'file',
								file: {
									filename: 'resume.pdf',
									file_data: expect.stringContaining(
										'data:application/pdf;base64,'
									),
								},
							},
							{
								type: 'text',
								text: 'Test prompt',
							},
						],
					},
				],
			});
		});

		it('should return null if the file does not exist', async () => {
			(fs.existsSync as jest.Mock).mockReturnValue(false);

			const result = await aiUtils.getResponseWithFile(
				'Test prompt',
				'nonexistent.pdf'
			);

			expect(result).toBeNull();
			expect(logger.log).toHaveBeenCalledWith(
				'warn',
				'❌ File not found: nonexistent.pdf'
			);
		});
	});

	describe('checkAppMethod', () => {
		it('should log and return the application method if successful', async () => {
			mockCreate.mockResolvedValueOnce({
				choices: [
					{
						message: {
							content: 'Apply online',
						},
					},
				],
			});

			const result = await aiUtils.checkAppMethod('Job description text');

			expect(result).toBe('Apply online');
			expect(logger.log).toHaveBeenCalledWith(
				'info',
				'🟪 Application method: Apply online'
			);
		});
	});

	describe('compareJobs', () => {
		it('should return the best job if found', async () => {
			// Mock file system behavior
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue(
				Buffer.from('PDF content')
			);

			const jobs = [
				new Job(
					'Software Engineer at Company1',
					'https://job1.com',
					'Description 1'
				),
				new Job(
					'Software Engineer at Company2',
					'https://job2.com',
					'Description 2'
				),
			];

			mockCreate.mockResolvedValueOnce({
				choices: [
					{
						message: {
							content: 'https://job2.com',
						},
					},
				],
			});

			const result = await aiUtils.compareJobs(jobs);

			expect(result).toBe(jobs[1]);
		});

		it('should log a warning and return null if no matching job is found', async () => {
			// Mock file system behavior
			(fs.existsSync as jest.Mock).mockReturnValue(true);
			(fs.readFileSync as jest.Mock).mockReturnValue(
				Buffer.from('PDF content')
			);

			const jobs = [
				new Job(
					'Software Engineer at Company1',
					'https://job1.com',
					'Description 1'
				),
				new Job(
					'Software Engineer at Company2',
					'https://job2.com',
					'Description 2'
				),
			];

			mockCreate.mockResolvedValueOnce({
				choices: [
					{
						message: {
							content: 'https://job3.com',
						},
					},
				],
			});

			const result = await aiUtils.compareJobs(jobs);

			expect(result).toBeNull();
			expect(logger.log).toHaveBeenCalledWith(
				'warn',
				expect.stringContaining('❌ No job matching the given link was found.')
			);
		});
	});

	describe('writeAppMsg', () => {
		it('should log and return the application message if successful', async () => {
			mockCreate.mockResolvedValueOnce({
				choices: [
					{
						message: {
							content: 'Application message',
						},
					},
				],
			});

			const result = await aiUtils.writeAppMsg('Job description text');

			expect(result).toBe('Application message');
			expect(logger.log).toHaveBeenCalledWith(
				'info',
				'🟩 Application message: Application message'
			);
		});
	});
});
