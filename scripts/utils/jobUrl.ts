/** Default base for resolving relative WAAS job URLs (keep in sync with browser `document.baseURI` on WAAS). */
export const DEFAULT_WAAS_BASE = 'https://www.workatastartup.com/';

/**
 * Canonical job listing URL: absolute URL with query/hash stripped.
 * Mirrors `considerHref` in `parseUtils.ts` (`filterJobLinks` page.evaluate).
 */
export function canonicalizeJobUrl(href: string, baseUri: string = DEFAULT_WAAS_BASE): string {
	try {
		return new URL(href, baseUri).href.replace(/[?#].*$/, '');
	} catch {
		return href.replace(/[?#].*$/, '');
	}
}
