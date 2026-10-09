// ============================================================
// AGENTE IA ERP - NLU (compreensão de linguagem natural)
// Classifica a intenção da mensagem em português, identifica o
// domínio da empresa e extrai entidades (período, severidade,
// produto, cliente). Sem dependências externas: funciona offline.
// ============================================================

const { DOMAIN_KEYWORDS, DOMAINS } = require('./domains');

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- intenções ----------
const INTENTS = [
  {
    id: 'saudacao',
    weight: 1,
    patterns: [/^(oi|ola|hey|eai|e ai|bom dia|boa tarde|boa noite|salve)\b/, /^(oi|ola)[\s!,.]*$/]
  },
  {
    id: 'ajuda',
    patterns: [/\b(o que (voce|vc) (faz|pode|consegue))\b/, /\bajuda\b/, /\bcomo (voce|vc) funciona\b/, /\bo que posso (perguntar|pedir)\b/, /\bmenu\b.*\bagent/, /\bcapacidades\b/]
  },
  {
    id: 'diagnostico',
    patterns: [/\bdiagnost/, /\bsaude\b/, /\bsituacao\b/, /\bcomo esta\b/, /\bcomo estamos\b/, /\bcomo vai\b/, /\banalise (geral|completa|da empresa)\b/, /\bpanorama\b/, /\bcenario\b/, /\bcheck ?up\b/, /\bavali/, /\bstatus\b/]
  },
  {
    id: 'alertas',
    patterns: [/\balerta/, /\bproblema/, /\brisco/, /\burgente/, /\bcritic/, /\bpreocup/, /\berro/, /\bfalha/, /\batencao\b/, /\bo que esta (errado|ruim|fora)\b/, /\bpendencia/, /\bvencido/]
  },
  {
    id: 'plano',
    patterns: [/\bo que (eu )?(devo|posso|preciso) faz/, /\bplano\b/, /\bplano de acao\b/, /\bprioridade/, /\brecomend/, /\bsugest/, /\bdica/, /\bmelhorar/, /\bacao\b/, /\bpor onde come/, /\bprimeiro passo/, /\bcomo (aumentar|reduzir|resolver)/]
  },
  {
    id: 'previsao',
    patterns: [/\bprevis/, /\bprojet/, /\bproxim(o|a) (mes|semana|trimestre)\b/, /\btendencia\b/, /\bvai (ser|dar|fechar|sobrar|faltar)\b/, /\bcenario (futuro|otimista|pessimista)\b/, /\bestim/]
  },
  {
    id: 'relatorio',
    patterns: [/\brelatorio\b/, /\bresumo\b/, /\bfechamento\b/, /\bdre\b/, /\bexportar\b/, /\bdocumentar\b/, /\bata\b/, /\bapresenta/]
  },
  {
    id: 'conceito',
    patterns: [/\bo que (e|eh|significa)\b/, /\bcomo (se )?calcul/, /\bformula\b/, /\bqual (e|eh) a diferenca\b/, /\bpara que serve\b/, /\bconceito\b/, /\bdefinicao\b/, /\bcomo funciona\b/, /\bmetodologia\b/, /\bexempl/]
  },
  {
    id: 'como_fazer',
    patterns: [
      /\b(como|onde|qual)\b.{0,40}\b(no|dentro do|pelo) (sistema|erp|menu|modulo)\b/,
      /\bpasso a passo\b/,
      /\btutorial\b/,
      /\bonde (fico|fica|esta|vejo|encontro|lanco|registro|cadastro)\b.{0,30}\b(sistema|erp|menu|tela|modulo|pagina)\b/,
      /\bcomo (faco|faço|fazer|registrar|registro|lancar|lanco|cadastr|emitir|emito|cobrar|cobro|repor|reponho|baixar|baixo|ajustar|ajusto)\b.{0,40}\b(venda|vendas|compra|compras|despesa|despesas|cliente|clientes|produto|produtos|estoque|titulo|pagamento|recebimento|nota|nf|fatura|inventario)\b/
    ]
  },
  {
    id: 'lista',
    patterns: [/\bliste\b/, /\blistar\b/, /\bmostre\b/, /\bmostrar\b/, /\bquais (sao|os|as|clientes|produtos|itens)\b/, /\btop \d+\b/, /\brank/, /\bcabeca\b/, /\brelacao de\b/, /\benumer/, /\bgargalo/, /\brestricao/, /\bruptura/, /\breposicao/, /\bvencido/, /\binativo/]
  },
  {
    id: 'comparar',
    patterns: [/\bcompar/, /\bevolucao\b/, /\bvariacao\b/, /\bversus\b/, /\b vs\b/, /\bdiferenca\b/, /\bmes (anterior|passado)\b/, /\bcresci/, /\bcaiu\b/, /\bmudou\b/]
  },
  {
    id: 'kpis',
    patterns: [/\bquanto(s)?\b/, /\bqual (o|a|e|eh) (valor|numero|total|receita|lucro|saldo|margem|ticket|giro)\b/, /\bindicador/, /\bkpi/, /\bmetr/, /\bnumero/, /\btotal\b/, /\bsaldo\b/, /\bvalor\b/]
  }
];

