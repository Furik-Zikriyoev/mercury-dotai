import nodemailer from 'nodemailer';
import { config } from './config.js';

export async function sendResetEmail(user, link) {
  if (!config.mail.user || !config.mail.pass) {
    // Почта не настроена: ссылку видно только в логе локального сервера
    if (!config.isProd) console.log('Почта не настроена. Ссылка сброса:', link);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465,
    auth: { user: config.mail.user, pass: config.mail.pass },
  });

  // login проверен регуляркой при регистрации, link собран сервером — экранирование не нужно
  await transporter.sendMail({
    from: `"Mercury DotAi" <${config.mail.user}>`,
    to: user.email,
    subject: 'Сброс пароля — Mercury DotAi',
    text: `Привет, ${user.login}!\n\nСсылка для сброса пароля (действует 1 час):\n${link}\n\nЕсли вы не запрашивали сброс, просто проигнорируйте письмо.`,
    html: `
      <div style="font-family:Inter,sans-serif;background:#0d1117;color:#e8e6f0;padding:40px;max-width:480px;margin:0 auto;border-radius:16px">
        <div style="margin-bottom:24px">
          <span style="font-size:22px;font-weight:700">Mercury <span style="color:#AFA9EC">DotAi</span></span>
        </div>
        <h2 style="font-size:20px;margin-bottom:12px;color:#e8e6f0">Сброс пароля</h2>
        <p style="color:#8b8fa8;line-height:1.6;margin-bottom:24px">
          Привет, <strong style="color:#e8e6f0">${user.login}</strong>!<br>
          Мы получили запрос на сброс пароля для твоего аккаунта.
          Нажми кнопку ниже — ссылка действует <strong style="color:#AFA9EC">1 час</strong>.
        </p>
        <a href="${link}" style="display:inline-block;background:#7F77DD;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:600;font-size:14px;margin-bottom:24px">
          Сбросить пароль
        </a>
        <p style="color:#5a5e72;font-size:12px;line-height:1.6">
          Если ты не запрашивал сброс — просто проигнорируй это письмо.<br>
          Ссылка: <a href="${link}" style="color:#AFA9EC">${link}</a>
        </p>
      </div>
    `,
  });
}
