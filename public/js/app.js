// Общее для всех страниц: адрес API, сессия, экранирование, плашка демо-режима.
// Подключается первым скриптом в <head>.

// Фронт и API на одном домене — и локально (dev.js), и на Vercel
const API = '/api';

const DotAi = (() => {
  const SESSION_KEYS = ['token', 'user', 'steam_id', 'steam_avatar'];

  // Для текста внутри тегов
  function escText(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Для текста и атрибутов
  function esc(value) {
    return escText(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function user() {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }

  const isDemo = () => user()?.role === 'demo';

  // Срок токена читаем из него самого, без запроса к серверу
  function tokenAlive(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  function saveSession({ token, user: u }) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('steam_id', u.steam_id);
  }

  // Полная очистка: следующий человек за этим браузером не увидит чужие чаты и кэш
  function logout(target = '/index.html') {
    localStorage.clear();
    window.location.href = target;
  }

  // На закрытых страницах: нет живой сессии — на вход
  function requireSession() {
    const token = localStorage.getItem('token');
    if (!token || !user() || !tokenAlive(token)) {
      SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
      window.location.replace('/index.html');
      return false;
    }
    return true;
  }

  // fetch к нашему API: токен, JSON, понятная ошибка
  async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new Error('Нет связи с сервером');
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) {
      logout();
      throw new Error(data.error || 'Сессия истекла');
    }
    if (data.quota) updateQuota(data.quota);
    if (!res.ok) throw new Error(data.error || `Ошибка сервера (${res.status})`);
    return data;
  }

  // ── Плашка демо-режима ─────────────────────────────────────────
  function updateQuota(q) {
    const el = document.getElementById('demo-quota');
    if (el) el.textContent = `Запросов к ИИ сегодня: ${q.left} из ${q.limit}`;
  }

  function mountDemoBar() {
    if (!isDemo() || document.getElementById('demo-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'demo-bar';
    bar.innerHTML = `
      <span><b>Демо-режим.</b> Вы смотрите профиль тестового игрока.</span>
      <span id="demo-quota"></span>
      <button type="button" id="demo-register">Зарегистрироваться со своим Steam</button>`;
    document.body.prepend(bar);
    bar.querySelector('#demo-register').addEventListener('click', () => logout('/index.html?register=1'));
    api('/ai/quota').then(updateQuota).catch(() => {});
  }

  const style = document.createElement('style');
  style.textContent = `
    #demo-bar{position:sticky;top:0;z-index:1000;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 18px;
      padding:8px 16px;font:13px/1.4 Inter,system-ui,sans-serif;color:#e8e6f8;
      background:linear-gradient(90deg,rgba(83,74,183,.95),rgba(127,119,221,.95));}
    #demo-quota{opacity:.85}
    #demo-register{font:inherit;font-weight:600;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);
      border-radius:8px;padding:4px 12px;cursor:pointer}
    #demo-register:hover{background:rgba(255,255,255,.24)}`;
  document.head.appendChild(style);

  document.addEventListener('DOMContentLoaded', mountDemoBar);

  return { esc, escText, user, isDemo, saveSession, logout, requireSession, api };
})();

// Старые страницы вызывают handleLogout() из разметки
function handleLogout() {
  DotAi.logout();
}
