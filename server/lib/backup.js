'use strict';

/**
 * Cópia de segurança e restauração do banco inteiro.
 *
 * Motivo de existir: nos planos gratuitos de hospedagem o disco é efêmero — a cada
 * reinício o SQLite volta vazio e a aplicação resemeia os dados de exemplo. O
 * backup em JSON permite levar os dados lançados de um ambiente para outro sem
 * depender de disco persistente.
 */

/** Ordem de inserção: referenciadas antes das que as referenciam. */
const ORDEM_INSERCAO = [
  'config',
  'turnos',
  'setores',
  'maquinas',
  'modelos',
  'equipes',
  'operadores',
  'operacoes',
  'cronometragens',
  'leituras_cronometro',
  'apontamentos',
  'paradas',
  'producao_operador',
  'balancos',
];

const VERSAO_FORMATO = 1;

/** Lista as tabelas realmente presentes no banco, na ordem de inserção. */
function tabelasDo(db) {
  const existentes = new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((t) => t.name)
  );
  return ORDEM_INSERCAO.filter((t) => existentes.has(t));
}

/**
 * Exporta todas as tabelas para um objeto JSON serializável.
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {{versao:number, geradoEm:string, contagem:Object<string,number>, tabelas:Object<string,object[]>}}
 */
function exportar(db) {
  const tabelas = {};
  const contagem = {};
  for (const nome of tabelasDo(db)) {
    const linhas = db.prepare(`SELECT * FROM ${nome}`).all();
    tabelas[nome] = linhas;
    contagem[nome] = linhas.length;
  }
  return { versao: VERSAO_FORMATO, geradoEm: new Date().toISOString(), contagem, tabelas };
}

/**
 * Substitui todo o conteúdo do banco pelo conteúdo do backup.
 * Roda em transação única: qualquer falha desfaz tudo e o banco continua como estava.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{versao?:number, tabelas?:Object<string,object[]>}} dados
 * @returns {{tabelas:string[], inserido:Object<string,number>}}
 */
function importar(db, dados) {
  if (!dados || typeof dados !== 'object') throw new Error('Conteúdo do backup inválido');
  if (!dados.tabelas || typeof dados.tabelas !== 'object') throw new Error('Backup sem a seção "tabelas"');
  if (dados.versao !== undefined && dados.versao > VERSAO_FORMATO) {
    throw new Error(`Backup em versão ${dados.versao} é mais recente que o formato suportado (${VERSAO_FORMATO})`);
  }

  const presentes = tabelasDo(db);
  // Mantém a ordem do arquivo quando ela é válida; o resto entra na ordem padrão.
  const nomes = presentes.filter((t) => Array.isArray(dados.tabelas[t]));
  if (nomes.length === 0) throw new Error('Nenhuma tabela conhecida encontrada no backup');

  const inserido = {};
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    for (const nome of presentes) {
      db.prepare(`DELETE FROM ${nome}`).run();
      inserido[nome] = 0;
    }

    for (const nome of nomes) {
      const linhas = dados.tabelas[nome];
      if (linhas.length === 0) continue;
      // Interseção entre as colunas do backup e as do banco atual: um backup mais
      // antigo, sem colunas adicionadas depois, continua restaurável.
      const disponiveis = new Set(db.prepare(`PRAGMA table_info(${nome})`).all().map((c) => c.name));
      const colunas = Object.keys(linhas[0]).filter((c) => disponiveis.has(c));
      if (colunas.length === 0) continue;
      const stmt = db.prepare(
        `INSERT INTO ${nome} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`
      );
      for (const linha of linhas) stmt.run(...colunas.map((c) => (linha[c] === undefined ? null : linha[c])));
      inserido[nome] = linhas.length;
    }

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw new Error(`Falha ao restaurar o backup: ${e.message}`);
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }

  return { tabelas: nomes, inserido };
}

module.exports = { exportar, importar, tabelasDo, ORDEM_INSERCAO, VERSAO_FORMATO };
