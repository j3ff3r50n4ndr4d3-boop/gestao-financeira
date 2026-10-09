// ============================================================
// AGENTE IA ERP - frontend do módulo de inteligência
// Consome /api/agent: diagnóstico das 6 áreas, alertas, plano
// de ação, base de conhecimento e chat com o agente.
// ============================================================

const AGENT_STATE = {
  ready: false,
  tab: 'visao',
  config: null,
  diagnostic: null,
  domains: [],
  domainDetail: null,
  activeDomain: null,
  chatDomain: null,
  conversationId: null,
  messages: [],
  conversations: [],
  filters: { domain: null, severity: null },
  charts: {},
  busy: false
};

const AGENT_LEVEL_COLOR = {
  Excelente: '#10b981',
  Bom: '#22c55e',
  'Atenção': '#f59e0b',
  'Crítico': '#ef4444',
  'Sem dados': '#94a3b8'
};

const AGENT_SEVERITY = {
  critica: { label: 'Crítica', icon: '🔴' },
  alta: { label: 'Alta', icon: '🟠' },
  media: { label: 'Média', icon: '🟡' },
  baixa: { label: 'Baixa', icon: '🔵' }
};

const AGENT_PAGE_LABEL = {
  dashboard: 'Dashboard',
  sales: 'Vendas',
  customers: 'Clientes',
  products: 'Produtos/Estoque',
  purchases: 'Compras',
  suppliers: 'Fornecedores',
  expenses: 'Despesas',
  receivable: 'Contas a Receber',
  payable: 'Contas a Pagar',
  cashflow: 'Fluxo de Caixa',
  dre: 'DRE',
  subscriptions: 'Assinaturas',
  course: 'Curso'
};

function agentEsc(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function agentMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function agentNum(value, digits = 0) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

// ============================================================
// Markdown leve e seguro (escapa HTML antes de formatar)
// ============================================================
function agentInline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*_])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;:!?])/g, '$1<em>$2</em>');
}

function agentMarkdown(raw) {
  const lines = agentEsc(raw).split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // tabela
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:-]+\|/.test(lines[i + 1])) {
      const header = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        body.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i += 1;
      }
      out.push(
        `<table><thead><tr>${header.map((h) => `<th>${agentInline(h)}</th>`).join('')}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${agentInline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`
      );
      continue;
    }

    // heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(6, heading[1].length);
      out.push(`<h${level}>${agentInline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // hr
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push('<hr>');
      i += 1;
      continue;
    }

    // blockquote
    if (/^\s*&gt;\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*&gt;\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${agentInline(quote.join(' '))}</blockquote>`);
      continue;
    }

    // lista ordenada
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      out.push(`<ol>${items.map((it) => `<li>${agentInline(it)}</li>`).join('')}</ol>`);
      continue;
    }

    // lista com marcadores
    if (/^\s*([-*•])\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*([-*•])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•])\s+/, ''));
        i += 1;
      }
      out.push(`<ul>${items.map((it) => `<li>${agentInline(it)}</li>`).join('')}</ul>`);
      continue;
    }

    // linha em branco
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // parágrafo (agrupa linhas consecutivas)
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*([-*•]|\d+\.)\s|\s*\||\s*&gt;|\s*-{3,}\s*$)/.test(lines[i])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    if (paragraph.length) out.push(`<p>${agentInline(paragraph.join('<br>'))}</p>`);
    else i += 1;
  }

  return `<div class="agent-md">${out.join('')}</div>`;
}

// ============================================================
// Carga do módulo
// ============================================================
async function loadAgent() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🤖 Agente IA</h1>
        <p class="page-subtitle">Consultor de gestão das 6 áreas da empresa</p>
      </div>
    </div>
    <div class="card"><div class="loading"><div class="spinner"></div>Analisando os dados da empresa...</div></div>
  `;

  try {
    const [config, diagnostic] = await Promise.all([
      api('/api/agent/config'),
      api('/api/agent/diagnostic')
    ]);
    AGENT_STATE.config = config;
    AGENT_STATE.diagnostic = diagnostic;
    AGENT_STATE.domains = diagnostic.domains;
    AGENT_STATE.ready = true;
    renderAgentShell();
  } catch (err) {
    container.innerHTML = `<div class="card"><p>Erro ao carregar o agente: ${agentEsc(err.message)}</p></div>`;
  }
}

function renderAgentShell() {
  const container = document.getElementById('pageContent');
  const d = AGENT_STATE.diagnostic;
  const critical = d.company.criticalAlerts + d.company.highAlerts;
  const llm = AGENT_STATE.config?.llm;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🤖 Agente IA de Gestão</h1>
        <p class="page-subtitle">
          Diagnóstico contínuo de ${agentEsc(d.company.name || 'Empresa')} em 6 áreas — gerado em
          ${new Date(d.generatedAt).toLocaleString('pt-BR')}
        </p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <span class="agent-llm-chip ${llm?.enabled ? '' : 'off'}" title="${agentEsc(llm?.reason || '')}">
          ${llm?.enabled ? `🧠 LLM ativo: ${agentEsc(llm.provider)}` : '⚙️ Motor local (offline)'}
        </span>
        <button class="btn btn-secondary" onclick="loadAgent()">↻ Atualizar análise</button>
        <button class="btn btn-primary" onclick="agentExportReport()">⬇ Exportar relatório</button>
      </div>
    </div>

    <div class="agent-tabs">
      <button class="agent-tab ${AGENT_STATE.tab === 'visao' ? 'active' : ''}" onclick="agentTab('visao')">📊 Visão geral</button>
      <button class="agent-tab ${AGENT_STATE.tab === 'areas' ? 'active' : ''}" onclick="agentTab('areas')">🗂 6 Áreas</button>
      <button class="agent-tab ${AGENT_STATE.tab === 'alertas' ? 'active' : ''}" onclick="agentTab('alertas')">
        🚨 Alertas${d.alerts.length ? `<span class="tab-count">${d.alerts.length}</span>` : ''}
      </button>
      <button class="agent-tab ${AGENT_STATE.tab === 'plano' ? 'active' : ''}" onclick="agentTab('plano')">🎯 Plano de ação</button>
      <button class="agent-tab ${AGENT_STATE.tab === 'chat' ? 'active' : ''}" onclick="agentTab('chat')">💬 Chat</button>
      <button class="agent-tab ${AGENT_STATE.tab === 'conhecimento' ? 'active' : ''}" onclick="agentTab('conhecimento')">📚 Conhecimento</button>
    </div>

    <div id="agentTabContent"></div>
  `;
  renderAgentTab();
}

