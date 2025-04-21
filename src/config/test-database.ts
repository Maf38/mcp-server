import * as sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export const initializeTestDatabase = async () => {
  const db = await open({
    filename: ':memory:',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS contexts (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL CHECK(json_valid(value)),
      metadata TEXT CHECK(metadata IS NULL OR json_valid(metadata)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contexts_updated_at ON contexts(updated_at);
    
    CREATE TRIGGER IF NOT EXISTS update_contexts_timestamp 
    AFTER UPDATE ON contexts
    BEGIN
      UPDATE contexts SET updated_at = datetime('now')
      WHERE key = NEW.key;
    END;
  `);

  return db;
}; 