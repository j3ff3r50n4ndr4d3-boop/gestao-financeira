'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resumirCronometragem, samDaSequencia, producaoTeorica, media, mediana, desvioPadrao,
} = require('../server/lib/tempos');
const { balancearLinha } = require('../server/lib/balanceamento');

const quase = (a, b, msg = '', tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: esperado ~${b}, obtido ${a}`);

/* ====================================================== cronometragem ===== */

test('cadeia TO × fator de ritmo × tolerâncias', () => {
  const r = resumirCronometragem({ leituras: [30, 30, 30, 30, 30], fatorRitmo: 1.1, toleranciaPct: 10 });
  quase(r.tempoObservadoMedio, 30, 'TO');
  quase(r.tempoNormal, 33, 'TN = 30 × 1,1');
  quase(r.tempoPadrao, 36.3, 'TP = 33 × 1,1');
  quase(r.tempoPadraoMin, 36.3 / 60, 'TP em minutos');
  assert.equal(r.confiavel, true, 'CV zero e 5 leituras');
});

test('fator de ritmo abaixo de 100% reduz o tempo normal', () => {
  const r = resumirCronometragem({ leituras: [40, 40, 40, 40, 40], fatorRitmo: 0.9, toleranciaPct: 0 });
  quase(r.tempoNormal, 36, 'operador acima do ritmo normal trabalha mais rápido');
  quase(r.tempoPadrao, 36);
});

test('leituras fora de ±25% da mediana são excluídas e reportadas', () => {
  const r = resumirCronometragem({ leituras: [30, 31, 29, 30, 30, 90], fatorRitmo: 1, toleranciaPct: 0 });
  assert.deepEqual(r.leiturasDescartadas, [90], '90s é outlier');
  assert.equal(r.leiturasValidas.length, 5);
  quase(r.tempoObservadoMedio, 30, 'média ignora o outlier');
  quase(r.tempoObservadoMedioBruto, (30 + 31 + 29 + 30 + 30 + 90) / 6, 'média bruta continua disponível');
  assert.match(r.aviso, /excluídas/);
});

test('limiar de outlier é configurável', () => {
  const estrito = resumirCronometragem({ leituras: [30, 30, 30, 30, 35], fatorRitmo: 1, toleranciaPct: 0, limiarOutlier: 0.05 });
  const frouxo = resumirCronometragem({ leituras: [30, 30, 30, 30, 35], fatorRitmo: 1, toleranciaPct: 0, limiarOutlier: 0.5 });
  assert.equal(estrito.leiturasDescartadas.length, 1, '35s estoura o limiar de 5%');
  assert.equal(frouxo.leiturasDescartadas.length, 0, '35s cabe no limiar de 50%');
});

test('leituras inválidas são ignoradas e lista vazia não quebra', () => {
  const r = resumirCronometragem({ leituras: [30, -5, 0, 'abc', 30, null, 30], fatorRitmo: 1, toleranciaPct: 0 });
  assert.equal(r.quantidadeLeituras, 3, 'apenas as três leituras positivas');

  const vazio = resumirCronometragem({ leituras: [], fatorRitmo: 1.1, toleranciaPct: 12 });
  assert.equal(vazio.tempoPadrao, 0);
  assert.equal(vazio.confiavel, false);
  for (const [k, v] of Object.entries(vazio)) {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} finito`);
  }
});

test('dispersão alta e poucas leituras sinalizam cronometragem não confiável', () => {
  const dispersa = resumirCronometragem({ leituras: [20, 30, 45, 25, 55, 22], fatorRitmo: 1, toleranciaPct: 0 });
  assert.ok(dispersa.coeficienteVariacaoPct > 15, `CV alto: ${dispersa.coeficienteVariacaoPct}`);
  assert.equal(dispersa.confiavel, false);

  const curta = resumirCronometragem({ leituras: [30, 30], fatorRitmo: 1, toleranciaPct: 0 });
  assert.equal(curta.confiavel, false, 'menos de 5 leituras');
  assert.match(curta.aviso, /pelo menos 5/);
});

test('fator de ritmo inválido cai para 1', () => {
  quase(resumirCronometragem({ leituras: [30, 30, 30], fatorRitmo: 0, toleranciaPct: 0 }).fatorRitmo, 1);
  quase(resumirCronometragem({ leituras: [30, 30, 30], toleranciaPct: 0 }).fatorRitmo, 1);
});

test('SAM da sequência soma os tempos padrão', () => {
  quase(samDaSequencia([{ tempoPadraoMin: 0.5 }, { tempoPadraoMin: 0.75 }, { tempoPadraoMin: 1.25 }]), 2.5);
  quase(samDaSequencia([{ tempoPadrao: 60 }, { tempoPadrao: 90 }]), 2.5, 'aceita segundos');
  quase(samDaSequencia([]), 0);
});

test('produção teórica de uma linha balanceada', () => {
  // SAM 8,5 min, 14 operadores, 420 min → (420 × 14) / 8,5
  quase(producaoTeorica(8.5, 14, 420), (420 * 14) / 8.5);
  assert.equal(producaoTeorica(0, 14, 420), 0);
  assert.equal(producaoTeorica(8.5, 0, 420), 0);
});

test('estatísticas básicas', () => {
  quase(media([1, 2, 3, 4]), 2.5);
  quase(mediana([1, 3, 2]), 2, 'mediana ímpar');
  quase(mediana([1, 2, 3, 4]), 2.5, 'mediana par');
  quase(mediana([]), 0);
  quase(desvioPadrao([2, 2, 2]), 0);
  assert.ok(desvioPadrao([1, 5, 9]) > 0);
  quase(desvioPadrao([5]), 0, 'amostra única');
});

/* ====================================================== balanceamento ===== */

