import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, './runs.db');

let db;

export function initDB() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.prepare(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER,
      source TEXT,
      intent TEXT,
      request TEXT,
      response TEXT
    )
  `).run();
  db.prepare(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      history TEXT
    )
  `).run();
  return db;
}

export function saveRun(entry) {
  if (!db) initDB();
  try {
    const stmt = db.prepare('INSERT INTO runs (timestamp, source, intent, request, response) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(
      entry.timestamp || Date.now(),
      entry.source || 'unknown',
      entry.request?.intent || entry.intent || null,
      JSON.stringify(entry.request || {}),
      JSON.stringify(entry.response || {})
    );
    return info.lastInsertRowid;
  } catch (e) {
    console.error('saveRun failed', e.message || e);
    return null;
  }
}

export function getRuns(limit = 100) {
  if (!db) initDB();
  const stmt = db.prepare('SELECT * FROM runs ORDER BY timestamp DESC LIMIT ?');
  return stmt.all(limit);
}

export function createConversation(id, title = 'Untitled') {
  if (!db) initDB();
  try {
    const stmt = db.prepare('INSERT INTO conversations (id, title, created_at, updated_at, history) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, title, Date.now(), Date.now(), JSON.stringify([]));
    return { id, title, created_at: Date.now(), updated_at: Date.now(), history: [] };
  } catch (e) {
    console.error('createConversation failed', e.message || e);
    return null;
  }
}

export function getConversation(id) {
  if (!db) initDB();
  const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
    history: JSON.parse(row.history || '[]')
  };
}

export function getConversations(limit = 50) {
  if (!db) initDB();
  const stmt = db.prepare('SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ?');
  return stmt.all(limit);
}

export function updateConversationHistory(id, history) {
  if (!db) initDB();
  try {
    const stmt = db.prepare('UPDATE conversations SET history = ?, updated_at = ? WHERE id = ?');
    stmt.run(JSON.stringify(history), Date.now(), id);
    return true;
  } catch (e) {
    console.error('updateConversationHistory failed', e.message || e);
    return false;
  }
}
