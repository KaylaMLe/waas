import fs from 'fs';
import openai from '../openAiClient.js'; // Import the singleton instance
import Job from '../classes/Job.js';
import { appMethodPrompt, appMsgPrompt, jobComparePrompt } from './prompts.js';
import logger from './logger.js';
import { getModelConfig } from './config.js';

/**
 * Get a response from OpenAI's model.
 *
 * @param prompt - a string to send to the model as a message with the role of 'user'
 * @param model - the model to use (defaults to gpt-4o-mini)
 * @returns a promise that resolves to the model's response as a string, or null if an error occurs
 */
export async function getResponse(prompt: string, model: string = 'gpt-4o-mini'): Promise<string | null> {
	const response = await openai.chat.completions.create({
		model,
		messages: [{ role: 'user', content: prompt }],
	});

	return response.choices[0]?.message?.content ?? null;
}

/**
 * Get a response from OpenAI's model with a file attachment (currently supports PDF).
 *
 * @param sysPrompt - the system prompt to send to the model
 * @param infoPrompt - the user prompt to send to the model
 * @param filePath - the path to the file to be sent to the model
 * @param model - the model to use (defaults to gpt-4o-mini)
 * @returns a promise that resolves to the model's response as a string, or null if an error occurs
 */
export async function getResponseWithFile(
	sysPrompt: string,
	infoPrompt: string,
	filePath: string,
	model: string = 'gpt-4o-mini'
): Promise<string | null> {
	if (!fs.existsSync(filePath)) {
		logger.log('warn', `❌ File not found: ${filePath}`);
		return null;
	}

	const pdfData = fs.readFileSync(filePath);
	const base64Pdf = pdfData.toString('base64');

	const response = await openai.chat.completions.create({
		model,
		messages: [
			{
				role: 'system',
				content: sysPrompt,
			},
			{
				role: 'user',
				content: [
					{
						// @ts-ignore
						type: 'file',
						file: {
							filename: 'resume.pdf',
							file_data: `data:application/pdf;base64,${base64Pdf}`,
						},
					},
					{
						type: 'text',
						text: infoPrompt,
					},
				],
			},
		],
	});

	return response.choices[0].message.content;
}

/**
 * Analyzes the job description to determine the application method.
 *
 * @param jobText - the body text of the job posting page
 * @returns a promise that resolves to the application method if one is specified, 'none' otherwise, or null if an error occurs
 */
export async function checkAppMethod(jobText: string): Promise<string | null> {
	const config = getModelConfig();
	const methodResponse = await getResponse(appMethodPrompt + jobText, config.appMethodModel);
	return methodResponse;
}

/**
 * Compares multiple job descriptions to determine the best fit for the applicant.
 *
 * @param jobs - an array of Jobs to compare
 * @returns a promise that resolves to the best job if one is found, or null if no suitable job is found
 */
export async function compareJobs(jobs: Job[]): Promise<Job | null> {
	const config = getModelConfig();
	const formattedJobs = jobs.map((job) => `\`\`\`${job.link}\n-----\n${job.desc}\`\`\``).join('\n\n');

	const linkResponse = await getResponseWithFile(
		jobComparePrompt,
		formattedJobs,
		process.env.RESUME_PATH || 'resume.pdf',
		config.jobCompareModel
	);

	if (!linkResponse) {
		logger.log('warn', '❌ Failed to retrieve job comparison.');
		return null;
	} else {
		const bestJob = jobs.find((job) => job.link === linkResponse.trim());

		if (bestJob) {
			return bestJob;
		} else {
			logger.log('warn', `❌ No job matching the given link was found. Was the AI response valid?\n\n${linkResponse}`);
			return null;
		}
	}
}

/**
 * Generates an application message based on the job description and prints it to the console.
 *
 * @param jobDesc - the body text of the job posting page
 * @returns a promise that resolves to the application message if one is generated, or null if an error occurs
 */
export async function writeAppMsg(jobDesc: string): Promise<string | null> {
	const config = getModelConfig();
	const msgResponse = await getResponseWithFile(
		appMsgPrompt,
		jobDesc,
		process.env.RESUME_PATH || 'resume.pdf',
		config.appMessageModel
	);

	if (msgResponse) {
		logger.log('info', `🟩 Application message: ${msgResponse}`);
	} else {
		logger.log('warn', '❌ Failed to retrieve application message.');
	}

	return msgResponse;
}
