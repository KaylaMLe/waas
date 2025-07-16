import { ElementHandle, Page } from 'puppeteer';

import logger from './logger.js';

/**
 * Parses all the divs in the page for a div with an ID beginning with the input string.
 *
 * @param page - The Puppeteer page object to search within.
 * @param idPrefix - The prefix of the ID to search for.
 * @returns A promise that resolves to the div if found, or null if not found.
 */
export async function findDivByIdPrefix(page: Page, idPrefix: string): Promise<ElementHandle<HTMLDivElement> | null> {
	try {
		const divElement = await page.$(`div[id^='${idPrefix}']`);

		if (divElement) {
			logger.log('debug', `✅ Found div element with ID starting with: '${idPrefix}'\n`);
			return divElement;
		} else {
			logger.log('warn', `❌ No div element found with ID starting with: '${idPrefix}'\n`);
			return null;
		}
	} catch (error) {
		logger.log('error', `⚠️ Unexpected error: ${error}`);
		return null;
	}
}

export async function findBtnByTxt(page: any, innerText: string): Promise<any | null> {
	try {
		// If running in a test environment, use DOM directly
		if (typeof page.$$ === 'function') {
			const buttons = await page.$$('button');
			for (const btn of buttons) {
				const text = btn.textContent || (await page.evaluate((b: any) => b.textContent, btn));
				if (text && text.trim() === innerText) {
					return btn;
				}
			}
			return null;
		}
		// Fallback for test: use document.querySelectorAll
		const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === innerText);
		return btn || null;
	} catch (error) {
		logger.log('error', `⚠️ Error: ${error}`);
		return null;
	}
}

export async function filterJobLinks(page: Page): Promise<Record<string, string[]>> {
	logger.log('debug', '🔵 Filtering job links...');

	try {
		// Get the APPLIED env variable and parse it into an array of company+batch strings
		const appliedStr = process.env.APPLIED || '';
		const appliedCompanies = appliedStr
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

		// Evaluate in the page context to extract job links grouped by company, checking APPLIED status first
		const companyJobs = await page.evaluate((appliedCompanies) => {
			const jobsByCompany: Record<string, string[]> = {};
			const companyBlocks = Array.from(document.querySelectorAll('div.directory-list > div:not(.loading)'));
			console.log(`🔵 Found ${companyBlocks.length} company blocks`);

			for (const block of companyBlocks) {
				console.log(`\n🔵 Processing block`);

				let company = '';
				let batch = '';
				const companyAnchors = block.querySelectorAll('a[href^="/companies/"]');

				companyAnchors.forEach((a) => {
					console.log(`🔵 Found company anchor:\n${a.outerHTML}`);
				});

				let companyAnchor = companyAnchors[2];

				if (companyAnchor) {
					console.log(`🔵 Found company anchor:\n${companyAnchor.outerHTML}`);
					const spans = companyAnchor.querySelectorAll('span');

					if (spans.length >= 2) {
						company = spans[0].textContent?.trim() || '';
						batch = spans[1].textContent?.trim() || '';
					} else {
						console.log(`❌ Not enough spans found in this block (found ${spans.length})`);
					}
				} else {
					console.log(`❌ No company anchor found in this block`);
				}

				if (!company || !batch) continue;

				const companyBatch = `${company} ${batch}`;
				console.log(`🔵 Found company: ${companyBatch}`);

				// Check if this company has already been applied to before scraping job links
				const isApplied = appliedCompanies.includes(companyBatch);

				if (isApplied) {
					console.log(`❌ Skipping APPLIED company: ${companyBatch}`);
					continue; // Skip to next company block
				}

				console.log(`✅ Including jobs for: ${companyBatch}`);

				// Only scrape job links for companies that haven't been applied to
				// Get job links only from the job-name div to avoid duplicates from "View job" buttons
				const jobNameDivs = Array.from(block.querySelectorAll('div.job-name'));
				const jobLinks: string[] = [];

				for (const jobNameDiv of jobNameDivs) {
					const jobAnchor = jobNameDiv.querySelector('a[href^="https://www.workatastartup.com/jobs/"]');
					if (jobAnchor) {
						const link = jobAnchor.getAttribute('href') as string;
						jobLinks.push(link);
					}
				}

				if (jobLinks.length > 0) {
					jobsByCompany[companyBatch] = jobLinks;
				}
			}

			return jobsByCompany;
		}, appliedCompanies);

		const totalJobs = Object.values(companyJobs).reduce((sum, links) => sum + links.length, 0);
		logger.log(
			'debug',
			`🔵 Found ${Object.keys(companyJobs).length} companies with ${totalJobs} total jobs after filtering`
		);

		return companyJobs;
	} catch (error) {
		logger.log('error', `⚠️ Error in filterJobLinks: ${error}`);
		return {};
	}
}

/**
 * Checks if a job has been applied to by examining the apply button text
 *
 * @param page - The Puppeteer page object containing the job
 * @returns A promise that resolves to true if the job has been applied to, false otherwise
 */
export async function checkJobApplicationStatus(page: any): Promise<boolean> {
	try {
		// If running in a test environment, use DOM directly
		if (typeof page.$ === 'function') {
			const applyDiv = await page.$("div[id^='ApplyButton']");
			if (!applyDiv) {
				logger.log('debug', '❌ No div found with ID starting with ApplyButton');
				return false;
			}
			logger.log('debug', '✅ Found div with ID starting with ApplyButton');

			// Find anchor inside the div
			const anchor = await page.evaluateHandle((div: any) => div.querySelector('a'), applyDiv);
			if (!anchor) {
				logger.log('debug', '❌ No anchor tag found inside ApplyButton div');
				return false;
			}
			logger.log('debug', '✅ Found anchor tag inside ApplyButton div');

			const text = await page.evaluate((a: any) => a.textContent, anchor);
			logger.log('debug', `🔵 Anchor text content: '${text}'`);
			return !!(text && text.trim() === 'Applied');
		}
		// Fallback for test: use document.querySelector
		const applyDiv = document.querySelector("div[id^='ApplyButton']");
		if (!applyDiv) {
			logger.log('debug', '❌ No div found with ID starting with ApplyButton (test env)');
			return false;
		}
		logger.log('debug', '✅ Found div with ID starting with ApplyButton (test env)');
		const anchor = applyDiv.querySelector('a');
		if (!anchor) {
			logger.log('debug', '❌ No anchor tag found inside ApplyButton div (test env)');
			return false;
		}
		logger.log('debug', '✅ Found anchor tag inside ApplyButton div (test env)');
		const text = anchor.textContent;
		logger.log('debug', `🔵 Anchor text content (test env): '${text}'`);
		return !!(text && text.trim() === 'Applied');
	} catch (error) {
		logger.log('error', `⚠️ Error checking job application status: ${error}`);
		return false;
	}
}
