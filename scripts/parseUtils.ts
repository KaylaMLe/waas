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

export async function findBtnByTxt(page: Page, innerText: string): Promise<ElementHandle<HTMLButtonElement> | null> {
	try {
		const btnElement = await page.evaluateHandle((text) => {
			return Array.from(document.querySelectorAll('button')).find((btn) => btn.textContent?.trim() === text);
		}, innerText);

		if (btnElement instanceof ElementHandle) {
			logger.log('debug', `✅ Found button element with text: '${innerText}'\n`);
			return btnElement;
		} else {
			logger.log('warn', `❌ No button element found with text: '${innerText}'\n`);
			return null;
		}
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
				const jobAnchors = Array.from(block.querySelectorAll('a[href^="https://www.workatastartup.com/jobs/"]'));
				const jobLinks: string[] = [];

				for (const a of jobAnchors) {
					const link = a.getAttribute('href') as string; // the previous querySelector ensures this is never empty or undefined
					jobLinks.push(link);
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
export async function checkJobApplicationStatus(page: Page): Promise<boolean> {
	try {
		const applyBtn = await findDivByIdPrefix(page, 'ApplyButton');

		if (!applyBtn) {
			logger.log('warn', '❌ Apply button not found');
			return false;
		}

		const applyBtnTxt = await page.evaluate((btn) => btn.innerText, applyBtn);
		const hasApplied = applyBtnTxt === 'Applied';

		if (hasApplied) {
			logger.log('debug', '❌ Job has already been applied to');
		} else {
			logger.log('debug', '✅ Job has not been applied to yet');
		}

		return hasApplied;
	} catch (error) {
		logger.log('error', `⚠️ Error checking job application status: ${error}`);
		return false;
	}
}
