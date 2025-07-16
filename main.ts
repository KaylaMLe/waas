import { checkAppMethod, compareJobs } from './scripts/utils/aiUtils.js';
import logger from './scripts/utils/logger.js';
import { loggingIn, searchForJobs, handleMessageApprovalAndApplication } from './scripts/core/mainStages.js';
import { checkJobApplicationStatus } from './scripts/utils/parseUtils.js';
import { waitTime } from './scripts/utils/utils.js';
import Company from './scripts/classes/Company.js';
import Job from './scripts/classes/Job.js';
import { PageHandler } from './scripts/classes/PageHandler.js';

const pageHandler = new PageHandler();

async function main(): Promise<void> {
	logger.log('info', '🔵 Logging in...');
	const loggedIn = await loggingIn(pageHandler);

	if (loggedIn) {
		logger.log('info', '✅ Logged in');
	} else {
		logger.log('error', '⚠️ Login unsuccessful');
		return;
	}

	await waitTime();
	logger.log('info', '🔵 Starting search for roles...');
	const companyJobs = await searchForJobs(pageHandler);

	if (Object.keys(companyJobs).length === 0) {
		logger.log('info', '❌ No new jobs found');
		return;
	}

	// scrape job descriptions and check for individual job application status
	const companyRecords: Record<string, Company> = {};

	// Process each company's jobs
	for (const [companyName, jobLinks] of Object.entries(companyJobs)) {
		logger.log('info', `🔵 Processing company: ${companyName}`);

		// Initialize company record
		if (!(companyName in companyRecords)) {
			companyRecords[companyName] = new Company(false);
		}

		// Process each job for this company
		for (const link of jobLinks) {
			logger.log('info', `${link}`);
			const jobPageOpened = await pageHandler.openUrl(link);

			if (!jobPageOpened) {
				logger.log('error', '⚠️ Skipping this job page.');
				continue;
			}

			const jobText = await pageHandler.getMostRecentPage().evaluate(() => document.body.innerText);
			logger.log('dump', jobText);
			const jobLines = jobText.split('\n');

			// if the job description is too short, it won't have the expected info in the expected places
			if (jobLines.length < 11) {
				logger.log('error', '⚠️ This job description is too short! Is it a valid job description?');
				continue;
			}

			const hasUnreadMessages = /^\d+$/.test(jobLines[3]); // the unread msg count is the 4th line if there are any
			const position = hasUnreadMessages ? jobLines[11] : jobLines[10]; // the eleventh line is expected to be the job title and company's name
			logger.log('info', `🟪 ${position}`);

			// Check if this job has been applied to
			const hasApplied = await checkJobApplicationStatus(pageHandler.getMostRecentPage());

			if (hasApplied) {
				logger.log('info', '❌ Already applied to this job.');
				// If any job at this company has been applied to, mark the company as applied
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

	const appliedCompanies = [];
	const jobsWithOtherAppMethods: Job[] = [];

	for (const companyName in companyRecords) {
		if (companyRecords[companyName].applied) {
			appliedCompanies.push(companyName);
		} else {
			// compare all jobs at this company and find the one that best fits my qualifications before applying
			// companies with zero jobs either had all jobs already applied to or encountered errors
			let bestJob: Job | null = null;

			if (companyRecords[companyName].jobs.length > 1) {
				bestJob = await compareJobs(companyRecords[companyName].jobs);
			} else if (companyRecords[companyName].jobs.length === 1) {
				bestJob = companyRecords[companyName].jobs[0];
			} else {
				logger.log(
					'debug',
					`❌ No available jobs for ${companyName} (all jobs were already applied to or failed to load)`
				);
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
					const applicationSuccessful = await handleMessageApprovalAndApplication(pageHandler, companyName, bestJob);

					if (applicationSuccessful) {
						appliedCompanies.push(companyName);
					}
				} else {
					// Store jobs with application methods other than "none" for later logging
					jobsWithOtherAppMethods.push(bestJob);
				}
			}

			console.log();
		}
	}

	// Log all jobs with application methods other than "none"
	if (jobsWithOtherAppMethods.length > 0) {
		logger.log('info', '📋 Jobs requiring different application methods:');

		for (const job of jobsWithOtherAppMethods) {
			logger.log('info', `\t${job.position}: ${job.appMethod}\n\t${job.link}`);
		}

		console.log();
	}

	// after all the jobs have been applied to, log the new list of applied companies to the console
	const appliedCompaniesStr = appliedCompanies.join(',');
	logger.log('info', `✅ You have applied to the following companies:\n${appliedCompaniesStr}`);
}

try {
	await main();
} catch (error) {
	logger.log('error', '⚠️ Unexpected error:', error);
} finally {
	// close the browser and all pages
	logger.log('info', '🔵 Closing the browser...');
	await pageHandler.closeBrowser();
}
