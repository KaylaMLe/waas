import Database from 'better-sqlite3';

import { addCalendarMonths } from '../utils/dateUtils.js';
import { openWaasDatabase } from './waasDb.js';

export type ApplicationMode = 'live_search' | 'stored_queue' | 'waas_site';

export type ListingState = 'open' | 'unknown' | 'applied_on_site' | 'gone' | 'tool_applied';

const TERMINAL_LISTING_STATES: ReadonlySet<string> = new Set(['applied_on_site', 'gone', 'tool_applied']);

export function isTerminalListingState(state: string): boolean {
	return TERMINAL_LISTING_STATES.has(state);
}

export type JobRow = {
	id: number;
	company_id: number;
	canonical_url: string;
	position: string | null;
	jd_text: string | null;
	first_seen_at: string;
	last_scraped_at: string | null;
	last_verified_at: string | null;
	listing_state: string;
};

export type StoredApplyCandidate = {
	job_id: number;
	company_id: number;
	canonical_url: string;
	position: string | null;
	jd_text: string;
	last_verified_at: string | null;
	company_waas_key: string;
};

let singleton: WaasRepository | null = null;

export function getDefaultCooldownMonths(): number {
	const n = parseInt(process.env.COOLDOWN_MONTHS || '6', 10);
	return Number.isNaN(n) || n < 0 ? 6 : n;
}

export function getStaleLinkVerifyMs(): number {
	const days = parseFloat(process.env.STALE_LINK_DAYS || '2');
	const d = Number.isNaN(days) || days < 0 ? 2 : days;
	return Math.round(d * 24 * 60 * 60 * 1000);
}

/** Skip directory company blocks reprocessed within this window after last successful full pass. */
export function getCompanyBlockRecentMs(): number {
	const hours = parseFloat(process.env.COMPANY_BLOCK_RECENT_HOURS || '24');
	const h = Number.isNaN(hours) || hours < 0 ? 24 : hours;
	return Math.round(h * 60 * 60 * 1000);
}

export function isWaasDbSkipped(): boolean {
	return (process.env.SKIP_WAAS_DB || '').trim() === '1';
}

export function getWaasRepository(): WaasRepository | null {
	if (isWaasDbSkipped()) return null;
	if (!singleton) {
		singleton = new WaasRepository(openWaasDatabase());
		singleton.initSchema();
	}
	return singleton;
}

/** Test helper: own DB handle, no singleton. */
export function createWaasRepository(db: Database.Database): WaasRepository {
	const r = new WaasRepository(db);
	r.initSchema();
	return r;
}

export function resetWaasRepositorySingletonForTests(): void {
	singleton = null;
}

export class WaasRepository {
	constructor(private readonly db: Database.Database) {}

