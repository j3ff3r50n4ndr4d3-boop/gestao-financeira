'use strict';

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.EFICIENCIA_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.EFICIENCIA_DB || path.join(DATA_DIR, 'eficiencia.db');

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS turnos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nome              TEXT    NOT NULL UNIQUE,
  hora_inicio       TEXT    NOT NULL,
  hora_fim          TEXT    NOT NULL,
  minutos_totais    INTEGER NOT NULL,
  pausas_planejadas INTEGER NOT NULL DEFAULT 0,
  ativo             INTEGER NOT NULL DEFAULT 1,
  criado_em         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS setores (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS maquinas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nome             TEXT    NOT NULL UNIQUE,
  setor            TEXT    NOT NULL,
  tipo             TEXT    NOT NULL DEFAULT '',
  operadores       INTEGER NOT NULL DEFAULT 1,
  custo_hora       REAL    NOT NULL DEFAULT 0,
  meta_oee         REAL    NOT NULL DEFAULT 0.85,
  ativo            INTEGER NOT NULL DEFAULT 1,
  observacao       TEXT    NOT NULL DEFAULT '',
  criado_em        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS modelos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo     TEXT    NOT NULL UNIQUE,
  nome       TEXT    NOT NULL,
  categoria  TEXT    NOT NULL DEFAULT '',
  sam_min    REAL    NOT NULL DEFAULT 0,
  preco_venda REAL   NOT NULL DEFAULT 0,
  ativo      INTEGER NOT NULL DEFAULT 1,
  criado_em  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS apontamentos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  data              TEXT    NOT NULL,
  maquina_id        INTEGER NOT NULL REFERENCES maquinas(id),
  turno_id          INTEGER NOT NULL REFERENCES turnos(id),
  modelo_id         INTEGER REFERENCES modelos(id),
  lider             TEXT    NOT NULL DEFAULT '',
  pecas_produzidas  INTEGER NOT NULL DEFAULT 0,
  pecas_defeito     INTEGER NOT NULL DEFAULT 0,
  pecas_retrabalho  INTEGER NOT NULL DEFAULT 0,
  observacao        TEXT    NOT NULL DEFAULT '',
  criado_em         TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_apontamentos_data ON apontamentos(data);
CREATE INDEX IF NOT EXISTS idx_apontamentos_maquina ON apontamentos(maquina_id);

CREATE TABLE IF NOT EXISTS paradas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  apontamento_id INTEGER NOT NULL REFERENCES apontamentos(id) ON DELETE CASCADE,
  motivo         TEXT    NOT NULL,
  minutos        REAL    NOT NULL DEFAULT 0,
  descricao      TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_paradas_apontamento ON paradas(apontamento_id);

CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
`;

const CONFIG_PADRAO = {
  meta_oee: '0.85',
  meta_disponibilidade: '0.90',
  meta_desempenho: '0.95',
  meta_qualidade: '0.99',
  meta_defeitos_pct: '1.5',
  nome_fabrica: 'Confecção Aurora LTDA',
};

let dbSingleton = null;

function abrir(dbPath = DB_PATH) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

function getDb() {
  if (!dbSingleton) {
    dbSingleton = abrir();
    aplicarConfigPadrao(dbSingleton);
  }
  return dbSingleton;
}

function aplicarConfigPadrao(db) {
  const stmt = db.prepare('INSERT OR IGNORE INTO config (chave, valor) VALUES (?, ?)');
  for (const [chave, valor] of Object.entries(CONFIG_PADRAO)) stmt.run(chave, valor);
}

/** Executa uma query e devolve todas as linhas. */
function all(db, sql, ...params) {
  return db.prepare(sql).all(...params);
}

/** Executa uma query e devolve a primeira linha. */
function get(db, sql, ...params) {
  return db.prepare(sql).get(...params);
}

/** Executa uma mutação e devolve { changes, lastInsertRowid }. */
function run(db, sql, ...params) {
  return db.prepare(sql).run(...params);
}

function getConfig(db = getDb()) {
  const linhas = all(db, 'SELECT chave, valor FROM config');
  const cfg = { ...CONFIG_PADRAO };
  for (const l of linhas) cfg[l.chave] = l.valor;
  return {
    metaOee: parseFloat(cfg.meta_oee) || 0.85,
    metaDisponibilidade: parseFloat(cfg.meta_disponibilidade) || 0.9,
    metaDesempenho: parseFloat(cfg.meta_desempenho) || 0.95,
    metaQualidade: parseFloat(cfg.meta_qualidade) || 0.99,
    metaDefeitosPct: parseFloat(cfg.meta_defeitos_pct) || 1.5,
    nomeFabrica: cfg.nome_fabrica || 'Fábrica',
  };
}

function setConfig(pares, db = getDb()) {
  const stmt = db.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor');
  for (const [chave, valor] of Object.entries(pares || {})) stmt.run(chave, String(valor));
  return getConfig(db);
}

module.exports = { abrir, getDb, all, get, run, getConfig, setConfig, DB_PATH, SCHEMA };
