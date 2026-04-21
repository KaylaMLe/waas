import fs from 'fs';
import path from 'path';
import os from 'os';

const logFilePath = path.join(os.tmpdir(), `waas-logger-test-${process.pid}.log`);

describe('Logger', () => {
	let logger: (typeof import('../../utils/logger.js'))['default'];

	beforeAll(async () => {
		process.env.LOG_FILE_PATH = logFilePath;
		jest.resetModules();
		const mod = await import('../../utils/logger.js');
		logger = mod.default;
	});

	beforeEach(() => {
		if (fs.existsSync(logFilePath)) {
			fs.unlinkSync(logFilePath);
		}
	});

	afterAll(() => {
		delete process.env.LOG_FILE_PATH;
		jest.resetModules();
		if (fs.existsSync(logFilePath)) {
			fs.unlinkSync(logFilePath);
		}
	});

	it('should write log messages to the log file', async () => {
		const testMessage = 'This is a test log message';

		logger.info(testMessage);

		await new Promise((r) => setTimeout(r, 150));
		const logFileContent = fs.readFileSync(logFilePath, 'utf-8');
		expect(logFileContent).toContain(testMessage);
	});
});
