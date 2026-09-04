'use strict';

/**
 * Consultas de negócio: lê o SQLite e devolve indicadores já calculados
 * pelo motor de OEE. Toda agregação de período usa agregarOEE (ponderada).
 */

const { all, get, getConfig } = require('../db');
const { calcularOEE, agregarOEE } = require('./oee');

const SELECT_APONTAMENTO = `
  SELECT a.id, a.data, a.maquina_id, a.turno_id, a.modelo_id, a.lider,
         a.pecas_produzidas, a.pecas_defeito, a.pecas_retrabalho, a.observacao,
         a.criado_em, a.atualizado_em,
         m.nome        AS maquina,
         m.setor       AS setor,
         m.tipo        AS maquina_tipo,
         m.operadores  AS operadores,
         m.custo_hora  AS custo_hora,
         m.meta_oee    AS meta_oee_maquina,
         t.nome        AS turno,
         t.minutos_totais,
         t.pausas_planejadas,
         mo.codigo     AS modelo_codigo,
         mo.nome       AS modelo_nome,
         mo.categoria  AS modelo_categoria,
         mo.sam_min    AS sam_min
  FROM apontamentos a
  JOIN maquinas m ON m.id = a.maquina_id
  JOIN turnos   t ON t.id = a.turno_id
  LEFT JOIN modelos mo ON mo.id = a.modelo_id
`;

/** Monta o input do motor de OEE a partir de uma linha já com joins. */
function paraInputOEE(linha, paradas = []) {
  return {
    minutosTurno: linha.minutos_totais,
    pausasPlanejadasTurno: linha.pausas_planejadas,
    paradas,
    pecasProduzidas: linha.pecas_produzidas,
    pecasDefeito: linha.pecas_defeito,
    pecasRetrabalho: linha.pecas_retrabalho,
    samMin: linha.sam_min,
    operadores: linha.operadores,
    custoHoraCelula: linha.custo_hora,
  };
}

function carregarParadas(db, apontamentoId) {
  return all(db, 'SELECT motivo, minutos, descricao FROM paradas WHERE apontamento_id = ? ORDER BY id', apontamentoId);
}

/**
 * Lista apontamentos com seus indicadores de OEE.
 * @param {{de?:string, ate?:string, maquinaId?:number, setor?:string, limite?:number}} [filtros]
 */
function listarApontamentos(db, filtros = {}) {
  const where = [];
  const params = [];
  if (filtros.de) { where.push('a.data >= ?'); params.push(filtros.de); }
  if (filtros.ate) { where.push('a.data <= ?'); params.push(filtros.ate); }
  if (filtros.maquinaId) { where.push('a.maquina_id = ?'); params.push(filtros.maquinaId); }
  if (filtros.setor) { where.push('m.setor = ?'); params.push(filtros.setor); }

  const sql =
    SELECT_APONTAMENTO +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY a.data DESC, m.nome ASC, t.hora_inicio ASC' +
    (filtros.limite ? ` LIMIT ${Math.max(1, parseInt(filtros.limite, 10))}` : '');

  const linhas = all(db, sql, ...params);
  return linhas.map((l) => detalharApontamento(db, l));
}

/** Devolve a linha do banco enriquecida com o resultado completo do OEE. */
function detalharApontamento(db, linha, paradas) {
  const evs = paradas || carregarParadas(db, linha.id);
  const resultado = calcularOEE(paraInputOEE(linha, evs));
  return {
    id: linha.id,
    data: linha.data,
    maquinaId: linha.maquina_id,
    maquina: linha.maquina,
    setor: linha.setor,
    turnoId: linha.turno_id,
    turno: linha.turno,
    modeloId: linha.modelo_id,
    modeloCodigo: linha.modelo_codigo,
    modeloNome: linha.modelo_nome,
    modeloCategoria: linha.modelo_categoria,
    samMin: linha.sam_min,
    operadores: linha.operadores,
    lider: linha.lider,
    pecasProduzidas: linha.pecas_produzidas,
    pecasDefeito: linha.pecas_defeito,
    pecasRetrabalho: linha.pecas_retrabalho,
    observacao: linha.observacao,
    paradas: evs.map((p) => ({
      motivo: p.motivo,
      minutos: p.minutos,
      descricao: p.descricao,
    })),
    indicadores: resultado,
  };
}

