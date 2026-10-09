// ============================================================
// AGENTE IA ERP - Motor de análise (sistema especialista)
// Recebe as métricas reais do banco e devolve, por domínio:
// nota de saúde (0-100), leitura em linguagem natural, alertas
// priorizados, recomendações com passos e plano 30/60/90 dias.
// Funciona 100% offline: nenhuma chamada externa é necessária.
// ============================================================

const { DOMAINS, getDomain } = require('./domains');
const { round, safeDiv, pct } = require('./metrics');

// ---------- formatação ----------
function brl(value) {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
function brl2(value) {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}
function num(value, digits = 0) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
function percent(value) {
  return `${num(value, 1)}%`;
}
function pl(count, singular, plural) {
  return Number(count) === 1 ? singular : plural || `${singular}s`;
}
function countPhrase(count, singular, plural) {
  return `${num(count)} ${pl(count, singular, plural)}`;
}

function signal(value) {
  const n = Number(value || 0);
  return n > 0 ? `+${num(n, 1)}%` : `${num(n, 1)}%`;
}

// ---------- utilidades de nota ----------
function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}
// quanto maior o valor, melhor (ex.: margem)
function scoreUp(value, bad, good) {
  if (value === null || value === undefined) return null;
  if (value <= bad) return 0;
  if (value >= good) return 100;
  return clamp(((value - bad) / (good - bad)) * 100);
}
// quanto menor o valor, melhor (ex.: inadimplência)
function scoreDown(value, bad, good) {
  if (value === null || value === undefined) return null;
  if (value >= bad) return 0;
  if (value <= good) return 100;
  return clamp(((bad - value) / (bad - good)) * 100);
}

function levelOf(score) {
  if (score === null) return { key: 'sem_dados', label: 'Sem dados', color: '#94a3b8' };
  if (score >= 80) return { key: 'excelente', label: 'Excelente', color: '#10b981' };
  if (score >= 60) return { key: 'bom', label: 'Bom', color: '#22c55e' };
  if (score >= 40) return { key: 'atencao', label: 'Atenção', color: '#f59e0b' };
  return { key: 'critico', label: 'Crítico', color: '#ef4444' };
}

const SEVERITY_WEIGHT = { critica: 4, alta: 3, media: 2, baixa: 1 };

function weightedScore(items) {
  const valid = items.filter((i) => i.score !== null && i.score !== undefined);
  if (!valid.length) return null;
  const totalWeight = valid.reduce((a, i) => a + (i.weight || 1), 0);
  const sum = valid.reduce((a, i) => a + i.score * (i.weight || 1), 0);
  return round(safeDiv(sum, totalWeight), 1);
}

// ---------- fábrica de alertas e recomendações ----------
let alertSeq = 0;
function alert(domainId, severity, title, detail, extra = {}) {
  alertSeq += 1;
  return {
    id: `${domainId}-a${alertSeq}`,
    domain: domainId,
    severity,
    weight: SEVERITY_WEIGHT[severity] || 1,
    title,
    detail,
    ...extra
  };
}

let recSeq = 0;
function recommendation(domainId, priority, title, why, steps, extra = {}) {
  recSeq += 1;
  return {
    id: `${domainId}-r${recSeq}`,
    domain: domainId,
    priority, // 1 = fazer agora, 2 = 30 dias, 3 = 90 dias
    horizon: priority === 1 ? '7 dias' : priority === 2 ? '30 dias' : '90 dias',
    title,
    why,
    steps,
    ...extra
  };
}

// ============================================================
// Análise por domínio
// ============================================================

