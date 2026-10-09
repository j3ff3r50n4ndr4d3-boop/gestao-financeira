// ============================================================
// AGENTE IA ERP - Composição de respostas
// Transforma métricas + análise em resposta legível (texto
// estruturado em markdown leve) e em blocos para a interface.
// Este é o gerador local: funciona sem nenhuma API externa.
// ============================================================

const { getDomain, DOMAINS } = require('./domains');
const { getKnowledge, GENERAL } = require('./knowledge');
const { analyzeDomain } = require('./engine');
const { brl, brl2, num, percent, signal, pl, countPhrase } = require('./engine');
const { round, safeDiv, pct } = require('./metrics');

const SEVERITY_ICON = { critica: '🔴', alta: '🟠', media: '🟡', baixa: '🔵' };
const SEVERITY_LABEL = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' };

function domainTitle(domainId) {
  const d = getDomain(domainId);
  return d ? `${d.icon} ${d.name}` : '🏢 Visão geral';
}

function bullet(list) {
  return list.map((i) => `- ${i}`).join('\n');
}

// ---------- respostas por intenção ----------

function respondSaudacao(metrics, analysis) {
  const name = metrics.company || 'gestor';
  const text = [
    `Olá! Sou o **Agente IA do ERP**, seu consultor de gestão disponível 24h. 🤖`,
    '',
    `Analiso os dados reais da sua empresa em 6 áreas: ${DOMAINS.map((d) => `**${d.icon} ${d.shortName}**`).join(', ')}.`,
    '',
    analysis.company.score !== null
      ? `Neste momento o índice de saúde do negócio está em **${num(analysis.company.score, 1)}/100 (${analysis.company.level.label})**, com ${analysis.company.totalAlerts} ${analysis.company.totalAlerts === 1 ? 'alerta' : 'alertas'} e ${analysis.company.totalRecommendations} ${analysis.company.totalRecommendations === 1 ? 'recomendação' : 'recomendações'} na fila.`
      : 'Ainda há poucos dados na base — cadastre produtos, clientes e registre vendas para eu montar o diagnóstico completo.',
    '',
    'Experimente perguntar:',
    bullet([
      '"Como está a saúde da empresa?"',
      '"O que precisa de reposição urgente?"',
      '"Quais clientes estão inativos?"',
      '"Quanto tenho a receber vencido?"',
      '"Monte meu plano de ação para 30 dias"'
    ])
  ].join('\n');

  return { text, blocks: [{ type: 'domains', items: DOMAINS.map((d) => ({ id: d.id, name: d.name, icon: d.icon })) }] };
}

function respondAjuda() {
  const text = [
    '## O que eu faço',
    '',
    'Sou um agente de inteligência de gestão com **6 especialidades**, cada uma com indicadores, alertas e playbooks próprios:',
    '',
    ...DOMAINS.map((d) => `**${d.icon} ${d.name}** — ${d.mission}`),
    '',
    '## Como eu trabalho',
    bullet([
      '**Leio os dados reais** do seu ERP (vendas, compras, estoque, financeiro, clientes e despesas) — nada de resposta genérica.',
      '**Calculo indicadores** por área: margem, giro, cobertura, CAC, LTV, DSO, DPO, ciclo financeiro, ponto de equilíbrio.',
      '**Aplico regras de especialista** com faixas de referência de mercado para dar nota de 0 a 100 em cada área.',
      '**Gero alertas priorizados** com impacto em reais e recomendações com passo a passo e prazo (7, 30 e 90 dias).',
      '**Respondo em linguagem natural** e exporto o diagnóstico completo em Markdown.'
    ]),
    '',
    '## Perguntas que entendo bem',
    bullet([
      'Diagnóstico geral ou por área ("como está o financeiro?")',
      'Listagens ("quais produtos estão em ruptura?", "top 5 clientes")',
      'Indicadores ("qual é meu ticket médio?", "quanto tenho a receber?")',
      'Conceitos e fórmulas ("o que é curva ABC?", "como calculo o CAC?")',
      'Ação no sistema ("como registro uma compra?", "como cobro um cliente?")',
      'Plano de ação ("o que devo fazer esta semana?")'
    ])
  ].join('\n');
  return { text, blocks: [] };
}

function respondDiagnostico(metrics, analysis, domainId) {
  if (domainId) return respondDominio(metrics, analysis, domainId);
  const blocks = [
    { type: 'score', label: 'Índice de saúde do negócio', value: analysis.company.score, level: analysis.company.level.label },
    {
      type: 'domains',
      items: analysis.domains.map((d) => ({ id: d.id, name: d.name, shortName: d.shortName, icon: d.icon, score: d.score, level: d.level.label, color: d.color }))
    }
  ];
  const text = [
    '## Diagnóstico geral da empresa',
    '',
    analysis.company.summary,
    '',
    '### Nota por área',
    bullet(analysis.domains.map((d) => `${d.icon} **${d.shortName}**: ${d.score === null ? 'sem dados' : `${num(d.score, 1)}/100 — ${d.level.label}`}`)),
    '',
    analysis.alerts.length ? '### Alertas prioritários' : '',
    analysis.alerts.length ? bullet(analysis.alerts.slice(0, 6).map((a) => `${SEVERITY_ICON[a.severity]} **[${SEVERITY_LABEL[a.severity]}]** ${a.title} — ${a.detail}${a.impact ? ` *Impacto: ${a.impact}*` : ''}`)) : '',
    '',
    analysis.recommendations.length ? '### Primeiras recomendações' : '',
    analysis.recommendations.length ? bullet(analysis.recommendations.slice(0, 4).map((r) => `**${r.title}** (${r.horizon}) — ${r.why}`)) : ''
  ].filter((l) => l !== '').join('\n');

  blocks.push({ type: 'alerts', items: analysis.alerts.slice(0, 6) });
  blocks.push({ type: 'recommendations', items: analysis.recommendations.slice(0, 4) });
  return { text: text.replace(/\n{3,}/g, '\n\n'), blocks };
}

function respondDominio(metrics, analysis, domainId) {
  const d = analysis.domains.find((x) => x.id === domainId) || analyzeDomain(domainId, metrics);
  const def = getDomain(domainId);
  const knowledge = getKnowledge(domainId);
  const blocks = [];

  const text = [
    `## ${def.icon} ${def.name}`,
    '',
    `**Nota da área: ${d.score === null ? 'sem dados suficientes' : `${num(d.score, 1)}/100 — ${d.level.label}`}**`,
    '',
    d.score !== null && d.scoreBreakdown && d.scoreBreakdown.length
      ? '### Como a nota foi composta\n' + bullet(d.scoreBreakdown.map((s) => `${s.name}: ${num(s.score, 1)}/100 (peso ${s.weight})`))
      : '',
    '',
    '### Indicadores',
    bullet(d.kpis.map((k) => `**${k.label}:** ${k.value}${k.trend ? ` (${k.trend})` : ''}`)),
    '',
    '### Leitura do agente',
    bullet(d.insights.length ? d.insights : ['Sem leituras relevantes para esta área no momento.']),
    '',
    d.alerts.length ? '### Alertas' : '',
    d.alerts.length ? bullet(d.alerts.map((a) => `${SEVERITY_ICON[a.severity]} **${a.title}** — ${a.detail}${a.impact ? ` *Impacto: ${a.impact}*` : ''}`)) : '',
    '',
    d.recommendations.length ? '### Plano de ação recomendado' : '',
    d.recommendations.length
      ? d.recommendations.map((r) => `**${r.title}** (${r.horizon}${r.effort ? `, esforço ${r.effort}` : ''})\n${r.why}\n${r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}${r.impact ? `\n🎯 Impacto esperado: ${r.impact}` : ''}`).join('\n\n')
      : '',
    '',
    knowledge && knowledge.checkup ? '### Check-up da área\n' + bullet(knowledge.checkup) : '',
    '',
    def ? `**Rotinas recomendadas:** ${def.routines.map((r) => `${r.name} (${r.cadence})`).join(' • ')}` : ''
  ].filter((l) => l !== undefined).join('\n');

  blocks.push({ type: 'score', label: def.name, value: d.score, level: d.level.label });
  blocks.push({ type: 'kpis', items: d.kpis });
  blocks.push({ type: 'alerts', items: d.alerts });
  blocks.push({ type: 'recommendations', items: d.recommendations });
  blocks.push({ type: 'links', items: def.links });
  return { text: text.replace(/\n{3,}/g, '\n\n'), blocks };
}

