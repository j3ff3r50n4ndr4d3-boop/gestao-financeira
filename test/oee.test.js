'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calcularOEE,
  agregarOEE,
  resumirParadas,
  tempoCicloIdealMin,
  categoriaDoMotivo,
  faixaOEE,
  CATEGORIA_PLANEJADA,
  CATEGORIA_NAO_PLANEJADA,
} = require('../server/lib/oee');

const quase = (a, b, msg = '', tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: esperado ~${b}, obtido ${a}`);

/** Cenário de referência usado em vários testes. */
function cenarioBase(override = {}) {
  return calcularOEE({
    minutosTurno: 480,
    pausasPlanejadasTurno: 60,
    paradas: [{ motivo: 'QUEBRA', minutos: 40 }, { motivo: 'SETUP', minutos: 20 }],
    pecasProduzidas: 216,
    pecasDefeito: 6,
    pecasRetrabalho: 4,
    samMin: 18,
    operadores: 12,
    custoHoraCelula: 240,
    ...override,
  });
}

test('tempo ciclo ideal = SAM dividido pelo número de operadores', () => {
  quase(tempoCicloIdealMin(18, 12), 1.5);
  quase(tempoCicloIdealMin(31, 10), 3.1);
  assert.equal(tempoCicloIdealMin(0, 10), 0);
  assert.equal(tempoCicloIdealMin(18, 0), 0);
});

test('OEE de referência: 85,71% × 90% × 97,22% = 75%', () => {
  const r = cenarioBase();
  quase(r.tempoPlanejado, 420, 'tempo planejado');
  quase(r.tempoOperacao, 360, 'tempo de operação');
  quase(r.disponibilidade, 360 / 420, 'disponibilidade');
  quase(r.desempenho, 0.9, 'desempenho');
  quase(r.desempenhoPct, 90, 'desempenho %');
  quase(r.qualidade, 210 / 216, 'qualidade');
  quase(r.oee, 0.75, 'oee');
  quase(r.oeePct, 75, 'oee %');
  quase(r.tempoCicloIdealMin, 1.5);
});

test('paradas planejadas saem do tempo planejado, não da disponibilidade', () => {
  const comDds = cenarioBase({ paradas: [{ motivo: 'DDS', minutos: 30 }, { motivo: 'QUEBRA', minutos: 60 }] });
  quase(comDds.paradasPlanejadas, 90, 'planejada = 60 do turno + 30 de DDS');
  quase(comDds.tempoPlanejado, 390, '480 - 90');
  quase(comDds.paradasNaoPlanejadas, 60);
  quase(comDds.tempoOperacao, 330);
  quase(comDds.disponibilidade, 330 / 390, 'refeição não derruba disponibilidade');

  const semDds = cenarioBase({ paradas: [{ motivo: 'QUEBRA', minutos: 60 }] });
  quase(semDds.tempoPlanejado, 420);
  quase(semDds.disponibilidade, 360 / 420);
});

test('motivo desconhecido é tratado como parada não planejada', () => {
  assert.equal(categoriaDoMotivo('QUEBRA'), CATEGORIA_NAO_PLANEJADA);
  assert.equal(categoriaDoMotivo('REFEICAO'), CATEGORIA_PLANEJADA);
  assert.equal(categoriaDoMotivo('MOTIVO_INVENTADO'), CATEGORIA_NAO_PLANEJADA);

  const r = cenarioBase({ paradas: [{ motivo: 'MOTIVO_INVENTADO', minutos: 50 }] });
  quase(r.paradasNaoPlanejadas, 50);
  quase(r.tempoOperacao, 370);
});

test('as três perdas somam exatamente o tempo planejado menos o tempo produtivo', () => {
  // A identidade vale enquanto a produção não ultrapassa o padrão de tempo.
  for (const pecas of [0, 37, 120, 240]) {
    for (const defeitos of [0, 3, 40]) {
      const r = cenarioBase({ pecasProduzidas: pecas, pecasDefeito: defeitos });
      assert.ok(
        r.pecasProduzidas <= r.pecasTeoricas,
        `precondição do caso ${pecas}pç: produção dentro do padrão`
      );
      quase(r.minutosPerdaTotal, r.tempoPlanejado - r.minutosProdutivos, `identidade p/ ${pecas}pç/${defeitos}def`);
      quase(
        r.pecasPerdidasTotal,
        r.pecasTeoricasPlanejadas - r.pecasBoas,
        `peças perdidas p/ ${pecas}pç/${defeitos}def`
      );
    }
  }
});

test('produzindo acima do padrão não existe perda negativa de ritmo', () => {
  const r = cenarioBase({ pecasProduzidas: 300, pecasDefeito: 0 }); // teóricas = 240
  assert.ok(r.pecasProduzidas > r.pecasTeoricas, 'produção acima do padrão');
  quase(r.minutosPerdaDesempenho, 0, 'perda de ritmo truncada em zero');
  quase(r.pecasPerdidasDesempenho, 0);
  quase(r.minutosPerdaTotal, 60, 'sobra apenas a perda por indisponibilidade');
  // Aqui o tempo produtivo excede o tempo planejado — a diferença é justamente o
  // quanto o padrão de tempo (SAM) está defasado em relação à prática.
  assert.ok(r.minutosProdutivos > r.tempoPlanejado);
  quase(r.minutosProdutivos - r.tempoPlanejado, 30);
});

test('desempenho acima de 100% é reportado cru mas não infla o OEE', () => {
  const r = cenarioBase({ pecasProduzidas: 300 }); // teóricas = 240
  assert.equal(r.desempenhoAcimaDoPadrao, true);
  assert.ok(r.desempenho > 1, 'desempenho cru acima de 1');
  quase(r.desempenhoPct, 125, 'desempenho % é exibido cru, sem truncar em 100');
  quase(r.oee, r.disponibilidade * 1 * r.qualidade, 'OEE limita desempenho a 100%');
  assert.ok(r.oeePct <= 100, 'OEE nunca passa de 100%');
  quase(r.minutosPerdaDesempenho, 0, 'não existe perda de ritmo negativa');
});

test('guardas de divisão por zero não produzem NaN', () => {
  const vazio = calcularOEE({});
  for (const [k, v] of Object.entries(vazio)) {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} deveria ser finito, veio ${v}`);
  }
  assert.equal(vazio.oee, 0);
  assert.equal(vazio.disponibilidade, 0);
  assert.equal(vazio.desempenho, 0);
  assert.equal(vazio.qualidade, 0);

  const semPadrao = calcularOEE({ minutosTurno: 480, pausasPlanejadasTurno: 60, samMin: 0, operadores: 10, pecasProduzidas: 100 });
  assert.equal(semPadrao.desempenho, 0, 'sem SAM não há como medir desempenho');
  assert.ok(Number.isFinite(semPadrao.oee));
});