function analyzeEmpresarial(m) {
  const insights = [];
  const alerts = [];
  const recs = [];
  const kpis = [];
  const scores = [];

  const rev = m.revenue;
  const prof = m.profitability;
  const conc = m.concentration;
  // Mês em andamento: compara-se o ritmo projetado com o mês anterior fechado,
  // para não gerar alerta falso de queda nos primeiros dias do mês.
  const partial = !!(m.pace && m.pace.isPartial);
  const pace = m.pace || { factor: 1, daysElapsed: 0, daysInMonth: 0 };
  const revRef = partial ? pace.revenue : rev.current;
  const revGrowth = partial ? pace.growth : rev.growth;
  const cogsRef = partial ? pace.cogs : prof.cogsMonth;
  const expRef = partial ? pace.expenses : m.expenses.current;
  const grossRef = Math.round((revRef - cogsRef) * 100) / 100;
  const grossMarginRef = revRef > 0 ? Math.round((grossRef / revRef) * 1000) / 10 : null;
  const resultRef = partial ? pace.result : prof.operatingResult;
  const marginRef = revRef > 0 ? Math.round((resultRef / revRef) * 1000) / 10 : null;
  const paceNote = partial
    ? ` (mês em andamento: ${pace.daysElapsed} de ${pace.daysInMonth} dias — projeção pelo ${pace.basis || 'ritmo do mês'})`
    : '';

  kpis.push(
    { label: partial ? `Receita em ${pace.daysElapsed} dias` : 'Receita do mês', value: brl(rev.current), trend: signal(revGrowth), tone: revGrowth >= 0 ? 'positive' : 'negative' },
    { label: partial ? 'Resultado projetado' : 'Resultado do mês', value: brl(resultRef), tone: resultRef >= 0 ? 'positive' : 'negative' },
    { label: 'Margem líquida', value: percent(marginRef), tone: marginRef >= 10 ? 'positive' : marginRef >= 0 ? 'neutral' : 'negative' },
    { label: 'Saldo de caixa', value: brl(m.cash.balance), tone: m.cash.balance >= 0 ? 'positive' : 'negative' },
    { label: 'Ponto de equilíbrio', value: prof.breakEvenRevenue ? brl(prof.breakEvenRevenue) : 'n/d', tone: prof.breakEvenGap >= 0 ? 'positive' : 'negative' }
  );
  if (partial) {
    kpis.push({ label: 'Ritmo projetado do mês', value: brl(revRef), trend: signal(revGrowth), tone: revGrowth >= 0 ? 'positive' : 'negative' });
  }

  // 1) Crescimento
  scores.push({ name: 'Crescimento da receita', weight: 2, score: revGrowth === 0 && revRef === 0 ? null : scoreUp(revGrowth, -15, 15) });
  if (rev.current > 0) {
    insights.push(
      revGrowth >= 10
        ? `A receita cresce em ritmo de ${signal(revGrowth)} frente ao mês anterior (${brl(rev.previous)} → ${brl(revRef)}${partial ? ' projetado' : ''}), um ritmo forte de expansão.${paceNote}`
        : revGrowth >= 0
          ? `A receita variou ${signal(revGrowth)} no mês (${brl(revRef)}${partial ? ' projetado' : ''}). Crescimento positivo, porém abaixo do ideal de 5% a 10% ao mês.${paceNote}`
          : `A receita cai em ritmo de ${signal(revGrowth)} no mês (${brl(rev.previous)} → ${brl(revRef)}${partial ? ' projetado' : ''}). Queda de faturamento exige ação comercial imediata.${paceNote}`
    );
    if (revGrowth < -10) {
      alerts.push(alert('empresarial', 'critica', 'Queda acentuada de receita', `A receita caiu ${percent(Math.abs(revGrowth))} em relação ao mês anterior (${brl(rev.previous)} → ${brl(revRef)}${partial ? ' no ritmo projetado' : ''}).${paceNote}`, { impact: brl(rev.previous - revRef), page: 'sales' }));
    } else if (revGrowth < 0) {
      alerts.push(alert('empresarial', 'alta', 'Receita em queda', `A receita recuou ${percent(Math.abs(revGrowth))} no mês${partial ? ' (ritmo projetado)' : ''}. Se a tendência se repetir, o resultado vira prejuízo.${paceNote}`, { impact: brl(rev.previous - revRef), page: 'sales' }));
    }
  }

  // 2) Rentabilidade
  scores.push({ name: 'Margem líquida', weight: 2.5, score: marginRef === null ? null : scoreUp(marginRef, -5, 20) });
  if (rev.current > 0) {
    insights.push(
      `DRE ${partial ? 'no ritmo do mês' : 'completo do mês'}: receita ${brl(revRef)} - CMV ${brl(cogsRef)} = lucro bruto ${brl(grossRef)} (${percent(grossMarginRef)}); menos despesas de ${brl(expRef)} = resultado operacional de ${brl(resultRef)} (margem líquida ${percent(marginRef)}).${paceNote}`
    );
    if (prof.cogsMonth > 0 && prof.simpleResult !== prof.operatingResult) {
      insights.push(
        `Atenção à leitura do Dashboard: ele mostra ${brl(prof.simpleResult)} (receita - despesas, sem baixar o custo da mercadoria vendida). O resultado que considera o CMV é ${brl(prof.operatingResult)}. Use o segundo para decidir.`
      );
    }
    if (marginRef !== null && marginRef < 0) {
      alerts.push(alert('empresarial', 'critica', 'Operação no prejuízo', `A empresa opera com resultado negativo de ${brl(Math.abs(resultRef))} no mês${partial ? ' (ritmo projetado)' : ''} e margem de ${percent(marginRef)}.${paceNote}`, { impact: brl(Math.abs(resultRef)), page: 'dre' }));
      recs.push(recommendation('empresarial', 1, 'Plano de emergência de resultado', partial ? 'O mês caminha para fechar no vermelho e cada mês nessa condição consome caixa.' : 'O mês fechou no vermelho e cada mês nessa condição consome caixa.', [
        `Congele novas compras não essenciais até o caixa cobrir ${brl(m.expenses.fixedAvgMonth)} (1 mês de despesas fixas).`,
        'Liste as 3 despesas de maior valor e renegocie ou corte nesta semana.',
        'Reprecifique os produtos com margem abaixo de 20% (menu Produtos).',
        'Antecipe recebíveis vencidos com a régua de cobrança (menu Contas a Receber).'
      ], { impact: `Recuperar ${brl(Math.abs(resultRef))} de resultado`, page: 'dre', effort: 'Alto' }));
    } else if (marginRef !== null && marginRef < 8) {
      alerts.push(alert('empresarial', 'media', 'Margem líquida baixa', `A margem líquida de ${percent(marginRef)} está abaixo da referência de 8% a 15% para comércio.${paceNote}`, { page: 'dre' }));
    }
  }

  // 3) Ponto de equilíbrio
  if (prof.breakEvenRevenue) {
    scores.push({ name: 'Folga sobre o ponto de equilíbrio', weight: 2, score: scoreUp(pct(revRef, prof.breakEvenRevenue) - 100, -20, 40) });
    const ratio = pct(revRef, prof.breakEvenRevenue);
    insights.push(
      prof.breakEvenGap >= 0
        ? `A empresa opera ${percent(ratio - 100)} acima do ponto de equilíbrio (${brl(prof.breakEvenRevenue)}), com folga de ${brl(prof.breakEvenGap)}${partial ? ' no ritmo projetado do mês' : ''}.`
        : `A receita ${partial ? 'projetada' : 'do mês'} de ${brl(revRef)} está ${brl(Math.abs(prof.breakEvenGap))} abaixo do ponto de equilíbrio de ${brl(prof.breakEvenRevenue)}: a operação não se paga neste mês.`
    );
    if (prof.breakEvenGap < 0) {
      alerts.push(alert('empresarial', 'critica', 'Abaixo do ponto de equilíbrio', `Faltam ${brl(Math.abs(prof.breakEvenGap))} de receita para cobrir as despesas fixas de ${brl(m.expenses.fixedAvgMonth)}.`, { impact: brl(Math.abs(prof.breakEvenGap)), page: 'dre' }));
    }
  }

  // 4) Concentração de risco
  scores.push({ name: 'Diversificação de receita', weight: 1.5, score: conc.top5SharePct ? scoreDown(conc.top5SharePct, 90, 35) : null });
  if (conc.top5SharePct >= 50) {
    const severity = conc.top5SharePct >= 70 ? 'alta' : 'media';
    alerts.push(alert('empresarial', severity, 'Receita concentrada em poucos clientes',
      `Os 5 maiores clientes respondem por ${percent(conc.top5SharePct)} de toda a receita${conc.topCustomerName ? ` — só ${conc.topCustomerName} representa ${percent(conc.topCustomerSharePct)}` : ''}. A referência segura é ficar abaixo de 40%.`,
      { page: 'customers' }));
    insights.push(`Concentração elevada: 5 clientes = ${percent(conc.top5SharePct)} da receita. Perder um deles derruba o resultado do mês.`);
  } else if (conc.top5SharePct > 0) {
    insights.push(`A concentração está saudável: os 5 maiores clientes respondem por ${percent(conc.top5SharePct)} da receita (referência: abaixo de 40%).`);
  }
  if (conc.topCustomerSharePct >= 30) {
    alerts.push(alert('empresarial', conc.topCustomerSharePct >= 50 ? 'alta' : 'media', 'Concentração de receita em poucos clientes',
      `${conc.topCustomerName || 'O maior cliente'} representa ${percent(conc.topCustomerSharePct)} da receita e os 5 maiores somam ${percent(conc.top5SharePct)}.`,
      { page: 'customers' }));
    recs.push(recommendation('empresarial', 3, 'Diversificar a carteira de clientes', `Depender de ${conc.topCustomerName || 'um único cliente'} para ${percent(conc.topCustomerSharePct)} da receita é risco estratégico.`, [
      'Defina um perfil de cliente ideal com base nos clientes A atuais.',
      'Meta comercial de novos clientes por mês (mínimo 3 no primeiro trimestre).',
      'Amplie o portfólio para vender mais linhas aos clientes médios.',
      'Acompanhe mensalmente a participação dos 5 maiores na receita.'
    ], { impact: 'Reduzir a concentração para abaixo de 40%', page: 'customers', effort: 'Médio' }));
  }
  if (conc.topSupplierSharePct >= 60) {
    alerts.push(alert('producao', 'media', 'Dependência de fornecedor único', `${conc.topSupplierName} concentra ${percent(conc.topSupplierSharePct)} das compras.`, { page: 'suppliers' }));
  }

  // 5) Liquidez / caixa
  const monthsOfCash = m.expenses.fixedAvgMonth > 0 ? round(safeDiv(m.cash.balance, m.expenses.fixedAvgMonth), 1) : null;
  scores.push({ name: 'Liquidez (meses de caixa)', weight: 2, score: monthsOfCash === null ? null : scoreUp(monthsOfCash, 0, 2) });
  if (monthsOfCash !== null) {
    insights.push(
      monthsOfCash >= 2
        ? `O caixa de ${brl(m.cash.balance)} cobre ${num(monthsOfCash, 1)} meses de despesas fixas — reserva confortável.`
        : `O caixa de ${brl(m.cash.balance)} cobre apenas ${num(monthsOfCash, 1)} mês(es) de despesas fixas (${brl(m.expenses.fixedAvgMonth)}/mês).`
    );
    if (monthsOfCash < 1) {
      alerts.push(alert('empresarial', monthsOfCash < 0.3 ? 'critica' : 'alta', 'Reserva de caixa insuficiente',
        `O saldo atual cobre ${num(monthsOfCash, 1)} mês(es) de despesas fixas. A referência mínima é de 2 a 3 meses (${brl(m.expenses.fixedAvgMonth * 2)}).`,
        { impact: brl(Math.max(0, m.expenses.fixedAvgMonth * 2 - m.cash.balance)), page: 'cashflow' }));
      recs.push(recommendation('financeiro', 1, 'Construir reserva de caixa', `Sem reserva, qualquer imprevisto vira empréstimo caro ou atraso de fornecedor.`, [
        'Projete o caixa dos próximos 90 dias e marque as semanas negativas.',
        'Priorize a cobrança dos vencidos antes de qualquer nova despesa.',
        'Destine 10% do lucro de cada mês para uma conta separada.',
        'Renegocie prazos com fornecedores para alongar o DPO.'
      ], { impact: `Meta: ${brl(m.expenses.fixedAvgMonth * 2)} em reserva`, page: 'cashflow', effort: 'Médio' }));
    }
  }

  // 6) Qualidade da informação (governança)
  const issues = m.operations.catalogIssues;
  const totalIssues = Object.values(issues).reduce((a, b) => a + b, 0);
  scores.push({ name: 'Qualidade dos dados', weight: 1, score: scoreDown(totalIssues, 15, 0) });
  if (totalIssues >= 5) {
    const details = [
      issues.withoutCategory ? `${countPhrase(issues.withoutCategory, 'produto', 'produtos')} sem categoria` : null,
      issues.withoutCost ? `${countPhrase(issues.withoutCost, 'produto', 'produtos')} sem custo cadastrado` : null,
      issues.withoutMinStock ? `${countPhrase(issues.withoutMinStock, 'produto', 'produtos')} sem estoque mínimo` : null,
      issues.customersWithoutEmail ? `${countPhrase(issues.customersWithoutEmail, 'cliente', 'clientes')} sem e-mail` : null,
      issues.salesWithoutCustomer ? `${countPhrase(issues.salesWithoutCustomer, 'venda', 'vendas')} sem cliente vinculado` : null
    ].filter(Boolean).join('; ');
    alerts.push(alert('empresarial', 'baixa', 'Falhas de cadastro comprometem os indicadores', details, { page: 'products' }));
    recs.push(recommendation('empresarial', 2, 'Higienizar a base de cadastros', 'Indicador errado leva a decisão errada: os cadastros incompletos distorcem margem, giro e análises de cliente.', [
      'Complete categoria, custo e estoque mínimo dos produtos.',
      'Vincule cliente em todas as vendas (venda sem cliente não entra na análise de recompra).',
      'Atualize e-mail e telefone dos clientes A.',
      'Faça uma revisão de cadastros por mês (30 minutos).'
    ], { impact: 'Indicadores confiáveis', page: 'products', effort: 'Baixo' }));
  }

  if (!m.hasData) {
    alerts.push(alert('empresarial', 'media', 'Sem dados suficientes para diagnosticar', 'Ainda não há vendas, produtos ou clientes cadastrados para esta empresa.', { page: 'dashboard' }));
    recs.push(recommendation('empresarial', 1, 'Implantar a base do ERP', 'Sem dados, nenhuma gestão por indicadores é possível.', [
      'Cadastre os produtos com custo, preço, estoque e estoque mínimo.',
      'Cadastre clientes e fornecedores.',
      'Registre as vendas do mês atual e as despesas por categoria.',
      'Rode o diagnóstico novamente após 30 dias de operação registrada.'
    ], { impact: 'Base para todas as análises', page: 'products', effort: 'Médio' }));
  }

  const score = weightedScore(scores);
  return {
    id: 'empresarial',
    score,
    level: levelOf(score),
    kpis,
    insights,
    alerts,
    recommendations: recs,
    scoreBreakdown: scores.filter((s) => s.score !== null)
  };
}

