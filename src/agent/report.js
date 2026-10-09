// ============================================================
// AGENTE IA ERP - Relatório executivo em Markdown
// Documento completo do diagnóstico das 6 áreas, pronto para
// imprimir, anexar em reunião de resultados ou versionar.
// ============================================================

const { DOMAINS, getDomain } = require('./domains');
const { getKnowledge } = require('./knowledge');
const { brl, brl2, num, percent, signal, countPhrase } = require('./engine');

const SEVERITY = { critica: '🔴 Crítica', alta: '🟠 Alta', media: '🟡 Média', baixa: '🔵 Baixa' };

function table(headers, rowsList) {
  if (!rowsList.length) return '_Sem registros._\n';
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rowsList.map((r) => `| ${r.map((c) => (c === null || c === undefined ? '-' : String(c).replace(/\|/g, '\\|').replace(/\n/g, ' '))).join(' | ')} |`)
  ].join('\n') + '\n';
}

function buildReport(metrics, analysis, options = {}) {
  const company = options.companyName || 'Empresa';
  const date = new Date(metrics.generatedAt).toLocaleDateString('pt-BR');
  const lines = [];

  lines.push(`# 🤖 Diagnóstico Empresarial — Agente IA do ERP`);
  lines.push('');
  lines.push(`**Empresa:** ${company}  `);
  lines.push(`**Gerado em:** ${date}  `);
  lines.push(`**Período analisado:** ${countPhrase(metrics.seriesKeys.length, 'mês', 'meses')} (${metrics.seriesKeys[0]} a ${metrics.seriesKeys[metrics.seriesKeys.length - 1]})  `);
  lines.push(`**Índice de saúde do negócio:** ${analysis.company.score !== null ? `${num(analysis.company.score, 1)}/100 — ${analysis.company.level.label}` : 'sem dados'}  `);
  lines.push(`**Alertas:** ${countPhrase(analysis.company.criticalAlerts, 'crítico', 'críticos')}, ${countPhrase(analysis.company.highAlerts, 'alto', 'altos')}, ${analysis.company.totalAlerts} no total  `);
  lines.push(`**Recomendações:** ${analysis.company.totalRecommendations}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Sumário executivo
  lines.push('## 1. Sumário executivo');
  lines.push('');
  lines.push(analysis.company.summary);
  lines.push('');

  // Painel por área
  lines.push('## 2. Painel das 6 áreas');
  lines.push('');
  lines.push(table(
    ['Área', 'Nota', 'Situação', 'Alertas', 'Recomendações'],
    analysis.domains.map((d) => [
      `${d.icon} ${d.name}`,
      d.score === null ? 'n/d' : num(d.score, 1),
      d.level.label,
      num(d.alerts.length),
      num(d.recommendations.length)
    ])
  ));

  // mês em andamento: o relatório mostra o lançado e a projeção de fechamento
  const pace = metrics.pace || { isPartial: false };
  const partial = !!pace.isPartial;
  const revRef = partial ? pace.revenue : metrics.revenue.current;
  const resRef = partial ? pace.result : metrics.profitability.operatingResult;
  const expRef = partial ? pace.expenses : metrics.expenses.current;
  const growthRef = partial ? pace.growth : metrics.revenue.growth;
  const marginRef = revRef > 0 ? Math.round((resRef / revRef) * 1000) / 10 : metrics.profitability.netMarginPct;
  const expShareRef = revRef > 0 ? Math.round((expRef / revRef) * 1000) / 10 : metrics.expenses.revenueSharePct;
  const comProjecao = (lancado, projetado) => (partial ? `${brl(lancado)} → projeção ${brl(projetado)}` : brl(lancado));

  // Indicadores consolidados
  lines.push('## 3. Indicadores consolidados');
  if (partial) {
    lines.push('');
    lines.push(`> ⏳ **Mês em andamento** (${pace.daysElapsed} de ${pace.daysInMonth} dias). Onde há projeção, ela foi calculada pelo ${pace.basis || 'ritmo do mês'}.`);
  }
  lines.push('');
  lines.push(table(
    ['Indicador', 'Valor', 'Referência'],
    [
      ['Receita do mês' + (partial ? ` (${pace.daysElapsed} dias)` : ''), comProjecao(metrics.revenue.current, revRef), signal(growthRef) + ' vs. mês anterior' + (partial ? ' (projeção)' : '')],
      ['Resultado operacional (após CMV e despesas)', comProjecao(metrics.profitability.operatingResult, resRef), percent(marginRef) + ' de margem líquida'],
      ['Margem bruta', percent(metrics.profitability.grossMarginPct), '35% a 50% (comércio)'],
      ['Ponto de equilíbrio', metrics.profitability.breakEvenRevenue ? brl(metrics.profitability.breakEvenRevenue) : 'n/d', metrics.profitability.breakEvenGap >= 0 ? 'coberto' : 'não coberto'],
      ['Saldo de caixa', brl(metrics.cash.balance), '2 a 3 meses de despesas fixas'],
      ['Despesas do mês', comProjecao(metrics.expenses.current, expRef), percent(expShareRef) + ' da receita' + (partial ? ' (projeção)' : '')],
      ['Ticket médio', brl2(metrics.revenue.averageTicket), `${countPhrase(num(metrics.revenue.salesCount), 'venda', 'vendas')}${partial ? ' até agora' : ' no mês'}`],
      ['Clientes ativos (90d)', num(metrics.customers.active), `de ${countPhrase(metrics.customers.total, 'cliente cadastrado', 'clientes cadastrados')}`],
      ['Taxa de recompra', percent(metrics.customers.repeatRatePct), 'acima de 30%'],
      ['A receber / vencidos', `${brl(metrics.receivable.total)} / ${brl(metrics.receivable.overdueTotal)}`, 'inadimplência < 5%'],
      ['DSO / DPO', `${metrics.receivable.dso !== null ? num(metrics.receivable.dso) : 'n/d'} / ${metrics.payable.dpo !== null ? num(metrics.payable.dpo) : 'n/d'} dias`, 'DPO ≥ DSO'],
      ['Ciclo financeiro', metrics.operations.cashCycle !== null ? `${num(metrics.operations.cashCycle)} dias` : 'n/d', 'menor que 30 dias'],
      ['Estoque (custo)', brl(metrics.products.stockValueCost), `giro ${metrics.products.turnoverAnnualized !== null ? num(metrics.products.turnoverAnnualized, 2) + 'x/ano' : 'n/d'}`],
      ['Rupturas / abaixo do mínimo', `${num(metrics.products.stockouts)} / ${num(metrics.products.belowMin)}`, 'zero em itens classe A'],
      ['Pedidos a expedir', num(metrics.shipping.pendingOrders), 'fila zerada no dia'],
      ['CAC / LTV', `${metrics.marketing.cac !== null ? brl2(metrics.marketing.cac) : 'n/d'} / ${metrics.marketing.ltv ? brl2(metrics.marketing.ltv) : 'n/d'}`, metrics.marketing.ltvSampleSmall ? `LTV/CAC > 3 (amostra pequena: ${countPhrase(metrics.customers.total, 'cliente', 'clientes')})` : 'LTV/CAC > 3']
    ]
  ));

  // Série mensal
  lines.push('## 4. Evolução mensal');
  lines.push('');
  const primeiroComDado = metrics.series.findIndex((x) => x.revenue > 0 || x.expenses > 0 || x.purchases > 0);
  const mesesVazios = primeiroComDado > 0 ? primeiroComDado : 0;
  const serieVisivel = mesesVazios ? metrics.series.slice(mesesVazios) : metrics.series;
  lines.push(table(
    ['Mês', 'Receita', 'Despesas', 'Compras', 'Resultado', 'Vendas'],
    serieVisivel.map((x) => [
      x.partial ? `${x.label} \\*` : x.label,
      x.partial && partial ? `${brl(x.revenue)} → ${brl(pace.revenue)}` : brl(x.revenue),
      x.partial && partial ? `${brl(x.expenses)} → ${brl(pace.expenses)}` : brl(x.expenses),
      brl(x.purchases),
      x.partial && partial ? `${brl(x.result)} → ${brl(pace.result)}` : brl(x.result),
      num(x.salesCount)
    ])
  ));
  if (partial || mesesVazios) {
    lines.push('');
    if (partial) lines.push(`\\* Mês em andamento: ${pace.daysElapsed} de ${pace.daysInMonth} dias — projeção pelo ${pace.basis || 'ritmo do mês'}.`);
    if (mesesVazios) lines.push(`_Sem movimentação registrada nos ${countPhrase(mesesVazios, 'primeiro mês', 'primeiros meses')} do período analisado._`);
    lines.push('');
  }

  // Detalhe por área
  lines.push('## 5. Análise por área');
  lines.push('');
  analysis.domains.forEach((d, index) => {
    const def = getDomain(d.id);
    lines.push(`### 5.${index + 1} ${def.icon} ${def.name} — ${d.score === null ? 'sem dados' : `${num(d.score, 1)}/100 (${d.level.label})`}`);
    lines.push('');
    lines.push(`> ${def.mission}`);
    lines.push('');
    if (d.scoreBreakdown && d.scoreBreakdown.length) {
      lines.push(table(
        ['Componente da nota', 'Peso', 'Pontuação'],
        d.scoreBreakdown.map((s) => [s.name, num(s.weight, 1), num(s.score, 1)])
      ));
    }
    lines.push('**Indicadores**');
    lines.push('');
    lines.push(table(['Indicador', 'Valor'], d.kpis.map((k) => [k.label, `${k.value}${k.trend ? ` (${k.trend})` : ''}`])));
    lines.push('**Leitura do agente**');
    lines.push('');
    (d.insights.length ? d.insights : ['Sem observações relevantes para esta área no período.']).forEach((i) => lines.push(`- ${i}`));
    lines.push('');
    if (d.alerts.length) {
      lines.push('**Alertas**');
      lines.push('');
      d.alerts.forEach((a) => {
        lines.push(`- ${SEVERITY[a.severity] || a.severity} — **${a.title}**: ${a.detail}${a.impact ? ` _Impacto: ${a.impact}._` : ''}`);
      });
      lines.push('');
    }
    if (d.recommendations.length) {
      lines.push('**Recomendações**');
      lines.push('');
      d.recommendations.forEach((r) => {
        lines.push(`#### ${r.title} — ${r.horizon}${r.effort ? ` (esforço ${r.effort})` : ''}`);
        lines.push('');
        lines.push(`*Por que:* ${r.why}`);
        lines.push('');
        r.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
        if (r.impact) lines.push(`\n🎯 **Impacto esperado:** ${r.impact}`);
        lines.push('');
      });
    }
    const knowledge = getKnowledge(d.id);
    if (knowledge) {
      lines.push('**Check-up da área**');
      lines.push('');
      knowledge.checkup.forEach((q) => lines.push(`- [ ] ${q}`));
      lines.push('');
      if (def.routines && def.routines.length) {
        lines.push(table(['Rotina', 'Cadência', 'Foco'], def.routines.map((r) => [r.name, r.cadence, r.focus])));
      }
    }
    lines.push('');
  });

  // Plano de ação
  lines.push('## 6. Plano de ação priorizado');
  lines.push('');
  const planSection = (title, block) => {
    lines.push(`### ${title}`);
    lines.push('');
    if (!block.focus.length) {
      lines.push('_Nenhuma ação neste horizonte._');
      lines.push('');
      return;
    }
    lines.push(table(
      ['#', 'Ação', 'Área', 'Impacto esperado', 'Esforço'],
      block.focus.map((f, i) => [i + 1, f.title, getDomain(f.domain)?.shortName || f.domain, f.impact || '-', f.effort || '-'])
    ));
  };
  planSection('6.1 🔥 Agora — 7 dias', analysis.plan.now);
  planSection('6.2 📅 Próximos 30 dias', analysis.plan.next);
  planSection('6.3 🎯 Próximos 90 dias', analysis.plan.later);

  // Anexos
  lines.push('## 7. Anexos operacionais');
  lines.push('');
  lines.push('### 7.1 Top clientes');
  lines.push('');
  lines.push(table(
    ['Cliente', 'Receita', '% da receita', 'Pedidos', 'Classe'],
    metrics.customers.top.slice(0, 10).map((c) => [c.name, brl(c.revenue), percent(c.sharePct), num(c.orders), c.class])
  ));
  lines.push('### 7.2 Top produtos');
  lines.push('');
  lines.push(table(
    ['Produto', 'Receita', 'Unidades', 'Margem', 'Estoque', 'Classe'],
    metrics.products.top.slice(0, 10).map((p) => [p.name, brl(p.totalRevenue), num(p.totalUnits), percent(p.marginPct), num(p.stock), p.class])
  ));
  lines.push('### 7.3 Necessidade de reposição');
  lines.push('');
  lines.push(table(
    ['Produto', 'Saldo', 'Cobertura (dias)', 'Demanda/mês', 'Comprar', 'Custo'],
    metrics.products.reorderList.slice(0, 15).map((p) => [p.name, `${num(p.stock)} ${p.unit}`, p.coverageDays === null ? 'n/d' : num(p.coverageDays), num(p.dailyDemand * 30, 1), `${num(p.suggestedReorder)} ${p.unit}`, brl(p.suggestedReorder * p.cost)])
  ));
  lines.push('### 7.4 Recebíveis vencidos');
  lines.push('');
  lines.push(table(
    ['Cliente', 'Título', 'Valor', 'Vencimento', 'Dias de atraso'],
    metrics.receivable.items.filter((i) => i.overdueDays > 0).slice(0, 15).map((i) => [i.customer, i.description, brl2(i.amount), i.dueDate || '-', num(i.overdueDays)])
  ));
  lines.push('### 7.5 Clientes inativos (90+ dias)');
  lines.push('');
  lines.push(table(
    ['Cliente', 'Última compra', 'Dias', 'Pedidos', 'Receita histórica'],
    metrics.customers.inactiveList.slice(0, 15).map((c) => [c.name, c.lastSale, num(c.daysSince), num(c.orders), brl(c.revenue)])
  ));

  // Metodologia
  lines.push('## 8. Metodologia e referências');
  lines.push('');
  lines.push('- O índice de saúde é a média das notas das 6 áreas; cada nota é uma média ponderada de indicadores normalizados de 0 a 100.');
  lines.push('- Escala: 80–100 excelente • 60–79 bom • 40–59 atenção • 0–39 crítico.');
  lines.push('- CMV estimado pela soma de quantidade vendida × custo cadastrado do produto; sem custo cadastrado, a margem fica subestimada.');
  lines.push('- DSO e DPO calculados sobre a série analisada: (saldo ÷ fluxo do período) × dias do período.');
  lines.push('- Curva ABC por receita acumulada: A até 80%, B até 95%, C o restante.');
  lines.push('- Cobertura de estoque = saldo ÷ demanda média diária dos últimos 90 dias; reposição cobre 30 dias de demanda mais o estoque mínimo.');
  lines.push('- Projeções usam média móvel e tendência linear do histórico interno — não incorporam eventos externos.');
  lines.push('');
  lines.push(`_Relatório gerado automaticamente pelo Agente IA do ERP Gestão Financeira em ${new Date(metrics.generatedAt).toLocaleString('pt-BR')}.${options.llm ? ` Redação enriquecida por ${options.llm.provider}/${options.llm.model}.` : ' Análise 100% local (motor de regras sobre os dados do ERP).'}_`);
  lines.push('');

  return lines.join('\n');
}