function respondAlertas(metrics, analysis, domainId, entities) {
  let alerts = analysis.alerts;
  if (domainId) alerts = alerts.filter((a) => a.domain === domainId);
  if (entities.severity) alerts = alerts.filter((a) => a.severity === entities.severity);

  const text = alerts.length
    ? [
        `## ${alerts.length} ${alerts.length === 1 ? 'alerta' : 'alertas'} ${domainId ? `em ${getDomain(domainId).name}` : 'na empresa'}`,
        '',
        ...alerts.map((a) => `${SEVERITY_ICON[a.severity]} **[${SEVERITY_LABEL[a.severity]}] ${a.title}** (${getDomain(a.domain)?.shortName || a.domain})\n${a.detail}${a.impact ? `\n💸 Impacto estimado: ${a.impact}` : ''}${a.page ? `\n🔎 Ver em: módulo **${a.page}**` : ''}`)
      ].join('\n')
    : `✅ Nenhum alerta ${domainId ? `em ${getDomain(domainId).name}` : 'na empresa'} com os filtros aplicados. Isso não significa ausência de melhoria — apenas que nenhum indicador saiu da faixa de referência.`;

  return { text, blocks: [{ type: 'alerts', items: alerts }] };
}

function respondPlano(metrics, analysis, domainId) {
  let recs = analysis.recommendations;
  if (domainId) recs = recs.filter((r) => r.domain === domainId);
  const plan = analysis.plan;

  const renderRecs = (list) => list.map((r) => `**${r.title}** — ${getDomain(r.domain)?.shortName || r.domain} (${r.horizon}${r.effort ? `, esforço ${r.effort}` : ''})\n*Por que:* ${r.why}\n${r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}${r.impact ? `\n🎯 ${r.impact}` : ''}`).join('\n\n');

  const text = recs.length
    ? [
        '## Plano de ação priorizado',
        '',
        '### 🔥 Agora — próximos 7 dias',
        plan.now.focus.length ? renderRecs(recs.filter((r) => r.priority === 1)) : '_Nada crítico no momento._',
        '',
        '### 📅 Próximos 30 dias',
        plan.next.focus.length ? renderRecs(recs.filter((r) => r.priority === 2)) : '_Sem ações de médio prazo pendentes._',
        '',
        '### 🎯 Próximos 90 dias',
        plan.later.focus.length ? renderRecs(recs.filter((r) => r.priority === 3)) : '_Sem ações estratégicas pendentes._'
      ].join('\n')
    : '✅ Não há recomendações pendentes para esta área com os dados atuais.';

  return { text, blocks: [{ type: 'recommendations', items: recs }, { type: 'plan', plan }] };
}

