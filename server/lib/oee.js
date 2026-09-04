'use strict';

/**
 * Motor de cálculo de OEE (Overall Equipment Effectiveness) / Eficiência Produtiva
 * para confecção. Funções puras, sem dependência de banco ou HTTP — testáveis isoladamente.
 *
 * Modelo de tempo (padrão SEMI VDI 3423 adaptado a confecção):
 *
 *   Tempo Calendário (turno)
 *     ├── Paradas Planejadas  (refeição, intervalos, DDS, sem programação)
 *     └── Tempo Planejado (PPT) .................. denominador da DISPONIBILIDADE
 *           ├── Paradas Não Planejadas (quebra, setup, falta de material...)
 *           └── Tempo de Operação (RT) ........... denominador do DESEMPENHO
 *                 ├── Tempo Produzido (peças × tempo ciclo ideal)
 *                 └── Perda de Ritmo
 *   Peças Produzidas
 *     ├── Peças Boas ............................. numerador da QUALIDADE
 *     └── Peças com Defeito
 *
 *   OEE = Disponibilidade × Desempenho × Qualidade
 */

const CATEGORIA_PLANEJADA = 'PLANEJADA';
const CATEGORIA_NAO_PLANEJADA = 'NAO_PLANEJADA';

/**
 * Catálogo de motivos de parada.
 * `perda` classifica a parada dentro das "6 Grandes Perdas" do OEE.
 */
const MOTIVOS_PARADA = [
  // ---- Planejadas (não entram na Disponibilidade) ----
  { codigo: 'REFEICAO', rotulo: 'Refeição', categoria: CATEGORIA_PLANEJADA, perda: null },
  { codigo: 'INTERVALO', rotulo: 'Intervalo / Café', categoria: CATEGORIA_PLANEJADA, perda: null },
  { codigo: 'DDS', rotulo: 'Reunião / DDS', categoria: CATEGORIA_PLANEJADA, perda: null },
  { codigo: 'LIMPEZA', rotulo: 'Limpeza programada', categoria: CATEGORIA_PLANEJADA, perda: null },
  { codigo: 'SEM_PROGRAMACAO', rotulo: 'Sem pedido programado', categoria: CATEGORIA_PLANEJADA, perda: null },

  // ---- Não planejadas: QUEBRA ----
  { codigo: 'QUEBRA', rotulo: 'Quebra de máquina', categoria: CATEGORIA_NAO_PLANEJADA, perda: 'QUEBRA' },
  { codigo: 'MANUTENCAO', rotulo: 'Manutenção corretiva', categoria: CATEGORIA_NAO_PLANEJADA, perda: 'QUEBRA' },
  { codigo: 'ENERGIA', rotulo: 'Falta de energia', categoria: CATEGORIA_NAO_PLANEJADA, perda: 'QUEBRA' },

  // ---- Não planejadas: SETUP / AJUSTES ----
  { codigo: 'SETUP', rotulo: 'Setup / troca de modelo', categoria: CATEGORIA_NAO_PLANEJADA, perda: 'SETUP' },
  { codigo: 'AGULHA', rotulo: 'Troca de agulha, fio ou bobina', categoria: CATEGORIA_NAO_PLANEJADA, perda: 'SETUP' },
  { codigo: 'AJUSTE_QUALIDADE', rotulo: 'Ajuste de qualidade / regulagem', categoria: CATEGORIA_NAO_PLANEJADA, perda: 'SETUP' },

  // ---- Não planejadas: PARADAS MENORES ----
  { codigo: 'FALTA_MATERIAL', rotulo: 'Falta de material / insumo', categoria: CATEGORIA_NAO_PLANEJADA, perda: 'PARADA_MENOR' },
  { codigo: 'AGUARDANDO_SERVICO', rotulo: 'Aguardando corte / serviço anterior', categoria: CATEGORIA_NAO_PLANEJADA, perda: 'PARADA_MENOR' },
  { codigo: 'FALTA_OPERADOR', rotulo: 'Falta / ausência de operador', categoria: CATEGORIA_NAO_PLANEJADA, perda: 'PARADA_MENOR' },
];

const MOTIVO_POR_CODIGO = new Map(MOTIVOS_PARADA.map((m) => [m.codigo, m]));

