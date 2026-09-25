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

  // ── Меню: логин и аватарка Steam ───────────────────────────────
  // Аватарку сохраняет профиль; если её ещё нет — один раз берём из OpenDota
  const STEAM_BASE = 76561197960265728n;

  function paintNav() {
    const u = user();
    const nameEl = document.getElementById('nav-username');
    const avEl = document.getElementById('nav-avatar');
    if (!u) return;
    if (nameEl) nameEl.textContent = u.login;
    if (!avEl) return;
    const avatar = localStorage.getItem('steam_avatar');
    if (avatar) {
      avEl.innerHTML = `<img src="${esc(avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      Object.assign(avEl.style, { background: 'none', overflow: 'hidden', padding: '0' });
    } else {
      avEl.textContent = u.login.slice(0, 2).toUpperCase();
    }
  }

  async function loadNavAvatar() {
    const steamId = localStorage.getItem('steam_id');
    if (!steamId || localStorage.getItem('steam_avatar')) return;
    try {
      const id32 = (BigInt(steamId) - STEAM_BASE).toString();
      const data = await fetch(`https://api.opendota.com/api/players/${id32}`).then((r) => r.json());
      const avatar = data?.profile?.avatarfull;
      if (avatar && /^https:\/\//.test(avatar)) {
        localStorage.setItem('steam_avatar', avatar);
        paintNav();
      }
    } catch {
      // без аватарки остаются инициалы
    }
  }

  // ── Футер: один на все страницы ────────────────────────────────
  const CONTACTS = {
    phone: '+998507834299',
    phoneText: '+998 50 783 42 99',
    email: 'zff2304@mail.ru',
    telegram: 'mercury23',
    instagram: 'mercury.1.9',
    portfolio: 'https://mercury-portfolio-ten.vercel.app',
    repo: 'https://github.com/Furik-Zikriyoev/mercury-dotai',
  };

  const ICONS = {
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    telegram: '<path d="m22 3-20 8 7 2.5M22 3l-3.5 18L9 13.5M22 3 9 13.5m0 0V20l3.5-3.5"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>',
    github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.1-1.3-.3-2.5-1-3.5.3-1.2.3-2.4 0-3.5 0 0-1 0-3 1.5a10.4 10.4 0 0 0-5.5 0C7.5 2 6.5 2 6.5 2c-.3 1.1-.3 2.3 0 3.5a5.4 5.4 0 0 0-1 3.5c0 3.5 3 5.5 6 5.5-.4.5-.8 1.1-1 1.8-.2.7-.3 1.4-.2 2.2v4"/><path d="M9 18c-4.5 2-5-2-7-2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  };
  const icon = (name) =>
    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  const link = (href, iconName, text, external = true) =>
    `<a href="${href}"${external ? ' target="_blank" rel="noopener"' : ''}>${icon(iconName)}<span>${text}</span></a>`;

  function mountFooter() {
    if (document.body.dataset.noFooter !== undefined || document.getElementById('dx-footer')) return;
    const c = CONTACTS;
    const footer = document.createElement('footer');
    footer.id = 'dx-footer';
    footer.innerHTML = `
      <div class="dx-grid">
        <div class="dx-brand">
          <div class="dx-logo">Mercury <span>DotAi</span></div>
          <p>Аналитика игрока Dota 2 по открытым данным OpenDota с разбором игры через ИИ. Дипломный проект.</p>
          ${link(c.portfolio, 'user', 'Автор — Фурузонфар Зикриёев')}
        </div>
        <div>
          <p class="dx-title">Возможности</p>
          <ul class="dx-list">
            <li>Профиль, герои и матчи с графиками</li>
            <li>ИИ-разбор статистики, героев и матча</li>
            <li>Чат с ИИ-коучем</li>
            <li>Сравнение двух игроков</li>
          </ul>
        </div>
        <div>
          <p class="dx-title">Контакты</p>
          <div class="dx-links">
            ${link(`tel:${c.phone}`, 'phone', c.phoneText, false)}
            ${link(`mailto:${c.email}`, 'mail', c.email, false)}
          </div>
        </div>
        <div>
          <p class="dx-title">Соцсети</p>
          <div class="dx-links">
            ${link(`https://t.me/${c.telegram}`, 'telegram', `@${c.telegram}`)}
            ${link(`https://instagram.com/${c.instagram}`, 'instagram', `@${c.instagram}`)}
            ${link(c.repo, 'github', 'Исходный код')}
          </div>
        </div>
      </div>
      <div class="dx-bottom">
        <span>© ${new Date().getFullYear()} Mercury DotAi</span>
        <span>Данные: OpenDota API. Проект не связан с Valve Corporation.</span>
      </div>`;
    document.body.appendChild(footer);
  }

  const style = document.createElement('style');
  style.textContent = `
    .has-tip{position:relative;cursor:help;border-bottom:1px dotted currentColor;outline:none}
    .has-tip::after{content:attr(data-tip);position:absolute;left:0;top:calc(100% + 8px);z-index:900;width:max-content;max-width:280px;
      padding:9px 12px;border-radius:8px;background:#0f1420;border:1px solid rgba(127,119,221,.35);color:#e8e6f8;
      font:400 12px/1.5 Inter,system-ui,sans-serif;letter-spacing:0;text-transform:none;white-space:normal;
      box-shadow:0 8px 24px rgba(0,0,0,.45);opacity:0;visibility:hidden;transition:opacity .15s;pointer-events:none}
    .has-tip:hover::after,.has-tip:focus::after{opacity:1;visibility:visible}

    #dx-footer{position:relative;z-index:1;margin-top:48px;padding:40px max(24px,5vw) 24px;border-top:1px solid rgba(127,119,221,.15);
      background:rgba(8,11,17,.6);font:13px/1.6 Inter,system-ui,sans-serif;color:#8b8fa8}
    #dx-footer .dx-grid{display:grid;grid-template-columns:1.6fr 1.2fr 1fr 1fr;gap:32px;max-width:1200px;margin:0 auto}
    #dx-footer .dx-logo{font-size:18px;font-weight:600;color:#e8e6f0;margin-bottom:10px}
    #dx-footer .dx-logo span{color:#AFA9EC}
    #dx-footer .dx-brand p{max-width:300px;margin:0 0 14px}
    #dx-footer .dx-title{font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#b4b1d4;margin:0 0 14px}
    #dx-footer .dx-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
    #dx-footer .dx-list li::before{content:'';display:inline-block;width:4px;height:4px;border-radius:50%;background:#7F77DD;margin:0 9px 2px 0;vertical-align:middle}
    #dx-footer .dx-links{display:flex;flex-direction:column;gap:10px}
    #dx-footer a{display:inline-flex;align-items:center;gap:9px;color:#8b8fa8;text-decoration:none;transition:color .15s}
    #dx-footer a:hover{color:#AFA9EC}
    #dx-footer a svg{flex-shrink:0;color:#7F77DD}
    #dx-footer .dx-bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;max-width:1200px;margin:28px auto 0;
      padding-top:18px;border-top:1px solid rgba(255,255,255,.05);font-size:12px;color:#5f5c80}
    @media (max-width:900px){#dx-footer .dx-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:560px){#dx-footer .dx-grid{grid-template-columns:1fr;gap:24px}#dx-footer{padding-bottom:80px}}

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

  document.addEventListener('DOMContentLoaded', () => {
    mountDemoBar();
    mountFooter();
    paintNav();
    loadNavAvatar();
  });

  return { esc, escText, user, isDemo, saveSession, logout, requireSession, api, paintNav };
})();

// Старые страницы вызывают handleLogout() из разметки
function handleLogout() {
  DotAi.logout();
}