function agentTab(tab) {
  AGENT_STATE.tab = tab;
  document.querySelectorAll('.agent-tab').forEach((el) => el.classList.remove('active'));
  const idx = ['visao', 'areas', 'alertas', 'plano', 'chat', 'conhecimento'].indexOf(tab);
  document.querySelectorAll('.agent-tab')[idx]?.classList.add('active');
  renderAgentTab();
}

function renderAgentTab() {
  const target = document.getElementById('agentTabContent');
  if (!target) return;
  switch (AGENT_STATE.tab) {
    case 'areas': renderAgentAreas(target); break;
    case 'alertas': renderAgentAlerts(target); break;
    case 'plano': renderAgentPlan(target); break;
    case 'chat': renderAgentChat(target); break;
    case 'conhecimento': renderAgentKnowledge(target); break;
    default: renderAgentOverview(target);
  }
}

// ============================================================
// ABA 1 - Visão geral
// ============================================================
function renderAgentOverview(target) {
  const d = AGENT_STATE.diagnostic;
  const score = d.company.score === null ? 0 : d.company.score;
  const color = AGENT_LEVEL_COLOR[d.company.level.label] || '#6366f1';
  const highlights = d.highlights || {};

  target.innerHTML = `
    <div class="agent-hero">
      <div class="agent-score-card">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:.8">Índice de saúde do negócio</div>
        <div class="agent-gauge" style="--value:${score};--color:${color}">
          <div class="agent-gauge-value">
            <strong>${d.company.score === null ? '—' : agentNum(d.company.score, 1)}</strong>
            <span>de 100</span>
          </div>
        </div>
        <div class="agent-score-level">${agentEsc(d.company.level.label)}</div>
        <div style="margin-top:14px;font-size:12.5px;opacity:.85">
          ${d.company.strongest ? `💪 ${agentEsc(d.company.strongest.name)}: ${agentNum(d.company.strongest.score, 1)}` : ''}<br>
          ${d.company.weakest ? `⚠️ ${agentEsc(d.company.weakest.name)}: ${agentNum(d.company.weakest.score, 1)}` : ''}
        </div>
      </div>

      <div class="agent-summary">
        <div>
          <h3 style="font-size:16px;margin-bottom:8px">Sumário executivo do agente</h3>
          <p>${agentEsc(d.company.summary)}</p>
        </div>
        <div class="agent-summary-stats">
          <div class="agent-stat ${d.company.criticalAlerts ? 'danger' : 'success'}">
            <strong>${d.company.criticalAlerts}</strong><span>alertas críticos</span>
          </div>
          <div class="agent-stat ${d.company.highAlerts ? 'warning' : 'success'}">
            <strong>${d.company.highAlerts}</strong><span>alta prioridade</span>
          </div>
          <div class="agent-stat">
            <strong>${d.company.totalRecommendations}</strong><span>recomendações</span>
          </div>
          <div class="agent-stat">
            <strong>${agentMoney(highlights.series?.[highlights.series.length - 1]?.revenue || 0)}</strong><span>receita do mês</span>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="agentTab('chat');agentAsk('Como está a saúde da empresa?')">💬 Perguntar ao agente</button>
          <button class="btn btn-secondary" onclick="agentTab('alertas')">Ver ${d.alerts.length} alertas</button>
          <button class="btn btn-secondary" onclick="agentTab('plano')">Ver plano de ação</button>
        </div>
      </div>
    </div>

    <div class="agent-two-col">
      <div class="agent-block">
        <h3>🕸 Nota por área</h3>
        <div class="agent-chart-wrap"><canvas id="agentRadar"></canvas></div>
      </div>
      <div class="agent-block">
        <h3>📈 Evolução mensal (receita x despesas x resultado)</h3>
        <div class="agent-chart-wrap"><canvas id="agentSeries"></canvas></div>
        <p class="agent-chart-note" id="agentSeriesNote"></p>
      </div>
    </div>

    <h3 style="margin:6px 0 14px;font-size:16px">As 6 áreas monitoradas</h3>
    <div class="agent-domain-grid">
      ${d.domains.map((dom) => agentDomainCard(dom)).join('')}
    </div>
  `;

  agentDrawRadar();
  agentDrawSeries();
}

function agentDomainCard(dom) {
  const color = dom.color || '#6366f1';
  const score = dom.score === null ? 0 : dom.score;
  return `
    <div class="agent-domain-card" style="--agent-color:${color}" onclick="agentOpenDomain('${dom.id}')">
      <div class="agent-domain-head">
        <div class="agent-domain-title">
          <div class="agent-domain-icon">${dom.icon}</div>
          <div>
            <h3>${agentEsc(dom.name)}</h3>
            <small>${agentEsc(dom.level?.label || 'Sem dados')}</small>
          </div>
        </div>
        <div class="agent-domain-score">
          <strong>${dom.score === null ? '—' : agentNum(dom.score, 1)}</strong>
          <span>/100</span>
        </div>
      </div>
      <div class="agent-bar"><div class="agent-bar-fill" style="width:${score}%"></div></div>
      <div class="agent-domain-meta">
        <span class="agent-pill ${dom.alerts.some((a) => a.severity === 'critica') ? 'critica' : dom.alerts.length ? 'media' : 'ok'}">
          ${dom.alerts.length} alerta${dom.alerts.length === 1 ? '' : 's'}
        </span>
        <span class="agent-pill">${dom.recommendations.length} ação${dom.recommendations.length === 1 ? '' : 'ões'}</span>
        <span class="agent-pill">${dom.insights.length} leitura${dom.insights.length === 1 ? '' : 's'}</span>
      </div>
      <div style="font-size:12.8px;color:#6b7280">${agentEsc(dom.insights[0] || 'Sem leituras para esta área no momento.')}</div>
    </div>
  `;
}

function agentDrawRadar() {
  const canvas = document.getElementById('agentRadar');
  if (!canvas || typeof Chart === 'undefined') return;
  if (AGENT_STATE.charts.radar) AGENT_STATE.charts.radar.destroy();
  const d = AGENT_STATE.diagnostic;
  AGENT_STATE.charts.radar = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: d.domains.map((x) => `${x.icon} ${x.shortName}`),
      datasets: [{
        label: 'Nota da área',
        data: d.domains.map((x) => (x.score === null ? 0 : x.score)),
        backgroundColor: 'rgba(99, 102, 241, 0.18)',
        borderColor: '#6366f1',
        pointBackgroundColor: d.domains.map((x) => AGENT_LEVEL_COLOR[x.level?.label] || '#6366f1'),
        pointRadius: 5,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, backdropColor: 'transparent' }, pointLabels: { font: { size: 11 } } } },
      plugins: { legend: { display: false } }
    }
  });
}

