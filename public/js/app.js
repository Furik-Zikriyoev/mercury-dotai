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
  // Карточка в левом нижнем углу: меню сверху закреплено, туда её не поставить.
  // Крестик сворачивает её в значок до конца сессии браузера.
  const COLLAPSED_KEY = 'demo_bar_collapsed';

  function updateQuota(q) {
    const el = document.getElementById('demo-quota');
    if (el) el.textContent = `Запросов к ИИ сегодня: ${q.left} из ${q.limit}`;
  }

  function setCollapsed(bar, collapsed) {
    bar.classList.toggle('collapsed', collapsed);
    try {
      sessionStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '');
    } catch {
      // без sessionStorage просто не запоминаем
    }
  }

  function mountDemoBar() {
    if (!isDemo() || document.getElementById('demo-bar')) return;
    const bar = document.createElement('aside');
    bar.id = 'demo-bar';
    bar.innerHTML = `
      <button type="button" class="demo-chip" title="Показать">Демо</button>
      <div class="demo-card">
        <button type="button" class="demo-close" aria-label="Свернуть">×</button>
        <b>Демо-режим</b>
        <span>Вы смотрите профиль тестового игрока.</span>
        <span id="demo-quota"></span>
        <button type="button" class="demo-register">Зарегистрироваться со своим Steam</button>
      </div>`;
    document.body.appendChild(bar);

    let collapsed = false;
    try {
      collapsed = sessionStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      // игнорируем
    }
    setCollapsed(bar, collapsed);

    bar.querySelector('.demo-close').addEventListener('click', () => setCollapsed(bar, true));
    bar.querySelector('.demo-chip').addEventListener('click', () => setCollapsed(bar, false));
    bar.querySelector('.demo-register').addEventListener('click', () => logout('/index.html?register=1'));
    api('/ai/quota').then(updateQuota).catch(() => {});
  }

  const style = document.createElement('style');
  style.textContent = `
    #demo-bar{position:fixed;left:16px;bottom:16px;z-index:1000;font:13px/1.45 Inter,system-ui,sans-serif;color:#e8e6f8}
    #demo-bar .demo-card{position:relative;display:flex;flex-direction:column;gap:4px;max-width:280px;padding:14px 16px;
      background:rgba(20,18,40,.94);border:1px solid rgba(127,119,221,.45);border-radius:12px;
      box-shadow:0 8px 28px rgba(0,0,0,.45);backdrop-filter:blur(12px)}
    #demo-bar .demo-card b{color:#AFA9EC;padding-right:22px}
    #demo-quota{color:#9994c0;font-size:12px}
    #demo-bar .demo-close{position:absolute;top:6px;right:8px;width:24px;height:24px;border:none;border-radius:6px;
      background:none;color:#9994c0;font-size:18px;line-height:1;cursor:pointer}
    #demo-bar .demo-close:hover{background:rgba(255,255,255,.08);color:#fff}
    #demo-bar .demo-register{margin-top:6px;font:inherit;font-weight:600;color:#fff;background:#7F77DD;border:none;
      border-radius:8px;padding:7px 12px;cursor:pointer}
    #demo-bar .demo-register:hover{background:#6b63c9}
    #demo-bar .demo-chip{display:none;font:inherit;font-weight:600;color:#fff;background:#7F77DD;border:none;
      border-radius:999px;padding:6px 14px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.4)}
    #demo-bar.collapsed .demo-card{display:none}
    #demo-bar.collapsed .demo-chip{display:block}
    @media (max-width:600px){#demo-bar{left:10px;bottom:10px}#demo-bar .demo-card{max-width:calc(100vw - 20px)}}`;
  document.head.appendChild(style);

  document.addEventListener('DOMContentLoaded', mountDemoBar);

  return { esc, escText, user, isDemo, saveSession, logout, requireSession, api };
})();

// Старые страницы вызывают handleLogout() из разметки
function handleLogout() {
  DotAi.logout();
}
