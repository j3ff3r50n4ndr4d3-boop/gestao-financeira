// ============================================================
// AGENTE IA ERP - Orquestrador
// Une: métricas reais (metrics) → análise especialista (engine)
// → linguagem natural (nlu + compose) → enriquecimento opcional
// por LLM (llm) → histórico (store) → relatório (report).
// ============================================================

const { DOMAINS, getDomain } = require('./domains');
const { collectMetrics } = require('./metrics');
const { analyzeAll, analyzeDomain } = require('./engine');
const { parse } = require('./nlu');
const { compose, buildLlmContext } = require('./compose');
const { buildReport, buildDomainReport } = require('./report');
const { getKnowledge, GENERAL } = require('./knowledge');
const llm = require('./llm');
const { buildSystemPrompt, buildUserPrompt } = require('./prompts');
const store = require('./store');

const MAX_MESSAGE_LENGTH = 2000;

// ---------- estado da empresa ----------
function getState(db, userId) {
  const metrics = collectMetrics(db, userId);
  const analysis = analyzeAll(metrics);
  return { metrics, analysis };
}

// ---------- listagens para a interface ----------
function listDomains(analysis) {
  return DOMAINS.map((d) => {
    const result = analysis.domains.find((x) => x.id === d.id);
    return {
      id: d.id,
      name: d.name,
      shortName: d.shortName,
      icon: d.icon,
      color: d.color,
      persona: d.persona,
      mission: d.mission,
      scope: d.scope,
      kpis: d.kpis,
      typicalQuestions: d.typicalQuestions,
      routines: d.routines,
      links: d.links,
      score: result ? result.score : null,
      level: result ? result.level : null,
      alertCount: result ? result.alerts.length : 0,
      criticalCount: result ? result.alerts.filter((a) => a.severity === 'critica' || a.severity === 'alta').length : 0,
      recommendationCount: result ? result.recommendations.length : 0,
      knowledge: {
        concepts: (getKnowledge(d.id)?.concepts || []).map((c) => c.term),
        playbooks: (getKnowledge(d.id)?.playbooks || []).map((p) => p.title)
      }
    };
  });
}

function quickPrompts() {
  return [
    { label: 'Diagnóstico geral', message: 'Como está a saúde da empresa?', domain: null, intent: 'diagnostico' },
    { label: 'Alertas críticos', message: 'Quais são os problemas mais urgentes agora?', domain: null, intent: 'alertas' },
    { label: 'Plano de 7 dias', message: 'O que devo fazer primeiro nesta semana?', domain: null, intent: 'plano' },
    { label: 'Reposição de estoque', message: 'O que precisa de reposição urgente?', domain: 'estoque', intent: 'lista' },
    { label: 'Clientes inativos', message: 'Quais clientes estão inativos?', domain: 'comercial', intent: 'lista' },
    { label: 'Vencidos a receber', message: 'Quanto tenho a receber vencido?', domain: 'financeiro', intent: 'kpis' },
    { label: 'Ponto de equilíbrio', message: 'Qual é o meu ponto de equilíbrio?', domain: 'empresarial', intent: 'kpis' },
    { label: 'Gargalos da operação', message: 'Onde está o gargalo da minha operação?', domain: 'producao', intent: 'diagnostico' },
    { label: 'CAC e LTV', message: 'Quanto custa adquirir um cliente e qual é o LTV?', domain: 'marketing', intent: 'kpis' },
    { label: 'Projeção do mês', message: 'Qual é a previsão de resultado do próximo mês?', domain: null, intent: 'previsao' },
    { label: 'DRE gerencial', message: 'Monte o DRE gerencial do mês', domain: 'financeiro', intent: 'relatorio' },
    { label: 'Relatório completo', message: 'Exportar relatório completo das 6 áreas', domain: null, intent: 'relatorio' }
  ];
}

