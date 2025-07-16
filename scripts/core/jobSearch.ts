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
	logger.log('debug', `🔵 Scrolling ${scrollCount === Infinity ? 'infinitely' : scrollCount} times.`);

	const scrollAndWaitForLoading = async (page: Page, maxScrolls: number) => {
		let scrollsCompleted = 0;

		while (scrollsCompleted < maxScrolls) {
			// Check if loading indicator is present
			const loadingPresent = await page.evaluate(() => {
				return !!document.querySelector('div.loading.center');
			});

			if (!loadingPresent) {
				// No more results to load, break early
				logger.log('debug', `🔵 No more results after ${scrollsCompleted} scrolls.`);
				break;
			}

			// Get current scroll height before scrolling
			const scrollHeightBefore = await page.evaluate(() => document.body.scrollHeight);

			// Scroll until the loading indicator is visible
			await page.evaluate(() => {
				const loadingElement = document.querySelector('div.loading.center');
				if (loadingElement) {
					// Get the position of the loading indicator
					const rect = loadingElement.getBoundingClientRect();
					// If it's not visible (below the viewport), scroll to it
					if (rect.top > window.innerHeight) {
						window.scrollBy(0, rect.top - window.innerHeight + 100); // +100 for buffer
					}
				}
			});

			// Wait for scroll height to increase (meaning new content loaded)
			const heightIncreased = await page
				.waitForFunction(
					(previousHeight) => document.body.scrollHeight > previousHeight,
					{ timeout: 10000 },
					scrollHeightBefore
				)
				.then(() => true)
				.catch(() => false);

			if (!heightIncreased) {
				// No new content loaded, we're at the end
				logger.log('debug', `🔵 No new content loaded after ${scrollsCompleted + 1} scrolls.`);
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
