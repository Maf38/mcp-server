import * as sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export const initializeDatabase = async (dbPath: string) => {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
    mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
  });

  await db.exec(`
    DROP TABLE IF EXISTS contexts;
    
    CREATE TABLE contexts (
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