function respondKpis(metrics, analysis, domainId, parsed) {
  const n = String(parsed.normalized);
  const d = domainId ? analysis.domains.find((x) => x.id === domainId) : null;

  // Perguntas diretas frequentes
  if (/ponto de equilibrio|break ?even/.test(n)) {
    const p = metrics.profitability;
    return {
      text: p.breakEvenRevenue
        ? [
            '## Ponto de equilíbrio',
            '',
            `- **Despesas fixas médias:** ${brl(metrics.expenses.fixedAvgMonth)}/mês`,
            `- **Margem de contribuição:** ${percent(p.contributionMarginPct)}`,
            `- **Ponto de equilíbrio:** **${brl(p.breakEvenRevenue)}** de receita mensal`,
            `- **Receita atual:** ${brl(metrics.revenue.current)} (${p.breakEvenGap >= 0 ? `folga de ${brl(p.breakEvenGap)}` : `faltam ${brl(Math.abs(p.breakEvenGap))}`})`,
            '',
            `Fórmula: PE = Despesas fixas ÷ Margem de contribuição = ${brl(metrics.expenses.fixedAvgMonth)} ÷ ${percent(p.contributionMarginPct)}.`
          ].join('\n')
        : 'Não é possível calcular o ponto de equilíbrio sem despesas fixas ou margem de contribuição registradas. Lance as despesas por categoria e o custo dos produtos vendidos.',
      blocks: []
    };
  }

  if (/quanto (tenho|ha) (a receber|de recebiveis)|recebiveis|contas a receber/.test(n)) {
    const f = metrics.receivable;
    return {
      text: [
        '## Contas a receber',
        '',
        `- **Em aberto:** ${brl(f.total)} (${countPhrase(f.items.length, 'título listado', 'títulos listados')})`,
        `- **Vencidos:** ${brl(f.overdueTotal)} em ${countPhrase(num(f.overdueCount), 'título', 'títulos')} — ${percent(f.overduePct)} da carteira`,
        `- **Vencem nos próximos 7 dias:** ${brl(f.dueNext7)}`,
        `- **DSO estimado:** ${f.dso !== null ? `${num(f.dso)} dias` : 'n/d'}`,
        '',
        '### Aging',
        bullet([
          `A vencer: ${brl(f.aging.a_vencer.total)} (${num(f.aging.a_vencer.qty)})`,
          `1 a 15 dias: ${brl(f.aging['1_15'].total)} (${num(f.aging['1_15'].qty)})`,
          `16 a 30 dias: ${brl(f.aging['16_30'].total)} (${num(f.aging['16_30'].qty)})`,
          `31 a 60 dias: ${brl(f.aging['31_60'].total)} (${num(f.aging['31_60'].qty)})`,
          `+60 dias: ${brl(f.aging['60_plus'].total)} (${num(f.aging['60_plus'].qty)})`
        ]),
        f.items.filter((i) => i.overdueDays > 0).length ? '\n### Maiores atrasos\n' + bullet(f.items.filter((i) => i.overdueDays > 0).slice(0, 8).map((i) => `${i.customer} — ${brl2(i.amount)} — ${i.overdueDays} dias de atraso`)) : ''
      ].filter((l) => l !== '').join('\n'),
      blocks: [{ type: 'table', title: 'Recebíveis vencidos', columns: ['Cliente', 'Valor', 'Vencimento', 'Atraso'], rows: f.items.filter((i) => i.overdueDays > 0).slice(0, 10).map((i) => [i.customer, brl2(i.amount), i.dueDate, `${i.overdueDays} dias`]) }]
    };
  }

  if (/quanto (tenho|devo) (a pagar|pagar)|contas a pagar/.test(n)) {
    const p = metrics.payable;
    return {
      text: [
        '## Contas a pagar',
        '',
        `- **Em aberto:** ${brl(p.total)}`,
        `- **Vencidas:** ${brl(p.overdueTotal)} em ${countPhrase(num(p.overdueCount), 'título', 'títulos')}`,
        `- **Vencem nos próximos 7 dias:** ${brl(p.dueNext7)}`,
        `- **DPO estimado:** ${p.dpo !== null ? `${num(p.dpo)} dias` : 'n/d'}`,
        '',
        p.items.length ? '### Próximos vencimentos\n' + bullet(p.items.slice(0, 8).map((i) => `${i.supplier} — ${brl2(i.amount)} — vence em ${i.dueDate || 'sem data'}${i.overdueDays > 0 ? ` (**${i.overdueDays} dias em atraso**)` : ''}`)) : ''
      ].filter((l) => l !== '').join('\n'),
      blocks: [{ type: 'table', title: 'Contas a pagar', columns: ['Fornecedor', 'Valor', 'Vencimento'], rows: p.items.slice(0, 10).map((i) => [i.supplier, brl2(i.amount), i.dueDate || '-']) }]
    };
  }

  if (/saldo (de )?caixa|quanto tem (no|de) caixa|caixa atual/.test(n)) {
    const c = metrics.cash;
    return {
      text: [
        '## Caixa',
        '',
        `- **Saldo atual:** ${brl(c.balance)}`,
        `- **Entradas registradas:** ${brl(c.income)}`,
        `- **Saídas registradas:** ${brl(c.expense)}`,
        `- **Movimento dos últimos 30 dias:** ${brl(c.last30)}`,
        `- **Cobertura de despesas fixas:** ${metrics.expenses.fixedAvgMonth > 0 ? `${num(safeDiv(c.balance, metrics.expenses.fixedAvgMonth), 1)} mês(es)` : 'n/d'}`
      ].join('\n'),
      blocks: []
    };
  }

  if (/ticket medio/.test(n)) {
    return {
      text: [
        '## Ticket médio',
        '',
        `- **Mês atual:** ${brl2(metrics.revenue.averageTicket)} em ${countPhrase(num(metrics.revenue.salesCount), 'venda', 'vendas')}`,
        `- **Itens por venda:** ${num(metrics.revenue.avgItemsPerSale, 1)}`,
        `- **Receita do mês:** ${brl(metrics.revenue.current)}`,
        '',
        `Fórmula: Ticket médio = Receita ÷ Nº de vendas. Para elevar: kits de produtos complementares, valor mínimo para condição especial e oferta de 1 item adicional em toda venda.`
      ].join('\n'),
      blocks: []
    };
  }

  if (/giro (de )?estoque/.test(n)) {
    return {
      text: [
        '## Giro de estoque',
        '',
        `- **Giro no período:** ${metrics.products.turnover !== null ? `${num(metrics.products.turnover, 2)}x (${num(metrics.products.activeMonths)} meses)` : 'n/d'}`,
        `- **Giro anualizado:** ${metrics.products.turnoverAnnualized !== null ? `${num(metrics.products.turnoverAnnualized, 2)}x` : 'n/d'} (referência de varejo: 6 a 12x)`,
        `- **Dias de estoque:** ${metrics.products.inventoryDays !== null ? num(metrics.products.inventoryDays) : 'n/d'}`,
        `- **Estoque a custo:** ${brl(metrics.products.stockValueCost)}`,
        `- **CMV do período:** ${brl(metrics.profitability.cogsSeries)}`,
        '',
        'Fórmula: Giro = CMV ÷ Estoque médio a custo. Referência de varejo: 6 a 12 vezes/ano.'
      ].join('\n'),
      blocks: []
    };
  }

  if (/margem|lucratividade|rentabilidade/.test(n) && !/marketing/.test(n)) {
    const p = metrics.profitability;
    return {
      text: [
        '## Margens',
        '',
        `- **Margem bruta:** ${percent(p.grossMarginPct)} (receita ${brl(metrics.revenue.current)} − CMV ${brl(p.cogsMonth)}) = ${brl(p.grossProfitMonth)}`,
        `- **Despesas do mês:** ${brl(metrics.expenses.current)}`,
        `- **Resultado operacional:** ${brl(p.operatingResult)} (margem líquida ${percent(p.netMarginPct)})`,
        `- **Visão simplificada do dashboard (sem CMV):** ${brl(p.simpleResult)}`,
        `- **Ponto de equilíbrio:** ${p.breakEvenRevenue ? brl(p.breakEvenRevenue) : 'n/d'}`,
        '',
        metrics.products.negativeMargin ? `⚠️ ${countPhrase(num(metrics.products.negativeMargin), 'produto', 'produtos')} com custo maior ou igual ao preço de venda.` : ''
      ].filter((l) => l !== '').join('\n'),
      blocks: []
    };
  }

  // Genérico por domínio
  if (d) return respondDominio(metrics, analysis, domainId);

  return {
    text: [
      '## Indicadores consolidados',
      '',
      `- **Receita do mês:** ${brl(metrics.revenue.current)} (${signal(metrics.revenue.growth)})`,
      `- **Resultado do mês:** ${brl(metrics.profitability.operatingResult)} (margem ${percent(metrics.profitability.netMarginPct)})`,
      `- **Caixa:** ${brl(metrics.cash.balance)}`,
      `- **A receber / a pagar:** ${brl(metrics.receivable.total)} / ${brl(metrics.payable.total)}`,
      `- **Estoque:** ${brl(metrics.products.stockValueCost)} • ${countPhrase(num(metrics.products.stockouts), 'ruptura', 'rupturas')}`,
      `- **Clientes ativos:** ${num(metrics.customers.active)} de ${num(metrics.customers.total)}`,
      `- **Ticket médio:** ${brl2(metrics.revenue.averageTicket)}`,
      `- **Índice de saúde:** ${analysis.company.score !== null ? `${num(analysis.company.score, 1)}/100 (${analysis.company.level.label})` : 'n/d'}`
    ].join('\n'),
    blocks: [{ type: 'kpis', items: analysis.domains.flatMap((x) => x.kpis).slice(0, 12) }]
  };
}

