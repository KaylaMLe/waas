/**
 * Configuration module for AI model settings
 */

export interface ModelConfig {
	appMethodModel: string;
	jobCompareModel: string;
	appMessageModel: string;
}

/**
 * Get the model configuration from environment variables
 * @returns ModelConfig object with model names for each prompt type
 */
export function getModelConfig(): ModelConfig {
	return {
		appMethodModel: process.env.APP_METHOD_MODEL || 'gpt-4o-mini',
		jobCompareModel: process.env.JOB_COMPARE_MODEL || 'gpt-4o-mini',
		appMessageModel: process.env.APP_MESSAGE_MODEL || 'gpt-4o-mini',
	};
}
