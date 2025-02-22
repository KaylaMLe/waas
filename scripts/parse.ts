import { ElementHandle, Page } from 'puppeteer';

/**
 * Finds an input element by its ID on the given Puppeteer page.
 * 
 * @param {Page} page - The Puppeteer page object to search within.
 * @param {string} id - The ID of the input element to find.
 * @returns {Promise<ElementHandle<Element> | null>} - A promise that resolves to the input element if found, or null if not found.
 */
export async function findInputById(page: Page, id: string): Promise<ElementHandle<Element> | null> {
	try {
		const inputElement = await page.$(`#${id}`);

		if (inputElement) {
			console.log(`✅ Found input element with ID: "${id}"`);
		} else {
			console.log(`❌ No input element found with ID: "${id}"`);
		}

		return inputElement;
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
export async function findDivBtnByClass(page: Page, className: string): Promise<ElementHandle<HTMLButtonElement> | null> {
	try {
		const foundDiv = await page.$(`div.${className}`);

		if (foundDiv) {
			console.log(`✅ Found div with class: "${className}"`);
		} else {
			console.log(`❌ No div with class: "${className}"`);
			return null;
		}

		const btnElement = await foundDiv?.$('button');

		if (btnElement) {
			console.log('✅ Found button element within div');
		} else {
			console.log('❌ No button element found within div');
			return null;
		}

		return btnElement;
	} catch (error) {
		console.error('⚠️ Error:', error);
		return null;
	}
}
