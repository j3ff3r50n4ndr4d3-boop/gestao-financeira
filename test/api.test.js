'use strict';

/**
 * Teste de integração: sobe o servidor HTTP real contra um SQLite em memória,
 * semeado com os dados de exemplo, e exercita as rotas de ponta a ponta.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const { abrir } = require('../server/db');
const { semear } = require('../server/seed');
const { createServer } = require('../server/index');

let base = '';
let server = null;
let db = null;

test.before(async () => {
  db = abrir(':memory:');
  semear(db, { dias: 45, limpar: true });
  server = createServer(db);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  if (server) server.close();
});

const api = async (caminho, opts = {}) => {
  const res = await fetch(base + caminho, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const tipo = res.headers.get('content-type') || '';
  const corpo = tipo.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, corpo, headers: res.headers };
};

test('GET /api/health responde ok', async () => {
  const r = await api('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.corpo.status, 'ok');
});

test('GET /api/catalogos traz motivos de parada e metas', async () => {
  const r = await api('/api/catalogos');
  assert.equal(r.status, 200);
  assert.ok(r.corpo.motivosParada.length >= 10);
  assert.ok(r.corpo.motivosParada.some((m) => m.codigo === 'QUEBRA'));
  assert.ok(r.corpo.metas.metaOee > 0);
  assert.ok(r.corpo.setores.includes('Costura'));
});

test('seed criou turnos, linhas e modelos', async () => {
  const [turnos, maquinas, modelos] = await Promise.all([
    api('/api/turnos'), api('/api/maquinas'), api('/api/modelos'),
  ]);
  assert.equal(turnos.status, 200);
  assert.equal(turnos.corpo.length, 2);
  assert.equal(maquinas.corpo.length, 6);
  assert.equal(modelos.corpo.length, 10);
  const linha1 = maquinas.corpo.find((m) => m.nome.includes('Linha 1'));
  assert.equal(linha1.operadores, 14);
});

test('GET /api/apontamentos devolve itens já com indicadores de OEE', async () => {
  const r = await api('/api/apontamentos?limite=20');
  assert.equal(r.status, 200);
  assert.ok(r.corpo.total > 0);
  const item = r.corpo.itens[0];
  assert.ok(item.indicadores, 'cada item deve trazer indicadores');
  for (const campo of ['oeePct', 'disponibilidadePct', 'desempenhoPct', 'qualidadePct', 'producaoHora']) {
    assert.ok(Number.isFinite(item.indicadores[campo]), `${campo} deve ser número, veio ${item.indicadores[campo]}`);
  }
  assert.ok(item.indicadores.oeePct >= 0 && item.indicadores.oeePct <= 100);
});

test('filtro de período por data funciona', async () => {
  const todos = await api('/api/apontamentos');
  const datas = todos.corpo.itens.map((i) => i.data).sort();
  const de = datas[Math.floor(datas.length / 2)];
  const ate = datas[datas.length - 1];
  const filtrado = await api(`/api/apontamentos?de=${de}&ate=${ate}`);
  assert.ok(filtrado.corpo.total < todos.corpo.total, 'filtro deve reduzir o total');
  assert.ok(filtrado.corpo.itens.every((i) => i.data >= de && i.data <= ate));
});

test('POST /api/apontamentos grava, calcula OEE e devolve 201', async () => {
  const [maquinas, turnos, modelos] = await Promise.all([api('/api/maquinas'), api('/api/turnos'), api('/api/modelos')]);
  const linha = maquinas.corpo.find((m) => m.nome.includes('Linha 1')); // 14 operadores
  const modelo = modelos.corpo.find((m) => m.codigo === 'CAM-100');    // SAM 8,5

  const r = await api('/api/apontamentos', {
    method: 'POST',
    body: {
      data: '2026-01-05',
      maquina_id: linha.id,
      turno_id: turnos.corpo[0].id,
      modelo_id: modelo.id,
      lider: 'Teste Automatizado',
      pecas_produzidas: 1000,
      pecas_defeito: 20,
      pecas_retrabalho: 15,
      observacao: 'registro criado pelo teste',
      paradas: [
        { motivo: 'QUEBRA', minutos: 30 },
        { motivo: 'FALTA_MATERIAL', minutos: 30 },
      ],
    },
  });

  assert.equal(r.status, 201);
  const i = r.corpo.indicadores;
  // tempo planejado 420, operação 360 → A = 85,714%
  assert.ok(Math.abs(i.disponibilidadePct - (360 / 420) * 100) < 0.001);
  // ICT = 8,5/14 min/peça → teóricas = 360/ICT → desempenho = 1000/teóricas
  const desempenhoEsperado = (1000 * (8.5 / 14)) / 360;
  assert.equal(i.desempenhoAcimaDoPadrao, true);
  assert.ok(Math.abs(i.desempenhoPct - desempenhoEsperado * 100) < 0.001,
    `desempenho cru esperado ${desempenhoEsperado * 100}, veio ${i.desempenhoPct}`);
  assert.ok(i.desempenhoPct > 100, 'desempenho exibido acima de 100% sinaliza SAM defasado');
  assert.ok(Math.abs(i.qualidadePct - (980 / 1000) * 100) < 0.001);
  // OEE limita desempenho a 100%: A × 1 × Q
  assert.ok(Math.abs(i.oeePct - (360 / 420) * 98) < 0.001);
  assert.equal(r.corpo.paradas.length, 2);

  // O registro deve aparecer na listagem e no GET individual
  const lido = await api(`/api/apontamentos/${r.corpo.id}`);
  assert.equal(lido.status, 200);
  assert.equal(lido.corpo.lider, 'Teste Automatizado');
  assert.equal(lido.corpo.indicadores.pecasProduzidas, 1000);
});

test('POST /api/apontamentos rejeita dados inválidos com 400/409', async () => {
  const [maquinas, turnos] = await Promise.all([api('/api/maquinas'), api('/api/turnos')]);
  const base_ = { maquina_id: maquinas.corpo[0].id, turno_id: turnos.corpo[0].id };

  const dataInvalida = await api('/api/apontamentos', { method: 'POST', body: { ...base_, data: '05/01/2026', pecas_produzidas: 10 } });
  assert.equal(dataInvalida.status, 400);

  const defeitoMaior = await api('/api/apontamentos', { method: 'POST', body: { ...base_, data: '2026-01-06', pecas_produzidas: 10, pecas_defeito: 20 } });
  assert.equal(defeitoMaior.status, 400);

  const linhaInexistente = await api('/api/apontamentos', { method: 'POST', body: { ...base_, data: '2026-01-06', maquina_id: 99999 } });
  assert.equal(linhaInexistente.status, 400);

  const motivoInvalido = await api('/api/apontamentos', { method: 'POST', body: { ...base_, data: '2026-01-06', paradas: [{ motivo: 'XXX', minutos: 10 }] } });
  assert.equal(motivoInvalido.status, 400);

  const paradasExcedemTurno = await api('/api/apontamentos', { method: 'POST', body: { ...base_, data: '2026-01-06', paradas: [{ motivo: 'QUEBRA', minutos: 9999 }] } });
  assert.equal(paradasExcedemTurno.status, 400);
});

test('PUT /api/apontamentos atualiza e recalcula', async () => {
  const lista = await api('/api/apontamentos?limite=1');
  const id = lista.corpo.itens[0].id;
  const antes = lista.corpo.itens[0].indicadores.oeePct;

  const r = await api(`/api/apontamentos/${id}`, { method: 'PUT', body: { pecas_defeito: 0, paradas: [] } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.paradas.length, 0);
  assert.ok(r.corpo.indicadores.oeePct >= antes, 'sem paradas e sem defeito o OEE não pode cair');
});

test('turno que cruza a meia-noite tem duração calculada corretamente', async () => {
  const criado = await api('/api/turnos', {
    method: 'POST',
    body: { nome: '3º Turno', hora_inicio: '22:00', hora_fim: '06:00' },
  });
  assert.equal(criado.status, 201);
  assert.equal(criado.corpo.minutos_totais, 480, '22h às 6h = 8 horas');
  assert.equal(criado.corpo.pausas_planejadas, 0);

  const atualizado = await api(`/api/turnos/${criado.corpo.id}`, { method: 'PUT', body: { pausas_planejadas: 45 } });
  assert.equal(atualizado.status, 200);
  assert.equal(atualizado.corpo.pausas_planejadas, 45);

  const removido = await api(`/api/turnos/${criado.corpo.id}`, { method: 'DELETE' });
  assert.equal(removido.status, 200);
});

test('turno com pausas maiores que a duração é rejeitado', async () => {
  const r = await api('/api/turnos', {
    method: 'POST',
    body: { nome: 'Turno Impossível', hora_inicio: '08:00', hora_fim: '09:00', pausas_planejadas: 120 },
  });
  assert.equal(r.status, 400);
});

test('CRUD de linha e de modelo, com proteção contra exclusão em uso', async () => {
  const linha = await api('/api/maquinas', {
    method: 'POST',
    body: { nome: 'Linha Piloto Teste', setor: 'Costura', tipo: 'Reta', operadores: 8, custo_hora: 200, meta_oee: 0.9 },
  });
  assert.equal(linha.status, 201);
  assert.equal(linha.corpo.operadores, 8);

  const modelo = await api('/api/modelos', {
    method: 'POST',
    body: { codigo: 'tst-001', nome: 'Peça de Teste', categoria: 'Teste', sam_min: 12.5, preco_venda: 45 },
  });
  assert.equal(modelo.status, 201);
  assert.equal(modelo.corpo.codigo, 'TST-001', 'código normalizado para maiúsculas');

  const duplicado = await api('/api/modelos', {
    method: 'POST',
    body: { codigo: 'TST-001', nome: 'Duplicada', sam_min: 5 },
  });
  assert.equal(duplicado.status, 409);

  const semSam = await api('/api/modelos', { method: 'POST', body: { codigo: 'TST-002', nome: 'Sem SAM', sam_min: 0 } });
  assert.equal(semSam.status, 400);

  assert.equal((await api(`/api/modelos/${modelo.corpo.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await api(`/api/maquinas/${linha.corpo.id}`, { method: 'DELETE' })).status, 200);

  // exclusão de modelo/linha em uso deve falhar com 409
  const emUso = await api('/api/apontamentos?limite=1');
  const modeloEmUso = emUso.corpo.itens.find((i) => i.modeloId);
  const bloqueado = await api(`/api/modelos/${modeloEmUso.modeloId}`, { method: 'DELETE' });
  assert.equal(bloqueado.status, 409);
});

test('PUT /api/metas persiste as metas da fábrica', async () => {
  const r = await api('/api/metas', { method: 'PUT', body: { metaOee: 0.9, metaQualidade: 0.995 } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.metaOee, 0.9);
  assert.equal(r.corpo.metaQualidade, 0.995);

  const invalida = await api('/api/metas', { method: 'PUT', body: { metaOee: 5 } });
  assert.equal(invalida.status, 400);

  await api('/api/metas', { method: 'PUT', body: { metaOee: 0.85, metaQualidade: 0.99 } });
});

test('GET /api/dashboard consolida o período com todos os blocos', async () => {
  const r = await api('/api/dashboard');
  assert.equal(r.status, 200);
  const d = r.corpo;

  assert.ok(d.periodo.de && d.periodo.ate);
  assert.ok(d.tendencia.length > 0, 'tendência diária');
  assert.ok(d.ranking.length > 0, 'ranking por linha');
  assert.ok(d.paretoParadas.length > 0, 'Pareto de paradas');
  assert.ok(d.seisPerdas.length > 0, '6 grandes perdas');
  assert.ok(d.modelos.length > 0, 'análise por modelo');

  const g = d.geral;
  for (const campo of ['oeePct', 'disponibilidadePct', 'desempenhoPct', 'qualidadePct']) {
    assert.ok(Number.isFinite(g[campo]), `${campo} deve ser finito`);
    assert.ok(g[campo] >= 0, `${campo} não pode ser negativo, veio ${g[campo]}`);
  }
  // Disponibilidade e qualidade são razões limitadas a 1; o OEE é limitado pelo
  // desempenho teto. O desempenho, não: ele é reportado cru para revelar SAM defasado.
  for (const campo of ['oeePct', 'disponibilidadePct', 'qualidadePct']) {
    assert.ok(g[campo] <= 100, `${campo} deve estar entre 0 e 100, veio ${g[campo]}`);
  }
  assert.ok(g.apontamentos > 0);
  assert.ok(g.pecasProduzidas > g.pecasBoas, 'há refugo no cenário de exemplo');
  assert.ok(g.custoPerdaTotal > 0, 'perdas monetizadas');

  // Pareto ordenado do maior para o menor
  for (let i = 1; i < d.paretoParadas.length; i++) {
    assert.ok(d.paretoParadas[i - 1].minutos >= d.paretoParadas[i].minutos, 'Pareto ordenado');
  }
  // Ranking ordenado por OEE decrescente
  for (let i = 1; i < d.ranking.length; i++) {
    assert.ok(d.ranking[i - 1].oeePct >= d.ranking[i].oeePct, 'ranking ordenado');
  }
});

test('dashboard consolidado bate com o recálculo a partir dos apontamentos', async () => {
  const dash = (await api('/api/dashboard')).corpo;
  const { de, ate } = dash.periodo;
  const lista = (await api(`/api/apontamentos?de=${de}&ate=${ate}`)).corpo.itens;

  let tempoPlanejado = 0, tempoOperacao = 0, produzidoMin = 0, pecas = 0, boas = 0;
  for (const a of lista) {
    const i = a.indicadores;
    tempoPlanejado += i.tempoPlanejado;
    tempoOperacao += i.tempoOperacao;
    produzidoMin += i.pecasProduzidas * i.tempoCicloIdealMin;
    pecas += i.pecasProduzidas;
    boas += i.pecasBoas;
  }

  const oeeEsperado = (tempoOperacao / tempoPlanejado) * (produzidoMin / tempoOperacao) * (boas / pecas) * 100;
  assert.equal(dash.geral.apontamentos, lista.length, 'mesma base de apontamentos');
  assert.ok(Math.abs(dash.geral.oeePct - oeeEsperado) < 0.01, `OEE ${dash.geral.oeePct} vs recálculo ${oeeEsperado}`);
  assert.equal(dash.geral.pecasProduzidas, pecas);
});

test('dashboard filtra por linha', async () => {
  const geral = (await api('/api/dashboard')).corpo;
  const linha = geral.ranking[0];
  const filtrado = (await api(`/api/dashboard?maquinaId=${linha.maquinaId}`)).corpo;
  assert.equal(filtrado.ranking.length, 1);
  assert.equal(filtrado.ranking[0].maquinaId, linha.maquinaId);
  assert.ok(filtrado.geral.apontamentos < geral.geral.apontamentos);
});

test('GET /api/simular calcula OEE sem gravar nada', async () => {
  const [maquinas, turnos, modelos] = await Promise.all([api('/api/maquinas'), api('/api/turnos'), api('/api/modelos')]);
  const antes = (await api('/api/apontamentos')).corpo.total;

  const r = await api('/api/simular', {
    method: 'POST',
    body: {
      data: '2026-01-10',
      maquina_id: maquinas.corpo[0].id,
      turno_id: turnos.corpo[0].id,
      modelo_id: modelos.corpo[0].id,
      pecas_produzidas: 100,
      pecas_defeito: 2,
      paradas: [{ motivo: 'SETUP', minutos: 45 }],
    },
  });
  assert.equal(r.status, 200);
  assert.ok(r.corpo.indicadores.oeePct > 0);
  assert.equal((await api('/api/apontamentos')).corpo.total, antes, 'simulação não grava');
});

test('exportação CSV devolve cabeçalho e linhas', async () => {
  const res = await fetch(base + '/api/export/apontamentos.csv');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);

  // O BOM precisa ser conferido em bytes: fetch().text() remove o BOM por especificação.
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.deepEqual(bytes.subarray(0, 3), Buffer.from([0xef, 0xbb, 0xbf]), 'BOM UTF-8 para o Excel');

  const texto = bytes.toString('utf8');
  const linhas = texto.trim().split('\r\n');
  assert.ok(linhas.length > 10, `esperava várias linhas, vieram ${linhas.length}`);
  assert.match(linhas[0], /^Data;Linha\/Célula;Setor;Turno;Modelo;SAM/);
  assert.ok(linhas[1].includes(';'), 'linha de dados separada por ;');
  assert.equal(linhas[0].split(';').length, linhas[1].split(';').length, 'mesmo número de colunas');
});

test('rotas de listagem devolvem arrays JSON, não escalares', async () => {
  // Regressão: um handler que devolve lista crua não pode ter a primeira linha
  // interpretada como código HTTP pelo dispatcher.
  for (const caminho of ['/api/turnos', '/api/maquinas', '/api/modelos']) {
    const r = await api(caminho);
    assert.equal(r.status, 200, `${caminho} deve responder 200`);
    assert.ok(Array.isArray(r.corpo), `${caminho} deve devolver um array, veio ${typeof r.corpo}`);
    assert.ok(r.corpo.length > 0);
    assert.equal(typeof r.corpo[0], 'object', 'cada item é um objeto');
  }
});

test('rota inexistente devolve 404 em JSON', async () => {
  const r = await api('/api/nao-existe');
  assert.equal(r.status, 404);
  assert.ok(r.corpo.erro);
});

test('não serve arquivos fora da pasta public', async () => {
  const http = require('node:http');
  const requisicaoCrua = (caminho) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port: server.address().port, path: caminho, method: 'GET' },
        (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }
      );
      req.on('error', reject);
      req.end();
    });

  for (const caminho of ['/%2e%2e%2fserver/db.js', '/..%2fserver/db.js', '/server/db.js']) {
    const status = await requisicaoCrua(caminho);
    assert.notEqual(status, 200, `${caminho} não pode devolver 200 (veio ${status})`);
  }
});
