/**
 * Block one or more WAAS directory company keys and delete their saved jobs and applications.
 *
 * Usage (from repo root, after build):
 *   npm run block-company -- "CompanyName W24" "OtherCo S25"
 *
 * Optional reason (shown in DB only):
 *   BLOCK_REASON="no longer hiring remote" npm run block-company -- "Co W24"
 */

import { getWaasRepository, isWaasDbSkipped } from '../db/waasRepository.js';

function main(): void {
	if (isWaasDbSkipped()) {
		console.error('The database is disabled (SKIP_WAAS_DB=1). Unset it to use block-company.');
		process.exit(1);
	}

	const waasKeys = process.argv.slice(2).map((s) => s.trim()).filter(Boolean);
	if (waasKeys.length === 0) {
		console.error('Usage: npm run block-company -- "<WAAS directory key>" ["<another key>" ...]');
		console.error('Example: npm run block-company -- "Acme Robotics W24"');
		console.error('Keys must match the string WAAS shows (company name + batch), same as APPLIED.');
		process.exit(1);
	}

	const reason = (process.env.BLOCK_REASON || '').trim() || null;
	const repo = getWaasRepository();
	if (!repo) {
		console.error('Could not open WAAS database.');
		process.exit(1);
	}

	for (const key of waasKeys) {
		const deleted = repo.blockCompanyAndPurgeSavedJobs(key, reason);
		console.log(`Blocked and purged: "${key}" (removed ${deleted.jobsRemoved} job(s), ${deleted.applicationsRemoved} application row(s)).`);
	}
}

main();
