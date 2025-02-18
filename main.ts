import { openUrl } from './scripts/open.js';
import { findDivWithLabel } from './scripts/parse.js';

const url = 'https://account.ycombinator.com/?continue=https%3A%2F%2Fwww.workatastartup.com%2F';
const labels = ['Username or email', 'Password'];

openUrl(url).then(page => {
	if (page) {
		for (const label of labels) {
			findDivWithLabel(page, label).then(found => {
				if (found) {
					console.log(`***${process.env.YCUSER}`);
					console.log('✅ Success: Page opened and div found.');
				} else {
					console.log('❌ Failure: Page opened but div not found.');
				}
			});
		}
	} else {
		console.log('❌ Failure: Page not opened.');
	}
});
