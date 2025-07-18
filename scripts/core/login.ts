import logger from '../utils/logger.js';
import { consolePrompt } from '../utils/utils.js';
import { PageHandler } from '../classes/PageHandler.js';

/**
 * Opens the WorkAtAStartup login page and waits for the user to complete the login.
 *
 * @returns A promise that resolves to true if the login was successful, false otherwise.
 */
export async function loggingIn(pageHandler: PageHandler): Promise<boolean> {
	logger.log('debug', '🔵 Opening login page...');

	const loginUrl = 'https://account.ycombinator.com/?continue=https%3A%2F%2Fwww.workatastartup.com%2F';
	const pageOpened = await pageHandler.openUrl(loginUrl);

	if (!pageOpened) {
		logger.log('error', '⚠️ Login page not opened.');
		return false;
	}

	logger.log(
		'info',
		'🔵 Please log in using the opened browser window. Return to this console once you have completed the login.'
	);
	await consolePrompt('Press Enter to continue...');

	// Check if the user is logged in
	const loggedIn = await pageHandler.getMostRecentPage().evaluate(() => document.body.innerText.includes('My profile'));

	if (!loggedIn) {
		logger.log('error', '⚠️ Login unsuccessful.');
		return false;
	}

	pageHandler.closeMostRecentPage();
	return true;
}
