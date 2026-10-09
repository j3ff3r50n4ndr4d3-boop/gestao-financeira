// ============================================================
// Teste de integração da API do Agente IA (/api/agent)
// Sobe o servidor real em porta e banco temporários, popula a
// base demo e percorre o fluxo completo do agente:
// config -> domínios -> diagnóstico -> área -> alertas -> plano
// -> chat (várias intenções) -> conversas -> relatório -> erros
// ============================================================

const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { DOMAINS } = require('../src/agent/domains');

const PORT = 3988;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_FILE = path.join(os.tmpdir(), `erp-agente-api-${process.pid}.db`);
const ROOT = path.join(__dirname, '..');

let server = null;
let token = null;
let conversationId = null;

function request(method, url, body, authToken = token) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return fetch(BASE + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) }));
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (res.status) return;
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Servidor de teste não subiu no tempo esperado');
}

after(async () => {
  if (server) server.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
});

test('setup: base demo, servidor e login', async () => {
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);

  // 1) popula o banco ANTES de subir o servidor: o sql.js carrega o arquivo
  //    na inicialização e o servidor mantém a cópia em memória.
  execFileSync(process.execPath, [path.join(ROOT, 'seed.js')], {
    env: { ...process.env, ERP_DB_PATH: DB_FILE },
    stdio: 'ignore'
  });
  assert.ok(fs.existsSync(DB_FILE), 'o seed deveria criar o banco de teste');

  // 2) sobe o servidor apontando para o mesmo banco já populado
  server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      ERP_DB_PATH: DB_FILE,
      JWT_SECRET: 'segredo-de-teste',
      AGENT_LLM_PROVIDER: 'none'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
  await waitForServer();

  const login = await request('POST', '/api/auth/login', { email: 'admin@erp.com', password: 'admin123' }, null);
  assert.equal(login.status, 200);
  token = login.body.token;
  assert.ok(token);
});

test('GET /api/agent exige autenticação', async () => {
  const res = await request('GET', '/api/agent/domains', null, null);
  assert.equal(res.status, 401);
});

test('GET /api/agent/config descreve o motor sem vazar segredos', async () => {
  const res = await request('GET', '/api/agent/config');
  assert.equal(res.status, 200);
  assert.equal(res.body.llm.enabled, false, 'LLM desligado no teste (AGENT_LLM_PROVIDER=none)');
  assert.equal(res.body.domains.length, 6);
  const raw = JSON.stringify(res.body).toLowerCase();
  ['api_key', 'apikey', 'bearer ', 'sk-'].forEach((segredo) => {
    assert.ok(!raw.includes(segredo), `configuração não pode expor ${segredo}`);
  });
});

test('GET /api/agent/domains devolve as 6 áreas com nota de saúde', async () => {
  const res = await request('GET', '/api/agent/domains');
  assert.equal(res.status, 200);
  assert.equal(res.body.domains.length, 6);
  assert.deepEqual(res.body.domains.map((d) => d.id), DOMAINS.map((d) => d.id));
  res.body.domains.forEach((d) => {
    assert.ok(d.name && d.icon && d.mission && d.persona);
    assert.ok(d.score === null || (d.score >= 0 && d.score <= 100));
    assert.ok(d.level && d.level.label);
    assert.ok(Array.isArray(d.typicalQuestions) && d.typicalQuestions.length > 0);
    assert.ok(Array.isArray(d.knowledge.concepts));
  });
  assert.ok(res.body.company);
});

