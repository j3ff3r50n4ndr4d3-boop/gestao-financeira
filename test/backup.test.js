'use strict';

/**
 * Testes da cópia de segurança.
 *
 * O motivo de existir é concreto: nos planos gratuitos de hospedagem o disco é
 * efêmero, então estes testes garantem que os dados lançados conseguem sair de um
 * ambiente e voltar inteiros em outro.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const { abrir } = require('../server/db');
const { semear } = require('../server/seed');
const { createServer } = require('../server/index');
const backup = require('../server/lib/backup');

let base = '';
let server = null;
let db = null;

test.before(async () => {
  db = abrir(':memory:');
  semear(db, { dias: 10, limpar: true });
  server = createServer(db);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => { if (server) server.close(); });

const contar = (banco, tabela) => banco.prepare(`SELECT COUNT(*) AS c FROM ${tabela}`).get().c;

/* ==================================================================== lib === */

test('exportar cobre todas as tabelas do esquema', () => {
  const dados = backup.exportar(db);

  assert.equal(dados.versao, backup.VERSAO_FORMATO);
  assert.match(dados.geradoEm, /^\d{4}-\d{2}-\d{2}T/, 'carimbo de tempo ISO');

  const esperadas = backup.tabelasDo(db);
  assert.deepEqual(Object.keys(dados.tabelas).sort(), [...esperadas].sort(), 'nenhuma tabela de fora');
  for (const nome of esperadas) {
    assert.equal(dados.contagem[nome], contar(db, nome), `contagem de ${nome} confere`);
    assert.equal(dados.tabelas[nome].length, contar(db, nome));
  }
  assert.ok(dados.contagem.apontamentos > 0, 'o cenário semeado tem apontamentos');
});

test('importar em banco vazio reproduz o conteúdo', () => {
  const dados = backup.exportar(db);

  const alvo = abrir(':memory:');
  alvo.exec('PRAGMA foreign_keys = ON');
  const r = backup.importar(alvo, dados);

  for (const nome of backup.tabelasDo(db)) {
    assert.equal(contar(alvo, nome), contar(db, nome), `${nome} tem a mesma quantidade de linhas`);
  }
  assert.ok(r.tabelas.length >= 10, 'várias tabelas restauradas');

  // e o conteúdo é o mesmo, não só a contagem
  const antes = db.prepare('SELECT SUM(pecas_produzidas) AS s FROM apontamentos').get().s;
  const depois = alvo.prepare('SELECT SUM(pecas_produzidas) AS s FROM apontamentos').get().s;
  assert.equal(depois, antes, 'total de peças preservado');
  alvo.close();
});

test('importar substitui o conteúdo existente em vez de somar', () => {
  const dados = backup.exportar(db);

  const alvo = abrir(':memory:');
  semear(alvo, { dias: 3, limpar: true });
  const antesDoImport = contar(alvo, 'apontamentos');

  backup.importar(alvo, dados);
  assert.equal(contar(alvo, 'apontamentos'), contar(db, 'apontamentos'), 'substituiu, não acumulou');
  assert.notEqual(antesDoImport, contar(alvo, 'apontamentos'), 'o cenário anterior foi descartado');
  alvo.close();
});

test('backup sem colunas adicionadas depois continua restaurável', () => {
  const dados = backup.exportar(db);
  // simula um backup antigo: remove uma coluna que o esquema atual possui
  for (const linha of dados.tabelas.producao_operador) delete linha.tempo_padrao_min;

  const alvo = abrir(':memory:');
  assert.doesNotThrow(() => backup.importar(alvo, dados));
  assert.equal(contar(alvo, 'producao_operador'), contar(db, 'producao_operador'));
  alvo.close();
});

test('falha no meio da restauração desfaz tudo e preserva o banco', () => {
  const dados = backup.exportar(db);
  dados.tabelas.apontamentos[0] = { ...dados.tabelas.apontamentos[0], pecas_produzidas: { invalido: true } };

  const antes = contar(db, 'apontamentos');
  assert.throws(() => backup.importar(db, dados), /Falha ao restaurar/);
  assert.equal(contar(db, 'apontamentos'), antes, 'ROLLBACK preservou os dados originais');
  assert.equal(
    db.prepare('SELECT SUM(pecas_produzidas) AS s FROM apontamentos').get().s,
    backup.exportar(db).tabelas.apontamentos.reduce((s, a) => s + a.pecas_produzidas, 0),
    'soma de peças intacta após a falha'
  );
});

test('payload inválido é rejeitado com mensagem clara', () => {
  assert.throws(() => backup.importar(db, null), /inválido/);
  assert.throws(() => backup.importar(db, { versao: 1 }), /sem a seção "tabelas"/);
  assert.throws(() => backup.importar(db, { versao: 99, tabelas: {} }), /mais recente/);
  assert.throws(() => backup.importar(db, { versao: 1, tabelas: { inexistente: [] } }), /Nenhuma tabela conhecida/);
});

/* ==================================================================== api === */

test('GET /api/backup baixa um anexo JSON completo', async () => {
  const res = await fetch(`${base}/api/backup`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.match(res.headers.get('content-disposition'), /attachment; filename="eficiencia-backup-\d{4}-\d{2}-\d{2}\.json"/);

  const dados = await res.json();
  assert.equal(dados.versao, backup.VERSAO_FORMATO);
  assert.ok(dados.tabelas.apontamentos.length > 0);
  assert.ok(dados.tabelas.producao_operador.length > 0, 'produção individual inclusa');
});

test('POST /api/restore reconstrói o banco a partir do JSON', async () => {
  const dados = await (await fetch(`${base}/api/backup`)).json();
  const totalAntes = contar(db, 'apontamentos');

  const res = await fetch(`${base}/api/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  assert.equal(res.status, 200);
  const corpo = await res.json();
  assert.equal(corpo.restaurado, true);
  assert.ok(corpo.tabelas >= 10, 'várias tabelas restauradas');
  assert.equal(contar(db, 'apontamentos'), totalAntes, 'mesma quantidade após o ciclo');

  // e a API continua respondendo normalmente depois da restauração
  const acomp = await (await fetch(`${base}/api/acompanhamento`)).json();
  assert.ok(acomp.resumo.pecas > 0, 'acompanhamento funcionando após o restore');
});

test('POST /api/restore rejeita corpo inválido sem tocar no banco', async () => {
  const antes = contar(db, 'apontamentos');
  const res = await fetch(`${base}/api/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versao: 1 }),
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).erro, /tabelas/);
  assert.equal(contar(db, 'apontamentos'), antes, 'banco intacto');
});
