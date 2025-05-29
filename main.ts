import { ElementHandle, TimeoutError } from 'puppeteer';

import { checkAppMethod, compareJobs, writeAppMsg } from './scripts/aiUtils.js';
import Company from './scripts/classes/Company.js';
import { dumpBodyText } from './scripts/debugUtils.js';
import Job from './scripts/classes/Job.js';
import logger from './scripts/logger.js';
import { PageHandler } from './scripts/classes/PageHandler.js';
import { findBtnByTxt, findDivBtnByClass, findDivByIdPrefix, findInputById, getAllJobLinks } from './scripts/parseUtils.js';
import { consolePrompt, loadApplied, loadLogin, waitTime } from './scripts/utils.js';

const pageHandler = new PageHandler();

/**
 * Logs into the Y Combinator account and checks if the login was successful.
 * 
 * @returns A promise that resolves to true if the login was successful, false otherwise.
 */
async function loggingIn(): Promise<boolean> {
	const loginUrl = 'https://account.ycombinator.com/?continue=https%3A%2F%2Fwww.workatastartup.com%2F';
	const pageOpened = await pageHandler.openUrl(loginUrl);

	if (!pageOpened) {
		logger.log('error', '⚠️ Login page not opened.');
		return false;
	}

	const ids = ['ycid-input', 'password-input'];
	const login = loadLogin();

	if (!login) {
		logger.log('error', '⚠️ Login credentials not loaded properly.');
		return false;
	}

	await waitTime();

	try {
		for (let index = 0; index < ids.length; index++) {
			const found = await findInputById(pageHandler.getMostRecentPage(), ids[index]);
			if (found) {
				await found.type(login[index]);
				logger.log('debug', `✅ Entered value into input with ID: "${ids[index]}"`);
				await waitTime(1, 3);
			} else {
				return false;
			}
		}
	} catch (error) {
		logger.log('error', '⚠️ Unexpected error:', error);
		return false;
	}

	const loginBtn = await findDivBtnByClass(pageHandler.getMostRecentPage(), 'actions');

	// findDivBtnByClass will return null and log an error if the button is not found
	if (!loginBtn) {
		return false;
	}

	await loginBtn.click();
	logger.log('debug', '✅ Clicked the login button.');

	try {
		logger.log('debug', '🔵 Waiting for the page to load...');
		await pageHandler.getMostRecentPage().waitForSelector('a[href="/application"]', { timeout: 30000 });
	} catch (error) {
		if (error instanceof TimeoutError) {
			logger.log('error', '⚠️ TimeoutError: Page load took longer than 30 seconds');
			logger.log('dump', await dumpBodyText(pageHandler.getMostRecentPage()));
		} else {
			logger.log('error', '⚠️ Unexpected error:', error);
		}

		return false;
	}

	const nameFound = await pageHandler.getMostRecentPage().evaluate(() =>
		document.body.innerText.includes('My profile')
	);

	return nameFound;
}

/**
 * Gathers jobs from the search page
 * 
 * @returns an array of links to each job listing
 */
async function getJobLinks(): Promise<string[]> {
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
	const jobLinks = await getAllJobLinks(pageHandler.getMostRecentPage());

	if (jobLinks.length > 0) {
		logger.log('info', `✅ Found ${jobLinks.length} job links.\n`);
	} else {
		logger.log('error', '⚠️ No job links found.');
	}

	return jobLinks;
}

