// Локальный запуск: API + статика из public на одном порту
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { app } from './server/app.js';

const root = path.dirname(new URL(import.meta.url).pathname);
mkdirSync(path.join(root, 'data'), { recursive: true });

const server = express();
server.use(app);
server.use(express.static(path.join(root, 'public')));

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`Mercury DotAi: http://localhost:${port}`));
