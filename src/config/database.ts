import * as sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export const initializeDatabase = async (dbPath: string) => {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
    mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS context (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      metadata TEXT
    )
  `);

  return db;
}; 