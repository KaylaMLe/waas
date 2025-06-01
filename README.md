# WorkAtAStartup Automation Script

This project automates the process of applying to jobs on [WorkAtAStartup](https://www.workatastartup.com). It uses Puppeteer to interact with the website, OpenAI's GPT-4o-mini model to generate application messages, and a custom workflow to streamline the job application process.

## Features

- **Job Scraping**: Collects job listings from the WorkAtAStartup search page.
- **Application Tracking**: Tracks companies you've already applied to using the `APPLIED` environment variable.
- **AI-Powered Messaging**: Uses OpenAI's GPT model to generate personalized application messages.
- **User Approval**: Prompts the user to approve or modify the generated application message before submitting.
- **Error Handling**: Handles unexpected errors during the automation process and logs them for debugging.

## Prerequisites

- Node.js (v16 or later)
- npm (v7 or later)
- A valid Y Combinator account
- An OpenAI API key

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/KaylaMLe/waas.git
   cd waas
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and configure it with your environment variables:
   ```env
   SEARCH_URL="https://www.workatastartup.com/companies?..."
   APPLIED="Comma-separated list of companies you've already applied to"
   RESUME_PATH="Path to your resume PDF"
   ```
	⚠️ These credentials can be used to access your WorkAtAStartup account as well as view and modify account data. Practice extreme caution when using this tool.

4. Build the TypeScript files:
   ```bash
   npm run build
   ```

## Usage

1. Start the script:
   ```bash
   npm start
   ```

2. The script will:
   - Log into your Y Combinator account.
   - Scrape job listings from the search page.
   - Check if you've already applied to a company.
   - Use OpenAI to generate an application message.
   - Prompt you to approve or modify the message.
   - Submit the application.

3. After the script completes, it will log the list of companies you applied to.

## File Structure

```
.
├── .env                 # Environment variables
├── .gitignore           # Git ignore file
├── LICENSE.txt          # License information
├── main.ts              # Entry point of the application
├── package.json         # Project metadata and scripts
├── tsconfig.json        # TypeScript configuration
├── tsconfig.tsbuildinfo # TypeScript build information
└── scripts/             # Contains all the core modules
    ├── classes/         # Classes representing core entities
    │   ├── Company.ts   # Represents a company and its Jobs
    │   ├── Job.ts       # Represents a job listing
    │   └── PageHandler.ts # Puppeteer browser and page management
    ├── aiUtils.ts       # OpenAI integration for generating messages
    ├── debugUtils.ts    # Debugging utilities
    ├── parseUtils.ts    # Functions for parsing web elements
    ├── prompts.ts       # Predefined prompts for OpenAI
    └── utils.ts         # Utility functions (e.g., wait time, console prompts)
```

## Environment Variables

- `RESUME_PATH`: The absolute path to a PDF of your resume.
- `SEARCH_URL` [optional]: The URL of a WorkAtAStartup search page.
  - Opening up [the default search page](https://www.workatastartup.com/companies) and modifying the search criteria will modify the URL parameters. Copying and pasting the new URL into this environment variable will restrict the search to jobs that match these criteria.
- `APPLIED` [optional]: A comma-separated list of companies you've already applied to.
  - Each item should include both the company's name and batch indicator. (e.g., "Airbnb (W09)" instead of "Airbnb")

⚠️ Note: Login credentials (`YCUSER` and `YCPSWD`) are no longer required as the login process is now manual.

## Dependencies

- [Puppeteer](https://github.com/puppeteer/puppeteer): For browser automation.
- [OpenAI](https://github.com/openai/openai-node): For generating application messages.
- [TypeScript](https://www.typescriptlang.org/): For type-safe development.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE.txt) file for details.