const INTENT_LABELS = {
  saudacao: 'Saudação',
  ajuda: 'Ajuda',
  diagnostico: 'Diagnóstico',
  alertas: 'Alertas e riscos',
  plano: 'Plano de ação',
  previsao: 'Projeção',
  relatorio: 'Relatório',
  conceito: 'Conceito',
  como_fazer: 'Como fazer no ERP',
  lista: 'Listagem',
  comparar: 'Comparação',
  kpis: 'Indicadores'
};

// Termos que indicam escopo global (a empresa como um todo)
const GENERIC_GLOBAL = new Set([
  'empresa', 'negócio', 'negocio', 'geral', 'global', 'diretor', 'ceo', 'sócios', 'socios',
  'saúde', 'saude', 'resumo', 'diagnóstico', 'diagnostico', 'visão geral', 'status', 'panorama'
].map((t) => normalize(t)));

// ---------- detecção de domínio ----------
function detectDomain(text, explicitDomain = null) {
  const normalized = normalize(text);
  if (explicitDomain && DOMAIN_KEYWORDS[explicitDomain]) {
    return { domain: explicitDomain, confidence: 1, matched: ['domínio explícito'], global: false };
  }
  const scores = {};
  const matched = {};
  Object.entries(DOMAIN_KEYWORDS).forEach(([domainId, keywords]) => {
    let score = 0;
    const hits = [];
    keywords.forEach((kw) => {
      const k = normalize(kw);
      if (!k) return;
      const re = new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'g');
      const occurrences = (normalized.match(re) || []).length;
      if (occurrences > 0) {
        // palavras compostas valem mais
        score += occurrences * (k.includes(' ') ? 3 : 1);
        hits.push(kw);
      }
    });
    if (score > 0) {
      scores[domainId] = score;
      matched[domainId] = hits;
    }
  });

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { domain: null, confidence: 0, matched: [], global: false };
  const [topId, topScore] = ranked[0];
  const secondScore = ranked[1] ? ranked[1][1] : 0;
  const confidence = topScore / (topScore + secondScore || 1);
  const hits = matched[topId] || [];

  // "empresa", "negócio", "geral", "saúde" etc. indicam visão GLOBAL, não a área
  // Gestão Empresarial. Só devolvemos 'empresarial' quando há termo específico
  // (DRE, ponto de equilíbrio, meta, risco, planejamento, estratégia...) ou
  // quando o usuário pediu explicitamente essa área.
  if (topId === 'empresarial' && secondScore === 0 && hits.every((h) => GENERIC_GLOBAL.has(normalize(h)))) {
    return { domain: null, confidence: Math.min(1, Math.round(confidence * 100) / 100), matched: hits, global: true };
  }

  return { domain: topId, confidence: Math.min(1, Math.round(confidence * 100) / 100), matched: hits, global: false };
}

