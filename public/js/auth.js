// =============================================
//   Mercury DotAi — Auth Page Logic (FIXED)
// =============================================

const API = 'http://localhost:3000/api';
const takenLogins = ['admin', 'mercury', 'dotai', 'test', 'user', 'root'];
let passwordValue = '';

// 🔥 FIX — безопасный fetch
async function safeFetch(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();

  try {
    const json = JSON.parse(text);

    if (!res.ok) {
      throw new Error(json.error || 'Ошибка');
    }

    return json;

  } catch (e) {
    console.error('НЕ JSON ОТВЕТ:\n', text);
    throw new Error('Сервер вернул не JSON');
  }
}

// === Tab & View switching ===
function showTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('visible'));
  document.getElementById('form-' + tab).classList.add('visible');
}

function showView(view) {
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('visible'));
  document.getElementById('view-' + view).classList.add('visible');
}

// === Validation ===
function checkEmail(value) {
  const el = document.getElementById('email-status');
  if (!value) { el.textContent = ''; el.className = 'field-hint'; return; }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(value)) {
    el.textContent = '✗ Введите корректный email';
    el.className = 'field-hint error';
  } else {
    el.textContent = '✓ Email корректный';
    el.className = 'field-hint success';
  }
}

function checkLogin(value) {
  const el = document.getElementById('login-status');
  if (!value) { el.textContent = ''; el.className = 'field-hint'; return; }
  if (value.length < 4) {
    el.textContent = 'Минимум 4 символа';
    el.className = 'field-hint error'; return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    el.textContent = 'Только буквы, цифры и _';
    el.className = 'field-hint error'; return;
  }
  if (takenLogins.includes(value.toLowerCase())) {
    el.textContent = '✗ Логин уже занят';
    el.className = 'field-hint error';
  } else {
    el.textContent = '✓ Логин доступен';
    el.className = 'field-hint success';
  }
}

function checkPassword(value) {
  passwordValue = value;
  const el = document.getElementById('pass-status');
  if (!value) { el.textContent = ''; el.className = 'field-hint'; return; }
  if (value.length < 6) {
    el.textContent = 'Минимум 6 символов';
    el.className = 'field-hint error'; return;
  }
  el.textContent = '✓ Пароль подходит';
  el.className = 'field-hint success';
  const confirmEl = document.getElementById('reg-confirm');
  if (confirmEl.value) checkConfirm(confirmEl.value);
}

function checkConfirm(value) {
  const el = document.getElementById('confirm-status');
  if (!value) { el.textContent = ''; el.className = 'field-hint'; return; }
  if (value !== passwordValue) {
    el.textContent = '✗ Пароли не совпадают';
    el.className = 'field-hint error';
  } else {
    el.textContent = '✓ Пароли совпадают';
    el.className = 'field-hint success';
  }
}

// === Button loading state ===
function setLoading(btn, loading, text) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Подождите...' : text;
}

// === LOGIN ===
async function handleLogin(e) {
  e.preventDefault();

  const login = document.getElementById('login-input').value.trim();
  const pass  = document.getElementById('pass-input').value;

  if (!login || !pass) {
    showError('Заполните все поля');
    return;
  }

  const btn = e.target.querySelector('.btn-primary');
  setLoading(btn, true, 'Войти в Mercury DotAi');

  try {
    const data = await safeFetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password: pass }),
    });

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('steam_id', data.user.steam_id);

    window.location.href = '/dashboard.html';

  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(btn, false, 'Войти в Mercury DotAi');
  }
}

// === REGISTER ===
async function handleRegister(e) {
  e.preventDefault();

  const email   = document.getElementById('reg-email').value.trim();
  const login   = document.getElementById('reg-login').value.trim();
  const pass    = document.getElementById('reg-pass').value;
  const confirm = document.getElementById('reg-confirm').value;
  const steamId = document.getElementById('reg-steam').value.trim();

  if (!email || !login || !pass || !confirm || !steamId) {
    showError('Заполните все поля');
    return;
  }

  if (pass !== confirm) {
    showError('Пароли не совпадают');
    return;
  }

  const btn = e.target.querySelector('.btn-primary');
  setLoading(btn, true, 'Создать аккаунт');

  try {
    const data = await safeFetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        login,
        password: pass,
        steam_id: steamId
      }),
    });

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('steam_id', data.user.steam_id);

    window.location.href = '/dashboard.html';

  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(btn, false, 'Создать аккаунт');
  }
}

// === ERROR UI ===
function showError(msg) {
  let el = document.getElementById('auth-error-msg');

  if (!el) {
    el = document.createElement('div');
    el.id = 'auth-error-msg';
    el.style.cssText = `
      background: rgba(248,113,113,0.1);
      border: 1px solid rgba(248,113,113,0.3);
      border-radius: 8px;
      padding: 10px;
      color: #f87171;
      margin-bottom: 10px;
    `;
    document.querySelector('.auth-card').prepend(el);
  }

  el.textContent = msg;

  setTimeout(() => el.remove(), 4000);
}

// === FORGOT PASSWORD ===
async function handleForgot(e) {
  e.preventDefault();

  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { showError('Введите email'); return; }

  const btn = e.target.querySelector('.btn-primary');
  setLoading(btn, true, 'Отправить письмо');

  try {
    const data = await safeFetch(`${API}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    // Показываем экран успеха в любом случае
    showView('forgot-sent');

    // Dev mode: если сервер вернул debug_link — показываем в консоли
    if (data.debug_link) {
      console.log('🔗 DEV Reset link:', data.debug_link);
    }

  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(btn, false, 'Отправить письмо');
  }
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  showView('main');
  showTab('login');

  const token = localStorage.getItem('token');
  if (token) {
    window.location.href = '/dashboard.html';
  }
});