import { createClient } from '@libsql/client';
import { config } from './config.js';

// Локально — файл SQLite, на Vercel — Turso (libsql://...)
export const db = createClient(config.db);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    UNIQUE NOT NULL,
    login       TEXT    UNIQUE NOT NULL,
    password    TEXT    NOT NULL,
    steam_id    TEXT    NOT NULL,
    created_at  TEXT    DEFAULT (datetime('now'))
  )`,
  // В БД храним только хеш токена сброса: утечка таблицы не даёт сбросить пароль
  `CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  // Счётчики для лимитов: ключ + окно времени
  `CREATE TABLE IF NOT EXISTS usage (
    bucket     TEXT    NOT NULL,
    win        TEXT    NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (bucket, win)
  )`,
  // Старая таблица с токенами в открытом виде больше не нужна
  `DROP TABLE IF EXISTS reset_tokens`,
];

let ready;

// Схема создаётся один раз на процесс (на Vercel — на холодный старт)
export function initDb() {
  ready ??= db.batch(SCHEMA, 'write').catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}

export async function one(sql, args = []) {
  const { rows } = await db.execute({ sql, args });
  return rows[0] ?? null;
}
