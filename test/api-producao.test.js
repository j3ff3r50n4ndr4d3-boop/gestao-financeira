'use strict';

/**
 * Testes de integração dos módulos adicionados: equipes, operadores, sequência
 * operacional, cronometragem, balanceamento e acompanhamento da produção.
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
  semear(db, { dias: 30, limpar: true });
  server = createServer(db);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => { if (server) server.close(); });

const api = async (caminho, opts = {}) => {
  const res = await fetch(base + caminho, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const tipo = res.headers.get('content-type') || '';
  return { status: res.status, corpo: tipo.includes('application/json') ? await res.json() : await res.text() };
};

const quase = (a, b, msg, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} != ${b}`);

/* ================================================================== seed === */

test('seed cria equipes, operadores, sequências, cronometragens e produção individual', async () => {
  const [equipes, operadores] = await Promise.all([api('/api/equipes'), api('/api/operadores')]);
  assert.equal(equipes.status, 200);
  assert.ok(equipes.corpo.length >= 3, 'pelo menos 3 equipes');
  assert.ok(operadores.corpo.length >= 30, 'operadores distribuídos nas equipes');
  assert.ok(operadores.corpo.every((o) => o.equipe_id), 'todo operador tem equipe');

  const modelos = (await api('/api/modelos')).corpo;
  const seq = (await api(`/api/modelos/${modelos[0].id}/sequencia`)).corpo;
  assert.ok(seq.totalOperacoes > 0, 'modelo tem sequência operacional');
  assert.ok(seq.operacoes.every((o) => o.temCronometragem), 'toda operação tem cronometragem');

  const prod = await api('/api/producao');
  assert.ok(prod.corpo.length > 0, 'há produção individual registrada');
});

test('SAM cadastrado coincide com a soma dos tempos padrão da sequência', async () => {
  const modelos = (await api('/api/modelos')).corpo;
  for (const m of modelos) {
    const seq = (await api(`/api/modelos/${m.id}/sequencia`)).corpo;
    quase(seq.samCalculadoMin, seq.samCadastradoMin, `SAM de ${m.codigo}`, 1e-6);
    quase(seq.divergenciaMin, 0, `divergência de ${m.codigo}`);
  }
});

test('tempo padrão da operação reflete a cadeia TO × ritmo × tolerância', async () => {
  const modelos = (await api('/api/modelos')).corpo;
  const seq = (await api(`/api/modelos/${modelos[0].id}/sequencia`)).corpo;
  for (const op of seq.operacoes) {
    const c = op.cronometragemVigente;
    const esperado = c.tempoObservadoMedio * c.fatorRitmo * (1 + c.toleranciaPct / 100);
    quase(c.tempoPadrao, esperado, `TP da operação ${op.sequencia}`, 1e-6);
    quase(op.tempoPadraoMin, c.tempoPadrao / 60, `minutos da operação ${op.sequencia}`);
  }
});

/* ============================================================== equipes === */

test('CRUD de equipes com proteção contra exclusão em uso', async () => {
  const criada = await api('/api/equipes', { method: 'POST', body: { nome: 'Equipe Teste', setor: 'Costura', lider: 'Fulano' } });
  assert.equal(criada.status, 201);

  const duplicada = await api('/api/equipes', { method: 'POST', body: { nome: 'Equipe Teste' } });
  assert.equal(duplicada.status, 409);

  const semNome = await api('/api/equipes', { method: 'POST', body: { setor: 'Costura' } });
  assert.equal(semNome.status, 400);

  const atualizada = await api(`/api/equipes/${criada.corpo.id}`, { method: 'PUT', body: { lider: 'Beltrano' } });
  assert.equal(atualizada.status, 200);
  assert.equal(atualizada.corpo.lider, 'Beltrano');

  assert.equal((await api(`/api/equipes/${criada.corpo.id}`, { method: 'DELETE' })).status, 200);

  const emUso = (await api('/api/equipes')).corpo.find((e) => e.operadores > 0);
  assert.ok(emUso, 'existe equipe com operadores no cenário');
  assert.equal((await api(`/api/equipes/${emUso.id}`, { method: 'DELETE' })).status, 409);
});

