import { ElementHandle, TimeoutError } from 'puppeteer';

import { checkAppMethod, compareJobs, writeAppMsg } from './scripts/aiUtils.js';
import Company from './scripts/Company.js';
import Job from './scripts/Job.js';
import { PageHandler } from './scripts/PageHandler.js';
import { findBtnByTxt, findDivBtnByClass, findDivByIdPrefix, findInputById, getAllJobLinks } from './scripts/parse.js';
import { consolePrompt, loadApplied, waitTime } from './scripts/utils.js';

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
		console.log('❌ Login page not opened.');
		return false;
	}

	await waitTime();

	const ids = ['ycid-input', 'password-input'];
	const login = [process.env.YCUSER || 'foo', process.env.YCPSWD || 'bar'];

	try {
		for (let index = 0; index < ids.length; index++) {
			const found = await findInputById(pageHandler.getMostRecentPage(), ids[index]);
			if (found) {
				await found.type(login[index]);
				console.log(`✅ Entered value into input with ID: "${ids[index]}"`);
				await waitTime(1, 3);
			} else {
				return false;
			}
		}
	} catch (error) {
		console.error('⚠️ Unexpected error:', error);
		return false;
	}

	const loginBtn = await findDivBtnByClass(pageHandler.getMostRecentPage(), 'actions');

	// findDivBtnByClass will return null and log an error if the button is not found
	if (!loginBtn) {
		return false;
	}

	await loginBtn.click();
	console.log('✅ Clicked the login button.');

	try {
		console.log('🔵 Waiting for the page to load...');
		await pageHandler.getMostRecentPage().waitForSelector('body', { timeout: 5000 });
	} catch (error) {
		if (error instanceof TimeoutError) {
			console.error('⚠️ TimeoutError: Page load took longer than 5 seconds');
		} else {
			console.error('⚠️ Unexpected error:', error);
		}

		return false;
	}

	const name = process.env.YCNAME || 'My profile';
	const nameFound = await pageHandler.getMostRecentPage().evaluate(() =>
		document.body.innerText.includes(name)
	);

	return nameFound;
}

/**
 * Gathers jobs from the search page
 * 
 * @returns an array of links to each job listing
 */
async function getJobLinks(): Promise<string[]> {
	const searchUrl = process.env.SEARCH_URL || 'https://www.workatastartup.com/companies';
	const searchPageOpened = await pageHandler.openUrl(searchUrl);

	if (!searchPageOpened) {
		return [];
	}

	await waitTime();
	const jobLinks = await getAllJobLinks(pageHandler.getMostRecentPage());

	if (jobLinks.length > 0) {
		console.log(`✅ Found ${jobLinks.length} job links.`);
	} else {
		console.log('❌ No job links found.');
		const bodyText = await pageHandler.getMostRecentPage().evaluate(() => document.body.innerText);
		console.log('Body text:\n', bodyText);
	}

	return jobLinks;
}

