import fs from 'fs';
import { Page } from 'puppeteer';

/**
 * Saves the DOM content of the given Puppeteer page to an HTML file.
 * 
 * @param page - The Puppeteer page object to extract the DOM content from.
 * @param fileName - The name of the file (without extension) to save the DOM content to.
 * @returns A promise that resolves when the file has been written.
 */
export async function saveDom(page: Page, fileName: string): Promise<void> {
	const pageContent = await page.content();
	fs.writeFileSync(fileName + '.html', pageContent);
}