function analyzeProducao(m) {
  const insights = [];
  const alerts = [];
  const recs = [];
  const kpis = [];
  const scores = [];

  const products = m.products.list.filter((p) => p.dailyDemand > 0);
  const capacity = products.length
    ? pct(products.filter((p) => p.coverageDays !== null && p.coverageDays >= 15).length, products.length)
    : null;
  const bottlenecks = products
    .filter((p) => p.coverageDays === null || p.coverageDays < 10)
    .sort((a, b) => b.dailyDemand * b.price - a.dailyDemand * a.price)
    .slice(0, 5);
  const negativeMargin = m.products.list.filter((p) => p.negativeMargin);
  const costDrift = m.purchases.costDrift;
  const issues = m.operations.catalogIssues;

  kpis.push(
    { label: 'Capacidade de atendimento', value: capacity === null ? 'n/d' : percent(capacity), tone: capacity === null ? 'neutral' : capacity >= 90 ? 'positive' : capacity >= 70 ? 'neutral' : 'negative' },
    { label: 'Gargalos ativos', value: num(bottlenecks.length), tone: bottlenecks.length === 0 ? 'positive' : 'negative' },
    { label: 'Ciclo financeiro', value: m.operations.cashCycle !== null ? `${num(m.operations.cashCycle)} dias` : 'n/d', tone: m.operations.cashCycle !== null && m.operations.cashCycle <= 30 ? 'positive' : 'neutral' },
    { label: 'Variações de custo', value: num(costDrift.length), tone: costDrift.length === 0 ? 'positive' : 'negative' },
    { label: 'Produtividade', value: m.products.total ? brl(safeDiv(m.revenue.current, m.products.total)) : brl(0), tone: 'neutral' }
  );

  // Capacidade
  scores.push({ name: 'Capacidade de atendimento', weight: 2.5, score: capacity === null ? null : scoreUp(capacity, 40, 95) });
  if (capacity !== null) {
    insights.push(
      capacity >= 90
        ? `${percent(capacity)} dos itens com demanda têm cobertura de estoque suficiente (15+ dias): a operação responde à demanda atual.`
        : `Apenas ${percent(capacity)} dos itens com demanda têm cobertura adequada. ${countPhrase(bottlenecks.length, 'item está', 'itens estão')} em situação de gargalo.`
    );
  }

  // Gargalos
  if (bottlenecks.length) {
    const names = bottlenecks.map((b) => `${b.name} (${b.coverageDays === null ? 'sem cobertura' : `${b.coverageDays} dias`}, demanda ${num(b.dailyDemand * 30)}/mês)`).join(', ');
    alerts.push(alert('producao', bottlenecks.length >= 3 ? 'alta' : 'media', 'Gargalos identificados na operação', `Itens com alta demanda e cobertura insuficiente: ${names}.`, { impact: brl(bottlenecks.reduce((a, b) => a + b.dailyDemand * 30 * b.price, 0)), page: 'products' }));
    insights.push(`Pela Teoria das Restrições, o gargalo atual é ${bottlenecks[0].name}: maior demanda (${num(bottlenecks[0].dailyDemand * 30, 1)} un/mês) com ${bottlenecks[0].stockout ? 'estoque zerado' : `cobertura de ${bottlenecks[0].coverageDays} dias`}.`);
    recs.push(recommendation('producao', 1, 'Atacar o gargalo principal', `Melhorar etapas que não são gargalo não aumenta a entrega. O item crítico é ${bottlenecks[0].name}.`, [
      `Calcule a necessidade: demanda diária ${num(bottlenecks[0].dailyDemand, 2)} × lead time + estoque de segurança.`,
      'Emita o pedido de compra do item gargalo ainda hoje (menu Compras).',
      'Homologue um segundo fornecedor para reduzir o risco de desabastecimento.',
      'Reveja o estoque mínimo desse item com base na demanda dos últimos 90 dias.'
    ], { impact: `Evitar perda estimada de ${brl(bottlenecks[0].dailyDemand * 30 * bottlenecks[0].price)}/mês`, page: 'purchases', effort: 'Médio' }));
  } else if (products.length) {
    insights.push('Nenhum gargalo crítico detectado: todos os itens com demanda têm cobertura acima de 10 dias.');
  }

  // Ciclo financeiro
  if (m.operations.cashCycle !== null) {
    scores.push({ name: 'Ciclo financeiro', weight: 2, score: scoreDown(m.operations.cashCycle, 120, 0) });
    insights.push(
      `Ciclo financeiro de ${num(m.operations.cashCycle)} dias (DSO ${num(m.operations.dso)} + estoque ${num(m.operations.inventoryDays)} - DPO ${num(m.operations.dpo)}). ` +
      (m.operations.cashCycle <= 0
        ? 'Excelente: a empresa recebe antes de pagar, operando com caixa de terceiros.'
        : m.operations.cashCycle <= 30
          ? 'Dentro de um patamar saudável para o porte da operação.'
          : `Cada dia de ciclo consome capital de giro — hoje são ${brl(safeDiv(m.revenue.current, 30) * m.operations.cashCycle)} presos na operação.`)
    );
    if (m.operations.cashCycle > 60) {
      alerts.push(alert('producao', 'media', 'Ciclo financeiro longo', `São ${num(m.operations.cashCycle)} dias entre o desembolso e o recebimento, exigindo ${brl(safeDiv(m.revenue.current, 30) * m.operations.cashCycle)} de capital de giro.`, { page: 'cashflow' }));
    }
  }

  // Variação de custo de compra
  scores.push({ name: 'Estabilidade de custos', weight: 1.5, score: costDrift.length ? scoreDown(costDrift.length, 5, 0) : 100 });
  if (costDrift.length) {
    const worst = [...costDrift].sort((a, b) => Math.abs(b.driftPct) - Math.abs(a.driftPct))[0];
    const totalImpact = round(costDrift.reduce((a, c) => a + Math.max(0, c.stockImpact), 0));
    insights.push(`${countPhrase(costDrift.length, 'produto', 'produtos')} têm custo da última compra diferente do custo cadastrado (variação ≥ 5%). O maior desvio é ${worst.name}: ${signal(worst.driftPct)} (cadastro ${brl2(worst.registeredCost)} x compra ${brl2(worst.lastPurchaseCost)}).`);
    alerts.push(alert('producao', Math.abs(worst.driftPct) >= 15 ? 'alta' : 'media', 'Custo de compra desatualizado',
      `O custo cadastrado não reflete a última compra em ${countPhrase(costDrift.length, 'item', 'itens')}. A margem exibida no sistema está errada e o preço pode estar defasado.`,
      { impact: totalImpact ? brl(totalImpact) : undefined, page: 'products' }));
    recs.push(recommendation('producao', 2, 'Atualizar custos e reprecificar', 'Preço calculado sobre custo antigo é a forma mais comum de perder margem sem perceber.', [
      'Atualize o custo dos itens com desvio (menu Produtos).',
      `Reprecifique ${worst.name} para manter a margem alvo: preço = custo ÷ (1 - margem - impostos - comissão).`,
      'Cote com pelo menos 3 fornecedores os itens de maior desvio.',
      'Institua a conferência de custo x última compra a cada entrada de mercadoria.'
    ], { impact: totalImpact ? `Proteger ${brl(totalImpact)} de margem` : 'Proteger a margem real', page: 'products', effort: 'Baixo' }));
  }

  // Margem negativa (perda por unidade vendida)
  if (negativeMargin.length) {
    scores.push({ name: 'Itens sem margem', weight: 2, score: scoreDown(negativeMargin.length, 5, 0) });
    alerts.push(alert('producao', 'critica', 'Produtos vendidos com prejuízo',
      `${countPhrase(negativeMargin.length, 'produto', 'produtos')} têm custo maior ou igual ao preço de venda: ${negativeMargin.slice(0, 4).map((p) => `${p.name} (custo ${brl2(p.cost)} / preço ${brl2(p.price)})`).join('; ')}.`,
      { impact: brl(negativeMargin.reduce((a, p) => a + (p.cost - p.price) * p.units90, 0)), page: 'products' }));
    recs.push(recommendation('producao', 1, 'Corrigir preços com margem negativa', 'Cada venda desses itens aumenta o prejuízo — quanto mais vende, mais perde.', [
      'Recalcule o preço com a fórmula: custo ÷ (1 - margem alvo - impostos - comissão).',
      'Se o mercado não aceita o preço, renegocie o custo com o fornecedor.',
      'Sem alternativa viável, descontinue o item e libere o capital.',
      'Bloqueie a venda até a correção para estancar a perda.'
    ], { impact: brl(negativeMargin.reduce((a, p) => a + (p.cost - p.price) * p.units90, 0)) + ' de perda evitada/90 dias', page: 'products', effort: 'Baixo' }));
  } else {
    scores.push({ name: 'Itens sem margem', weight: 2, score: 100 });
  }

  // Padronização de processos (proxy pela qualidade cadastral + recorrência)
  const processScore = scoreDown(
    issues.withoutCategory + issues.withoutMinStock + issues.withoutCost + issues.withoutSku,
    20, 0
  );
  scores.push({ name: 'Padronização de processos', weight: 1, score: processScore });
  if (issues.withoutMinStock > 0) {
    insights.push(`${countPhrase(issues.withoutMinStock, 'produto', 'produtos')} sem estoque mínimo definido: o processo de reposição fica manual e sujeito a esquecimento.`);
  }
  if (issues.withoutCategory + issues.withoutSku > 0) {
    recs.push(recommendation('producao', 3, 'Padronizar cadastros e rotinas operacionais', 'Processo padronizado reduz erro, dependência de pessoas e tempo de execução.', [
      'Defina categoria, SKU e unidade padrão para todos os itens.',
      'Escreva o POP de recebimento, armazenagem e expedição em uma página cada.',
      'Estabeleça a rotina diária de conferência de rupturas e pedidos pendentes.',
      'Adote um ciclo PDCA mensal para um indicador de processo.'
    ], { impact: 'Menos retrabalho e menos erro de expedição', page: 'products', effort: 'Médio' }));
  }

  if (!products.length && m.hasData) {
    insights.push('Não há demanda registrada nos últimos 90 dias para calcular capacidade e gargalos — registre as vendas para ativar esta análise.');
  }

  const score = weightedScore(scores);
  return { id: 'producao', score, level: levelOf(score), kpis, insights, alerts, recommendations: recs, scoreBreakdown: scores.filter((s) => s.score !== null) };
}