/* ============================================================ operadores === */

test('CRUD de operadores com matrícula única e proteção contra exclusão', async () => {
  const equipes = (await api('/api/equipes')).corpo;
  const criado = await api('/api/operadores', {
    method: 'POST',
    body: { nome: 'Operador Teste', matricula: 'ZZ-999', equipe_id: equipes[0].id, funcao: 'Costureira', custo_hora: 20 },
  });
  assert.equal(criado.status, 201);

  const duplicado = await api('/api/operadores', { method: 'POST', body: { nome: 'Outro', matricula: 'ZZ-999' } });
  assert.equal(duplicado.status, 409);

  const equipeInexistente = await api('/api/operadores', { method: 'POST', body: { nome: 'X', equipe_id: 99999 } });
  assert.equal(equipeInexistente.status, 400);

  assert.equal((await api(`/api/operadores/${criado.corpo.id}`, { method: 'DELETE' })).status, 200);

  const comProducao = (await api('/api/producao')).corpo[0];
  assert.equal((await api(`/api/operadores/${comProducao.operadorId}`, { method: 'DELETE' })).status, 409);
});

/* ================================================================ operações === */

test('CRUD de operações respeita a unicidade da sequência no modelo', async () => {
  const modelo = (await api('/api/modelos')).corpo[0];
  const criada = await api('/api/operacoes', {
    method: 'POST',
    body: { modelo_id: modelo.id, sequencia: 900, descricao: 'Operação de teste', maquina: 'Reta', tempo_padrao: 45 },
  });
  assert.equal(criada.status, 201);
  quase(criada.corpo.tempoPadraoMin, 0.75, '45 s = 0,75 min');

  const duplicada = await api('/api/operacoes', {
    method: 'POST',
    body: { modelo_id: modelo.id, sequencia: 900, descricao: 'Duplicada', tempo_padrao: 10 },
  });
  assert.equal(duplicada.status, 409);

  const semDescricao = await api('/api/operacoes', { method: 'POST', body: { modelo_id: modelo.id, sequencia: 901 } });
  assert.equal(semDescricao.status, 400);

  const modeloInexistente = await api('/api/operacoes', { method: 'POST', body: { modelo_id: 99999, sequencia: 1, descricao: 'x' } });
  assert.equal(modeloInexistente.status, 400);

  const atualizada = await api(`/api/operacoes/${criada.corpo.id}`, { method: 'PUT', body: { tempo_padrao: 60 } });
  assert.equal(atualizada.status, 200);
  quase(atualizada.corpo.tempoPadraoMin, 1);

  // a nova operação entra no SAM calculado
  const seq = (await api(`/api/modelos/${modelo.id}/sequencia`)).corpo;
  assert.ok(seq.samCalculadoMin > seq.samCadastradoMin, 'SAM calculado cresceu');
  assert.ok(Math.abs(seq.divergenciaMin - 1) < 1e-6, `divergência de 1 min, veio ${seq.divergenciaMin}`);

  assert.equal((await api(`/api/operacoes/${criada.corpo.id}`, { method: 'DELETE' })).status, 200);
  const seq2 = (await api(`/api/modelos/${modelo.id}/sequencia`)).corpo;
  quase(seq2.divergenciaMin, 0, 'divergência volta a zero');
});

/* ========================================================== cronometragem === */

