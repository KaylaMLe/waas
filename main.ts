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

		const loginBtn = await findDivBtnByClass(pageHandler.pages[0], '.actions');
	} catch (error) {
		console.error('⚠️ Error:', error);
	} finally {
		await pageHandler.closePage(0);
	}
}

await main();
await pageHandler.closeBrowser();
