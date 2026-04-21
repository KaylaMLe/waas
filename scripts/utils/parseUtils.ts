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
 * Filters out companies that have already been applied to based on the APPLIED environment variable,
 * plus any additional directory keys (blocked, cooldown, recently processed blocks from the DB).
 *
 * @param page - The Puppeteer page object containing the WorkAtAStartup directory.
 * @param additionalExcludedCompanyKeys - WAAS directory keys (`company + " " + batch`) excluded beyond `APPLIED`.
 * @returns A promise that resolves to a record with company names as keys and arrays of job URLs as values.
 */
export async function filterJobLinks(
	page: Page,
	additionalExcludedCompanyKeys: string[] = []
): Promise<Record<string, string[]>> {
	logger.log('debug', '🔵 Filtering job links...');

	try {
		// Get the APPLIED env variable and parse it into an array of company+batch strings
		const appliedStr = process.env.APPLIED || '';
		const appliedCompanies = [
			...new Set([
				...appliedStr
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean),
				...additionalExcludedCompanyKeys.map((s) => s.trim()).filter(Boolean),
			]),
		];

		// Evaluate in the page context to extract job links grouped by company, checking APPLIED status first
		const { jobsByCompany: companyJobs, logs: pageLogs } = await page.evaluate((appliedCompanies) => {
			const logs: { level: 'debug' | 'warn'; message: string }[] = [];
			const pushLog = (level: 'debug' | 'warn', message: string) => {
				logs.push({ level, message });
			};

			const isCompanyProfilePath = (pathname: string) => {
				const segs = pathname.split('/').filter(Boolean);
				return segs.length === 2 && segs[0] === 'companies';
			};

			const resolveCompanyAnchor = (block: Element): HTMLAnchorElement | null => {
				const fromName = block.querySelector('span.company-name')?.closest('a');
				if (fromName instanceof HTMLAnchorElement) return fromName;

				const candidates = Array.from(block.querySelectorAll('a[href]')).filter((a): a is HTMLAnchorElement => {
					try {
						return (
							a instanceof HTMLAnchorElement &&
							isCompanyProfilePath(new URL(a.getAttribute('href') || '', document.baseURI).pathname)
						);
					} catch {
						return false;
					}
				});
				return candidates[0] ?? null;
			};

			const collectJobLinksForBlock = (block: Element): string[] => {
				const seen = new Set<string>();
				const out: string[] = [];

				const considerHref = (raw: string | null) => {
					if (!raw || !/\/jobs\/\d+/.test(raw)) return;
					try {
						const abs = new URL(raw, document.baseURI).href.replace(/[?#].*$/, '');
						if (!seen.has(abs)) {
							seen.add(abs);
							out.push(abs);
						}
					} catch {
						/* ignore invalid */
					}
				};

				// Legacy compact list markup
				for (const jobNameDiv of Array.from(block.querySelectorAll('div.job-name'))) {
					for (const a of Array.from(jobNameDiv.querySelectorAll('a[href]'))) {
						if (a instanceof HTMLAnchorElement) considerHref(a.getAttribute('href'));
					}
				}

				// Current React / Tailwind list: job title + "View job" share the same URL — dedupe by href
				if (out.length === 0) {
					for (const a of Array.from(block.querySelectorAll('a[href]'))) {
						if (a instanceof HTMLAnchorElement) considerHref(a.getAttribute('href'));
					}
				}

				return out;
			};

			const jobsByCompany: Record<string, string[]> = {};
			const companyBlocks = Array.from(document.querySelectorAll('div.directory-list > div:not(.loading)'));
			pushLog('debug', `🔵 Found ${companyBlocks.length} company blocks`);

			for (const block of companyBlocks) {
				pushLog('debug', '🔵 Processing block');

				let company = '';
				let batch = '';
				const companyAnchor = resolveCompanyAnchor(block);

				if (companyAnchor) {
					pushLog('debug', `🔵 Found company anchor for ${companyAnchor.querySelector('img')?.getAttribute('alt')}`);
					const spans = companyAnchor.querySelectorAll('span');

					if (spans.length >= 2) {
						company = spans[0].textContent?.trim() || '';
						batch = spans[1].textContent?.trim() || '';
					} else {
						pushLog('warn', `❌ Not enough spans found in this block (found ${spans.length})`);
					}
				} else {
					pushLog('warn', '❌ No company anchor found in this block');
				}

				if (!company || !batch) continue;

				const companyBatch = `${company} ${batch}`;
				pushLog('debug', `🔵 Found company: ${companyBatch}`);

				// Check if this company has already been applied to before scraping job links
				const isApplied = appliedCompanies.includes(companyBatch);

				if (isApplied) {
					pushLog('debug', `❌ Skipping APPLIED company: ${companyBatch}`);
					continue; // Skip to next company block
				}

				pushLog('debug', `✅ Including jobs for: ${companyBatch}`);

				const jobLinks = collectJobLinksForBlock(block);

				if (jobLinks.length > 0) {
					jobsByCompany[companyBatch] = jobLinks;
				}
			}

			return { jobsByCompany, logs };
		}, appliedCompanies);

		for (const { level, message } of pageLogs) {
			logger.log(level, message);
		}

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
