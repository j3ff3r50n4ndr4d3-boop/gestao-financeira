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

CREATE TABLE IF NOT EXISTS equipes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT    NOT NULL UNIQUE,
  setor     TEXT    NOT NULL DEFAULT '',
  lider     TEXT    NOT NULL DEFAULT '',
  ativo     INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS operadores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT    NOT NULL,
  matricula   TEXT    UNIQUE,
  equipe_id   INTEGER REFERENCES equipes(id),
  funcao      TEXT    NOT NULL DEFAULT '',
  maquina     TEXT    NOT NULL DEFAULT '',
  custo_hora  REAL    NOT NULL DEFAULT 0,
  ativo       INTEGER NOT NULL DEFAULT 1,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_operadores_equipe ON operadores(equipe_id);

CREATE TABLE IF NOT EXISTS operacoes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  modelo_id      INTEGER NOT NULL REFERENCES modelos(id) ON DELETE CASCADE,
  sequencia      INTEGER NOT NULL,
  codigo         TEXT    NOT NULL DEFAULT '',
  descricao      TEXT    NOT NULL,
  maquina        TEXT    NOT NULL DEFAULT '',
  secao          TEXT    NOT NULL DEFAULT '',
  tempo_padrao   REAL    NOT NULL DEFAULT 0,   -- segundos
  dificuldade    INTEGER NOT NULL DEFAULT 2,
  criado_em      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (modelo_id, sequencia)
);

CREATE INDEX IF NOT EXISTS idx_operacoes_modelo ON operacoes(modelo_id);

CREATE TABLE IF NOT EXISTS cronometragens (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  operacao_id    INTEGER NOT NULL REFERENCES operacoes(id) ON DELETE CASCADE,
  operador_id    INTEGER REFERENCES operadores(id),
  data           TEXT    NOT NULL,
  fator_ritmo    REAL    NOT NULL DEFAULT 1,
  tolerancia_pct REAL    NOT NULL DEFAULT 12,
  observacao     TEXT    NOT NULL DEFAULT '',
  criado_em      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leituras_cronometro (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  cronometragem_id INTEGER NOT NULL REFERENCES cronometragens(id) ON DELETE CASCADE,
  segundos         REAL    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leituras_cron ON leituras_cronometro(cronometragem_id);

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

-- Produção individual dentro de um apontamento. Quando operacao_id é informado,
-- a eficiência usa o tempo padrão daquela operação; senão usa o SAM do modelo
-- (operador creditado pela peça inteira). O sistema indica qual base foi usada.
CREATE TABLE IF NOT EXISTS producao_operador (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  apontamento_id   INTEGER NOT NULL REFERENCES apontamentos(id) ON DELETE CASCADE,
  operador_id      INTEGER NOT NULL REFERENCES operadores(id),
  operacao_id      INTEGER REFERENCES operacoes(id),
  -- Tempo padrão aplicável ao registro, em minutos. Numa linha balanceada o
  -- operador responde por um POSTO (várias operações), não por uma só; esse campo
  -- guarda a carga do posto. Precedência: posto > operação > SAM do modelo.
  tempo_padrao_min REAL,
  minutos          REAL    NOT NULL DEFAULT 0,
  pecas            REAL    NOT NULL DEFAULT 0,
  defeitos         REAL    NOT NULL DEFAULT 0,
  UNIQUE (apontamento_id, operador_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_op_apontamento ON producao_operador(apontamento_id);
CREATE INDEX IF NOT EXISTS idx_prod_op_operador ON producao_operador(operador_id);

CREATE TABLE IF NOT EXISTS balancos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                TEXT    NOT NULL,
  modelo_id           INTEGER NOT NULL REFERENCES modelos(id),
  meta_pecas_hora     REAL    NOT NULL,
  minutos_disponiveis REAL    NOT NULL DEFAULT 420,
  max_postos          INTEGER NOT NULL DEFAULT 0,
  alocacao            TEXT    NOT NULL DEFAULT '[]',
  resultado           TEXT    NOT NULL DEFAULT '{}',
  criado_em           TEXT    NOT NULL DEFAULT (datetime('now'))
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
  migrar(db);
  return db;
}

/**
 * Migrações aditivas para bases criadas por versões anteriores.
 *
 * `CREATE TABLE IF NOT EXISTS` não altera tabela existente, então colunas novas
 * precisam ser acrescentadas explicitamente — senão quem já tem dados gravados
 * quebra ao atualizar. Só adições: nada aqui remove ou renomeia coluna.
 */
const MIGRACOES = [
  { tabela: 'producao_operador', coluna: 'tempo_padrao_min', ddl: 'REAL' },
];

function colunasDe(db, tabela) {
  return db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name);
}

function migrar(db) {
  for (const m of MIGRACOES) {
    const info = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    ).get(m.tabela);
    if (!info) continue;
    if (colunasDe(db, m.tabela).includes(m.coluna)) continue;
    db.exec(`ALTER TABLE ${m.tabela} ADD COLUMN ${m.coluna} ${m.ddl}`);
    console.log(`[migracao] ${m.tabela}.${m.coluna} adicionada`);
  }
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

module.exports = { abrir, getDb, all, get, run, getConfig, setConfig, migrar, colunasDe, DB_PATH, SCHEMA };