// ---------- resposta assistida por LLM (opcional) ----------
async function enrichWithLlm({ question, parsed, metrics, analysis, localAnswer, mode = 'chat' }) {
  const config = llm.getConfig();
  if (!config.enabled) return null;

  const domainId = parsed.domain;
  const context = buildLlmContext(parsed, metrics, analysis, domainId);
  const system = buildSystemPrompt(domainId, { mode });
  const user = [
    buildUserPrompt(question, context),
    '',
    'Rascunho factual gerado pelo motor de regras local (trate como fonte de verdade para números):',
    '---',
    localAnswer.text,
    '---',
    'Reescreva com linguagem de consultor, mantendo todos os números, prioridades e ações. Não adicione dados novos.'
  ].join('\n');

  try {
    const result = await llm.generate({ system, user, temperature: 0.3, maxTokens: 1400 });
    return { text: result.text, provider: result.provider, model: result.model };
  } catch (err) {
    return { error: err.message, provider: config.provider, model: config.model };
  }
}

// ---------- chat ----------
async function chat({ db, userId, message, domain = null, conversationId = null, useLlm = true, user }) {
  const text = String(message || '').trim();
  if (!text) {
    const err = new Error('Mensagem vazia');
    err.status = 400;
    throw err;
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    const err = new Error(`Mensagem muito longa (máximo de ${MAX_MESSAGE_LENGTH} caracteres)`);
    err.status = 400;
    throw err;
  }

  const validDomain = domain && getDomain(domain) ? domain : null;
  const { metrics, analysis } = getState(db, userId);

  // contexto de entidades para o NLU (produtos e clientes reais)
  const context = {
    domain: validDomain,
    products: metrics.products.list.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
    customers: [...metrics.customers.top, ...metrics.customers.inactiveList].map((c) => ({ id: c.id, name: c.name }))
  };
  const parsed = parse(text, context);
  const domainId = parsed.domain || validDomain;

  // pedido explícito de relatório exportável
  const wantsReport = /(exportar|baixar|gerar|montar)\s+(o\s+)?(relatorio|documento)|relatorio completo|relatorio das 6/.test(parsed.normalized);

  const local = compose({ ...parsed, domain: domainId }, metrics, analysis);

  let replyText = local.text;
  let source = 'local';
  let llmInfo = null;
  let report = null;

  if (wantsReport) {
    report = buildReport(metrics, analysis, { companyName: user?.company_name || user?.name });
    replyText = [
      '## 📄 Relatório executivo gerado',
      '',
      'O diagnóstico completo das 6 áreas foi montado em Markdown — use o botão **Exportar relatório** acima do chat para baixar o arquivo.',
      '',
      `**Resumo:** ${analysis.company.summary}`,
      '',
      `Índice de saúde: **${analysis.company.score !== null ? `${analysis.company.score}/100 (${analysis.company.level.label})` : 'n/d'}** • ${analysis.company.totalAlerts} alerta(s) • ${analysis.company.totalRecommendations} recomendação(ões).`
    ].join('\n');
  } else if (useLlm) {
    const enriched = await enrichWithLlm({ question: text, parsed: { ...parsed, domain: domainId }, metrics, analysis, localAnswer: local, mode: 'chat' });
    if (enriched && enriched.text) {
      replyText = enriched.text;
      source = 'llm';
      llmInfo = { provider: enriched.provider, model: enriched.model };
    } else if (enriched && enriched.error) {
      source = 'local';
      llmInfo = { provider: enriched.provider, model: enriched.model, error: enriched.error };
      replyText = `${local.text}\n\n> ⚠️ _Não foi possível usar o modelo externo (${enriched.error}). Respondi com o motor local do ERP._`;
    }
  }

  // ---------- persistência ----------
  let convId = conversationId;
  if (convId) {
    const existing = store.getConversation(convId, userId);
    if (!existing) convId = null;
  }
  if (!convId) {
    const title = text.length > 60 ? `${text.slice(0, 57)}...` : text;
    convId = store.createConversation(userId, { title, domain: domainId });
  }

  store.addMessage({ conversationId: convId, userId, role: 'user', content: text, domain: domainId, intent: parsed.intent });
  const messageId = store.addMessage({
    conversationId: convId,
    userId,
    role: 'assistant',
    content: replyText,
    structured: { blocks: local.blocks, score: analysis.company.score, domain: domainId },
    source,
    domain: domainId,
    intent: parsed.intent
  });
  store.touchConversation(convId, userId, { domain: domainId });

  return {
    conversationId: convId,
    messageId,
    source,
    llm: llmInfo,
    parsed: {
      intent: parsed.intent,
      intentLabel: parsed.intentLabel,
      domain: domainId,
      domainName: domainId ? getDomain(domainId).name : null,
      entities: parsed.entities,
      confidence: { intent: parsed.intentConfidence, domain: parsed.domainConfidence }
    },
    reply: { text: replyText, blocks: local.blocks },
    report: report ? { filename: reportFilename(), content: report } : null,
    companyScore: analysis.company.score,
    companyLevel: analysis.company.level.label
  };
}