function respondLista(metrics, analysis, domainId, parsed) {
  const n = parsed.normalized;
  const limit = parsed.entities.limit || 10;

  if (/ruptura|zerado|sem estoque|falta de produto/.test(n)) {
    const items = metrics.products.list.filter((p) => p.stockout).sort((a, b) => b.dailyDemand - a.dailyDemand);
    return {
      text: items.length
        ? [`## ${items.length} ${items.length === 1 ? 'produto em ruptura' : 'produtos em ruptura'}`, '', bullet(items.slice(0, limit).map((p) => `**${p.name}** — demanda ${num(p.dailyDemand * 30, 1)} un/mês, venda perdida estimada ${brl(p.dailyDemand * 30 * p.price)}/mês, reposição sugerida ${num(p.suggestedReorder)} ${p.unit}`))].join('\n')
        : '✅ Nenhum produto em ruptura no momento.',
      blocks: [{ type: 'table', title: 'Rupturas', columns: ['Produto', 'Demanda/mês', 'Repor', 'Perda/mês'], rows: items.slice(0, limit).map((p) => [p.name, num(p.dailyDemand * 30, 1), `${num(p.suggestedReorder)} ${p.unit}`, brl(p.dailyDemand * 30 * p.price)]) }]
    };
  }

  if (/reposicao|repor|comprar|pedido de compra/.test(n)) {
    const items = metrics.products.list.filter((p) => p.suggestedReorder > 0).sort((a, b) => b.dailyDemand * b.price - a.dailyDemand * a.price);
    const total = round(items.reduce((a, p) => a + p.suggestedReorder * p.cost, 0));
    return {
      text: items.length
        ? [`## Sugestão de reposição (${items.length} ${items.length === 1 ? 'item' : 'itens'})`, '', `Investimento estimado: **${brl(total)}** (base: demanda dos últimos 90 dias + estoque mínimo − saldo atual)`, '', bullet(items.slice(0, limit).map((p) => `**${p.name}** — saldo ${num(p.stock)} ${p.unit}, cobertura ${p.coverageDays === null ? 'n/d' : `${p.coverageDays} dias`}, **comprar ${num(p.suggestedReorder)} ${p.unit}** (${brl(p.suggestedReorder * p.cost)})`))].join('\n')
        : '✅ Nenhum item precisa de reposição com base na demanda dos últimos 90 dias.',
      blocks: [{ type: 'table', title: 'Reposição sugerida', columns: ['Produto', 'Saldo', 'Cobertura', 'Comprar', 'Custo'], rows: items.slice(0, limit).map((p) => [p.name, `${num(p.stock)} ${p.unit}`, p.coverageDays === null ? 'n/d' : `${p.coverageDays} dias`, `${num(p.suggestedReorder)} ${p.unit}`, brl(p.suggestedReorder * p.cost)]) }]
    };
  }

  if (/inativo|parado|sumido|sem comprar|nao compr/.test(n) && !/produto/.test(n)) {
    const items = metrics.customers.inactiveList;
    return {
      text: items.length
        ? [`## ${metrics.customers.inactive} ${metrics.customers.inactive === 1 ? 'cliente inativo' : 'clientes inativos'} há mais de 90 dias`, '', bullet(items.slice(0, limit).map((c) => `**${c.name}** — última compra em ${c.lastSale} (${c.daysSince} dias), histórico de ${brl(c.revenue)} em ${countPhrase(num(c.orders), 'pedido', 'pedidos')}`)), '', '💡 Reativar um cliente custa 5 a 7 vezes menos que conquistar um novo. Comece pelos de maior histórico.'].join('\n')
        : '✅ Nenhum cliente inativo: toda a carteira comprou nos últimos 90 dias.',
      blocks: [{ type: 'table', title: 'Clientes inativos', columns: ['Cliente', 'Última compra', 'Dias', 'Histórico'], rows: items.slice(0, limit).map((c) => [c.name, c.lastSale, num(c.daysSince), brl(c.revenue)]) }]
    };
  }

  if (/top.*(cliente|clientes)|melhores clientes|maiores clientes|abc de clientes/.test(n)) {
    const items = metrics.customers.top;
    return {
      text: items.length
        ? [`## Top clientes (curva ABC)`, '', bullet(items.slice(0, limit).map((c, i) => `${i + 1}. **${c.name}** — ${brl(c.revenue)} (${percent(c.sharePct)} da receita), ${countPhrase(num(c.orders), 'pedido', 'pedidos')}, classe **${c.class}**`)), '', `Classe A: ${countPhrase(num(metrics.customers.abc.A.count), 'cliente', 'clientes')} • B: ${num(metrics.customers.abc.B.count)} • C: ${num(metrics.customers.abc.C.count)}`].join('\n')
        : 'Ainda não há vendas vinculadas a clientes para montar o ranking.',
      blocks: [{ type: 'table', title: 'Ranking de clientes', columns: ['Cliente', 'Receita', '%', 'Pedidos', 'Classe'], rows: items.slice(0, limit).map((c) => [c.name, brl(c.revenue), percent(c.sharePct), num(c.orders), c.class]) }]
    };
  }

  if (/top.*(produto|itens|vendidos)|mais vend|melhores produtos|abc de produtos/.test(n)) {
    const items = metrics.products.top;
    return {
      text: items.length
        ? ['## Produtos mais vendidos', '', bullet(items.slice(0, limit).map((p, i) => `${i + 1}. **${p.name}** — ${brl(p.totalRevenue)} (${num(p.totalUnits)} un, ${percent(p.share)} da receita), margem ${percent(p.marginPct)}, classe **${p.class}**`))].join('\n')
        : 'Ainda não há vendas registradas para montar o ranking de produtos.',
      blocks: [{ type: 'table', title: 'Ranking de produtos', columns: ['Produto', 'Receita', 'Unidades', 'Margem', 'Classe'], rows: items.slice(0, limit).map((p) => [p.name, brl(p.totalRevenue), num(p.totalUnits), percent(p.marginPct), p.class]) }]
    };
  }

  if (/vencido|atrasad|inadimplen/.test(n)) {
    const items = metrics.receivable.items.filter((i) => i.overdueDays > 0).sort((a, b) => b.overdueDays - a.overdueDays);
    const total = round(items.reduce((a, i) => a + i.amount, 0));
    return {
      text: items.length
        ? [`## ${items.length} ${items.length === 1 ? 'título vencido' : 'títulos vencidos'} — ${brl(total)}`, '', bullet(items.slice(0, limit).map((i) => `**${i.customer}** — ${brl2(i.amount)} — vencido em ${i.dueDate} (**${i.overdueDays} dias**)`)), '', 'Ação imediata: contato direto oferecendo PIX ou parcelamento. A chance de recuperação cai ~1% por dia de atraso.'].join('\n')
        : '✅ Nenhum título vencido no contas a receber.',
      blocks: [{ type: 'table', title: 'Vencidos', columns: ['Cliente', 'Valor', 'Vencimento', 'Atraso'], rows: items.slice(0, limit).map((i) => [i.customer, brl2(i.amount), i.dueDate, `${i.overdueDays} dias`]) }]
    };
  }

  if (/expedicao|expedir|envio|entrega|separacao|pedido(s)? pendente/.test(n)) {
    const s = metrics.shipping;
    return {
      text: [
        '## Fila de expedição',
        '',
        `- **Pedidos pendentes:** ${num(s.pendingOrders)} (${brl(s.pendingValue)})`,
        `- **Itens em ruptura que podem bloquear separação:** ${num(s.stockoutsBlocking)}`,
        '',
        s.statusBreakdown.length ? '### Vendas por status\n' + bullet(s.statusBreakdown.map((x) => `${x.status}: ${countPhrase(num(x.qty), 'pedido', 'pedidos')} — ${brl(x.total)}`)) : '',
        '',
        'Rotina recomendada: separar por data (mais antigos primeiro), conferência dupla, baixa de estoque no momento da separação e medição de OTIF semanal.'
      ].filter((l) => l !== '').join('\n'),
      blocks: []
    };
  }

  if (/despesa|gasto/.test(n)) {
    const items = metrics.expenses.byCategory;
    return {
      text: items.length
        ? ['## Despesas por categoria (histórico)', '', bullet(items.slice(0, limit).map((e) => `**${e.category}** — ${brl(e.total)} em ${countPhrase(num(e.qty), 'lançamento', 'lançamentos')}`)), '', `Total do período: ${brl(metrics.expenses.total)} • Média mensal: ${brl(safeDiv(metrics.expenses.total, metrics.seriesKeys.length))}`].join('\n')
        : 'Nenhuma despesa lançada. Registre em Despesas com categoria para permitir a análise.',
      blocks: [{ type: 'table', title: 'Despesas', columns: ['Categoria', 'Total', 'Lançamentos'], rows: items.slice(0, limit).map((e) => [e.category, brl(e.total), num(e.qty)]) }]
    };
  }

  if (/fornecedor/.test(n)) {
    const items = metrics.purchases.supplierSpend;
    return {
      text: items.length
        ? ['## Compras por fornecedor', '', bullet(items.slice(0, limit).map((s) => `**${s.supplier}** — ${brl(s.total)} (${percent(s.sharePct)}) em ${countPhrase(num(s.qty), 'compra', 'compras')}`))].join('\n')
        : 'Nenhuma compra registrada até o momento.',
      blocks: [{ type: 'table', title: 'Fornecedores', columns: ['Fornecedor', 'Total', '%', 'Compras'], rows: items.slice(0, limit).map((s) => [s.supplier, brl(s.total), percent(s.sharePct), num(s.qty)]) }]
    };
  }

  if (/produto parado|obsoleto|sem venda|estoque parado/.test(n)) {
    const items = metrics.products.deadList;
    const value = round(items.reduce((a, p) => a + (p.stockValueCost || 0), 0));
    return {
      text: items.length
        ? [`## ${items.length} ${items.length === 1 ? 'produto parado' : 'produtos parados'} (${brl(value)})`, '', bullet(items.slice(0, limit).map((p) => `**${p.name}** — ${num(p.stock)} ${p.unit} em estoque (${brl(p.stockValueCost)}), ${p.neverSold ? 'nunca vendeu' : `última venda há ${num(p.daysWithoutSale)} dias`}`))].join('\n')
        : '✅ Nenhum produto com mais de 90 dias sem venda.',
      blocks: [{ type: 'table', title: 'Estoque parado', columns: ['Produto', 'Saldo', 'Valor', 'Última venda'], rows: items.slice(0, limit).map((p) => [p.name, `${num(p.stock)} ${p.unit}`, brl(p.stockValueCost), p.lastSale || 'nunca']) }]
    };
  }

  // gargalos da operação
  if (/gargalo|restricao|capacidade|limita/.test(n)) {
    const items = metrics.products.list
      .filter((p) => p.dailyDemand > 0 && (p.coverageDays === null || p.coverageDays < 15))
      .sort((a, b) => b.dailyDemand * b.price - a.dailyDemand * a.price);
    const capacity = metrics.products.list.filter((p) => p.dailyDemand > 0);
    const ok = capacity.filter((p) => p.coverageDays !== null && p.coverageDays >= 15).length;
    return {
      text: items.length
        ? [
            `## Gargalos da operação (${items.length} ${items.length === 1 ? 'item' : 'itens'})`,
            '',
            `Capacidade de atendimento: **${percent(pct(ok, capacity.length))}** dos itens com demanda têm cobertura igual ou superior a 15 dias.`,
            '',
            bullet(items.slice(0, limit).map((p) => `**${p.name}** — demanda ${num(p.dailyDemand * 30, 1)} un/mês, estoque ${num(p.stock)} ${p.unit}, cobertura ${p.coverageDays === null ? 'inexistente' : `${num(p.coverageDays)} dias`}, risco de perda ${brl(p.dailyDemand * 30 * p.price)}/mês`)),
            '',
            'Pela Teoria das Restrições, ataque primeiro o item do topo: melhorar etapas que não são gargalo não aumenta a entrega.'
          ].join('\n')
        : '✅ Nenhum gargalo identificado: todos os itens com demanda têm cobertura acima de 15 dias.',
      blocks: [{ type: 'table', title: 'Gargalos', columns: ['Produto', 'Demanda/mês', 'Estoque', 'Cobertura', 'Risco/mês'], rows: items.slice(0, limit).map((p) => [p.name, num(p.dailyDemand * 30, 1), `${num(p.stock)} ${p.unit}`, p.coverageDays === null ? 'n/d' : `${p.coverageDays} dias`, brl(p.dailyDemand * 30 * p.price)]) }]
    };
  }

  // pergunta factual sem padrão de listagem específico → indicadores
  if (isFactualQuestion(n)) return respondKpis(metrics, analysis, domainId, parsed);

  // listagem genérica da área
  if (domainId) return respondDominio(metrics, analysis, domainId);
  return respondKpis(metrics, analysis, domainId, parsed);
}

