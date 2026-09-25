import { config } from './config.js';

export class AiError extends Error {}

export async function complete({ model, messages, maxTokens, temperature, json = false }) {
  if (!config.openai.key) throw new AiError('ИИ сейчас не настроен на сервере.');

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.openai.key}` },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        ...(json && { response_format: { type: 'json_object' } }),
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (err) {
    console.error('OpenAI: запрос не выполнен', err.name);
    throw new AiError('ИИ не ответил вовремя. Попробуйте ещё раз.');
  }

  if (!res.ok) {
    // Подробности только в лог: клиенту незачем знать про ключ и баланс
    const body = await res.text().catch(() => '');
    console.error('OpenAI:', res.status, body.slice(0, 500));
    throw new AiError(res.status === 429 ? 'ИИ сейчас перегружен. Попробуйте через минуту.' : 'Ошибка ИИ. Попробуйте позже.');
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
