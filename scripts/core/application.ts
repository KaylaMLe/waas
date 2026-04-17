import logger from '../utils/logger.js';
import { consolePrompt, sleepMs, waitTime } from '../utils/utils.js';
import { PageHandler } from '../classes/PageHandler.js';
import { findApplyLink, findBtnByTxt, waitForJobPageContent } from '../utils/parseUtils.js';
import { writeAppMsg } from '../utils/aiUtils.js';
import { TimeoutError } from 'puppeteer';
import Job from '../classes/Job.js';

/** Minimum time from starting navigation until we call the model to draft the message (overlaps with page load). */
const PRE_MESSAGE_GENERATION_DELAY_MS = 15_000;

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
	const messageDelayDeadline = Date.now() + PRE_MESSAGE_GENERATION_DELAY_MS;
	const openedJobPage = await pageHandler.openUrl(bestJob.link);

	if (!openedJobPage) {
		logger.log('error', '⚠️ Skipping this job application.');
		return false;
	}

	const jobPage = pageHandler.getMostRecentPage();
	await waitForJobPageContent(jobPage);

	const remainingBeforeMessageMs = messageDelayDeadline - Date.now();
	if (remainingBeforeMessageMs > 0) {
		logger.log(
			'info',
			`⏳ Waiting ${Math.ceil(remainingBeforeMessageMs / 1000)}s before generating the application message...\n`
		);
		await sleepMs(remainingBeforeMessageMs);
	}

	const jdText = await jobPage.evaluate(() => document.body.innerText);
	let msg = await writeAppMsg(jdText);
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
			await pageHandler.closeMostRecentPage();
			return false;
		} else {
			// make sure the message is not instantly approved if the user enters an empty message
			approved = false;
			msg = await consolePrompt('🔵 Enter a new message:\n');
		}
	}

	await waitTime(10, 20);
	const applyLink = await findApplyLink(pageHandler.getMostRecentPage());

	if (!applyLink) {
		logger.log('error', '⚠️ Skipping this job application.');
		await pageHandler.closeMostRecentPage();
		return false;
	}

	await applyLink.click();
	logger.log('debug', '✅ Clicked the apply link.');

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
		await pageHandler.closeMostRecentPage();
		return false;
	}

	// find the textarea element and type the message into it
	const textArea = await pageHandler.getMostRecentPage().$('textarea');

	if (!textArea) {
		logger.log('error', '⚠️ Could not find the application input box. Skipping this job application.');
		await pageHandler.closeMostRecentPage();
		return false;
	}

	await textArea.type(msg);
	logger.log('debug', '✅ Entered message into application input box.');
	await waitTime(1, 3);
	const sendBtn = await findBtnByTxt(pageHandler.getMostRecentPage(), 'Send');

	if (!sendBtn || typeof sendBtn.click !== 'function') {
		logger.log('error', '⚠️ Could not find the send button. Skipping this job application.');
		await pageHandler.closeMostRecentPage();
		return false;
	}

	await sendBtn.click();
	logger.log('debug', '✅ Clicked the send button.');

	try {
		await pageHandler
			.getMostRecentPage()
			.waitForFunction((btn) => btn.innerText === 'Applied', { timeout: 5000 }, applyLink);
	} catch (error) {
		if (error instanceof TimeoutError) {
			logger.log('error', '⚠️ TimeoutError: The post-application page did not load within 5 seconds.');
		} else {
			logger.log('error', '⚠️ Unexpected error:', error);
		}

		logger.log('error', '⚠️ Skipping this job application.');
		await pageHandler.closeMostRecentPage();
		return false;
	}

	logger.log('info', '🎉 Application sent successfully!');
	await pageHandler.closeMostRecentPage();
	return true;
}