function analyzeComercial(m) {
  const insights = [];
  const alerts = [];
  const recs = [];
  const kpis = [];
  const scores = [];

  const c = m.customers;
  const rev = m.revenue;
  const mk = m.marketing;

  kpis.push(
    { label: 'Receita do mês', value: brl(rev.current), trend: signal(rev.growth), tone: rev.growth >= 0 ? 'positive' : 'negative' },
    { label: 'Ticket médio', value: brl2(rev.averageTicket), tone: 'neutral' },
    { label: 'Clientes ativos (90d)', value: `${num(c.active)} de ${num(c.total)}`, tone: c.total ? pct(c.active, c.total) >= 60 ? 'positive' : 'negative' : 'neutral' },
    { label: 'Taxa de recompra', value: percent(c.repeatRatePct), tone: c.repeatRatePct >= 30 ? 'positive' : 'neutral' },
    { label: 'Novos clientes (12m)', value: num(c.newTotal), tone: c.newTotal > 0 ? 'positive' : 'negative' }
  );

  // Ticket médio / volume
  if (rev.salesCount > 0) {
    const partialMonth = !!(m.pace && m.pace.isPartial);
    const salesCountRef = partialMonth ? m.pace.salesCount : rev.salesCount;
    insights.push(`${countPhrase(rev.salesCount, 'venda', 'vendas')}${partialMonth ? ` nos primeiros ${m.pace.daysElapsed} dias do mês (projeção de ${countPhrase(salesCountRef, 'venda', 'vendas')} no mês fechado pelo ${m.pace.basis || 'ritmo do mês'})` : ' no mês'} com ticket médio de ${brl2(rev.averageTicket)} e ${num(rev.avgItemsPerSale, 1)} ${pl(rev.avgItemsPerSale >= 1.5 ? 2 : 1, 'item', 'itens')} por pedido.`);
    scores.push({ name: 'Volume de vendas', weight: 1.5, score: scoreUp(salesCountRef, 1, 60) });
  }

  // Ativação da carteira
  const activePct = c.total ? pct(c.active, c.total) : null;
  scores.push({ name: 'Carteira ativa', weight: 2.5, score: activePct === null ? null : scoreUp(activePct, 10, 70) });
  if (c.total > 0) {
    insights.push(`Da carteira de ${countPhrase(c.total, 'cliente', 'clientes')}, ${num(c.active)} ${pl(c.active, 'comprou', 'compraram')} nos últimos 90 dias (${percent(activePct)}), ${num(c.inactive)} ${pl(c.inactive, 'está inativo', 'estão inativos')} e ${num(c.neverBought)} nunca ${pl(c.neverBought, 'comprou', 'compraram')}.`);
    if (c.inactive > 0) {
      const lostRevenue = round(c.inactiveList.reduce((a, x) => a + x.revenue, 0));
      alerts.push(alert('comercial', c.inactive >= 3 ? 'alta' : 'media', `${countPhrase(countPhrase(c.inactive, 'cliente', 'clientes'), 'inativo', 'inativos')} há mais de 90 dias`,
        `Esses clientes já geraram ${brl(lostRevenue)} em receita. Reativar custa 5 a 7 vezes menos do que conquistar um novo. Principais: ${c.inactiveList.slice(0, 3).map((x) => `${x.name} (${x.daysSince} dias)`).join(', ')}.`,
        { impact: brl(lostRevenue), page: 'customers' }));
      recs.push(recommendation('comercial', 1, 'Blitz de reativação da carteira', `${num(c.inactive)} clientes parados representam receita imediata recuperável.`, [
        'Ordene os inativos por receita histórica e ligue para os 10 maiores nesta semana.',
        'Ofereça condição específica de retorno (produto que ele costuma comprar + prazo).',
        'Registre o motivo da pausa no cadastro do cliente.',
        'Meça em 30 dias quantos voltaram a comprar.'
      ], { impact: `Recuperar até ${brl(Math.round(lostRevenue * 0.2))} (20% da base inativa)`, page: 'customers', effort: 'Baixo' }));
    }
    if (c.neverBought > 0) {
      insights.push(`${countPhrase(num(c.neverBought), 'cliente', 'clientes')} cadastrados nunca compraram — base pronta para prospecção ativa.`);
    }
  }

  // Recompra / retenção
  scores.push({ name: 'Recompra', weight: 2, score: scoreUp(c.repeatRatePct, 0, 45) });
  if (c.withSales > 0) {
    insights.push(
      c.repeatRatePct >= 30
        ? `${percent(c.repeatRatePct)} dos clientes que já compraram voltaram a comprar — boa fidelização da carteira.`
        : `Apenas ${percent(c.repeatRatePct)} dos clientes compram mais de uma vez: há espaço grande para relacionamento e pós-venda.`
    );
    if (c.repeatRatePct < 20 && c.withSales >= 3) {
      alerts.push(alert('comercial', 'media', 'Baixa taxa de recompra', `Só ${percent(c.repeatRatePct)} dos clientes voltam a comprar. Sem recorrência, todo mês começa do zero.`, { page: 'customers' }));
      recs.push(recommendation('comercial', 2, 'Criar recorrência na carteira', 'Recompra baixa significa que a empresa depende permanentemente de aquisição nova, que é mais cara.', [
        'Identifique os produtos de compra recorrente e crie oferta de reposição programada.',
        'Implante pós-venda em D+7 (satisfação) e D+30 (nova oferta).',
        'Ofereça condição diferenciada para clientes A (prazo, frete, prioridade).',
        'Acompanhe a taxa de recompra mensalmente.'
      ], { impact: 'Elevar a recompra para 30%+', page: 'customers', effort: 'Médio' }));
    }
  }

  // Descontos
  scores.push({ name: 'Controle de desconto', weight: 1, score: mk.discountSharePct ? scoreDown(mk.discountSharePct, 15, 2) : 100 });
  if (mk.discountTotal > 0) {
    insights.push(`Foram concedidos ${brl(mk.discountTotal)} em descontos (${percent(mk.discountSharePct)} do valor cheio), em ${percent(mk.salesWithDiscountPct)} das vendas.`);
    if (mk.discountSharePct > 8) {
      alerts.push(alert('comercial', 'alta', 'Descontos comprimindo a margem', `${percent(mk.discountSharePct)} do valor das vendas foi dado em desconto (${brl(mk.discountTotal)}). Cada 5% de desconto exige ~20% mais volume para manter o lucro.`, { impact: brl(mk.discountTotal), page: 'sales' }));
      recs.push(recommendation('comercial', 2, 'Definir política e alçada de desconto', 'Desconto sem regra vira hábito e destrói margem silenciosamente.', [
        'Defina a alçada por vendedor (ex.: até 5% sem aprovação).',
        'Troque desconto por condição (volume, prazo menor, pagamento à vista).',
        'Publique a tabela de preço mínimo por produto.',
        'Revise mensalmente o desconto médio por vendedor/canal.'
      ], { impact: `Recuperar até ${brl(mk.discountTotal * 0.4)} de margem`, page: 'sales', effort: 'Baixo' }));
    }
  }

  // Curva ABC
  if (c.abc.A.count > 0) {
    insights.push(`Curva ABC de clientes: ${countPhrase(num(c.abc.A.count), 'cliente', 'clientes')} classe A concentram ${brl(c.abc.A.value)} (${percent(m.concentration.top5SharePct)} nos 5 maiores); classe B ${num(c.abc.B.count)} e classe C ${num(c.abc.C.count)}.`);
  }
  const topProducts = m.products.top.slice(0, 3);
  if (topProducts.length) {
    insights.push(`Produtos que mais vendem: ${topProducts.map((p) => `${p.name} (${brl(p.totalRevenue)})`).join(', ')}.`);
  }

  // Produtos sem venda
  const noSaleProducts = m.products.list.filter((p) => p.totalUnits === 0);
  if (noSaleProducts.length && m.products.total > 0) {
    scores.push({ name: 'Portfólio vendável', weight: 1, score: scoreDown(pct(noSaleProducts.length, m.products.total), 60, 5) });
    alerts.push(alert('comercial', noSaleProducts.length >= 3 ? 'media' : 'baixa', 'Produtos sem nenhuma venda registrada',
      `${countPhrase(noSaleProducts.length, 'item', 'itens')} do portfólio nunca venderam: ${noSaleProducts.slice(0, 4).map((p) => p.name).join(', ')}.`,
      { impact: brl(noSaleProducts.reduce((a, p) => a + p.stockValueCost, 0)), page: 'products' }));
  } else {
    scores.push({ name: 'Portfólio vendável', weight: 1, score: m.products.total ? 100 : null });
  }

  // Meta / crescimento
  scores.push({ name: 'Crescimento de receita', weight: 2, score: rev.growth === 0 && rev.current === 0 ? null : scoreUp(rev.growth, -15, 15) });
  if (rev.current > 0) {
    const nextTarget = round(rev.current * 1.1);
    recs.push(recommendation('comercial', 3, 'Definir e acompanhar meta comercial', 'Sem meta, o time comercial reage ao acaso e a receita oscila.', [
      `Defina a meta do próximo mês: ${brl(nextTarget)} (10% acima de ${brl(rev.current)}).`,
      `Quebre em vendas: ${Math.ceil(safeDiv(nextTarget, rev.averageTicket || 1))} pedidos com ticket médio de ${brl2(rev.averageTicket)}.`,
      'Divida a meta entre canais/vendedores e revise semanalmente.',
      'Registre as oportunidades em aberto para projetar o fechamento.'
    ], { impact: `Meta: ${brl(nextTarget)}/mês`, page: 'sales', effort: 'Baixo' }));
  }

  const score = weightedScore(scores);
  return { id: 'comercial', score, level: levelOf(score), kpis, insights, alerts, recommendations: recs, scoreBreakdown: scores.filter((s) => s.score !== null) };
}

