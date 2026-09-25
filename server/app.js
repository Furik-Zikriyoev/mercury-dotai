import express from 'express';
import { ai } from './ai.js';
import { auth } from './auth.js';
import { initDb } from './db.js';

// Только API. Статику отдаёт Vercel (или dev.js локально).
// Фронт и API на одном домене, поэтому CORS не нужен вовсе.
export const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

app.use('/api', async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  await initDb();
  next();
});

app.use('/api/auth', auth);
app.use('/api/ai', ai);

app.use('/api', (req, res) => res.status(404).json({ error: 'Не найдено' }));

// Express 5 сам ловит ошибки async-обработчиков и передаёт сюда
app.use((err, req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Слишком большой запрос' });
  console.error(err);
  res.status(500).json({ error: 'Ошибка сервера' });
});
