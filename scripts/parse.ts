import { ElementHandle, Page } from 'puppeteer';

/**
 * Finds an input element by its ID on the given Puppeteer page.
 * 
 * @param page - The Puppeteer page object to search within.
 * @param id - The ID of the input element to find.
 * @returns A promise that resolves to the input element if found, or null if not found.
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
 * @param page - the page object to search
 * @param className - the class name to search for
 * @returns the button element in the div if found, null otherwise
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

/**
 * Parses the page for all anchor tags with hrefs starting with "https://www.workatastartup.com/jobs/"
 * 
 * @param page - The Puppeteer page object to search within.
 * @returns A promise that resolves to an array of job links.
 */
export async function getAllJobLinks(page: Page): Promise<string[]> {
	const jobLinks = await page.evaluate(() => {
		const anchors = Array.from(document.querySelectorAll('a[href^="https://www.workatastartup.com/jobs/"]'));
		return anchors
			.map(anchor => anchor.getAttribute('href'));
	});

	return jobLinks as string[];
}

/**
 * Parses all the divs in the page for a div with an ID beginning with the input string.
 * 
 * @param page - The Puppeteer page object to search within.
 * @param idPrefix - The prefix of the ID to search for.
 * @returns A promise that resolves to the text content of the div if found, or null if not found.
 */
export async function findDivTxtByIdPrefix(page: Page, idPrefix: string): Promise<string | null> {
	try {
		const divElement = await page.$(`div[id^="${idPrefix}"]`);

		if (divElement) {
			console.log(`✅ Found div element with ID starting with: "${idPrefix}"`);
			const textContent = await page.evaluate(div => div.textContent, divElement);
			return textContent;
		} else {
			console.log(`❌ No div element found with ID starting with: "${idPrefix}"`);
			return null;
		}
	} catch (error) {
		console.error('⚠️ Unexpected error:', error);
		return null;
	}
}