function agentDrawSeries() {
  const canvas = document.getElementById('agentSeries');
  const note = document.getElementById('agentSeriesNote');
  const series = (AGENT_STATE.diagnostic.highlights || {}).series || [];
  const pace = (AGENT_STATE.diagnostic.highlights || {}).pace;

  // mês em andamento fica marcado com * e explicado na nota abaixo do gráfico
  // (a nota é preenchida mesmo se o Chart.js não carregar)
  if (note) {
    note.innerHTML = pace && pace.isPartial
      ? `* ${agentEsc(String(pace.daysElapsed))} de ${agentEsc(String(pace.daysInMonth))} dias do mês em andamento — ${agentEsc(pace.basis || 'ritmo do mês')}: receita projetada de <strong>${agentMoney(pace.revenue)}</strong> e resultado projetado de <strong>${agentMoney(pace.result)}</strong>.`
      : '';
  }

  if (!canvas || typeof Chart === 'undefined') return;
  if (AGENT_STATE.charts.series) AGENT_STATE.charts.series.destroy();

  AGENT_STATE.charts.series = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: series.map((s) => (s.partial ? `${s.label}*` : s.label)),
      datasets: [
        { label: 'Receita', data: series.map((s) => s.revenue), backgroundColor: 'rgba(16, 185, 129, 0.75)', borderRadius: 4 },
        { label: 'Despesas', data: series.map((s) => s.expenses), backgroundColor: 'rgba(239, 68, 68, 0.7)', borderRadius: 4 },
        { label: 'Resultado (após CMV)', data: series.map((s) => s.result), type: 'line', borderColor: '#6366f1', backgroundColor: '#6366f1', tension: 0.3, fill: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: { y: { ticks: { callback: (v) => `R$ ${(v / 1000).toFixed(0)}k` } } }
    }
  });
}

// ============================================================
// ABA 2 - Áreas (detalhe)
// ============================================================
function renderAgentAreas(target) {
  const d = AGENT_STATE.diagnostic;
  const active = AGENT_STATE.activeDomain ? d.domains.find((x) => x.id === AGENT_STATE.activeDomain) : null;

  target.innerHTML = `
    <div class="agent-domain-grid" style="margin-bottom:20px">
      ${d.domains.map((dom) => `
        <div class="agent-domain-card ${AGENT_STATE.activeDomain === dom.id ? 'selected' : ''}" style="--agent-color:${dom.color}" onclick="agentOpenDomain('${dom.id}')">
          <div class="agent-domain-head">
            <div class="agent-domain-title">
              <div class="agent-domain-icon">${dom.icon}</div>
              <div><h3>${agentEsc(dom.shortName)}</h3><small>${agentEsc(dom.level?.label || 'Sem dados')}</small></div>
            </div>
            <div class="agent-domain-score"><strong>${dom.score === null ? '—' : agentNum(dom.score, 1)}</strong><span>/100</span></div>
          </div>
          <div class="agent-bar"><div class="agent-bar-fill" style="width:${dom.score === null ? 0 : dom.score}%"></div></div>
        </div>
      `).join('')}
    </div>
    <div id="agentDomainDetail">
      ${agentDomainDetailPlaceholder(active)}
    </div>
  `;

  if (active && !agentHasCachedDetail(active.id)) agentFetchDomain(active.id);
}

function agentHasCachedDetail(domainId) {
  return Boolean(AGENT_STATE.domainDetail && AGENT_STATE.domainDetail.domain && AGENT_STATE.domainDetail.domain.id === domainId);
}

function agentDomainDetailPlaceholder(active) {
  if (!active) {
    return '<div class="card"><div class="empty-state">👆 Selecione uma das 6 áreas acima para ver a análise completa: nota, indicadores, leituras, alertas, plano de ação, dados usados e conceitos de referência.</div></div>';
  }
  if (agentHasCachedDetail(active.id)) {
    return agentDomainDetail(AGENT_STATE.domainDetail.analysis, AGENT_STATE.domainDetail);
  }
  return '<div class="card"><div class="loading"><div class="spinner"></div>Aprofundando a análise da área...</div></div>';
}

async function agentOpenDomain(domainId) {
  AGENT_STATE.activeDomain = domainId;
  AGENT_STATE.tab = 'areas';
  renderAgentShell();
  await agentFetchDomain(domainId);
}

async function agentFetchDomain(domainId) {
  try {
    const detail = await api(`/api/agent/domains/${domainId}`);
    AGENT_STATE.domainDetail = detail;
    const container = document.getElementById('agentDomainDetail');
    if (container && AGENT_STATE.activeDomain === domainId && AGENT_STATE.tab === 'areas') {
      container.innerHTML = agentDomainDetail(detail.analysis, detail);
    }
  } catch (err) {
    const container = document.getElementById('agentDomainDetail');
    if (container) container.innerHTML = `<div class="card"><p>Erro ao aprofundar a área: ${agentEsc(err.message)}</p></div>`;
  }
}