function analyzeMarketing(m) {
  const insights = [];
  const alerts = [];
  const recs = [];
  const kpis = [];
  const scores = [];

  const mk = m.marketing;
  const c = m.customers;
  const portfolio = mk.portfolio;

  kpis.push(
    { label: 'Novos clientes (12m)', value: num(mk.newCustomers), tone: mk.newCustomers > 0 ? 'positive' : 'negative' },
    { label: 'CAC estimado', value: mk.cac !== null ? brl2(mk.cac) : 'n/d', tone: mk.cac === null ? 'neutral' : mk.ltvCac && mk.ltvCac >= 3 ? 'positive' : 'neutral' },
    { label: 'LTV estimado', value: mk.ltv ? brl2(mk.ltv) : 'n/d', tone: 'neutral' },
    { label: 'LTV / CAC', value: mk.ltvCac !== null ? num(mk.ltvCac, 2) : 'n/d', tone: mk.ltvCac === null ? 'neutral' : mk.ltvCac >= 3 ? 'positive' : mk.ltvCac >= 1 ? 'neutral' : 'negative' },
    { label: 'Investimento em marketing', value: brl(mk.spendTotal), tone: 'neutral' }
  );

  // CAC / LTV
  if (mk.cac !== null && mk.ltv) {
    scores.push({ name: 'Eficiência de aquisição (LTV/CAC)', weight: 2.5, score: scoreUp(mk.ltvCac || 0, 0.5, 4) });
    insights.push(`CAC estimado de ${brl2(mk.cac)} contra LTV de ${brl2(mk.ltv)} — relação LTV/CAC de ${num(mk.ltvCac, 2)}. ` + (mk.ltvCac >= 3 ? 'Acima de 3, o marketing se paga com folga e vale escalar.' : mk.ltvCac >= 1 ? 'Entre 1 e 3 o retorno existe, mas é apertado: melhore retenção ou reduza o CAC.' : 'Abaixo de 1, a empresa gasta mais para conquistar o cliente do que lucra com ele.'));
    if (mk.ltvCac < 1) {
      alerts.push(alert('marketing', 'alta', 'LTV/CAC abaixo de 1', `Cada cliente adquirido custa ${brl2(mk.cac)} e gera ${brl2(mk.ltv)} de lucro ao longo do relacionamento.`, { impact: brl(Math.max(0, mk.cac - mk.ltv) * mk.newCustomers), page: 'expenses' }));
    }
  } else if (mk.spendTotal === 0) {
    scores.push({ name: 'Eficiência de aquisição (LTV/CAC)', weight: 2.5, score: null });
    insights.push('Não há despesas lançadas na categoria "Marketing", então o CAC não pode ser calculado. Sem essa medida, toda decisão de mídia é achismo.');
    alerts.push(alert('marketing', mk.newCustomers > 0 ? 'media' : 'baixa', 'Investimento em marketing não mensurado', `A empresa conquistou ${countPhrase(num(mk.newCustomers), 'cliente', 'clientes')} no período sem nenhum gasto de marketing registrado — ou o gasto não está sendo lançado no ERP.`, { page: 'expenses' }));
    recs.push(recommendation('marketing', 2, 'Passar a medir CAC e LTV', 'O que não é medido não é gerenciado: sem CAC, não há como decidir onde investir.', [
      'Lance todo gasto de mídia, panfleto, tráfego e comissão como despesa categoria "Marketing" (canal na descrição).',
      'Ao fim do mês: CAC = gasto de marketing ÷ novos clientes.',
      'Calcule o LTV da carteira e acompanhe a relação LTV/CAC (meta > 3).',
      'Corte canais com LTV/CAC < 1 e escale os melhores.'
    ], { impact: 'Decisão de mídia baseada em número', page: 'expenses', effort: 'Baixo' }));
  }

  // Retenção
  scores.push({ name: 'Retenção da carteira', weight: 2, score: scoreUp(mk.retentionPct, 0, 45) });
  if (c.withSales > 0) {
    insights.push(`Retenção de ${percent(mk.retentionPct)}: ${countPhrase(c.repeatCount, 'cliente', 'clientes')} na carteira compraram mais de uma vez.`);
  }

  // Sazonalidade
  scores.push({ name: 'Previsibilidade de demanda', weight: 1.5, score: scoreDown(mk.seasonalityCv, 60, 12) });
  if (mk.seasonalityCv > 0) {
    insights.push(`A receita mensal oscila com coeficiente de variação de ${percent(mk.seasonalityCv)}` + (mk.peakMonth ? `, com pico em ${mk.peakMonth.label} (${brl(mk.peakMonth.revenue)})` : '') + (mk.lowMonth ? ` e vale em ${mk.lowMonth.label} (${brl(mk.lowMonth.revenue)})` : '') + '.');
    if (mk.seasonalityCv >= 35) {
      alerts.push(alert('marketing', 'media', 'Forte sazonalidade na receita', `Oscilação de ${percent(mk.seasonalityCv)} entre os meses exige plano de caixa e estoque para o pico e campanha de estímulo no vale.`, { page: 'dashboard' }));
      recs.push(recommendation('marketing', 2, 'Construir calendário sazonal', 'Sazonalidade não gerenciada vira ruptura no pico e caixa apertado no vale.', [
        mk.peakMonth ? `Prepare estoque e caixa 60 dias antes de ${mk.peakMonth.label} (melhor mês: ${brl(mk.peakMonth.revenue)}).` : 'Identifique o mês de pico na série de receita.',
        mk.lowMonth ? `Crie campanha específica para ${mk.lowMonth.label}, o mês mais fraco (${brl(mk.lowMonth.revenue)}).` : 'Defina campanha para o mês mais fraco.',
        'Antecipe promoções de mix em vez de desconto puro.',
        'Registre previsto x realizado de cada campanha.'
      ], { impact: 'Suavizar a oscilação e capturar o pico', page: 'dashboard', effort: 'Médio' }));
    }
  }

  // Portfólio BCG
  const stars = portfolio.estrela.length;
  const dogs = portfolio.abacaxi.length;
  scores.push({ name: 'Saúde do portfólio', weight: 1.5, score: m.products.total ? scoreUp(pct(stars, m.products.total), 0, 30) : null });
  if (m.products.total) {
    insights.push(`Matriz BCG do portfólio: ${countPhrase(stars, 'estrela', 'estrelas')}, ${countPhrase(portfolio.vaca.length, 'vaca', 'vacas')}, ${countPhrase(portfolio.interrogacao.length, 'interrogação', 'interrogações')} e ${countPhrase(dogs, 'abacaxi', 'abacaxis')}.`);
    if (stars === 0) {
      alerts.push(alert('marketing', 'media', 'Nenhum produto estrela no portfólio', 'Sem item de alta participação e alto giro, não há âncora para as campanhas de marketing.', { page: 'products' }));
    }
    if (dogs >= 3) {
      const dogValue = round(portfolio.abacaxi.reduce((a, p) => {
        const prod = m.products.list.find((x) => x.id === p.id);
        return a + (prod ? prod.stockValueCost : 0);
      }, 0));
      alerts.push(alert('marketing', 'baixa', `${dogs} produtos "abacaxi" ocupando capital`, `Baixa participação e baixo giro, com ${brl(dogValue)} parados em estoque.`, { impact: brl(dogValue), page: 'products' }));
      recs.push(recommendation('marketing', 3, 'Reposicionar ou liquidar os abacaxis', 'Portfólio inchado dilui o esforço de venda e trava capital.', [
        'Liste os produtos sem venda há 90 dias com estoque.',
        'Classifique: preço errado, fim de linha ou falta de divulgação.',
        'Liquide em kit com produto estrela ou faça campanha de saída.',
        'Reinvista o capital liberado nos itens de maior giro.'
      ], { impact: `Liberar até ${brl(dogValue)}`, page: 'products', effort: 'Médio' }));
    }
    if (stars > 0) {
      recs.push(recommendation('marketing', 3, 'Escalar os produtos estrela', `${portfolio.estrela.map((p) => p.name).slice(0, 3).join(', ')} têm participação e giro altos — são a melhor aposta de mídia.`, [
        'Concentre o orçamento de divulgação nos produtos estrela.',
        'Garanta estoque reforçado desses itens (nunca deixe romper).',
        'Crie conteúdo e prova social em torno deles.',
        'Use-os como isca em kits para elevar o ticket médio.'
      ], { impact: 'Acelerar a receita com o que já vende bem', page: 'sales', effort: 'Baixo' }));
    }
  }

  // Mix de canais/pagamento (leitura de comportamento)
  if (mk.paymentMethods.length) {
    insights.push(`Formas de pagamento: ${mk.paymentMethods.slice(0, 3).map((p) => `${p.method} (${percent(pct(p.total, m.revenue.total))})`).join(', ')}.`);
  }

  const score = weightedScore(scores);
  return { id: 'marketing', score, level: levelOf(score), kpis, insights, alerts, recommendations: recs, scoreBreakdown: scores.filter((s) => s.score !== null) };
}