function respondComparar(metrics, analysis, parsed) {
  const series = metrics.series.slice(-6);
  if (!series.length || series.every((s) => s.revenue === 0 && s.expenses === 0)) {
    return { text: 'Não há histórico suficiente para comparar períodos. Registre as operações dos últimos meses para ativar a análise de evolução.', blocks: [] };
  }
  const full = series.filter((s) => !s.partial);
  const base = full.length ? full : series;
  const best = base.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  const worst = base.reduce((a, b) => (b.revenue < a.revenue ? b : a));
  const partialMonth = series.find((s) => s.partial);
  const pace = metrics.pace || { isPartial: false };
  const label = (s) => (s.partial ? `${s.label} (parcial)` : s.label);
  const rows = series.map((s) => [
    label(s),
    brl(s.revenue) + (s.partial && pace.isPartial ? ` → ${brl(pace.revenue)} projetado` : ''),
    brl(s.expenses),
    brl(s.result) + (s.partial && pace.isPartial ? ` → ${brl(pace.result)} projetado` : ''),
    percent(pct(s.partial && pace.isPartial ? pace.result : s.result, s.partial && pace.isPartial ? pace.revenue : s.revenue))
  ]);
  return {
    text: [
      '## Evolução dos últimos meses',
      '',
      bullet(series.map((s) => `**${label(s)}** — receita ${brl(s.revenue)}, despesas ${brl(s.expenses)}, resultado ${brl(s.result)}` + (s.partial && pace.isPartial ? ` _(ritmo projetado do mês: receita ${brl(pace.revenue)}, resultado ${brl(pace.result)})_` : ''))),
      '',
      `- Melhor mês: **${best.label}** com ${brl(best.revenue)}`,
      `- Pior mês: **${worst.label}** com ${brl(worst.revenue)}`,
      `- Variação do primeiro para o último mês fechado: **${signal(growthBetween(base[0].revenue, base[base.length - 1].revenue))}**`,
      partialMonth && pace.isPartial
        ? `- ${partialMonth.label} está em andamento (${pace.daysElapsed} de ${pace.daysInMonth} dias): no ritmo atual fecha em ${brl(pace.revenue)} (${signal(pace.growth)} vs. mês anterior).`
        : '',
      '',
      `Média mensal de receita (meses fechados): ${brl(safeDiv(base.reduce((a, s) => a + s.revenue, 0), base.length))}.`
    ].filter((l) => l !== '').join('\n'),
    blocks: [{ type: 'table', title: 'Série mensal', columns: ['Mês', 'Receita', 'Despesas', 'Resultado', 'Margem'], rows }, { type: 'chart', chart: 'series', series }]
  };
}