test('paradas além da duração do turno são limitadas ao tempo disponível', () => {
  const r = cenarioBase({ paradas: [{ motivo: 'QUEBRA', minutos: 5000 }] });
  quase(r.paradasNaoPlanejadas, 420, 'limitado ao tempo planejado');
  quase(r.tempoOperacao, 0);
  quase(r.disponibilidade, 0);
  quase(r.oee, 0);
});

test('defeitos não podem exceder a produção', () => {
  const r = cenarioBase({ pecasProduzidas: 100, pecasDefeito: 150 });
  assert.equal(r.pecasDefeito, 100);
  assert.equal(r.pecasBoas, 0);
  quase(r.qualidade, 0);
});

test('resumirParadas ignora minutos negativos e agrupa por motivo e por perda', () => {
  const r = resumirParadas([
    { motivo: 'QUEBRA', minutos: 30 },
    { motivo: 'QUEBRA', minutos: -10 },
    { motivo: 'QUEBRA', minutos: 20 },
    { motivo: 'SETUP', minutos: 15 },
    { motivo: 'REFEICAO', minutos: 60 },
    { motivo: 'FALTA_MATERIAL', minutos: 0 },
  ]);
  quase(r.porPerda.QUEBRA, 50, 'quebra ignora valor negativo');
  quase(r.porPerda.SETUP, 15);
  quase(r.planejada, 60);
  quase(r.naoPlanejada, 65);
  assert.equal(r.porMotivo.QUEBRA.ocorrencias, 2);
  assert.equal(r.porMotivo.FALTA_MATERIAL, undefined, 'evento de 0 min é descartado');
});

test('produtividade: peças/hora real, teórica e por operador', () => {
  const r = cenarioBase();
  quase(r.producaoHora, 216 / 6, '216 peças em 6 h de operação');
  quase(r.producaoHoraTeorica, 40, '60 / 1,5 min por peça');
  quase(r.pecasPorOperadorHora, 36 / 12);
  quase(r.taxaDefeitosPct, (6 / 216) * 100);
  quase(r.taxaRetrabalhoPct, (4 / 216) * 100);
});

test('custo da perda usa o custo-hora da célula', () => {
  const r = cenarioBase(); // 240 R$/h → 4 R$/min
  quase(r.custoPerdaDisponibilidade, 60 * 4);
  quase(r.custoPerdaDesempenho, 36 * 4);
  quase(r.custoPerdaQualidade, 9 * 4);
  quase(r.custoPerdaTotal, 105 * 4);
});