function analyzeFinanceiro(m) {
  const insights = [];
  const alerts = [];
  const recs = [];
  const kpis = [];
  const scores = [];

  const f = m.receivable;
  const p = m.payable;
  const cash = m.cash;
  const exp = m.expenses;
  const prof = m.profitability;
  const partial = !!(m.pace && m.pace.isPartial);
  const pace = m.pace || { factor: 1, daysElapsed: 0, daysInMonth: 0 };
  const grow = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);
  const paceNote = partial ? ` (mês em andamento: ${pace.daysElapsed} de ${pace.daysInMonth} dias — leitura pelo ritmo projetado)` : '';
  const revRef = partial ? pace.revenue : m.revenue.current;
  const revGrowth = partial ? pace.growth : m.revenue.growth;
  const expRef = partial ? pace.expenses : exp.current;
  const expVariation = partial ? grow(expRef, exp.previous) : exp.variation;
  const expShareRef = revRef > 0 ? Math.round((expRef / revRef) * 1000) / 10 : exp.revenueSharePct;
  const cogsRef = partial ? pace.cogs : prof.cogsMonth;
  const grossMarginRef = revRef > 0 ? Math.round(((revRef - cogsRef) / revRef) * 1000) / 10 : prof.grossMarginPct;
  const resultRef = partial ? pace.result : prof.operatingResult;
  const marginRef = revRef > 0 ? Math.round((resultRef / revRef) * 1000) / 10 : prof.netMarginPct;

  const liquidityRatio = safeDiv(cash.balance + f.total, p.total || 1);
  const overduePct = f.overduePct;

  kpis.push(
    { label: 'Saldo de caixa', value: brl(cash.balance), tone: cash.balance > 0 ? 'positive' : 'negative' },
    { label: 'A receber (em aberto)', value: brl(f.total), tone: 'neutral' },
    { label: 'Vencidos a receber', value: brl(f.overdueTotal), tone: f.overdueTotal > 0 ? 'negative' : 'positive' },
    { label: 'A pagar (em aberto)', value: brl(p.total), tone: 'neutral' },
    { label: 'Inadimplência', value: percent(overduePct), tone: overduePct <= 5 ? 'positive' : overduePct <= 10 ? 'neutral' : 'negative' }
  );

  // Liquidez
  scores.push({ name: 'Liquidez imediata', weight: 2.5, score: p.total > 0 ? scoreUp(liquidityRatio, 0.5, 2) : (cash.balance > 0 ? 80 : 40) });
  insights.push(`Disponibilidade (caixa + recebíveis) de ${brl(cash.balance + f.total)} contra obrigações de ${brl(p.total)} — liquidez de ${num(liquidityRatio, 2)}x.`);
  if (p.total > 0 && liquidityRatio < 1) {
    alerts.push(alert('financeiro', 'critica', 'Obrigações maiores que a disponibilidade', `Caixa de ${brl(cash.balance)} + recebíveis de ${brl(f.total)} não cobrem os ${brl(p.total)} a pagar.`, { impact: brl(p.total - cash.balance - f.total), page: 'payable' }));
    recs.push(recommendation('financeiro', 1, 'Plano de liquidez imediata', 'Sem ação, a empresa entra em atraso com fornecedores ou fica sem caixa para operar.', [
      `Cobre hoje os ${brl(f.overdueTotal)} vencidos a receber (${countPhrase(f.overdueCount, 'título', 'títulos')}).`,
      `Priorize os pagamentos essenciais dos próximos 7 dias (${brl(p.dueNext7)}).`,
      'Negocie prorrogação com os fornecedores não críticos.',
      'Suspenda compras não essenciais até restabelecer a liquidez.'
    ], { impact: brl(Math.max(0, f.overdueTotal)), page: 'receivable', effort: 'Alto' }));
  }

  // Inadimplência
  scores.push({ name: 'Inadimplência', weight: 2.5, score: f.total > 0 ? scoreDown(overduePct, 25, 2) : null });
  if (f.overdueTotal > 0) {
    const worst = f.items.filter((i) => i.overdueDays > 0).sort((a, b) => b.overdueDays - a.overdueDays)[0];
    insights.push(`${brl(f.overdueTotal)} vencidos (${percent(overduePct)} da carteira a receber) em ${countPhrase(f.overdueCount, 'título', 'títulos')}` + (worst ? `, o mais antigo com ${worst.overdueDays} dias de atraso (${worst.customer})` : '') + '.');
    const severity = overduePct >= 15 || f.items.some((i) => i.overdueDays > 60) ? 'critica' : overduePct >= 5 ? 'alta' : 'media';
    alerts.push(alert('financeiro', severity, 'Recebíveis vencidos', `${brl(f.overdueTotal)} em atraso. Dinheiro que já foi reconhecido como receita mas não entrou no caixa.`, { impact: brl(f.overdueTotal), page: 'receivable' }));
    recs.push(recommendation('financeiro', 1, 'Ativar a régua de cobrança', `Cada dia de atraso reduz a chance de recebimento em ~1%. São ${brl(f.overdueTotal)} em risco.`, [
      'D+1: contato direto com nova forma de pagamento (PIX ou link).',
      'D+15: proposta formal de parcelamento com multa e juros.',
      'D+30: suspensão de novas vendas até a regularização.',
      'D+60: avaliar protesto ou cobrança terceirizada e provisionar a perda.'
    ], { impact: `Recuperar ${brl(f.overdueTotal)}`, page: 'receivable', effort: 'Baixo' }));
    const aging60 = f.aging['60_plus'];
    if (aging60 && aging60.total > 0) {
      alerts.push(alert('financeiro', 'critica', 'Títulos com mais de 60 dias de atraso', `${brl(aging60.total)} em ${countPhrase(num(aging60.qty), 'título', 'títulos')} na faixa mais crítica — probabilidade de recuperação cai drasticamente após 90 dias.`, { impact: brl(aging60.total), page: 'receivable' }));
    }
  } else if (f.total > 0) {
    insights.push(`Nenhum título vencido: carteira de ${brl(f.total)} a receber em dia.`);
  }

  // Vencimentos próximos
  if (p.dueNext7 > 0) {
    insights.push(`${brl(p.dueNext7)} a pagar vence nos próximos 7 dias.`);
    if (cash.balance < p.dueNext7) {
      alerts.push(alert('financeiro', 'alta', 'Caixa insuficiente para os próximos 7 dias', `São ${brl(p.dueNext7)} de obrigações na semana contra ${brl(cash.balance)} em caixa${f.dueNext7 > 0 ? ` e ${brl(f.dueNext7)} a receber no período` : ''}.`, { impact: brl(Math.max(0, p.dueNext7 - cash.balance - f.dueNext7)), page: 'payable' }));
    }
  }

  // DSO / DPO
  if (f.dso !== null && p.dpo !== null) {
    scores.push({ name: 'Prazos (DSO x DPO)', weight: 1.5, score: scoreUp(p.dpo - f.dso, -45, 10) });
    insights.push(`Prazo médio de recebimento (DSO) de ${num(f.dso)} dias contra prazo de pagamento (DPO) de ${num(p.dpo)} dias.` + (p.dpo >= f.dso ? ' A empresa paga depois de receber — cenário ideal.' : ' A empresa paga antes de receber e financia o cliente com caixa próprio.'));
    if (p.dpo < f.dso - 15) {
      recs.push(recommendation('financeiro', 2, 'Alongar prazos com fornecedores', `O DPO de ${num(p.dpo)} dias é menor que o DSO de ${num(f.dso)} dias, pressionando o capital de giro.`, [
        'Negocie 7 a 15 dias a mais nos fornecedores de maior volume.',
        'Compare desconto à vista x prazo: só aceite o desconto se o custo do caixa for maior.',
        'Ofereça desconto pontual para recebimento antecipado de clientes A.',
        'Reveja o ciclo financeiro mensalmente.'
      ], { impact: 'Reduzir a necessidade de capital de giro', page: 'payable', effort: 'Médio' }));
    }
  }

  // Despesas
  scores.push({ name: 'Controle de despesas', weight: 2, score: scoreDown(expShareRef, 90, 35) });
  if (exp.current > 0) {
    const top = exp.currentByCategory.slice(0, 3);
    insights.push(`Despesas ${partial ? 'no ritmo do mês' : 'do mês'} de ${brl(expRef)} (${percent(expShareRef)} da receita)` + (top.length ? `, concentradas em ${top.map((t) => `${t.category} (${brl(t.total)})`).join(', ')}` : '') + `.${paceNote}`);
    if (expVariation !== null && expVariation > 15 && expVariation > revGrowth) {
      alerts.push(alert('financeiro', 'alta', 'Despesas crescendo acima da receita', `As despesas sobem ${signal(expVariation)} no mês enquanto a receita varia ${signal(revGrowth)}${partial ? ' (ritmo projetado)' : ''}.${paceNote}`, { impact: brl(expRef - exp.previous), page: 'expenses' }));
    }
    if (expShareRef > 45 && revRef > 0) {
      alerts.push(alert('financeiro', 'media', 'Peso de despesas elevado', `As despesas consomem ${percent(expShareRef)} da receita do mês.${paceNote}`, { page: 'expenses' }));
      recs.push(recommendation('financeiro', 2, 'Programa de redução de despesas', 'Despesa cresce mais rápido que receita é o caminho mais comum para o prejuízo.', [
        'Ataque as 3 maiores categorias primeiro (80/20).',
        'Renegocie contratos fixos: aluguel, internet, tarifas bancárias, software.',
        'Crie um teto mensal por categoria e exija aprovação acima dele.',
        'Não corte marketing/comissão sem medir o impacto na receita.'
      ], { impact: `Economia alvo de ${brl(exp.current * 0.08)}/mês (8%)`, page: 'expenses', effort: 'Médio' }));
    }
  }

  // Margem
  scores.push({ name: 'Margem bruta', weight: 2, score: grossMarginRef ? scoreUp(grossMarginRef, 10, 45) : null });
  if (m.revenue.current > 0) {
    insights.push(`Margem bruta de ${percent(grossMarginRef)} (receita ${brl(revRef)} - CMV ${brl(cogsRef)}), despesas de ${brl(expRef)} e resultado operacional de ${brl(resultRef)} (margem líquida ${percent(marginRef)}).${paceNote}`);
    if (grossMarginRef > 0 && grossMarginRef < 25) {
      alerts.push(alert('financeiro', 'media', 'Margem bruta apertada', `${percent(grossMarginRef)} de margem bruta dificilmente cobre despesas fixas de ${brl(exp.fixedAvgMonth)}.`, { page: 'dre' }));
    }
  }

  const score = weightedScore(scores);
  return { id: 'financeiro', score, level: levelOf(score), kpis, insights, alerts, recommendations: recs, scoreBreakdown: scores.filter((s) => s.score !== null) };
}