function growthBetween(a, b) {
  if (!a) return b > 0 ? 100 : 0;
  return round(((b - a) / Math.abs(a)) * 100, 1);
}

function respondPrevisao(metrics, analysis) {
  const withData = metrics.series.filter((s) => s.revenue > 0 || s.expenses > 0);
  // mês em andamento não entra na média móvel: distorceria a projeção
  const closed = withData.filter((s) => !s.partial);
  const series = (closed.length >= 2 ? closed : withData).slice(-6);
  if (series.length < 2) {
    return { text: 'Ainda não há histórico suficiente (mínimo de 2 meses) para projetar resultados. Continue registrando as operações.', blocks: [] };
  }
  const avg = (key) => safeDiv(series.reduce((a, s) => a + (s[key] || 0), 0), series.length);
  const avgRevenue = avg('revenue');
  const avgExpense = avg('expenses');
  const prof = metrics.profitability || {};
  // mesmas taxas usadas no ponto de equilíbrio → projeção e break-even nunca se contradizem
  const cogsRate = prof.cogsRatePct != null ? prof.cogsRatePct / 100 : (avgRevenue > 0 ? safeDiv(avg('cogs'), avgRevenue) : 0);
  const variableRate = prof.variableExpenseRatePct != null ? prof.variableExpenseRatePct / 100 : 0;
  const fixedBurn = prof.fixedExpenseAvgMonth || metrics.expenses.fixedAvgMonth || Math.max(0, avgExpense - avgRevenue * variableRate);
  const slope = safeDiv(series[series.length - 1].revenue - series[0].revenue, Math.max(1, series.length - 1));
  const projectedRevenue = Math.max(0, round(avgRevenue + slope));
  const projectedCogs = round(projectedRevenue * cogsRate);
  const projectedVariable = round(projectedRevenue * variableRate);
  const projectedExpenses = round(fixedBurn + projectedVariable);
  const projectedResult = round(projectedRevenue - projectedCogs - projectedExpenses);
  const monthsOfCash = safeDiv(metrics.cash.balance, fixedBurn);
  const projectedCash = round(metrics.cash.balance + projectedResult);

  const pace = metrics.pace || { isPartial: false };
  const currentMonthText = pace.isPartial
    ? [
        `## Fechamento do mês corrente (${metrics.currentMonth})`,
        '',
        pace.reliable === false
          ? `Ainda são apenas ${pace.daysElapsed} de ${pace.daysInMonth} dias — amostra pequena para extrapolar. Projeção pela ${pace.basis || 'média dos meses fechados'}:`
          : `Já foram ${pace.daysElapsed} de ${pace.daysInMonth} dias. Pelo ${pace.basis || 'ritmo atual'}, o mês fecha com:`,
        '',
        `- **Receita projetada:** ${brl(pace.revenue)} (${signal(pace.growth)} vs. ${brl(metrics.revenue.previous)} do mês anterior)`,
        `- **(−) CMV projetado:** ${brl(pace.cogs)}`,
        `- **(−) Despesas projetadas:** ${brl(pace.expenses)} (_${pace.expenseBasis || 'média dos meses fechados'}_)`,
        `- **= Resultado projetado:** ${pace.result >= 0 ? brl(pace.result) : `−${brl(Math.abs(pace.result))}`} (margem ${percent(pct(pace.result, pace.revenue))})`,
        metrics.profitability.breakEvenRevenue
          ? `- **Ponto de equilíbrio:** ${brl(metrics.profitability.breakEvenRevenue)} — o ritmo atual fica ${pace.revenue >= metrics.profitability.breakEvenRevenue ? `${brl(pace.revenue - metrics.profitability.breakEvenRevenue)} acima` : `${brl(metrics.profitability.breakEvenRevenue - pace.revenue)} abaixo`}.`
          : '',
        pace.result < 0
          ? `\n⚠️ Ainda dá tempo de reagir neste mês: faltam ${pace.daysInMonth - pace.daysElapsed} dias. Priorize cobrança de ${brl(metrics.receivable.overdueTotal)} vencidos e venda dos itens parados em estoque.`
          : '',
        '',
        '---',
        ''
      ].filter((l) => l !== '').join('\n') + '\n'
    : '';

  const text = currentMonthText + [
    '## Projeção para o próximo mês',
    '',
    `_Método: média móvel dos últimos ${series.length} ${series.length === 1 ? 'mês fechado' : 'meses fechados'} ajustada pela tendência linear (variação média de ${brl(slope)}/mês), CMV de ${percent(cogsRate * 100)} da receita, despesas variáveis de ${percent(variableRate * 100)} e despesas fixas de ${brl(round(fixedBurn))}/mês._`,
    '',
    `- **Receita projetada:** ${brl(projectedRevenue)}`,
    `- **(−) CMV projetado:** ${brl(projectedCogs)}`,
    `- **(−) Despesas fixas:** ${brl(round(fixedBurn))}`,
    `- **(−) Despesas variáveis:** ${brl(projectedVariable)}`,
    `- **= Resultado projetado:** ${projectedResult >= 0 ? brl(projectedResult) : `−${brl(Math.abs(projectedResult))}`} (margem ${percent(pct(projectedResult, projectedRevenue))})`,
    `- **Caixa atual:** ${brl(metrics.cash.balance)} (${num(monthsOfCash, 1)} ${monthsOfCash >= 1.5 ? 'meses' : 'mês'} de cobertura de despesas fixas)`,
    `- **Caixa projetado ao fim do mês:** ${brl(projectedCash)}`,
    `- **A receber em aberto:** ${brl(metrics.receivable.total)} (${brl(metrics.receivable.overdueTotal)} vencidos) • **A pagar:** ${brl(metrics.payable.total)}`,
    '',
    projectedResult < 0
      ? `⚠️ **Cenário de prejuízo projetado.** Para reverter: recuperar ${brl(metrics.receivable.overdueTotal)} de vencidos, cortar ${brl(round(fixedBurn * 0.08))} em despesas fixas (8%) ou elevar a receita em ${percent(pct(Math.abs(projectedResult), projectedRevenue * (1 - cogsRate - variableRate)))}.`
      : `✅ Cenário positivo. Para acelerar: elevar o ticket médio de ${brl2(metrics.revenue.averageTicket)} em 10% adiciona ~${brl(round(projectedRevenue * 0.1))} de receita sem conquistar novo cliente.`,
    metrics.profitability.breakEvenRevenue
      ? `\n📌 Ponto de equilíbrio estimado: ${brl(metrics.profitability.breakEvenRevenue)} — a projeção fica ${projectedRevenue >= metrics.profitability.breakEvenRevenue ? 'acima' : 'abaixo'} dele.`
      : '',
    '',
    '⚠️ Projeção estatística baseada no histórico interno — não considera sazonalidade externa, campanhas ou mudanças de mercado.'
  ].filter((l) => l !== '').join('\n');

  return {
    text,
    blocks: [{
      type: 'forecast',
      projectedRevenue,
      projectedCogs,
      projectedFixed: round(fixedBurn),
      projectedVariable,
      projectedExpenses,
      projectedResult,
      projectedMarginPct: pct(projectedResult, projectedRevenue),
      avgRevenue: round(avgRevenue),
      avgExpense: round(avgExpense),
      breakEvenRevenue: prof.breakEvenRevenue || null,
      projectedCash
    }]
  };
}