function obterApontamento(db, id) {
  const linha = get(db, SELECT_APONTAMENTO + ' WHERE a.id = ?', id);
  return linha ? detalharApontamento(db, linha) : null;
}

/** Intervalo padrão: últimos 30 dias, quando o cliente não informa. */
function resolverPeriodo(filtros = {}) {
  if (filtros.de && filtros.ate) return { de: filtros.de, ate: filtros.ate };
  const ultimo = get(filtros.db, "SELECT MAX(data) AS d FROM apontamentos");
  const ate = filtros.ate || (ultimo && ultimo.d) || new Date().toISOString().slice(0, 10);
  const d = new Date(ate + 'T00:00:00');
  d.setDate(d.getDate() - 29);
  const de = filtros.de || d.toISOString().slice(0, 10);
  return { de, ate };
}

/**
 * Painel consolidado do período: OEE geral, tendência diária, ranking por linha,
 * Pareto de paradas, 6 grandes perdas e análise por modelo.
 */
function dashboard(db, filtros = {}) {
  const metas = getConfig(db);
  const { de, ate } = resolverPeriodo({ ...filtros, db });

  const where = ['a.data >= ?', 'a.data <= ?'];
  const params = [de, ate];
  if (filtros.maquinaId) { where.push('a.maquina_id = ?'); params.push(filtros.maquinaId); }
  if (filtros.setor) { where.push('m.setor = ?'); params.push(filtros.setor); }

  const linhas = all(db, SELECT_APONTAMENTO + ' WHERE ' + where.join(' AND ') + ' ORDER BY a.data ASC, m.nome ASC', ...params);

  const detalhados = linhas.map((l) => detalharApontamento(db, l));
  const geral = agregarOEE(detalhados.map((d) => d.indicadores));

  // ---- Tendência diária ----
  const porDia = new Map();
  for (const d of detalhados) {
    if (!porDia.has(d.data)) porDia.set(d.data, []);
    porDia.get(d.data).push(d.indicadores);
  }
  const tendencia = [...porDia.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([data, resultados]) => {
      const g = agregarOEE(resultados);
      return {
        data,
        oeePct: g.oeePct,
        disponibilidadePct: g.disponibilidadePct,
        desempenhoPct: g.desempenhoPct,
        qualidadePct: g.qualidadePct,
        pecasProduzidas: g.pecasProduzidas,
        pecasDefeito: g.pecasDefeito,
        apontamentos: resultados.length,
      };
    });

  // ---- Ranking por linha/célula ----
  const porMaquina = new Map();
  for (const d of detalhados) {
    const chave = d.maquinaId;
    if (!porMaquina.has(chave)) {
      porMaquina.set(chave, { maquinaId: chave, maquina: d.maquina, setor: d.setor, resultados: [] });
    }
    porMaquina.get(chave).resultados.push(d.indicadores);
  }
  const ranking = [...porMaquina.values()]
    .map((item) => {
      const g = agregarOEE(item.resultados);
      const meta = get(db, 'SELECT meta_oee FROM maquinas WHERE id = ?', item.maquinaId);
      return {
        maquinaId: item.maquinaId,
        maquina: item.maquina,
        setor: item.setor,
        apontamentos: g.quantidade,
        oeePct: g.oeePct,
        disponibilidadePct: g.disponibilidadePct,
        desempenhoPct: g.desempenhoPct,
        qualidadePct: g.qualidadePct,
        pecasProduzidas: g.pecasProduzidas,
        pecasDefeito: g.pecasDefeito,
        taxaDefeitosPct: g.taxaDefeitosPct,
        producaoHora: g.producaoHora,
        paradasNaoPlanejadas: g.paradasNaoPlanejadas,
        tempoPlanejado: g.tempoPlanejado,
        custoPerdaTotal: g.custoPerdaTotal,
        pecasPerdidasTotal:
          g.tempoProduzidoMin > 0 && g.pecasProduzidas > 0
            ? g.minutosPerdaTotal / (g.tempoProduzidoMin / g.pecasProduzidas)
            : 0,
        metaOee: meta ? meta.meta_oee : metas.metaOee,
        gapMeta: g.oeePct - (meta ? meta.meta_oee : metas.metaOee) * 100,
      };
    })
    .sort((a, b) => b.oeePct - a.oeePct);

  // ---- Análise por modelo/peça ----
  const porModelo = new Map();
  for (const d of detalhados) {
    const chave = d.modeloId || 0;
    if (!porModelo.has(chave)) {
      porModelo.set(chave, {
        modeloId: chave,
        modeloCodigo: d.modeloCodigo || '—',
        modeloNome: d.modeloNome || 'Sem modelo',
        categoria: d.modeloCategoria || '',
        resultados: [],
      });
    }
    porModelo.get(chave).resultados.push(d.indicadores);
  }
  const modelos = [...porModelo.values()]
    .map((item) => {
      const g = agregarOEE(item.resultados);
      return {
        modeloId: item.modeloId,
        modeloCodigo: item.modeloCodigo,
        modeloNome: item.modeloNome,
        categoria: item.categoria,
        oeePct: g.oeePct,
        desempenhoPct: g.desempenhoPct,
        pecasProduzidas: g.pecasProduzidas,
        pecasDefeito: g.pecasDefeito,
        taxaDefeitosPct: g.taxaDefeitosPct,
        producaoHora: g.producaoHora,
      };
    })
    .sort((a, b) => b.pecasProduzidas - a.pecasProduzidas);

  return {
    periodo: { de, ate },
    metas,
    geral: {
      oeePct: geral.oeePct,
      disponibilidadePct: geral.disponibilidadePct,
      desempenhoPct: geral.desempenhoPct,
      qualidadePct: geral.qualidadePct,
      pecasProduzidas: geral.pecasProduzidas,
      pecasBoas: geral.pecasBoas,
      pecasDefeito: geral.pecasDefeito,
      taxaDefeitosPct: geral.taxaDefeitosPct,
      producaoHora: geral.producaoHora,
      tempoPlanejado: geral.tempoPlanejado,
      tempoOperacao: geral.tempoOperacao,
      paradasNaoPlanejadas: geral.paradasNaoPlanejadas,
      paradasPlanejadas: geral.paradasPlanejadas,
      minutosPerdaTotal: geral.minutosPerdaTotal,
      custoPerdaTotal: geral.custoPerdaTotal,
      custoPerdaDisponibilidade: geral.custoPerdaDisponibilidade,
      custoPerdaDesempenho: geral.custoPerdaDesempenho,
      custoPerdaQualidade: geral.custoPerdaQualidade,
      apontamentos: geral.quantidade,
      gapMeta: geral.oeePct - metas.metaOee * 100,
    },
    tendencia,
    ranking,
    modelos,
    paretoParadas: geral.porMotivo,
    seisPerdas: geral.seisPerdas,
    perdasPorGrupo: [
      { codigo: 'DISPONIBILIDADE', rotulo: 'Indisponibilidade', minutos: geral.minutosPerdaDisponibilidade, custo: geral.custoPerdaDisponibilidade },
      { codigo: 'DESEMPENHO', rotulo: 'Ritmo abaixo do padrão', minutos: geral.minutosPerdaDesempenho, custo: geral.custoPerdaDesempenho },
      { codigo: 'QUALIDADE', rotulo: 'Defeitos e refugo', minutos: geral.minutosPerdaQualidade, custo: geral.custoPerdaQualidade },
    ],
  };
}

module.exports = {
  listarApontamentos,
  obterApontamento,
  detalharApontamento,
  dashboard,
  resolverPeriodo,
  paraInputOEE,
  SELECT_APONTAMENTO,
};
