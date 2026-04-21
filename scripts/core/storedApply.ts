import logger from '../utils/logger.js';
import { PageHandler } from '../classes/PageHandler.js';
import {
	getStaleLinkVerifyMs,
	type WaasRepository,
} from '../db/waasRepository.js';
import Job from '../classes/Job.js';
import { handleMessageApprovalAndApplication } from './application.js';
import {
	checkJobApplicationStatus,
	findApplyLink,
	waitForJobPageContent,
} from '../utils/parseUtils.js';

export async function runStoredApplyQueue(pageHandler: PageHandler, repo: WaasRepository): Promise<void> {
	const candidates = repo.listStoredApplyCandidates();

	if (candidates.length === 0) {
		logger.log('info', '❌ No stored jobs eligible for apply');
		return;
	}

	const staleMs = getStaleLinkVerifyMs();
	const now = Date.now();

	for (const c of candidates) {
		logger.log('info', `🔵 Stored job: ${c.company_waas_key} — ${c.canonical_url}`);
		const job = new Job(c.position || 'Unknown position', c.canonical_url, c.jd_text);

		const lastV = c.last_verified_at ? Date.parse(c.last_verified_at) : NaN;
		const needsVerify = !Number.isFinite(lastV) || now - lastV >= staleMs;

		let reusePage = false;

		if (needsVerify) {
			const opened = await pageHandler.openUrl(c.canonical_url);
			if (!opened) {
				logger.log('warn', '⚠️ Could not open listing; marking job gone.');
				repo.updateJobAfterVerification(c.job_id, null, 'gone');
				continue;
			}

			const page = pageHandler.getMostRecentPage();
			await waitForJobPageContent(page);

			const applied = await checkJobApplicationStatus(page);
			if (applied) {
				logger.log('info', '❌ Listing shows already applied (WAAS).');
				repo.updateJobAfterVerification(c.job_id, null, 'applied_on_site');
				repo.recordApplication(c.company_id, c.job_id, 'waas_site');
				await pageHandler.closeMostRecentPage();
				continue;
			}

			const applyLink = await findApplyLink(page);
			if (!applyLink) {
				logger.log('warn', '⚠️ No Apply CTA; marking job gone.');
				repo.updateJobAfterVerification(c.job_id, null, 'gone');
				await pageHandler.closeMostRecentPage();
				continue;
			}

			const jdText = await page.evaluate(() => document.body.innerText);
			repo.updateJobAfterVerification(c.job_id, jdText, 'open');
			reusePage = true;
		}

		const applicationSuccessful = await handleMessageApprovalAndApplication(
			pageHandler,
			c.company_waas_key,
			job,
			reusePage ? { reuseCurrentJobPage: true } : undefined
		);

		if (applicationSuccessful) {
			repo.recordApplication(c.company_id, c.job_id, 'stored_queue');
			repo.setJobListingState(c.job_id, 'tool_applied');
			logger.log('info', `✅ Stored-queue application recorded for job id ${c.job_id}`);
		}

		console.log();
	}
}
