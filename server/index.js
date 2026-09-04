'use strict';

/**
 * Servidor HTTP da Plataforma de Eficiência Produtiva.
 *
 * Sem dependências externas: usa `node:http` para o servidor e `node:sqlite`
 * para a persistência. Serve a API REST em /api/* e o frontend estático de /public.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const { getDb, all, get, run, getConfig, setConfig } = require('./db');
const consultas = require('./lib/consultas');
const sequencia = require('./lib/sequencia');
const producao = require('./lib/producao');
const tempos = require('./lib/tempos');
const balanceamento = require('./lib/balanceamento');
const { MOTIVOS_PARADA, SEIS_GRANDES_PERDAS, calcularOEE } = require('./lib/oee');
const { semearSeVazio } = require('./seed');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8',
};

class HttpErro extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------- helpers ----

const json = (res, status, corpo) => {
  const body = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
};

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let tamanho = 0;
    req.on('data', (c) => {
      tamanho += c.length;
      if (tamanho > 2 * 1024 * 1024) {
        reject(new HttpErro(413, 'Corpo da requisição muito grande'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpErro(400, 'JSON inválido no corpo da requisição'));
      }
    });
    req.on('error', reject);
  });
}

const num = (v, padrao = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : padrao;
};

const int = (v, padrao = 0) => Math.round(num(v, padrao));

function exigir(condicao, mensagem, status = 400) {
  if (!condicao) throw new HttpErro(status, mensagem);
}

function dataValida(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00'));
}

function horaValida(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function minutosEntre(inicio, fim) {
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  let delta = hf * 60 + mf - (hi * 60 + mi);
  if (delta <= 0) delta += 24 * 60; // turno que cruza a meia-noite
  return delta;
}

function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ------------------------------------------------------------------ rotas ----

const rotas = [];
function rota(metodo, padrao, handler) {
  const chaves = [];
  const regex = new RegExp(
    '^' +
      padrao.replace(/:[a-zA-Z]+/g, (m) => {
        chaves.push(m.slice(1));
        return '([^/]+)';
      }) +
      '/?$'
  );
  rotas.push({ metodo, regex, chaves, handler });
}

// ---- catálogo / configuração ----
rota('GET', '/api/health', async () => [200, { status: 'ok', servico: 'eficiencia-producao', quando: new Date().toISOString() }]);

rota('GET', '/api/catalogos', async (req, db) => [200, {
  motivosParada: MOTIVOS_PARADA,
  seisPerdas: SEIS_GRANDES_PERDAS,
  setores: all(db, 'SELECT nome FROM setores ORDER BY nome').map((s) => s.nome),
  metas: getConfig(db),
}]);

rota('GET', '/api/metas', async (req, db) => [200, getConfig(db)]);

rota('PUT', '/api/metas', async (req, db, _p, corpo) => {
  const pares = {};
  if (corpo.metaOee !== undefined) {
    const v = num(corpo.metaOee);
    exigir(v > 0 && v <= 1, 'metaOee deve estar entre 0 e 1');
    pares.meta_oee = v;
  }
  if (corpo.metaDisponibilidade !== undefined) pares.meta_disponibilidade = num(corpo.metaDisponibilidade);
  if (corpo.metaDesempenho !== undefined) pares.meta_desempenho = num(corpo.metaDesempenho);
  if (corpo.metaQualidade !== undefined) pares.meta_qualidade = num(corpo.metaQualidade);
  if (corpo.metaDefeitosPct !== undefined) pares.meta_defeitos_pct = num(corpo.metaDefeitosPct);
  if (corpo.nomeFabrica !== undefined) pares.nome_fabrica = String(corpo.nomeFabrica).slice(0, 120);
  return [200, setConfig(pares, db)];
});

// ---- turnos ----
rota('GET', '/api/turnos', async (req, db) => [200, all(db, 'SELECT * FROM turnos ORDER BY hora_inicio')]);

rota('POST', '/api/turnos', async (req, db, _p, c) => {
  exigir(c.nome && String(c.nome).trim(), 'Informe o nome do turno');
  exigir(horaValida(c.hora_inicio), 'hora_inicio inválida (use HH:MM)');
  exigir(horaValida(c.hora_fim), 'hora_fim inválida (use HH:MM)');
  const minutos = int(c.minutos_totais) || minutosEntre(c.hora_inicio, c.hora_fim);
  exigir(minutos > 0, 'Duração do turno deve ser maior que zero');
  const pausas = Math.max(0, int(c.pausas_planejadas));
  exigir(pausas < minutos, 'Pausas planejadas não podem ser maiores que o turno');
  const r = run(
    db,
    'INSERT INTO turnos (nome, hora_inicio, hora_fim, minutos_totais, pausas_planejadas) VALUES (?, ?, ?, ?, ?)',
    String(c.nome).trim(), c.hora_inicio, c.hora_fim, minutos, pausas
  );
  return [201, get(db, 'SELECT * FROM turnos WHERE id = ?', Number(r.lastInsertRowid))];
});

rota('PUT', '/api/turnos/:id', async (req, db, p, c) => {
  const id = int(p.id);
  const atual = get(db, 'SELECT * FROM turnos WHERE id = ?', id);
  exigir(atual, 'Turno não encontrado', 404);
  const nome = c.nome !== undefined ? String(c.nome).trim() : atual.nome;
  const hi = c.hora_inicio !== undefined ? c.hora_inicio : atual.hora_inicio;
  const hf = c.hora_fim !== undefined ? c.hora_fim : atual.hora_fim;
  exigir(horaValida(hi) && horaValida(hf), 'Horário inválido (use HH:MM)');
  const minutos = c.minutos_totais !== undefined ? int(c.minutos_totais) : atual.minutos_totais;
  const pausas = c.pausas_planejadas !== undefined ? Math.max(0, int(c.pausas_planejadas)) : atual.pausas_planejadas;
  exigir(minutos > 0 && pausas < minutos, 'Turno inválido: pausas devem ser menores que a duração');
  run(db, 'UPDATE turnos SET nome=?, hora_inicio=?, hora_fim=?, minutos_totais=?, pausas_planejadas=?, ativo=? WHERE id=?',
    nome, hi, hf, minutos, pausas, c.ativo !== undefined ? (c.ativo ? 1 : 0) : atual.ativo, id);
  return [200, get(db, 'SELECT * FROM turnos WHERE id = ?', id)];
});

rota('DELETE', '/api/turnos/:id', async (req, db, p) => {
  const id = int(p.id);
  const usos = get(db, 'SELECT COUNT(*) AS n FROM apontamentos WHERE turno_id = ?', id);
  exigir(Number(usos.n) === 0, 'Turno em uso por apontamentos — não pode ser excluído', 409);
  const r = run(db, 'DELETE FROM turnos WHERE id = ?', id);
  exigir(Number(r.changes) > 0, 'Turno não encontrado', 404);
  return [200, { excluido: id }];
});

// ---- máquinas / linhas ----
rota('GET', '/api/maquinas', async (req, db) => [200, all(db, 'SELECT * FROM maquinas ORDER BY setor, nome')]);

rota('POST', '/api/maquinas', async (req, db, _p, c) => {
  exigir(c.nome && String(c.nome).trim(), 'Informe o nome da linha/célula');
  exigir(c.setor && String(c.setor).trim(), 'Informe o setor');
  const operadores = Math.max(1, int(c.operadores, 1));
  const meta = num(c.meta_oee, 0.85);
  exigir(meta > 0 && meta <= 1, 'meta_oee deve estar entre 0 e 1');
  run(db, 'INSERT OR IGNORE INTO setores (nome) VALUES (?)', String(c.setor).trim());
  const r = run(
    db,
    `INSERT INTO maquinas (nome, setor, tipo, operadores, custo_hora, meta_oee, observacao)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    String(c.nome).trim(), String(c.setor).trim(), String(c.tipo || '').trim(),
    operadores, Math.max(0, num(c.custo_hora)), meta, String(c.observacao || '')
  );
  return [201, get(db, 'SELECT * FROM maquinas WHERE id = ?', Number(r.lastInsertRowid))];
});

rota('PUT', '/api/maquinas/:id', async (req, db, p, c) => {
  const id = int(p.id);
  const a = get(db, 'SELECT * FROM maquinas WHERE id = ?', id);
  exigir(a, 'Linha não encontrada', 404);
  const setor = c.setor !== undefined ? String(c.setor).trim() : a.setor;
  if (c.setor !== undefined) run(db, 'INSERT OR IGNORE INTO setores (nome) VALUES (?)', setor);
  const meta = c.meta_oee !== undefined ? num(c.meta_oee) : a.meta_oee;
  exigir(meta > 0 && meta <= 1, 'meta_oee deve estar entre 0 e 1');
  run(db,
    `UPDATE maquinas SET nome=?, setor=?, tipo=?, operadores=?, custo_hora=?, meta_oee=?, ativo=?, observacao=? WHERE id=?`,
    c.nome !== undefined ? String(c.nome).trim() : a.nome,
    setor,
    c.tipo !== undefined ? String(c.tipo).trim() : a.tipo,
    c.operadores !== undefined ? Math.max(1, int(c.operadores, 1)) : a.operadores,
    c.custo_hora !== undefined ? Math.max(0, num(c.custo_hora)) : a.custo_hora,
    meta,
    c.ativo !== undefined ? (c.ativo ? 1 : 0) : a.ativo,
    c.observacao !== undefined ? String(c.observacao) : a.observacao,
    id);
  return [200, get(db, 'SELECT * FROM maquinas WHERE id = ?', id)];
});

rota('DELETE', '/api/maquinas/:id', async (req, db, p) => {
  const id = int(p.id);
  const usos = get(db, 'SELECT COUNT(*) AS n FROM apontamentos WHERE maquina_id = ?', id);
  exigir(Number(usos.n) === 0, 'Linha em uso por apontamentos — não pode ser excluída', 409);
  const r = run(db, 'DELETE FROM maquinas WHERE id = ?', id);
  exigir(Number(r.changes) > 0, 'Linha não encontrada', 404);
  return [200, { excluido: id }];
});

// ---- modelos ----
rota('GET', '/api/modelos', async (req, db) => [200, all(db, 'SELECT * FROM modelos ORDER BY codigo')]);

rota('POST', '/api/modelos', async (req, db, _p, c) => {
  exigir(c.codigo && String(c.codigo).trim(), 'Informe o código do modelo');
  exigir(c.nome && String(c.nome).trim(), 'Informe o nome do modelo');
  const sam = num(c.sam_min);
  exigir(sam > 0, 'SAM deve ser maior que zero');
  try {
    const r = run(db, 'INSERT INTO modelos (codigo, nome, categoria, sam_min, preco_venda) VALUES (?, ?, ?, ?, ?)',
      String(c.codigo).trim().toUpperCase(), String(c.nome).trim(), String(c.categoria || ''), sam, Math.max(0, num(c.preco_venda)));
    return [201, get(db, 'SELECT * FROM modelos WHERE id = ?', Number(r.lastInsertRowid))];
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) throw new HttpErro(409, 'Já existe um modelo com este código');
    throw e;
  }
});

rota('PUT', '/api/modelos/:id', async (req, db, p, c) => {
  const id = int(p.id);
  const a = get(db, 'SELECT * FROM modelos WHERE id = ?', id);
  exigir(a, 'Modelo não encontrado', 404);
  const sam = c.sam_min !== undefined ? num(c.sam_min) : a.sam_min;
  exigir(sam > 0, 'SAM deve ser maior que zero');
  run(db, 'UPDATE modelos SET codigo=?, nome=?, categoria=?, sam_min=?, preco_venda=?, ativo=? WHERE id=?',
    c.codigo !== undefined ? String(c.codigo).trim().toUpperCase() : a.codigo,
    c.nome !== undefined ? String(c.nome).trim() : a.nome,
    c.categoria !== undefined ? String(c.categoria) : a.categoria,
    sam,
    c.preco_venda !== undefined ? Math.max(0, num(c.preco_venda)) : a.preco_venda,
    c.ativo !== undefined ? (c.ativo ? 1 : 0) : a.ativo,
    id);
  return [200, get(db, 'SELECT * FROM modelos WHERE id = ?', id)];
});

rota('DELETE', '/api/modelos/:id', async (req, db, p) => {
  const id = int(p.id);
  const usos = get(db, 'SELECT COUNT(*) AS n FROM apontamentos WHERE modelo_id = ?', id);
  exigir(Number(usos.n) === 0, 'Modelo em uso por apontamentos — não pode ser excluído', 409);
  const r = run(db, 'DELETE FROM modelos WHERE id = ?', id);
  exigir(Number(r.changes) > 0, 'Modelo não encontrado', 404);
  return [200, { excluido: id }];
});

// ---- apontamentos ----
function validarApontamento(db, c, parcial = false) {
  const dados = {};
  if (!parcial || c.data !== undefined) {
    exigir(dataValida(c.data), 'Data inválida (use AAAA-MM-DD)');
    dados.data = c.data;
  }
  if (!parcial || c.maquina_id !== undefined) {
    const m = get(db, 'SELECT * FROM maquinas WHERE id = ?', int(c.maquina_id));
    exigir(m, 'Linha/célula não encontrada');
    dados.maquina_id = m.id;
    dados._maquina = m;
  }
  if (!parcial || c.turno_id !== undefined) {
    const t = get(db, 'SELECT * FROM turnos WHERE id = ?', int(c.turno_id));
    exigir(t, 'Turno não encontrado');
    dados.turno_id = t.id;
    dados._turno = t;
  }
  if (c.modelo_id !== undefined && c.modelo_id !== null && c.modelo_id !== '') {
    const mo = get(db, 'SELECT * FROM modelos WHERE id = ?', int(c.modelo_id));
    exigir(mo, 'Modelo não encontrado');
    dados.modelo_id = mo.id;
  } else if (!parcial) {
    dados.modelo_id = null;
  }
  if (c.lider !== undefined) dados.lider = String(c.lider).slice(0, 80);
  if (c.observacao !== undefined) dados.observacao = String(c.observacao).slice(0, 500);

  if (!parcial || c.pecas_produzidas !== undefined) {
    dados.pecas_produzidas = Math.max(0, int(c.pecas_produzidas));
  }
  if (!parcial || c.pecas_defeito !== undefined) {
    dados.pecas_defeito = Math.max(0, int(c.pecas_defeito));
  }
  if (!parcial || c.pecas_retrabalho !== undefined) {
    dados.pecas_retrabalho = Math.max(0, int(c.pecas_retrabalho));
  }

  if (c.paradas !== undefined) {
    exigir(Array.isArray(c.paradas), 'paradas deve ser uma lista');
    dados.paradas = c.paradas
      .map((p) => ({
        motivo: String(p.motivo || '').toUpperCase(),
        minutos: Math.max(0, num(p.minutos)),
        descricao: String(p.descricao || '').slice(0, 300),
      }))
      .filter((p) => p.minutos > 0);
    const codigosValidos = new Set(MOTIVOS_PARADA.map((m) => m.codigo));
    for (const p of dados.paradas) {
      exigir(codigosValidos.has(p.motivo), `Motivo de parada inválido: ${p.motivo}`);
    }
  }
  return dados;
}

function validarTotalParadas(dados) {
  const turno = dados._turno;
  if (!turno) return;
  const paradas = dados.paradas || [];
  const total = paradas.reduce((s, p) => s + p.minutos, 0);
  exigir(
    total <= turno.minutos_totais,
    `Soma das paradas (${total} min) excede a duração do turno (${turno.minutos_totais} min)`
  );
}

rota('GET', '/api/apontamentos', async (req, db, _p, _c, query) => {
  const filtros = {
    de: query.get('de') || undefined,
    ate: query.get('ate') || undefined,
    maquinaId: query.get('maquinaId') ? int(query.get('maquinaId')) : undefined,
    setor: query.get('setor') || undefined,
    limite: query.get('limite') ? int(query.get('limite'), 500) : undefined,
  };
  const lista = consultas.listarApontamentos(db, filtros);
  return [200, { total: lista.length, itens: lista }];
});

rota('POST', '/api/apontamentos', async (req, db, _p, c) => {
  const dados = validarApontamento(db, c);
  if (dados.paradas === undefined) dados.paradas = [];
  validarTotalParadas(dados);
  exigir(dados.pecas_defeito <= dados.pecas_produzidas, 'Peças com defeito não podem superar as peças produzidas');

  const r = run(db,
    `INSERT INTO apontamentos (data, maquina_id, turno_id, modelo_id, lider, pecas_produzidas, pecas_defeito, pecas_retrabalho, observacao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    dados.data, dados.maquina_id, dados.turno_id, dados.modelo_id ?? null, dados.lider || '',
    dados.pecas_produzidas, dados.pecas_defeito, dados.pecas_retrabalho, dados.observacao || '');
  const id = Number(r.lastInsertRowid);
  const stmt = db.prepare('INSERT INTO paradas (apontamento_id, motivo, minutos, descricao) VALUES (?, ?, ?, ?)');
  for (const p of dados.paradas) stmt.run(id, p.motivo, p.minutos, p.descricao);
  return [201, consultas.obterApontamento(db, id)];
});

rota('GET', '/api/apontamentos/:id', async (req, db, p) => {
  const item = consultas.obterApontamento(db, int(p.id));
  exigir(item, 'Apontamento não encontrado', 404);
  return [200, item];
});

rota('PUT', '/api/apontamentos/:id', async (req, db, p, c) => {
  const id = int(p.id);
  const atual = consultas.obterApontamento(db, id);
  exigir(atual, 'Apontamento não encontrado', 404);

  const dados = validarApontamento(db, c, true);
  validarTotalParadas(dados);

  run(db,
    `UPDATE apontamentos SET data=?, maquina_id=?, turno_id=?, modelo_id=?, lider=?,
       pecas_produzidas=?, pecas_defeito=?, pecas_retrabalho=?, observacao=?, atualizado_em=datetime('now')
     WHERE id=?`,
    dados.data ?? atual.data,
    dados.maquina_id ?? atual.maquinaId,
    dados.turno_id ?? atual.turnoId,
    dados.modelo_id !== undefined ? dados.modelo_id : atual.modeloId,
    dados.lider ?? atual.lider,
    dados.pecas_produzidas ?? atual.pecasProduzidas,
    dados.pecas_defeito ?? atual.pecasDefeito,
    dados.pecas_retrabalho ?? atual.pecasRetrabalho,
    dados.observacao ?? atual.observacao,
    id);

  if (dados.paradas !== undefined) {
    run(db, 'DELETE FROM paradas WHERE apontamento_id = ?', id);
    const stmt = db.prepare('INSERT INTO paradas (apontamento_id, motivo, minutos, descricao) VALUES (?, ?, ?, ?)');
    for (const par of dados.paradas) stmt.run(id, par.motivo, par.minutos, par.descricao);
  }
  return [200, consultas.obterApontamento(db, id)];
});

rota('DELETE', '/api/apontamentos/:id', async (req, db, p) => {
  const r = run(db, 'DELETE FROM apontamentos WHERE id = ?', int(p.id));
  exigir(Number(r.changes) > 0, 'Apontamento não encontrado', 404);
  return [200, { excluido: int(p.id) }];
});

// ---- equipes ----
rota('GET', '/api/equipes', async (req, db) => [200, all(db, `
  SELECT eq.*, (SELECT COUNT(*) FROM operadores o WHERE o.equipe_id = eq.id) AS operadores
    FROM equipes eq ORDER BY eq.nome`)]);

rota('POST', '/api/equipes', async (req, db, _p, c) => {
  exigir(c.nome && String(c.nome).trim(), 'Informe o nome da equipe');
  try {
    const r = run(db, 'INSERT INTO equipes (nome, setor, lider) VALUES (?, ?, ?)',
      String(c.nome).trim(), String(c.setor || '').trim(), String(c.lider || '').trim());
    return [201, get(db, 'SELECT * FROM equipes WHERE id = ?', Number(r.lastInsertRowid))];
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) throw new HttpErro(409, 'Já existe uma equipe com este nome');
    throw e;
  }
});

rota('PUT', '/api/equipes/:id', async (req, db, p, c) => {
  const id = int(p.id);
  const a = get(db, 'SELECT * FROM equipes WHERE id = ?', id);
  exigir(a, 'Equipe não encontrada', 404);
  run(db, 'UPDATE equipes SET nome=?, setor=?, lider=?, ativo=? WHERE id=?',
    c.nome !== undefined ? String(c.nome).trim() : a.nome,
    c.setor !== undefined ? String(c.setor).trim() : a.setor,
    c.lider !== undefined ? String(c.lider).trim() : a.lider,
    c.ativo !== undefined ? (c.ativo ? 1 : 0) : a.ativo, id);
  return [200, get(db, 'SELECT * FROM equipes WHERE id = ?', id)];
});

rota('DELETE', '/api/equipes/:id', async (req, db, p) => {
  const id = int(p.id);
  const usos = get(db, 'SELECT COUNT(*) AS n FROM operadores WHERE equipe_id = ?', id);
  exigir(Number(usos.n) === 0, 'Equipe possui operadores vinculados — não pode ser excluída', 409);
  const r = run(db, 'DELETE FROM equipes WHERE id = ?', id);
  exigir(Number(r.changes) > 0, 'Equipe não encontrada', 404);
  return [200, { excluido: id }];
});

// ---- operadores ----
rota('GET', '/api/operadores', async (req, db) => [200, all(db, `
  SELECT o.*, eq.nome AS equipe_nome
    FROM operadores o LEFT JOIN equipes eq ON eq.id = o.equipe_id
   ORDER BY o.nome`)]);

rota('POST', '/api/operadores', async (req, db, _p, c) => {
  exigir(c.nome && String(c.nome).trim(), 'Informe o nome do operador');
  if (c.equipe_id) exigir(get(db, 'SELECT id FROM equipes WHERE id = ?', int(c.equipe_id)), 'Equipe não encontrada');
  try {
    const r = run(db,
      `INSERT INTO operadores (nome, matricula, equipe_id, funcao, maquina, custo_hora)
       VALUES (?, ?, ?, ?, ?, ?)`,
      String(c.nome).trim(),
      c.matricula ? String(c.matricula).trim() : null,
      c.equipe_id ? int(c.equipe_id) : null,
      String(c.funcao || '').trim(),
      String(c.maquina || '').trim(),
      Math.max(0, num(c.custo_hora)));
    return [201, get(db, 'SELECT * FROM operadores WHERE id = ?', Number(r.lastInsertRowid))];
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) throw new HttpErro(409, 'Já existe um operador com esta matrícula');
    throw e;
  }
});

rota('PUT', '/api/operadores/:id', async (req, db, p, c) => {
  const id = int(p.id);
  const a = get(db, 'SELECT * FROM operadores WHERE id = ?', id);
  exigir(a, 'Operador não encontrado', 404);
  if (c.equipe_id) exigir(get(db, 'SELECT id FROM equipes WHERE id = ?', int(c.equipe_id)), 'Equipe não encontrada');
  run(db,
    `UPDATE operadores SET nome=?, matricula=?, equipe_id=?, funcao=?, maquina=?, custo_hora=?, ativo=? WHERE id=?`,
    c.nome !== undefined ? String(c.nome).trim() : a.nome,
    c.matricula !== undefined ? (c.matricula ? String(c.matricula).trim() : null) : a.matricula,
    c.equipe_id !== undefined ? (c.equipe_id ? int(c.equipe_id) : null) : a.equipe_id,
    c.funcao !== undefined ? String(c.funcao).trim() : a.funcao,
    c.maquina !== undefined ? String(c.maquina).trim() : a.maquina,
    c.custo_hora !== undefined ? Math.max(0, num(c.custo_hora)) : a.custo_hora,
    c.ativo !== undefined ? (c.ativo ? 1 : 0) : a.ativo, id);
  return [200, get(db, 'SELECT * FROM operadores WHERE id = ?', id)];
});

rota('DELETE', '/api/operadores/:id', async (req, db, p) => {
  const id = int(p.id);
  const usos = get(db, 'SELECT COUNT(*) AS n FROM producao_operador WHERE operador_id = ?', id);
  exigir(Number(usos.n) === 0, 'Operador possui produção apontada — não pode ser excluído', 409);
  const r = run(db, 'DELETE FROM operadores WHERE id = ?', id);
  exigir(Number(r.changes) > 0, 'Operador não encontrado', 404);
  return [200, { excluido: id }];
});

// ---- sequência operacional ----
rota('GET', '/api/modelos/:id/sequencia', async (req, db, p) => {
  const seq = sequencia.listarSequencia(db, int(p.id));
  exigir(seq, 'Modelo não encontrado', 404);
  return [200, seq];
});

rota('POST', '/api/operacoes', async (req, db, _p, c) => {
  exigir(int(c.modelo_id), 'Informe o modelo');
  exigir(get(db, 'SELECT id FROM modelos WHERE id = ?', int(c.modelo_id)), 'Modelo não encontrado');
  exigir(c.descricao && String(c.descricao).trim(), 'Informe a descrição da operação');
  const tempoPadrao = Math.max(0, num(c.tempo_padrao));
  try {
    const r = run(db,
      `INSERT INTO operacoes (modelo_id, sequencia, codigo, descricao, maquina, secao, tempo_padrao, dificuldade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      int(c.modelo_id), Math.max(1, int(c.sequencia, 1)), String(c.codigo || '').trim(),
      String(c.descricao).trim(), String(c.maquina || '').trim(), String(c.secao || '').trim(),
      tempoPadrao, Math.min(5, Math.max(1, int(c.dificuldade, 2))));
    return [201, { ...get(db, 'SELECT * FROM operacoes WHERE id = ?', Number(r.lastInsertRowid)), tempoPadraoMin: tempoPadrao / 60 }];
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) throw new HttpErro(409, 'Já existe uma operação com esta sequência no modelo');
    throw e;
  }
});

rota('PUT', '/api/operacoes/:id', async (req, db, p, c) => {
  const id = int(p.id);
  const a = get(db, 'SELECT * FROM operacoes WHERE id = ?', id);
  exigir(a, 'Operação não encontrada', 404);
  const tempoPadrao = c.tempo_padrao !== undefined ? Math.max(0, num(c.tempo_padrao)) : a.tempo_padrao;
  run(db,
    `UPDATE operacoes SET sequencia=?, codigo=?, descricao=?, maquina=?, secao=?, tempo_padrao=?, dificuldade=? WHERE id=?`,
    c.sequencia !== undefined ? Math.max(1, int(c.sequencia, 1)) : a.sequencia,
    c.codigo !== undefined ? String(c.codigo).trim() : a.codigo,
    c.descricao !== undefined ? String(c.descricao).trim() : a.descricao,
    c.maquina !== undefined ? String(c.maquina).trim() : a.maquina,
    c.secao !== undefined ? String(c.secao).trim() : a.secao,
    tempoPadrao,
    c.dificuldade !== undefined ? Math.min(5, Math.max(1, int(c.dificuldade, 2))) : a.dificuldade,
    id);
  return [200, { ...get(db, 'SELECT * FROM operacoes WHERE id = ?', id), tempoPadraoMin: tempoPadrao / 60 }];
});

rota('DELETE', '/api/operacoes/:id', async (req, db, p) => {
  const r = run(db, 'DELETE FROM operacoes WHERE id = ?', int(p.id));
  exigir(Number(r.changes) > 0, 'Operação não encontrada', 404);
  return [200, { excluido: int(p.id) }];
});

rota('POST', '/api/modelos/:id/recalcular-sam', async (req, db, p) => {
  const res = sequencia.recalcularSam(db, int(p.id));
  exigir(res, 'Modelo não encontrado', 404);
  return [200, res];
});

// ---- cronometragem ----
rota('GET', '/api/cronometragens', async (req, db, _p, _c, query) => [200, sequencia.listarCronometragens(db, {
  operacaoId: query.get('operacaoId') ? int(query.get('operacaoId')) : undefined,
  modeloId: query.get('modeloId') ? int(query.get('modeloId')) : undefined,
  de: query.get('de') || undefined,
  ate: query.get('ate') || undefined,
})]);

rota('POST', '/api/cronometragens', async (req, db, _p, c) => {
  exigir(int(c.operacao_id), 'Informe a operação');
  exigir(get(db, 'SELECT id FROM operacoes WHERE id = ?', int(c.operacao_id)), 'Operação não encontrada');
  exigir(dataValida(c.data), 'Data inválida (use AAAA-MM-DD)');

  const leituras = (Array.isArray(c.leituras) ? c.leituras : [])
    .map((v) => num(v))
    .filter((v) => v > 0);
  exigir(leituras.length > 0, 'Informe pelo menos uma leitura válida do cronômetro');

  const fatorRitmo = num(c.fator_ritmo, 1);
  exigir(fatorRitmo > 0.3 && fatorRitmo <= 2, 'Fator de ritmo deve ficar entre 0,3 e 2');
  const tolerancia = Math.max(0, Math.min(100, num(c.tolerancia_pct, 12)));

  if (c.operador_id) exigir(get(db, 'SELECT id FROM operadores WHERE id = ?', int(c.operador_id)), 'Operador não encontrado');

  const r = run(db,
    `INSERT INTO cronometragens (operacao_id, operador_id, data, fator_ritmo, tolerancia_pct, observacao)
     VALUES (?, ?, ?, ?, ?, ?)`,
    int(c.operacao_id), c.operador_id ? int(c.operador_id) : null, c.data, fatorRitmo, tolerancia,
    String(c.observacao || '').slice(0, 300));
  const id = Number(r.lastInsertRowid);
  const stmt = db.prepare('INSERT INTO leituras_cronometro (cronometragem_id, segundos) VALUES (?, ?)');
  for (const s of leituras) stmt.run(id, s);

  // A cronometragem mais recente passa a valer: atualiza o tempo padrão da operação.
  const resumo = tempos.resumirCronometragem({ leituras, fatorRitmo, toleranciaPct: tolerancia });
  run(db, 'UPDATE operacoes SET tempo_padrao = ? WHERE id = ?', resumo.tempoPadrao, int(c.operacao_id));

  return [201, { ...sequencia.detalharCronometragem(db, get(db, 'SELECT * FROM cronometragens WHERE id = ?', id)), tempoPadraoOperacaoSeg: resumo.tempoPadrao }];
});

rota('DELETE', '/api/cronometragens/:id', async (req, db, p) => {
  const id = int(p.id);
  const linha = get(db, 'SELECT * FROM cronometragens WHERE id = ?', id);
  exigir(linha, 'Cronometragem não encontrada', 404);
  run(db, 'DELETE FROM cronometragens WHERE id = ?', id);

  // Revalida o tempo padrão da operação com a cronometragem vigente restante.
  const vigente = sequencia.cronometragemVigente(db, linha.operacao_id);
  run(db, 'UPDATE operacoes SET tempo_padrao = ? WHERE id = ?',
    vigente ? vigente.resumo.tempoPadrao : get(db, 'SELECT tempo_padrao FROM operacoes WHERE id = ?', linha.operacao_id).tempo_padrao,
    linha.operacao_id);
  return [200, { excluido: id }];
});

// ---- balanceamento de linha ----
rota('POST', '/api/balanceamento/simular', async (req, db, _p, c) => {
  exigir(int(c.modelo_id), 'Informe o modelo');
  exigir(get(db, 'SELECT id FROM modelos WHERE id = ?', int(c.modelo_id)), 'Modelo não encontrado');
  const meta = num(c.meta_pecas_hora);
  exigir(meta > 0, 'Meta de peças/hora deve ser maior que zero');
  const operacoes = sequencia.operacoesParaBalanceamento(db, int(c.modelo_id));
  exigir(operacoes.length > 0, 'O modelo não possui sequência operacional cadastrada');
  return [200, {
    modelo: get(db, 'SELECT codigo, nome, sam_min FROM modelos WHERE id = ?', int(c.modelo_id)),
    resultado: balanceamento.balancearLinha({
      operacoes,
      metaPecasHora: meta,
      minutosDisponiveis: num(c.minutos_disponiveis, 420),
      maxEstacoes: int(c.max_postos),
    }),
  }];
});

rota('GET', '/api/balancos', async (req, db) => [200, all(db, `
  SELECT b.*, mo.codigo AS modelo_codigo, mo.nome AS modelo_nome
    FROM balancos b JOIN modelos mo ON mo.id = b.modelo_id
   ORDER BY b.criado_em DESC`).map((b) => ({
  ...b,
  alocacao: JSON.parse(b.alocacao || '[]'),
  resultado: JSON.parse(b.resultado || '{}'),
}))]);

rota('POST', '/api/balancos', async (req, db, _p, c) => {
  exigir(c.nome && String(c.nome).trim(), 'Informe um nome para o balanceamento');
  exigir(int(c.modelo_id), 'Informe o modelo');
  exigir(get(db, 'SELECT id FROM modelos WHERE id = ?', int(c.modelo_id)), 'Modelo não encontrado');
  const meta = num(c.meta_pecas_hora);
  exigir(meta > 0, 'Meta de peças/hora deve ser maior que zero');
  const operacoes = sequencia.operacoesParaBalanceamento(db, int(c.modelo_id));
  exigir(operacoes.length > 0, 'O modelo não possui sequência operacional cadastrada');

  const resultado = balanceamento.balancearLinha({
    operacoes,
    metaPecasHora: meta,
    minutosDisponiveis: num(c.minutos_disponiveis, 420),
    maxEstacoes: int(c.max_postos),
  });
  const r = run(db,
    `INSERT INTO balancos (nome, modelo_id, meta_pecas_hora, minutos_disponiveis, max_postos, alocacao, resultado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    String(c.nome).trim(), int(c.modelo_id), meta, num(c.minutos_disponiveis, 420),
    int(c.max_postos), JSON.stringify(resultado.estacoes), JSON.stringify(resultado));
  return [201, { id: Number(r.lastInsertRowid), resultado }];
});

rota('DELETE', '/api/balancos/:id', async (req, db, p) => {
  const r = run(db, 'DELETE FROM balancos WHERE id = ?', int(p.id));
  exigir(Number(r.changes) > 0, 'Balanceamento não encontrado', 404);
  return [200, { excluido: int(p.id) }];
});

// ---- produção individual e acompanhamento ----
rota('GET', '/api/producao', async (req, db, _p, _c, query) => [200, producao.listarProducaoIndividual(db, {
  de: query.get('de') || undefined,
  ate: query.get('ate') || undefined,
  equipeId: query.get('equipeId') ? int(query.get('equipeId')) : undefined,
  operadorId: query.get('operadorId') ? int(query.get('operadorId')) : undefined,
  maquinaId: query.get('maquinaId') ? int(query.get('maquinaId')) : undefined,
  modeloId: query.get('modeloId') ? int(query.get('modeloId')) : undefined,
})]);

rota('GET', '/api/acompanhamento', async (req, db, _p, _c, query) => [200, producao.acompanhamento(db, {
  de: query.get('de') || undefined,
  ate: query.get('ate') || undefined,
  equipeId: query.get('equipeId') ? int(query.get('equipeId')) : undefined,
  operadorId: query.get('operadorId') ? int(query.get('operadorId')) : undefined,
  maquinaId: query.get('maquinaId') ? int(query.get('maquinaId')) : undefined,
  modeloId: query.get('modeloId') ? int(query.get('modeloId')) : undefined,
})]);

rota('GET', '/api/apontamentos/:id/producao', async (req, db, p) => {
  const id = int(p.id);
  exigir(get(db, 'SELECT id FROM apontamentos WHERE id = ?', id), 'Apontamento não encontrado', 404);
  return [200, producao.listarProducaoIndividual(db, { apontamentoId: id })];
});

rota('PUT', '/api/apontamentos/:id/producao', async (req, db, p, c) => {
  const id = int(p.id);
  exigir(get(db, 'SELECT id FROM apontamentos WHERE id = ?', id), 'Apontamento não encontrado', 404);
  exigir(Array.isArray(c.itens), 'itens deve ser uma lista');

  const itens = c.itens.map((item) => {
    exigir(int(item.operador_id), 'Cada item precisa de um operador');
    exigir(get(db, 'SELECT id FROM operadores WHERE id = ?', int(item.operador_id)), 'Operador não encontrado');
    if (item.operacao_id) exigir(get(db, 'SELECT id FROM operacoes WHERE id = ?', int(item.operacao_id)), 'Operação não encontrada');
    if (item.tempo_padrao_min !== undefined && item.tempo_padrao_min !== null) {
      exigir(num(item.tempo_padrao_min) > 0, 'tempo_padrao_min deve ser maior que zero');
    }
    return {
      operador_id: int(item.operador_id),
      operacao_id: item.operacao_id ? int(item.operacao_id) : null,
      tempo_padrao_min: item.tempo_padrao_min ? num(item.tempo_padrao_min) : null,
      minutos: Math.max(0, num(item.minutos)),
      pecas: Math.max(0, num(item.pecas)),
      defeitos: Math.max(0, num(item.defeitos)),
    };
  });

  const duplicados = itens.map((i) => i.operador_id).filter((v, i2, arr) => arr.indexOf(v) !== i2);
  exigir(duplicados.length === 0, 'Há operadores repetidos no apontamento');

  run(db, 'DELETE FROM producao_operador WHERE apontamento_id = ?', id);
  const stmt = db.prepare(
    `INSERT INTO producao_operador (apontamento_id, operador_id, operacao_id, tempo_padrao_min, minutos, pecas, defeitos)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const item of itens) {
    stmt.run(id, item.operador_id, item.operacao_id, item.tempo_padrao_min, item.minutos, item.pecas, item.defeitos);
  }
  return [200, producao.listarProducaoIndividual(db, { apontamentoId: id })];
});

// ---- pré-visualização de OEE (sem gravar) ----
rota('POST', '/api/simular', async (req, db, _p, c) => {
  exigir(dataValida(c.data), 'Data inválida (use AAAA-MM-DD)');
  const m = get(db, 'SELECT * FROM maquinas WHERE id = ?', int(c.maquina_id));
  exigir(m, 'Linha/célula não encontrada');
  const t = get(db, 'SELECT * FROM turnos WHERE id = ?', int(c.turno_id));
  exigir(t, 'Turno não encontrado');
  const mo = c.modelo_id ? get(db, 'SELECT * FROM modelos WHERE id = ?', int(c.modelo_id)) : null;
  const paradas = (Array.isArray(c.paradas) ? c.paradas : []).map((p) => ({
    motivo: String(p.motivo || '').toUpperCase(),
    minutos: Math.max(0, num(p.minutos)),
    descricao: String(p.descricao || ''),
  }));
  const indicadores = calcularOEE({
    minutosTurno: t.minutos_totais,
    pausasPlanejadasTurno: t.pausas_planejadas,
    paradas,
    pecasProduzidas: int(c.pecas_produzidas),
    pecasDefeito: int(c.pecas_defeito),
    pecasRetrabalho: int(c.pecas_retrabalho),
    samMin: mo ? mo.sam_min : 0,
    operadores: m.operadores,
    custoHoraCelula: m.custo_hora,
  });
  return [200, { linha: m.nome, turno: t.nome, modelo: mo ? mo.nome : null, indicadores }];
});

// ---- dashboard ----
rota('GET', '/api/dashboard', async (req, db, _p, _c, query) => {
  const filtros = {
    de: query.get('de') || undefined,
    ate: query.get('ate') || undefined,
    maquinaId: query.get('maquinaId') ? int(query.get('maquinaId')) : undefined,
    setor: query.get('setor') || undefined,
  };
  return [200, consultas.dashboard(db, filtros)];
});

// ---- exportação CSV (separador ; e BOM, compatível com Excel pt-BR) ----
rota('GET', '/api/export/apontamentos.csv', async (req, db, _p, _c, query, res) => {
  const lista = consultas.listarApontamentos(db, {
    de: query.get('de') || undefined,
    ate: query.get('ate') || undefined,
    maquinaId: query.get('maquinaId') ? int(query.get('maquinaId')) : undefined,
    setor: query.get('setor') || undefined,
  });
  const cab = ['Data', 'Linha/Célula', 'Setor', 'Turno', 'Modelo', 'SAM (min)', 'Operadores',
    'Peças produzidas', 'Peças defeito', 'Taxa defeito (%)', 'Disponibilidade (%)', 'Desempenho (%)',
    'Qualidade (%)', 'OEE (%)', 'Peças/hora', 'Paradas não planejadas (min)', 'Custo da perda (R$)'];
  const linhas = lista.map((a) => {
    const i = a.indicadores;
    return [a.data, a.maquina, a.setor, a.turno, a.modeloNome || '', a.samMin ?? '', a.operadores,
      a.pecasProduzidas, a.pecasDefeito, i.taxaDefeitosPct.toFixed(2), i.disponibilidadePct.toFixed(2),
      i.desempenhoPct.toFixed(2), i.qualidadePct.toFixed(2), i.oeePct.toFixed(2), i.producaoHora.toFixed(2),
      i.paradasNaoPlanejadas, i.custoPerdaTotal.toFixed(2)]
      .map((v) => typeof v === 'number' ? String(v).replace('.', ',') : csvEscape(v))
      .join(';');
  });
  const csv = '\uFEFF' + [cab.join(';'), ...linhas].join('\r\n');
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="apontamentos-oee.csv"',
  });
  res.end(csv);
  return null;
});

// --------------------------------------------------------------- estáticos ----

function servirEstatico(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const alvo = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!alvo.startsWith(PUBLIC_DIR)) {
    json(res, 403, { erro: 'Acesso negado' });
    return true;
  }
  if (!fs.existsSync(alvo) || !fs.statSync(alvo).isFile()) return false;
  const ext = path.extname(alvo).toLowerCase();
  const corpo = fs.readFileSync(alvo);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': corpo.length,
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=60',
  });
  res.end(corpo);
  return true;
}

// ---------------------------------------------------------------- servidor ----

function createServer(db = getDb()) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    try {
      if (pathname.startsWith('/api/')) {
        for (const r of rotas) {
          if (r.metodo !== req.method) continue;
          const m = pathname.match(r.regex);
          if (!m) continue;
          const params = {};
          r.chaves.forEach((k, idx) => { params[k] = m[idx + 1]; });
          const corpo = req.method === 'GET' || req.method === 'DELETE' ? {} : await lerCorpo(req);
          const resultado = await r.handler(req, db, params, corpo, url.searchParams, res);
          if (resultado === null) return; // resposta já enviada pelo handler (ex.: CSV)
          // Contrato: todo handler devolve [status, payload]. Exigido explicitamente
          // porque listas JSON legítimas também são arrays — confiar só em
          // Array.isArray() faria a primeira linha virar código HTTP.
          if (!Array.isArray(resultado) || typeof resultado[0] !== 'number' || resultado.length !== 2) {
            throw new Error(`Handler ${req.method} ${pathname} deve retornar [status, payload]`);
          }
          return json(res, resultado[0], resultado[1]);
        }
        return json(res, 404, { erro: `Rota não encontrada: ${req.method} ${pathname}` });
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { erro: 'Método não permitido' });
      if (!servirEstatico(req, res, pathname)) {
        // SPA: qualquer rota desconhecida cai no index.html
        if (!path.extname(pathname)) return servirEstatico(req, res, '/');
        json(res, 404, { erro: 'Arquivo não encontrado' });
      }
    } catch (err) {
      const status = err instanceof HttpErro ? err.status : 500;
      if (status === 500) console.error('[erro]', err);
      if (!res.headersSent) json(res, status, { erro: err.message || 'Erro interno' });
    }
  });
}

function iniciar() {
  const db = getDb();
  semearSeVazio(db);
  const servidor = createServer(db);
  servidor.listen(PORT, HOST, () => {
    const cfg = getConfig(db);
    console.log('');
    console.log(`  Eficiência Produtiva — ${cfg.nomeFabrica}`);
    console.log(`  Servidor em http://${HOST}:${PORT}  (banco: ${require('./db').DB_PATH})`);
    console.log('');
  });
  return servidor;
}

if (require.main === module) iniciar();

module.exports = { createServer, iniciar, PORT, HOST };
