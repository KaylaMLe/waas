import { PageHandler } from './scripts/PageHandler.js';
import { findDivBtnByClass, findDivInputWithLabel } from './scripts/parse.js';

const url = 'https://account.ycombinator.com/?continue=https%3A%2F%2Fwww.workatastartup.com%2F';
const labels = ['Username or email', 'Password'];
const login = [process.env.YCUSER, process.env.YCPSWD];

const pageHandler = new PageHandler();

async function main() {
	const pageOpened = await pageHandler.openUrl(url);

	if (!pageOpened) {
		console.log('❌ Failure: Page not opened.');
		return;
	}

	try {
		await Promise.all(labels.map(async (label, index) => {
			const found = await findDivInputWithLabel(pageHandler.pages[0], label);
			if (found) {
				await found.type(login[index] || '');
				console.log(`✅ Success: Entered value ${login[index]} into input with label "${label}"`);
			} else {
				console.log(`❌ Failure: Page opened but div not found for label "${label}"`);
			}
		}));

		const loginBtn = await findDivBtnByClass(pageHandler.pages[0], 'actions');

		// findDiveBtnByClass will return null and log an error if the button is not found
		if (!loginBtn) {
			return;
		}

		await loginBtn.click();
		console.log('✅ Clicked the login button.');

		await pageHandler.pages[0].waitForFunction(() =>
			document.body.innerText.includes("We couldn't find a user with that username."),
			{ timeout: 5000 } // Wait up to 5 seconds
		);

		// check for the error message
		const errorMessageFound = await pageHandler.pages[0].evaluate(() =>
			document.body.innerText.includes("We couldn't find a user with that username.")
		);

		if (errorMessageFound) {
			console.log("❌ Error: We couldn't find a user with that username.");
		} else {
			console.log('✅ No error message found.');
		}
	} catch (error) {
		console.error('⚠️ Error:', error);
	} finally {
		await pageHandler.closePage(0);
	}
}

await main();
await pageHandler.closeBrowser();
