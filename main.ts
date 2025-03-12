import { TimeoutError } from 'puppeteer';

import { getResponse } from './scripts/aiUtils.js';
import { PageHandler } from './scripts/PageHandler.js';
import { findDivBtnByClass, findInputById, getAllJobLinks } from './scripts/parse.js';
import { appMethodPrompt } from './scripts/prompts.js';
import { waitTime } from './scripts/utils.js';

const pageHandler = new PageHandler();

async function main(): Promise<void> {
	// logging in
	const loginUrl = 'https://account.ycombinator.com/?continue=https%3A%2F%2Fwww.workatastartup.com%2F';
	const ids = ['ycid-input', 'password-input'];
	const login = [process.env.YCUSER || 'foo', process.env.YCPSWD || 'bar'];

	const pageOpened = await pageHandler.openUrl(loginUrl);

	if (!pageOpened) {
		console.log('❌ Failure: Page not opened.');
		return;
	}

	await waitTime(30, 60);

	try {
		for (let index = 0; index < ids.length; index++) {
			const found = await findInputById(pageHandler.getMostRecentPage(), ids[index]);
			if (found) {
				await found.type(login[index]);
				console.log(`✅ Success: Entered value into input with ID: "${ids[index]}"`);
				await waitTime();
			} else {
				return;
			}
		}
	} catch (error) {
		console.error('⚠️ Error:', error);
		return;
	}

	const loginBtn = await findDivBtnByClass(pageHandler.getMostRecentPage(), 'actions');

	// findDiveBtnByClass will return null and log an error if the button is not found
	if (!loginBtn) {
		return;
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

		return;
	}

	const name = process.env.YCNAME || 'My profile';
	const nameFound = await pageHandler.getMostRecentPage().evaluate(() =>
		document.body.innerText.includes(name)
	);

	if (nameFound) {
		console.log('✅ Logged in');
	} else {
		console.log('❌ Login unsuccessful');
		return;
	}

	// retrieving links to job descriptions
	await waitTime(30, 60);
	console.log('🔵 Starting search for roles...');
	const searchUrl = process.env.SEARCH_URL || 'https://www.workatastartup.com/companies';
	const searchPageOpened = await pageHandler.openUrl(searchUrl);

	if (!searchPageOpened) {
		return;
	}

	await waitTime(30, 60);
	const jobLinks = await getAllJobLinks(pageHandler.getMostRecentPage());

	if (jobLinks.length > 0) {
		console.log(`✅ Found ${jobLinks.length} job links.`);
	} else {
		console.log('❌ No job links found.');
		const bodyText = await pageHandler.getMostRecentPage().evaluate(() => document.body.innerText);
		console.log(`Body text: ${bodyText}`);
		return;
	}

	// start parsing and analyzing job descriptions
	for (const link of jobLinks) {
		console.log(`\n${link}`);
		const jobPageOpened = await pageHandler.openUrl(link);

		if (jobPageOpened) {
			await waitTime();
			const jobText = await pageHandler.getMostRecentPage().evaluate(() => document.body.innerText);
			const jobLines = jobText.split('\n');

			if (jobLines.length < 3) {
				console.log('❌ This job description is too short! Is it a valid job description?');
				console.log(jobText);
			} else {
				const position = jobLines[2];// the third line is expected to be the job title and company's name
				console.log(`🟪 Position: ${position}`);

				const appMethod = await getResponse(appMethodPrompt + jobText);

				if (appMethod) {
					console.log(`🟪 Application method: ${appMethod}`);
				} else {
					console.log(`❌ Failed to open job link: ${link}`);
				}
			}

			await pageHandler.closeMostRecentPage();
		}
	}
}

await main();
await pageHandler.closeBrowser();
