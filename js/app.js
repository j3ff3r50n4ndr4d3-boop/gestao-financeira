/* ============================================================
   FinanceHub — Gestão Financeira
   Persistência: localStorage | Gráficos: Chart.js
   ============================================================ */
'use strict';

/* ---------------- Utilidades ---------------- */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = v => BRL.format(v || 0);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));

const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function todayISO() {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
function toISO(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function isoInMonth(iso, year, month) { // month: 1-12
  if (!iso) return false;
  const [y, m] = iso.split('-').map(Number);
  return y === year && m === month;
}
function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
/* Avança uma data ISO i intervalos (monthly/weekly/yearly), preservando o dia quando possível */
function addInterval(iso, kind, i) {
  const [y, m, d] = iso.split('-').map(Number);
  if (kind === 'weekly') {
    const dt = new Date(y, m - 1, d + 7 * i);
    return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }
  if (kind === 'yearly') {
    return toISO(y + i, m, Math.min(d, daysInMonth(y + i, m)));
  }
  const total = (m - 1) + i;
  const ny = y + Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISO(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ---------------- Dados / persistência ---------------- */
const STORAGE_KEY = 'financehub_v1';

const CATEGORIES_EXPENSE = ['Fornecedores','Aluguel','Salários','Impostos','Energia','Água','Internet/Telefone','Marketing','Manutenção','Transporte','Software','Outros'];
const CATEGORIES_INCOME = ['Vendas','Serviços','Consultoria','Assinaturas','Comissões','Rendimentos','Outros'];
const PALETTE = ['#4f46e5','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b'];

let db = null;

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.accounts)) { db = parsed; return; }
    }
  } catch (e) { console.warn('Falha ao ler dados salvos:', e); }
  db = seedData();
  saveDB();
}
function saveDB() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function seedData() {
  const now = new Date();
  const Y = now.getFullYear(), M = now.getMonth() + 1; // 1-12
  const prev = M === 1 ? { y: Y - 1, m: 12 } : { y: Y, m: M - 1 };
  const prev2 = prev.m === 1 ? { y: prev.y - 1, m: 12 } : { y: prev.y, m: prev.m - 1 };
  const next = M === 12 ? { y: Y + 1, m: 1 } : { y: Y, m: M + 1 };
  const dim = daysInMonth(Y, M);
  const D = d => toISO(Y, M, Math.min(d, dim));

  const acc1 = uid(), acc2 = uid(), acc3 = uid();
  const card1 = uid(), card2 = uid();

  return {
    accounts: [
      { id: acc1, name: 'Banco Inter', type: 'Conta Corrente', holder: 'Empresa LTDA', balance: 18540.75, color: '#f97316' },
      { id: acc2, name: 'Nubank PJ', type: 'Conta Corrente', holder: 'Empresa LTDA', balance: 9320.10, color: '#8b5cf6' },
      { id: acc3, name: 'Caixa (dinheiro)', type: 'Caixa Interno', holder: 'Loja física', balance: 1275.00, color: '#10b981' },
    ],
    cards: [
      { id: card1, name: 'Inter Mastercard', brand: 'Mastercard', limit: 12000, closingDay: 28, dueDay: 7, color: '#0f172a' },
      { id: card2, name: 'Nubank Ultravioleta', brand: 'Visa', limit: 8000, closingDay: 20, dueDay: 27, color: '#7c3aed' },
    ],
    payables: [
      { id: uid(), description: 'Aluguel do escritório', category: 'Aluguel', value: 3500, dueDate: D(5), status: 'pago', paidDate: D(5), accountId: acc1, cardId: null },
      { id: uid(), description: 'Folha de pagamento', category: 'Salários', value: 9800, dueDate: D(5), status: 'pago', paidDate: D(5), accountId: acc1, cardId: null },
      { id: uid(), description: 'Fornecedor ABC — matéria-prima', category: 'Fornecedores', value: 4250.90, dueDate: D(10), status: 'pago', paidDate: D(9), accountId: acc2, cardId: null },
      { id: uid(), description: 'Energia elétrica', category: 'Energia', value: 687.45, dueDate: D(12), status: 'pago', paidDate: D(12), accountId: acc1, cardId: null },
      { id: uid(), description: 'Internet fibra 600MB', category: 'Internet/Telefone', value: 189.90, dueDate: D(15), status: 'pendente', paidDate: null, accountId: acc1, cardId: null },
      { id: uid(), description: 'DAS — Simples Nacional', category: 'Impostos', value: 2140.33, dueDate: D(20), status: 'pendente', paidDate: null, accountId: acc1, cardId: null },
      { id: uid(), description: 'Google Ads', category: 'Marketing', value: 1200, dueDate: D(18), status: 'pendente', paidDate: null, accountId: null, cardId: card1 },
      { id: uid(), description: 'Assinatura ERP + CRM', category: 'Software', value: 349.90, dueDate: D(22), status: 'pendente', paidDate: null, accountId: null, cardId: card2 },
      { id: uid(), description: 'Manutenção do ar-condicionado', category: 'Manutenção', value: 420, dueDate: D(25), status: 'pendente', paidDate: null, accountId: acc3, cardId: null },
      { id: uid(), description: 'Combustível — entregas', category: 'Transporte', value: 610.50, dueDate: D(27), status: 'pendente', paidDate: null, accountId: null, cardId: card1 },
      { id: uid(), description: 'Fornecedor XYZ — embalagens', category: 'Fornecedores', value: 980, dueDate: toISO(prev.y, prev.m, 22), status: 'pago', paidDate: toISO(prev.y, prev.m, 22), accountId: acc2, cardId: null },
      { id: uid(), description: 'Aluguel do escritório', category: 'Aluguel', value: 3500, dueDate: toISO(prev.y, prev.m, 5), status: 'pago', paidDate: toISO(prev.y, prev.m, 5), accountId: acc1, cardId: null },
      { id: uid(), description: 'Folha de pagamento', category: 'Salários', value: 9800, dueDate: toISO(prev.y, prev.m, 5), status: 'pago', paidDate: toISO(prev.y, prev.m, 5), accountId: acc1, cardId: null },
      { id: uid(), description: 'Energia elétrica', category: 'Energia', value: 712.30, dueDate: toISO(prev.y, prev.m, 12), status: 'pago', paidDate: toISO(prev.y, prev.m, 12), accountId: acc1, cardId: null },
      { id: uid(), description: 'Aluguel do escritório', category: 'Aluguel', value: 3500, dueDate: toISO(prev2.y, prev2.m, 5), status: 'pago', paidDate: toISO(prev2.y, prev2.m, 5), accountId: acc1, cardId: null },
      { id: uid(), description: 'Folha de pagamento', category: 'Salários', value: 9450, dueDate: toISO(prev2.y, prev2.m, 5), status: 'pago', paidDate: toISO(prev2.y, prev2.m, 5), accountId: acc1, cardId: null },
      { id: uid(), description: 'Aluguel do escritório', category: 'Aluguel', value: 3500, dueDate: toISO(next.y, next.m, 5), status: 'pendente', paidDate: null, accountId: acc1, cardId: null },
    ],
    receivables: [
      { id: uid(), description: 'NF 1042 — Cliente Alfa', category: 'Vendas', value: 8900, dueDate: D(4), status: 'recebido', receivedDate: D(4), accountId: acc1 },
      { id: uid(), description: 'Projeto site institucional — Beta Corp', category: 'Serviços', value: 6500, dueDate: D(8), status: 'recebido', receivedDate: D(8), accountId: acc2 },
      { id: uid(), description: 'Mensalidade plano Pro (12 clientes)', category: 'Assinaturas', value: 3588, dueDate: D(10), status: 'recebido', receivedDate: D(10), accountId: acc2 },
      { id: uid(), description: 'NF 1043 — Cliente Gama', category: 'Vendas', value: 5400, dueDate: D(16), status: 'pendente', receivedDate: null, accountId: acc1 },
      { id: uid(), description: 'Consultoria financeira — Delta ME', category: 'Consultoria', value: 2800, dueDate: D(21), status: 'pendente', receivedDate: null, accountId: acc1 },
      { id: uid(), description: 'Comissão parceria logística', category: 'Comissões', value: 940.20, dueDate: D(24), status: 'pendente', receivedDate: null, accountId: acc2 },
      { id: uid(), description: 'NF 1044 — Cliente Épsilon', category: 'Vendas', value: 7200, dueDate: D(28), status: 'pendente', receivedDate: null, accountId: acc1 },
      { id: uid(), description: 'NF 1039 — Cliente Alfa', category: 'Vendas', value: 8200, dueDate: toISO(prev.y, prev.m, 6), status: 'recebido', receivedDate: toISO(prev.y, prev.m, 6), accountId: acc1 },
      { id: uid(), description: 'Mensalidades plano Pro', category: 'Assinaturas', value: 3289, dueDate: toISO(prev.y, prev.m, 10), status: 'recebido', receivedDate: toISO(prev.y, prev.m, 10), accountId: acc2 },
      { id: uid(), description: 'Projeto app mobile — Ômega SA', category: 'Serviços', value: 12400, dueDate: toISO(prev.y, prev.m, 18), status: 'recebido', receivedDate: toISO(prev.y, prev.m, 20), accountId: acc1 },
      { id: uid(), description: 'NF 1035 — Cliente Gama', category: 'Vendas', value: 9100, dueDate: toISO(prev2.y, prev2.m, 8), status: 'recebido', receivedDate: toISO(prev2.y, prev2.m, 8), accountId: acc1 },
      { id: uid(), description: 'Mensalidades plano Pro', category: 'Assinaturas', value: 3090, dueDate: toISO(prev2.y, prev2.m, 10), status: 'recebido', receivedDate: toISO(prev2.y, prev2.m, 10), accountId: acc2 },
      { id: uid(), description: 'Contrato anual — Sigma Ltda (1ª parcela)', category: 'Serviços', value: 5750, dueDate: toISO(next.y, next.m, 5), status: 'pendente', receivedDate: null, accountId: acc1 },
    ],
  };
}

