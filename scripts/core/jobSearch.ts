import logger from '../utils/logger.js';
import { consolePrompt, waitTime } from '../utils/utils.js';
import { PageHandler } from '../classes/PageHandler.js';
import { filterJobLinks } from '../utils/parseUtils.js';
import { Page } from 'puppeteer';

/**
 * Retrieves all job links from the page by parsing anchor tags with hrefs starting with a specific URL pattern.
 *
 * @param pageHandler - An instance of PageHandler to manage Puppeteer pages.
 * @returns A promise that resolves to an array of job link URLs.
 */
export async function searchForJobs(pageHandler: PageHandler): Promise<Record<string, string[]>> {
	if (!process.env.SEARCH_URL) {
		logger.log('warn', '❌ No SEARCH_URL found in environment variables.');
		await consolePrompt('🔵 Press CTRL + C to quit or any key to use the default search URL.');
	}

	const searchUrl = process.env.SEARCH_URL || 'https://www.workatastartup.com/companies';
	const searchPageOpened = await pageHandler.openUrl(searchUrl);

	if (!searchPageOpened) {
		return {};
	}

	await waitTime();

	const page = pageHandler.getMostRecentPage();
	const scrollCountStr = process.env.SCROLL_COUNT || '0';
	const scrollCount = scrollCountStr === 'inf' ? Infinity : parseInt(scrollCountStr, 10);
	logger.log('debug', `🔵 Scrolling ${scrollCount === Infinity ? 'infinitely many' : scrollCount} times.`);

	const scrollAndWaitForLoading = async (page: Page, maxScrolls: number) => {
		let scrollsCompleted = 0;

		while (scrollsCompleted < maxScrolls) {
			// Check if loading indicator is present
			const loadingPresent = await page.evaluate(() => {
				return !!document.querySelector('div.loading');
			});

			if (!loadingPresent) {
				// No more results to load, break early
				logger.log('debug', `✅ Loading indicator not found after ${scrollsCompleted} scrolls.`);
				break;
			}

			// Capture page height, then scroll so the sentinel loader can trigger fetch (same
			// selectors as loading check — avoid div.loading.center-only, which often matches nothing).
			const scrollHeightBefore = await page.evaluate(() => {
				const pageScrollHeight = () =>
					Math.max(
						document.body?.scrollHeight ?? 0,
						document.documentElement?.scrollHeight ?? 0
					);

				const before = pageScrollHeight();

				const loading = document.querySelector('div.loading') as HTMLElement | null;

				if (loading) {
					loading.scrollIntoView({ block: 'end', inline: 'nearest' });
				}

				const maxTop = Math.max(0, pageScrollHeight() - window.innerHeight);
				window.scrollTo({ top: maxTop, left: 0, behavior: 'auto' });

				return before;
			});

			// Wait for scroll height to increase (meaning new content loaded)
			const heightIncreased = await page
				.waitForFunction(
					(previousHeight) => {
						const h = Math.max(
							document.body?.scrollHeight ?? 0,
							document.documentElement?.scrollHeight ?? 0
						);
						return h > previousHeight;
					},
					{ timeout: 10000 },
					scrollHeightBefore
				)
				.then(() => true)
				.catch(() => false);

			if (!heightIncreased) {
				// No new content loaded, we're at the end
				logger.log('debug', `⚠️ No new content loaded (page height did not increase) after ${scrollsCompleted} scrolls. Did scrolling actually take place?`);
				break;
			}

			scrollsCompleted++;

			// Small delay to allow content to settle
			await new Promise((resolve) => setTimeout(resolve, 200));
		}

		logger.log('debug', `🔵 Completed ${scrollsCompleted} scrolls.`);
	};

	if (scrollCount > 0) {
		await scrollAndWaitForLoading(page, scrollCount);
	}

	const jobLinks = await filterJobLinks(page);

	return jobLinks;
}
