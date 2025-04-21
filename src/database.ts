import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';

export function initDatabase(dbPath: string): Database {
  const db = new sqlite3.Database(dbPath);

  // Création de la table contexts si elle n'existe pas
  db.run(`
    CREATE TABLE IF NOT EXISTS contexts (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
} 