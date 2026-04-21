// Re-export functions from split modules for backward compatibility
export { loggingIn } from './login.js';
export { searchForJobs } from './jobSearch.js';
export { handleMessageApprovalAndApplication } from './application.js';
// Note: do not re-export liveSearchApply / storedApply here — they import aiUtils at load time,
// which pulls openAiClient and can call process.exit when OPENAI_API_KEY is unset (breaks Jest).
// Import those from ./liveSearchApply.js and ./storedApply.js instead (see main.ts).
