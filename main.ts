import { checkAppMethod, compareJobs } from './scripts/aiUtils.js';
import logger from './scripts/logger.js';
import { loggingIn, searchForJobs, handleMessageApprovalAndApplication } from './scripts/mainStages.js';
import { findDivByIdPrefix } from './scripts/parseUtils.js';
import { loadApplied, waitTime } from './scripts/utils.js';
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
	const jobLinks = await searchForJobs(pageHandler);

	if (jobLinks.length <= 0) {
		logger.log('info', '❌ No new jobs found');
		return;
	}

	// scrape job descriptions and check for companies already applied to
	const companyRecords = loadApplied();

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

		// check if I've already applied to a job at this company
		const hasUnreadMessages = /^\d+$/.test(jobLines[3]); // the unread msg count is the 4th line if there are any
		const position = hasUnreadMessages ? jobLines[11] : jobLines[10]; // the eleventh line is expected to be the job title and company's name
		logger.log('info', `🟪 ${position}`);
		const companyName = position.split(' at ')[1];

		// if the company name couldn't be parsed or if the company has already been applied to, skip this job
		if (!companyName) {
			logger.log('warn', '❌ Company name not found');
		} else if (companyName in companyRecords && companyRecords[companyName].applied) {
			logger.log('info', `❌ Already applied to ${companyName}`);
		} else {
			const applyBtn = await findDivByIdPrefix(pageHandler.getMostRecentPage(), 'ApplyButton');

			if (!applyBtn) {
				logger.log('error', '⚠️ Skipping this job page.');
				continue;
			}

			const applyBtnTxt = await pageHandler.getMostRecentPage().evaluate((btn) => btn.innerText, applyBtn);
			// if the apply button says 'Applied' and not 'Apply', it means I've already applied to this job
			const hasApplied = applyBtnTxt === 'Applied';

			if (!(companyName in companyRecords)) {
				companyRecords[companyName] = new Company(hasApplied);
			} else {
				companyRecords[companyName].applied = hasApplied;
			}

			if (hasApplied) {
				logger.log('info', '❌ Already applied to this job.');
			} else {
				companyRecords[companyName].jobs.push(new Job(position, link, jobText));
				logger.log('info', '✅ Job added to company record.');
			}
		}

		console.log();
		await waitTime(5, 10);
		await pageHandler.closeMostRecentPage();
	}

	const appliedCompanies = [];
	const jobsWithOtherAppMethods: Job[] = [];

	for (const companyName in companyRecords) {
		if (companyRecords[companyName].applied) {
			appliedCompanies.push(companyName);
		} else {
			// compare all jobs at this company and find the one that best fits my qualifications before applying
			// the only companies with zero jobs are the companies included in the APPLIED environment variable
			let bestJob: Job | null = null;

			if (companyRecords[companyName].jobs.length > 1) {
				bestJob = await compareJobs(companyRecords[companyName].jobs);
			} else {
				bestJob = companyRecords[companyName].jobs[0];
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
	logger.log('debug', '🔵 Closing the browser...');
	await pageHandler.closeBrowser();
}