function respondRelatorio(metrics, analysis) {
  const p = metrics.profitability;
  const text = [
    '## DRE gerencial do mês',
    '',
    `| Linha | Valor |`,
    `| --- | --- |`,
    `| Receita bruta de vendas | ${brl(metrics.revenue.current)} |`,
    `| (−) CMV estimado | ${brl(p.cogsMonth)} |`,
    `| **= Lucro bruto** | **${brl(p.grossProfitMonth)}** (${percent(p.grossMarginPct)}) |`,
    `| (−) Despesas do mês | ${brl(metrics.expenses.current)} |`,
    `| **= Resultado operacional** | **${brl(p.operatingResult)}** (${percent(p.netMarginPct)}) |`,
    '',
    `**Ponto de equilíbrio:** ${p.breakEvenRevenue ? brl(p.breakEvenRevenue) : 'n/d'} • **Margem de contribuição:** ${percent(p.contributionMarginPct)}`,
    '',
    '### Composição das despesas',
    bullet(metrics.expenses.currentByCategory.slice(0, 6).map((e) => `${e.category}: ${brl(e.total)} (${percent(pct(e.total, metrics.expenses.current))})`)),
    '',
    '### Balanço rápido',
    bullet([
      `Caixa: ${brl(metrics.cash.balance)}`,
      `Estoque (custo): ${brl(metrics.products.stockValueCost)}`,
      `Recebíveis: ${brl(metrics.receivable.total)} (vencidos ${brl(metrics.receivable.overdueTotal)})`,
      `Fornecedores: ${brl(metrics.payable.total)}`,
      `Capital de giro: ${brl(metrics.operations.workingCapital)}`
    ]),
    '',
    `_Índice de saúde: ${analysis.company.score !== null ? `${num(analysis.company.score, 1)}/100 (${analysis.company.level.label})` : 'n/d'}. Use "exportar relatório" para baixar o diagnóstico completo das 6 áreas em Markdown._`
  ].join('\n');

  return {
    text,
    blocks: [{
      type: 'table',
      title: 'DRE do mês',
      columns: ['Linha', 'Valor'],
      rows: [
        ['Receita bruta', brl(metrics.revenue.current)],
        ['(−) CMV', brl(p.cogsMonth)],
        ['= Lucro bruto', brl(p.grossProfitMonth)],
        ['(−) Despesas', brl(metrics.expenses.current)],
        ['= Resultado', brl(p.operatingResult)]
      ]
    }]
  };
}

function respondConceito(parsed, domainId) {
  const n = parsed.normalized;
  const searched = domainId ? [domainId] : DOMAINS.map((d) => d.id);
  const hits = [];

  searched.forEach((id) => {
    const k = getKnowledge(id);
    if (!k) return;
    k.concepts.forEach((c) => {
      const term = c.term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const words = term.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
      let score = words.filter((w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(n) ? 1 : 0).length;
      if (term.length >= 3 && n.includes(term)) score += 3;
      if (score > 0) hits.push({ domain: id, score, concept: c });
    });
  });

  if (!hits.length) {
    const formula = GENERAL.formulas.find((f) => n.includes(f.q.toLowerCase()));
    if (formula) return { text: `**${formula.q.toUpperCase()}**\n\n${formula.a}`, blocks: [] };
    return {
      text: 'Não encontrei esse conceito na base. Tente perguntar sobre: margem, markup, precificação, ponto de equilíbrio, giro de estoque, cobertura, curva ABC, CAC, LTV, DSO, DPO, capital de giro, ciclo financeiro, OEE, lead time, estoque de segurança, OTIF, matriz BCG ou sazonalidade.',
      blocks: []
    };
  }

  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, 3);
  const text = top
    .map((h) => {
      const c = h.concept;
      return [
        `## ${c.term} — ${getDomain(h.domain).icon} ${getDomain(h.domain).shortName}`,
        '',
        `**Fórmula:** ${c.formula}`,
        '',
        c.explanation,
        '',
        `🎯 **Referência:** ${c.target}`
      ].join('\n');
    })
    .join('\n\n---\n\n');

  return { text, blocks: [{ type: 'concepts', items: top.map((h) => ({ ...h.concept, domain: h.domain })) }] };
}