/** As 6 grandes perdas, na ordem clássica de apresentação. */
const SEIS_GRANDES_PERDAS = [
  { codigo: 'QUEBRA', rotulo: 'Quebras e falhas', origem: 'DISPONIBILIDADE' },
  { codigo: 'SETUP', rotulo: 'Setup e ajustes', origem: 'DISPONIBILIDADE' },
  { codigo: 'PARADA_MENOR', rotulo: 'Paradas menores', origem: 'DISPONIBILIDADE' },
  { codigo: 'RITMO_REDUZIDO', rotulo: 'Ritmo reduzido', origem: 'DESEMPENHO' },
  { codigo: 'DEFEITO_PRODUCAO', rotulo: 'Defeitos de produção', origem: 'QUALIDADE' },
  { codigo: 'PERDA_PLANEJADA', rotulo: 'Tempo não programado', origem: 'PLANEJAMENTO' },
];

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const pct = (v) => clamp01(v) * 100;

/** Classifica um motivo de parada; códigos desconhecidos são tratados como não planejados. */
function categoriaDoMotivo(codigo) {
  const m = MOTIVO_POR_CODIGO.get(String(codigo || '').toUpperCase());
  return m ? m.categoria : CATEGORIA_NAO_PLANEJADA;
}

function perdaDoMotivo(codigo) {
  const m = MOTIVO_POR_CODIGO.get(String(codigo || '').toUpperCase());
  return m && m.perda ? m.perda : 'PARADA_MENOR';
}

/**
 * Agrega eventos de parada em minutos, por categoria, por motivo e por grupo de perda.
 * @param {Array<{motivo:string, minutos:number, descricao?:string}>} paradas
 */
function resumirParadas(paradas = []) {
  const res = {
    planejada: 0,
    naoPlanejada: 0,
    total: 0,
    porMotivo: {},
    porPerda: { QUEBRA: 0, SETUP: 0, PARADA_MENOR: 0 },
    eventos: [],
  };

  for (const p of paradas || []) {
    const minutos = Math.max(0, num(p.minutos));
    if (minutos <= 0) continue;
    const codigo = String(p.motivo || '').toUpperCase();
    const motivo = MOTIVO_POR_CODIGO.get(codigo);
    const categoria = motivo ? motivo.categoria : categoriaDoMotivo(codigo);
    const rotulo = motivo ? motivo.rotulo : (p.motivo || 'Não informado');

    res.total += minutos;
    if (categoria === CATEGORIA_PLANEJADA) res.planejada += minutos;
    else res.naoPlanejada += minutos;

    res.porMotivo[codigo] = res.porMotivo[codigo] || {
      codigo,
      rotulo,
      categoria,
      minutos: 0,
      ocorrencias: 0,
      perda: motivo && motivo.perda ? motivo.perda : 'PARADA_MENOR',
    };
    res.porMotivo[codigo].minutos += minutos;
    res.porMotivo[codigo].ocorrencias += 1;

    if (categoria === CATEGORIA_NAO_PLANEJADA) {
      const perda = motivo && motivo.perda ? motivo.perda : 'PARADA_MENOR';
      res.porPerda[perda] = (res.porPerda[perda] || 0) + minutos;
    }

    res.eventos.push({ codigo, rotulo, categoria, minutos, descricao: p.descricao || '' });
  }

  return res;
}

/**
 * Tempo ciclo ideal da célula, em minutos por peça.
 * Em confecção o padrão é o SAM (Standard Allowed Minutes) da peça dividido pelo
 * número de operadores da linha: uma linha balanceada de 12 operadores com peça de
 * SAM 18 min entrega 1 peça a cada 1,5 min.
 */
function tempoCicloIdealMin(samMin, operadores) {
  const sam = num(samMin);
  const ops = num(operadores);
  if (sam <= 0 || ops <= 0) return 0;
  return sam / ops;
}

/**
 * Calcula o OEE de um apontamento (uma célula/linha em um turno de um dia).
 *
 * @param {object} i
 * @param {number} i.minutosTurno          duração do turno em minutos (tempo calendário)
 * @param {number} i.pausasPlanejadasTurno pausas fixas do turno (refeição, intervalos)
 * @param {Array}  i.paradas               eventos de parada registrados no apontamento
 * @param {number} i.pecasProduzidas       peças que saíram da célula
 * @param {number} i.pecasDefeito          peças refugadas/com defeito
 * @param {number} i.samMin                SAM da peça em minutos
 * @param {number} i.operadores            operadores alocados na célula
 * @param {number} [i.custoHoraCelula]     custo-hora da célula (R$) para monetizar perdas
 * @returns {object} indicadores
 */
