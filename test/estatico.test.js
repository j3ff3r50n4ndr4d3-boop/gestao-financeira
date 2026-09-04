'use strict';

/**
 * Equivalência entre a versão com servidor e a versão estática.
 *
 * A versão estática reimplementa a camada de dados no navegador. O risco óbvio é
 * ela divergir do servidor em silêncio e mostrar números diferentes. Este teste
 * elimina esse risco da única forma que importa: alimenta as duas com o MESMO
 * banco e compara a resposta de cada endpoint.
 *
 * Se uma consulta for portada errado, este teste aponta qual campo divergiu.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { once } = require('node:events');

const { abrir } = require('../server/db');
const { semear } = require('../server/seed');
const { createServer } = require('../server/index');

const RAIZ = path.join(__dirname, '..');
const PUBLIC = path.join(RAIZ, 'public');

/* --------------------------------------------------- ambiente estático ---- */

function subirEstatico(snapshot) {
  const armazenamento = new Map();
  const contexto = {
    console,
    URL,
    Blob: class {},
    localStorage: {
      getItem: (k) => (armazenamento.has(k) ? armazenamento.get(k) : null),
      setItem: (k, v) => armazenamento.set(k, String(v)),
      removeItem: (k) => armazenamento.delete(k),
    },
  };
  contexto.window = contexto;
  contexto.globalThis = contexto;
  vm.createContext(contexto);

  // Os motores são os MESMOS arquivos do servidor, com rodapé de exportação dupla.
  for (const f of ['server/lib/oee.js', 'server/lib/tempos.js', 'server/lib/balanceamento.js',
    'public/js/banco-local.js', 'public/js/api-local.js']) {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), contexto, { filename: f });
  }

  const importou = contexto.BancoLocal.importar(snapshot);
  return { contexto, armazenamento, importou };
}

/* -------------------------------------------------------- comparador ------ */

