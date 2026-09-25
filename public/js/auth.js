// =============================================
//   Mercury DotAi — страница входа
// =============================================

let passwordValue = '';

// === Переключение вкладок и экранов ===
function showTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('visible'));
  document.getElementById('form-' + tab).classList.add('visible');
}

function showView(view) {
  document.querySelectorAll('.auth-view').forEach((v) => v.classList.remove('visible'));
  document.getElementById('view-' + view).classList.add('visible');
}

// === Подсказки в полях (сервер всё равно проверяет сам) ===
function hint(id, text, kind = '') {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'field-hint' + (kind ? ' ' + kind : '');
}

function checkEmail(value) {
  if (!value) return hint('email-status', '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return hint('email-status', '✗ Введите корректный email', 'error');
  hint('email-status', '✓ Email корректный', 'success');
}

function checkLogin(value) {
  if (!value) return hint('login-status', '');
  if (value.length < 4 || value.length > 24) return hint('login-status', 'От 4 до 24 символов', 'error');
  if (!/^[a-zA-Z0-9_]+$/.test(value)) return hint('login-status', 'Только латиница, цифры и _', 'error');
  hint('login-status', '✓ Подходит', 'success');
}

function checkPassword(value) {
  passwordValue = value;
  if (!value) return hint('pass-status', '');
  if (value.length < 8) return hint('pass-status', 'Минимум 8 символов', 'error');
  hint('pass-status', '✓ Пароль подходит', 'success');
  const confirmEl = document.getElementById('reg-confirm');
  if (confirmEl.value) checkConfirm(confirmEl.value);
}

function checkConfirm(value) {
  if (!value) return hint('confirm-status', '');
  if (value !== passwordValue) return hint('confirm-status', '✗ Пароли не совпадают', 'error');
  hint('confirm-status', '✓ Пароли совпадают', 'success');
}

// === Кнопка в состоянии загрузки ===
async function withLoading(btn, run) {
  const text = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Подождите...';
  }
  try {
    await run();
  } catch (err) {
    showError(err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = text;
    }
  }
}

function enter(data) {
  DotAi.saveSession(data);
  window.location.href = '/dashboard.html';
}

const submitBtn = (e) => e.target.querySelector('.btn-primary');

// === Вход ===
function handleLogin(e) {
  e.preventDefault();
  const login = document.getElementById('login-input').value.trim();
  const password = document.getElementById('pass-input').value;
  if (!login || !password) return showError('Заполните все поля');

  withLoading(submitBtn(e), async () => {
    enter(await DotAi.api('/auth/login', { method: 'POST', body: { login, password } }));
  });
}

// === Регистрация ===
function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('reg-email').value.trim();
  const login = document.getElementById('reg-login').value.trim();
  const password = document.getElementById('reg-pass').value;
  const confirm = document.getElementById('reg-confirm').value;
  const steamId = document.getElementById('reg-steam').value.trim();

  if (!email || !login || !password || !confirm || !steamId) return showError('Заполните все поля');
  if (password !== confirm) return showError('Пароли не совпадают');
  if (!/^7656119\d{10}$/.test(steamId)) return showError('Steam ID — 17 цифр, начинается с 7656119 (steamID64 на steamid.io)');

  withLoading(submitBtn(e), async () => {
    enter(await DotAi.api('/auth/register', { method: 'POST', body: { email, login, password, steam_id: steamId } }));
  });
}

// === Демо без регистрации ===
function handleDemo(btn) {
  withLoading(btn, async () => {
    enter(await DotAi.api('/auth/demo', { method: 'POST' }));
  });
}

// === Сброс пароля ===
function handleForgot(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) return showError('Введите email');

  withLoading(submitBtn(e), async () => {
    await DotAi.api('/auth/forgot-password', { method: 'POST', body: { email } });
    showView('forgot-sent');
  });
}

// === Сообщение об ошибке ===
function showError(msg) {
  let el = document.getElementById('auth-error-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'auth-error-msg';
    el.setAttribute('role', 'alert');
    el.style.cssText =
      'background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:8px;padding:10px;color:#f87171;margin-bottom:10px';
    document.querySelector('.auth-card').prepend(el);
  }
  el.textContent = msg;
  clearTimeout(showError.timer);
  showError.timer = setTimeout(() => el.remove(), 5000);
}

// === Старт ===
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);

  // Уже вошёл — сразу в профиль
  if (localStorage.getItem('token') && DotAi.user()) {
    window.location.replace('/dashboard.html');
    return;
  }

  showView('main');
  showTab(params.has('register') ? 'register' : 'login');

  // Ссылка из портфолио: ?demo=1 — сразу входим в демо
  if (params.has('demo')) handleDemo(document.getElementById('demo-btn'));
});
