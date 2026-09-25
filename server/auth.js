import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db, one } from './db.js';
import { rateLimit } from './limits.js';
import { sendResetEmail } from './mail.js';
import { EMAIL_RE, LOGIN_RE, STEAM_RE } from './validate.js';

export const auth = Router();

const DEMO_USER = { id: 0, login: 'demo', email: '', role: 'demo' };
const RESERVED_LOGINS = new Set(['demo', 'admin', 'root', 'mercury', 'dotai']);

function issue(user) {
  return jwt.sign({ id: user.id, login: user.login, role: user.role }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: user.role === 'demo' ? '12h' : '7d',
  });
}

function publicUser(row) {
  return { id: Number(row.id), login: row.login, email: row.email, steam_id: row.steam_id, role: row.role ?? 'user' };
}

function demoUser() {
  return { ...DEMO_USER, steam_id: config.demoSteamId };
}

export function requireAuth(req, res, next) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Нужно войти' });
  try {
    const p = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: p.id, login: p.login, role: p.role === 'demo' ? 'demo' : 'user' };
    next();
  } catch {
    res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }
}

// Одно сообщение об ошибке входа, чтобы нельзя было узнать, какие логины существуют
const BAD_LOGIN = 'Неверный логин или пароль';
// Хеш-заглушка: при несуществующем логине время ответа такое же, как при неверном пароле
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

auth.post('/register', rateLimit('register', 5, 3600), async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const login = String(req.body?.login ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const steamId = String(req.body?.steam_id ?? '').trim();

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Некорректный email' });
  if (!LOGIN_RE.test(login)) return res.status(400).json({ error: 'Логин: 4–24 символа, латиница, цифры и _' });
  if (RESERVED_LOGINS.has(login)) return res.status(409).json({ error: 'Этот логин занят' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Пароль: от 8 до 128 символов' });
  if (!STEAM_RE.test(steamId)) return res.status(400).json({ error: 'Steam ID — 17 цифр, начинается с 7656119' });

  const hash = await bcrypt.hash(password, 10);
  try {
    const row = await one(
      `INSERT INTO users (email, login, password, steam_id) VALUES (?, ?, ?, ?)
       RETURNING id, email, login, steam_id`,
      [email, login, hash, steamId],
    );
    const user = publicUser(row);
    res.status(201).json({ token: issue(user), user });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'Email или логин уже заняты' });
    throw err;
  }
});

auth.post('/login', rateLimit('login', 10, 900), async (req, res) => {
  const login = String(req.body?.login ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!login || !password) return res.status(400).json({ error: 'Введите логин и пароль' });

  const row = await one('SELECT * FROM users WHERE login = ?', [login]);
  const ok = await bcrypt.compare(password, row?.password ?? DUMMY_HASH);
  if (!row || !ok) return res.status(401).json({ error: BAD_LOGIN });

  const user = publicUser(row);
  res.json({ token: issue(user), user });
});

// Вход без регистрации: общий демо-профиль, свой лимит запросов к ИИ на каждый IP
auth.post('/demo', rateLimit('demo', 20, 3600), (req, res) => {
  if (!config.demoSteamId) return res.status(503).json({ error: 'Демо-режим сейчас выключен' });
  const user = demoUser();
  res.json({ token: issue(user), user });
});

auth.get('/me', requireAuth, async (req, res) => {
  if (req.user.role === 'demo') return res.json({ user: demoUser() });
  const row = await one('SELECT id, login, email, steam_id FROM users WHERE id = ?', [req.user.id]);
  if (!row) return res.status(401).json({ error: 'Пользователь не найден' });
  res.json({ user: publicUser(row) });
});

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

auth.post('/forgot-password', rateLimit('forgot', 5, 3600), async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Введите корректный email' });

  // Ответ всегда одинаковый — чтобы нельзя было проверить, зарегистрирована ли почта
  const row = await one('SELECT id, login, email FROM users WHERE email = ?', [email]);
  if (row) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    await db.batch(
      [
        { sql: 'DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?', args: [row.id, Math.floor(Date.now() / 1000)] },
        { sql: 'INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', args: [sha256(token), row.id, expiresAt] },
      ],
      'write',
    );
    try {
      await sendResetEmail(row, `${config.appUrl}/reset-password.html?token=${token}`);
    } catch (err) {
      console.error('Письмо сброса не отправлено:', err.message);
    }
  }
  res.json({ ok: true });
});

auth.post('/reset-password', rateLimit('reset', 10, 3600), async (req, res) => {
  const token = String(req.body?.token ?? '');
  const password = String(req.body?.password ?? '');
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: 'Ссылка недействительна' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Пароль: от 8 до 128 символов' });

  // Токен одноразовый: удаляем при использовании
  const row = await one('DELETE FROM password_resets WHERE token_hash = ? RETURNING user_id, expires_at', [sha256(token)]);
  if (!row) return res.status(400).json({ error: 'Ссылка недействительна или уже использована' });
  if (Number(row.expires_at) < Date.now() / 1000) return res.status(400).json({ error: 'Ссылка истекла. Запросите новую.' });

  await db.execute({ sql: 'UPDATE users SET password = ? WHERE id = ?', args: [await bcrypt.hash(password, 10), row.user_id] });
  res.json({ ok: true });
});