/* ---------------- Estado ---------------- */
const state = {
  view: 'dashboard',
  refDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  cfMode: 'daily',
  filters: { payables: 'all', receivables: 'all', searchP: '', searchR: '' },
};
const charts = {}; // instâncias Chart.js

/* ---------------- Tema (claro/escuro) ---------------- */
const THEME_KEY = 'financehub_theme';
let theme = localStorage.getItem(THEME_KEY) || 'light';
function gridColor() { return theme === 'dark' ? '#243049' : '#eef2f7'; }
function surfaceColor() { return theme === 'dark' ? '#141e33' : '#ffffff'; }
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) { btn.textContent = theme === 'dark' ? '☀️' : '🌙'; }
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = theme === 'dark' ? '#94a3b8' : '#64748b';
    Chart.defaults.borderColor = gridColor();
  }
}
document.getElementById('themeToggle').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
  render(); // recria gráficos com as cores do tema
  toast(theme === 'dark' ? 'Modo escuro ativado.' : 'Modo claro ativado.', 'info');
});

/* ---------------- Status derivado ---------------- */
function payableStatus(p) {
  if (p.status === 'pago') return 'pago';
  return p.dueDate < todayISO() ? 'vencido' : 'pendente';
}
function receivableStatus(r) {
  if (r.status === 'recebido') return 'recebido';
  return r.dueDate < todayISO() ? 'atrasado' : 'pendente';
}
/* Data efetiva para fluxo de caixa: data real do pagamento/recebimento ou vencimento (previsto) */
function effDateP(p) { return p.status === 'pago' ? (p.paidDate || p.dueDate) : p.dueDate; }
function effDateR(r) { return r.status === 'recebido' ? (r.receivedDate || r.dueDate) : r.dueDate; }

function accountById(id) { return db.accounts.find(a => a.id === id) || null; }
function cardById(id) { return db.cards.find(c => c.id === id) || null; }
function originLabel(p) {
  if (p.cardId) { const c = cardById(p.cardId); return c ? '💳 ' + c.name : '💳 Cartão'; }
  if (p.accountId) { const a = accountById(p.accountId); return a ? '🏦 ' + a.name : '🏦 Conta'; }
  return '—';
}

/* Fatura do cartão no mês de referência (despesas pendentes ou pagas lançadas no cartão) */
function cardInvoice(cardId, year, month) {
  return db.payables
    .filter(p => p.cardId === cardId && isoInMonth(p.dueDate, year, month))
    .reduce((s, p) => s + p.value, 0);
}
function cardOpenTotal(cardId) {
  return db.payables
    .filter(p => p.cardId === cardId && p.status !== 'pago')
    .reduce((s, p) => s + p.value, 0);
}

/* ---------------- Toasts ---------------- */
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span><span>${escapeHtml(msg)}</span>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 350); }, 3200);
}

/* ---------------- Modal ---------------- */
const overlay = document.getElementById('modalOverlay');
function openModal(title, bodyHtml, onMount) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  if (onMount) onMount(document.getElementById('modalBody'));
}
function closeModal() {
  overlay.hidden = true;
  document.body.style.overflow = '';
}
document.getElementById('modalClose').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });

