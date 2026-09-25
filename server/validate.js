// Приведение пользовательских данных к безопасному виду перед подстановкой в промпт

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
export const LOGIN_RE = /^[a-zA-Z0-9_]{4,24}$/;
// Steam ID64: 17 цифр, начинается с 7656119
export const STEAM_RE = /^7656119\d{10}$/;

// Строка без переводов строк и управляющих символов, обрезанная до max
export function str(value, max = 60) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .slice(0, max);
}

// Число в разумном диапазоне, иначе пусто
export function num(value, min = -1e7, max = 1e7) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return '';
  return Math.round(n * 100) / 100;
}

// Список героев вида [{ name, wr, games }], не больше max штук
export function heroList(value, max = 40) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max).map((h) => ({
    name: str(h?.name, 40),
    wr: num(h?.wr, 0, 100),
    games: num(h?.games, 0, 1e5),
  }));
}