test('GET /api/agent/diagnostic consolida empresa, alertas, recomendações e plano', async () => {
  const res = await request('GET', '/api/agent/diagnostic');
  assert.equal(res.status, 200);
  const d = res.body;
  assert.ok(d.company.summary.length > 50);
  assert.equal(d.domains.length, 6);
  assert.ok(Array.isArray(d.alerts));
  assert.ok(Array.isArray(d.recommendations));
  assert.ok(d.plan.now && d.plan.next && d.plan.later);
  assert.ok(d.highlights.series.length > 0);
  assert.ok(d.highlights.series.some((m) => m.revenue > 0), 'a base demo deveria ter receita');
  assert.ok(d.highlights.topProducts || d.highlights.topCustomers);

  d.domains.forEach((dom) => {
    assert.ok(Array.isArray(dom.kpis) && dom.kpis.length >= 4, `KPIs insuficientes em ${dom.id}`);
    assert.ok(Array.isArray(dom.insights));
    assert.ok(Array.isArray(dom.alerts));
  });
});

test('GET /api/agent/domains/:id aprofunda a área com conhecimento e dados', async () => {
  for (const domain of DOMAINS) {
    const res = await request('GET', `/api/agent/domains/${domain.id}`);
    assert.equal(res.status, 200, `falha na área ${domain.id}`);
    assert.equal(res.body.domain.id, domain.id);
    assert.ok(res.body.analysis, 'análise ausente');
    assert.ok(res.body.knowledge && res.body.knowledge.concepts.length >= 5, `conhecimento ausente em ${domain.id}`);
    assert.ok(res.body.metrics, 'métricas da área ausentes');
    assert.match(res.body.markdown, new RegExp(domain.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('GET /api/agent/domains/desconhecida retorna 404', async () => {
  const res = await request('GET', '/api/agent/domains/nao-existe');
  assert.equal(res.status, 404);
});

test('GET /api/agent/alertas e /plan são consistentes com o diagnóstico', async () => {
  const diag = (await request('GET', '/api/agent/diagnostic')).body;
  const alerts = await request('GET', '/api/agent/alerts');
  assert.equal(alerts.status, 200);
  assert.equal(alerts.body.count, diag.alerts.length);
  assert.equal(alerts.body.bySeverity.length, 4);

  const criticos = await request('GET', '/api/agent/alerts?severity=critica');
  assert.ok(criticos.body.alerts.every((a) => a.severity === 'critica'));

  const porArea = await request('GET', '/api/agent/alerts?domain=financeiro');
  assert.ok(porArea.body.alerts.every((a) => a.domain === 'financeiro'));

  const plan = await request('GET', '/api/agent/plan');
  assert.equal(plan.status, 200);
  assert.ok(Array.isArray(plan.body.recommendations));
  const prioridades = plan.body.recommendations.map((r) => r.priority);
  assert.deepEqual(prioridades, [...prioridades].sort((a, b) => a - b));
});

test('POST /api/agent/chat responde as intenções principais com dados reais', async () => {
  const casos = [
    { message: 'Como está a saúde da empresa?', intent: 'diagnostico' },
    { message: 'Quais produtos estão em ruptura?', intent: 'lista' },
    { message: 'Quanto tenho a receber vencido?', expectText: /vencid|atraso|a receber/i },
    { message: 'O que devo fazer primeiro nesta semana?', intent: 'plano' },
    { message: 'O que é ponto de equilíbrio?', expectText: /ponto de equilíbrio|Despesas fixas/i },
    { message: 'Como registro uma compra no sistema?', intent: 'como_fazer' },
    { message: 'Qual é a previsão do próximo mês?', intent: 'previsao' }
  ];

  for (const caso of casos) {
    const res = await request('POST', '/api/agent/chat', { message: caso.message, useLlm: false });
    assert.equal(res.status, 200, `falha em "${caso.message}"`);
    assert.equal(res.body.source, 'local', 'sem chave configurada, a resposta deve vir do motor local');
    assert.ok(res.body.reply.text.length > 40, `resposta curta para "${caso.message}"`);
    assert.ok(res.body.conversationId, 'deve criar/retornar conversa');
    conversationId = res.body.conversationId;
    if (caso.intent) assert.equal(res.body.parsed.intent, caso.intent, `intenção errada em "${caso.message}"`);
    if (caso.expectText) assert.match(res.body.reply.text, caso.expectText);
  }
});

test('POST /api/agent/chat filtra por domínio quando informado', async () => {
  for (const domain of DOMAINS) {
    const res = await request('POST', '/api/agent/chat', { message: 'faça um diagnóstico', domain: domain.id, useLlm: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.parsed.domain, domain.id);
    assert.match(res.body.reply.text, new RegExp(domain.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('POST /api/agent/chat continua a conversa e mantém histórico', async () => {
  const first = await request('POST', '/api/agent/chat', { message: 'Como está o estoque?', useLlm: false });
  const conv = first.body.conversationId;
  const second = await request('POST', '/api/agent/chat', { message: 'E o que devo fazer agora?', conversationId: conv, useLlm: false });
  assert.equal(second.body.conversationId, conv, 'deve manter a mesma conversa');

  const loaded = await request('GET', `/api/agent/conversations/${conv}`);
  assert.equal(loaded.status, 200);
  assert.equal(loaded.body.messages.length, 4, '2 perguntas + 2 respostas');
  assert.equal(loaded.body.messages[0].role, 'user');
  assert.equal(loaded.body.messages[1].role, 'assistant');
});

test('POST /api/agent/chat valida mensagem vazia e tamanho máximo', async () => {
  const vazia = await request('POST', '/api/agent/chat', { message: '   ' });
  assert.equal(vazia.status, 400);

  const gigante = await request('POST', '/api/agent/chat', { message: 'a'.repeat(2500) });
  assert.equal(gigante.status, 400);
});

test('GET /api/agent/conversations lista e DELETE remove', async () => {
  const created = await request('POST', '/api/agent/chat', { message: 'teste de exclusão', useLlm: false });
  const id = created.body.conversationId;

  const list = await request('GET', '/api/agent/conversations');
  assert.equal(list.status, 200);
  assert.ok(list.body.conversations.some((c) => c.id === id));

  const removed = await request('DELETE', `/api/agent/conversations/${id}`);
  assert.equal(removed.status, 200);

  const gone = await request('GET', `/api/agent/conversations/${id}`);
  assert.equal(gone.status, 404);
});

test('GET /api/agent/report exporta markdown completo ou por área', async () => {
  const full = await request('GET', '/api/agent/report');
  assert.equal(full.status, 200);
  assert.match(full.body.filename, /\.md$/);
  assert.match(full.body.content, /Diagnóstico Empresarial/);
  DOMAINS.forEach((d) => assert.ok(full.body.content.includes(d.name), `relatório sem ${d.name}`));

  const byDomain = await request('GET', '/api/agent/report?domain=estoque');
  assert.equal(byDomain.status, 200);
  assert.match(byDomain.body.content, /Estoque e Expedição/);

  const download = await fetch(`${BASE}/api/agent/report?download=1`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition') || '', /attachment/);
});

test('GET /api/agent/knowledge expõe conceitos, playbooks e fórmulas', async () => {
  const all = await request('GET', '/api/agent/knowledge');
  assert.equal(all.status, 200);
  assert.equal(all.body.domains.length, 6);
  assert.ok(all.body.general.formulas.length >= 8);
  assert.ok(all.body.general.erpHowTo.length >= 5);

  const one = await request('GET', '/api/agent/knowledge/marketing');
  assert.equal(one.status, 200);
  assert.equal(one.body.domain.id, 'marketing');
  assert.ok(one.body.knowledge.concepts.some((c) => /CAC/.test(c.term)));
});

test('GET /api/agent/quick-prompts traz sugestões para todas as áreas', async () => {
  const res = await request('GET', '/api/agent/quick-prompts');
  assert.equal(res.status, 200);
  assert.ok(res.body.prompts.length >= 8);
  res.body.prompts.forEach((p) => assert.ok(p.label && p.message));
});
