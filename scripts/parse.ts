import { Page } from 'puppeteer';

/**
 * Looks for a div containing the specified label on the page.
 * 
 * @param {Page} page - the page object to search
 * @param {string} label - the label to search for
 * @returns {boolean} - true if a div containing the label was found, false otherwise
 */
export async function findDivWithLabel(page: Page, label: string): Promise<boolean> {
	try {
		// Search for a div containing the label
		const divExists = await page.evaluate((label) => {
			const divs = Array.from(document.querySelectorAll('div'));
			return divs.some(div => div.textContent?.trim() === label);
		}, label);

		console.log(divExists ? `✅ Found div with label: "${label}"` : `❌ No div found with label: "${label}"`);
		return divExists;
	} catch (error) {
		console.error('⚠️ Error:', error);
		return false;
	} finally {
		await page.browser().close();
	}
}