function respondComoFazer(parsed, domainId) {
  const n = parsed.normalized;
  const howTo = GENERAL.erpHowTo.filter((h) => {
    const words = h.intent.split(' ').filter((w) => w.length > 3);
    return words.some((w) => n.includes(w)) || n.includes(h.intent);
  });
  const knowledge = domainId ? getKnowledge(domainId) : null;

  const parts = [];
  if (howTo.length) {
    parts.push('## Como fazer no ERP', '', bullet(howTo.map((h) => `**${h.intent}** — ${h.text}`)));
  }
  if (knowledge) {
    const relevant = knowledge.playbooks.filter((p) => {
      const words = p.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 4);
      return words.some((w) => n.includes(w));
    });
    const list = (relevant.length ? relevant : knowledge.playbooks).slice(0, 2);
    parts.push('', '## Playbook recomendado', '', ...list.map((p) => [`**${p.title}** (${p.when})`, '', p.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'), '', `📊 Indicador: ${p.kpi}`].join('\n')));
  }
  if (!parts.length) {
    parts.push('Não localizei um passo a passo específico para essa pergunta. Descreva a tarefa (ex.: "como registrar uma compra", "como cobrar um cliente vencido", "como calcular o preço de venda").');
  }
  return { text: parts.join('\n'), blocks: [] };
}

function respondProduto(metrics, productId) {
  const p = metrics.products.list.find((x) => x.id === productId);
  if (!p) return { text: 'Não encontrei esse produto no cadastro.', blocks: [] };
  const text = [
    `## ${p.name} (${p.sku || 'sem SKU'})`,
    '',
    `- **Categoria:** ${p.category} • **Unidade:** ${p.unit}`,
    `- **Custo:** ${brl2(p.cost)} • **Preço de venda:** ${brl2(p.price)} • **Margem:** ${percent(p.marginPct)}${p.markup !== null ? ` (markup ${percent(p.markup)})` : ''}`,
    `- **Estoque:** ${num(p.stock)} ${p.unit}${p.minStock ? ` (mínimo ${num(p.minStock)})` : ' (sem mínimo definido)'}`,
    p.coverageDays !== null ? `- **Cobertura:** ${num(p.coverageDays)} dias (demanda de ${num(p.dailyDemand * 30, 1)} un/mês)` : '- **Cobertura:** sem demanda nos últimos 90 dias',
    `- **Vendas:** ${num(p.totalUnits)} un / ${brl(p.totalRevenue)} no histórico`,
    `- **Valor em estoque:** ${brl(p.stockValueCost)} a custo (${brl(p.stockValueSale)} a preço de venda)`,
    p.suggestedReorder > 0 ? `- **Reposição sugerida:** ${num(p.suggestedReorder)} ${p.unit} (${brl(p.suggestedReorder * p.cost)})` : '- **Reposição:** não necessária no momento',
    '',
    p.negativeMargin ? '⚠️ **Alerta:** o custo é maior ou igual ao preço — cada venda gera prejuízo.' : '',
    p.deadStock ? '⚠️ **Alerta:** item parado há mais de 90 dias com estoque disponível.' : '',
    p.stockout ? '🔴 **Ruptura:** estoque zerado.' : p.belowMin ? '🟠 **Abaixo do mínimo.**' : '✅ Situação de estoque normal.'
  ].filter((l) => l !== '').join('\n');
  return { text, blocks: [] };
}

function respondCliente(metrics, customerId) {
  const c = metrics.customers.top.find((x) => x.id === customerId) || metrics.customers.inactiveList.find((x) => x.id === customerId);
  if (!c) return { text: 'Não encontrei esse cliente com vendas registradas.', blocks: [] };
  const text = [
    `## ${c.name}`,
    '',
    `- **Receita gerada:** ${brl(c.revenue)}`,
    `- **Pedidos:** ${num(c.orders)}`,
    c.lastSale ? `- **Última compra:** ${c.lastSale}` : '- **Ainda sem compras**',
    c.class ? `- **Classe ABC:** ${c.class}` : '',
    '',
    c.lastSale && c.daysSince > 90
      ? `⚠️ Cliente inativo há ${num(c.daysSince)} dias. Ação: ligar com oferta específica do produto que costuma comprar.`
      : '✅ Cliente ativo. Ação: identificar produtos complementares para elevar o share of wallet.'
  ].filter((l) => l !== '').join('\n');
  return { text, blocks: [] };
}

// Perguntas factuais diretas têm prioridade sobre a intenção genérica:
// "quanto tenho a receber vencido?" é um KPI, não um pedido de alertas.
const FACTUAL_PATTERNS = [
  /(quanto|quais|qual).{0,25}(a receber|recebive|vencido|inadimplen|atrasad)/,
  /(quanto|quais).{0,25}(a pagar|pagar|fornecedor|obrigac)/,
  /(saldo|quanto).{0,15}caixa/,
  /ticket medio/,
  /giro (de )?estoque/,
  /(ponto de equilibrio|break ?even)/,
  /(margem|lucratividade)/,
  /(quais|o que|lista).{0,25}(ruptura|zerado|sem estoque|reposicao|repor)/,
  /(quais|lista).{0,20}(inativo|parado|sem comprar)/,
  /(fila|pedidos?).{0,15}(expedicao|expedir|pendente)/,
  /(despesas?|gastos?) (por|do|onde)/,
  /(top|melhores|maiores).{0,15}(cliente|produto)/
];

function isFactualQuestion(normalized) {
  return FACTUAL_PATTERNS.some((re) => re.test(normalized));
}

// ---------- roteador principal ----------
function compose(parsed, metrics, analysis) {
  const domainId = parsed.domain || null;
  const entities = parsed.entities || {};

  if (entities.product && !/top|list|quais/.test(parsed.normalized)) return respondProduto(metrics, entities.product.id);
  if (entities.customer && !/top|list|quais|inativo/.test(parsed.normalized)) return respondCliente(metrics, entities.customer.id);

  // intenção genérica (alertas/kpis/lista) + pergunta factual → responde o fato com números
  if (['alertas', 'kpis', 'lista', 'diagnostico'].includes(parsed.intent) && isFactualQuestion(parsed.normalized)) {
    return respondLista(metrics, analysis, domainId, parsed);
  }

  switch (parsed.intent) {
    case 'saudacao': return respondSaudacao(metrics, analysis);
    case 'ajuda': return respondAjuda();
    case 'diagnostico': return respondDiagnostico(metrics, analysis, domainId);
    case 'alertas': return respondAlertas(metrics, analysis, domainId, entities);
    case 'plano': return respondPlano(metrics, analysis, domainId);
    case 'previsao': return respondPrevisao(metrics, analysis);
    case 'relatorio': return respondRelatorio(metrics, analysis);
    case 'conceito': return respondConceito(parsed, domainId);
    case 'como_fazer': return respondComoFazer(parsed, domainId);
    case 'lista': return respondLista(metrics, analysis, domainId, parsed);
    case 'comparar': return respondComparar(metrics, analysis, parsed);
    case 'kpis':
    default: return respondKpis(metrics, analysis, domainId, parsed);
  }
}

// ---------- contexto para o LLM ----------
function buildLlmContext(parsed, metrics, analysis, domainId) {
  const d = domainId ? analysis.domains.find((x) => x.id === domainId) : null;
  return {
    pergunta: parsed.raw,
    intencao: parsed.intentLabel,
    dominio: d ? d.name : 'Visão geral (6 áreas)',
    empresa: {
      indiceSaude: analysis.company.score,
      nivel: analysis.company.level.label,
      resumo: analysis.company.summary
    },
    numeros: {
      receitaMes: metrics.revenue.current,
      crescimentoReceitaPct: metrics.revenue.growth,
      resultadoMes: metrics.profitability.operatingResult,
      margemBrutaPct: metrics.profitability.grossMarginPct,
      margemLiquidaPct: metrics.profitability.netMarginPct,
      pontoEquilibrio: metrics.profitability.breakEvenRevenue,
      caixa: metrics.cash.balance,
      despesasMes: metrics.expenses.current,
      despesasFixasMedia: metrics.expenses.fixedAvgMonth,
      aReceber: metrics.receivable.total,
      vencidos: metrics.receivable.overdueTotal,
      inadimplenciaPct: metrics.receivable.overduePct,
      aPagar: metrics.payable.total,
      dso: metrics.receivable.dso,
      dpo: metrics.payable.dpo,
      estoqueCusto: metrics.products.stockValueCost,
      giroEstoque: metrics.products.turnover,
      rupturas: metrics.products.stockouts,
      abaixoMinimo: metrics.products.belowMin,
      pedidosExpedicao: metrics.shipping.pendingOrders,
      clientesTotal: metrics.customers.total,
      clientesAtivos: metrics.customers.active,
      clientesInativos: metrics.customers.inactive,
      ticketMedio: metrics.revenue.averageTicket,
      cac: metrics.marketing.cac,
      ltv: metrics.marketing.ltv,
      ltvCac: metrics.marketing.ltvCac,
      cicloFinanceiroDias: metrics.operations.cashCycle
    },
    serieMensal: metrics.series.slice(-6),
    notasPorArea: analysis.domains.map((x) => ({ area: x.name, nota: x.score, nivel: x.level.label })),
    alertas: (d ? d.alerts : analysis.alerts).slice(0, 12),
    recomendacoes: (d ? d.recommendations : analysis.recommendations).slice(0, 8).map((r) => ({ titulo: r.title, prazo: r.horizon, passos: r.steps })),
    insights: d ? d.insights : analysis.domains.flatMap((x) => x.insights).slice(0, 20)
  };
}

module.exports = { compose, buildLlmContext, SEVERITY_ICON, SEVERITY_LABEL };
