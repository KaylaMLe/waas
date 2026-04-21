import { checkAppMethod, compareJobs } from '../utils/aiUtils.js';
import logger from '../utils/logger.js';
import { searchForJobs } from './jobSearch.js';
import { handleMessageApprovalAndApplication } from './application.js';
import { checkJobApplicationStatus, waitForJobPageContent } from '../utils/parseUtils.js';
import { waitTime } from '../utils/utils.js';
import Company from '../classes/Company.js';
import Job from '../classes/Job.js';
import { PageHandler } from '../classes/PageHandler.js';
import { isTerminalListingState, type ListingState, type WaasRepository } from '../db/waasRepository.js';
import { canonicalizeJobUrl } from '../utils/jobUrl.js';

export async function runLiveSearchApply(pageHandler: PageHandler, repo: WaasRepository | null): Promise<void> {
	logger.log('info', '🔵 Starting search for roles...');
	const companyJobs = await searchForJobs(pageHandler);

	if (Object.keys(companyJobs).length === 0) {
		logger.log('info', '❌ No new jobs found');
		return;
	}

	const companyRecords: Record<string, Company> = {};

	for (const [companyName, jobLinks] of Object.entries(companyJobs)) {
		logger.log('info', `🔵 Processing company: ${companyName}`);

		if (!(companyName in companyRecords)) {
			companyRecords[companyName] = new Company(false);
		}

		for (const link of jobLinks) {
			logger.log('info', `${link}`);
			const canonical = canonicalizeJobUrl(link);

			let companyId: number | null = null;
			let jobId: number | null = null;

			if (repo) {
				companyId = repo.upsertCompanyByWaasKey(companyName);
				jobId = repo.upsertJobStub(companyId, canonical);
				const existing = repo.findJobByCanonicalUrl(canonical);
				if (existing && isTerminalListingState(existing.listing_state)) {
					logger.log(
						'info',
						`⏭️ Skipping job URL already in DB as "${existing.listing_state}": ${canonical}`
					);
					continue;
				}
			}

			const jobPageOpened = await pageHandler.openUrl(link);

			if (!jobPageOpened) {
				logger.log('error', '⚠️ Skipping this job page.');
				continue;
			}

			const jobPage = pageHandler.getMostRecentPage();
			await waitForJobPageContent(jobPage);
			const jobText = await jobPage.evaluate(() => document.body.innerText);
			logger.log('dump', jobText);
			const jobLines = jobText.split('\n');

			if (jobLines.length < 11) {
				logger.log('error', '⚠️ This job description is too short! Is it a valid job description?');
				continue;
			}

			const hasUnreadMessages = /^\d+$/.test(jobLines[3]);
			const position = hasUnreadMessages ? jobLines[11] : jobLines[10];
			logger.log('info', `🟪 ${position}`);

			const hasApplied = await checkJobApplicationStatus(pageHandler.getMostRecentPage());

			if (repo && companyId !== null && jobId !== null) {
				const listingState: ListingState = hasApplied ? 'applied_on_site' : 'open';
				repo.updateJobAfterLiveScrape({
					jobId,
					position,
					jdText: jobText,
					listingState,
				});
				if (hasApplied) {
					repo.recordApplication(companyId, jobId, 'waas_site');
				}
			}

			if (hasApplied) {
				logger.log('info', '❌ Already applied to this job.');
				companyRecords[companyName].applied = true;
			} else {
				companyRecords[companyName].jobs.push(new Job(position, link, jobText));
				logger.log('info', '✅ Job added to company record.');
			}

			console.log();
			await waitTime(5, 10);
			await pageHandler.closeMostRecentPage();

			if (companyRecords[companyName].applied) {
				break;
			}
		}
	}

	const appliedCompanies: string[] = [];
	const jobsWithOtherAppMethods: Job[] = [];

	for (const companyName in companyRecords) {
		const jobLinksForCompany = companyJobs[companyName] ?? [];
		const record = companyRecords[companyName];

		if (record.applied) {
			appliedCompanies.push(companyName);
			repo?.markCompanyBlockFullyProcessed(companyName);
		} else {
			let bestJob: Job | null = null;

			if (record.jobs.length > 1) {
				bestJob = await compareJobs(record.jobs);
			} else if (record.jobs.length === 1) {
				bestJob = record.jobs[0];
			} else {
				logger.log(
					'debug',
					`❌ No available jobs for ${companyName} (all jobs were already applied to or failed to load)`
				);
				if (jobLinksForCompany.length === 0) {
					repo?.markCompanyBlockFullyProcessed(companyName);
				}
				continue;
			}

			if (!bestJob) {
				logger.log('error', '⚠️ An error occurred while comparing jobs. Skipping this company.');
			} else {
				logger.log('info', `🟩 ${bestJob.position}: ${bestJob.link}`);
				const appMethod = await checkAppMethod(bestJob.desc);
				bestJob.appMethod = appMethod;

				if (!appMethod) {
					logger.log('error', '⚠️ Application method not parsed.Skipping this job.');
				} else if (appMethod === 'none') {
					const applicationSuccessful = await handleMessageApprovalAndApplication(
						pageHandler,
						companyName,
						bestJob
					);

					if (applicationSuccessful) {
						appliedCompanies.push(companyName);
						const canon = canonicalizeJobUrl(bestJob.link);
						if (repo) {
							const row = repo.findJobByCanonicalUrl(canon);
							if (row) {
								const cid = repo.upsertCompanyByWaasKey(companyName);
								repo.recordApplication(cid, row.id, 'live_search');
								repo.setJobListingState(row.id, 'tool_applied');
							}
						}
					}
					repo?.markCompanyBlockFullyProcessed(companyName);
				} else {
					logger.log(
						'info',
						`⏭️ Skipping application for "${bestJob.position}" at ${companyName} (application method is "${appMethod}").`
					);
					jobsWithOtherAppMethods.push(bestJob);
					repo?.markCompanyBlockFullyProcessed(companyName);
				}
			}

			console.log();
		}
	}

	if (jobsWithOtherAppMethods.length > 0) {
		logger.log('info', '📋 Jobs requiring different application methods:');

		for (const job of jobsWithOtherAppMethods) {
			logger.log('info', `\t${job.position}: ${job.appMethod}\n\t${job.link}`);
		}

		console.log();
	}

	const appliedCompaniesStr = appliedCompanies.join(',');
	logger.log('info', `✅ You have applied to the following companies:\n${appliedCompaniesStr}`);
}
