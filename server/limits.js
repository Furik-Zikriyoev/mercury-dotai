import crypto from 'node:crypto';
import { config } from './config.js';
import { db } from './db.js';

// Счётчики лежат в БД, а не в памяти: на Vercel у каждого вызова может быть свой процесс

// IP в базе не храним — только HMAC от него
export function clientKey(req) {
  const ip =
    req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  return crypto.createHmac('sha256', config.jwtSecret).update(String(ip)).digest('hex').slice(0, 24);
}

const today = () => new Date().toISOString().slice(0, 10);
const endOfToday = () => Math.floor(new Date(`${today()}T23:59:59Z`).getTime() / 1000);

// Увеличивает счётчик и возвращает новое значение
async function bump(bucket, win, expiresAt) {
  const { rows } = await db.execute({
    sql: `INSERT INTO usage (bucket, win, count, expires_at) VALUES (?, ?, 1, ?)
          ON CONFLICT (bucket, win) DO UPDATE SET count = count + 1
          RETURNING count`,
    args: [bucket, win, expiresAt],
  });
  // Изредка чистим устаревшие счётчики
  if (Math.random() < 0.02) {
    db.execute({ sql: 'DELETE FROM usage WHERE expires_at < ?', args: [Math.floor(Date.now() / 1000)] }).catch(() => {});
  }
  return Number(rows[0].count);
}

async function peek(bucket, win) {
  const { rows } = await db.execute({ sql: 'SELECT count FROM usage WHERE bucket = ? AND win = ?', args: [bucket, win] });
  return rows.length ? Number(rows[0].count) : 0;
}

// Ограничение частоты: не больше `max` попыток за `windowSec` секунд
export function rateLimit(name, max, windowSec) {
  return async (req, res, next) => {
    const slot = Math.floor(Date.now() / 1000 / windowSec);
    const count = await bump(`${name}:${clientKey(req)}`, `w${windowSec}:${slot}`, (slot + 1) * windowSec);
    if (count > max) {
      res.set('Retry-After', String(windowSec));
      return res.status(429).json({ error: 'Слишком много попыток. Попробуйте позже.' });
    }
    next();
  };
}

// Кому засчитывается запрос к ИИ: пользователю или IP демо-посетителя
function aiBucket(req) {
  return req.user.role === 'demo' ? `ai:demo:${clientKey(req)}` : `ai:user:${req.user.id}`;
}

function aiLimit(req) {
  return req.user.role === 'demo' ? config.limits.demo : config.limits.user;
}

export async function aiQuota(req) {
  const used = await peek(aiBucket(req), today());
  const limit = aiLimit(req);
  return { used: Math.min(used, limit), limit, left: Math.max(0, limit - used) };
}

// Списывает один запрос к ИИ. Возвращает текст ошибки или null
export async function takeAiRequest(req) {
  const win = today();
  const expires = endOfToday();
  const used = await bump(aiBucket(req), win, expires);
  if (used > aiLimit(req)) {
    return req.user.role === 'demo'
      ? 'Лимит запросов к ИИ в демо на сегодня исчерпан. Зарегистрируйтесь, чтобы продолжить.'
      : 'Лимит запросов к ИИ на сегодня исчерпан. Он обновится завтра.';
  }
  const total = await bump('ai:global', win, expires);
  if (total > config.limits.global) {
    await refund([aiBucket(req)]);
    return 'Сервис сегодня перегружен запросами к ИИ. Попробуйте завтра.';
  }
  return null;
}

// Возвращает запрос в лимит, если ИИ не ответил: пользователь не платит за чужую ошибку
export function refundAiRequest(req) {
  return refund([aiBucket(req), 'ai:global']);
}

async function refund(buckets) {
  const win = today();
  await db.batch(
    buckets.map((bucket) => ({
      sql: 'UPDATE usage SET count = max(count - 1, 0) WHERE bucket = ? AND win = ?',
      args: [bucket, win],
    })),
    'write',
  );
}