function calcularOEE(i = {}) {
  const minutosTurno = Math.max(0, num(i.minutosTurno));
  const pausasTurno = Math.max(0, num(i.pausasPlanejadasTurno));
  const paradas = resumirParadas(i.paradas);

  // Tempo calendário não pode ser menor que as paradas registradas.
  const paradasPlanejadas = Math.min(pausasTurno + paradas.planejada, minutosTurno);
  const tempoPlanejado = Math.max(0, minutosTurno - paradasPlanejadas);
  const paradasNaoPlanejadas = Math.min(paradas.naoPlanejada, tempoPlanejado);
  const tempoOperacao = Math.max(0, tempoPlanejado - paradasNaoPlanejadas);

  const pecasProduzidas = Math.max(0, Math.round(num(i.pecasProduzidas)));
  const pecasDefeito = Math.min(pecasProduzidas, Math.max(0, Math.round(num(i.pecasDefeito))));
  const pecasBoas = pecasProduzidas - pecasDefeito;

  const ict = tempoCicloIdealMin(i.samMin, i.operadores); // min/peça

  // ---- Os três fatores ----
  const disponibilidade = tempoPlanejado > 0 ? clamp01(tempoOperacao / tempoPlanejado) : 0;
  const pecasTeoricas = ict > 0 ? tempoOperacao / ict : 0;
  const desempenho = pecasTeoricas > 0 ? pecasProduzidas / pecasTeoricas : 0; // não limitado a 1
  const qualidade = pecasProduzidas > 0 ? clamp01(pecasBoas / pecasProduzidas) : 0;

  const oee = disponibilidade * Math.min(desempenho, 1) * qualidade;

  // ---- Capacidade e perdas (em peças) ----
  const pecasTeoricasPlanejadas = ict > 0 ? tempoPlanejado / ict : 0;
  const pecasPerdidasDisponibilidade = ict > 0 ? paradasNaoPlanejadas / ict : 0;
  const pecasPerdidasDesempenho = Math.max(0, pecasTeoricas - pecasProduzidas);
  const pecasPerdidasQualidade = pecasDefeito;

  // ---- Perdas em minutos (as três somam exatamente PPT - tempo produtivo) ----
  const minutosPerdaDisponibilidade = paradasNaoPlanejadas;
  const minutosPerdaDesempenho = Math.max(0, tempoOperacao - pecasProduzidas * ict);
  const minutosPerdaQualidade = pecasDefeito * ict;
  const minutosPerdaTotal = minutosPerdaDisponibilidade + minutosPerdaDesempenho + minutosPerdaQualidade;
  const minutosProdutivos = pecasBoas * ict;

  // ---- Produtividade ----
  const horasOperacao = tempoOperacao / 60;
  const producaoHora = horasOperacao > 0 ? pecasProduzidas / horasOperacao : 0;
  const producaoHoraTeorica = ict > 0 ? 60 / ict : 0;
  const pecasPorOperadorHora =
    horasOperacao > 0 && num(i.operadores) > 0 ? pecasProduzidas / horasOperacao / num(i.operadores) : 0;
  const taxaDefeitos = pecasProduzidas > 0 ? pecasDefeito / pecasProduzidas : 0;
  const taxaRetrabalho = pecasProduzidas > 0 ? Math.min(1, num(i.pecasRetrabalho) / pecasProduzidas) : 0;

  // ---- Custo das perdas ----
  const custoMinuto = num(i.custoHoraCelula) / 60;
  const custoPerdaDisponibilidade = minutosPerdaDisponibilidade * custoMinuto;
  const custoPerdaDesempenho = minutosPerdaDesempenho * custoMinuto;
  const custoPerdaQualidade = minutosPerdaQualidade * custoMinuto;
  const custoPerdaTotal = minutosPerdaTotal * custoMinuto;

  // ---- 6 grandes perdas em minutos ----
  const seisPerdas = [
    { codigo: 'QUEBRA', rotulo: 'Quebras e falhas', origem: 'DISPONIBILIDADE', minutos: paradas.porPerda.QUEBRA || 0 },
    { codigo: 'SETUP', rotulo: 'Setup e ajustes', origem: 'DISPONIBILIDADE', minutos: paradas.porPerda.SETUP || 0 },
    { codigo: 'PARADA_MENOR', rotulo: 'Paradas menores', origem: 'DISPONIBILIDADE', minutos: paradas.porPerda.PARADA_MENOR || 0 },
    { codigo: 'RITMO_REDUZIDO', rotulo: 'Ritmo reduzido', origem: 'DESEMPENHO', minutos: minutosPerdaDesempenho },
    { codigo: 'DEFEITO_PRODUCAO', rotulo: 'Defeitos de produção', origem: 'QUALIDADE', minutos: minutosPerdaQualidade },
    { codigo: 'PERDA_PLANEJADA', rotulo: 'Tempo não programado', origem: 'PLANEJAMENTO', minutos: paradasPlanejadas },
  ];

  return {
    // fatores (0..1)
    disponibilidade,
    desempenho,
    qualidade,
    oee,
    // em percentual, prontos para exibir
    disponibilidadePct: pct(disponibilidade),
    // Desempenho é exibido cru, sem limite em 100%: um valor acima do padrão é
    // justamente o sinal de que o SAM está defasado. O que é limitado a 100% é a
    // contribuição do desempenho ao OEE (Math.min acima).
    desempenhoPct: desempenho * 100,
    qualidadePct: pct(qualidade),
    oeePct: pct(oee),
    // tempos
    minutosTurno,
    paradasPlanejadas,
    paradasNaoPlanejadas,
    tempoPlanejado,
    tempoOperacao,
    // peças
    pecasProduzidas,
    pecasDefeito,
    pecasBoas,
    pecasTeoricas,
    pecasTeoricasPlanejadas,
    pecasPerdidasDisponibilidade,
    pecasPerdidasDesempenho,
    pecasPerdidasQualidade,
    pecasPerdidasTotal: pecasPerdidasDisponibilidade + pecasPerdidasDesempenho + pecasPerdidasQualidade,
    // tempo padrão
    tempoCicloIdealMin: ict,
    producaoHora,
    producaoHoraTeorica,
    pecasPorOperadorHora,
    taxaDefeitos,
    taxaDefeitosPct: taxaDefeitos * 100,
    taxaRetrabalho,
    taxaRetrabalhoPct: taxaRetrabalho * 100,
    // perdas em minutos
    minutosProdutivos,
    minutosPerdaDisponibilidade,
    minutosPerdaDesempenho,
    minutosPerdaQualidade,
    minutosPerdaTotal,
    seisPerdas,
    // custos
    custoPerdaDisponibilidade,
    custoPerdaDesempenho,
    custoPerdaQualidade,
    custoPerdaTotal,
    // sinalização de padrão de tempo defasado
    desempenhoAcimaDoPadrao: desempenho > 1,
    // paradas
    paradas: paradas,
  };
}