/* ---------------- Navegação ---------------- */
function switchView(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  const titles = {
    dashboard: 'Dashboard', payables: 'Contas a Pagar', receivables: 'Contas a Receber',
    cashflow: 'Fluxo de Caixa', dre: 'DRE — Demonstrativo de Resultados',
    accounts: 'Contas Bancárias', cards: 'Cartões de Crédito',
  };
  document.getElementById('viewTitle').textContent = titles[view];
  document.getElementById('sidebar').classList.remove('open');
  render();
}
document.querySelectorAll('.nav-item').forEach(btn =>
  btn.addEventListener('click', () => switchView(btn.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(btn =>
  btn.addEventListener('click', () => switchView(btn.dataset.goto)));
document.getElementById('hamburger').addEventListener('click', () =>
  document.getElementById('sidebar').classList.toggle('open'));

/* Navegação de mês */
document.getElementById('prevMonth').addEventListener('click', () => { shiftMonth(-1); });
document.getElementById('nextMonth').addEventListener('click', () => { shiftMonth(1); });
document.getElementById('todayBtn').addEventListener('click', () => {
  const n = new Date();
  state.refDate = new Date(n.getFullYear(), n.getMonth(), 1);
  render();
});
function shiftMonth(delta) {
  state.refDate = new Date(state.refDate.getFullYear(), state.refDate.getMonth() + delta, 1);
  render();
}
function refYM() { return { year: state.refDate.getFullYear(), month: state.refDate.getMonth() + 1 }; }

/* ---------------- Render raiz ---------------- */
function render() {
  const { year, month } = refYM();
  const label = state.view === 'cashflow' && state.cfMode === 'monthly'
    ? String(year)
    : `${MONTHS[month - 1]} ${year}`;
  document.getElementById('monthLabel').textContent = label;

  renderSidebarStats();
  switch (state.view) {
    case 'dashboard': renderDashboard(); break;
    case 'payables': renderPayables(); break;
    case 'receivables': renderReceivables(); break;
    case 'cashflow': renderCashflow(); break;
    case 'dre': renderDRE(); break;
    case 'accounts': renderAccounts(); break;
    case 'cards': renderCards(); break;
  }
}

function renderSidebarStats() {
  const total = db.accounts.reduce((s, a) => s + a.balance, 0);
  document.getElementById('sidebarBalance').textContent = fmt(total);

  const overdueP = db.payables.filter(p => payableStatus(p) === 'vencido').length;
  const bp = document.getElementById('badgePayables');
  bp.textContent = overdueP; bp.classList.toggle('show', overdueP > 0);

  const pendR = db.receivables.filter(r => r.status !== 'recebido').length;
  const br = document.getElementById('badgeReceivables');
  br.textContent = pendR; br.classList.toggle('show', pendR > 0);
}

/* ---------------- Charts helper ---------------- */
function makeChart(key, canvasId, config) {
  if (charts[key]) { charts[key].destroy(); }
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  charts[key] = new Chart(ctx, config);
}
const moneyTick = v => 'R$ ' + (Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : v.toLocaleString('pt-BR'));
const tooltipMoney = { callbacks: { label: c => `${c.dataset.label ? c.dataset.label + ': ' : ''}${fmt(c.parsed.y ?? c.parsed)}` } };

/* ================= DASHBOARD ================= */
function renderDashboard() {
  const { year, month } = refYM();

  const recMonth = db.receivables.filter(r => isoInMonth(effDateR(r), year, month));
  const payMonth = db.payables.filter(p => isoInMonth(effDateP(p), year, month));

  const revenue = recMonth.reduce((s, r) => s + r.value, 0);
  const revenueDone = recMonth.filter(r => r.status === 'recebido').reduce((s, r) => s + r.value, 0);
  const expense = payMonth.reduce((s, p) => s + p.value, 0);
  const expenseDone = payMonth.filter(p => p.status === 'pago').reduce((s, p) => s + p.value, 0);
  const profit = revenue - expense;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const totalBalance = db.accounts.reduce((s, a) => s + a.balance, 0);
  const invoices = db.cards.reduce((s, c) => s + cardInvoice(c.id, year, month), 0);

  document.getElementById('kpiRevenue').textContent = fmt(revenue);
  document.getElementById('kpiRevenueSub').textContent = `${fmt(revenueDone)} recebido · ${fmt(revenue - revenueDone)} a receber`;
  document.getElementById('kpiExpense').textContent = fmt(expense);
  document.getElementById('kpiExpenseSub').textContent = `${fmt(expenseDone)} pago · ${fmt(expense - expenseDone)} em aberto`;
  const kp = document.getElementById('kpiProfit');
  kp.textContent = fmt(profit);
  kp.style.color = profit >= 0 ? 'var(--success)' : 'var(--danger)';
  document.getElementById('kpiProfitSub').textContent = profit >= 0 ? 'Resultado positivo no período' : 'Resultado negativo no período';
  const km = document.getElementById('kpiMargin');
  km.textContent = `${margin.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  km.style.color = margin >= 0 ? 'inherit' : 'var(--danger)';
  document.getElementById('kpiMarginBar').style.width = `${Math.max(0, Math.min(100, margin))}%`;
  document.getElementById('kpiBalance').textContent = fmt(totalBalance);
  document.getElementById('kpiBalanceSub').textContent = `${db.accounts.length} conta(s) cadastrada(s)`;
  document.getElementById('kpiCards').textContent = fmt(invoices);
  document.getElementById('kpiCardsSub').textContent = `Faturas do mês em ${db.cards.length} cartão(ões)`;

  /* --- Gráfico Receitas × Despesas (6 meses) --- */
  const labels = [], revData = [], expData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    labels.push(`${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`);
    revData.push(db.receivables.filter(r => isoInMonth(effDateR(r), y, m)).reduce((s, r) => s + r.value, 0));
    expData.push(db.payables.filter(p => isoInMonth(effDateP(p), y, m)).reduce((s, p) => s + p.value, 0));
  }
  makeChart('revExp', 'chartRevExp', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Receitas', data: revData, backgroundColor: '#10b981', borderRadius: 6, maxBarThickness: 34 },
        { label: 'Despesas', data: expData, backgroundColor: '#ef4444', borderRadius: 6, maxBarThickness: 34 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxHeight: 7 } }, tooltip: tooltipMoney },
      scales: { y: { ticks: { callback: moneyTick }, grid: { color: gridColor() } }, x: { grid: { display: false } } },
    },
  });

  /* --- Despesas por categoria --- */
  const byCat = {};
  payMonth.forEach(p => { byCat[p.category] = (byCat[p.category] || 0) + p.value; });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  makeChart('cats', 'chartCategories', {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c[0]),
      datasets: [{ data: cats.map(c => c[1]), backgroundColor: PALETTE, borderWidth: 2, borderColor: surfaceColor() }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { usePointStyle: true, boxHeight: 7, font: { size: 11.5 } } },
        tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.parsed)}` } },
      },
    },
  });

  /* --- Listas de próximos --- */
  const t = todayISO();
  const upcoming = db.payables
    .filter(p => p.status !== 'pago')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  document.getElementById('upcomingList').innerHTML = upcoming.length
    ? upcoming.map(p => miniItem(p.dueDate, p.description, p.category + ' · ' + originLabel(p), -p.value, p.dueDate < t)).join('')
    : `<div class="mini-empty">Nenhuma conta pendente. 🎉</div>`;

  const incoming = db.receivables
    .filter(r => r.status !== 'recebido')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  document.getElementById('incomingList').innerHTML = incoming.length
    ? incoming.map(r => miniItem(r.dueDate, r.description, r.category, r.value, r.dueDate < t)).join('')
    : `<div class="mini-empty">Nenhum recebimento pendente.</div>`;
}

function miniItem(iso, title, sub, value, overdue) {
  const d = parseISO(iso);
  return `<div class="mini-item">
    <div class="mini-date ${overdue ? 'overdue' : ''}"><span>${d.getDate()}</span><small>${MONTHS_SHORT[d.getMonth()]}</small></div>
    <div class="mini-info"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(sub)}</span></div>
    <div class="mini-value ${value < 0 ? 'neg' : 'pos'}">${value < 0 ? '−' : '+'} ${fmt(Math.abs(value))}</div>
  </div>`;
}