async function main(): Promise<void> {
	const loggedIn = await loggingIn();

	if (loggedIn) {
		console.log('✅ Logged in');
	} else {
		console.log('❌ Login unsuccessful');
		return;
	}

	await waitTime();
	console.log('🔵 Starting search for roles...');
	const jobLinks = await getJobLinks();

	if (jobLinks.length <= 0) {
		return;
	}

	// scrape job descriptions and check for companies already applied to
	const companyRecords = loadApplied();

	for (const link of jobLinks) {
		console.log(`\n${link}`);
		const jobPageOpened = await pageHandler.openUrl(link);

		if (!jobPageOpened) {
			console.log('❌ Skipping this job page.');
			continue;
		}

		const jobText = await pageHandler.getMostRecentPage().evaluate(() => document.body.innerText);
		const jobLines = jobText.split('\n');

		// if the job description is too short, it won't have the expected info in the expected places
		if (jobLines.length < 11) {
			console.log('❌ This job description is too short! Is it a valid job description?');
			continue;
		}

		// check if I've already applied to a job at this company
		const position = jobLines[10];// the eleventh line is expected to be the job title and company's name
		console.log(`🟪 ${position}`);
		const companyName = position.split(' at ')[1];

		// if the company name couldn't be parsed or if the company has already been applied to, skip this job
		if (companyName && companyName in companyRecords && companyRecords[companyName].applied) {
			console.log(`❌ Either company name not found or already applied to ${companyName}`);
		} else {
			const applyBtn = await findDivByIdPrefix(pageHandler.getMostRecentPage(), 'ApplyButton');

			if (!applyBtn) {
				console.log('❌ Skipping this job page.');
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
				console.log('❌ Already applied to this job.');
			} else {
				companyRecords[companyName].jobs.push(new Job(link, jobText));
				console.log('✅ Job added to company record.');
			}
		}

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
				console.log('⚠️ An error occurred while comparing jobs. Skipping this company.');
			} else {
				console.log(`🟩 Best job for ${companyName}: ${bestJob.link}`);
				const appMethod = await checkAppMethod(bestJob.desc);

				if (!appMethod) {
					console.log('❌ Skipping this job.');
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
							console.log('✅ Message approved.');
						} else {
							// make sure the message is not instantly approved if the user enters an empty message
							approved = false;
							msg = await consolePrompt('🔵 Enter a new message:\n');
						}
					}

					// apply with the now approved message
					const openedJobPage = await pageHandler.openUrl(bestJob.link);

					if (!openedJobPage) {
						console.log('❌ Skipping this job application.');
						continue;
					}

					await waitTime(10, 20);
					const applyBtn = await findDivByIdPrefix(pageHandler.getMostRecentPage(), 'ApplyButton');

					if (!applyBtn) {
						console.log('❌ Skipping this job application.');
						continue;
					}

					await applyBtn.click();
					console.log('✅ Clicked the apply button.');

					// wait up to three seconds for a textarea element to appear in the dom
					try {
						await pageHandler.getMostRecentPage().waitForSelector('textarea', { timeout: 3000 });
					} catch (error) {
						if (error instanceof TimeoutError) {
							console.error('⚠️ TimeoutError: The application modal did not appear within 3 seconds');
						} else {
							console.error('⚠️ Unexpected error:', error);
						}

						console.log('❌ Skipping this job application.');
						continue;
					}

					// find the textarea element and type the message into it
					const textArea = await pageHandler.getMostRecentPage().$('textarea');

					if (!textArea) {
						console.log('❌ Could not find the application input box. Skipping this job application.');
						continue;
					}

					await textArea.type(msg);
					console.log('✅ Entered message into application input box.');
					await waitTime(1, 3);
					const sendBtn = await findBtnByTxt(pageHandler.getMostRecentPage(), 'Send');

					if (!(sendBtn instanceof ElementHandle)) {
						console.log('❌ Could not find the send button. Skipping this job application.');
						continue;
					}

					await sendBtn.click();
					console.log('✅ Clicked the send button.');

					try {
						await pageHandler.getMostRecentPage().waitForFunction(
							(btn) => btn.innerText === 'Applied',
							{ timeout: 3000 },
							applyBtn
						);
					}
					catch (error) {
						if (error instanceof TimeoutError) {
							console.error('⚠️ TimeoutError: The post-application page did not load within 3 seconds.');
						} else {
							console.error('⚠️ Unexpected error:', error);
						}

						console.log('❌ Skipping this job application.');
						continue;
					}

					console.log('🎉 Application sent successfully!');
					appliedCompanies.push(companyName);
					pageHandler.closeMostRecentPage();
				}
			}
		}

		console.log();
	}

	// after all the jobs have been applied to, log the new list of applied companies to the console
	const appliedCompaniesStr = appliedCompanies.length > 0 ? appliedCompanies.join(',') : 'none';
	console.log(`\n🔵 You have applied to the following companies:\n${appliedCompaniesStr}`);
}

try {
	await main();
} catch (error) {
	console.error('⚠️ An unexpected error occurred:', error);
} finally {
	// close the browser and all pages
	console.log('🔵 Closing the browser...');
	await pageHandler.closeBrowser();
}