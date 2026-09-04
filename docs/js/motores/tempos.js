'use strict';

/* Envolvido em IIFE de propósito: na versão estática estes três arquivos são
 * carregados como scripts clássicos na mesma página e compartilham o escopo
 * global — sem o isolamento, os `const num` de cada um colidiriam. */
(function () {

/**
 * Cronometragem e tempos padrão.
 *
 * Cadeia clássica de engenharia industrial aplicada à confecção:
 *
 *   Tempo Observado (TO)  = média das leituras do cronômetro (segundos)
 *   Tempo Normal (TN)     = TO × fator de ritmo
 *   Tempo Padrão (TP)     = TN × (1 + tolerâncias)
 *   SAM do modelo         = Σ TP de todas as operações da sequência
 *
 * O fator de ritmo corrige o andamento do operador observado em relação ao
 * conceito de "ritmo normal" (100%). Tolerâncias cobrem necessidades pessoais,
 * fadiga e pequenos atrasos inevitáveis.
 */

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const media = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

function mediana(arr) {
  if (!arr.length) return 0;
  const o = [...arr].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2;
}

function desvioPadrao(arr) {
  if (arr.length < 2) return 0;
  const m = media(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

/**
 * Resume uma cronometragem.
 *
 * Leituras que se desviam mais de `limiarOutlier` (padrão 25%) da mediana são
 * sinalizadas e excluídas da média usada no cálculo — mas continuam visíveis no
 * resultado, para que o engenheiro decida. Isso é transparente em vez de silencioso.
 *
 * @param {object} i
 * @param {number[]} i.leituras      leituras do cronômetro em segundos
 * @param {number}   i.fatorRitmo    1.0 = ritmo normal, 1.1 = 10% acima
 * @param {number}   i.toleranciaPct percentual de tolerâncias (pessoal + fadiga)
 * @param {number}  [i.limiarOutlier] desvio máximo aceito em relação à mediana (0..1)
 */
function resumirCronometragem(i = {}) {
  const brutas = (i.leituras || []).map(num).filter((v) => v > 0);
  const fatorRitmo = num(i.fatorRitmo) > 0 ? num(i.fatorRitmo) : 1;
  const toleranciaPct = Math.max(0, num(i.toleranciaPct));
  const limiar = num(i.limiarOutlier) > 0 ? Math.min(0.9, num(i.limiarOutlier)) : 0.25;

  if (brutas.length === 0) {
    return {
      quantidadeLeituras: 0,
      leiturasValidas: [],
      leiturasDescartadas: [],
      tempoObservadoMedio: 0,
      tempoObservadoMedioBruto: 0,
      tempoObservadoMediana: 0,
      minimo: 0,
      maximo: 0,
      amplitude: 0,
      desvioPadrao: 0,
      coeficienteVariacaoPct: 0,
      fatorRitmo,
      tempoNormal: 0,
      toleranciaPct,
      tempoPadrao: 0,
      tempoPadraoMin: 0,
      confiavel: false,
      aviso: 'Nenhuma leitura válida informada',
    };
  }

  const med = mediana(brutas);
  const limite = med * limiar;
  const validas = brutas.filter((v) => Math.abs(v - med) <= limite);
  const descartadas = brutas.filter((v) => Math.abs(v - med) > limite);
  const base = validas.length ? validas : brutas;

  const tempoObservadoMedio = media(base);
  const tempoNormal = tempoObservadoMedio * fatorRitmo;
  const tempoPadrao = tempoNormal * (1 + toleranciaPct / 100);
  const dp = desvioPadrao(base);
  const cv = tempoObservadoMedio > 0 ? (dp / tempoObservadoMedio) * 100 : 0;

  const avisos = [];
  if (descartadas.length > 0) {
    avisos.push(`${descartadas.length} leitura(s) fora de ±${Math.round(limiar * 100)}% da mediana foram excluídas da média`);
  }
  if (cv > 15) avisos.push(`Dispersão alta (CV ${cv.toFixed(1)}%): repita a cronometragem`);
  if (brutas.length < 5) avisos.push(`Apenas ${brutas.length} leitura(s); o recomendado são pelo menos 5`);

  return {
    quantidadeLeituras: brutas.length,
    leiturasValidas: validas,
    leiturasDescartadas: descartadas,
    tempoObservadoMedio,
    tempoObservadoMedioBruto: media(brutas),
    tempoObservadoMediana: med,
    minimo: Math.min(...brutas),
    maximo: Math.max(...brutas),
    amplitude: Math.max(...brutas) - Math.min(...brutas),
    desvioPadrao: dp,
    coeficienteVariacaoPct: cv,
    fatorRitmo,
    tempoNormal,
    toleranciaPct,
    tempoPadrao,
    tempoPadraoMin: tempoPadrao / 60,
    confiavel: cv <= 15 && brutas.length >= 5,
    aviso: avisos.join(' · '),
  };
}

/**
 * SAM (Standard Allowed Minutes) de uma sequência operacional:
 * soma dos tempos padrão de todas as operações, em minutos.
 * @param {Array<{tempoPadrao?:number, tempoPadraoMin?:number}>} operacoes
 */
function samDaSequencia(operacoes = []) {
  let segundos = 0;
  let minutos = 0;
  for (const op of operacoes || []) {
    if (Number.isFinite(op.tempoPadraoMin)) minutos += num(op.tempoPadraoMin);
    else segundos += num(op.tempoPadrao);
  }
  return minutos + segundos / 60;
}

/**
 * Produção teórica de uma célula a partir do SAM e do número de operadores.
 * Linha balanceada: cada operador executa SAM/N minutos de trabalho por peça.
 */
function producaoTeorica(samMin, operadores, minutosDisponiveis) {
  const sam = num(samMin);
  const ops = Math.max(0, Math.round(num(operadores)));
  const minutos = Math.max(0, num(minutosDisponiveis));
  if (sam <= 0 || ops <= 0) return 0;
  return (minutos * ops) / sam;
}

const apiTempos = {
  resumirCronometragem,
  samDaSequencia,
  producaoTeorica,
  media,
  mediana,
  desvioPadrao,
};

/* Exportação dupla: CommonJS no servidor e global no navegador.
 * A versão estática (GitHub Pages) reaproveita exatamente este arquivo,
 * então a lógica de cálculo tem fonte única — não existe uma cópia. */
if (typeof module !== 'undefined' && module.exports) module.exports = apiTempos;
if (typeof window !== 'undefined') window.Tempos = apiTempos;
})();