	initSchema(): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS companies (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				waas_key TEXT NOT NULL UNIQUE,
				cooldown_months INTEGER,
				is_blocked INTEGER NOT NULL DEFAULT 0,
				blocked_reason TEXT,
				last_block_fully_processed_at TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS jobs (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
				canonical_url TEXT NOT NULL UNIQUE,
				position TEXT,
				jd_text TEXT,
				first_seen_at TEXT NOT NULL,
				last_scraped_at TEXT,
				last_verified_at TEXT,
				listing_state TEXT NOT NULL DEFAULT 'open',
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS applications (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
				job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
				applied_at TEXT NOT NULL,
				mode TEXT NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
			CREATE INDEX IF NOT EXISTS idx_applications_company_id ON applications(company_id);
		`);
	}

	upsertCompanyByWaasKey(waasKey: string): number {
		const now = new Date().toISOString();
		const row = this.db
			.prepare(
				`INSERT INTO companies (waas_key, is_blocked, created_at, updated_at)
				 VALUES (@waas_key, 0, @now, @now)
				 ON CONFLICT(waas_key) DO UPDATE SET updated_at = excluded.updated_at
				 RETURNING id`
			)
			.get({ waas_key: waasKey, now }) as { id: number };
		return row.id;
	}

	upsertJobStub(companyId: number, canonicalUrl: string): number {
		const now = new Date().toISOString();
		const row = this.db
			.prepare(
				`INSERT INTO jobs (company_id, canonical_url, listing_state, first_seen_at, created_at, updated_at)
				 VALUES (@company_id, @canonical_url, 'open', @now, @now, @now)
				 ON CONFLICT(canonical_url) DO UPDATE SET updated_at = excluded.updated_at
				 RETURNING id`
			)
			.get({ company_id: companyId, canonical_url: canonicalUrl, now }) as { id: number };
		return row.id;
	}

	findJobByCanonicalUrl(canonicalUrl: string): JobRow | null {
		return (
			(this.db
				.prepare(
					`SELECT j.id, j.company_id, j.canonical_url, j.position, j.jd_text, j.first_seen_at,
					        j.last_scraped_at, j.last_verified_at, j.listing_state
					 FROM jobs j
					 WHERE j.canonical_url = ?`
				)
				.get(canonicalUrl) as JobRow | undefined) ?? null
		);
	}

	updateJobAfterLiveScrape(args: {
		jobId: number;
		position: string | null;
		jdText: string | null;
		listingState: ListingState;
	}): void {
		const now = new Date().toISOString();
		this.db
			.prepare(
				`UPDATE jobs SET
					position = @position,
					jd_text = @jd_text,
					last_scraped_at = @now,
					last_verified_at = @now,
					listing_state = @listing_state,
					updated_at = @now
				 WHERE id = @job_id`
			)
			.run({
				job_id: args.jobId,
				position: args.position,
				jd_text: args.jdText,
				listing_state: args.listingState,
				now,
			});
	}

	updateJobAfterVerification(jobId: number, jdText: string | null, listingState: ListingState): void {
		const now = new Date().toISOString();
		this.db
			.prepare(
				`UPDATE jobs SET
					jd_text = COALESCE(@jd_text, jd_text),
					last_verified_at = @now,
					listing_state = @listing_state,
					updated_at = @now
				 WHERE id = @job_id`
			)
			.run({ job_id: jobId, jd_text: jdText, listing_state: listingState, now });
	}

	setJobListingState(jobId: number, listingState: ListingState): void {
		const now = new Date().toISOString();
		this.db
			.prepare(`UPDATE jobs SET listing_state = @listing_state, updated_at = @now WHERE id = @job_id`)
			.run({ job_id: jobId, listing_state: listingState, now });
	}

	recordApplication(companyId: number, jobId: number | null, mode: ApplicationMode): void {
		const now = new Date().toISOString();
		this.db
			.prepare(
				`INSERT INTO applications (company_id, job_id, applied_at, mode)
				 VALUES (@company_id, @job_id, @now, @mode)`
			)
			.run({ company_id: companyId, job_id: jobId, now, mode });
	}

	markCompanyBlockFullyProcessed(waasKey: string): void {
		const companyId = this.upsertCompanyByWaasKey(waasKey);
		const now = new Date().toISOString();
		this.db
			.prepare(
				`UPDATE companies SET last_block_fully_processed_at = @ts, updated_at = @now WHERE id = @id`
			)
			.run({ ts: now, now, id: companyId });
	}

	/** Companies excluded from the directory scrape list (DB only — merge with `APPLIED` in caller). */
	listDbDirectoryExcludedCompanyKeys(nowMs: number = Date.now()): string[] {
		const keys = new Set<string>();

		for (const r of this.db
			.prepare(`SELECT waas_key FROM companies WHERE is_blocked = 1`)
			.all() as { waas_key: string }[]) {
			keys.add(r.waas_key);
		}

		const recentWindow = getCompanyBlockRecentMs();
		if (recentWindow > 0) {
			for (const r of this.db
				.prepare(
					`SELECT waas_key, last_block_fully_processed_at FROM companies WHERE last_block_fully_processed_at IS NOT NULL`
				)
				.all() as { waas_key: string; last_block_fully_processed_at: string }[]) {
				const t = Date.parse(r.last_block_fully_processed_at);
				if (!Number.isNaN(t) && nowMs - t < recentWindow) {
					keys.add(r.waas_key);
				}
			}
		}

		const defaultMonths = getDefaultCooldownMonths();
		for (const r of this.db
			.prepare(
				`SELECT c.id, c.waas_key, c.cooldown_months,
				        (SELECT MAX(applied_at) FROM applications a WHERE a.company_id = c.id) AS last_applied
				 FROM companies c`
			)
			.all() as { id: number; waas_key: string; cooldown_months: number | null; last_applied: string | null }[]) {
			if (!r.last_applied) continue;
			const appliedAt = new Date(r.last_applied);
			if (Number.isNaN(appliedAt.getTime())) continue;
			const months = r.cooldown_months ?? defaultMonths;
			const until = addCalendarMonths(appliedAt, months);
			if (until.getTime() > nowMs) {
				keys.add(r.waas_key);
			}
		}

		return [...keys];
	}

	isCompanyCoolingDown(companyId: number, nowMs: number = Date.now()): boolean {
		const row = this.db
			.prepare(
				`SELECT c.cooldown_months,
				        (SELECT MAX(applied_at) FROM applications a WHERE a.company_id = c.id) AS last_applied
				 FROM companies c WHERE c.id = ?`
			)
			.get(companyId) as { cooldown_months: number | null; last_applied: string | null } | undefined;
		if (!row?.last_applied) return false;
		const appliedAt = new Date(row.last_applied);
		if (Number.isNaN(appliedAt.getTime())) return false;
		const months = row.cooldown_months ?? getDefaultCooldownMonths();
		return addCalendarMonths(appliedAt, months).getTime() > nowMs;
	}

	isCompanyBlocked(companyId: number): boolean {
		const row = this.db.prepare(`SELECT is_blocked FROM companies WHERE id = ?`).get(companyId) as
			| { is_blocked: number }
			| undefined;
		return !!row?.is_blocked;
	}

	listStoredApplyCandidates(nowMs: number = Date.now()): StoredApplyCandidate[] {
		const rows = this.db
			.prepare(
				`SELECT j.id AS job_id, j.canonical_url, j.position, j.jd_text, j.last_verified_at, j.listing_state,
				        c.id AS company_id, c.waas_key AS company_waas_key
				 FROM jobs j
				 INNER JOIN companies c ON c.id = j.company_id
				 WHERE c.is_blocked = 0
				   AND j.listing_state IN ('open', 'unknown')
				   AND j.jd_text IS NOT NULL AND length(trim(j.jd_text)) > 0`
			)
			.all() as StoredApplyCandidate[];

		return rows.filter((r) => !this.isCompanyCoolingDown(r.company_id, nowMs));
	}

	/**
	 * Permanently block a company (WAAS directory `waas_key`) and delete all saved jobs and
	 * application history rows for that company to free space. The company row remains with
	 * `is_blocked = 1` so directory and stored queues skip it.
	 */
	blockCompanyAndPurgeSavedJobs(waasKey: string, blockedReason?: string | null): {
		jobsRemoved: number;
		applicationsRemoved: number;
	} {
		const now = new Date().toISOString();
		const reason = blockedReason?.trim() || null;

		const run = this.db.transaction(() => {
			const row = this.db.prepare(`SELECT id FROM companies WHERE waas_key = ?`).get(waasKey) as
				| { id: number }
				| undefined;

			let jobsRemoved = 0;
			let applicationsRemoved = 0;

			if (row) {
				const appRes = this.db.prepare(`DELETE FROM applications WHERE company_id = ?`).run(row.id);
				applicationsRemoved = appRes.changes;
				const jobRes = this.db.prepare(`DELETE FROM jobs WHERE company_id = ?`).run(row.id);
				jobsRemoved = jobRes.changes;
				this.db
					.prepare(
						`UPDATE companies SET
							is_blocked = 1,
							blocked_reason = @reason,
							last_block_fully_processed_at = NULL,
							updated_at = @now
						 WHERE id = @id`
					)
					.run({ reason, now, id: row.id });
			} else {
				this.db
					.prepare(
						`INSERT INTO companies (waas_key, is_blocked, blocked_reason, created_at, updated_at)
						 VALUES (@waas_key, 1, @reason, @now, @now)`
					)
					.run({ waas_key: waasKey, reason, now });
			}

			return { jobsRemoved, applicationsRemoved };
		});

		return run();
	}
}
