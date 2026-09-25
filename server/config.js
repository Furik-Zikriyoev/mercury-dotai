// Все настройки — только из переменных окружения. Секретов в коде нет.

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная окружения ${name} (см. .env.example)`);
  return value;
}

function int(name, fallback) {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET должен быть не короче 32 символов');

export const config = {
  jwtSecret,
  isProd: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),

  db: {
    url: process.env.DATABASE_URL || 'file:data/local.db',
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  },

  openai: {
    key: process.env.OPENAI_API_KEY || '',
    analyzeModel: process.env.OPENAI_ANALYZE_MODEL || 'gpt-4o-mini',
    chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4.1',
  },

  mail: {
    // По умолчанию mail.ru. Для Gmail: smtp.gmail.com, для Яндекса: smtp.yandex.ru (порт 465 у всех)
    host: process.env.EMAIL_HOST || 'smtp.mail.ru',
    port: int('EMAIL_PORT', 465),
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),

  // Демо-вход: общий аккаунт с заранее выбранным публичным профилем Steam
  demoSteamId: process.env.DEMO_STEAM_ID || '',

  // Лимиты запросов к ИИ в сутки (по UTC)
  limits: {
    user: int('AI_LIMIT_USER', 40), // зарегистрированный пользователь
    demo: int('AI_LIMIT_DEMO', 8), // посетитель в демо, считается по IP
    global: int('AI_LIMIT_GLOBAL', 300), // потолок на весь сервис
  },
};