test('OEE consolidado é ponderado, não a média aritmética', () => {
  const grande = cenarioBase({ pecasProduzidas: 250, pecasDefeito: 5, paradas: [{ motivo: 'SETUP', minutos: 10 }] });
  // Célula menor: turno mais curto e SAM/operadores diferentes → tempo ciclo distinto.
  const pequena = calcularOEE({
    minutosTurno: 240, pausasPlanejadasTurno: 20,
    paradas: [{ motivo: 'QUEBRA', minutos: 100 }],
    pecasProduzidas: 30, pecasDefeito: 12, samMin: 31, operadores: 10, custoHoraCelula: 150,
  });

  // Pré-condição: sem diferença de escala entre as sessões a ponderação não se
  // distingue da média (ver teste seguinte).
  assert.notEqual(grande.tempoPlanejado, pequena.tempoPlanejado);
  assert.notEqual(grande.tempoCicloIdealMin, pequena.tempoCicloIdealMin);

  const mediaSimples = (grande.oee + pequena.oee) / 2;
  const agg = agregarOEE([grande, pequena]);

  assert.notEqual(agg.oee, mediaSimples, 'consolidado deve diferir da média simples');

  // Recalculando a partir dos totais acumulados — precisa bater exatamente.
  const tempoPlanejado = grande.tempoPlanejado + pequena.tempoPlanejado;
  const tempoOperacao = grande.tempoOperacao + pequena.tempoOperacao;
  const pecas = grande.pecasProduzidas + pequena.pecasProduzidas;
  const boas = grande.pecasBoas + pequena.pecasBoas;
  const produzidoMin = grande.pecasProduzidas * grande.tempoCicloIdealMin + pequena.pecasProduzidas * pequena.tempoCicloIdealMin;

  quase(agg.tempoPlanejado, tempoPlanejado);
  quase(agg.disponibilidade, tempoOperacao / tempoPlanejado, 'disponibilidade ponderada');
  quase(agg.desempenho, produzidoMin / tempoOperacao, 'desempenho ponderado');
  quase(agg.qualidade, boas / pecas, 'qualidade ponderada');
  quase(agg.oee, (tempoOperacao / tempoPlanejado) * (produzidoMin / tempoOperacao) * (boas / pecas), 'oee ponderado');
  assert.equal(agg.quantidade, 2);
  assert.equal(agg.pecasProduzidas, pecas);
  quase(agg.pecasDefeito, grande.pecasDefeito + pequena.pecasDefeito);
  quase(agg.custoPerdaTotal, grande.custoPerdaTotal + pequena.custoPerdaTotal);
});

test('com tempo planejado e tempo ciclo iguais, o consolidado coincide com a média', () => {
  // OEE_i = peças boas_i × ICT / PPT_i (quando o desempenho não passa de 100%).
  // Se ICT e PPT são os mesmos para todas as sessões, o consolidado ponderado
  // colapsa na média aritmética — por isso o teste anterior precisa de escalas
  // diferentes para ser significativo.
  const a = cenarioBase({ pecasProduzidas: 200, pecasDefeito: 4 });
  const b = cenarioBase({ pecasProduzidas: 150, pecasDefeito: 15, paradas: [{ motivo: 'QUEBRA', minutos: 90 }] });
  assert.equal(a.tempoCicloIdealMin, b.tempoCicloIdealMin);
  assert.equal(a.tempoPlanejado, b.tempoPlanejado);
  quase(agregarOEE([a, b]).oee, (a.oee + b.oee) / 2, 'média == ponderada neste caso particular');
});

test('agregação de lista vazia devolve zeros sem NaN', () => {
  const agg = agregarOEE([]);
  assert.equal(agg.oee, 0);
  assert.equal(agg.quantidade, 0);
  assert.deepEqual(agg.porMotivo, []);
  for (const [k, v] of Object.entries(agg)) {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} deveria ser finito`);
  }
});

test('agregação acumula paradas por motivo e as 6 grandes perdas', () => {
  const a = cenarioBase();
  const b = cenarioBase({ paradas: [{ motivo: 'QUEBRA', minutos: 25 }, { motivo: 'FALTA_MATERIAL', minutos: 35 }] });
  const agg = agregarOEE([a, b]);

  const quebra = agg.porMotivo.find((m) => m.codigo === 'QUEBRA');
  quase(quebra.minutos, 40 + 25);
  assert.equal(quebra.ocorrencias, 2);
  assert.equal(agg.porMotivo[0].codigo, 'QUEBRA', 'Pareto ordenado do maior para o menor');

  const ritmo = agg.seisPerdas.find((p) => p.codigo === 'RITMO_REDUZIDO');
  quase(ritmo.minutos, a.minutosPerdaDesempenho + b.minutosPerdaDesempenho);
});

test('faixaOEE classifica contra a meta configurada', () => {
  const metas = { metaOee: 0.85 };
  assert.equal(faixaOEE(0.9, metas).nivel, 'OTIMO');
  assert.equal(faixaOEE(0.7, metas).nivel, 'ATENCAO');
  assert.equal(faixaOEE(0.5, metas).nivel, 'CRITICO');
  quase(faixaOEE(0.9, metas).valor, 90);
  // meta mais frouxa muda a classificação do mesmo valor
  assert.equal(faixaOEE(0.7, { metaOee: 0.6 }).nivel, 'OTIMO');
});
