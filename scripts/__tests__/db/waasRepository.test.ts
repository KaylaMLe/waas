import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';

import { openMemoryWaasDatabase } from '../../db/waasDb';
import {
	createWaasRepository,
	isTerminalListingState,
	resetWaasRepositorySingletonForTests,
	WaasRepository,
} from '../../db/waasRepository';

describe('WaasRepository', () => {
	let db: Database.Database;
	let repo: WaasRepository;

	beforeEach(() => {
		resetWaasRepositorySingletonForTests();
		process.env.COOLDOWN_MONTHS = '6';
		process.env.COMPANY_BLOCK_RECENT_HOURS = '24';
		db = openMemoryWaasDatabase();
		repo = createWaasRepository(db);
	});

	afterEach(() => {
		db.close();
		delete process.env.COOLDOWN_MONTHS;
		delete process.env.COMPANY_BLOCK_RECENT_HOURS;
		resetWaasRepositorySingletonForTests();
	});

	it('listDbDirectoryExcludedCompanyKeys includes blocked companies', () => {
		const id = repo.upsertCompanyByWaasKey('BlockedCo W24');
		db.prepare(`UPDATE companies SET is_blocked = 1 WHERE id = ?`).run(id);
		const keys = repo.listDbDirectoryExcludedCompanyKeys();
		expect(keys).toContain('BlockedCo W24');
	});

	it('listDbDirectoryExcludedCompanyKeys includes recently processed blocks', () => {
		const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		const id = repo.upsertCompanyByWaasKey('FreshCo S24');
		db.prepare(`UPDATE companies SET last_block_fully_processed_at = ? WHERE id = ?`).run(recent, id);
		const keys = repo.listDbDirectoryExcludedCompanyKeys();
		expect(keys).toContain('FreshCo S24');
	});

	it('listDbDirectoryExcludedCompanyKeys omits stale last_block_fully_processed_at', () => {
		const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
		const id = repo.upsertCompanyByWaasKey('StaleCo S24');
		db.prepare(`UPDATE companies SET last_block_fully_processed_at = ? WHERE id = ?`).run(old, id);
		const keys = repo.listDbDirectoryExcludedCompanyKeys();
		expect(keys).not.toContain('StaleCo S24');
	});

	it('cooldown excludes company from directory list', () => {
		const cid = repo.upsertCompanyByWaasKey('CoolCo W24');
		const jid = repo.upsertJobStub(cid, 'https://www.workatastartup.com/jobs/1');
		repo.recordApplication(cid, jid, 'live_search');
		const keys = repo.listDbDirectoryExcludedCompanyKeys();
		expect(keys).toContain('CoolCo W24');
	});

	it('markCompanyBlockFullyProcessed sets timestamp', () => {
		repo.markCompanyBlockFullyProcessed('MarkCo W24');
		const row = db.prepare(`SELECT last_block_fully_processed_at FROM companies WHERE waas_key = ?`).get(
			'MarkCo W24'
		) as { last_block_fully_processed_at: string };
		expect(row.last_block_fully_processed_at).toBeTruthy();
	});

	it('isTerminalListingState is true for terminal states', () => {
		expect(isTerminalListingState('tool_applied')).toBe(true);
		expect(isTerminalListingState('open')).toBe(false);
	});
});
