import { findDivWithLabel } from './open.js';

const url = 'https://account.ycombinator.com/?continue=https%3A%2F%2Fwww.workatastartup.com%2F';
const label = 'Username or email';

findDivWithLabel(url, label).then(found => {
	if (found) {
		console.log('Success: Div found.');
	} else {
		console.log('Failure: Div not found.');
	}
});
