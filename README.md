# WorkAtAStartup Automation Script

This project automates the process of applying to jobs on [WorkAtAStartup](https://www.workatastartup.com). It uses Puppeteer to drive the site, OpenAI models (defaults in `.env.example`) to compare jobs and draft messages, a local **SQLite** database for persistence when enabled, and an interactive approve-or-edit step before anything is sent.

## Features

- **Job scraping**: Collects job listings from the WorkAtAStartup search page with optional infinite scrolling (`SCROLL_COUNT`).
- **SQLite database** (default): Persists companies, job URLs (deduplicated), full job descriptions, and application history under `.waas-data/` (configurable). Supports post-application **cooldowns**, **permanent company blocks**, and skipping directory rows for companies whose block was **fully processed recently** (default 24 hours).
- **Legacy mode**: Set `SKIP_WAAS_DB=1` to disable the database and rely only on the `APPLIED` env list for directory filtering (same behavior as older releases).
- **Run modes**: `RUN_MODE=live` (directory search, then apply) or `RUN_MODE=stored` (walk saved jobs from the database; re-verifies stale listings before drafting a message).
- **Application tracking**: `APPLIED` is still supported and is **merged** with database-driven exclusions (blocked, cooldown, recent block) when the DB is enabled.
- **AI-powered messaging**: Uses your configured OpenAI model to draft application messages.
- **Job comparison**: Compares multiple open jobs at the same company to pick the best fit.
- **Application method detection**: Flags jobs that need a different path (email, external apply, etc.).
- **User approval**: You approve, edit, or skip each message before it is sent.
- **Logging**: Winston-based logs for debugging.

## Prerequisites

- **Node.js** (v18 or later recommended; v16+ may work). [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) includes native code and may require a C++ toolchain on some systems (for example `build-essential` on Debian/Ubuntu/Linux Mint).
- **npm** (v7 or later)
- A **Y Combinator** account (used to log in to WorkAtAStartup)
- An **OpenAI API key** (for message generation, job comparison, and application-method checks)
- A **resume PDF** on disk (`RESUME_PATH` in `.env`)

## First-time setup

Do these steps once per machine (or after a fresh clone).

1. **Clone and enter the project**
  ```bash
   git clone https://github.com/KaylaMLe/waas.git
   cd waas
  ```
2. **Install dependencies**
  ```bash
   npm install
  ```
   If `better-sqlite3` fails to compile, install your distro’s build tools, then run `npm install` again (on Mint/Ubuntu: `sudo apt install build-essential`).
3. **Create your environment file**
  Copy the example and edit values:
   At minimum set `**OPENAI_API_KEY`** and `**RESUME_PATH**` (absolute path to your PDF). See [Environment variables](#environment-variables) and [OpenAI API Key Setup](#openai-api-key-setup) for the full list.
4. **Create your prompts file**
  ```bash
   cp prompts.example.yaml prompts.yaml
  ```
   Edit `prompts.yaml` for your voice and criteria. Details: [AI Prompts](#ai-prompts).
5. **Build TypeScript**
  ```bash
   npm run build
  ```
6. **Database (default)**
  On first run with the database **enabled** (default), the app creates a SQLite file at the project root under the `.waas-data/` directory (default file name `waas.db`; set `WAAS_DB_PATH` to use another path). No separate migration command is required. To run **without** a database, set `SKIP_WAAS_DB=1` in `.env` and use `APPLIED` for directory skips only.

You are now ready to [run the app](#usage).

## Usage

### Commands


| Command         | What it does                                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run go`    | Runs `npm run build`, then starts the app (`node --env-file=.env ./dist/main.js`). **Use this for day-to-day runs** so `.env` is loaded and TypeScript is up to date. |
| `npm start`     | Starts compiled `dist/main.js` with `.env`. Run `npm run build` first if you changed TypeScript.                                                                      |
| `npm run build` | Compiles TypeScript to `dist/`.                                                                                                                                       |
| `npm test`      | Runs the Jest suite.                                                                                                                                                  |


### `RUN_MODE`: live vs stored

Set in `.env` (see `[.env.example](.env.example)`).

- `**RUN_MODE=live`** (default): Log in → open `SEARCH_URL` (or the default companies page) → scroll if configured → collect directory rows → for each company/job URL, scrape listings, compare roles when needed, then walk you through apply for in-app (“none”) methods. Writes to the SQLite DB when it is enabled (job rows, applications, company block timestamps, etc.).
- `**RUN_MODE=stored**`: Does **not** crawl the directory. Reads eligible saved jobs from the database and runs the apply flow for each. **Requires** the database (do **not** set `SKIP_WAAS_DB=1`). Listings whose last verification is older than `**STALE_LINK_DAYS`** are opened in the browser **before** a new message is generated, so dead links are less likely to waste a draft.

### Typical live run (interactive)

1. Run `**npm run go`** from the project root.
2. **Log in**: A visible browser opens the Y Combinator login flow. Complete login, then return to the terminal and press Enter when prompted.
3. **Search**: The script opens your `SEARCH_URL`, or the default [companies](https://www.workatastartup.com/companies) page if unset (you may get a console prompt to continue).
4. **Directory filtering**: Companies listed in `**APPLIED`** plus any exclusions from the DB (blocked, cooldown, or “block fully processed” within `**COMPANY_BLOCK_RECENT_HOURS**`) are skipped when collecting links.
5. **Per job**: Opens each listing (skips URLs already stored in a terminal state such as already applied on-site, gone, or previously applied through this tool), checks length and apply state, optionally records applications observed on the site.
6. **Apply path**: For the best in-browser apply target, the model drafts a message; you **Y** / **N** (edit) / **S** (skip). On success, the DB records the application and updates the job row.
7. **End of run**: Applied companies are printed; jobs that need a different application method are listed. The browser closes.

### After a run

- Keep using `**APPLIED`** if you like, or rely increasingly on the DB for cooldowns and history.
- The default DB path is under `**.waas-data/**` (gitignored); back it up if you care about history.
- Use `**RUN_MODE=stored**` when you want to work through a saved queue with stale-link checks.

### Running tests

```bash
npm test
```

Uses the same `tsconfig` / Jest setup as CI; no browser is launched.

## File structure

```
.
├── .env                 # Your secrets and config (not committed)
├── .env.example         # Documented defaults — copy to .env
├── prompts.yaml         # Your AI system prompts (not committed by default)
├── prompts.example.yaml # Example prompts — copy to prompts.yaml
├── main.ts              # Entry point (live vs stored mode, login, then run)
├── package.json
├── tsconfig.json
├── .waas-data/          # Created at runtime: SQLite DB (gitignored)
└── scripts/
    ├── classes/         # Company, Job, PageHandler
    ├── core/
    │   ├── application.ts    # In-browser apply + message approval
    │   ├── jobSearch.ts      # Open search URL, scroll, filter links
    │   ├── liveSearchApply.ts # Live directory run (scrape, compare, apply)
    │   ├── storedApply.ts    # RUN_MODE=stored queue
    │   ├── login.ts
    │   └── mainStages.ts     # Re-exports core pieces for older imports
    ├── db/
    │   ├── waasDb.ts         # SQLite open + paths
    │   └── waasRepository.ts # Schema, queries, directory exclusions
    ├── utils/           # aiUtils, parseUtils, jobUrl, logger, etc.
    ├── __tests__/
    └── openAiClient.ts
```

## Environment variables

Copy `[.env.example](.env.example)` to `.env` and adjust values. Below is a concise reference; the example file stays in sync with the code.

### Required for normal runs

- `OPENAI_API_KEY`: API key for OpenAI (see [OpenAI API Key Setup](#openai-api-key-setup)). Can be omitted only for workflows that never load the client; the main app expects it.
- `RESUME_PATH`: Absolute path to your resume PDF (used where the tooling reads your resume).

### Search and directory behavior

- `SEARCH_URL`: WorkAtAStartup search or companies URL. Tweak filters on [the companies page](https://www.workatastartup.com/companies), copy the URL, paste it here.
- `APPLIED`: Comma-separated **directory keys** for companies to skip on the search page (same strings the site shows as company name + batch, for example `Acme W24`). When the database is enabled, this list is **merged** with DB exclusions; it is still useful for one-off overrides or migration from older setups.
- `SCROLL_COUNT`: How many times to scroll to load more directory rows; `inf` loads until the page stops growing. Default `0`.

### Database and run mode

- `SKIP_WAAS_DB`: Set to `1` to disable SQLite entirely (no `.waas-data/` writes; directory filtering uses only `APPLIED`).
- `WAAS_DB_PATH`: Optional full path to the SQLite file. If unset, the default is a `waas.db` file inside `.waas-data/` under the project root.
- `RUN_MODE`: `live` (default) = crawl `SEARCH_URL` then process jobs. `stored` = only process jobs already saved in the DB (**requires** the DB; do not set `SKIP_WAAS_DB=1`).
- `COOLDOWN_MONTHS`: After an application is recorded for a company, that company’s directory row can be skipped for this many months (per-company override may be added in the DB later; defaults apply globally).
- `COMPANY_BLOCK_RECENT_HOURS`: After a company’s directory **block** is fully processed in a live run, skip that company on the directory again for this many hours (default `24`). Reduces repeat work when you re-run search often.
- `STALE_LINK_DAYS`: In `RUN_MODE=stored`, re-open and verify listings whose `last_verified_at` is older than this many days before calling the model.

### Logging and models

- `LOG_LEVEL`: `error`, `warn`, `info`, `debug`, or `dump` (default `info`).
- `APP_METHOD_MODEL`, `JOB_COMPARE_MODEL`, `APP_MESSAGE_MODEL`: OpenAI model names per task (defaults `gpt-4o-mini` in `.env.example`).

## OpenAI API Key Setup

The app needs an OpenAI API key in practice for **live** and **stored** runs (message drafting, job comparison, application-method detection). Put it in `.env` as `OPENAI_API_KEY` before your first `npm run go`, unless you export it in the shell instead.

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

If you followed [First-time setup](#first-time-setup), you already ran `cp prompts.example.yaml prompts.yaml`. Otherwise do that now.

The script uses three AI system prompts. Your `prompts.yaml` in the project root should define:

### Required Prompt Keys

- `appMethodPrompt`: Analyzes job descriptions to detect alternative application methods (email, external links, etc.)
- `jobComparePrompt`: Compares multiple jobs at the same company to find the best fit for your profile
- `appMsgPrompt`: Generates personalized application messages based on job descriptions

See `[prompts.example.yaml](prompts.example.yaml)` for a full starting template.

### Customization

You can modify these prompts to:

- Adjust the tone and style of generated application messages
- Change the criteria for job comparison
- Modify how alternative application methods are detected
- Add specific instructions for your industry or experience level

## Dependencies

- [Puppeteer](https://github.com/puppeteer/puppeteer): Browser automation.
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3): Embedded SQLite (native addon; see [Prerequisites](#prerequisites)).
- [@types/better-sqlite3](https://www.npmjs.com/package/@types/better-sqlite3): TypeScript typings for the driver (dev).
- [OpenAI](https://github.com/openai/openai-node): Chat completions for messages, comparison, and application-method checks.
- [TypeScript](https://www.typescriptlang.org/): Typed source compiled to `dist/`.
- [Winston](https://github.com/winstonjs/winston): Logging.
- [js-yaml](https://github.com/nodeca/js-yaml): Loading `prompts.yaml`.
- [Jest](https://jestjs.io/): Tests (dev).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE.txt) file for details.