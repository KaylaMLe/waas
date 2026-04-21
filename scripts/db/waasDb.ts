import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

export function getWaasDbPath(): string {
	return process.env.WAAS_DB_PATH || path.join(process.cwd(), '.waas-data', 'waas.db');
}

export function openWaasDatabase(): Database.Database {
	const filePath = getWaasDbPath();
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const db = new Database(filePath);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	return db;
}

/** In-memory DB for tests (same pragmas as file DB). */
export function openMemoryWaasDatabase(): Database.Database {
	const db = new Database(':memory:');
	db.pragma('foreign_keys = ON');
	return db;
}
