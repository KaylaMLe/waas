import { TimeoutError } from 'puppeteer';

import { getResponse } from './scripts/aiUtils.js';
import Company from './scripts/Company.js';
import Job from './scripts/Job.js';
import { PageHandler } from './scripts/PageHandler.js';
import { findDivBtnByClass, findDivTxtByIdPrefix, findInputById, getAllJobLinks } from './scripts/parse.js';
import { appMethodPrompt } from './scripts/prompts.js';
import { loadApplied, waitTime } from './scripts/utils.js';

const pageHandler = new PageHandler();

async function loggingIn(): Promise<boolean> {
	const loginUrl = 'https://account.ycombinator.com/?continue=https%3A%2F%2Fwww.workatastartup.com%2F';
	const pageOpened = await pageHandler.openUrl(loginUrl);

	if (!pageOpened) {
		console.log('❌ Login page not opened.');
		return false;
	}

	await waitTime(30, 60);

	const ids = ['ycid-input', 'password-input'];
	const login = [process.env.YCUSER || 'foo', process.env.YCPSWD || 'bar'];

	try {
		for (let index = 0; index < ids.length; index++) {
			const found = await findInputById(pageHandler.getMostRecentPage(), ids[index]);
			if (found) {
				await found.type(login[index]);
				console.log(`✅ Entered value into input with ID: "${ids[index]}"`);
				await waitTime(5, 10);
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

async function getJobLinks(): Promise<string[]> {
	const searchUrl = process.env.SEARCH_URL || 'https://www.workatastartup.com/companies';
	const searchPageOpened = await pageHandler.openUrl(searchUrl);

	if (!searchPageOpened) {
		return [];
	}

	await waitTime(30, 60);
	const jobLinks = await getAllJobLinks(pageHandler.getMostRecentPage());

	if (jobLinks.length > 0) {
		console.log(`✅ Found ${jobLinks.length} job links.`);
	} else {
		console.log('❌ No job links found.');
		const bodyText = await pageHandler.getMostRecentPage().evaluate(() => document.body.innerText);
		console.log(`Body text: ${bodyText}`);
	}

	return jobLinks;
}

async function checkAppMethod(jobText: string): Promise<string> {
	const methodResponse = await getResponse(appMethodPrompt + jobText);

	if (methodResponse) {
		console.log(`🟪 Application method: ${methodResponse}`);
	} else {
		console.log('❌ Failed to retrieve application method.');
	}

	const appMethod = methodResponse || 'error';

	return appMethod;
}

async function main(): Promise<void> {
	const loggedIn = await loggingIn();

	if (loggedIn) {
		console.log('✅ Logged in');
	} else {
		console.log('❌ Login unsuccessful');
		return;
	}

	await waitTime(30, 60);
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

		await waitTime();
		const jobText = await pageHandler.getMostRecentPage().evaluate(() => document.body.innerText);
		const jobLines = jobText.split('\n');

		// if the job description is too short, it won't have the expected info in the expected places
		if (jobLines.length < 3) {
			console.log('❌ This job description is too short! Is it a valid job description?');
			continue;
		}

		// check if I've already applied to a job at this company
		const position = jobLines[2];// the third line is expected to be the job title and company's name
		console.log(`🟪 ${position}`);
		const companyName = position.split(' at ')[1];

		// if the company name couldn't be parsed or if the company has already been applied to, skip this job
		if (!companyName || (companyName in companyRecords && companyRecords[companyName].applied)) {
			console.log(`❌ Either company name not found or already applied to ${companyName}`);
		} else {
			const applyBtnTxt = await findDivTxtByIdPrefix(pageHandler.getMostRecentPage(), 'ApplyButton');
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
			}
		}

		await pageHandler.closeMostRecentPage();
	}
}

await main();
await pageHandler.closeBrowser();
