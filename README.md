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
- A Y Combinator account
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

3. **Configure environment variables**:

   Create a `.env` file in the root directory and add your configuration:

   ```env
   SEARCH_URL="https://www.workatastartup.com/companies?..."
   APPLIED="Comma-separated list of companies you've already applied to"
   RESUME_PATH="Path to your resume PDF"
   SCROLL_COUNT="5"

   # Optional: Configure different AI models for each prompt type
   APP_METHOD_MODEL="gpt-4o-mini"
   JOB_COMPARE_MODEL="gpt-4o-mini"
   APP_MESSAGE_MODEL="gpt-4o-mini"
   ```

4. **Set up your OpenAI API key**:

   See the [OpenAI API Key Setup](#openai-api-key-setup) section below for detailed instructions on configuring your API key.

5. **Create the AI Prompts File**:

   Create a `prompts.yaml` file in the project root with your AI system prompts. See the [AI Prompts](#ai-prompts) section below for details and examples.

6. Build the TypeScript files:
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
    ├── core/            # Core application logic
    │   ├── application.ts # Application submission workflow
    │   ├── jobSearch.ts # Job discovery and filtering
    │   ├── login.ts     # Authentication handling
    │   └── mainStages.ts # Main workflow orchestration
    ├── utils/           # Utility modules
    │   ├── aiUtils.ts   # OpenAI integration for generating messages and job comparison
    │   ├── config.ts    # Configuration management for AI models
    │   ├── debugUtils.ts # Debugging utilities
    │   ├── logger.ts    # Logging functionality
    │   ├── parseUtils.ts # Functions for parsing web elements and infinite scrolling
    │   ├── prompts.ts   # Loads and exports AI prompts from prompts.yaml
    │   └── utils.ts     # Utility functions (e.g., wait time, console prompts)
    ├── __tests__/       # Test files organized by module type
    └── openAiClient.ts  # OpenAI client configuration
```

## Environment Variables

A `.env.example` file is provided in the root directory with all available environment variables and example values. Copy it to a `.env` file and customize the values for your setup.

### Required Variables

- `RESUME_PATH`: The absolute path to a PDF of your resume.

### Optional Variables

- `SEARCH_URL`: The URL of a WorkAtAStartup search page.
  - Opening up [the default search page](https://www.workatastartup.com/companies) and modifying the search criteria will modify the URL parameters. Copying and pasting the new URL into this environment variable will restrict the search to jobs that match these criteria.
- `APPLIED`: A comma-separated list of companies you've already applied to.
  - Each item should include both the company's name and batch indicator. (e.g., "Airbnb (W09)" instead of "Airbnb")
- `SCROLL_COUNT`: Number of times to scroll down to load more job listings.
  - Set to "inf" for infinite scrolling until no more results are available.
  - Default is "0" (no scrolling).
- `LOG_LEVEL`: Logging level for the application.
  - Options: `error`, `warn`, `info`, `debug`, `dump`
  - Default is `info`

### AI Model Configuration

You can configure different OpenAI models for each type of prompt. All default to `gpt-4o-mini`:

- `APP_METHOD_MODEL`: Model for analyzing job descriptions to detect application methods
- `JOB_COMPARE_MODEL`: Model for comparing multiple jobs to find the best fit
- `APP_MESSAGE_MODEL`: Model for generating application messages

## OpenAI API Key Setup

The script requires an OpenAI API key to generate application messages and analyze job descriptions. Here's how to set it up:

### Getting an OpenAI API Key

If you don't have an OpenAI API key:

1. Visit [OpenAI's API platform](https://platform.openai.com/api-keys)
2. Sign up or log in to your OpenAI account
3. Click "Create new secret key"
4. Copy the generated key

### Setting Up Your API Key

You can set up your API key in one of two ways:

**Option A: Using a .env file (Recommended)**

Add your API key to your `.env` file:

```env
OPENAI_API_KEY="your_openai_api_key_here"
```

**Option B: Using system environment variables**

Set the API key as a system environment variable:

- **Windows**: `set OPENAI_API_KEY=your_openai_api_key_here`
- **Linux/Mac**: `export OPENAI_API_KEY=your_openai_api_key_here`

⚠️ **Security Note**: Never commit your API key to version control. The `.env` file is already included in `.gitignore` to prevent accidental commits.

## AI Prompts

The script uses three AI system prompts to generate application messages and analyze job descriptions. Create a `prompts.yaml` file in the project root with the following structure:

### Required Prompt Keys

- `appMethodPrompt`: Analyzes job descriptions to detect alternative application methods (email, external links, etc.)
- `jobComparePrompt`: Compares multiple jobs at the same company to find the best fit for your profile
- `appMsgPrompt`: Generates personalized application messages based on job descriptions

A `prompts.example.yaml` file is provided in the root directory with example prompts for all three required keys. Copy it to `prompts.yaml` and customize the prompts for your needs:

```bash
cp prompts.example.yaml prompts.yaml
```

### Customization

You can modify these prompts to:

- Adjust the tone and style of generated application messages
- Change the criteria for job comparison
- Modify how alternative application methods are detected
- Add specific instructions for your industry or experience level

## Dependencies

- [Puppeteer](https://github.com/puppeteer/puppeteer): For browser automation.
- [OpenAI](https://github.com/openai/openai-node): For generating application messages and job comparison.
- [TypeScript](https://www.typescriptlang.org/): For type-safe development.
- [Winston](https://github.com/winstonjs/winston): For structured logging.
- [js-yaml](https://github.com/nodeca/js-yaml): For parsing YAML prompt files.
- [Jest](https://jestjs.io/): For comprehensive testing framework.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE.txt) file for details.