async function main(): Promise<void> {
	logger.log('info', '🔵 Logging in...');
	const loggedIn = await loggingIn();

	if (loggedIn) {
		logger.log('info', '✅ Logged in');
	} else {
		logger.log('error', '⚠️ Login unsuccessful');
		return;
	}

	await waitTime();
	logger.log('info', '🔵 Starting search for roles...');
	const jobLinks = await getJobLinks();

	if (jobLinks.length <= 0) {
		return;
	}

	// scrape job descriptions and check for companies already applied to
	const companyRecords = loadApplied();

	for (const link of jobLinks) {
		logger.log('info', `${link}`);
		const jobPageOpened = await pageHandler.openUrl(link);

		if (!jobPageOpened) {
			logger.log('error', '⚠️ Skipping this job page.');
			continue;
		}

		const jobText = await pageHandler.getMostRecentPage().evaluate(() => document.body.innerText);
		logger.log('dump', jobText);
		const jobLines = jobText.split('\n');

		// if the job description is too short, it won't have the expected info in the expected places
		if (jobLines.length < 11) {
			logger.log('error', '⚠️ This job description is too short! Is it a valid job description?');
			continue;
		}

		// check if I've already applied to a job at this company
		const hasUnreadMessages = /^\d+$/.test(jobLines[3]);// the unread msg count is the 4th line if there are any
		const position = hasUnreadMessages ? jobLines[11] : jobLines[10];// the eleventh line is expected to be the job title and company's name
		logger.log('info', `🟪 ${position}`);
		const companyName = position.split(' at ')[1];

		// if the company name couldn't be parsed or if the company has already been applied to, skip this job
		if (!companyName) {
			logger.log('warn', '❌ Company name not found');
		} else if (companyName in companyRecords && companyRecords[companyName].applied) {
			logger.log('info', `❌ Already applied to ${companyName}`);
		} else {
			const applyBtn = await findDivByIdPrefix(pageHandler.getMostRecentPage(), 'ApplyButton');

			if (!applyBtn) {
				logger.log('error', '⚠️ Skipping this job page.');
				continue;
			}

			const applyBtnTxt = await pageHandler.getMostRecentPage().evaluate((btn) => btn.innerText, applyBtn);
			// if the apply button says 'Applied' and not 'Apply', it means I've already applied to this job
			const hasApplied = applyBtnTxt === 'Applied';

			if (!(companyName in companyRecords)) {
				companyRecords[companyName] = new Company(hasApplied);
			} else {
				companyRecords[companyName].applied = hasApplied;
			}

			if (hasApplied) {
				logger.log('info', '❌ Already applied to this job.');
			} else {
				companyRecords[companyName].jobs.push(new Job(link, jobText));
				logger.log('info', '✅ Job added to company record.');
			}
		}

		console.log();
		await waitTime(5, 10);
		await pageHandler.closeMostRecentPage();
	}

	const appliedCompanies = [];

	for (const companyName in companyRecords) {
		if (companyRecords[companyName].applied) {
			appliedCompanies.push(companyName);
		} else {
			// compare all jobs at this company and find the one that best fits my qualifications before applying
			// the only companies with zero jobs are the companies included in the APPLIED environment variable
			let bestJob: Job | null = null;

			if (companyRecords[companyName].jobs.length > 1) {
				bestJob = await compareJobs(companyRecords[companyName].jobs);
			} else {
				bestJob = companyRecords[companyName].jobs[0];
			}

			if (!bestJob) {
				logger.log('error', '⚠️ An error occurred while comparing jobs. Skipping this company.');
			} else {
				logger.log('info', `🟩 Best job for ${companyName}: ${bestJob.link}`);
				const appMethod = await checkAppMethod(bestJob.desc);

				if (!appMethod) {
					logger.log('error', '⚠️ Skipping this job.');
				} else if (appMethod === 'none') {
					// generate a message to send to the company
					let msg = await writeAppMsg(bestJob.desc);
					let approved = false;

					// ask the user for approval before sending the message
					while (!approved || !msg) {
						let userInput = '';

						// keep prompting the user until a valid response is given
						while (userInput !== 'Y' && userInput !== 'N') {
							userInput = await consolePrompt(`🔵 Do you want to send this message to ${companyName}?\nType "Y" to approve or "N" to enter a different message: `);
							userInput = userInput.toUpperCase();
						}

						if (userInput === 'Y') {
							approved = true;
							logger.log('debug', '✅ Message approved.');
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
						continue;
					}

					await waitTime(10, 20);
					const applyBtn = await findDivByIdPrefix(pageHandler.getMostRecentPage(), 'ApplyButton');

					if (!applyBtn) {
						logger.log('error', '⚠️ Skipping this job application.');
						continue;
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
						continue;
					}

					// find the textarea element and type the message into it
					const textArea = await pageHandler.getMostRecentPage().$('textarea');

					if (!textArea) {
						logger.log('error', '⚠️ Could not find the application input box. Skipping this job application.');
						continue;
					}

					await textArea.type(msg);
					logger.log('debug', '✅ Entered message into application input box.');
					await waitTime(1, 3);
					const sendBtn = await findBtnByTxt(pageHandler.getMostRecentPage(), 'Send');

					if (!(sendBtn instanceof ElementHandle)) {
						logger.log('error', '⚠️ Could not find the send button. Skipping this job application.');
						continue;
					}

					await sendBtn.click();
					logger.log('debug', '✅ Clicked the send button.');

					try {
						await pageHandler.getMostRecentPage().waitForFunction(
							(btn) => btn.innerText === 'Applied',
							{ timeout: 5000 },
							applyBtn
						);
					}
					catch (error) {
						if (error instanceof TimeoutError) {
							logger.log('error', '⚠️ TimeoutError: The post-application page did not load within 5 seconds.');
						} else {
							logger.log('error', '⚠️ Unexpected error:', error);
						}

						logger.log('error', '⚠️ Skipping this job application.');
						continue;
					}

					logger.log('info', '🎉 Application sent successfully!');
					appliedCompanies.push(companyName);
					pageHandler.closeMostRecentPage();
				}
			}

			console.log();
		}
	}

	// after all the jobs have been applied to, log the new list of applied companies to the console
	const appliedCompaniesStr = appliedCompanies.join(',');
	logger.log('info', `✅ You have applied to the following companies:\n${appliedCompaniesStr}`);
}

try {
	await main();
} catch (error) {
	logger.log('error', '⚠️ Unexpected error:', error);
} finally {
	// close the browser and all pages
	logger.log('debug', '🔵 Closing the browser...');
	await pageHandler.closeBrowser();
}