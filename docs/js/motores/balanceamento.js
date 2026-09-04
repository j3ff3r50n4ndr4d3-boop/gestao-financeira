'use strict';

/* Envolvido em IIFE de propósito: na versão estática estes três arquivos são
 * carregados como scripts clássicos na mesma página e compartilham o escopo
 * global — sem o isolamento, os `const num` de cada um colidiriam. */
(function () {

/**
 * Balanceamento de linha de costura.
 *
 * Dada a sequência operacional de um modelo (cada operação com seu tempo padrão)
 * e uma meta de produção, o módulo calcula o tempo de ciclo necessário
 * (pitch time) e distribui as operações entre postos de trabalho respeitando a
 * precedência, usando o **Largest Candidate Rule** — heurística clássica de
 * balanceamento de linha de montagem.
 *
 *   pitch time            = 60 ÷ meta de peças/hora
 *   nº mínimo de postos   = ⌈SAM ÷ pitch time⌉
 *   tempo de ciclo real   = maior carga entre os postos (gargalo)
 *   eficiência do balance = SAM ÷ (nº de postos × tempo de ciclo real)
 *   perda de balanceamento= 1 − eficiência (tempo ocioso do conjunto)
 */

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {object} i
 * @param {Array<{id?:number, sequencia:number, codigo?:string, descricao:string, maquina?:string, tempoPadraoMin:number}>} i.operacoes
 * @param {number} i.metaPecasHora       meta de saída da linha
 * @param {number} [i.minutosDisponiveis] minutos líquidos do turno (para projeção)
 * @param {number} [i.maxEstacoes]        limite desejado de postos (restrição flexível)
 */
function balancearLinha(i = {}) {
  const operacoes = (i.operacoes || [])
    .map((op, idx) => ({
      id: op.id ?? idx + 1,
      sequencia: num(op.sequencia) || idx + 1,
      codigo: op.codigo || '',
      descricao: op.descricao || `Operação ${idx + 1}`,
      maquina: op.maquina || '',
      secao: op.secao || '',
      tempoPadraoMin: Math.max(0, num(op.tempoPadraoMin)),
    }))
    .filter((op) => op.tempoPadraoMin > 0)
    .sort((a, b) => a.sequencia - b.sequencia);

  const metaPecasHora = Math.max(0, num(i.metaPecasHora));
  const minutosDisponiveis = Math.max(0, num(i.minutosDisponiveis));
  const maxEstacoes = Math.max(0, Math.round(num(i.maxEstacoes)));

  const sam = operacoes.reduce((s, op) => s + op.tempoPadraoMin, 0);
  const pitchTime = metaPecasHora > 0 ? 60 / metaPecasHora : 0;
  const minTeoricoPostos = pitchTime > 0 ? Math.ceil(sam / pitchTime) : 0;

  if (operacoes.length === 0) {
    return {
      operacoes: 0, sam, pitchTime, minTeoricoPostos,
      estacoes: [], postosUsados: 0, tempoCiclo: 0, tempoCicloMin: 0,
      producaoHora: 0, producaoTurno: 0, eficiencia: 0, eficienciaPct: 0,
      perdaBalanceamentoPct: 0, tempoOciosoTotal: 0, gargalo: null,
      atendimentoMeta: false, excedeuLimitePostos: false,
      operacoesAcimaDoPitch: [], recomendacoes: ['Cadastre a sequência operacional do modelo.'],
    };
  }

  // ---- Largest Candidate Rule com precedência por sequência ----
  const ordem = [...operacoes].sort((a, b) => b.tempoPadraoMin - a.tempoPadraoMin);
  const alocadas = new Set();
  const estacoes = [];
  let excedeuLimite = false;

  const predecessoresAlocados = (op) =>
    operacoes.every((o) => o.sequencia >= op.sequencia || alocadas.has(o.id));

  while (alocadas.size < operacoes.length) {
    if (maxEstacoes > 0 && estacoes.length >= maxEstacoes && !excedeuLimite) {
      excedeuLimite = true; // continua alocando, mas sinaliza o estouro do limite
    }
    const estacao = { numero: estacoes.length + 1, tempo: 0, operacoes: [], ociosidade: 0, utilizacao: 0 };
    estacoes.push(estacao);

    let progrediu = true;
    while (progrediu) {
      progrediu = false;
      for (const op of ordem) {
        if (alocadas.has(op.id)) continue;
        if (!predecessoresAlocados(op)) continue;
        // Posto vazio aceita a operação mesmo acima do pitch, senão o algoritmo trava.
        const cabe = estacao.tempo + op.tempoPadraoMin <= pitchTime || estacao.operacoes.length === 0;
        if (!cabe) continue;
        estacao.operacoes.push(op);
        estacao.tempo += op.tempoPadraoMin;
        alocadas.add(op.id);
        progrediu = true;
      }
    }

    if (estacao.operacoes.length === 0) {
      // Nenhuma operação coube (só ocorre se todas as restantes tiverem predecessores pendentes).
      estacoes.pop();
      const pendente = ordem.find((op) => !alocadas.has(op.id));
      if (pendente) {
        const ultima = estacoes[estacoes.length - 1];
        if (!ultima) break;
        ultima.operacoes.push(pendente);
        ultima.tempo += pendente.tempoPadraoMin;
        alocadas.add(pendente.id);
      } else break;
    }
  }

  for (const e of estacoes) {
    e.operacoes.sort((a, b) => a.sequencia - b.sequencia);
  }

  const tempoCiclo = estacoes.reduce((max, e) => Math.max(max, e.tempo), 0);
  for (const e of estacoes) {
    e.ociosidade = Math.max(0, tempoCiclo - e.tempo);
    e.utilizacao = tempoCiclo > 0 ? e.tempo / tempoCiclo : 0;
  }

  const producaoHora = tempoCiclo > 0 ? 60 / tempoCiclo : 0;
  const producaoTurno = minutosDisponiveis > 0 ? producaoHora * (minutosDisponiveis / 60) : 0;
  const eficiencia = estacoes.length > 0 && tempoCiclo > 0 ? sam / (estacoes.length * tempoCiclo) : 0;
  const tempoOciosoTotal = estacoes.length * tempoCiclo - sam;

  const gargaloEstacao = estacoes.find((e) => e.tempo === tempoCiclo) || null;
  const operacoesAcimaDoPitch = operacoes.filter((op) => pitchTime > 0 && op.tempoPadraoMin > pitchTime);

  // ---- diagnóstico ----
  const recomendacoes = [];
  if (maxEstacoes > 0 && excedeuLimite) {
    recomendacoes.push(`Foram necessários ${estacoes.length} postos, acima do limite de ${maxEstacoes}.`);
  }
  if (operacoesAcimaDoPitch.length > 0) {
    recomendacoes.push(
      `${operacoesAcimaDoPitch.length} operação(ões) têm tempo padrão maior que o pitch time de ${pitchTime.toFixed(2)} min: ` +
      `${operacoesAcimaDoPitch.map((o) => `"${o.descricao}"`).join(', ')}. Divida a operação ou revise a meta.`
    );
  }
  if (gargaloEstacao && pitchTime > 0 && gargaloEstacao.tempo > pitchTime) {
    recomendacoes.push(
      `O posto ${gargaloEstacao.numero} é o gargalo com ${gargaloEstacao.tempo.toFixed(2)} min contra pitch de ${pitchTime.toFixed(2)} min. ` +
      `Reduza ${(gargaloEstacao.tempo - pitchTime).toFixed(2)} min para atingir a meta.`
    );
  }
  if (eficiencia > 0 && eficiencia < 0.85) {
    recomendacoes.push(`Eficiência de balanceamento de ${(eficiencia * 100).toFixed(1)}%: redistribua as operações para reduzir o tempo ocioso.`);
  }
  if (estacoes.length > minTeoricoPostos && minTeoricoPostos > 0) {
    recomendacoes.push(`O mínimo teórico é ${minTeoricoPostos} posto(s); a alocação usou ${estacoes.length}.`);
  }
  if (recomendacoes.length === 0) recomendacoes.push('Balanceamento consistente com a meta.');

  return {
    operacoes: operacoes.length,
    sam,
    pitchTime,
    minTeoricoPostos,
    estacoes,
    postosUsados: estacoes.length,
    tempoCiclo,
    tempoCicloMin: tempoCiclo,
    producaoHora,
    producaoTurno,
    eficiencia,
    eficienciaPct: eficiencia * 100,
    perdaBalanceamentoPct: (1 - eficiencia) * 100,
    tempoOciosoTotal,
    gargalo: gargaloEstacao
      ? { numero: gargaloEstacao.numero, tempo: gargaloEstacao.tempo, descricao: gargaloEstacao.operacoes.map((o) => o.descricao).join(' + ') }
      : null,
    atendimentoMeta: pitchTime > 0 ? producaoHora >= metaPecasHora - 1e-9 : false,
    excedeuLimitePostos: excedeuLimite,
    operacoesAcimaDoPitch: operacoesAcimaDoPitch.map((o) => ({ id: o.id, descricao: o.descricao, tempoPadraoMin: o.tempoPadraoMin })),
    recomendacoes,
  };
}

const apiBalanceamento = { balancearLinha };

/* Exportação dupla: CommonJS no servidor e global no navegador.
 * A versão estática (GitHub Pages) reaproveita exatamente este arquivo,
 * então a lógica de cálculo tem fonte única — não existe uma cópia. */
if (typeof module !== 'undefined' && module.exports) module.exports = apiBalanceamento;
if (typeof window !== 'undefined') window.Balanceamento = apiBalanceamento;
})();