/* ================= CONTAS A PAGAR ================= */
function renderPayables() {
  const { year, month } = refYM();
  const search = state.filters.searchP.toLowerCase();
  const filter = state.filters.payables;

  const monthItems = db.payables
    .filter(p => isoInMonth(p.dueDate, year, month))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const total = monthItems.reduce((s, p) => s + p.value, 0);
  const paid = monthItems.filter(p => p.status === 'pago').reduce((s, p) => s + p.value, 0);
  const overdue = monthItems.filter(p => payableStatus(p) === 'vencido').reduce((s, p) => s + p.value, 0);
  document.getElementById('payablesSummary').innerHTML = `
    <span class="chip">Total do mês <b>${fmt(total)}</b></span>
    <span class="chip green">Pago <b>${fmt(paid)}</b></span>
    <span class="chip amber">Em aberto <b>${fmt(total - paid)}</b></span>
    <span class="chip red">Vencido <b>${fmt(overdue)}</b></span>`;

  const rows = monthItems.filter(p => {
    const st = payableStatus(p);
    if (filter !== 'all' && st !== filter) return false;
    if (search && !(p.description + ' ' + p.category).toLowerCase().includes(search)) return false;
    return true;
  });

  const tbody = document.querySelector('#tablePayables tbody');
  document.getElementById('emptyPayables').hidden = rows.length > 0;
  tbody.innerHTML = rows.map(p => {
    const st = payableStatus(p);
    return `<tr class="${st === 'pago' ? 'row-paid' : ''}">
      <td class="desc"><strong>${escapeHtml(p.description)}${p.recurrenceId ? ' <span title="Lançamento recorrente">🔁</span>' : ''}</strong>${p.status === 'pago' && p.paidDate ? `<small>pago em ${fmtDate(p.paidDate)}</small>` : ''}</td>
      <td><span class="cat-tag">${escapeHtml(p.category)}</span></td>
      <td>${fmtDate(p.dueDate)}</td>
      <td>${originLabel(p)}</td>
      <td class="right value-neg">${fmt(p.value)}</td>
      <td><span class="badge ${st}">${st.charAt(0).toUpperCase() + st.slice(1)}</span></td>
      <td class="right" style="white-space:nowrap">
        ${p.status !== 'pago'
          ? `<button class="icon-btn success" title="Marcar como pago" data-act="pay" data-id="${p.id}">✓</button>`
          : `<button class="icon-btn" title="Desfazer pagamento" data-act="unpay" data-id="${p.id}">↩</button>`}
        <button class="icon-btn" title="Editar" data-act="edit-p" data-id="${p.id}">✏️</button>
        <button class="icon-btn danger" title="Excluir" data-act="del-p" data-id="${p.id}">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

/* ================= CONTAS A RECEBER ================= */
function renderReceivables() {
  const { year, month } = refYM();
  const search = state.filters.searchR.toLowerCase();
  const filter = state.filters.receivables;

  const monthItems = db.receivables
    .filter(r => isoInMonth(r.dueDate, year, month))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const total = monthItems.reduce((s, r) => s + r.value, 0);
  const received = monthItems.filter(r => r.status === 'recebido').reduce((s, r) => s + r.value, 0);
  const late = monthItems.filter(r => receivableStatus(r) === 'atrasado').reduce((s, r) => s + r.value, 0);
  document.getElementById('receivablesSummary').innerHTML = `
    <span class="chip">Total do mês <b>${fmt(total)}</b></span>
    <span class="chip green">Recebido <b>${fmt(received)}</b></span>
    <span class="chip blue">A receber <b>${fmt(total - received)}</b></span>
    <span class="chip red">Atrasado <b>${fmt(late)}</b></span>`;

  const rows = monthItems.filter(r => {
    const st = receivableStatus(r);
    if (filter !== 'all' && st !== filter) return false;
    if (search && !(r.description + ' ' + r.category).toLowerCase().includes(search)) return false;
    return true;
  });

  const tbody = document.querySelector('#tableReceivables tbody');
  document.getElementById('emptyReceivables').hidden = rows.length > 0;
  tbody.innerHTML = rows.map(r => {
    const st = receivableStatus(r);
    const acc = accountById(r.accountId);
    return `<tr class="${st === 'recebido' ? 'row-paid' : ''}">
      <td class="desc"><strong>${escapeHtml(r.description)}${r.recurrenceId ? ' <span title="Lançamento recorrente">🔁</span>' : ''}</strong>${r.status === 'recebido' && r.receivedDate ? `<small>recebido em ${fmtDate(r.receivedDate)}</small>` : ''}</td>
      <td><span class="cat-tag">${escapeHtml(r.category)}</span></td>
      <td>${fmtDate(r.dueDate)}</td>
      <td>${acc ? '🏦 ' + escapeHtml(acc.name) : '—'}</td>
      <td class="right value-pos">${fmt(r.value)}</td>
      <td><span class="badge ${st}">${st.charAt(0).toUpperCase() + st.slice(1)}</span></td>
      <td class="right" style="white-space:nowrap">
        ${r.status !== 'recebido'
          ? `<button class="icon-btn success" title="Marcar como recebido" data-act="receive" data-id="${r.id}">✓</button>`
          : `<button class="icon-btn" title="Desfazer recebimento" data-act="unreceive" data-id="${r.id}">↩</button>`}
        <button class="icon-btn" title="Editar" data-act="edit-r" data-id="${r.id}">✏️</button>
        <button class="icon-btn danger" title="Excluir" data-act="del-r" data-id="${r.id}">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

/* ================= FLUXO DE CAIXA ================= */
function renderCashflow() {
  document.getElementById('cfDaily').hidden = state.cfMode !== 'daily';
  document.getElementById('cfMonthly').hidden = state.cfMode !== 'monthly';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.cf === state.cfMode));
  if (state.cfMode === 'daily') renderCashflowDaily(); else renderCashflowMonthly();
}

function renderCashflowDaily() {
  const { year, month } = refYM();
  const dim = daysInMonth(year, month);
  const inflow = new Array(dim + 1).fill(0);
  const outflow = new Array(dim + 1).fill(0);

  db.receivables.forEach(r => {
    const d = effDateR(r);
    if (isoInMonth(d, year, month)) inflow[Number(d.split('-')[2])] += r.value;
  });
  db.payables.forEach(p => {
    const d = effDateP(p);
    if (isoInMonth(d, year, month)) outflow[Number(d.split('-')[2])] += p.value;
  });

  let totalIn = 0, totalOut = 0, acc = 0;
  const rows = [];
  const labels = [], accData = [], inData = [], outData = [];
  for (let d = 1; d <= dim; d++) {
    const net = inflow[d] - outflow[d];
    acc += net; totalIn += inflow[d]; totalOut += outflow[d];
    const wd = new Date(year, month - 1, d).getDay();
    labels.push(String(d).padStart(2, '0'));
    inData.push(inflow[d]); outData.push(-outflow[d]); accData.push(acc);
    if (inflow[d] !== 0 || outflow[d] !== 0) {
      rows.push(`<tr class="${wd === 0 || wd === 6 ? 'cf-weekend' : ''}">
        <td>${String(d).padStart(2, '0')}/${String(month).padStart(2, '0')} · ${WEEKDAYS[wd]}</td>
        <td class="right value-pos">${inflow[d] ? fmt(inflow[d]) : '—'}</td>
        <td class="right value-neg">${outflow[d] ? fmt(outflow[d]) : '—'}</td>
        <td class="right" style="font-weight:700;color:${net >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(net)}</td>
        <td class="right" style="font-weight:700;color:${acc >= 0 ? 'var(--text)' : 'var(--danger)'}">${fmt(acc)}</td>
      </tr>`);
    }
  }
  const net = totalIn - totalOut;
  document.getElementById('cashflowSummary').innerHTML = `
    <span class="chip green">Entradas <b>${fmt(totalIn)}</b></span>
    <span class="chip red">Saídas <b>${fmt(totalOut)}</b></span>
    <span class="chip ${net >= 0 ? 'blue' : 'red'}">Resultado <b>${fmt(net)}</b></span>`;

  document.getElementById('cfDailyChartTitle').textContent =
    `Fluxo diário — ${MONTHS[month - 1]} ${year} (realizado + previsto)`;

  document.querySelector('#tableDaily tbody').innerHTML =
    (rows.length ? rows.join('') : `<tr><td colspan="5" class="empty-state">Sem movimentações neste mês.</td></tr>`) +
    (rows.length ? `<tr class="cf-total-row"><td>Total do mês</td><td class="right value-pos">${fmt(totalIn)}</td><td class="right value-neg">${fmt(totalOut)}</td><td class="right">${fmt(net)}</td><td class="right">${fmt(net)}</td></tr>` : '');

  makeChart('daily', 'chartDaily', {
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Entradas', data: inData, backgroundColor: 'rgba(16,185,129,.85)', borderRadius: 4, stack: 's' },
        { type: 'bar', label: 'Saídas', data: outData, backgroundColor: 'rgba(239,68,68,.85)', borderRadius: 4, stack: 's' },
        { type: 'line', label: 'Acumulado', data: accData, borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,.08)', fill: true, tension: .35, pointRadius: 0, borderWidth: 2.5 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxHeight: 7 } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(Math.abs(c.parsed.y))}` } },
      },
      scales: { y: { ticks: { callback: moneyTick }, grid: { color: gridColor() } }, x: { grid: { display: false }, stacked: true } },
    },
  });
}

