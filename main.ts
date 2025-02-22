import { TimeoutError } from 'puppeteer';

import { PageHandler } from './scripts/PageHandler.js';
import { findDivBtnByClass, findInputById, getAllJobLinks } from './scripts/parse.js';

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
	pageHandler.closePage(0);
	const searchUrl = process.env.SEARCH_URL || 'https://www.workatastartup.com/roles';
	const searchPageOpened = await pageHandler.openUrl(searchUrl);

	if (searchPageOpened) {
		console.log('✅ Search page opened successfully.');
	} else {
		return;
	}

	const jobLinks = await getAllJobLinks(pageHandler.pages[0]);
	if (jobLinks.length > 0) {
		console.log('✅ Found job links:');
		jobLinks.forEach(link => console.log(link));
	} else {
		console.log('❌ No job links found.');
	}
}

await main();
await pageHandler.closeBrowser();
