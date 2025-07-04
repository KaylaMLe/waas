# WorkAtAStartup Automation Script

This project automates the process of applying to jobs on [WorkAtAStartup](https://www.workatastartup.com). It uses Puppeteer to interact with the website, OpenAI's GPT-4o-mini model to generate application messages, and a custom workflow to streamline the job application process.

## Features

- **Job Scraping**: Collects job listings from the WorkAtAStartup search page with support for infinite scrolling.
- **Application Tracking**: Tracks companies you've already applied to using the `APPLIED` environment variable.
- **AI-Powered Messaging**: Uses OpenAI's GPT model to generate personalized application messages.
- **Job Comparison**: Automatically compares multiple jobs at the same company to find the best fit.
- **Application Method Detection**: Identifies jobs that require different application methods (email, external links, etc.).
- **User Approval**: Prompts the user to approve, modify, or skip the generated application message before submitting.
- **Infinite Scrolling**: Configurable scrolling to load more job listings before processing.
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
   SCROLL_COUNT="5"
   ```

   ⚠️ These credentials can be used to access your WorkAtAStartup account as well as view and modify account data. Practice extreme caution when using this tool.

4. Build the TypeScript files:
   ```bash
   npm run build
   ```

## Usage

1. **Start the script**:

   ```bash
   npm start
   ```

   Or use the convenient rebuild and restart command:

   ```bash
   npm run go
   ```

2. **Log in manually**:

   - A non-headless browser will open the Y Combinator login page.
   - Log in through the browser.
   - Return to the console and press Enter when prompted.

3. **Search for jobs**:

   - The script navigates to the job search page.
   - If `SEARCH_URL` is not defined in your `.env`, you'll be asked whether to continue with the default URL.

4. **Scrape and filter job listings**:

   - The script collects job links from the page with optional infinite scrolling.
   - Each job is examined to check:
     - If the job description is long enough
     - If you've already applied (via UI or the `APPLIED` environment variable)

5. **Review jobs and generate applications**:

   - For each valid, unvisited job:
     - The script uses OpenAI to generate a message.
     - You'll be shown the message and asked:
       ```
       Do you want to send this message to [CompanyName]?
       Type "Y" to approve, "N" to enter a different message, or "S" to skip:
       ```
     - If you select "N", you can type a custom message to send.
     - If you select "S", the job will be skipped.

6. **Submit the application**:

   - The message is typed into the application form.
   - The script attempts to click "Send" and confirms submission via the UI.
   - The job is marked as applied.

7. **Completion**:
   - After all jobs are processed, a summary of applied companies is printed to the console.
   - Jobs requiring different application methods are listed separately.
   - The browser is automatically closed.

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
    ├── aiUtils.ts       # OpenAI integration for generating messages and job comparison
    ├── debugUtils.ts    # Debugging utilities
    ├── logger.ts        # Logging functionality
    ├── mainStages.ts    # Core workflow stages (login, application)
    ├── parseUtils.ts    # Functions for parsing web elements and infinite scrolling
    ├── prompts.ts       # Predefined prompts for OpenAI
    └── utils.ts         # Utility functions (e.g., wait time, console prompts)
```

## Environment Variables

- `RESUME_PATH`: The absolute path to a PDF of your resume.
- `SEARCH_URL` [optional]: The URL of a WorkAtAStartup search page.
  - Opening up [the default search page](https://www.workatastartup.com/companies) and modifying the search criteria will modify the URL parameters. Copying and pasting the new URL into this environment variable will restrict the search to jobs that match these criteria.
- `APPLIED` [optional]: A comma-separated list of companies you've already applied to.
  - Each item should include both the company's name and batch indicator. (e.g., "Airbnb (W09)" instead of "Airbnb")
- `SCROLL_COUNT` [optional]: Number of times to scroll down to load more job listings.
  - Set to "inf" for infinite scrolling until no more results are available.
  - Default is "0" (no scrolling).

⚠️ Note: Login credentials (`YCUSER` and `YCPSWD`) are no longer required as the login process is now manual.

## Dependencies

- [Puppeteer](https://github.com/puppeteer/puppeteer): For browser automation.
- [OpenAI](https://github.com/openai/openai-node): For generating application messages and job comparison.
- [TypeScript](https://www.typescriptlang.org/): For type-safe development.
- [Winston](https://github.com/winstonjs/winston): For structured logging.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE.txt) file for details.