function reportFilename() {
  const d = new Date();
  return `diagnostico-agente-ia-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.md`;
}

// ---------- endpoints de leitura ----------
function domainsWithScores(db, userId) {
  const { metrics, analysis } = getState(db, userId);
  return {
    generatedAt: metrics.generatedAt,
    company: analysis.company,
    domains: listDomains(analysis)
  };
}

function diagnostic(db, userId, user) {
  const { metrics, analysis } = getState(db, userId);
  return {
    generatedAt: metrics.generatedAt,
    company: { ...analysis.company, name: user?.company_name || user?.name || 'Empresa' },
    domains: analysis.domains,
    alerts: analysis.alerts,
    recommendations: analysis.recommendations,
    plan: analysis.plan,
    highlights: {
      pace: metrics.pace,
      profitability: metrics.profitability,
      series: metrics.series,
      topCustomers: metrics.customers.top.slice(0, 5),
      topProducts: metrics.products.top.slice(0, 5),
      stockouts: metrics.products.list.filter((p) => p.stockout).slice(0, 10),
      overdue: metrics.receivable.items.filter((i) => i.overdueDays > 0).slice(0, 10),
      inactiveCustomers: metrics.customers.inactiveList.slice(0, 10),
      reorder: metrics.products.reorderList.slice(0, 10),
      expensesByCategory: metrics.expenses.byCategory.slice(0, 8)
    }
  };
}

function domainReport(db, userId, domainId) {
  const domain = getDomain(domainId);
  if (!domain) {
    const err = new Error(`Domínio desconhecido: ${domainId}`);
    err.status = 404;
    throw err;
  }
  const { metrics, analysis } = getState(db, userId);
  const result = analyzeDomain(domainId, metrics);
  return {
    generatedAt: metrics.generatedAt,
    domain: listDomains(analysis).find((d) => d.id === domainId),
    analysis: analysis.domains.find((d) => d.id === domainId),
    knowledge: getKnowledge(domainId),
    metrics: domainMetrics(domainId, metrics),
    markdown: buildDomainReport(domainId, metrics, analysis)
  };
}

// Recorte das métricas mais relevantes por domínio (evita payload gigante)
function domainMetrics(domainId, m) {
  switch (domainId) {
    case 'financeiro':
      return { revenue: m.revenue, expenses: m.expenses, profitability: m.profitability, cash: m.cash, receivable: m.receivable, payable: m.payable, operations: m.operations };
    case 'estoque':
      return {
        products: { ...m.products, list: m.products.list.map(slim) },
        shipping: m.shipping,
        reorderList: m.products.reorderList.map(slim),
        deadList: m.products.deadList.map(slim)
      };
    case 'comercial':
      return { revenue: m.revenue, customers: m.customers, products: { top: m.products.top.map(slim), byCategory: m.products.byCategory }, marketing: { discountTotal: m.marketing.discountTotal, discountSharePct: m.marketing.discountSharePct, paymentMethods: m.marketing.paymentMethods } };
    case 'marketing':
      return { marketing: m.marketing, customers: { newByMonth: m.customers.newByMonth, newTotal: m.customers.newTotal, repeatRatePct: m.customers.repeatRatePct }, revenue: m.revenue, series: m.series };
    case 'producao':
      return { operations: m.operations, purchases: m.purchases, products: { list: m.products.list.map(slim), turnover: m.products.turnover, stockouts: m.products.stockouts }, profitability: m.profitability };
    case 'empresarial':
    default:
      return { revenue: m.revenue, profitability: m.profitability, cash: m.cash, expenses: { current: m.expenses.current, fixedAvgMonth: m.expenses.fixedAvgMonth, byCategory: m.expenses.byCategory }, concentration: m.concentration, operations: m.operations, series: m.series };
  }
}

