import { openUrl } from './open.js';
import { findDivWithLabel } from './parse.js';

const url = 'https://account.ycombinator.com/?continue=https%3A%2F%2Fwww.workatastartup.com%2F';
const label = 'Username or email';

openUrl(url).then(page => {
	if (page) {
		findDivWithLabel(page, label).then(found => {
			if (found) {
				console.log('✅ Success: Page opened and div found.');
			} else {
				console.log('❌ Failure: Page opened but div not found.');
			}
		});
	} else {
		console.log('❌ Failure: Page not opened.');
	}
});
