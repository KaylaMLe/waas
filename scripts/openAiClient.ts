import OpenAI from 'openai';

// Validate that the OpenAI API key is set
// --env-file loads .env into process.env, giving .env precedence over system variables
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
	console.error('❌ Error: OpenAI API key is not set.');
	console.error('Please set your OpenAI API key in one of the following ways:');
	console.error('  1. In your .env file: OPENAI_API_KEY=your_api_key_here');
	console.error('  2. As a system environment variable: OPENAI_API_KEY=your_api_key_here');
	console.error('');
	console.error('System environment variable setup:');
	console.error('  Windows: set OPENAI_API_KEY=your_api_key_here');
	console.error('  Linux/Mac: export OPENAI_API_KEY=your_api_key_here');
	process.exit(1);
}

// Create and export a singleton instance of OpenAI
const openai = new OpenAI();

export default openai;
