import { ElementHandle, Page } from 'puppeteer';

/**
 * Looks for a div containing the specified label on the page.
 * 
 * @param {Page} page - the page object to search
 * @param {string} label - the label to search for
 * @returns {Promise<ElementHandle<node> | null>} - the input element in the div if found, null otherwise
 */
export async function findDivInputWithLabel(page: Page, label: string): Promise<ElementHandle<Node> | null> {
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

/**
 * Looks for a button within a div with the specified class on the page.
 * 
 * @param {Page} page - the page object to search
 * @param {string} className - the class name to search for
 * @returns {Promise<ElementHandle<node> | null>} - the button element in the div if found, null otherwise
 */
export async function findDivBtnByClass(page: Page, className: string): Promise<ElementHandle<Node> | null> {
	try {
		const btnElement = await page.evaluateHandle((className) => {
			const divs = Array.from(document.querySelectorAll('div'));
			const foundDiv = divs.find(div => div.className === className);
			return foundDiv ? foundDiv.querySelector('button') : null;
		}, className);

		if (btnElement) {
			console.log(`✅ Found button element in div with class: "${className}"`);
		} else {
			console.log(`❌ No button element found in div with class: "${className}"`);
		}
		return btnElement.asElement();
	} catch (error) {
		console.error('⚠️ Error:', error);
		return null;
	}
}
