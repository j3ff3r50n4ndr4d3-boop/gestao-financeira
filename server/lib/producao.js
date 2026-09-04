'use strict';

/**
 * Acompanhamento da produção: diária, mensal, individual e por equipe.
 *
 * A eficiência individual é o clássico cálculo de confecção:
 *
 *   eficiência = (peças produzidas × tempo padrão) ÷ minutos trabalhados
 *
 * O tempo padrão é o da operação apontada quando ela é informada; caso contrário
 * é o SAM do modelo (operador creditado pela peça inteira). Cada registro
 * carrega `basePadrao` para deixar explícito qual referência foi usada — misturar
 * as duas bases sem aviso produziria números enganosos.
 */

const { all, get, getConfig } = require('../db');

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Lê a produção individual já com o tempo padrão aplicável a cada registro. */
function listarProducaoIndividual(db, filtros = {}) {
  const where = [];
  const params = [];
  if (filtros.de) { where.push('a.data >= ?'); params.push(filtros.de); }
  if (filtros.ate) { where.push('a.data <= ?'); params.push(filtros.ate); }
  if (filtros.equipeId) { where.push('o.equipe_id = ?'); params.push(filtros.equipeId); }
  if (filtros.operadorId) { where.push('po.operador_id = ?'); params.push(filtros.operadorId); }
  if (filtros.maquinaId) { where.push('a.maquina_id = ?'); params.push(filtros.maquinaId); }
  if (filtros.modeloId) { where.push('a.modelo_id = ?'); params.push(filtros.modeloId); }
  if (filtros.apontamentoId) { where.push('po.apontamento_id = ?'); params.push(filtros.apontamentoId); }

  return all(
    db,
    `SELECT po.id, po.minutos, po.pecas, po.defeitos, po.tempo_padrao_min,
            po.operador_id, po.operacao_id, po.apontamento_id,
            o.nome AS operador, o.matricula, o.funcao, o.maquina AS operador_maquina,
            o.equipe_id, e.nome AS equipe, e.setor AS equipe_setor,
            a.data, a.maquina_id, m.nome AS maquina, a.turno_id, t.nome AS turno,
            mo.codigo AS modelo_codigo, mo.nome AS modelo_nome, mo.sam_min,
            opx.tempo_padrao AS operacao_tempo_padrao,
            opx.descricao AS operacao_descricao
       FROM producao_operador po
       JOIN apontamentos a ON a.id = po.apontamento_id
       JOIN operadores   o ON o.id = po.operador_id
       LEFT JOIN equipes e ON e.id = o.equipe_id
       LEFT JOIN maquinas m ON m.id = a.maquina_id
       LEFT JOIN turnos   t ON t.id = a.turno_id
       LEFT JOIN modelos mo ON mo.id = a.modelo_id
       LEFT JOIN operacoes opx ON opx.id = po.operacao_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY a.data ASC, o.nome ASC`,
    ...params
  ).map((l) => {
    // Precedência do tempo padrão: posto balanceado > operação > SAM do modelo.
    const temPosto = num(l.tempo_padrao_min) > 0;
    const usaOperacao = !temPosto && l.operacao_id != null && num(l.operacao_tempo_padrao) > 0;
    const minutosPadraoUnit = temPosto
      ? num(l.tempo_padrao_min)
      : usaOperacao ? num(l.operacao_tempo_padrao) / 60 : num(l.sam_min);
    const minutosPadrao = num(l.pecas) * minutosPadraoUnit;
    const basePadrao = temPosto ? 'POSTO' : usaOperacao ? 'OPERACAO' : 'SAM_DO_MODELO';
    const minutos = num(l.minutos);
    return {
      id: l.id,
      apontamentoId: l.apontamento_id,
      data: l.data,
      mes: l.data ? l.data.slice(0, 7) : '',
      operadorId: l.operador_id,
      operador: l.operador,
      matricula: l.matricula,
      funcao: l.funcao,
      equipeId: l.equipe_id,
      equipe: l.equipe || 'Sem equipe',
      equipeSetor: l.equipe_setor || '',
      maquinaId: l.maquina_id,
      maquina: l.maquina,
      turno: l.turno,
      modeloCodigo: l.modelo_codigo,
      modeloNome: l.modelo_nome,
      operacaoId: l.operacao_id,
      operacaoDescricao: l.operacao_descricao,
      minutos,
      pecas: num(l.pecas),
      defeitos: num(l.defeitos),
      minutosPadrao,
      minutosPadraoUnit,
      pecasHora: minutos > 0 ? num(l.pecas) / (minutos / 60) : 0,
      eficiencia: minutos > 0 && minutosPadrao > 0 ? minutosPadrao / minutos : 0,
      eficienciaPct: minutos > 0 && minutosPadrao > 0 ? (minutosPadrao / minutos) * 100 : 0,
      taxaDefeitosPct: num(l.pecas) > 0 ? (num(l.defeitos) / num(l.pecas)) * 100 : 0,
      semPadrao: minutosPadraoUnit <= 0,
      basePadrao,
    };
  });
}

