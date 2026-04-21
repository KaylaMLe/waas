import { describe, it, expect } from '@jest/globals';
import { canonicalizeJobUrl, DEFAULT_WAAS_BASE } from '../../utils/jobUrl';

describe('jobUrl', () => {
	it('canonicalizeJobUrl strips query and hash', () => {
		expect(canonicalizeJobUrl('/jobs/123?utm=1#x', DEFAULT_WAAS_BASE)).toBe(
			'https://www.workatastartup.com/jobs/123'
		);
	});

	it('canonicalizeJobUrl accepts absolute URLs', () => {
		expect(canonicalizeJobUrl('https://www.workatastartup.com/jobs/999?ref=1')).toBe(
			'https://www.workatastartup.com/jobs/999'
		);
	});
});
