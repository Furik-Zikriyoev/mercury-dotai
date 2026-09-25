import { Router } from 'express';
import { requireAuth } from './auth.js';
import { config } from './config.js';
import { aiQuota, refundAiRequest, takeAiRequest } from './limits.js';
import { AiError, complete } from './openai.js';
import { analyzePrompt, CHAT_SYSTEM_PROMPT, playerContextBlock } from './prompts.js';

export const ai = Router();
ai.use(requireAuth);

// Сколько запросов к ИИ осталось сегодня
ai.get('/quota', async (req, res) => {
  res.json(await aiQuota(req));
});

// Сначала проверка лимита, потом вызов модели
async function guarded(req, res, run) {
  const limitError = await takeAiRequest(req);
  if (limitError) return res.status(429).json({ error: limitError, quota: await aiQuota(req) });
  try {
    const payload = await run();
    res.json({ ...payload, quota: await aiQuota(req) });
  } catch (err) {
    await refundAiRequest(req);
    if (err instanceof AiError) return res.status(502).json({ error: err.message, quota: await aiQuota(req) });
    throw err;
  }
}

ai.post('/analyze', async (req, res) => {
  const { type, data } = req.body ?? {};
  const prompt = analyzePrompt(type, data);
  if (!prompt) return res.status(400).json({ error: 'Неверный тип анализа' });

  await guarded(req, res, async () => {
    const analysis = await complete({
      model: config.openai.analyzeModel,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 3000,
      temperature: 0.7,
    });
    return { analysis };
  });
});

// История чата живёт у клиента. Сервер берёт только последние сообщения
// с ролями user/assistant — подменить системный промпт нельзя
const HISTORY = 10;
const USER_MAX = 1500;
const ASSISTANT_MAX = 6000;

function cleanHistory(messages) {
  if (!Array.isArray(messages)) return null;
  const clean = messages
    .slice(-HISTORY)
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, m.role === 'user' ? USER_MAX : ASSISTANT_MAX) }));
  return clean.at(-1)?.role === 'user' ? clean : null;
}

ai.post('/chat', async (req, res) => {
  const history = cleanHistory(req.body?.messages);
  if (!history) return res.status(400).json({ error: 'Нет сообщения' });

  await guarded(req, res, async () => {
    const text = await complete({
      model: config.openai.chatModel,
      messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT + playerContextBlock(req.body.playerContext) }, ...history],
      maxTokens: 3000,
      temperature: 0.3,
      json: true,
    });
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Модель вернула не JSON — клиент покажет как обычный текст
    }
    return { message: text, parsed, role: 'assistant' };
  });
});