function buildDomainReport(domainId, metrics, analysis) {
  const d = analysis.domains.find((x) => x.id === domainId);
  const def = getDomain(domainId);
  if (!d || !def) return null;
  const knowledge = getKnowledge(domainId);
  const lines = [
    `# ${def.icon} ${def.name} — relatório do agente`,
    '',
    `**Nota da área:** ${d.score === null ? 'sem dados' : `${num(d.score, 1)}/100 (${d.level.label})`}  `,
    `**Gerado em:** ${new Date(metrics.generatedAt).toLocaleString('pt-BR')}`,
    '',
    `> ${def.mission}`,
    '',
    '## Escopo da área',
    ...def.scope.map((s) => `- ${s}`),
    '',
    '## Indicadores',
    '',
    table(['Indicador', 'Valor'], d.kpis.map((k) => [k.label, `${k.value}${k.trend ? ` (${k.trend})` : ''}`])),
    '',
    '## Leitura do agente',
    ...(d.insights.length ? d.insights.map((i) => `- ${i}`) : ['_Sem observações._']),
    '',
    '## Alertas',
    ...(d.alerts.length ? d.alerts.map((a) => `- ${SEVERITY[a.severity]} — **${a.title}**: ${a.detail}`) : ['_Nenhum alerta._']),
    '',
    '## Recomendações',
    ...(d.recommendations.length
      ? d.recommendations.flatMap((r) => [`### ${r.title} (${r.horizon})`, '', r.why, '', ...r.steps.map((s, i) => `${i + 1}. ${s}`), r.impact ? `\n🎯 ${r.impact}` : '', ''])
      : ['_Nenhuma recomendação._']),
    '',
    '## Conceitos e fórmulas de referência',
    ...(knowledge ? knowledge.concepts.flatMap((c) => [`- **${c.term}** — ${c.formula}. ${c.explanation} _Referência: ${c.target}_`]) : [])
  ];
  return lines.join('\n');
}

module.exports = { buildReport, buildDomainReport, table, SEVERITY };