const ops = (tempos) => tempos.map((t, i) => ({
  id: i + 1, sequencia: i + 1, descricao: `Op ${i + 1}`, tempoPadraoMin: t,
}));

test('caso perfeitamente balanceável: 4 operações de 1 min com pitch de 2 min', () => {
  const r = balancearLinha({ operacoes: ops([1, 1, 1, 1]), metaPecasHora: 30 });
  quase(r.pitchTime, 2, '60 / 30');
  quase(r.sam, 4);
  assert.equal(r.minTeoricoPostos, 2);
  assert.equal(r.postosUsados, 2);
  quase(r.tempoCiclo, 2);
  quase(r.eficiencia, 1, 'balanceamento perfeito');
  quase(r.producaoHora, 30);
  assert.equal(r.atendimentoMeta, true);
  quase(r.tempoOciosoTotal, 0);
  assert.equal(r.excedeuLimitePostos, false);
  assert.equal(r.operacoesAcimaDoPitch.length, 0);
});

test('a precedência da sequência é respeitada na alocação', () => {
  const r = balancearLinha({ operacoes: ops([3, 1, 1, 1]), metaPecasHora: 20 }); // pitch 3 min
  for (const estacao of r.estacoes) {
    const sequencias = estacao.operacoes.map((o) => o.sequencia);
    // Toda operação alocada num posto exige que as anteriores já estejam alocadas
    // em postos anteriores ou no mesmo posto, em ordem.
    for (const seq of sequencias) {
      const anterioresAlocadas = r.estacoes
        .slice(0, r.estacoes.indexOf(estacao))
        .flatMap((e) => e.operacoes.map((o) => o.sequencia));
      const noMesmoPosto = sequencias.filter((x) => x < seq);
      const faltando = Array.from({ length: seq - 1 }, (_, i) => i + 1)
        .filter((s) => !anterioresAlocadas.includes(s) && !noMesmoPosto.includes(s));
      assert.deepEqual(faltando, [], `operação ${seq} alocada antes das predecessoras ${faltando}`);
    }
  }
  // Nenhuma operação pode ser perdida
  const alocadas = r.estacoes.flatMap((e) => e.operacoes.map((o) => o.id));
  assert.equal(alocadas.length, 4, 'todas as operações alocadas');
  assert.equal(new Set(alocadas).size, 4, 'sem duplicidade');
});

test('operação maior que o pitch vira gargalo e é sinalizada', () => {
  const r = balancearLinha({ operacoes: ops([3, 1]), metaPecasHora: 30 }); // pitch 2 min
  quase(r.pitchTime, 2);
  assert.equal(r.operacoesAcimaDoPitch.length, 1, 'operação de 3 min acima do pitch de 2');
  quase(r.tempoCiclo, 3, 'gargalo define o tempo de ciclo');
  quase(r.producaoHora, 20, '60 / 3');
  assert.equal(r.atendimentoMeta, false, 'não atinge 30 peças/h');
  quase(r.eficiencia, 4 / (2 * 3), 'eficiência degradada pelo gargalo');
  assert.ok(r.recomendacoes.some((t) => /gargalo/i.test(t)), 'recomendação sobre o gargalo');
});

test('todas as operações são alocadas mesmo com restrição de postos', () => {
  const r = balancearLinha({ operacoes: ops([1, 1, 1, 1, 1, 1]), metaPecasHora: 30, maxEstacoes: 2 });
  const alocadas = r.estacoes.flatMap((e) => e.operacoes.map((o) => o.id));
  assert.equal(alocadas.length, 6, 'nada fica de fora');
  assert.equal(r.excedeuLimitePostos, true, 'sinaliza o estouro do limite');
  assert.ok(r.recomendacoes.some((t) => /acima do limite/.test(t)));
});

test('sequência vazia não quebra e pede cadastro', () => {
  const r = balancearLinha({ operacoes: [], metaPecasHora: 30 });
  assert.equal(r.postosUsados, 0);
  assert.equal(r.tempoCiclo, 0);
  assert.equal(r.eficiencia, 0);
  assert.equal(r.producaoHora, 0);
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} finito`);
  }
  assert.ok(r.recomendacoes.length > 0);
});

test('operações com tempo zero são descartadas', () => {
  const r = balancearLinha({ operacoes: ops([1, 0, 1, -2]), metaPecasHora: 60 });
  assert.equal(r.operacoes, 2, 'apenas as duas com tempo positivo');
  quase(r.sam, 2);
});

test('eficiência, ociosidade e projeção de turno', () => {
  const r = balancearLinha({ operacoes: ops([2, 1, 1]), metaPecasHora: 30, minutosDisponiveis: 420 });
  quase(r.pitchTime, 2);
  quase(r.sam, 4);
  // postos: [2] e [1,1] → tempo de ciclo 2, eficiência 4/(2×2)=100%
  assert.equal(r.postosUsados, 2);
  quase(r.eficiencia, 1);
  quase(r.producaoTurno, 30 * 7, '30 peças/h × 7 h');
  for (const e of r.estacoes) {
    quase(e.ociosidade, r.tempoCiclo - e.tempo, `ociosidade do posto ${e.numero}`);
    quase(e.utilizacao, e.tempo / r.tempoCiclo, `utilização do posto ${e.numero}`);
  }
});

test('a soma dos tempos alocados iguala o SAM', () => {
  for (const tempos of [[1, 2, 3, 4], [0.5, 0.5, 0.5], [4, 1, 1, 1, 1], [2, 2, 2, 2, 2, 2]]) {
    const r = balancearLinha({ operacoes: ops(tempos), metaPecasHora: 30 });
    quase(
      r.estacoes.reduce((s, e) => s + e.tempo, 0),
      r.sam,
      `nenhum tempo perdido para ${tempos.join(',')}`
    );
  }
});