/**
 * Agrega vários resultados de calcularOEE num único indicador de fábrica/período.
 *
 * IMPORTANTE: OEE consolidado NÃO é a média aritmética dos OEEs. Cada fator é
 * ponderado pelo seu denominador natural (tempo planejado, tempo de operação e
 * peças produzidas). A média simples distorce quando células/turnos têm tamanhos
 * diferentes.
 */
function agregarOEE(resultados = []) {
  const a = {
    quantidade: 0,
    minutosTurno: 0,
    paradasPlanejadas: 0,
    paradasNaoPlanejadas: 0,
    tempoPlanejado: 0,
    tempoOperacao: 0,
    pecasProduzidas: 0,
    pecasDefeito: 0,
    pecasBoas: 0,
    tempoProduzidoMin: 0,
    minutosProdutivos: 0,
    minutosPerdaDisponibilidade: 0,
    minutosPerdaDesempenho: 0,
    minutosPerdaQualidade: 0,
    minutosPerdaTotal: 0,
    custoPerdaTotal: 0,
    custoPerdaDisponibilidade: 0,
    custoPerdaDesempenho: 0,
    custoPerdaQualidade: 0,
    porMotivo: {},
    porPerda: { QUEBRA: 0, SETUP: 0, PARADA_MENOR: 0 },
    seisPerdas: {},
  };

  for (const r of resultados || []) {
    if (!r) continue;
    a.quantidade += 1;
    a.minutosTurno += r.minutosTurno;
    a.paradasPlanejadas += r.paradasPlanejadas;
    a.paradasNaoPlanejadas += r.paradasNaoPlanejadas;
    a.tempoPlanejado += r.tempoPlanejado;
    a.tempoOperacao += r.tempoOperacao;
    a.pecasProduzidas += r.pecasProduzidas;
    a.pecasDefeito += r.pecasDefeito;
    a.pecasBoas += r.pecasBoas;
    a.tempoProduzidoMin += r.pecasProduzidas * r.tempoCicloIdealMin;
    a.minutosProdutivos += r.minutosProdutivos;
    a.minutosPerdaDisponibilidade += r.minutosPerdaDisponibilidade;
    a.minutosPerdaDesempenho += r.minutosPerdaDesempenho;
    a.minutosPerdaQualidade += r.minutosPerdaQualidade;
    a.minutosPerdaTotal += r.minutosPerdaTotal;
    a.custoPerdaTotal += r.custoPerdaTotal;
    a.custoPerdaDisponibilidade += r.custoPerdaDisponibilidade;
    a.custoPerdaDesempenho += r.custoPerdaDesempenho;
    a.custoPerdaQualidade += r.custoPerdaQualidade;

    for (const [codigo, m] of Object.entries(r.paradas?.porMotivo || {})) {
      // O acumulador nasce zerado: copiar {...m} já traria os minutos desta linha
      // e o += abaixo os somaria de novo (contagem dupla).
      a.porMotivo[codigo] = a.porMotivo[codigo] || {
        codigo: m.codigo,
        rotulo: m.rotulo,
        categoria: m.categoria,
        perda: m.perda,
        minutos: 0,
        ocorrencias: 0,
      };
      a.porMotivo[codigo].minutos += m.minutos;
      a.porMotivo[codigo].ocorrencias += m.ocorrencias;
    }
    for (const [perda, minutos] of Object.entries(r.paradas?.porPerda || {})) {
      a.porPerda[perda] = (a.porPerda[perda] || 0) + minutos;
    }
    for (const p of r.seisPerdas || []) {
      a.seisPerdas[p.codigo] = a.seisPerdas[p.codigo] || {
        codigo: p.codigo,
        rotulo: p.rotulo,
        origem: p.origem,
        minutos: 0,
      };
      a.seisPerdas[p.codigo].minutos += p.minutos;
    }
  }

  const disponibilidade = a.tempoPlanejado > 0 ? clamp01(a.tempoOperacao / a.tempoPlanejado) : 0;
  const desempenho = a.tempoOperacao > 0 ? a.tempoProduzidoMin / a.tempoOperacao : 0;
  const qualidade = a.pecasProduzidas > 0 ? clamp01(a.pecasBoas / a.pecasProduzidas) : 0;
  const oee = disponibilidade * Math.min(desempenho, 1) * qualidade;
  const horasOperacao = a.tempoOperacao / 60;

  return {
    ...a,
    porMotivo: Object.values(a.porMotivo).sort((x, y) => y.minutos - x.minutos),
    seisPerdas: Object.values(a.seisPerdas).sort((x, y) => y.minutos - x.minutos),
    disponibilidade,
    desempenho,
    qualidade,
    oee,
    disponibilidadePct: pct(disponibilidade),
    desempenhoPct: desempenho * 100, // cru, pelo mesmo motivo de calcularOEE
    qualidadePct: pct(qualidade),
    oeePct: pct(oee),
    taxaDefeitos: a.pecasProduzidas > 0 ? a.pecasDefeito / a.pecasProduzidas : 0,
    taxaDefeitosPct: a.pecasProduzidas > 0 ? (a.pecasDefeito / a.pecasProduzidas) * 100 : 0,
    producaoHora: horasOperacao > 0 ? a.pecasProduzidas / horasOperacao : 0,
    pecasPerdidasTotal:
      a.pecasProduzidas > 0
        ? (a.minutosPerdaTotal / (a.tempoProduzidoMin / a.pecasProduzidas)) || 0
        : 0,
  };
}

/** Classifica um OEE (0..1) em faixa de desempenho com cor. */
function faixaOEE(oee, metas = {}) {
  const alvo = num(metas.metaOee) || 0.85;
  const atencao = alvo * 0.75;
  const valor = pct(oee);
  if (valor >= alvo * 100) return { nivel: 'OTIMO', rotulo: 'Meta atingida', cor: '#16a34a', valor };
  if (valor >= atencao * 100) return { nivel: 'ATENCAO', rotulo: 'Abaixo da meta', cor: '#f59e0b', valor };
  return { nivel: 'CRITICO', rotulo: 'Crítico', cor: '#dc2626', valor };
}

module.exports = {
  CATEGORIA_PLANEJADA,
  CATEGORIA_NAO_PLANEJADA,
  MOTIVOS_PARADA,
  SEIS_GRANDES_PERDAS,
  categoriaDoMotivo,
  perdaDoMotivo,
  resumirParadas,
  tempoCicloIdealMin,
  calcularOEE,
  agregarOEE,
  faixaOEE,
};