function agentDomainDetail(dom, detail = null) {
  const domainInfo = detail?.domain || dom;
  const color = domainInfo.color || dom.color || '#6366f1';
  const knowledge = detail?.knowledge || null;

  return `
    <div style="--agent-color:${color}">
      <div class="agent-detail-head">
        <div class="agent-domain-icon">${domainInfo.icon || dom.icon}</div>
        <div style="flex:1">
          <h2 style="font-size:20px">${agentEsc(domainInfo.name || dom.name)}</h2>
          <div style="color:var(--gray);font-size:13px">
            Perfil do agente: <strong>${agentEsc(domainInfo.persona || '')}</strong>
            ${dom.score !== null ? ` • Nota <strong style="color:${color}">${agentNum(dom.score, 1)}/100 (${agentEsc(dom.level?.label || '')})</strong>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="agentAskDomain('${dom.id || domainInfo.id}')">💬 Perguntar sobre esta área</button>
          <button class="btn btn-secondary" onclick="agentExportDomain('${dom.id || domainInfo.id}')">⬇ Relatório da área</button>
        </div>
      </div>

      <p class="agent-mission">${agentEsc(domainInfo.mission || '')}</p>

      <div class="agent-kpi-strip">
        ${(dom.kpis || []).map((k) => `
          <div class="agent-kpi">
            <span>${agentEsc(k.label)}</span>
            <strong>${agentEsc(k.value)}</strong>
            ${k.trend ? `<em class="${k.tone === 'negative' ? 'negative' : k.tone === 'positive' ? 'positive' : 'neutral'}">${agentEsc(k.trend)}</em>` : ''}
          </div>
        `).join('')}
      </div>

      ${dom.scoreBreakdown && dom.scoreBreakdown.length ? `
      <div class="agent-block">
        <h3>🧮 Como a nota foi calculada</h3>
        <div class="table-container">
          <table>
            <thead><tr><th>Componente</th><th>Peso</th><th>Pontuação</th><th></th></tr></thead>
            <tbody>
              ${dom.scoreBreakdown.map((s) => `
                <tr>
                  <td>${agentEsc(s.name)}</td>
                  <td>${agentNum(s.weight, 1)}</td>
                  <td><strong>${agentNum(s.score, 1)}</strong>/100</td>
                  <td style="width:40%"><div class="agent-bar" style="--agent-color:${color}"><div class="agent-bar-fill" style="width:${Math.max(0, Math.min(100, s.score))}%"></div></div></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}

      <div class="agent-block">
        <h3>🔎 Leitura do agente</h3>
        <ul class="agent-list">
          ${(dom.insights || []).map((i) => `<li>${agentEsc(i)}</li>`).join('') || '<li>Sem leituras para esta área.</li>'}
        </ul>
      </div>

      <div class="agent-block">
        <h3>🚨 Alertas da área (${(dom.alerts || []).length})</h3>
        ${(dom.alerts || []).map(agentAlertCard).join('') || '<p style="color:var(--gray)">Nenhum indicador saiu da faixa de referência. ✅</p>'}
      </div>

      <div class="agent-block">
        <h3>🎯 Plano de ação da área (${(dom.recommendations || []).length})</h3>
        ${(dom.recommendations || []).map(agentRecCard).join('') || '<p style="color:var(--gray)">Nenhuma ação pendente.</p>'}
      </div>

      ${domainInfo.links?.length ? `
      <div class="agent-block">
        <h3>🔗 Módulos relacionados</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${domainInfo.links.map((l) => `<button class="btn btn-secondary" onclick="agentGoto('${l.page}')">${agentEsc(l.label || AGENT_PAGE_LABEL[l.page] || l.page)}</button>`).join('')}
        </div>
      </div>` : ''}

      ${domainInfo.routines?.length ? `
      <div class="agent-block">
        <h3>⏱ Rotinas de gestão recomendadas</h3>
        ${domainInfo.routines.map((r) => `<div class="agent-routine"><strong>${agentEsc(r.name)}</strong> <span>${agentEsc(r.cadence)} — ${agentEsc(r.focus)}</span></div>`).join('')}
      </div>` : ''}

      ${knowledge?.concepts?.length ? `
      <div class="agent-block">
        <h3>📚 Conceitos e fórmulas de referência</h3>
        ${knowledge.concepts.map((c) => `
          <div class="agent-knowledge-card">
            <strong>${agentEsc(c.term)}</strong>
            <div class="formula">${agentEsc(c.formula)}</div>
            <p>${agentEsc(c.explanation)}</p>
            <div class="target">🎯 ${agentEsc(c.target)}</div>
          </div>`).join('')}
      </div>` : ''}

      ${knowledge?.playbooks?.length ? `
      <div class="agent-block">
        <h3>🧭 Playbooks da área</h3>
        ${knowledge.playbooks.map((p) => `
          <div class="agent-knowledge-card">
            <strong>${agentEsc(p.title)}</strong>
            <div class="target">${agentEsc(p.when)} • Indicador: ${agentEsc(p.kpi)}</div>
            <ol style="margin:8px 0 0 18px;font-size:13.5px">${p.steps.map((s) => `<li style="margin-bottom:4px">${agentEsc(s)}</li>`).join('')}</ol>
          </div>`).join('')}
      </div>` : ''}

      ${knowledge?.checkup?.length ? `
      <div class="agent-block">
        <h3>✅ Check-up da área</h3>
        <ul class="agent-checkup">${knowledge.checkup.map((q) => `<li>${agentEsc(q)}</li>`).join('')}</ul>
      </div>` : ''}

      ${detail?.metrics ? agentDomainMetrics(detail) : ''}
    </div>
  `;
}

// Tabelas de dados específicos por área (anexos do relatório)
function agentDomainMetrics(detail) {
  const id = detail.domain?.id;
  const m = detail.metrics || {};
  const blocks = [];

  if (id === 'estoque' && m.products?.list?.length) {
    blocks.push(tableBlock('📦 Situação item a item', ['Produto', 'Estoque', 'Mínimo', 'Cobertura', 'Demanda/mês', 'Giro', 'Valor (custo)', 'Repor'],
      m.products.list.map((p) => [
        p.name,
        `${agentNum(p.stock)} ${p.unit}`,
        agentNum(p.minStock),
        p.coverageDays === null ? 'sem demanda' : `${agentNum(p.coverageDays)} d`,
        agentNum(p.dailyDemand * 30, 1),
        p.stock > 0 && p.dailyDemand > 0 ? agentNum(p.dailyDemand * 30 / Math.max(1, p.stock), 2) + 'x/mês' : '-',
        agentMoney(p.stockValueCost),
        p.suggestedReorder > 0 ? `${agentNum(p.suggestedReorder)} ${p.unit}` : '—'
      ])));
  }

  if (id === 'comercial' && m.customers?.top?.length) {
    blocks.push(tableBlock('🤝 Clientes (curva ABC)', ['Cliente', 'Receita', '% da receita', 'Pedidos', 'Classe', 'Última compra'],
      m.customers.top.map((c) => [c.name, agentMoney(c.revenue), `${agentNum(c.sharePct, 1)}%`, agentNum(c.orders), c.class, c.lastSale || '-'])));
    if (m.customers.inactiveList?.length) {
      blocks.push(tableBlock('😴 Clientes inativos (90+ dias)', ['Cliente', 'Última compra', 'Dias sem comprar', 'Receita histórica'],
        m.customers.inactiveList.map((c) => [c.name, c.lastSale, agentNum(c.daysSince), agentMoney(c.revenue)])));
    }
  }

  if (id === 'financeiro') {
    if (m.receivable?.items?.length) {
      blocks.push(tableBlock('💰 Contas a receber', ['Cliente', 'Título', 'Valor', 'Vencimento', 'Status'],
        m.receivable.items.map((i) => [i.customer, i.description, agentMoney(i.amount), i.dueDate || '-', i.overdueDays > 0 ? `vencido há ${i.overdueDays} d` : 'em dia'])));
    }
    if (m.payable?.items?.length) {
      blocks.push(tableBlock('💸 Contas a pagar', ['Fornecedor', 'Título', 'Valor', 'Vencimento', 'Status'],
        m.payable.items.map((i) => [i.supplier, i.description, agentMoney(i.amount), i.dueDate || '-', i.overdueDays > 0 ? `vencido há ${i.overdueDays} d` : 'em dia'])));
    }
    if (m.expenses?.byCategory?.length) {
      blocks.push(tableBlock('🧾 Despesas por categoria', ['Categoria', 'Total', 'Lançamentos'],
        m.expenses.byCategory.map((e) => [e.category, agentMoney(e.total), agentNum(e.qty)])));
    }
  }

  if (id === 'producao') {
    if (m.purchases?.costDrift?.length) {
      blocks.push(tableBlock('🏭 Variação de custo de compra', ['Produto', 'Custo cadastrado', 'Última compra', 'Desvio', 'Impacto no estoque'],
        m.purchases.costDrift.map((c) => [c.name, agentMoney(c.registeredCost), agentMoney(c.lastPurchaseCost), `${agentNum(c.driftPct, 1)}%`, agentMoney(c.stockImpact)])));
    }
    if (m.purchases?.supplierSpend?.length) {
      blocks.push(tableBlock('🚚 Compras por fornecedor', ['Fornecedor', 'Total', '%', 'Compras'],
        m.purchases.supplierSpend.map((s) => [s.supplier, agentMoney(s.total), `${agentNum(s.sharePct, 1)}%`, agentNum(s.qty)])));
    }
  }

  if (id === 'marketing' && m.marketing?.portfolio) {
    const p = m.marketing.portfolio;
    blocks.push(tableBlock('📣 Matriz BCG do portfólio', ['Classificação', 'Produtos'], [
      ['⭐ Estrela (investir)', (p.estrela || []).map((x) => x.name).join(', ') || '—'],
      ['🐄 Vaca leiteira (manter)', (p.vaca || []).map((x) => x.name).join(', ') || '—'],
      ['❓ Interrogação (testar)', (p.interrogacao || []).map((x) => x.name).join(', ') || '—'],
      ['🍍 Abacaxi (revisar/sair)', (p.abacaxi || []).map((x) => x.name).join(', ') || '—']
    ]));
  }

  if (id === 'empresarial' && m.series?.length) {
    blocks.push(tableBlock('🏢 Série mensal', ['Mês', 'Receita', 'CMV', 'Despesas', 'Resultado', 'Vendas'],
      m.series.map((s) => [s.label, agentMoney(s.revenue), agentMoney(s.cogs), agentMoney(s.expenses), agentMoney(s.result), agentNum(s.salesCount)])));
  }

  if (!blocks.length) return '';
  return `<div class="agent-block"><h3>📋 Dados usados nesta análise</h3>${blocks.join('')}</div>`;
}

function tableBlock(title, headers, rowsList) {
  if (!rowsList || !rowsList.length) return '';
  return `
    <div style="margin-bottom:16px">
      <strong style="font-size:13.5px;display:block;margin-bottom:6px">${agentEsc(title)}</strong>
      <div class="table-container agent-table-block">
        <table>
          <thead><tr>${headers.map((h) => `<th>${agentEsc(h)}</th>`).join('')}</tr></thead>
          <tbody>${rowsList.map((r) => `<tr>${r.map((c) => `<td>${agentEsc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================================
// ABA 3 - Alertas
// ============================================================
function renderAgentAlerts(target) {
  const d = AGENT_STATE.diagnostic;
  const f = AGENT_STATE.filters;
  let list = d.alerts;
  if (f.domain) list = list.filter((a) => a.domain === f.domain);
  if (f.severity) list = list.filter((a) => a.severity === f.severity);

  target.innerHTML = `
    <div class="agent-block">
      <h3>🚨 Central de alertas</h3>
      <p style="color:var(--gray);font-size:13.5px;margin-bottom:14px">
        Cada alerta nasce de uma regra aplicada aos dados reais do ERP, com severidade e impacto estimado em reais.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <button class="agent-chip ${!f.severity ? 'active' : ''}" onclick="agentFilter('severity', null)">Todas as severidades</button>
        ${Object.entries(AGENT_SEVERITY).map(([key, v]) => `
          <button class="agent-chip ${f.severity === key ? 'active' : ''}" onclick="agentFilter('severity','${key}')">
            ${v.icon} ${v.label} (${d.alerts.filter((a) => a.severity === key).length})
          </button>`).join('')}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
        <button class="agent-chip ${!f.domain ? 'active' : ''}" onclick="agentFilter('domain', null)">Todas as áreas</button>
        ${d.domains.map((dom) => `
          <button class="agent-chip ${f.domain === dom.id ? 'active' : ''}" onclick="agentFilter('domain','${dom.id}')">
            ${dom.icon} ${dom.shortName} (${dom.alerts.length})
          </button>`).join('')}
      </div>
      ${list.length ? list.map(agentAlertCard).join('') : '<div class="empty-state">✅ Nenhum alerta com esses filtros.</div>'}
    </div>
  `;
}

function agentFilter(key, value) {
  AGENT_STATE.filters[key] = value;
  renderAgentAlerts(document.getElementById('agentTabContent'));
}

function agentAlertCard(a) {
  const sev = AGENT_SEVERITY[a.severity] || { label: a.severity, icon: '⚪' };
  const domain = AGENT_STATE.diagnostic.domains.find((d) => d.id === a.domain);
  return `
    <div class="agent-alert ${a.severity}">
      <div class="agent-alert-head">
        <span class="agent-pill ${a.severity}">${sev.icon} ${sev.label}</span>
        <strong>${agentEsc(a.title)}</strong>
        ${domain ? `<span class="agent-pill">${domain.icon} ${agentEsc(domain.shortName)}</span>` : ''}
      </div>
      <p>${agentEsc(a.detail)}</p>
      <div class="agent-alert-foot">
        ${a.impact ? `<span>💸 Impacto estimado: <strong>${agentEsc(a.impact)}</strong></span>` : ''}
        ${a.page ? `<button class="agent-link" onclick="agentGoto('${a.page}')">Abrir ${agentEsc(AGENT_PAGE_LABEL[a.page] || a.page)} →</button>` : ''}
        <button class="agent-link" onclick="agentAsk('O que fazer sobre: ${agentEsc(a.title.replace(/'/g, ''))}?')">O que fazer?</button>
      </div>
    </div>
  `;
}

// ============================================================
// ABA 4 - Plano de ação
// ============================================================
function renderAgentPlan(target) {
  const plan = AGENT_STATE.diagnostic.plan;
  const recs = AGENT_STATE.diagnostic.recommendations;
  const byPriority = (p) => recs.filter((r) => r.priority === p);

  const column = (title, subtitle, priority, items, alertBlock) => `
    <div class="agent-plan-col">
      <h3>${title}</h3>
      <small>${subtitle}</small>
      ${items.length ? items.map(agentRecCard).join('') : '<p style="color:var(--gray);font-size:13.5px">Nenhuma ação neste horizonte.</p>'}
      ${alertBlock && alertBlock.alerts.length ? `
        <div style="margin-top:14px;border-top:1px dashed var(--border);padding-top:12px">
          <strong style="font-size:12.5px;color:var(--gray);text-transform:uppercase;letter-spacing:.5px">Alertas deste horizonte</strong>
          ${alertBlock.alerts.map((a) => `
            <div style="font-size:13px;margin-top:6px">
              ${(AGENT_SEVERITY[a.severity] || {}).icon || ''} ${agentEsc(a.title)}
              <button class="agent-link" onclick="agentFilter('severity','${a.severity}');agentTab('alertas')">ver</button>
            </div>`).join('')}
        </div>` : ''}
    </div>
  `;

  target.innerHTML = `
    <div class="agent-block" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div>
        <h3 style="margin:0">🎯 Plano de ação priorizado</h3>
        <p style="color:var(--gray);font-size:13.5px;margin:4px 0 0">
          ${recs.length} ações ordenadas por impacto e urgência, cada uma com passo a passo, esforço e resultado esperado.
        </p>
      </div>
      <button class="btn btn-primary" onclick="agentAsk('Monte meu plano de ação para os próximos 30 dias')">💬 Discutir o plano com o agente</button>
    </div>

    <div class="agent-plan-grid">
      ${column('🔥 Agora — 7 dias', 'O que não pode esperar: alertas críticos e de alta prioridade.', 1, byPriority(1), plan.now)}
      ${column('📅 Próximos 30 dias', 'Ajustes de processo e recuperação de receita/caixa.', 2, byPriority(2), plan.next)}
      ${column('🎯 Próximos 90 dias', 'Estruturantes: carteira, portfólio, padronização e metas.', 3, byPriority(3), plan.later)}
    </div>
  `;
}

function agentRecCard(r) {
  const domain = AGENT_STATE.diagnostic.domains.find((d) => d.id === r.domain);
  return `
    <div class="agent-rec">
      <div class="agent-rec-head">
        <strong>${agentEsc(r.title)}</strong>
        <span class="agent-pill">${agentEsc(r.horizon)}</span>
      </div>
      <div class="agent-rec-why">${domain ? `${domain.icon} ` : ''}${agentEsc(r.why)}</div>
      <ol>${r.steps.map((s) => `<li>${agentEsc(s)}</li>`).join('')}</ol>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        ${r.impact ? `<span class="agent-rec-impact">🎯 ${agentEsc(r.impact)}</span>` : ''}
        ${r.effort ? `<span class="agent-pill">Esforço: ${agentEsc(r.effort)}</span>` : ''}
        ${r.page ? `<button class="agent-link" onclick="agentGoto('${r.page}')">Executar em ${agentEsc(AGENT_PAGE_LABEL[r.page] || r.page)} →</button>` : ''}
      </div>
    </div>
  `;
}

// ============================================================
// ABA 5 - Chat
// ============================================================
function renderAgentChat(target) {
  const d = AGENT_STATE.diagnostic;
  target.innerHTML = `
    <div class="agent-chat-layout">
      <div class="agent-chat">
        <div class="agent-chat-top">
          <div class="agent-chat-domain">
            <button class="agent-chip ${!AGENT_STATE.chatDomain ? 'active' : ''}" onclick="agentSetChatDomain(null)">🌐 Visão geral</button>
            ${d.domains.map((dom) => `
              <button class="agent-chip ${AGENT_STATE.chatDomain === dom.id ? 'active' : ''}" onclick="agentSetChatDomain('${dom.id}')">
                ${dom.icon} ${dom.shortName}
              </button>`).join('')}
          </div>
          <button class="agent-chip" onclick="agentNewConversation()">＋ Nova conversa</button>
        </div>
        <div class="agent-messages" id="agentMessages">
          ${AGENT_STATE.messages.length ? AGENT_STATE.messages.map(agentMessageHtml).join('') : agentWelcomeHtml()}
        </div>
        <div class="agent-quick" id="agentQuick"></div>
        <div class="agent-input-row">
          <textarea id="agentInput" rows="1" placeholder="Pergunte ao agente sobre qualquer área da empresa... (Enter envia, Shift+Enter quebra linha)"></textarea>
          <button class="btn btn-primary" id="agentSendBtn" onclick="agentSubmit()">Enviar ➤</button>
        </div>
      </div>

      <div class="agent-history">
        <h4>Conversas anteriores</h4>
        <div id="agentHistoryList"><div class="loading"><div class="spinner"></div></div></div>
      </div>
    </div>
  `;

  const input = document.getElementById('agentInput');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      agentSubmit();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(140, input.scrollHeight)}px`;
  });

  agentRenderQuickPrompts();
  agentLoadHistory();
  agentScrollChat();
}

function agentWelcomeHtml() {
  const d = AGENT_STATE.diagnostic;
  return `
    <div class="agent-msg bot">
      <div class="agent-bubble agent-md">
        <p>Olá! Sou o <strong>Agente IA de Gestão</strong> do seu ERP. 🤖</p>
        <p>Já analisei os dados de <strong>${agentEsc(d.company.name || 'sua empresa')}</strong>: índice de saúde
        <strong>${d.company.score === null ? 'sem dados' : `${agentNum(d.company.score, 1)}/100 (${agentEsc(d.company.level.label)})`}</strong>,
        com ${d.company.totalAlerts} alertas e ${d.company.totalRecommendations} recomendações.</p>
        <p>Posso atuar nas 6 áreas: ${d.domains.map((x) => `${x.icon} ${agentEsc(x.shortName)}`).join(' • ')}.</p>
        <p>Toque em uma sugestão abaixo ou escreva sua pergunta.</p>
      </div>
      <div class="agent-msg-meta">motor local • dados de ${new Date(d.generatedAt).toLocaleString('pt-BR')}</div>
    </div>
  `;
}

async function agentRenderQuickPrompts() {
  const holder = document.getElementById('agentQuick');
  if (!holder) return;
  try {
    const { prompts } = await api('/api/agent/quick-prompts');
    const list = AGENT_STATE.chatDomain
      ? prompts.filter((p) => !p.domain || p.domain === AGENT_STATE.chatDomain)
      : prompts;
    holder.innerHTML = list.map((p) => `<button class="agent-chip" onclick="agentAsk('${agentEsc(p.message.replace(/'/g, "\\'"))}')">${agentEsc(p.label)}</button>`).join('');
  } catch (err) {
    holder.innerHTML = '';
  }
}

function agentSetChatDomain(domainId) {
  AGENT_STATE.chatDomain = domainId;
  renderAgentChat(document.getElementById('agentTabContent'));
}

function agentAskDomain(domainId) {
  AGENT_STATE.chatDomain = domainId;
  AGENT_STATE.tab = 'chat';
  renderAgentShell();
}

function agentAsk(message) {
  if (AGENT_STATE.tab !== 'chat') {
    AGENT_STATE.tab = 'chat';
    renderAgentShell();
  }
  agentSend(message);
}

function agentMessageHtml(msg) {
  const isUser = msg.role === 'user';
  const meta = [];
  if (!isUser) {
    if (msg.domainName) meta.push(`${msg.domainIcon || ''} ${agentEsc(msg.domainName)}`);
    if (msg.intentLabel) meta.push(agentEsc(msg.intentLabel));
    meta.push(msg.source === 'llm' ? `🧠 LLM ${agentEsc(msg.llmModel || '')}` : '⚙️ motor local');
  }
  return `
    <div class="agent-msg ${isUser ? 'user' : 'bot'}">
      <div class="agent-bubble">${isUser ? agentEsc(msg.content) : agentMarkdown(msg.content)}</div>
      ${msg.blocks?.length ? msg.blocks.map(agentBlockHtml).join('') : ''}
      ${meta.length ? `<div class="agent-msg-meta">${meta.join(' • ')}</div>` : ''}
    </div>
  `;
}

function agentBlockHtml(block) {
  if (!block) return '';
  if (block.type === 'table' && block.rows?.length) {
    return `
      <div class="agent-table-block">
        <table>
          <thead><tr>${block.columns.map((c) => `<th>${agentEsc(c)}</th>`).join('')}</tr></thead>
          <tbody>${block.rows.map((r) => `<tr>${r.map((c) => `<td>${agentEsc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    `;
  }
  if (block.type === 'kpis' && block.items?.length) {
    return `<div class="agent-kpi-strip" style="margin-top:10px">${block.items.slice(0, 6).map((k) => `
      <div class="agent-kpi"><span>${agentEsc(k.label)}</span><strong>${agentEsc(k.value)}</strong>${k.trend ? `<em class="${k.tone || 'neutral'}">${agentEsc(k.trend)}</em>` : ''}</div>
    `).join('')}</div>`;
  }
  if (block.type === 'alerts' && block.items?.length) {
    return `<div style="margin-top:10px">${block.items.map(agentAlertCard).join('')}</div>`;
  }
  if (block.type === 'links' && block.items?.length) {
    return `<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">${block.items.map((l) => `
      <button class="agent-chip" onclick="agentGoto('${l.page}')">↗ ${agentEsc(l.label || AGENT_PAGE_LABEL[l.page] || l.page)}</button>`).join('')}</div>`;
  }
  return '';
}

async function agentSubmit() {
  const input = document.getElementById('agentInput');
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  input.style.height = 'auto';
  await agentSend(message);
}

async function agentSend(message) {
  if (AGENT_STATE.busy) return;
  const holder = document.getElementById('agentMessages');
  if (!holder) return;

  AGENT_STATE.busy = true;
  AGENT_STATE.messages.push({ role: 'user', content: message });
  holder.insertAdjacentHTML('beforeend', agentMessageHtml({ role: 'user', content: message }));
  const typingId = `typing-${Date.now()}`;
  holder.insertAdjacentHTML(
    'beforeend',
    `<div class="agent-msg bot" id="${typingId}"><div class="agent-bubble"><div class="agent-typing"><span></span><span></span><span></span></div> <span style="font-size:13px;color:var(--gray)">analisando os dados da empresa...</span></div></div>`
  );
  agentScrollChat();

  const sendBtn = document.getElementById('agentSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const result = await api('/api/agent/chat', {
      method: 'POST',
      body: { message, domain: AGENT_STATE.chatDomain, conversationId: AGENT_STATE.conversationId }
    });
    AGENT_STATE.conversationId = result.conversationId;
    document.getElementById(typingId)?.remove();

    const domain = AGENT_STATE.diagnostic.domains.find((d) => d.id === result.parsed.domain);
    AGENT_STATE.messages.push({
      role: 'assistant',
      content: result.reply.text,
      blocks: result.reply.blocks,
      source: result.source,
      domainName: result.parsed.domainName,
      domainIcon: domain?.icon,
      intentLabel: result.parsed.intentLabel,
      llmModel: result.llm?.model
    });
    holder.insertAdjacentHTML('beforeend', agentMessageHtml(AGENT_STATE.messages[AGENT_STATE.messages.length - 1]));

    if (result.report) {
      AGENT_STATE.lastReport = result.report;
      holder.insertAdjacentHTML(
        'beforeend',
        `<div class="agent-msg bot"><div class="agent-bubble" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          📄 <strong>${agentEsc(result.report.filename)}</strong>
          <button class="btn btn-secondary" onclick="agentDownloadLastReport()">⬇ Baixar relatório</button>
        </div></div>`
      );
    }
    agentScrollChat();
    agentLoadHistory();
  } catch (err) {
    document.getElementById(typingId)?.remove();
    holder.insertAdjacentHTML('beforeend', `<div class="agent-msg bot"><div class="agent-bubble">⚠️ ${agentEsc(err.message)}</div></div>`);
    agentScrollChat();
  } finally {
    AGENT_STATE.busy = false;
    const btn = document.getElementById('agentSendBtn');
    if (btn) btn.disabled = false;
  }
}

function agentScrollChat() {
  const holder = document.getElementById('agentMessages');
  if (holder) holder.scrollTop = holder.scrollHeight;
}

function agentNewConversation() {
  AGENT_STATE.conversationId = null;
  AGENT_STATE.messages = [];
  renderAgentChat(document.getElementById('agentTabContent'));
}

async function agentLoadHistory() {
  const holder = document.getElementById('agentHistoryList');
  if (!holder) return;
  try {
    const { conversations } = await api('/api/agent/conversations');
    AGENT_STATE.conversations = conversations;
    if (!conversations.length) {
      holder.innerHTML = '<p style="color:var(--gray);font-size:13px">Nenhuma conversa ainda.</p>';
      return;
    }
    holder.innerHTML = conversations.map((c) => `
      <div class="agent-history-item ${c.id === AGENT_STATE.conversationId ? 'active' : ''}" onclick="agentOpenConversation(${c.id})">
        <strong>${agentEsc(c.title)}</strong>
        <small>${c.messageCount} mensagens • ${new Date(c.updatedAt || c.createdAt).toLocaleString('pt-BR')}</small>
      </div>
    `).join('');
  } catch (err) {
    holder.innerHTML = `<p style="color:var(--danger);font-size:13px">${agentEsc(err.message)}</p>`;
  }
}

async function agentOpenConversation(id) {
  try {
    const conv = await api(`/api/agent/conversations/${id}`);
    AGENT_STATE.conversationId = conv.id;
    AGENT_STATE.chatDomain = conv.domain || null;
    AGENT_STATE.messages = conv.messages.map((m) => ({
      role: m.role,
      content: m.content,
      blocks: m.structured?.blocks || [],
      source: m.source,
      intentLabel: m.intent,
      domainName: m.domain ? AGENT_STATE.diagnostic.domains.find((d) => d.id === m.domain)?.name : null,
      domainIcon: m.domain ? AGENT_STATE.diagnostic.domains.find((d) => d.id === m.domain)?.icon : ''
    }));
    renderAgentChat(document.getElementById('agentTabContent'));
  } catch (err) {
    alert('Erro ao abrir a conversa: ' + err.message);
  }
}

// ============================================================
// ABA 6 - Conhecimento
// ============================================================
async function renderAgentKnowledge(target) {
  target.innerHTML = '<div class="card"><div class="loading"><div class="spinner"></div>Carregando base de conhecimento...</div></div>';
  try {
    const data = await api('/api/agent/knowledge');
    target.innerHTML = `
      <div class="agent-block">
        <h3>📚 Base de conhecimento do agente</h3>
        <p style="color:var(--gray);font-size:13.5px;margin-bottom:16px">
          Conceitos, fórmulas, faixas de referência de mercado e playbooks que o agente aplica sobre os dados da sua empresa.
        </p>
        ${data.domains.map((d) => `
          <div style="margin-bottom:22px">
            <h4 style="font-size:15px;margin-bottom:8px">${d.icon} ${agentEsc(d.name)}</h4>
            <div class="agent-two-col">
              <div>
                ${(d.knowledge?.concepts || []).map((c) => `
                  <div class="agent-knowledge-card">
                    <strong>${agentEsc(c.term)}</strong>
                    <div class="formula">${agentEsc(c.formula)}</div>
                    <p>${agentEsc(c.explanation)}</p>
                    <div class="target">🎯 ${agentEsc(c.target)}</div>
                  </div>`).join('')}
              </div>
              <div>
                ${(d.knowledge?.playbooks || []).map((p) => `
                  <div class="agent-knowledge-card">
                    <strong>🧭 ${agentEsc(p.title)}</strong>
                    <div class="target">${agentEsc(p.when)} • Indicador: ${agentEsc(p.kpi)}</div>
                    <ol style="margin:8px 0 0 18px;font-size:13.5px">${p.steps.map((s) => `<li style="margin-bottom:4px">${agentEsc(s)}</li>`).join('')}</ol>
                  </div>`).join('')}
                <div class="agent-knowledge-card">
                  <strong>✅ Check-up</strong>
                  <ul class="agent-checkup" style="margin-top:8px">${(d.knowledge?.checkup || []).map((q) => `<li>${agentEsc(q)}</li>`).join('')}</ul>
                </div>
              </div>
            </div>
          </div>
        `).join('')}

        <h4 style="font-size:15px;margin:18px 0 8px">🧮 Fórmulas rápidas</h4>
        ${data.general.formulas.map((f) => `
          <div class="agent-knowledge-card"><strong>${agentEsc(f.q.toUpperCase())}</strong><p>${agentEsc(f.a)}</p></div>`).join('')}

        <h4 style="font-size:15px;margin:18px 0 8px">🖱 Como fazer dentro do ERP</h4>
        ${data.general.erpHowTo.map((h) => `
          <div class="agent-knowledge-card">
            <strong>${agentEsc(h.intent)} <button class="agent-link" onclick="agentGoto('${h.page}')">abrir módulo →</button></strong>
            <p>${agentEsc(h.text)}</p>
          </div>`).join('')}
      </div>
    `;
  } catch (err) {
    target.innerHTML = `<div class="card"><p>Erro: ${agentEsc(err.message)}</p></div>`;
  }
}

// ============================================================
// Ações auxiliares
// ============================================================
function agentGoto(page) {
  if (typeof navigateTo === 'function') navigateTo(page);
}

async function agentExportReport() {
  try {
    const data = await api('/api/agent/report');
    agentDownload(data.content, data.filename);
  } catch (err) {
    alert('Erro ao gerar o relatório: ' + err.message);
  }
}

async function agentExportDomain(domainId) {
  try {
    const data = await api(`/api/agent/report?domain=${domainId}`);
    agentDownload(data.content, data.filename);
  } catch (err) {
    alert('Erro ao gerar o relatório da área: ' + err.message);
  }
}

function agentDownloadLastReport() {
  const report = AGENT_STATE.lastReport;
  if (!report) return;
  agentDownload(report.content, report.filename);
}

function agentDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'relatorio-agente.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
