import { getModelConfig } from '../../utils/config';

// Mock process.env
const originalEnv = process.env;

describe('config.ts', () => {
	beforeEach(() => {
		jest.resetModules();
		process.env = { ...originalEnv };
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	describe('getModelConfig', () => {
		it('should return default models when no environment variables are set', () => {
			delete process.env.APP_METHOD_MODEL;
			delete process.env.JOB_COMPARE_MODEL;
			delete process.env.APP_MESSAGE_MODEL;

			const config = getModelConfig();

			expect(config).toEqual({
				appMethodModel: 'gpt-4o-mini',
				jobCompareModel: 'gpt-4o-mini',
				appMessageModel: 'gpt-4o-mini',
			});
		});

		it('should return custom models when environment variables are set', () => {
			process.env.APP_METHOD_MODEL = 'gpt-4';
			process.env.JOB_COMPARE_MODEL = 'gpt-4-turbo';
			process.env.APP_MESSAGE_MODEL = 'gpt-3.5-turbo';

			const config = getModelConfig();

			expect(config).toEqual({
				appMethodModel: 'gpt-4',
				jobCompareModel: 'gpt-4-turbo',
				appMessageModel: 'gpt-3.5-turbo',
			});
		});

		it('should return mixed default and custom models when some environment variables are set', () => {
			process.env.APP_METHOD_MODEL = 'gpt-4';
			delete process.env.JOB_COMPARE_MODEL;
			process.env.APP_MESSAGE_MODEL = 'gpt-3.5-turbo';

			const config = getModelConfig();

			expect(config).toEqual({
				appMethodModel: 'gpt-4',
				jobCompareModel: 'gpt-4o-mini',
				appMessageModel: 'gpt-3.5-turbo',
			});
		});
	});
});