function analyzeEstoque(m) {
  const insights = [];
  const alerts = [];
  const recs = [];
  const kpis = [];
  const scores = [];

  const st = m.products;
  const ship = m.shipping;
  const stockouts = st.list.filter((p) => p.stockout);
  const belowMin = st.list.filter((p) => p.belowMin);
  const over = st.list.filter((p) => p.overstock);
  const dead = st.deadList;
  const reorder = st.reorderList;

  kpis.push(
    { label: 'Valor do estoque (custo)', value: brl(st.stockValueCost), tone: 'neutral' },
    { label: 'Giro de estoque (ano)', value: st.turnoverAnnualized !== null ? `${num(st.turnoverAnnualized, 2)}x` : 'n/d', tone: st.turnoverAnnualized === null ? 'neutral' : st.turnoverAnnualized >= 6 ? 'positive' : st.turnoverAnnualized >= 3 ? 'neutral' : 'negative' },
    { label: 'Itens em ruptura', value: num(stockouts.length), tone: stockouts.length === 0 ? 'positive' : 'negative' },
    { label: 'Abaixo do mínimo', value: num(belowMin.length), tone: belowMin.length === 0 ? 'positive' : 'negative' },
    { label: 'Pedidos a expedir', value: num(ship.pendingOrders), tone: ship.pendingOrders === 0 ? 'positive' : 'neutral' }
  );

  // Ruptura
  const stockoutDemand = round(stockouts.reduce((a, p) => a + p.dailyDemand * 30 * p.price, 0));
  scores.push({ name: 'Ruptura', weight: 3, score: st.total ? scoreDown(pct(stockouts.length, st.total), 30, 0) : null });
  if (stockouts.length) {
    const names = stockouts.slice(0, 4)
      .map((p) => (p.dailyDemand > 0 ? `${p.name} (demanda ${num(p.dailyDemand * 30, 1)}/mês)` : p.name))
      .join(', ');
    insights.push(`${countPhrase(stockouts.length, 'item', 'itens')} com estoque zerado: ${names}.`);
    const critical = stockouts.filter((p) => p.dailyDemand > 0);
    alerts.push(alert('estoque', critical.length ? 'critica' : 'media', `${countPhrase(stockouts.length, 'produto', 'produtos')} em ruptura`,
      critical.length
        ? `${countPhrase(critical.length, 'item zerado', 'itens zerados')} com demanda ativa: ${critical.slice(0, 4).map((p) => `${p.name} (${num(p.dailyDemand * 30, 1)} un/mês)`).join(', ')}. Venda perdida estimada de ${brl(stockoutDemand)}/mês.`
        : `${countPhrase(stockouts.length, 'item', 'itens')} sem estoque (sem demanda recente registrada).`,
      { impact: brl(stockoutDemand), page: 'products' }));
  } else if (st.total) {
    insights.push('Nenhuma ruptura de estoque: todos os itens têm saldo disponível.');
  }

  // Abaixo do mínimo
  scores.push({ name: 'Itens abaixo do mínimo', weight: 2, score: st.total ? scoreDown(pct(belowMin.length, st.total), 40, 0) : null });
  if (belowMin.length) {
    insights.push(`${countPhrase(belowMin.length, 'item', 'itens')} abaixo do estoque mínimo: ${belowMin.slice(0, 4).map((p) => `${p.name} (${p.stock}/${p.minStock})`).join(', ')}.`);
    alerts.push(alert('estoque', belowMin.length >= 3 ? 'alta' : 'media', 'Itens abaixo do estoque mínimo', `${countPhrase(belowMin.length, 'produto', 'produtos')} no ponto de ruptura: ${belowMin.slice(0, 5).map((p) => `${p.name} (${p.stock} de ${p.minStock})`).join(', ')}.`, { page: 'products' }));
  }

  // Cobertura / giro
  if (st.turnover !== null) {
    scores.push({ name: 'Giro de estoque', weight: 2, score: scoreUp(st.turnoverAnnualized || st.turnover, 1, 10) });
    insights.push(
      `Giro de estoque de ${num(st.turnover, 2)}x no período analisado (${num(st.activeMonths)} meses) — ${num(st.turnoverAnnualized, 2)}x anualizado${st.inventoryDays !== null ? ` e ${num(st.inventoryDays)} dias de cobertura média` : ''}. ` +
      ((st.turnoverAnnualized || st.turnover) >= 6
        ? 'Giro saudável para o varejo (referência: 6 a 12 vezes ao ano).'
        : (st.turnoverAnnualized || st.turnover) >= 3
          ? 'Giro razoável, mas há capital que pode ser liberado.'
          : 'Giro baixo: muito capital parado em relação ao que vende.')
    );
  }

  // Excesso / obsolescência
  const overValue = round(over.reduce((a, p) => a + p.stockValueCost, 0));
  const deadValue = round(dead.reduce((a, p) => {
    const prod = st.list.find((x) => x.id === p.id);
    return a + (prod ? prod.stockValueCost : 0);
  }, 0));
  scores.push({ name: 'Excesso e obsolescência', weight: 1.5, score: st.stockValueCost ? scoreDown(pct(overValue + deadValue, st.stockValueCost), 60, 5) : null });
  if (over.length) {
    insights.push(`${countPhrase(over.length, 'item', 'itens')} com cobertura acima de 90 dias, somando ${brl(overValue)} em capital parado.`);
    if (overValue > st.stockValueCost * 0.25) {
      alerts.push(alert('estoque', 'media', 'Excesso de estoque imobilizando caixa', `${brl(overValue)} (${percent(pct(overValue, st.stockValueCost))} do estoque) em itens com mais de 90 dias de cobertura.`, { impact: brl(overValue), page: 'products' }));
    }
  }
  if (dead.length) {
    alerts.push(alert('estoque', dead.length >= 3 ? 'media' : 'baixa', `${countPhrase(dead.length, 'produto', 'produtos')} parados há mais de 90 dias`, `Itens sem venda com estoque disponível somando ${brl(deadValue)}: ${dead.slice(0, 4).map((p) => p.name).join(', ')}.`, { impact: brl(deadValue), page: 'products' }));
  }

  // Recomposição
  if (reorder.length) {
    const totalCost = round(reorder.reduce((a, p) => a + p.suggestedReorder * p.cost, 0));
    insights.push(`${countPhrase(reorder.length, 'item', 'itens')} pedem reposição, com investimento estimado de ${brl(totalCost)}: ${reorder.slice(0, 3).map((p) => `${p.name} (+${p.suggestedReorder} ${p.unit})`).join(', ')}.`);
    recs.push(recommendation('estoque', 1, 'Emitir pedido de reposição', `${countPhrase(reorder.length, 'item está', 'itens estão')} abaixo da cobertura mínima de 15 dias. Deixar para depois vira ruptura.`, [
      `Comece pelos itens A: ${reorder.slice(0, 3).map((p) => `${p.name} (${p.suggestedReorder} ${p.unit})`).join(', ')}.`,
      `Investimento estimado: ${brl(totalCost)} — confira a disponibilidade de caixa antes de fechar.`,
      'Use o ponto de pedido: demanda diária × lead time + estoque de segurança.',
      'Registre a compra no ERP para atualizar custo e estoque na entrada.'
    ], { impact: `Evitar perda de ${brl(stockoutDemand)}/mês em rupturas`, page: 'purchases', effort: 'Baixo' }));
  }
  if (dead.length || over.length) {
    recs.push(recommendation('estoque', 2, 'Liberar capital parado', `${brl(overValue + deadValue)} estão em itens com baixo giro ou sem venda há mais de 90 dias.`, [
      'Liste os itens por valor parado (maior primeiro).',
      'Aplique liquidação dirigida ou kit com produto de giro alto.',
      'Negocie devolução/troca com o fornecedor quando possível.',
      'Ajuste a política de compra: lote menor e reposição mais frequente.'
    ], { impact: `Liberar até ${brl(overValue + deadValue)}`, page: 'products', effort: 'Médio' }));
  }

  // Expedição
  scores.push({ name: 'Fila de expedição', weight: 1.5, score: scoreDown(ship.pendingOrders, 25, 0) });
  if (ship.pendingOrders > 0) {
    insights.push(`${countPhrase(ship.pendingOrders, 'pedido', 'pedidos')} aguardando expedição, somando ${brl(ship.pendingValue)}${ship.stockoutsBlocking ? `, e ${countPhrase(ship.stockoutsBlocking, 'item', 'itens')} em ruptura ${pl(ship.stockoutsBlocking, 'pode', 'podem')} bloquear a separação` : ''}.`);
    if (ship.pendingOrders >= 5 || ship.stockoutsBlocking > 0) {
      alerts.push(alert('estoque', ship.stockoutsBlocking ? 'alta' : 'media', 'Fila de expedição acumulada', `${countPhrase(ship.pendingOrders, 'pedido pendente', 'pedidos pendentes')} (${brl(ship.pendingValue)})${ship.stockoutsBlocking ? ` com ${countPhrase(ship.stockoutsBlocking, 'item', 'itens')} em ruptura impedindo a separação completa` : ''}.`, { impact: brl(ship.pendingValue), page: 'sales' }));
    }
    recs.push(recommendation('estoque', 2, 'Regularizar a fila de expedição', 'Pedido parado é caixa não recebido e risco de cancelamento.', [
      'Separe os pedidos pendentes por data (mais antigos primeiro).',
      'Confira item a item com checklist duplo para evitar erro de separação.',
      'Atualize o status da venda e baixe o estoque no mesmo momento.',
      'Meça OTIF (entregues no prazo e completos) semanalmente.'
    ], { impact: `Antecipar ${brl(ship.pendingValue)} em recebimento`, page: 'sales', effort: 'Baixo' }));
  } else if (m.hasSales) {
    insights.push('Nenhum pedido pendente de expedição: fila zerada.');
  }

  // Curva ABC de estoque
  if (st.abc.A.count > 0) {
    insights.push(`Curva ABC do estoque: ${countPhrase(st.abc.A.count, 'item classe A', 'itens classe A')} (${brl(st.abc.A.value)} vendidos), ${num(st.abc.B.count)} classe B e ${num(st.abc.C.count)} classe C. Concentre controle diário nos itens A.`);
  }

  // Acurácia / estoque mínimo não definido
  if (m.operations.catalogIssues.withoutMinStock > 0) {
    alerts.push(alert('estoque', 'baixa', `${countPhrase(m.operations.catalogIssues.withoutMinStock, 'item', 'itens')} sem estoque mínimo`, 'Sem estoque mínimo definido o sistema não alerta a ruptura antes de acontecer.', { page: 'products' }));
  }

  const score = weightedScore(scores);
  return { id: 'estoque', score, level: levelOf(score), kpis, insights, alerts, recommendations: recs, scoreBreakdown: scores.filter((s) => s.score !== null) };
}