// ---------- detecção de intenção ----------
function detectIntent(text) {
  const normalized = normalize(text);
  const scored = [];
  INTENTS.forEach((intent) => {
    let hits = 0;
    intent.patterns.forEach((re) => {
      if (re.test(normalized)) hits += 1;
    });
    if (hits > 0) scored.push({ id: intent.id, hits });
  });
  if (!scored.length) return { intent: 'kpis', confidence: 0.2 };
  scored.sort((a, b) => b.hits - a.hits);
  return { intent: scored[0].id, confidence: Math.min(1, Math.round((scored[0].hits / Math.max(2, scored.reduce((a, s) => a + s.hits, 0))) * 200) / 100) };
}

// ---------- entidades ----------
function detectEntities(text, context = {}) {
  const normalized = normalize(text);
  const entities = {};

  // Período
  if (/\bhoje\b|\bno dia\b/.test(normalized)) entities.period = 'today';
  else if (/\beste mes\b|\bmes atual\b|\bmes corrente\b/.test(normalized)) entities.period = 'current_month';
  else if (/\bmes (passado|anterior)\b|\bultimo mes\b/.test(normalized)) entities.period = 'previous_month';
  else if (/\beste ano\b|\bano atual\b/.test(normalized)) entities.period = 'current_year';
  else if (/\bultimos (\d+|tres|seis|doze) meses\b/.test(normalized)) {
    const m = normalized.match(/ultimos (\d+|tres|seis|doze) meses/);
    const map = { tres: 3, seis: 6, doze: 12 };
    entities.period = 'last_n_months';
    entities.months = map[m[1]] || Number(m[1]) || 6;
  } else if (/\bsemana\b/.test(normalized)) entities.period = 'week';
  else if (/\btrimestre\b/.test(normalized)) entities.period = 'quarter';

  // Severidade
  if (/\bcritic|urgent|imediato|grave/.test(normalized)) entities.severity = 'critica';
  else if (/\balta prioridade|importante/.test(normalized)) entities.severity = 'alta';

  // Ordenação / quantidade
  const topMatch = normalized.match(/\btop (\d+)\b/);
  if (topMatch) entities.limit = Math.min(20, Number(topMatch[1]));
  if (/\bmaior|\bmelhor(es)?\b/.test(normalized)) entities.order = 'desc';
  if (/\bmenor|\bpior(es)?\b/.test(normalized)) entities.order = 'asc';

  // Produto (busca por nome/sku na lista disponível)
  const products = context.products || [];
  if (products.length) {
    const found = products.find((p) => {
      const name = normalize(p.name);
      const sku = normalize(p.sku || '');
      return (name.length > 3 && normalized.includes(name)) || (sku.length > 3 && normalized.includes(sku));
    });
    if (found) entities.product = { id: found.id, name: found.name, sku: found.sku };
  }

  // Cliente
  const customers = context.customers || [];
  if (customers.length) {
    const found = customers.find((c) => {
      const name = normalize(c.name || '');
      if (name.length < 4) return false;
      const parts = name.split(' ');
      return normalized.includes(name) || parts.some((part) => part.length > 3 && normalized.includes(part));
    });
    if (found) entities.customer = { id: found.id, name: found.name };
  }

  // Valor monetário mencionado
  const money = text.match(/R\$\s?([\d.,]+)/i);
  if (money) entities.money = money[1];

  return entities;
}

// ---------- análise completa ----------
function parse(text, context = {}) {
  const raw = String(text || '').trim();
  const normalized = normalize(raw);
  const domainDetection = detectDomain(raw, context.domain);
  const intentDetection = detectIntent(raw);
  const entities = detectEntities(raw, context);

  return {
    raw,
    normalized,
    intent: intentDetection.intent,
    intentLabel: INTENT_LABELS[intentDetection.intent] || intentDetection.intent,
    intentConfidence: intentDetection.confidence,
    domain: domainDetection.domain,
    globalScope: Boolean(domainDetection.global),
    domainConfidence: domainDetection.confidence,
    domainKeywords: domainDetection.matched,
    entities,
    words: normalized.split(' ').filter(Boolean).length,
    isShort: normalized.length < 12,
    allDomains: DOMAINS.map((d) => d.id)
  };
}

module.exports = { parse, detectDomain, detectIntent, detectEntities, normalize, INTENT_LABELS };
