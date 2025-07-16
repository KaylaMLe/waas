import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const promptsData = yaml.load(fs.readFileSync(path.join(process.cwd(), 'prompts.yaml'), 'utf8')) as Record<
	string,
	string
>;

export const appMethodPrompt = promptsData.appMethodPrompt;
export const jobComparePrompt = promptsData.jobComparePrompt;
export const appMsgPrompt = promptsData.appMsgPrompt;
