import puppeteer from 'puppeteer';

async function findDivWithLabel(url: string, label: string): Promise<boolean> {
	const browser = await puppeteer.launch({ headless: true }); // Runs in headless mode
	const page = await browser.newPage();

	try {
		console.log(`Opening ${url}...`);
		await page.goto(url, { waitUntil: 'domcontentloaded' });

		// Search for a div containing the label
		const divExists = await page.evaluate((label) => {
			const divs = Array.from(document.querySelectorAll('div'));
			return divs.some(div => div.textContent?.trim() === label);
		}, label);

		console.log(divExists ? `✅ Found div with label: "${label}"` : `❌ No div found with label: "${label}"`);

		return divExists;
	} catch (error) {
		console.error('Error:', error);
		return false;
	} finally {
		await browser.close();
	}
}

// Example usage
const url = 'https://account.ycombinator.com/?continue=https%3A%2F%2Fwww.workatastartup.com%2F';  // Replace with the actual URL
const label = 'Username or email';

findDivWithLabel(url, label).then(found => {
	if (found) {
		console.log('Success: Div found.');
	} else {
		console.log('Failure: Div not found.');
	}
});