test('cronometragem atualiza o tempo padrão da operação', async () => {
  const modelo = (await api('/api/modelos')).corpo[0];
  const seq = (await api(`/api/modelos/${modelo.id}/sequencia`)).corpo;
  const operacao = seq.operacoes[0];
  const antes = operacao.tempoPadraoMin;

  const criada = await api('/api/cronometragens', {
    method: 'POST',
    body: {
      operacao_id: operacao.id,
      data: '2026-09-05',
      leituras: [20, 20, 20, 20, 20],
      fator_ritmo: 1.2,
      tolerancia_pct: 10,
      observacao: 'Recronometragem',
    },
  });
  assert.equal(criada.status, 201);
  quase(criada.corpo.resumo.tempoObservadoMedio, 20);
  quase(criada.corpo.resumo.tempoNormal, 24);
  quase(criada.corpo.resumo.tempoPadrao, 26.4);

  const seqDepois = (await api(`/api/modelos/${modelo.id}/sequencia`)).corpo;
  quase(seqDepois.operacoes[0].tempoPadraoMin, 26.4 / 60, 'operação assumiu o novo tempo padrão');
  assert.notEqual(seqDepois.operacoes[0].tempoPadraoMin, antes);

  // remover a cronometragem restaura o tempo padrão anterior
  assert.equal((await api(`/api/cronometragens/${criada.corpo.id}`, { method: 'DELETE' })).status, 200);
  const seqFinal = (await api(`/api/modelos/${modelo.id}/sequencia`)).corpo;
  quase(seqFinal.operacoes[0].tempoPadraoMin, antes, 'tempo padrão restaurado');
});

test('cronometragem valida leituras, fator de ritmo e referências', async () => {
  const modelo = (await api('/api/modelos')).corpo[0];
  const seq = (await api(`/api/modelos/${modelo.id}/sequencia`)).corpo;
  const opId = seq.operacoes[0].id;

  assert.equal((await api('/api/cronometragens', { method: 'POST', body: { operacao_id: opId, data: '2026-09-05', leituras: [] } })).status, 400);
  assert.equal((await api('/api/cronometragens', { method: 'POST', body: { operacao_id: opId, data: '05/09/2026', leituras: [10] } })).status, 400);
  assert.equal((await api('/api/cronometragens', { method: 'POST', body: { operacao_id: 99999, data: '2026-09-05', leituras: [10] } })).status, 400);
  assert.equal((await api('/api/cronometragens', { method: 'POST', body: { operacao_id: opId, data: '2026-09-05', leituras: [10], fator_ritmo: 5 } })).status, 400);
  assert.equal((await api('/api/cronometragens', { method: 'POST', body: { operacao_id: opId, data: '2026-09-05', leituras: [10], operador_id: 99999 } })).status, 400);
});

test('recalcular SAM grava o valor da sequência no modelo', async () => {
  const modelo = (await api('/api/modelos')).corpo[1];
  const r = await api(`/api/modelos/${modelo.id}/recalcular-sam`, { method: 'POST' });
  assert.equal(r.status, 200);
  quase(r.corpo.divergenciaMin, 0);
  const recarregado = (await api('/api/modelos')).corpo.find((m) => m.id === modelo.id);
  quase(recarregado.sam_min, r.corpo.samCalculadoMin, 'sam_min gravado');
  assert.equal((await api('/api/modelos/99999/recalcular-sam', { method: 'POST' })).status, 404);
});

/* ========================================================= balanceamento === */

test('simulação de balanceamento devolve postos, gargalo e eficiência', async () => {
  const modelo = (await api('/api/modelos')).corpo.find((m) => m.codigo === 'CAM-100');
  const r = await api('/api/balanceamento/simular', {
    method: 'POST',
    body: { modelo_id: modelo.id, meta_pecas_hora: 100, minutos_disponiveis: 420 },
  });
  assert.equal(r.status, 200);
  const res = r.corpo.resultado;

  assert.ok(res.estacoes.length > 0, 'postos alocados');
  quase(res.pitchTime, 0.6, '60 / 100 peças por hora');
  quase(res.sam, res.estacoes.reduce((s, e) => s + e.tempo, 0), 'nenhum tempo perdido');
  assert.equal(res.estacoes.flatMap((e) => e.operacoes).length, res.operacoes, 'todas as operações alocadas');
  quase(res.eficiencia, res.sam / (res.postosUsados * res.tempoCiclo), 'fórmula da eficiência');
  quase(res.producaoHora, 60 / res.tempoCiclo);
  quase(res.producaoTurno, res.producaoHora * 7);
  assert.ok(Array.isArray(res.recomendacoes) && res.recomendacoes.length > 0);

  // meta impossível deve ser sinalizada
  assert.equal(res.atendimentoMeta, false, '100 peças/h com SAM de 8,5 min exige mais postos');
  assert.ok(res.minTeoricoPostos > 0);
});

