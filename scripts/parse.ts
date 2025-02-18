import { ElementHandle, Page } from 'puppeteer';

/**
 * Looks for a div containing the specified label on the page.
 * 
 * @param {Page} page - the page object to search
 * @param {string} label - the label to search for
 * @returns {Promise<ElementHandle<node> | null>} - the input element in the div if found, null otherwise
 */
export async function findDivWithLabel(page: Page, label: string): Promise<ElementHandle<Node> | null> {
	try {
		// Search for a div containing the label and return the first child input element
		const inputElement = await page.evaluateHandle((label) => {
			const divs = Array.from(document.querySelectorAll('div'));
			const div = divs.find(div => div.textContent?.trim() === label);
			return div ? div.querySelector('input') : null;
		}, label);

		if (inputElement) {
			console.log(`✅ Found input element within div with label: "${label}"`);
		} else {
			console.log(`❌ No input element found within div with label: "${label}"`);
		}
		return inputElement.asElement();
	} catch (error) {
		console.error('⚠️ Error:', error);
		return null;
	}
}