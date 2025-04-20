import * as sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export const initializeTestDatabase = async () => {
  const db = await open({
    filename: ':memory:',
    driver: sqlite3.Database
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