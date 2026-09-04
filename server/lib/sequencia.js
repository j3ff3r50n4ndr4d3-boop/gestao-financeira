'use strict';

/**
 * Sequência operacional e cronometragem.
 *
 * Cada operação de um modelo pode ter várias cronometragens (estudos de tempo
 * feitos em datas/operadores diferentes). O tempo padrão vigente da operação é o
 * da cronometragem mais recente. O SAM do modelo é a soma dos tempos padrão da
 * sequência e pode ser gravado de volta em modelos.sam_min.
 */

const { all, get, run } = require('../db');
const { resumirCronometragem, samDaSequencia } = require('./tempos');

function leiturasDe(db, cronometragemId) {
  return all(db, 'SELECT segundos FROM leituras_cronometro WHERE cronometragem_id = ? ORDER BY id', cronometragemId)
    .map((l) => l.segundos);
}

/** Aplica o resumo de cronometragem a uma linha de cronometragem lida do banco. */
function detalharCronometragem(db, linha) {
  const leituras = leiturasDe(db, linha.id);
  const resumo = resumirCronometragem({
    leituras,
    fatorRitmo: linha.fator_ritmo,
    toleranciaPct: linha.tolerancia_pct,
  });
  return {
    id: linha.id,
    operacaoId: linha.operacao_id,
    operadorId: linha.operador_id,
    operadorNome: linha.operador_nome || null,
    data: linha.data,
    leituras,
    fatorRitmo: linha.fator_ritmo,
    toleranciaPct: linha.tolerancia_pct,
    observacao: linha.observacao,
    resumo,
  };
}

function cronometragemVigente(db, operacaoId) {
  const linha = get(
    db,
    `SELECT c.*, o.nome AS operador_nome
       FROM cronometragens c
       LEFT JOIN operadores o ON o.id = c.operador_id
      WHERE c.operacao_id = ?
      ORDER BY c.data DESC, c.id DESC
      LIMIT 1`,
    operacaoId
  );
  return linha ? detalharCronometragem(db, linha) : null;
}

/** Sequência operacional completa de um modelo, com tempos padrão e SAM. */
function listarSequencia(db, modeloId) {
  const modelo = get(db, 'SELECT * FROM modelos WHERE id = ?', modeloId);
  if (!modelo) return null;

  const operacoes = all(
    db,
    'SELECT * FROM operacoes WHERE modelo_id = ? ORDER BY sequencia ASC',
    modeloId
  ).map((op) => {
    const crono = cronometragemVigente(db, op.id);
    const tempoPadraoS = crono ? crono.resumo.tempoPadrao : op.tempo_padrao;
    return {
      id: op.id,
      modeloId: op.modelo_id,
      sequencia: op.sequencia,
      codigo: op.codigo,
      descricao: op.descricao,
      maquina: op.maquina,
      secao: op.secao,
      dificuldade: op.dificuldade,
      tempoPadraoSeg: tempoPadraoS,
      tempoPadraoMin: tempoPadraoS / 60,
      temCronometragem: Boolean(crono),
      cronometragemVigente: crono
        ? {
            id: crono.id,
            data: crono.data,
            operadorNome: crono.operadorNome,
            fatorRitmo: crono.fatorRitmo,
            toleranciaPct: crono.toleranciaPct,
            tempoObservadoMedio: crono.resumo.tempoObservadoMedio,
            tempoNormal: crono.resumo.tempoNormal,
            tempoPadrao: crono.resumo.tempoPadrao,
            coeficienteVariacaoPct: crono.resumo.coeficienteVariacaoPct,
            quantidadeLeituras: crono.resumo.quantidadeLeituras,
            confiavel: crono.resumo.confiavel,
            aviso: crono.resumo.aviso,
          }
        : null,
    };
  });

  const samCalculado = samDaSequencia(operacoes.map((o) => ({ tempoPadraoMin: o.tempoPadraoMin })));
  const semCronometragem = operacoes.filter((o) => !o.temCronometragem).length;

  return {
    modelo: {
      id: modelo.id,
      codigo: modelo.codigo,
      nome: modelo.nome,
      categoria: modelo.categoria,
      samMin: modelo.sam_min,
    },
    operacoes,
    samCalculadoMin: samCalculado,
    samCadastradoMin: modelo.sam_min,
    divergenciaMin: samCalculado - modelo.sam_min,
    divergenciaPct: modelo.sam_min > 0 ? ((samCalculado - modelo.sam_min) / modelo.sam_min) * 100 : 0,
    totalOperacoes: operacoes.length,
    operacoesSemCronometragem: semCronometragem,
  };
}

/** Grava em modelos.sam_min o SAM calculado a partir da sequência. */
function recalcularSam(db, modeloId) {
  const seq = listarSequencia(db, modeloId);
  if (!seq) return null;
  run(db, 'UPDATE modelos SET sam_min = ? WHERE id = ?', seq.samCalculadoMin, modeloId);
  return { ...seq, modelo: { ...seq.modelo, samMin: seq.samCalculadoMin }, divergenciaMin: 0, divergenciaPct: 0 };
}

function listarCronometragens(db, filtros = {}) {
  const where = [];
  const params = [];
  if (filtros.operacaoId) { where.push('c.operacao_id = ?'); params.push(filtros.operacaoId); }
  if (filtros.modeloId) { where.push('op.modelo_id = ?'); params.push(filtros.modeloId); }
  if (filtros.de) { where.push('c.data >= ?'); params.push(filtros.de); }
  if (filtros.ate) { where.push('c.data <= ?'); params.push(filtros.ate); }

  const linhas = all(
    db,
    `SELECT c.*, o.nome AS operador_nome, op.descricao AS operacao_descricao,
            op.sequencia AS operacao_sequencia, mo.codigo AS modelo_codigo, mo.nome AS modelo_nome
       FROM cronometragens c
       JOIN operacoes op ON op.id = c.operacao_id
       JOIN modelos mo   ON mo.id = op.modelo_id
       LEFT JOIN operadores o ON o.id = c.operador_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY c.data DESC, c.id DESC`,
    ...params
  );

  return linhas.map((l) => ({
    ...detalharCronometragem(db, l),
    operacaoDescricao: l.operacao_descricao,
    operacaoSequencia: l.operacao_sequencia,
    modeloCodigo: l.modelo_codigo,
    modeloNome: l.modelo_nome,
  }));
}

function operacoesParaBalanceamento(db, modeloId) {
  return all(
    db,
    'SELECT id, sequencia, codigo, descricao, maquina, secao, tempo_padrao FROM operacoes WHERE modelo_id = ? ORDER BY sequencia',
    modeloId
  ).map((op) => ({
    id: op.id,
    sequencia: op.sequencia,
    codigo: op.codigo,
    descricao: op.descricao,
    maquina: op.maquina,
    secao: op.secao,
    tempoPadraoMin: op.tempo_padrao / 60,
  }));
}

module.exports = {
  listarSequencia,
  recalcularSam,
  listarCronometragens,
  cronometragemVigente,
  detalharCronometragem,
  leiturasDe,
  operacoesParaBalanceamento,
};
