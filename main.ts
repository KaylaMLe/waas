import logger from './scripts/utils/logger.js';
import { loggingIn } from './scripts/core/mainStages.js';
import { waitTime } from './scripts/utils/utils.js';
import { PageHandler } from './scripts/classes/PageHandler.js';
import { getWaasRepository } from './scripts/db/waasRepository.js';
import { runLiveSearchApply } from './scripts/core/liveSearchApply.js';
import { runStoredApplyQueue } from './scripts/core/storedApply.js';

const pageHandler = new PageHandler();

let isShuttingDown = false;

/** Winston keeps the File transport open; flush and end so the process can exit after work completes. */
function flushLogger(): Promise<void> {
	return new Promise((resolve) => {
		logger.end(() => resolve());
	});
}

async function flushLoggerAndExit(code: number): Promise<never> {
	await flushLogger();
	process.exit(code);
}

async function gracefulShutdown(signal = 'SIGINT') {
	if (isShuttingDown) return;
	isShuttingDown = true;
	logger.log('info', `🟡 Received ${signal}. Shutting down gracefully...`);

	try {
		await pageHandler.closeBrowser();
		logger.log('info', '🔵 Browser closed. Exiting.');
	} catch (err) {
		logger.log('error', '❌ Error during shutdown:', err);
	} finally {
		await flushLoggerAndExit(0);
	}
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

async function main(): Promise<void> {
	logger.log('info', '🔵 Logging in...');
	const loggedIn = await loggingIn(pageHandler);

	if (loggedIn) {
		logger.log('info', '✅ Logged in');
	} else {
		logger.log('error', '⚠️ Login unsuccessful');
		return;
	}

	await waitTime();

	const runMode = (process.env.RUN_MODE || 'live').trim().toLowerCase();
	const repo = getWaasRepository();

	if (runMode === 'stored') {
		if (!repo) {
			logger.log(
				'error',
				'⚠️ RUN_MODE=stored requires the WAAS database. Unset SKIP_WAAS_DB (or remove it) and ensure WAAS_DB_PATH is writable.'
			);
			return;
		}
		logger.log('info', '🔵 Running stored-job apply queue…');
		await runStoredApplyQueue(pageHandler, repo);
		return;
	}

	await runLiveSearchApply(pageHandler, repo);
}

let exitCode = 0;
try {
	await main();
} catch (error) {
	exitCode = 1;
	logger.log('error', '⚠️ Unexpected error:', error);
} finally {
	// close the browser and all pages
	logger.log('info', '🔵 Closing the browser...');
	await pageHandler.closeBrowser();
	await flushLogger();
}
process.exit(exitCode);
