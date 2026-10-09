// Teste de integração da API do curso (/api/course)
// Sobe o servidor real em porta e banco temporários e percorre o fluxo completo:
// login -> ementa -> aula -> quiz -> progresso -> certificado
const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { allLessons } = require('../src/course/curriculum');

const PORT = 3987;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_FILE = path.join(os.tmpdir(), `erp-curso-teste-${process.pid}.db`);

let server = null;
let token = null;

function request(method, url, body, authToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return fetch(BASE + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) }));
}

after(async () => {
  if (server) server.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
});

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.status) return;
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Servidor de teste não subiu no tempo esperado');
}

test('setup: servidor e login do administrador', async () => {
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);

  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), ERP_DB_PATH: DB_FILE, JWT_SECRET: 'segredo-de-teste' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));

  await waitForServer();

  const login = await request('POST', '/api/auth/login', { email: 'admin@erp.com', password: 'admin123' });
  assert.strictEqual(login.status, 200, 'login do usuário demo deveria funcionar');
  assert.ok(login.body.token, 'login deveria retornar token');
  token = login.body.token;
});

test('rotas do curso exigem autenticação', async () => {
  const unauthorized = await request('GET', '/api/course');
  assert.strictEqual(unauthorized.status, 401);
});

test('GET /api/course devolve ementa, progresso e não expõe o gabarito', async () => {
  const res = await request('GET', '/api/course', null, token);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.course.title);
  assert.ok(res.body.course.certification.minAverage >= 70);
  assert.ok(Array.isArray(res.body.modules) && res.body.modules.length >= 20);

  const lessons = res.body.modules.flatMap((m) => m.lessons);
  assert.strictEqual(lessons.length, allLessons().length);
  assert.strictEqual(res.body.progress.totalLessons, allLessons().length);
  assert.strictEqual(res.body.progress.completedLessons, 0);
  assert.strictEqual(res.body.progress.certificateEligible, false);

  // a ementa não pode vazar respostas nem o conteúdo completo das aulas
  const raw = JSON.stringify(res.body.modules);
  assert.ok(!raw.includes('"explain"'), 'a ementa não deve conter explicações do quiz');
  assert.ok(!raw.includes('"blocks"'), 'a ementa não deve conter o conteúdo das aulas');
  lessons.forEach((lesson) => assert.ok(!('r' in lesson), 'gabarito vazado na ementa'));
});

test('GET /api/course/lesson/:id devolve o conteúdo sem o gabarito', async () => {
  const res = await request('GET', '/api/course/lesson/m1a2', null, token);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.id, 'm1a2');
  assert.ok(res.body.blocks.length >= 4);
  assert.ok(res.body.quiz.length === 3);
  assert.ok(res.body.quiz[0].options.length === 4);
  assert.ok(!('r' in res.body.quiz[0]), 'resposta correta não pode ser enviada ao cliente');
  assert.strictEqual(res.body.progress.completed, false);

  const missing = await request('GET', '/api/course/lesson/nao-existe', null, token);
  assert.strictEqual(missing.status, 404);
});

test('POST /api/course/quiz corrige e grava a melhor nota', async () => {
  const lesson = allLessons().find((l) => l.id === 'm1a2');
  const wrong = lesson.quiz.map((q) => (q.r + 1) % 4);
  const correct = lesson.quiz.map((q) => q.r);

  const first = await request('POST', '/api/course/quiz/m1a2', { answers: wrong }, token);
  assert.strictEqual(first.status, 200);
  assert.strictEqual(first.body.score, 0);
  assert.strictEqual(first.body.passed, false);
  assert.strictEqual(first.body.detail.length, 3);

  const second = await request('POST', '/api/course/quiz/m1a2', { answers: correct }, token);
  assert.strictEqual(second.body.score, 100);
  assert.strictEqual(second.body.passed, true);
  assert.strictEqual(second.body.progress.gradedQuizzes, 1);
  assert.strictEqual(second.body.progress.averageScore, 100);

  // terceira tentativa pior não pode derrubar a melhor nota registrada
  const third = await request('POST', '/api/course/quiz/m1a2', { answers: wrong }, token);
  assert.strictEqual(third.body.score, 0);

  const lessonAfter = await request('GET', '/api/course/lesson/m1a2', null, token);
  assert.strictEqual(lessonAfter.body.progress.quizScore, 100);
  assert.strictEqual(lessonAfter.body.progress.attempts, 3);

  const notFound = await request('POST', '/api/course/quiz/inexistente', { answers: [0] }, token);
  assert.strictEqual(notFound.status, 404);
});

test('POST /api/course/progress marca e desmarca a conclusão da aula', async () => {
  const done = await request('POST', '/api/course/progress', { lesson_id: 'm1a2', completed: true }, token);
  assert.strictEqual(done.status, 200);
  assert.strictEqual(done.body.progress.completedLessons, 1);

  const undone = await request('POST', '/api/course/progress', { lesson_id: 'm1a2', completed: false }, token);
  assert.strictEqual(undone.body.progress.completedLessons, 0);

  const again = await request('POST', '/api/course/progress', { lesson_id: 'm1a2', completed: true }, token);
  assert.strictEqual(again.body.progress.completedLessons, 1, 'marcar a mesma aula duas vezes não pode duplicar a contagem');

  const invalid = await request('POST', '/api/course/progress', { lesson_id: 'aula-falsa' }, token);
  assert.strictEqual(invalid.status, 404);

  const noId = await request('POST', '/api/course/progress', {}, token);
  assert.strictEqual(noId.status, 400);
});

test('certificado só é liberado com 100% das aulas e média mínima', async () => {
  const partial = await request('GET', '/api/course/certificate', null, token);
  assert.strictEqual(partial.status, 200);
  assert.strictEqual(partial.body.eligible, false);
  assert.ok(partial.body.requirements.completionPct < 100);

  const lessons = allLessons();
  for (const lesson of lessons) {
    const answers = lesson.quiz.map((q) => q.r);
    await request('POST', `/api/course/quiz/${lesson.id}`, { answers }, token);
    await request('POST', '/api/course/progress', { lesson_id: lesson.id, completed: true }, token);
  }

  const summary = await request('GET', '/api/course', null, token);
  assert.strictEqual(summary.body.progress.completedLessons, lessons.length);
  assert.strictEqual(summary.body.progress.completionPct, 100);
  assert.strictEqual(summary.body.progress.averageScore, 100);
  assert.strictEqual(summary.body.progress.certificateEligible, true);

  const cert = await request('GET', '/api/course/certificate', null, token);
  assert.strictEqual(cert.body.eligible, true);
  assert.strictEqual(cert.body.certificate.totalLessons, lessons.length);
  assert.strictEqual(cert.body.certificate.holder, 'Administrador');
  assert.ok(cert.body.certificate.code.startsWith('ERP-'));
  assert.ok(cert.body.certificate.workloadHours >= 18);
});
