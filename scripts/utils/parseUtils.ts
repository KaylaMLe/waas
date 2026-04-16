import { ElementHandle, Page } from 'puppeteer';

import logger from './logger.js';

/**
 * Finds a button element by its text content, supporting both Puppeteer pages and test environments.
 *
 * @param page - The Puppeteer page object or test environment context to search within.
 * @param innerText - The exact text content to search for in button elements.
 * @returns A promise that resolves to the button element if found, or null if not found.
 */
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

/** Exact text on the WAAS job-page apply CTA (`<a>Apply</a>`); after applying it becomes `Applied`. */
const JOB_APPLY_ANCHOR_TEXT = 'Apply' as const;
const JOB_APPLIED_ANCHOR_TEXT = 'Applied' as const;

/**
 * Finds the primary job apply link: an anchor whose visible text is exactly "Apply".
 */
export async function findApplyLink(page: Page): Promise<ElementHandle<HTMLAnchorElement> | null> {
	try {
		const anchors = await page.$$('a');
		for (const el of anchors) {
			const text = await page.evaluate((node: Element) => node.textContent?.trim() ?? '', el);
			if (text === JOB_APPLY_ANCHOR_TEXT) {
				logger.log('debug', `✅ Found apply anchor with text "${JOB_APPLY_ANCHOR_TEXT}"\n`);
				return el as ElementHandle<HTMLAnchorElement>;
			}
		}
		logger.log('warn', `❌ No anchor found with exact text "${JOB_APPLY_ANCHOR_TEXT}"\n`);
		return null;
	} catch (error) {
		logger.log('error', `⚠️ Unexpected error: ${error}`);
		return null;
	}
}

/**
 * Extracts and filters job links from the WorkAtAStartup directory page, grouped by company.
 * Filters out companies that have already been applied to based on the APPLIED environment variable.
 *
 * @param page - The Puppeteer page object containing the WorkAtAStartup directory.
 * @returns A promise that resolves to a record with company names as keys and arrays of job URLs as values.
 */
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
 * Waits for a WorkAtAStartup job URL to hydrate after navigation. `openUrl` only waits for
 * the load event; the app shell often renders job copy and the apply control later via JS.
 */
export async function waitForJobPageContent(page: Page): Promise<void> {
	try {
		await page.waitForFunction(
			(applyLabel: string, appliedLabel: string) => {
				const textLen = document.body?.innerText?.trim().length ?? 0;
				const hasApplyCta = Array.from(document.querySelectorAll('a')).some((a) => {
					const t = a.textContent?.trim();
					return t === applyLabel || t === appliedLabel;
				});
				return hasApplyCta && textLen > 200;
			},
			{ timeout: 45_000, polling: 250 },
			JOB_APPLY_ANCHOR_TEXT,
			JOB_APPLIED_ANCHOR_TEXT
		);
	} catch {
		logger.log(
			'warn',
			"⚠️ Job page did not show apply link and enough body text within 45s — innerText may still be empty or incomplete."
		);
	}
}

/**
 * Checks if a job has been applied to by examining the apply `<a>` (exact text `Applied`).
 * Supports both Puppeteer pages and test environments.
 *
 * @param page - The Puppeteer page object or test environment context containing the job
 * @returns A promise that resolves to true if the job has been applied to, false otherwise
 */
export async function checkJobApplicationStatus(page: any): Promise<boolean> {
	try {
		if (typeof page.evaluate === 'function') {
			const applied = await page.evaluate(
				(applyLabel: string, appliedLabel: string) => {
					const cta = Array.from(document.querySelectorAll('a')).find((a) => {
						const t = a.textContent?.trim();
						return t === applyLabel || t === appliedLabel;
					});
					return cta?.textContent?.trim() === appliedLabel;
				},
				JOB_APPLY_ANCHOR_TEXT,
				JOB_APPLIED_ANCHOR_TEXT
			);
			logger.log('debug', `🔵 Job apply CTA indicates already applied: ${applied}`);
			return !!applied;
		}
		const cta = Array.from(document.querySelectorAll('a')).find((a) => {
			const t = a.textContent?.trim();
			return t === JOB_APPLY_ANCHOR_TEXT || t === JOB_APPLIED_ANCHOR_TEXT;
		});
		const applied = cta?.textContent?.trim() === JOB_APPLIED_ANCHOR_TEXT;
		logger.log('debug', `🔵 Job apply CTA (test env) indicates already applied: ${applied}`);
		return applied;
	} catch (error) {
		logger.log('error', `⚠️ Error checking job application status: ${error}`);
		return false;
	}
}