function slim(p) {
  return {
    id: p.id, name: p.name, sku: p.sku, category: p.category, unit: p.unit,
    stock: p.stock, minStock: p.minStock, cost: p.cost, price: p.price, marginPct: p.marginPct,
    units90: p.units90, dailyDemand: p.dailyDemand, coverageDays: p.coverageDays,
    totalRevenue: p.totalRevenue, totalUnits: p.totalUnits, stockValueCost: p.stockValueCost,
    suggestedReorder: p.suggestedReorder, stockout: p.stockout, belowMin: p.belowMin,
    overstock: p.overstock, deadStock: p.deadStock, daysWithoutSale: p.daysWithoutSale, class: p.class
  };
}

function alerts(db, userId, { domain = null, severity = null } = {}) {
  const { analysis } = getState(db, userId);
  let list = analysis.alerts;
  if (domain) list = list.filter((a) => a.domain === domain);
  if (severity) list = list.filter((a) => a.severity === severity);
  return {
    count: list.length,
    bySeverity: ['critica', 'alta', 'media', 'baixa'].map((s) => ({ severity: s, count: list.filter((a) => a.severity === s).length })),
    alerts: list
  };
}

function actionPlan(db, userId) {
  const { analysis } = getState(db, userId);
  return {
    generatedAt: analysis.generatedAt,
    company: analysis.company,
    plan: analysis.plan,
    recommendations: analysis.recommendations
  };
}

function reportMarkdown(db, userId, user, { domain = null } = {}) {
  const { metrics, analysis } = getState(db, userId);
  if (domain) {
    const md = buildDomainReport(domain, metrics, analysis);
    return md ? { filename: `relatorio-${domain}.md`, content: md } : null;
  }
  return { filename: reportFilename(), content: buildReport(metrics, analysis, { companyName: user?.company_name || user?.name }) };
}

function knowledge(domainId) {
  if (domainId) {
    const domain = getDomain(domainId);
    if (!domain) return null;
    return { domain: { id: domain.id, name: domain.name, icon: domain.icon }, knowledge: getKnowledge(domainId) };
  }
  return {
    domains: DOMAINS.map((d) => ({ id: d.id, name: d.name, icon: d.icon, knowledge: getKnowledge(d.id) })),
    general: GENERAL
  };
}

function config() {
  const llmConfig = llm.getConfig();
  return {
    version: '1.0.0',
    engine: 'motor de regras local + dados do ERP',
    llm: {
      enabled: llmConfig.enabled,
      provider: llmConfig.provider,
      model: llmConfig.model,
      reason: llmConfig.reason
    },
    domains: DOMAINS.map((d) => ({ id: d.id, name: d.name, icon: d.icon, color: d.color, persona: d.persona })),
    limits: { maxMessageLength: MAX_MESSAGE_LENGTH }
  };
}

// conversas
const conversations = {
  list: (userId) => store.listConversations(userId),
  get: (conversationId, userId) => store.getConversation(conversationId, userId),
  remove: (conversationId, userId) => store.deleteConversation(conversationId, userId)
};

module.exports = {
  getState,
  chat,
  domainsWithScores,
  diagnostic,
  domainReport,
  alerts,
  actionPlan,
  reportMarkdown,
  knowledge,
  config,
  conversations,
  quickPrompts,
  listDomains,
  buildReport,
  reportFilename
};