const ANALYZERS = {
  empresarial: analyzeEmpresarial,
  producao: analyzeProducao,
  comercial: analyzeComercial,
  marketing: analyzeMarketing,
  financeiro: analyzeFinanceiro,
  estoque: analyzeEstoque
};

// ============================================================
// Diagnóstico consolidado
// ============================================================
function analyzeDomain(domainId, metrics) {
  const fn = ANALYZERS[domainId];
  if (!fn) return null;
  const result = fn(metrics);
  const domain = getDomain(domainId);
  return { ...result, name: domain.name, shortName: domain.shortName, icon: domain.icon, color: domain.color };
}

function analyzeAll(metrics) {
  alertSeq = 0;
  recSeq = 0;
  const domains = DOMAINS.map((d) => analyzeDomain(d.id, metrics));
  const allAlerts = domains.flatMap((d) => d.alerts)
    .sort((a, b) => b.weight - a.weight || String(a.title).localeCompare(String(b.title)));
  const allRecs = domains.flatMap((d) => d.recommendations)
    .sort((a, b) => a.priority - b.priority);

  const scored = domains.filter((d) => d.score !== null);
  const companyScore = scored.length ? round(scored.reduce((a, d) => a + d.score, 0) / scored.length, 1) : null;

  const criticalCount = allAlerts.filter((a) => a.severity === 'critica').length;
  const highCount = allAlerts.filter((a) => a.severity === 'alta').length;

  const worst = scored.length ? [...scored].sort((a, b) => a.score - b.score)[0] : null;
  const best = scored.length ? [...scored].sort((a, b) => b.score - a.score)[0] : null;

  let summary;
  if (!metrics.hasData) {
    summary = 'Ainda não há dados suficientes na base para um diagnóstico. Cadastre produtos, clientes e registre vendas e despesas para ativar a análise completa das 6 áreas.';
  } else {
    const parts = [];
    parts.push(`Índice de saúde do negócio em ${companyScore !== null ? `${num(companyScore, 1)}/100` : 'n/d'} (${levelOf(companyScore).label}).`);
    if (metrics.revenue.current > 0) {
      const pc = metrics.pace || { isPartial: false };
      if (pc.isPartial) {
        const marginPace = pc.revenue > 0 ? Math.round((pc.result / pc.revenue) * 1000) / 10 : null;
        parts.push(`Receita de ${brl(metrics.revenue.current)} nos primeiros ${pc.daysElapsed} de ${pc.daysInMonth} dias do mês — projeção de ${brl(pc.revenue)} (${signal(pc.growth)} vs. mês anterior) pelo ${pc.basis || 'ritmo do mês'}, com resultado projetado de ${brl(pc.result)} e margem líquida de ${percent(marginPace)}.`);
      } else {
        parts.push(`Receita do mês de ${brl(metrics.revenue.current)} (${signal(metrics.revenue.growth)} vs. mês anterior) com resultado de ${brl(metrics.profitability.operatingResult)} e margem líquida de ${percent(metrics.profitability.netMarginPct)}.`);
      }
    }
    parts.push(`Caixa de ${brl(metrics.cash.balance)}, ${brl(metrics.receivable.total)} a receber (${brl(metrics.receivable.overdueTotal)} vencidos) e ${brl(metrics.payable.total)} a pagar.`);
    parts.push(`Estoque de ${brl(metrics.products.stockValueCost)} com ${countPhrase(metrics.products.stockouts, 'ruptura', 'rupturas')} e ${countPhrase(metrics.products.belowMin, 'item', 'itens')} abaixo do mínimo.`);
    if (criticalCount) parts.push(`Há ${countPhrase(criticalCount, 'alerta crítico', 'alertas críticos')} e ${num(highCount)} de alta prioridade exigindo ação imediata.`);
    else if (highCount) parts.push(`Nenhum alerta crítico, mas ${countPhrase(highCount, 'ponto', 'pontos')} de alta prioridade ${pl(highCount, 'merece', 'merecem')} atenção nesta semana.`);
    else parts.push('Nenhum alerta crítico ou alto: a operação está sob controle, foco em melhoria contínua.');
    if (worst && best && worst.id !== best.id) {
      parts.push(`Área mais forte: ${best.name} (${num(best.score, 1)}). Área que mais precisa de atenção: ${worst.name} (${num(worst.score, 1)}).`);
    }
    summary = parts.join(' ');
  }

  return {
    generatedAt: metrics.generatedAt,
    company: {
      score: companyScore,
      level: levelOf(companyScore),
      summary,
      criticalAlerts: criticalCount,
      highAlerts: highCount,
      totalAlerts: allAlerts.length,
      totalRecommendations: allRecs.length,
      strongest: best ? { id: best.id, name: best.name, score: best.score } : null,
      weakest: worst ? { id: worst.id, name: worst.name, score: worst.score } : null
    },
    domains,
    alerts: allAlerts,
    recommendations: allRecs,
    plan: buildPlan(allRecs, allAlerts)
  };
}

// Plano 7/30/90 dias
function buildPlan(recs, alerts) {
  const pick = (priority) => recs.filter((r) => r.priority === priority);
  const build = (title, items, relatedAlerts) => ({
    title,
    focus: items.map((i) => ({ id: i.id, domain: i.domain, title: i.title, horizon: i.horizon, impact: i.impact, page: i.page, effort: i.effort })),
    alerts: relatedAlerts.map((a) => ({ id: a.id, domain: a.domain, severity: a.severity, title: a.title, impact: a.impact }))
  });
  return {
    now: build('Agora (7 dias)', pick(1), alerts.filter((a) => a.severity === 'critica' || a.severity === 'alta').slice(0, 6)),
    next: build('Próximos 30 dias', pick(2), alerts.filter((a) => a.severity === 'media').slice(0, 6)),
    later: build('Próximos 90 dias', pick(3), alerts.filter((a) => a.severity === 'baixa').slice(0, 6))
  };
}

module.exports = { analyzeAll, analyzeDomain, levelOf, brl, brl2, num, percent, signal, pl, countPhrase };