test('balanceamento valida modelo, meta e sequência', async () => {
  const modelo = (await api('/api/modelos')).corpo[0];
  assert.equal((await api('/api/balanceamento/simular', { method: 'POST', body: { modelo_id: modelo.id, meta_pecas_hora: 0 } })).status, 400);
  assert.equal((await api('/api/balanceamento/simular', { method: 'POST', body: { modelo_id: 99999, meta_pecas_hora: 50 } })).status, 400);

  // modelo sem sequência
  const novo = await api('/api/modelos', { method: 'POST', body: { codigo: 'SEM-SEQ', nome: 'Sem sequência', sam_min: 5 } });
  assert.equal(novo.status, 201);
  const semSeq = await api('/api/balanceamento/simular', { method: 'POST', body: { modelo_id: novo.corpo.id, meta_pecas_hora: 50 } });
  assert.equal(semSeq.status, 400);
  assert.match(semSeq.corpo.erro, /sequência operacional/);
  await api(`/api/modelos/${novo.corpo.id}`, { method: 'DELETE' });
});

test('balanceamento pode ser salvo, listado e removido', async () => {
  const modelo = (await api('/api/modelos')).corpo.find((m) => m.codigo === 'CAM-100');
  const salvo = await api('/api/balancos', {
    method: 'POST',
    body: { nome: 'Linha 1 - turno 1', modelo_id: modelo.id, meta_pecas_hora: 60, minutos_disponiveis: 420, max_postos: 14 },
  });
  assert.equal(salvo.status, 201);

  const lista = await api('/api/balancos');
  assert.equal(lista.status, 200);
  assert.ok(lista.corpo.some((b) => b.id === salvo.corpo.id));
  const item = lista.corpo.find((b) => b.id === salvo.corpo.id);
  assert.ok(Array.isArray(item.alocacao), 'alocação desserializada');
  assert.equal(item.resultado.postosUsados, salvo.corpo.resultado.postosUsados);

  assert.equal((await api(`/api/balancos/${salvo.corpo.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await api('/api/balancos/99999', { method: 'DELETE' })).status, 404);
});

/* ======================================================== acompanhamento === */

test('acompanhamento devolve diário, mensal, individual e por equipe', async () => {
  const r = await api('/api/acompanhamento');
  assert.equal(r.status, 200);
  const a = r.corpo;

  assert.ok(a.porDia.length > 0, 'série diária');
  assert.ok(a.porMes.length > 0, 'série mensal');
  assert.ok(a.porOperador.length > 0, 'ranking individual');
  assert.ok(a.porEquipe.length > 0, 'ranking por equipe');
  assert.ok(a.resumo.pecas > 0);
  assert.ok(a.resumo.operadores > 0);

  for (const d of a.porDia) {
    assert.match(d.data, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].includes(d.diaSemana), d.diaSemana);
  }
  for (const m of a.porMes) assert.match(m.mes, /^\d{4}-\d{2}$/);
});

test('as visões do acompanhamento fecham com o mesmo total', async () => {
  const a = (await api('/api/acompanhamento')).corpo;
  const soma = (arr, campo) => arr.reduce((s, x) => s + x[campo], 0);

  quase(soma(a.porDia, 'pecas'), a.resumo.pecas, 'peças: diário = resumo', 1e-6);
  quase(soma(a.porMes, 'pecas'), a.resumo.pecas, 'peças: mensal = resumo', 1e-6);
  quase(soma(a.porOperador, 'pecas'), a.resumo.pecas, 'peças: individual = resumo', 1e-6);
  quase(soma(a.porEquipe, 'pecas'), a.resumo.pecas, 'peças: equipe = resumo', 1e-6);
  quase(soma(a.porLinha, 'pecas'), a.resumo.pecas, 'peças: linha = resumo', 1e-6);

  quase(soma(a.porDia, 'minutos'), a.resumo.minutos, 'minutos: diário = resumo', 1e-6);
  quase(soma(a.porDia, 'defeitos'), a.resumo.defeitos, 'defeitos: diário = resumo', 1e-6);

  // eficiência consolidada recalculada a partir dos totais
  const eficienciaEsperada = (a.resumo.minutosPadrao / a.resumo.minutos) * 100;
  quase(a.resumo.eficienciaPct, eficienciaEsperada, 'eficiência consolidada', 1e-6);
  assert.equal(a.registros, soma(a.porDia, 'registros'), 'contagem de registros');
});

test('eficiência individual usa o tempo padrão do posto e fica em faixa plausível', async () => {
  const a = (await api('/api/acompanhamento')).corpo;
  for (const o of a.porOperador) {
    assert.ok(Number.isFinite(o.eficienciaPct), `${o.operador} tem eficiência finita`);
    assert.ok(o.eficienciaPct > 30 && o.eficienciaPct < 160,
      `${o.operador} com eficiência fora da faixa plausível: ${o.eficienciaPct.toFixed(1)}%`);
    assert.equal(o.basePadrao, 'POSTO', 'padrão por posto balanceado');
    quase(o.eficienciaPct, (o.minutosPadrao / o.minutos) * 100, `eficiência de ${o.operador}`, 1e-6);
  }
  // o ranking vem ordenado por eficiência
  for (let i = 1; i < a.porOperador.length; i++) {
    assert.ok(a.porOperador[i - 1].eficienciaPct >= a.porOperador[i].eficienciaPct, 'ranking ordenado');
  }
});

test('filtro por equipe restringe o acompanhamento', async () => {
  const equipes = (await api('/api/equipes')).corpo;
  const alvo = equipes.find((e) => e.operadores > 0);
  const a = (await api(`/api/acompanhamento?equipeId=${alvo.id}`)).corpo;
  assert.ok(a.porEquipe.length === 1, 'apenas a equipe filtrada');
  assert.equal(a.porEquipe[0].equipe, alvo.nome);
  assert.ok(a.porOperador.every((o) => o.equipe === alvo.nome));
});

test('produção individual pode ser substituída por apontamento', async () => {
  const producao = (await api('/api/producao')).corpo;
  assert.ok(producao.length > 0, 'há produção individual no cenário');
  const alvo = producao[0].apontamentoId;
  assert.ok(alvo, 'registro aponta para um apontamento');

  const operadores = (await api('/api/operadores')).corpo.slice(0, 3);
  const antes = (await api(`/api/apontamentos/${alvo}/producao`)).corpo;
  assert.ok(antes.length > 0, 'apontamento já tinha produção');
  assert.ok(antes.every((r) => r.apontamentoId === alvo), 'filtro por apontamento funciona');

  const itens = operadores.map((o, i) => ({
    operador_id: o.id, minutos: 400, pecas: 300 + i * 10, defeitos: i, tempo_padrao_min: 0.6,
  }));
  const r = await api(`/api/apontamentos/${alvo}/producao`, { method: 'PUT', body: { itens } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.length, 3, 'substituiu a lista anterior');
  quase(r.corpo[0].eficienciaPct, ((300 * 0.6) / 400) * 100, 'eficiência com padrão de posto', 1e-6);
  assert.equal(r.corpo[0].basePadrao, 'POSTO');

  // validações
  const duplicado = await api(`/api/apontamentos/${alvo}/producao`, {
    method: 'PUT',
    body: { itens: [{ operador_id: operadores[0].id, pecas: 1 }, { operador_id: operadores[0].id, pecas: 2 }] },
  });
  assert.equal(duplicado.status, 400);

  const operadorInvalido = await api(`/api/apontamentos/${alvo}/producao`, {
    method: 'PUT', body: { itens: [{ operador_id: 99999, pecas: 1 }] },
  });
  assert.equal(operadorInvalido.status, 400);

  const semItens = await api(`/api/apontamentos/${alvo}/producao`, { method: 'PUT', body: {} });
  assert.equal(semItens.status, 400);

  const apontamentoInexistente = await api('/api/apontamentos/999999/producao', { method: 'PUT', body: { itens: [] } });
  assert.equal(apontamentoInexistente.status, 404);
});