/** Compara estruturas tolerando ruído de ponto flutuante entre SQLite e JS. */
function comparar(a, b, caminho = '$', divergencias = []) {
  if (divergencias.length >= 12) return divergencias;
  const tipos = [typeof a, typeof b];
  if (tipos[0] === 'number' && tipos[1] === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return divergencias;
    if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))) {
      divergencias.push(`${caminho}: ${a} != ${b}`);
    }
    return divergencias;
  }
  if (a === null || b === null || tipos[0] !== 'object' || tipos[1] !== 'object') {
    if (a !== b) divergencias.push(`${caminho}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
    return divergencias;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    divergencias.push(`${caminho}: um é lista e o outro não`);
    return divergencias;
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length) divergencias.push(`${caminho}: ${a.length} itens != ${b.length} itens`);
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) comparar(a[i], b[i], `${caminho}[${i}]`, divergencias);
    return divergencias;
  }
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of chaves) {
    if (!(k in a)) { divergencias.push(`${caminho}.${k}: só existe no estático`); continue; }
    if (!(k in b)) { divergencias.push(`${caminho}.${k}: só existe no servidor`); continue; }
    comparar(a[k], b[k], `${caminho}.${k}`, divergencias);
  }
  return divergencias;
}

/* ================================================================== testes == */

let base = '';
let server = null;
let db = null;
let snapshot = null;
let estatico = null;

test.before(async () => {
  db = abrir(':memory:');
  semear(db, { dias: 45, limpar: true });
  server = createServer(db);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  snapshot = await (await fetch(`${base}/api/backup`)).json();
  estatico = subirEstatico(snapshot);
});

test.after(() => { if (server) server.close(); });

const noServidor = async (caminho, opts = {}) => {
  const res = await fetch(base + caminho, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const tipo = res.headers.get('content-type') || '';
  if (tipo.includes('application/json')) return { status: res.status, corpo: await res.json() };
  // Pelos bytes de propósito: res.text() remove o BOM inicial que o CSV tem,
  // e a comparação deixaria de ser entre coisas iguais.
  return { status: res.status, corpo: Buffer.from(await res.arrayBuffer()).toString('utf8') };
};

const noEstatico = async (caminho, opts = {}) => {
  try {
    const r = await estatico.contexto.API_LOCAL(caminho, opts);
    // o CSV é o único endpoint não-JSON: `api()` desempacota __csv no navegador
    const corpo = r && r.__corpo !== undefined ? r.__corpo : r;
    return { status: r && r.__status !== undefined ? r.__status : 200,
      corpo: corpo && corpo.__csv !== undefined ? corpo.__csv : corpo };
  } catch (e) {
    return { status: e.status || 500, corpo: { erro: e.message } };
  }
};

const mesmoResultado = async (caminho, opts) => {
  const [a, b] = await Promise.all([noServidor(caminho, opts), noEstatico(caminho, opts)]);
  assert.equal(b.status, a.status, `${caminho}: status ${b.status} != ${a.status}`);
  const divergencias = comparar(a.corpo, b.corpo);
  assert.deepEqual(divergencias, [], `${caminho} divergiu:\n  ${divergencias.join('\n  ')}`);
  return a.corpo;
};

/* ------------------------------------------------------------- leitura ---- */

const CONSULTAS = [
  '/api/catalogos',
  '/api/metas',
  '/api/turnos',
  '/api/maquinas',
  '/api/modelos',
  '/api/equipes',
  '/api/operadores',
  '/api/apontamentos?limite=400',
  '/api/apontamentos?de=2026-08-01&ate=2026-08-31',
  '/api/apontamentos?maquinaId=2&limite=50',
  '/api/apontamentos/1',
  '/api/dashboard',
  '/api/dashboard?de=2026-08-01&ate=2026-08-31',
  '/api/dashboard?maquinaId=2',
  '/api/producao',
  '/api/producao?equipeId=1',
  '/api/acompanhamento',
  '/api/acompanhamento?equipeId=2',
  '/api/acompanhamento?operadorId=5',
  '/api/acompanhamento?de=2026-08-01&ate=2026-08-31',
  '/api/modelos/1/sequencia',
  '/api/modelos/2/sequencia',
  '/api/cronometragens?modeloId=1',
  '/api/balancos',
  '/api/apontamentos/1/producao',
  '/api/export/apontamentos.csv',
];

for (const caminho of CONSULTAS) {
  test(`leitura idêntica: ${caminho}`, async () => {
    await mesmoResultado(caminho);
  });
}

test('as consultas cobrem volume real de dados, não listas vazias', async () => {
  const ap = await noServidor('/api/apontamentos?limite=400');
  assert.ok(ap.corpo.itens.length > 100, `${ap.corpo.itens.length} apontamentos`);
  const prod = await noServidor('/api/producao');
  assert.ok(prod.corpo.length > 1000, `${prod.corpo.length} registros de produção individual`);
  const seq = await noServidor('/api/modelos/1/sequencia');
  assert.ok(seq.corpo.operacoes.length > 5, 'modelo 1 tem sequência');
  const csv = await noServidor('/api/export/apontamentos.csv');
  assert.ok(csv.corpo.split('\r\n').length > 100, 'CSV com todas as linhas');
});

/* ----------------------------------------------------------- escrita ------ */

test('mutações produzem o mesmo resultado nas duas versões', async () => {
  const corpo = {
    data: '2026-08-20', maquina_id: 2, turno_id: 1, modelo_id: 1, lider: 'Teste Equivalência',
    pecas_produzidas: 500, pecas_defeito: 8, pecas_retrabalho: 2, observacao: 'criado pelo teste',
    paradas: [{ motivo: 'QUEBRA', minutos: 30, descricao: 'agulha' }, { motivo: 'FALTA_MATERIAL', minutos: 12 }],
  };

  const criados = await Promise.all([
    noServidor('/api/apontamentos', { method: 'POST', body: corpo }),
    noEstatico('/api/apontamentos', { method: 'POST', body: corpo }),
  ]);
  assert.equal(criados[1].status, criados[0].status);
  assert.deepEqual(comparar(criados[0].corpo, criados[1].corpo), [],
    `apontamento criado divergiu:\n  ${comparar(criados[0].corpo, criados[1].corpo).join('\n  ')}`);

  const idServidor = criados[0].corpo.id;
  const idEstatico = criados[1].corpo.id;

  // o painel reflete o novo apontamento igualmente nos dois
  const [painelA, painelB] = await Promise.all([
    noServidor('/api/dashboard?de=2026-08-20&ate=2026-08-20'),
    noEstatico('/api/dashboard?de=2026-08-20&ate=2026-08-20'),
  ]);
  assert.deepEqual(comparar(painelA.corpo, painelB.corpo), [],
    `painel do dia divergiu:\n  ${comparar(painelA.corpo, painelB.corpo).join('\n  ')}`);

  // produção individual substituída nos dois
  const itens = { itens: [
    { operador_id: 1, minutos: 420, pecas: 250, defeitos: 4, tempo_padrao_min: 0.85 },
    { operador_id: 2, minutos: 420, pecas: 250, defeitos: 4 },
  ] };
  const [prodA, prodB] = await Promise.all([
    noServidor(`/api/apontamentos/${idServidor}/producao`, { method: 'PUT', body: itens }),
    noEstatico(`/api/apontamentos/${idEstatico}/producao`, { method: 'PUT', body: itens }),
  ]);
  assert.equal(prodB.status, 200);
  assert.deepEqual(comparar(prodA.corpo, prodB.corpo), [],
    `produção individual divergiu:\n  ${comparar(prodA.corpo, prodB.corpo).join('\n  ')}`);
});

test('validações e bloqueios 400/409/404 são os mesmos', async () => {
  const casos = [
    ['POST', '/api/apontamentos', { data: '2026-13-45', maquina_id: 2, turno_id: 1, pecas_produzidas: 10, pecas_defeito: 0 }],
    ['POST', '/api/apontamentos', { data: '2026-08-01', maquina_id: 999, turno_id: 1, pecas_produzidas: 10, pecas_defeito: 0 }],
    ['POST', '/api/apontamentos', { data: '2026-08-01', maquina_id: 2, turno_id: 1, pecas_produzidas: 10, pecas_defeito: 50 }],
    ['POST', '/api/apontamentos', { data: '2026-08-01', maquina_id: 2, turno_id: 1, pecas_produzidas: 10, pecas_defeito: 0, paradas: [{ motivo: 'INEXISTENTE', minutos: 5 }] }],
    ['POST', '/api/apontamentos', { data: '2026-08-01', maquina_id: 2, turno_id: 1, pecas_produzidas: 10, pecas_defeito: 0, paradas: [{ motivo: 'QUEBRA', minutos: 99999 }] }],
    ['POST', '/api/equipes', { nome: 'Equipe Alfa' }],
    ['POST', '/api/modelos', { codigo: 'CAM-100', nome: 'Duplicado' }],
    ['POST', '/api/operacoes', { modelo_id: 1, sequencia: 1, descricao: 'Duplicada' }],
    ['POST', '/api/cronometragens', { operacao_id: 1, data: '2026-08-01', leituras: [], fator_ritmo: 1 }],
    ['POST', '/api/cronometragens', { operacao_id: 1, data: '2026-08-01', leituras: [30], fator_ritmo: 5 }],
    ['POST', '/api/balanceamento/simular', { modelo_id: 999, meta_pecas_hora: 60 }],
    ['POST', '/api/balanceamento/simular', { modelo_id: 1, meta_pecas_hora: 0 }],
    ['PUT', '/api/metas', { metaOee: 5 }],
    ['PUT', '/api/apontamentos/999999/producao', { itens: [] }],
    ['DELETE', '/api/turnos/1'],
    ['DELETE', '/api/maquinas/2'],
    ['DELETE', '/api/modelos/1'],
    ['GET', '/api/apontamentos/999999', null],
    ['GET', '/api/modelos/999999/sequencia', null],
  ];

  for (const [metodo, caminho, corpo] of casos) {
    const opts = corpo === null ? { method: metodo } : { method: metodo, body: corpo };
    const [a, b] = await Promise.all([noServidor(caminho, opts), noEstatico(caminho, opts)]);
    assert.equal(b.status, a.status, `${metodo} ${caminho}: status ${b.status} != ${a.status} (servidor: ${JSON.stringify(a.corpo)})`);
    if (a.status >= 400) {
      assert.equal(b.corpo.erro, a.corpo.erro, `${metodo} ${caminho}: mensagem diferente`);
    }
  }
});

test('cronometragem registrada nas duas versões gera o mesmo tempo padrão', async () => {
  const corpo = {
    operacao_id: 3, data: '2026-09-01', fator_ritmo: 1.05, tolerancia_pct: 12,
    leituras: [28.4, 29.1, 27.9, 30.2, 28.8, 29.5, 80],
  };
  const [a, b] = await Promise.all([
    noServidor('/api/cronometragens', { method: 'POST', body: corpo }),
    noEstatico('/api/cronometragens', { method: 'POST', body: corpo }),
  ]);
  assert.equal(b.status, 201);
  assert.deepEqual(comparar(a.corpo, b.corpo), [],
    `cronometragem divergiu:\n  ${comparar(a.corpo, b.corpo).join('\n  ')}`);

  // e a sequência do modelo passa a refletir o novo tempo padrão igualmente
  const [seqA, seqB] = await Promise.all([
    noServidor('/api/modelos/1/sequencia'),
    noEstatico('/api/modelos/1/sequencia'),
  ]);
  assert.deepEqual(comparar(seqA.corpo, seqB.corpo), [],
    `sequência pós-cronometragem divergiu:\n  ${comparar(seqA.corpo, seqB.corpo).join('\n  ')}`);
});

test('balanceamento simulado nas duas versões aloca os postos igual', async () => {
  const corpo = { modelo_id: 1, meta_pecas_hora: 60, minutos_disponiveis: 420, max_postos: 0 };
  const [a, b] = await Promise.all([
    noServidor('/api/balanceamento/simular', { method: 'POST', body: corpo }),
    noEstatico('/api/balanceamento/simular', { method: 'POST', body: corpo }),
  ]);
  assert.deepEqual(comparar(a.corpo, b.corpo), [],
    `balanceamento divergiu:\n  ${comparar(a.corpo, b.corpo).join('\n  ')}`);
});