function agregar(registros) {
  const a = { pecas: 0, defeitos: 0, minutos: 0, minutosPadrao: 0, semPadrao: 0, registros: 0 };
  for (const r of registros) {
    a.registros += 1;
    a.pecas += r.pecas;
    a.defeitos += r.defeitos;
    a.minutos += r.minutos;
    a.minutosPadrao += r.minutosPadrao;
    if (r.semPadrao) a.semPadrao += 1;
  }
  a.pecasHora = a.minutos > 0 ? a.pecas / (a.minutos / 60) : 0;
  a.eficiencia = a.minutos > 0 && a.minutosPadrao > 0 ? a.minutosPadrao / a.minutos : 0;
  a.eficienciaPct = a.eficiencia * 100;
  a.taxaDefeitosPct = a.pecas > 0 ? (a.defeitos / a.pecas) * 100 : 0;
  a.horas = a.minutos / 60;
  return a;
}

function agruparPor(registros, chave) {
  const mapa = new Map();
  for (const r of registros) {
    const k = r[chave] ?? '—';
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(r);
  }
  return mapa;
}

/**
 * Painel de acompanhamento.
 * @param {{de?:string, ate?:string, equipeId?:number, operadorId?:number, maquinaId?:number, modeloId?:number}} filtros
 */
function acompanhamento(db, filtros = {}) {
  const metas = getConfig(db);
  const registros = listarProducaoIndividual(db, filtros);
  const resumo = agregar(registros);

  const porDia = [...agruparPor(registros, 'data').entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([data, regs]) => ({
      data,
      diaSemana: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(data + 'T12:00:00').getDay()],
      ...agregar(regs),
      operadores: new Set(regs.map((r) => r.operadorId)).size,
    }));

  const porMes = [...agruparPor(registros, 'mes').entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([mes, regs]) => ({
      mes,
      rotulo: mes,
      ...agregar(regs),
      operadores: new Set(regs.map((r) => r.operadorId)).size,
      dias: new Set(regs.map((r) => r.data)).size,
    }));

  const porOperador = [...agruparPor(registros, 'operadorId').entries()]
    .map(([operadorId, regs]) => ({
      operadorId,
      operador: regs[0].operador,
      matricula: regs[0].matricula,
      funcao: regs[0].funcao,
      equipeId: regs[0].equipeId,
      equipe: regs[0].equipe,
      basePadrao: new Set(regs.map((r) => r.basePadrao)).size > 1 ? 'MISTA' : regs[0].basePadrao,
      diasTrabalhados: new Set(regs.map((r) => r.data)).size,
      ...agregar(regs),
    }))
    .sort((a, b) => b.eficienciaPct - a.eficienciaPct);

  const porEquipe = [...agruparPor(registros, 'equipe').entries()]
    .map(([equipe, regs]) => ({
      equipe,
      equipeId: regs[0].equipeId,
      setor: regs[0].equipeSetor,
      lider: null,
      operadores: new Set(regs.map((r) => r.operadorId)).size,
      dias: new Set(regs.map((r) => r.data)).size,
      ...agregar(regs),
      pecasPorOperadorHora: (() => {
        const g = agregar(regs);
        return g.minutos > 0 ? g.pecas / (g.minutos / 60) : 0;
      })(),
    }))
    .sort((a, b) => b.pecas - a.pecas);

  const porLinha = [...agruparPor(registros, 'maquina').entries()]
    .map(([maquina, regs]) => ({ maquina, maquinaId: regs[0].maquinaId, ...agregar(regs) }))
    .sort((a, b) => b.pecas - a.pecas);

  const porModelo = [...agruparPor(registros, 'modeloNome').entries()]
    .map(([modeloNome, regs]) => ({
      modeloNome: modeloNome || '—',
      modeloCodigo: regs[0].modeloCodigo,
      ...agregar(regs),
    }))
    .sort((a, b) => b.pecas - a.pecas);

  return {
    metas,
    filtros,
    resumo: {
      ...resumo,
      operadores: new Set(registros.map((r) => r.operadorId)).size,
      equipes: new Set(registros.map((r) => r.equipe)).size,
      dias: new Set(registros.map((r) => r.data)).size,
      pecasPorDia: (() => {
        const dias = new Set(registros.map((r) => r.data)).size;
        return dias > 0 ? resumo.pecas / dias : 0;
      })(),
    },
    porDia,
    porMes,
    porOperador,
    porEquipe,
    porLinha,
    porModelo,
    registros: registros.length,
  };
}

module.exports = { acompanhamento, listarProducaoIndividual, agregar };
