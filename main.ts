import { TimeoutError } from 'puppeteer';

import { PageHandler } from './scripts/PageHandler.js';
import { findDivBtnByClass, findInputById, getAllJobLinks } from './scripts/parse.js';
import { getResponse } from './scripts/prompt.js';

const pageHandler = new PageHandler();

async function main(): Promise<void> {
	const loginUrl = 'https://account.ycombinator.com/?continue=https%3A%2F%2Fwww.workatastartup.com%2F';
	const ids = ['ycid-input', 'password-input'];
	const login = [process.env.YCUSER || 'foo', process.env.YCPSWD || 'bar'];

	const pageOpened = await pageHandler.openUrl(loginUrl);

	if (!pageOpened) {
		console.log('❌ Failure: Page not opened.');
		return;
	}

	try {
		for (let index = 0; index < ids.length; index++) {
			const found = await findInputById(pageHandler.pages[0], ids[index]);
			if (found) {
				await found.type(login[index]);
				console.log(`✅ Success: Entered value into input with ID: "${ids[index]}"`);
			} else {
				return;
			}
		}
	} catch (error) {
		console.error('⚠️ Error:', error);
		return;
	}

	const loginBtn = await findDivBtnByClass(pageHandler.pages[0], 'actions');

	// findDiveBtnByClass will return null and log an error if the button is not found
	if (!loginBtn) {
		return;
	}

	await loginBtn.click();
	console.log('✅ Clicked the login button.');

	try {
		console.log('🔵 Waiting for the page to load...');
		await pageHandler.pages[0].waitForSelector('body', { timeout: 5000 });
	} catch (error) {
		if (error instanceof TimeoutError) {
			console.error('⚠️ TimeoutError: Page load took longer than 5 seconds');
		} else {
			console.error('⚠️ Unexpected error:', error);
		}

		return;
	}

	const name = process.env.YCNAME || 'My profile';
	const nameFound = await pageHandler.pages[0].evaluate(() =>
		document.body.innerText.includes(name)
	);

	if (nameFound) {
		console.log('✅ Logged in');
	} else {
		console.log('❌ Login unsuccessful');
		return;
	}

	console.log('🔵 Starting search for roles...');
	await pageHandler.closePage(0);
	const searchUrl = process.env.SEARCH_URL || 'https://www.workatastartup.com/roles';
	const searchPageOpened = await pageHandler.openUrl(searchUrl);

	if (searchPageOpened) {
		console.log('✅ Search page opened successfully.');
	} else {
		return;
	}

	const jobLinks = await getAllJobLinks(pageHandler.pages[0]);

	if (jobLinks.length > 0) {
		console.log('✅ Found job links.');
	} else {
		console.log('❌ No job links found.');
		return;
	}

	const appMethodPrompt = `Here is a job description. Does it indicate any specific application
	method other than clicking the apply button? If so, describe the method in as few words as
	possible. If the method includes contact information or a link, include the contact information
	or link in your response. Your response should be a single word or phrase, or "none" if no
	specific method is	indicated.\n\n\n`;

	for (const link of jobLinks) {
		console.log();
		const jobPageOpened = await pageHandler.openUrl(link);

		if (jobPageOpened) {
			const jobText = await pageHandler.pages[1].evaluate(() => document.body.innerText);
			const jobLines = jobText.split('\n');
			const companyName = jobLines[2] || jobLines[0];// the third line is expected to be the job title and company's name
			console.log(`🟪 Company name: ${companyName}`);

			const appMethod = await getResponse(appMethodPrompt + jobText);

			if (appMethod) {
				console.log(`🟪 Application method: ${appMethod}`);
			} else {
				console.log('❌ Failed to get application method.');
			}

			// close the job page
			await pageHandler.closePage(1);
		} else {
			console.log(`❌ Failed to open job link: ${link}`);
		}
	}
}

await main();
await pageHandler.closeBrowser();
