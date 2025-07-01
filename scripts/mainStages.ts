import logger from './logger.js';
import { consolePrompt, waitTime } from './utils.js';
import { PageHandler } from './classes/PageHandler.js';
import { findBtnByTxt, findDivByIdPrefix, filterJobLinks } from './parseUtils.js';
import { writeAppMsg } from './aiUtils.js';
import { Page, TimeoutError } from 'puppeteer';
import Job from './classes/Job.js';

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

	logger.log('info', '✅ Login successful.');
	pageHandler.closeMostRecentPage();
	return true;
}

/**
 * Retrieves all job links from the page by parsing anchor tags with hrefs starting with a specific URL pattern.
 *
 * @param pageHandler - An instance of PageHandler to manage Puppeteer pages.
 * @returns A promise that resolves to an array of job link URLs.
 */
export async function searchForJobs(pageHandler: PageHandler): Promise<string[]> {
	if (!process.env.SEARCH_URL) {
		logger.log('warn', '❌ No SEARCH_URL found in environment variables.');
		await consolePrompt('🔵 Press CTRL + C to quit or any key to use the default search URL.');
	}

	const searchUrl = process.env.SEARCH_URL || 'https://www.workatastartup.com/companies';
	const searchPageOpened = await pageHandler.openUrl(searchUrl);

	if (!searchPageOpened) {
		return [];
	}

	await waitTime();

	const page = pageHandler.getMostRecentPage();
	const scrollCountStr = process.env.SCROLL_COUNT || '0';
	const scrollCount = scrollCountStr === 'inf' ? Infinity : parseInt(scrollCountStr, 10);
	logger.log('debug', `🔵 Scrolling ${scrollCount === Infinity ? 'infinitely' : scrollCount} times.`);

	const scrollAndWaitForLoading = async (page: Page, maxScrolls: number) => {
		let scrollsCompleted = 0;

		while (scrollsCompleted < maxScrolls) {
			// Check if loading indicator is present
			const loadingPresent = await page.evaluate(() => {
				return !!document.querySelector('div.loading.center');
			});

			if (!loadingPresent) {
				// No more results to load, break early
				logger.log('debug', `🔵 No more results after ${scrollsCompleted} scrolls.`);
				break;
			}

			// Get current scroll height before scrolling
			const scrollHeightBefore = await page.evaluate(() => document.body.scrollHeight);

			// Scroll until the loading indicator is visible
			await page.evaluate(() => {
				const loadingElement = document.querySelector('div.loading.center');
				if (loadingElement) {
					// Get the position of the loading indicator
					const rect = loadingElement.getBoundingClientRect();
					// If it's not visible (below the viewport), scroll to it
					if (rect.top > window.innerHeight) {
						window.scrollBy(0, rect.top - window.innerHeight + 100); // +100 for buffer
					}
				}
			});

			// Wait for scroll height to increase (meaning new content loaded)
			const heightIncreased = await page
				.waitForFunction(
					(previousHeight) => document.body.scrollHeight > previousHeight,
					{ timeout: 10000 },
					scrollHeightBefore
				)
				.then(() => true)
				.catch(() => false);

			if (!heightIncreased) {
				// No new content loaded, we're at the end
				logger.log('debug', `🔵 No new content loaded after ${scrollsCompleted + 1} scrolls.`);
				break;
			}

			scrollsCompleted++;

			// Small delay to allow content to settle
			await new Promise((resolve) => setTimeout(resolve, 200));
		}

		logger.log('debug', `🔵 Completed ${scrollsCompleted} scrolls.`);
	};

	if (scrollCount > 0) {
		await scrollAndWaitForLoading(page, scrollCount);
	}

	const jobLinks = await filterJobLinks(page);

	return jobLinks;
}

/**
 * Handles message approval and application submission for a job.
 *
 * @param pageHandler - The page handler instance
 * @param companyName - The name of the company
 * @param bestJob - The job to apply for
 * @returns A promise that resolves to true if the application was successful, false if skipped or failed
 */
export async function handleMessageApprovalAndApplication(
	pageHandler: PageHandler,
	companyName: string,
	bestJob: Job
): Promise<boolean> {
	// generate a message to send to the company
	let msg = await writeAppMsg(bestJob.desc);
	let approved = false;

	// ask the user for approval before sending the message
	while (!approved || !msg) {
		let userInput = '';

		// keep prompting the user until a valid response is given
		while (userInput !== 'Y' && userInput !== 'N' && userInput !== 'S') {
			userInput = await consolePrompt(
				`🔵 Do you want to send this message to ${companyName}?\nType "Y" to approve, "N" to enter a different message, or "S" to skip: `
			);
			userInput = userInput.toUpperCase();
		}

		if (userInput === 'Y') {
			approved = true;
			logger.log('debug', '✅ Message approved.');
		} else if (userInput === 'S') {
			logger.log('info', `⏭️ Skipping application to ${companyName}`);
			return false; // Skip case
		} else {
			// make sure the message is not instantly approved if the user enters an empty message
			approved = false;
			msg = await consolePrompt('🔵 Enter a new message:\n');
		}
	}

	// apply with the now approved message
	const openedJobPage = await pageHandler.openUrl(bestJob.link);

	if (!openedJobPage) {
		logger.log('error', '⚠️ Skipping this job application.');
		return false;
	}

	await waitTime(10, 20);
	const applyBtn = await findDivByIdPrefix(pageHandler.getMostRecentPage(), 'ApplyButton');

	if (!applyBtn) {
		logger.log('error', '⚠️ Skipping this job application.');
		return false;
	}

	await applyBtn.click();
	logger.log('debug', '✅ Clicked the apply button.');

	// wait up to three seconds for a textarea element to appear in the dom
	try {
		await pageHandler.getMostRecentPage().waitForSelector('textarea', { timeout: 3100 });
	} catch (error) {
		if (error instanceof TimeoutError) {
			logger.log('error', '⚠️ TimeoutError: The application modal did not appear within 3 seconds');
		} else {
			logger.log('error', '⚠️ Unexpected error:', error);
		}

		logger.log('error', '⚠️ Skipping this job application.');
		return false;
	}

	// find the textarea element and type the message into it
	const textArea = await pageHandler.getMostRecentPage().$('textarea');

	if (!textArea) {
		logger.log('error', '⚠️ Could not find the application input box. Skipping this job application.');
		return false;
	}

	await textArea.type(msg);
	logger.log('debug', '✅ Entered message into application input box.');
	await waitTime(1, 3);
	const sendBtn = await findBtnByTxt(pageHandler.getMostRecentPage(), 'Send');

	if (!sendBtn || typeof sendBtn.click !== 'function') {
		logger.log('error', '⚠️ Could not find the send button. Skipping this job application.');
		return false;
	}

	await sendBtn.click();
	logger.log('debug', '✅ Clicked the send button.');

	try {
		await pageHandler
			.getMostRecentPage()
			.waitForFunction((btn) => btn.innerText === 'Applied', { timeout: 5000 }, applyBtn);
	} catch (error) {
		if (error instanceof TimeoutError) {
			logger.log('error', '⚠️ TimeoutError: The post-application page did not load within 5 seconds.');
		} else {
			logger.log('error', '⚠️ Unexpected error:', error);
		}

		logger.log('error', '⚠️ Skipping this job application.');
		return false;
	}

	logger.log('info', '🎉 Application sent successfully!');
	pageHandler.closeMostRecentPage();
	return true;
}
