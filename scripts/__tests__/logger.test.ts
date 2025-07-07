import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

describe('Logger', () => {
	const logFilePath = path.resolve('app.log');

	beforeEach(() => {
		// Clear the log file before each test
		if (fs.existsSync(logFilePath)) {
			fs.unlinkSync(logFilePath);
		}
	});

	afterAll(() => {
		// Clean up the log file after all tests
		if (fs.existsSync(logFilePath)) {
			fs.unlinkSync(logFilePath);
		}
	});

	it('should write log messages to the app.log file', (done) => {
		const testMessage = 'This is a test log message';

		// Log a message
		logger.info(testMessage);

		// Wait briefly to ensure the log is written
		setTimeout(() => {
			const logFileContent = fs.readFileSync(logFilePath, 'utf-8');
			expect(logFileContent).toContain(testMessage);
			done();
		}, 100);
	});
});