function renderCashflowMonthly() {
  const { year } = refYM();
  const inM = new Array(12).fill(0), outM = new Array(12).fill(0);
  db.receivables.forEach(r => {
    const d = effDateR(r); const [y, m] = d.split('-').map(Number);
    if (y === year) inM[m - 1] += r.value;
  });
  db.payables.forEach(p => {
    const d = effDateP(p); const [y, m] = d.split('-').map(Number);
    if (y === year) outM[m - 1] += p.value;
  });

  let acc = 0, totalIn = 0, totalOut = 0;
  const accData = [], rows = [];
  for (let m = 0; m < 12; m++) {
    const net = inM[m] - outM[m];
    acc += net; totalIn += inM[m]; totalOut += outM[m];
    accData.push(acc);
    rows.push(`<tr>
      <td style="text-transform:capitalize">${MONTHS[m]}</td>
      <td class="right value-pos">${inM[m] ? fmt(inM[m]) : '—'}</td>
      <td class="right value-neg">${outM[m] ? fmt(outM[m]) : '—'}</td>
      <td class="right" style="font-weight:700;color:${net >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(net)}</td>
      <td class="right" style="font-weight:700">${fmt(acc)}</td>
    </tr>`);
  }
  const net = totalIn - totalOut;
  document.getElementById('cashflowSummary').innerHTML = `
    <span class="chip green">Entradas ${year} <b>${fmt(totalIn)}</b></span>
    <span class="chip red">Saídas ${year} <b>${fmt(totalOut)}</b></span>
    <span class="chip ${net >= 0 ? 'blue' : 'red'}">Resultado <b>${fmt(net)}</b></span>`;
  document.getElementById('cfMonthlyChartTitle').textContent = `Fluxo mensal — ${year}`;

  document.querySelector('#tableMonthly tbody').innerHTML = rows.join('') +
    `<tr class="cf-total-row"><td>Total do ano</td><td class="right value-pos">${fmt(totalIn)}</td><td class="right value-neg">${fmt(totalOut)}</td><td class="right">${fmt(net)}</td><td class="right">${fmt(net)}</td></tr>`;

  makeChart('monthly', 'chartMonthly', {
    data: {
      labels: MONTHS_SHORT,
      datasets: [
        { type: 'bar', label: 'Entradas', data: inM, backgroundColor: 'rgba(16,185,129,.85)', borderRadius: 5, maxBarThickness: 26 },
        { type: 'bar', label: 'Saídas', data: outM.map(v => -v), backgroundColor: 'rgba(239,68,68,.85)', borderRadius: 5, maxBarThickness: 26 },
        { type: 'line', label: 'Acumulado', data: accData, borderColor: '#4f46e5', tension: .35, pointRadius: 3, borderWidth: 2.5 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxHeight: 7 } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(Math.abs(c.parsed.y))}` } },
      },
      scales: { y: { ticks: { callback: moneyTick }, grid: { color: gridColor() } }, x: { grid: { display: false } } },
    },
  });
}

/* ================= DRE ================= */
function dreTotals(year, monthFrom, monthTo) {
  const revByCat = {}, expByCat = {};
  let revenue = 0, expense = 0;
  db.receivables.forEach(r => {
    const [y, m] = effDateR(r).split('-').map(Number);
    if (y === year && m >= monthFrom && m <= monthTo) {
      revByCat[r.category] = (revByCat[r.category] || 0) + r.value; revenue += r.value;
    }
  });
  db.payables.forEach(p => {
    const [y, m] = effDateP(p).split('-').map(Number);
    if (y === year && m >= monthFrom && m <= monthTo) {
      expByCat[p.category] = (expByCat[p.category] || 0) + p.value; expense += p.value;
    }
  });
  return { revByCat, expByCat, revenue, expense };
}

function renderDRE() {
  const { year, month } = refYM();
  const M = dreTotals(year, month, month);   // mês selecionado
  const Y = dreTotals(year, 1, month);       // acumulado jan → mês selecionado

  const pctOf = (v, base) => base > 0 ? (v / base * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—';

  const taxM = M.expByCat['Impostos'] || 0,      taxY = Y.expByCat['Impostos'] || 0;
  const costM = M.expByCat['Fornecedores'] || 0, costY = Y.expByCat['Fornecedores'] || 0;
  const netRevM = M.revenue - taxM,              netRevY = Y.revenue - taxY;
  const grossM = netRevM - costM,                grossY = netRevY - costY;
  const opCats = [...new Set([...Object.keys(M.expByCat), ...Object.keys(Y.expByCat)])]
    .filter(c => c !== 'Impostos' && c !== 'Fornecedores')
    .sort((a, b) => (Y.expByCat[b] || 0) - (Y.expByCat[a] || 0));
  const opM = opCats.reduce((s, c) => s + (M.expByCat[c] || 0), 0);
  const opY = opCats.reduce((s, c) => s + (Y.expByCat[c] || 0), 0);
  const netM = grossM - opM, netY = grossY - opY;
  const marginM = M.revenue > 0 ? netM / M.revenue * 100 : 0;
  const marginY = Y.revenue > 0 ? netY / Y.revenue * 100 : 0;

  document.getElementById('dreColMonth').textContent = `${MONTHS_SHORT[month - 1]}/${year}`;
  document.getElementById('dreColYear').textContent = month === 1 ? `Jan/${year}` : `Jan–${MONTHS_SHORT[month - 1]}/${year}`;

  document.getElementById('dreSummary').innerHTML = `
    <span class="chip green">Receita bruta (mês) <b>${fmt(M.revenue)}</b></span>
    <span class="chip ${netM >= 0 ? 'blue' : 'red'}">Resultado líquido (mês) <b>${fmt(netM)}</b></span>
    <span class="chip ${marginM >= 0 ? 'green' : 'red'}">Margem líquida <b>${marginM.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</b></span>
    <span class="chip ${netY >= 0 ? 'blue' : 'red'}">Acumulado no ano <b>${fmt(netY)}</b></span>`;

  const rows = [];
  const colorFor = v => v >= 0 ? 'var(--success)' : 'var(--danger)';
  const line = (cls, label, vM, vY, opts = {}) => {
    const sign = opts.negative ? '(−) ' : '';
    rows.push(`<tr class="${cls}">
      <td>${label}</td>
      <td class="right" ${opts.result ? `style="font-weight:800;color:${colorFor(vM)}"` : ''}>${sign}${fmt(Math.abs(vM)) }</td>
      <td class="right dre-pct">${pctOf(Math.abs(vM), M.revenue)}</td>
      <td class="right" ${opts.result ? `style="font-weight:800;color:${colorFor(vY)}"` : ''}>${sign}${fmt(Math.abs(vY))}</td>
      <td class="right dre-pct">${pctOf(Math.abs(vY), Y.revenue)}</td>
    </tr>`);
  };

  line('dre-section', 'Receita Bruta', M.revenue, Y.revenue);
  [...new Set([...Object.keys(M.revByCat), ...Object.keys(Y.revByCat)])]
    .sort((a, b) => (Y.revByCat[b] || 0) - (Y.revByCat[a] || 0))
    .forEach(c => line('dre-sub', c, M.revByCat[c] || 0, Y.revByCat[c] || 0));
  line('', '(−) Impostos e deduções', -taxM, -taxY, { negative: true });
  line('dre-section', '= Receita Líquida', netRevM, netRevY);
  line('', '(−) Custos diretos (fornecedores)', -costM, -costY, { negative: true });
  line('dre-section', `= Lucro Bruto <span class="dre-pct">(margem ${pctOf(grossM, M.revenue)})</span>`, grossM, grossY);
  line('', '(−) Despesas Operacionais', -opM, -opY, { negative: true });
  opCats.forEach(c => line('dre-sub', c, M.expByCat[c] || 0, Y.expByCat[c] || 0));
  line('dre-section dre-result', `= Resultado Líquido <span class="dre-pct">(margem ${marginM.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)</span>`, netM, netY, { result: true });

  document.querySelector('#tableDre tbody').innerHTML = rows.join('');

  /* Gráfico: resultado líquido mês a mês do ano */
  document.getElementById('dreChartTitle').textContent = `Resultado líquido mês a mês — ${year}`;
  const netByMonth = [];
  for (let m = 1; m <= 12; m++) {
    const t = dreTotals(year, m, m);
    netByMonth.push(t.revenue - t.expense);
  }
  makeChart('dre', 'chartDre', {
    type: 'bar',
    data: {
      labels: MONTHS_SHORT,
      datasets: [{
        label: 'Resultado líquido',
        data: netByMonth,
        backgroundColor: netByMonth.map(v => v >= 0 ? 'rgba(16,185,129,.85)' : 'rgba(239,68,68,.85)'),
        borderRadius: 6, maxBarThickness: 30,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmt(c.parsed.y) } } },
      scales: { y: { ticks: { callback: moneyTick }, grid: { color: gridColor() } }, x: { grid: { display: false } } },
    },
  });
}

/* ================= CONTAS BANCÁRIAS ================= */
function renderAccounts() {
  const total = db.accounts.reduce((s, a) => s + a.balance, 0);
  document.getElementById('accountsSummary').innerHTML = `
    <span class="chip blue">Saldo total <b>${fmt(total)}</b></span>
    <span class="chip">Contas <b>${db.accounts.length}</b></span>`;

  document.getElementById('accountsGrid').innerHTML = db.accounts.map(a => `
    <div class="bank-card" style="background:linear-gradient(135deg, ${a.color}, ${shade(a.color, -35)})">
      <div class="bank-card-top">
        <div><h4>${escapeHtml(a.name)}</h4><small>${escapeHtml(a.type)}${a.holder ? ' · ' + escapeHtml(a.holder) : ''}</small></div>
        <div class="bank-card-actions">
          <button class="icon-btn" title="Ajustar saldo / editar" data-act="edit-acc" data-id="${a.id}">✏️</button>
          <button class="icon-btn" title="Excluir" data-act="del-acc" data-id="${a.id}">🗑</button>
        </div>
      </div>
      <div class="bank-card-balance">
        <span>Saldo atual</span>
        <strong>${fmt(a.balance)}</strong>
      </div>
    </div>`).join('') || '<div class="empty-state">Nenhuma conta cadastrada. Clique em “+ Nova conta bancária”.</div>';
}

/* ================= CARTÕES ================= */
function renderCards() {
  const { year, month } = refYM();
  const totalLimit = db.cards.reduce((s, c) => s + c.limit, 0);
  const totalOpen = db.cards.reduce((s, c) => s + cardOpenTotal(c.id), 0);
  document.getElementById('cardsSummary').innerHTML = `
    <span class="chip">Limite total <b>${fmt(totalLimit)}</b></span>
    <span class="chip amber">Em aberto <b>${fmt(totalOpen)}</b></span>
    <span class="chip green">Disponível <b>${fmt(Math.max(0, totalLimit - totalOpen))}</b></span>`;

  document.getElementById('cardsGrid').innerHTML = db.cards.map(c => {
    const invoice = cardInvoice(c.id, year, month);
    const open = cardOpenTotal(c.id);
    const pct = c.limit > 0 ? Math.min(100, (open / c.limit) * 100) : 0;
    return `<div class="bank-card" style="background:linear-gradient(135deg, ${c.color}, ${shade(c.color, -38)})">
      <div class="bank-card-top">
        <div><h4>${escapeHtml(c.name)}</h4><small>Fecha dia ${c.closingDay} · vence dia ${c.dueDay}</small></div>
        <div class="bank-card-actions">
          <span class="card-flag">${escapeHtml(c.brand)}</span>
          <button class="icon-btn" title="Editar" data-act="edit-card" data-id="${c.id}">✏️</button>
          <button class="icon-btn" title="Excluir" data-act="del-card" data-id="${c.id}">🗑</button>
        </div>
      </div>
      <div class="bank-card-balance">
        <span>Fatura de ${MONTHS[month - 1]}</span>
        <strong>${fmt(invoice)}</strong>
      </div>
      <div class="limit-bar">
        <div class="lb-track"><div class="lb-fill" style="width:${pct}%"></div></div>
        <div class="lb-meta"><span>Usado: ${fmt(open)} (${pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%)</span><span>Limite: ${fmt(c.limit)}</span></div>
      </div>
    </div>`;
  }).join('') || '<div class="empty-state">Nenhum cartão cadastrado. Clique em “+ Novo cartão”.</div>';
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/* ================= AÇÕES (pagar / receber / excluir) ================= */
function payPayable(id) {
  const p = db.payables.find(x => x.id === id); if (!p) return;
  p.status = 'pago'; p.paidDate = todayISO();
  if (p.accountId) { const a = accountById(p.accountId); if (a) a.balance -= p.value; }
  saveDB(); render();
  toast(`"${p.description}" marcada como paga.`);
}
function unpayPayable(id) {
  const p = db.payables.find(x => x.id === id); if (!p) return;
  if (p.accountId) { const a = accountById(p.accountId); if (a) a.balance += p.value; }
  p.status = 'pendente'; p.paidDate = null;
  saveDB(); render();
  toast('Pagamento desfeito.', 'info');
}
function receiveReceivable(id) {
  const r = db.receivables.find(x => x.id === id); if (!r) return;
  r.status = 'recebido'; r.receivedDate = todayISO();
  if (r.accountId) { const a = accountById(r.accountId); if (a) a.balance += r.value; }
  saveDB(); render();
  toast(`"${r.description}" marcado como recebido.`);
}
function unreceiveReceivable(id) {
  const r = db.receivables.find(x => x.id === id); if (!r) return;
  if (r.accountId) { const a = accountById(r.accountId); if (a) a.balance -= r.value; }
  r.status = 'pendente'; r.receivedDate = null;
  saveDB(); render();
  toast('Recebimento desfeito.', 'info');
}

function confirmDelete(msg, onYes) {
  openModal('Confirmar exclusão', `
    <p style="margin-bottom:6px">${escapeHtml(msg)}</p>
    <p style="color:var(--muted);font-size:13px">Esta ação não pode ser desfeita.</p>
    <div class="form-actions">
      <button class="btn-ghost" id="cancelDel">Cancelar</button>
      <button class="btn-primary" id="okDel" style="background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 4px 14px rgba(239,68,68,.35)">Excluir</button>
    </div>`, body => {
    body.querySelector('#cancelDel').onclick = closeModal;
    body.querySelector('#okDel').onclick = () => { onYes(); closeModal(); };
  });
}

/* Remove um lançamento devolvendo/estornando o saldo se já estava pago/recebido */
function removeEntry(kind, item) {
  if (kind === 'payable') {
    if (item.status === 'pago' && item.accountId) { const a = accountById(item.accountId); if (a) a.balance += item.value; }
    db.payables = db.payables.filter(x => x.id !== item.id);
  } else {
    if (item.status === 'recebido' && item.accountId) { const a = accountById(item.accountId); if (a) a.balance -= item.value; }
    db.receivables = db.receivables.filter(x => x.id !== item.id);
  }
}

/* Exclusão de item que pertence a uma série recorrente */
function openSeriesDelete(kind, item) {
  const list = kind === 'payable' ? db.payables : db.receivables;
  const series = list.filter(x => x.recurrenceId === item.recurrenceId);
  openModal('Excluir lançamento recorrente', `
    <p style="margin-bottom:6px">"<b>${escapeHtml(item.description)}</b>" faz parte de uma série recorrente com <b>${series.length}</b> lançamentos.</p>
    <p style="color:var(--muted);font-size:13px;margin-bottom:4px">O que deseja excluir?</p>
    <div class="form-actions" style="flex-wrap:wrap">
      <button class="btn-ghost" id="sdCancel">Cancelar</button>
      <button class="btn-primary" id="sdOne">Somente este</button>
      <button class="btn-primary" id="sdAll" style="background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 4px 14px rgba(239,68,68,.35)">Toda a série (${series.length})</button>
    </div>`, body => {
    body.querySelector('#sdCancel').onclick = closeModal;
    body.querySelector('#sdOne').onclick = () => {
      removeEntry(kind, item);
      saveDB(); closeModal(); render(); toast('Lançamento excluído.', 'info');
    };
    body.querySelector('#sdAll').onclick = () => {
      series.forEach(x => removeEntry(kind, x));
      saveDB(); closeModal(); render(); toast(`Série recorrente excluída (${series.length} lançamentos).`, 'info');
    };
  });
}

/* Delegação de cliques em ações */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const { act, id } = btn.dataset;
  switch (act) {
    case 'pay': payPayable(id); break;
    case 'unpay': unpayPayable(id); break;
    case 'receive': receiveReceivable(id); break;
    case 'unreceive': unreceiveReceivable(id); break;
    case 'edit-p': openPayableForm(db.payables.find(x => x.id === id)); break;
    case 'edit-r': openReceivableForm(db.receivables.find(x => x.id === id)); break;
    case 'edit-acc': openAccountForm(accountById(id)); break;
    case 'edit-card': openCardForm(cardById(id)); break;
    case 'del-p': {
      const p = db.payables.find(x => x.id === id);
      if (p.recurrenceId && db.payables.filter(x => x.recurrenceId === p.recurrenceId).length > 1) {
        openSeriesDelete('payable', p);
      } else {
        confirmDelete(`Excluir a conta "${p.description}"?`, () => {
          removeEntry('payable', p);
          saveDB(); render(); toast('Conta excluída.', 'info');
        });
      }
      break;
    }
    case 'del-r': {
      const r = db.receivables.find(x => x.id === id);
      if (r.recurrenceId && db.receivables.filter(x => x.recurrenceId === r.recurrenceId).length > 1) {
        openSeriesDelete('receivable', r);
      } else {
        confirmDelete(`Excluir o recebimento "${r.description}"?`, () => {
          removeEntry('receivable', r);
          saveDB(); render(); toast('Recebimento excluído.', 'info');
        });
      }
      break;
    }
    case 'del-acc': {
      const a = accountById(id);
      const linked = db.payables.some(p => p.accountId === id) || db.receivables.some(r => r.accountId === id);
      confirmDelete(`Excluir a conta bancária "${a.name}"?${linked ? ' Lançamentos vinculados ficarão sem conta.' : ''}`, () => {
        db.accounts = db.accounts.filter(x => x.id !== id);
        db.payables.forEach(p => { if (p.accountId === id) p.accountId = null; });
        db.receivables.forEach(r => { if (r.accountId === id) r.accountId = null; });
        saveDB(); render(); toast('Conta bancária excluída.', 'info');
      });
      break;
    }
    case 'del-card': {
      const c = cardById(id);
      confirmDelete(`Excluir o cartão "${c.name}"? Lançamentos vinculados ficarão sem cartão.`, () => {
        db.cards = db.cards.filter(x => x.id !== id);
        db.payables.forEach(p => { if (p.cardId === id) p.cardId = null; });
        saveDB(); render(); toast('Cartão excluído.', 'info');
      });
      break;
    }
  }
});

/* ================= FORMULÁRIOS ================= */
function selectOptions(list, selected, none = 'Nenhum(a)') {
  return `<option value="">${none}</option>` +
    list.map(i => `<option value="${i.id}" ${i.id === selected ? 'selected' : ''}>${escapeHtml(i.name)}</option>`).join('');
}
function catOptions(cats, selected) {
  return cats.map(c => `<option ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

/* ----- Conta a pagar ----- */
function openPayableForm(item) {
  const isEdit = !!item;
  const { year, month } = refYM();
  const def = item || { description: '', category: 'Fornecedores', value: '', dueDate: toISO(year, month, Math.min(new Date().getDate(), daysInMonth(year, month))), accountId: '', cardId: '' };
  openModal(isEdit ? 'Editar conta a pagar' : 'Nova conta a pagar', `
    <form id="fPay" class="form-grid">
      <div class="field full"><label>Descrição *</label><input name="description" required maxlength="80" value="${escapeHtml(def.description)}" placeholder="Ex.: Aluguel do escritório"></div>
      <div class="field"><label>Categoria</label><select name="category">${catOptions(CATEGORIES_EXPENSE, def.category)}</select></div>
      <div class="field"><label>Valor (R$) *</label><input name="value" type="number" step="0.01" min="0.01" required value="${def.value || ''}" placeholder="0,00"></div>
      <div class="field"><label>Vencimento *</label><input name="dueDate" type="date" required value="${def.dueDate}"></div>
      <div class="field"><label>Pagar com</label>
        <select name="origin">
          <option value="">Não definido</option>
          <optgroup label="Contas bancárias">${db.accounts.map(a => `<option value="acc:${a.id}" ${def.accountId === a.id ? 'selected' : ''}>🏦 ${escapeHtml(a.name)}</option>`).join('')}</optgroup>
          <optgroup label="Cartões de crédito">${db.cards.map(c => `<option value="card:${c.id}" ${def.cardId === c.id ? 'selected' : ''}>💳 ${escapeHtml(c.name)}</option>`).join('')}</optgroup>
        </select>
      </div>
      ${!isEdit ? `
      <div class="field"><label>Repetir 🔁</label>
        <select name="recur">
          <option value="none">Não repetir</option>
          <option value="monthly">Mensal</option>
          <option value="weekly">Semanal</option>
          <option value="yearly">Anual</option>
        </select>
      </div>
      <div class="field"><label>Nº de lançamentos</label><input name="recurCount" type="number" min="2" max="60" value="12" disabled></div>` : ''}
      <div class="form-actions full">
        <button type="button" class="btn-ghost" id="fCancel">Cancelar</button>
        <button type="submit" class="btn-primary">${isEdit ? 'Salvar alterações' : 'Adicionar conta'}</button>
      </div>
    </form>`, body => {
    body.querySelector('#fCancel').onclick = closeModal;
    const recurSel = body.querySelector('[name=recur]');
    if (recurSel) {
      recurSel.onchange = () => { body.querySelector('[name=recurCount]').disabled = recurSel.value === 'none'; };
    }
    body.querySelector('#fPay').onsubmit = ev => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const origin = fd.get('origin') || '';
      const accountId = origin.startsWith('acc:') ? origin.slice(4) : null;
      const cardId = origin.startsWith('card:') ? origin.slice(5) : null;
      const data = {
        description: fd.get('description').trim(),
        category: fd.get('category'),
        value: parseFloat(fd.get('value')),
        dueDate: fd.get('dueDate'),
        accountId, cardId,
      };
      if (!data.description || !(data.value > 0) || !data.dueDate) { toast('Preencha os campos obrigatórios.', 'error'); return; }
      const recur = (!isEdit && fd.get('recur')) || 'none';
      if (isEdit) {
        // se já estava paga e mudou valor/conta, ajusta o saldo
        if (item.status === 'pago' && item.accountId) { const a = accountById(item.accountId); if (a) a.balance += item.value; }
        Object.assign(item, data);
        if (item.status === 'pago' && item.accountId) { const a = accountById(item.accountId); if (a) a.balance -= item.value; }
        toast('Conta atualizada.');
      } else if (recur !== 'none') {
        const count = Math.min(60, Math.max(2, parseInt(fd.get('recurCount')) || 2));
        const rid = uid();
        for (let i = 0; i < count; i++) {
          db.payables.push({
            id: uid(), status: 'pendente', paidDate: null, recurrenceId: rid, ...data,
            description: `${data.description} (${i + 1}/${count})`,
            dueDate: addInterval(data.dueDate, recur, i),
          });
        }
        toast(`${count} lançamentos recorrentes criados. 🔁`);
      } else {
        db.payables.push({ id: uid(), status: 'pendente', paidDate: null, ...data });
        toast('Conta a pagar adicionada.');
      }
      saveDB(); closeModal();
      goToMonthOf(data.dueDate); render();
    };
  });
}

/* ----- Conta a receber ----- */
function openReceivableForm(item) {
  const isEdit = !!item;
  const { year, month } = refYM();
  const def = item || { description: '', category: 'Vendas', value: '', dueDate: toISO(year, month, Math.min(new Date().getDate(), daysInMonth(year, month))), accountId: db.accounts[0]?.id || '' };
  openModal(isEdit ? 'Editar recebimento' : 'Novo recebimento', `
    <form id="fRec" class="form-grid">
      <div class="field full"><label>Descrição *</label><input name="description" required maxlength="80" value="${escapeHtml(def.description)}" placeholder="Ex.: NF 1042 — Cliente Alfa"></div>
      <div class="field"><label>Categoria</label><select name="category">${catOptions(CATEGORIES_INCOME, def.category)}</select></div>
      <div class="field"><label>Valor (R$) *</label><input name="value" type="number" step="0.01" min="0.01" required value="${def.value || ''}" placeholder="0,00"></div>
      <div class="field"><label>Vencimento *</label><input name="dueDate" type="date" required value="${def.dueDate}"></div>
      <div class="field"><label>Conta destino</label><select name="accountId">${selectOptions(db.accounts, def.accountId, 'Não definida')}</select></div>
      ${!isEdit ? `
      <div class="field"><label>Repetir 🔁</label>
        <select name="recur">
          <option value="none">Não repetir</option>
          <option value="monthly">Mensal</option>
          <option value="weekly">Semanal</option>
          <option value="yearly">Anual</option>
        </select>
      </div>
      <div class="field"><label>Nº de lançamentos</label><input name="recurCount" type="number" min="2" max="60" value="12" disabled></div>` : ''}
      <div class="form-actions full">
        <button type="button" class="btn-ghost" id="fCancel">Cancelar</button>
        <button type="submit" class="btn-primary">${isEdit ? 'Salvar alterações' : 'Adicionar recebimento'}</button>
      </div>
    </form>`, body => {
    body.querySelector('#fCancel').onclick = closeModal;
    const recurSel = body.querySelector('[name=recur]');
    if (recurSel) {
      recurSel.onchange = () => { body.querySelector('[name=recurCount]').disabled = recurSel.value === 'none'; };
    }
    body.querySelector('#fRec').onsubmit = ev => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const data = {
        description: fd.get('description').trim(),
        category: fd.get('category'),
        value: parseFloat(fd.get('value')),
        dueDate: fd.get('dueDate'),
        accountId: fd.get('accountId') || null,
      };
      if (!data.description || !(data.value > 0) || !data.dueDate) { toast('Preencha os campos obrigatórios.', 'error'); return; }
      const recur = (!isEdit && fd.get('recur')) || 'none';
      if (isEdit) {
        if (item.status === 'recebido' && item.accountId) { const a = accountById(item.accountId); if (a) a.balance -= item.value; }
        Object.assign(item, data);
        if (item.status === 'recebido' && item.accountId) { const a = accountById(item.accountId); if (a) a.balance += item.value; }
        toast('Recebimento atualizado.');
      } else if (recur !== 'none') {
        const count = Math.min(60, Math.max(2, parseInt(fd.get('recurCount')) || 2));
        const rid = uid();
        for (let i = 0; i < count; i++) {
          db.receivables.push({
            id: uid(), status: 'pendente', receivedDate: null, recurrenceId: rid, ...data,
            description: `${data.description} (${i + 1}/${count})`,
            dueDate: addInterval(data.dueDate, recur, i),
          });
        }
        toast(`${count} recebimentos recorrentes criados. 🔁`);
      } else {
        db.receivables.push({ id: uid(), status: 'pendente', receivedDate: null, ...data });
        toast('Recebimento adicionado.');
      }
      saveDB(); closeModal();
      goToMonthOf(data.dueDate); render();
    };
  });
}

function goToMonthOf(iso) {
  const [y, m] = iso.split('-').map(Number);
  state.refDate = new Date(y, m - 1, 1);
}

/* ----- Conta bancária ----- */
function openAccountForm(item) {
  const isEdit = !!item;
  const def = item || { name: '', type: 'Conta Corrente', holder: '', balance: '', color: PALETTE[db.accounts.length % PALETTE.length] };
  openModal(isEdit ? 'Editar conta bancária' : 'Nova conta bancária', `
    <form id="fAcc" class="form-grid">
      <div class="field full"><label>Nome do banco / conta *</label><input name="name" required maxlength="40" value="${escapeHtml(def.name)}" placeholder="Ex.: Banco Inter"></div>
      <div class="field"><label>Tipo</label>
        <select name="type">${['Conta Corrente','Conta Poupança','Conta Investimento','Caixa Interno'].map(t => `<option ${t === def.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Titular</label><input name="holder" maxlength="40" value="${escapeHtml(def.holder || '')}" placeholder="Opcional"></div>
      <div class="field full"><label>${isEdit ? 'Saldo atual (ajuste manual)' : 'Saldo inicial'} (R$) *</label><input name="balance" type="number" step="0.01" required value="${def.balance === '' ? '' : def.balance}" placeholder="0,00"></div>
      <div class="field full"><label>Cor do cartão</label><div class="color-row" id="colorRow">${PALETTE.map(c => `<div class="color-dot ${c === def.color ? 'selected' : ''}" data-color="${c}" style="background:${c}"></div>`).join('')}</div></div>
      <div class="form-actions full">
        <button type="button" class="btn-ghost" id="fCancel">Cancelar</button>
        <button type="submit" class="btn-primary">${isEdit ? 'Salvar alterações' : 'Adicionar conta'}</button>
      </div>
    </form>`, body => {
    let color = def.color;
    body.querySelectorAll('.color-dot').forEach(dot => dot.onclick = () => {
      body.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected'); color = dot.dataset.color;
    });
    body.querySelector('#fCancel').onclick = closeModal;
    body.querySelector('#fAcc').onsubmit = ev => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const data = {
        name: fd.get('name').trim(),
        type: fd.get('type'),
        holder: fd.get('holder').trim(),
        balance: parseFloat(fd.get('balance')),
        color,
      };
      if (!data.name || isNaN(data.balance)) { toast('Preencha os campos obrigatórios.', 'error'); return; }
      if (isEdit) { Object.assign(item, data); toast('Conta bancária atualizada.'); }
      else { db.accounts.push({ id: uid(), ...data }); toast('Conta bancária adicionada.'); }
      saveDB(); closeModal(); render();
    };
  });
}

/* ----- Cartão de crédito ----- */
function openCardForm(item) {
  const isEdit = !!item;
  const def = item || { name: '', brand: 'Mastercard', limit: '', closingDay: 28, dueDay: 7, color: '#0f172a' };
  const CARD_COLORS = ['#0f172a','#7c3aed','#4f46e5','#0ea5e9','#f97316','#dc2626','#059669','#be185d'];
  openModal(isEdit ? 'Editar cartão' : 'Novo cartão de crédito', `
    <form id="fCard" class="form-grid">
      <div class="field full"><label>Nome do cartão *</label><input name="name" required maxlength="40" value="${escapeHtml(def.name)}" placeholder="Ex.: Inter Mastercard"></div>
      <div class="field"><label>Bandeira</label>
        <select name="brand">${['Mastercard','Visa','Elo','Amex','Hipercard'].map(b => `<option ${b === def.brand ? 'selected' : ''}>${b}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Limite (R$) *</label><input name="limit" type="number" step="0.01" min="0" required value="${def.limit || ''}" placeholder="0,00"></div>
      <div class="field"><label>Dia de fechamento</label><input name="closingDay" type="number" min="1" max="31" value="${def.closingDay}"></div>
      <div class="field"><label>Dia de vencimento</label><input name="dueDay" type="number" min="1" max="31" value="${def.dueDay}"></div>
      <div class="field full"><label>Cor do cartão</label><div class="color-row">${CARD_COLORS.map(c => `<div class="color-dot ${c === def.color ? 'selected' : ''}" data-color="${c}" style="background:${c}"></div>`).join('')}</div></div>
      <div class="form-actions full">
        <button type="button" class="btn-ghost" id="fCancel">Cancelar</button>
        <button type="submit" class="btn-primary">${isEdit ? 'Salvar alterações' : 'Adicionar cartão'}</button>
      </div>
    </form>`, body => {
    let color = def.color;
    body.querySelectorAll('.color-dot').forEach(dot => dot.onclick = () => {
      body.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected'); color = dot.dataset.color;
    });
    body.querySelector('#fCancel').onclick = closeModal;
    body.querySelector('#fCard').onsubmit = ev => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const data = {
        name: fd.get('name').trim(),
        brand: fd.get('brand'),
        limit: parseFloat(fd.get('limit')),
        closingDay: Math.min(31, Math.max(1, parseInt(fd.get('closingDay')) || 28)),
        dueDay: Math.min(31, Math.max(1, parseInt(fd.get('dueDay')) || 7)),
        color,
      };
      if (!data.name || isNaN(data.limit)) { toast('Preencha os campos obrigatórios.', 'error'); return; }
      if (isEdit) { Object.assign(item, data); toast('Cartão atualizado.'); }
      else { db.cards.push({ id: uid(), ...data }); toast('Cartão adicionado.'); }
      saveDB(); closeModal(); render();
    };
  });
}

/* ================= Filtros / botões ================= */
document.getElementById('btnNewPayable').addEventListener('click', () => openPayableForm(null));
document.getElementById('btnNewReceivable').addEventListener('click', () => openReceivableForm(null));
document.getElementById('btnNewAccount').addEventListener('click', () => openAccountForm(null));
document.getElementById('btnNewCard').addEventListener('click', () => openCardForm(null));

document.getElementById('filterPayables').addEventListener('change', e => { state.filters.payables = e.target.value; renderPayables(); });
document.getElementById('filterReceivables').addEventListener('change', e => { state.filters.receivables = e.target.value; renderReceivables(); });
document.getElementById('searchPayables').addEventListener('input', e => { state.filters.searchP = e.target.value; renderPayables(); });
document.getElementById('searchReceivables').addEventListener('input', e => { state.filters.searchR = e.target.value; renderReceivables(); });

document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
  state.cfMode = b.dataset.cf; render();
}));

/* ================= Exportar / importar / reset ================= */
document.getElementById('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `financehub-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup exportado.', 'info');
});
document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.payables)) throw new Error('formato inválido');
      db = { accounts: data.accounts || [], cards: data.cards || [], payables: data.payables || [], receivables: data.receivables || [] };
      saveDB(); render();
      toast('Dados importados com sucesso.');
    } catch (err) {
      toast('Arquivo inválido. Use um backup exportado pelo FinanceHub.', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});
document.getElementById('btnReset').addEventListener('click', () => {
  confirmDelete('Restaurar os dados de demonstração? Todos os dados atuais serão substituídos.', () => {
    db = seedData(); saveDB();
    const n = new Date();
    state.refDate = new Date(n.getFullYear(), n.getMonth(), 1);
    render();
    toast('Dados de demonstração restaurados.');
  });
});

/* ================= Inicialização ================= */
loadDB();
applyTheme();
render();
