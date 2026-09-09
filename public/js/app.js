// ====== APP STATE ======
let token = localStorage.getItem('erp_token');
let currentUser = JSON.parse(localStorage.getItem('erp_user') || 'null');
let currentPage = 'dashboard';
let chartInstances = {};

// ====== API HELPER ======
async function api(url, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options
  };
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  if (config.body && typeof config.body === 'object') config.body = JSON.stringify(config.body);
  
  const response = await fetch(url, config);
  if (response.status === 401 || response.status === 403) {
    logout();
    throw new Error('Sessão expirada');
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || 'Erro na requisição');
  }
  return response.json();
}

// ====== AUTH ======
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('erp_token', token);
    localStorage.setItem('erp_user', JSON.stringify(currentUser));
    showApp();
  } catch (err) {
    alert('Erro: ' + err.message);
  }
});

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('erp_token');
  localStorage.removeItem('erp_user');
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
}

document.getElementById('logoutBtn').addEventListener('click', logout);

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'flex';
  document.getElementById('companyName').textContent = currentUser.company_name || currentUser.name;
  navigateTo('dashboard');
}

// ====== NAVIGATION ======
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => {
    navigateTo(item.dataset.page);
  });
});

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  
  const pages = {
    dashboard: loadDashboard,
    sales: loadSales,
    customers: loadCustomers,
    products: loadProducts,
    purchases: loadPurchases,
    suppliers: loadSuppliers,
    expenses: loadExpenses,
    receivable: loadReceivable,
    payable: loadPayable,
    cashflow: loadCashFlow,
    dre: loadDRE,
    subscriptions: loadSubscriptions
  };
  
  if (pages[page]) pages[page]();
}

// ====== MODAL ======
function openModal(title, content) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = content;
  document.getElementById('modal').classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

// ====== FORMAT HELPERS ======
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
}

// ====== DASHBOARD ======
async function loadDashboard() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Indicadores financeiros em tempo real</p>
      </div>
    </div>
    <div id="kpiCards" class="kpi-grid"></div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Receita vs Despesas (Mensal)</h3>
        </div>
        <div class="chart-container"><canvas id="revenueChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Despesas por Categoria</h3>
        </div>
        <div class="chart-container"><canvas id="categoryChart"></canvas></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><h3 class="card-title">Últimas Vendas</h3></div>
        <div id="recentSalesTable"></div>
      </div>
      <div class="card">
        <div class="card-header"><h3 class="card-title">Alertas</h3></div>
        <div id="alertsPanel"></div>
      </div>
    </div>
  `;

  try {
    const [kpis, revenueChart, expenseChart, categories, recentSales, overdue] = await Promise.all([
      api('/api/dashboard/kpis'),
      api('/api/dashboard/chart/revenue'),
      api('/api/dashboard/chart/expenses'),
      api('/api/dashboard/chart/categories'),
      api('/api/dashboard/recent-sales'),
      api('/api/dashboard/overdue')
    ]);

    renderKPIs(kpis);
    renderCharts(revenueChart, expenseChart, categories);
    renderRecentSales(recentSales);
    renderAlerts(kpis, overdue);
  } catch (err) {
    container.innerHTML += `<div class="card"><p>Erro ao carregar dados: ${err.message}</p></div>`;
  }
}

function renderKPIs(kpis) {
  const container = document.getElementById('kpiCards');
  container.innerHTML = `
    <div class="kpi-card success">
      <div class="kpi-header">
        <span class="kpi-label">Receita do Mês</span>
        <div class="kpi-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
      </div>
      <div class="kpi-value">${formatCurrency(kpis.revenue.current)}</div>
      <div class="kpi-change ${kpis.revenue.growth >= 0 ? 'positive' : 'negative'}">
        ${kpis.revenue.growth >= 0 ? '↑' : '↓'} ${Math.abs(kpis.revenue.growth)}% vs mês anterior
      </div>
    </div>
    <div class="kpi-card danger">
      <div class="kpi-header">
        <span class="kpi-label">Despesas do Mês</span>
        <div class="kpi-icon" style="background:rgba(239,68,68,0.1);color:var(--danger)"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg></div>
      </div>
      <div class="kpi-value">${formatCurrency(kpis.expenses.current)}</div>
      <div class="kpi-change ${kpis.expenses.variation <= 0 ? 'positive' : 'negative'}">
        ${kpis.expenses.variation >= 0 ? '↑' : '↓'} ${Math.abs(kpis.expenses.variation)}% vs mês anterior
      </div>
    </div>
    <div class="kpi-card ${kpis.profit.current >= 0 ? 'success' : 'danger'}">
      <div class="kpi-header">
        <span class="kpi-label">Lucro do Mês</span>
        <div class="kpi-icon" style="background:rgba(16,185,129,0.1);color:var(--success)"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg></div>
      </div>
      <div class="kpi-value">${formatCurrency(kpis.profit.current)}</div>
      <div class="kpi-change positive">Margem: ${kpis.profit.margin}%</div>
    </div>
    <div class="kpi-card info">
      <div class="kpi-header">
        <span class="kpi-label">Fluxo de Caixa</span>
        <div class="kpi-icon" style="background:rgba(59,130,246,0.1);color:var(--info)"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div>
      </div>
      <div class="kpi-value">${formatCurrency(kpis.cashFlow)}</div>
      <div class="kpi-change">Ticket médio: ${formatCurrency(kpis.averageTicket)}</div>
    </div>
    <div class="kpi-card warning">
      <div class="kpi-header">
        <span class="kpi-label">A Receber</span>
        <div class="kpi-icon" style="background:rgba(245,158,11,0.1);color:var(--warning)"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
      </div>
      <div class="kpi-value">${formatCurrency(kpis.accountsReceivable)}</div>
      <div class="kpi-change">${kpis.totalCustomers} clientes</div>
    </div>
    <div class="kpi-card danger">
      <div class="kpi-header">
        <span class="kpi-label">A Pagar</span>
        <div class="kpi-icon" style="background:rgba(239,68,68,0.1);color:var(--danger)"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
      </div>
      <div class="kpi-value">${formatCurrency(kpis.accountsPayable)}</div>
      <div class="kpi-change">${kpis.totalProducts} produtos</div>
    </div>
  `;
}

function renderCharts(revenueData, expenseData, categories) {
  // Destroy old charts
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  // Revenue vs Expenses Chart
  const ctx1 = document.getElementById('revenueChart');
  if (ctx1) {
    chartInstances.revenue = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: revenueData.map(d => d.month),
        datasets: [
          {
            label: 'Receita',
            data: revenueData.map(d => d.value),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderRadius: 6
          },
          {
            label: 'Despesas',
            data: expenseData.map(d => d.value),
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Category Chart
  const ctx2 = document.getElementById('categoryChart');
  if (ctx2) {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
    chartInstances.category = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: categories.map(c => c.category),
        datasets: [{
          data: categories.map(c => c.total),
          backgroundColor: colors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
      }
    });
  }
}

function renderRecentSales(sales) {
  const container = document.getElementById('recentSalesTable');
  if (sales.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nenhuma venda registrada</p></div>';
    return;
  }
  container.innerHTML = `
    <div class="table-container">
      <table>
        <thead><tr><th>Nº</th><th>Cliente</th><th>Valor</th><th>Data</th><th>Status</th></tr></thead>
        <tbody>
          ${sales.map(s => `
            <tr>
              <td><strong>${s.sale_number || '-'}</strong></td>
              <td>${s.customer_name || 'Não informado'}</td>
              <td><strong>${formatCurrency(s.total_amount)}</strong></td>
              <td>${formatDate(s.sale_date)}</td>
              <td><span class="badge badge-${s.status === 'completed' ? 'success' : 'warning'}">${s.status === 'completed' ? 'Concluída' : 'Pendente'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAlerts(kpis, overdue) {
  const container = document.getElementById('alertsPanel');
  let alerts = '';
  
  if (kpis.lowStock > 0) {
    alerts += `<div style="padding:12px;background:rgba(245,158,11,0.1);border-radius:8px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">⚠️</span>
      <div><strong>${kpis.lowStock} produto(s)</strong> com estoque baixo</div>
    </div>`;
  }
  
  if (overdue.receivable && overdue.receivable.length > 0) {
    const total = overdue.receivable.reduce((s, r) => s + r.amount, 0);
    alerts += `<div style="padding:12px;background:rgba(239,68,68,0.1);border-radius:8px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">🔴</span>
      <div><strong>${overdue.receivable.length} conta(s) a receber</strong> vencida(s) - ${formatCurrency(total)}</div>
    </div>`;
  }
  
  if (overdue.payable && overdue.payable.length > 0) {
    const total = overdue.payable.reduce((s, r) => s + r.amount, 0);
    alerts += `<div style="padding:12px;background:rgba(239,68,68,0.1);border-radius:8px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">🔴</span>
      <div><strong>${overdue.payable.length} conta(s) a pagar</strong> vencida(s) - ${formatCurrency(total)}</div>
    </div>`;
  }
  
  if (kpis.profit.margin < 10) {
    alerts += `<div style="padding:12px;background:rgba(245,158,11,0.1);border-radius:8px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">📉</span>
      <div>Margem de lucro baixa: <strong>${kpis.profit.margin}%</strong></div>
    </div>`;
  }
  
  if (!alerts) {
    alerts = '<div class="empty-state"><h3>✅ Tudo em ordem!</h3><p>Nenhum alerta no momento</p></div>';
  }
  
  container.innerHTML = alerts;
}

// ====== CUSTOMERS ======
async function loadCustomers() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Clientes</h1><p class="page-subtitle">Gerencie sua base de clientes</p></div>
      <button class="btn btn-primary" onclick="openCustomerModal()">+ Novo Cliente</button>
    </div>
    <div class="card">
      <div class="table-container" id="customersTable"><div class="loading"><div class="spinner"></div>Carregando...</div></div>
    </div>
  `;
  try {
    const customers = await api('/api/customers');
    const table = document.getElementById('customersTable');
    if (customers.length === 0) {
      table.innerHTML = '<div class="empty-state"><h3>Nenhum cliente cadastrado</h3><p>Clique em "Novo Cliente" para começar</p></div>';
    } else {
      table.innerHTML = `
        <table>
          <thead><tr><th>Nome</th><th>Email</th><th>Telefone</th><th>Documento</th><th>Cidade</th><th>Ações</th></tr></thead>
          <tbody>
            ${customers.map(c => `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.email || '-'}</td>
                <td>${c.phone || '-'}</td>
                <td>${c.document || '-'}</td>
                <td>${c.city ? c.city + '/' + c.state : '-'}</td>
                <td>
                  <button class="btn btn-primary" style="padding:6px 12px;font-size:12px" onclick='openCustomerModal(${JSON.stringify(c)})'>Editar</button>
                  <button class="btn btn-danger" style="padding:6px 12px;font-size:12px" onclick="deleteCustomer(${c.id})">Excluir</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    document.getElementById('customersTable').innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

function openCustomerModal(customer = null) {
  const isEdit = !!customer;
  openModal(isEdit ? 'Editar Cliente' : 'Novo Cliente', `
    <form id="customerForm">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Nome *</label><input type="text" id="custName" class="form-control" value="${customer?.name || ''}" required></div>
        <div class="form-group"><label class="form-label">Email</label><input type="email" id="custEmail" class="form-control" value="${customer?.email || ''}"></div>
        <div class="form-group"><label class="form-label">Telefone</label><input type="text" id="custPhone" class="form-control" value="${customer?.phone || ''}"></div>
        <div class="form-group"><label class="form-label">CPF/CNPJ</label><input type="text" id="custDocument" class="form-control" value="${customer?.document || ''}"></div>
        <div class="form-group"><label class="form-label">Endereço</label><input type="text" id="custAddress" class="form-control" value="${customer?.address || ''}"></div>
        <div class="form-group"><label class="form-label">Cidade</label><input type="text" id="custCity" class="form-control" value="${customer?.city || ''}"></div>
        <div class="form-group"><label class="form-label">Estado</label><input type="text" id="custState" class="form-control" value="${customer?.state || ''}"></div>
        <div class="form-group"><label class="form-label">CEP</label><input type="text" id="custZipCode" class="form-control" value="${customer?.zip_code || ''}"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar'}</button>
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      </div>
    </form>
  `);
  document.getElementById('customerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('custName').value,
      email: document.getElementById('custEmail').value,
      phone: document.getElementById('custPhone').value,
      document: document.getElementById('custDocument').value,
      address: document.getElementById('custAddress').value,
      city: document.getElementById('custCity').value,
      state: document.getElementById('custState').value,
      zip_code: document.getElementById('custZipCode').value
    };
    try {
      if (isEdit) await api(`/api/customers/${customer.id}`, { method: 'PUT', body: data });
      else await api('/api/customers', { method: 'POST', body: data });
      closeModal();
      loadCustomers();
    } catch (err) { alert('Erro: ' + err.message); }
  });
}

async function deleteCustomer(id) {
  if (!confirm('Excluir este cliente?')) return;
  try { await api(`/api/customers/${id}`, { method: 'DELETE' }); loadCustomers(); }
  catch (err) { alert('Erro: ' + err.message); }
}

// ====== PRODUCTS ======
async function loadProducts() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Produtos & Estoque</h1><p class="page-subtitle">Controle de produtos e estoque</p></div>
      <button class="btn btn-primary" onclick="openProductModal()">+ Novo Produto</button>
    </div>
    <div class="card">
      <div class="table-container" id="productsTable"><div class="loading"><div class="spinner"></div>Carregando...</div></div>
    </div>
  `;
  try {
    const products = await api('/api/products');
    const table = document.getElementById('productsTable');
    if (products.length === 0) {
      table.innerHTML = '<div class="empty-state"><h3>Nenhum produto cadastrado</h3></div>';
    } else {
      table.innerHTML = `
        <table>
          <thead><tr><th>Nome</th><th>SKU</th><th>Categoria</th><th>Custo</th><th>Preço Venda</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.sku || '-'}</td>
                <td>${p.category || '-'}</td>
                <td>${formatCurrency(p.cost_price)}</td>
                <td><strong>${formatCurrency(p.sell_price)}</strong></td>
                <td>${p.stock_quantity} ${p.unit}</td>
                <td>${p.stock_quantity <= p.min_stock ? '<span class="badge badge-danger">Baixo</span>' : '<span class="badge badge-success">OK</span>'}</td>
                <td>
                  <button class="btn btn-primary" style="padding:6px 12px;font-size:12px" onclick='openProductModal(${JSON.stringify(p)})'>Editar</button>
                  <button class="btn btn-danger" style="padding:6px 12px;font-size:12px" onclick="deleteProduct(${p.id})">Excluir</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    document.getElementById('productsTable').innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

function openProductModal(product = null) {
  const isEdit = !!product;
  openModal(isEdit ? 'Editar Produto' : 'Novo Produto', `
    <form id="productForm">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Nome *</label><input type="text" id="prodName" class="form-control" value="${product?.name || ''}" required></div>
        <div class="form-group"><label class="form-label">SKU</label><input type="text" id="prodSku" class="form-control" value="${product?.sku || ''}"></div>
        <div class="form-group"><label class="form-label">Categoria</label><input type="text" id="prodCategory" class="form-control" value="${product?.category || ''}"></div>
        <div class="form-group"><label class="form-label">Unidade</label><input type="text" id="prodUnit" class="form-control" value="${product?.unit || 'UN'}"></div>
        <div class="form-group"><label class="form-label">Preço de Custo</label><input type="number" step="0.01" id="prodCost" class="form-control" value="${product?.cost_price || 0}"></div>
        <div class="form-group"><label class="form-label">Preço de Venda</label><input type="number" step="0.01" id="prodSell" class="form-control" value="${product?.sell_price || 0}"></div>
        <div class="form-group"><label class="form-label">Estoque Atual</label><input type="number" id="prodStock" class="form-control" value="${product?.stock_quantity || 0}"></div>
        <div class="form-group"><label class="form-label">Estoque Mínimo</label><input type="number" id="prodMinStock" class="form-control" value="${product?.min_stock || 0}"></div>
      </div>
      <div class="form-group"><label class="form-label">Descrição</label><textarea id="prodDesc" class="form-control" rows="2">${product?.description || ''}</textarea></div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar'}</button>
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      </div>
    </form>
  `);
  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('prodName').value,
      sku: document.getElementById('prodSku').value,
      category: document.getElementById('prodCategory').value,
      unit: document.getElementById('prodUnit').value,
      cost_price: parseFloat(document.getElementById('prodCost').value),
      sell_price: parseFloat(document.getElementById('prodSell').value),
      stock_quantity: parseInt(document.getElementById('prodStock').value),
      min_stock: parseInt(document.getElementById('prodMinStock').value),
      description: document.getElementById('prodDesc').value
    };
    try {
      if (isEdit) await api(`/api/products/${product.id}`, { method: 'PUT', body: data });
      else await api('/api/products', { method: 'POST', body: data });
      closeModal();
      loadProducts();
    } catch (err) { alert('Erro: ' + err.message); }
  });
}

async function deleteProduct(id) {
  if (!confirm('Excluir este produto?')) return;
  try { await api(`/api/products/${id}`, { method: 'DELETE' }); loadProducts(); }
  catch (err) { alert('Erro: ' + err.message); }
}

// ====== SALES ======
async function loadSales() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Vendas</h1><p class="page-subtitle">Gerencie suas vendas e faturamento</p></div>
      <button class="btn btn-primary" onclick="openSaleModal()">+ Nova Venda</button>
    </div>
    <div class="card">
      <div class="table-container" id="salesTable"><div class="loading"><div class="spinner"></div>Carregando...</div></div>
    </div>
  `;
  try {
    const sales = await api('/api/sales');
    const table = document.getElementById('salesTable');
    if (sales.length === 0) {
      table.innerHTML = '<div class="empty-state"><h3>Nenhuma venda registrada</h3></div>';
    } else {
      table.innerHTML = `
        <table>
          <thead><tr><th>Nº</th><th>Cliente</th><th>Valor</th><th>Data</th><th>Pagamento</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${sales.map(s => `
              <tr>
                <td><strong>${s.sale_number}</strong></td>
                <td>${s.customer_name || 'Avulso'}</td>
                <td><strong>${formatCurrency(s.total_amount)}</strong></td>
                <td>${formatDate(s.sale_date)}</td>
                <td>${s.payment_method || '-'}</td>
                <td><span class="badge badge-${s.status === 'completed' ? 'success' : 'warning'}">${s.status === 'completed' ? 'Concluída' : 'Pendente'}</span></td>
                <td><button class="btn btn-danger" style="padding:6px 12px;font-size:12px" onclick="deleteSale(${s.id})">Excluir</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    document.getElementById('salesTable').innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

async function openSaleModal() {
  const [customers, products] = await Promise.all([
    api('/api/customers'),
    api('/api/products')
  ]);
  
  window._saleItems = [];
  window._saleProducts = products;
  
  openModal('Nova Venda', `
    <form id="saleForm">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Cliente</label>
          <select id="saleCustomer" class="form-control">
            <option value="">Avulso</option>
            ${customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Data</label>
          <input type="date" id="saleDate" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">Forma de Pagamento</label>
          <select id="salePayment" class="form-control">
            <option value="">Selecione</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Cartão Crédito">Cartão Crédito</option>
            <option value="Cartão Débito">Cartão Débito</option>
            <option value="PIX">PIX</option>
            <option value="Boleto">Boleto</option>
            <option value="Transferência">Transferência</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Desconto</label>
          <input type="number" step="0.01" id="saleDiscount" class="form-control" value="0">
        </div>
      </div>
      <div style="margin:20px 0;padding:15px;background:var(--light);border-radius:8px">
        <h4 style="margin-bottom:10px">Itens da Venda</h4>
        <div style="display:flex;gap:10px;align-items:end;margin-bottom:10px">
          <div style="flex:2">
            <label class="form-label">Produto</label>
            <select id="saleProduct" class="form-control">
              <option value="">Selecione</option>
              ${products.map(p => `<option value="${p.id}" data-price="${p.sell_price}" data-name="${p.name}">${p.name} - ${formatCurrency(p.sell_price)} (Est: ${p.stock_quantity})</option>`).join('')}
            </select>
          </div>
          <div style="flex:1">
            <label class="form-label">Qtd</label>
            <input type="number" id="saleQty" class="form-control" value="1" min="1">
          </div>
          <div style="flex:1">
            <label class="form-label">Preço Unit.</label>
            <input type="number" step="0.01" id="saleUnitPrice" class="form-control" value="0">
          </div>
          <button type="button" class="btn btn-success" onclick="addSaleItem()">+</button>
        </div>
        <div id="saleItemsList"></div>
        <div style="text-align:right;margin-top:10px;font-size:18px;font-weight:700">
          Total: <span id="saleTotal">${formatCurrency(0)}</span>
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button type="submit" class="btn btn-primary">Registrar Venda</button>
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      </div>
    </form>
  `);
  
  document.getElementById('saleProduct').addEventListener('change', function() {
    const opt = this.options[this.selectedIndex];
    if (opt.dataset.price) document.getElementById('saleUnitPrice').value = opt.dataset.price;
  });
  
  document.getElementById('saleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/sales', {
        method: 'POST',
        body: {
          customer_id: document.getElementById('saleCustomer').value || null,
          sale_date: document.getElementById('saleDate').value,
          payment_method: document.getElementById('salePayment').value,
          discount: parseFloat(document.getElementById('saleDiscount').value),
          items: window._saleItems
        }
      });
      closeModal();
      loadSales();
    } catch (err) { alert('Erro: ' + err.message); }
  });
}

function addSaleItem() {
  const select = document.getElementById('saleProduct');
  const opt = select.options[select.selectedIndex];
  if (!opt.value) return;
  
  const qty = parseInt(document.getElementById('saleQty').value);
  const price = parseFloat(document.getElementById('saleUnitPrice').value);
  
  window._saleItems.push({
    product_id: parseInt(opt.value),
    product_name: opt.dataset.name,
    quantity: qty,
    unit_price: price
  });
  
  renderSaleItems();
  select.value = '';
  document.getElementById('saleQty').value = 1;
  document.getElementById('saleUnitPrice').value = 0;
}

function renderSaleItems() {
  const list = document.getElementById('saleItemsList');
  let total = 0;
  list.innerHTML = window._saleItems.map((item, i) => {
    const itemTotal = item.quantity * item.unit_price;
    total += itemTotal;
    return `<div style="display:flex;justify-content:space-between;padding:8px;background:white;border-radius:6px;margin-bottom:5px">
      <span>${item.product_name} x${item.quantity} = ${formatCurrency(itemTotal)}</span>
      <button type="button" class="btn btn-danger" style="padding:4px 8px;font-size:11px" onclick="removeSaleItem(${i})">X</button>
    </div>`;
  }).join('');
  document.getElementById('saleTotal').textContent = formatCurrency(total);
}

function removeSaleItem(index) {
  window._saleItems.splice(index, 1);
  renderSaleItems();
}

async function deleteSale(id) {
  if (!confirm('Excluir esta venda?')) return;
  try { await api(`/api/sales/${id}`, { method: 'DELETE' }); loadSales(); }
  catch (err) { alert('Erro: ' + err.message); }
}

// ====== PURCHASES ======
async function loadPurchases() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Compras</h1><p class="page-subtitle">Gerencie suas compras e reposição de estoque</p></div>
      <button class="btn btn-primary" onclick="openPurchaseModal()">+ Nova Compra</button>
    </div>
    <div class="card">
      <div class="table-container" id="purchasesTable"><div class="loading"><div class="spinner"></div>Carregando...</div></div>
    </div>
  `;
  try {
    const purchases = await api('/api/purchases');
    const table = document.getElementById('purchasesTable');
    if (purchases.length === 0) {
      table.innerHTML = '<div class="empty-state"><h3>Nenhuma compra registrada</h3></div>';
    } else {
      table.innerHTML = `
        <table>
          <thead><tr><th>Nº</th><th>Fornecedor</th><th>Valor</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${purchases.map(p => `
              <tr>
                <td><strong>${p.purchase_number}</strong></td>
                <td>${p.supplier_name || '-'}</td>
                <td><strong>${formatCurrency(p.total_amount)}</strong></td>
                <td>${formatDate(p.purchase_date)}</td>
                <td><span class="badge badge-success">Concluída</span></td>
                <td><button class="btn btn-danger" style="padding:6px 12px;font-size:12px" onclick="deletePurchase(${p.id})">Excluir</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    document.getElementById('purchasesTable').innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

async function openPurchaseModal() {
  const [suppliers, products] = await Promise.all([api('/api/suppliers'), api('/api/products')]);
  window._purchaseItems = [];
  window._purchaseProducts = products;
  
  openModal('Nova Compra', `
    <form id="purchaseForm">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Fornecedor</label>
          <select id="purchaseSupplier" class="form-control">
            <option value="">Selecione</option>
            ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Data</label>
          <input type="date" id="purchaseDate" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        </div>
      </div>
      <div style="margin:20px 0;padding:15px;background:var(--light);border-radius:8px">
        <h4 style="margin-bottom:10px">Itens da Compra</h4>
        <div style="display:flex;gap:10px;align-items:end;margin-bottom:10px">
          <div style="flex:2">
            <label class="form-label">Produto</label>
            <select id="purchaseProduct" class="form-control">
              <option value="">Selecione</option>
              ${products.map(p => `<option value="${p.id}" data-price="${p.cost_price}" data-name="${p.name}">${p.name} - ${formatCurrency(p.cost_price)}</option>`).join('')}
            </select>
          </div>
          <div style="flex:1"><label class="form-label">Qtd</label><input type="number" id="purchaseQty" class="form-control" value="1" min="1"></div>
          <div style="flex:1"><label class="form-label">Preço Unit.</label><input type="number" step="0.01" id="purchaseUnitPrice" class="form-control" value="0"></div>
          <button type="button" class="btn btn-success" onclick="addPurchaseItem()">+</button>
        </div>
        <div id="purchaseItemsList"></div>
        <div style="text-align:right;margin-top:10px;font-size:18px;font-weight:700">Total: <span id="purchaseTotal">${formatCurrency(0)}</span></div>
      </div>
      <div style="display:flex;gap:10px">
        <button type="submit" class="btn btn-primary">Registrar Compra</button>
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      </div>
    </form>
  `);
  
  document.getElementById('purchaseProduct').addEventListener('change', function() {
    const opt = this.options[this.selectedIndex];
    if (opt.dataset.price) document.getElementById('purchaseUnitPrice').value = opt.dataset.price;
  });
  
  document.getElementById('purchaseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/purchases', {
        method: 'POST',
        body: {
          supplier_id: document.getElementById('purchaseSupplier').value || null,
          purchase_date: document.getElementById('purchaseDate').value,
          items: window._purchaseItems
        }
      });
      closeModal();
      loadPurchases();
    } catch (err) { alert('Erro: ' + err.message); }
  });
}

function addPurchaseItem() {
  const select = document.getElementById('purchaseProduct');
  const opt = select.options[select.selectedIndex];
  if (!opt.value) return;
  const qty = parseInt(document.getElementById('purchaseQty').value);
  const price = parseFloat(document.getElementById('purchaseUnitPrice').value);
  window._purchaseItems.push({ product_id: parseInt(opt.value), product_name: opt.dataset.name, quantity: qty, unit_price: price });
  renderPurchaseItems();
  select.value = '';
}

function renderPurchaseItems() {
  const list = document.getElementById('purchaseItemsList');
  let total = 0;
  list.innerHTML = window._purchaseItems.map((item, i) => {
    const t = item.quantity * item.unit_price; total += t;
    return `<div style="display:flex;justify-content:space-between;padding:8px;background:white;border-radius:6px;margin-bottom:5px">
      <span>${item.product_name} x${item.quantity} = ${formatCurrency(t)}</span>
      <button type="button" class="btn btn-danger" style="padding:4px 8px;font-size:11px" onclick="removePurchaseItem(${i})">X</button>
    </div>`;
  }).join('');
  document.getElementById('purchaseTotal').textContent = formatCurrency(total);
}

function removePurchaseItem(i) { window._purchaseItems.splice(i, 1); renderPurchaseItems(); }

async function deletePurchase(id) {
  if (!confirm('Excluir esta compra?')) return;
  try { await api(`/api/purchases/${id}`, { method: 'DELETE' }); loadPurchases(); }
  catch (err) { alert('Erro: ' + err.message); }
}

// ====== SUPPLIERS ======
async function loadSuppliers() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Fornecedores</h1><p class="page-subtitle">Gerencie seus fornecedores</p></div>
      <button class="btn btn-primary" onclick="openSupplierModal()">+ Novo Fornecedor</button>
    </div>
    <div class="card">
      <div class="table-container" id="suppliersTable"><div class="loading"><div class="spinner"></div>Carregando...</div></div>
    </div>
  `;
  try {
    const suppliers = await api('/api/suppliers');
    const table = document.getElementById('suppliersTable');
    if (suppliers.length === 0) {
      table.innerHTML = '<div class="empty-state"><h3>Nenhum fornecedor cadastrado</h3></div>';
    } else {
      table.innerHTML = `
        <table>
          <thead><tr><th>Nome</th><th>Email</th><th>Telefone</th><th>Contato</th><th>Cidade</th><th>Ações</th></tr></thead>
          <tbody>
            ${suppliers.map(s => `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td>${s.email || '-'}</td>
                <td>${s.phone || '-'}</td>
                <td>${s.contact_person || '-'}</td>
                <td>${s.city ? s.city + '/' + s.state : '-'}</td>
                <td>
                  <button class="btn btn-primary" style="padding:6px 12px;font-size:12px" onclick='openSupplierModal(${JSON.stringify(s)})'>Editar</button>
                  <button class="btn btn-danger" style="padding:6px 12px;font-size:12px" onclick="deleteSupplier(${s.id})">Excluir</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    document.getElementById('suppliersTable').innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

function openSupplierModal(supplier = null) {
  const isEdit = !!supplier;
  openModal(isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor', `
    <form id="supplierForm">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Nome *</label><input type="text" id="supName" class="form-control" value="${supplier?.name || ''}" required></div>
        <div class="form-group"><label class="form-label">Email</label><input type="email" id="supEmail" class="form-control" value="${supplier?.email || ''}"></div>
        <div class="form-group"><label class="form-label">Telefone</label><input type="text" id="supPhone" class="form-control" value="${supplier?.phone || ''}"></div>
        <div class="form-group"><label class="form-label">CNPJ</label><input type="text" id="supDocument" class="form-control" value="${supplier?.document || ''}"></div>
        <div class="form-group"><label class="form-label">Pessoa de Contato</label><input type="text" id="supContact" class="form-control" value="${supplier?.contact_person || ''}"></div>
        <div class="form-group"><label class="form-label">Cidade</label><input type="text" id="supCity" class="form-control" value="${supplier?.city || ''}"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar'}</button>
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      </div>
    </form>
  `);
  document.getElementById('supplierForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('supName').value,
      email: document.getElementById('supEmail').value,
      phone: document.getElementById('supPhone').value,
      document: document.getElementById('supDocument').value,
      contact_person: document.getElementById('supContact').value,
      city: document.getElementById('supCity').value
    };
    try {
      if (isEdit) await api(`/api/suppliers/${supplier.id}`, { method: 'PUT', body: data });
      else await api('/api/suppliers', { method: 'POST', body: data });
      closeModal();
      loadSuppliers();
    } catch (err) { alert('Erro: ' + err.message); }
  });
}

async function deleteSupplier(id) {
  if (!confirm('Excluir este fornecedor?')) return;
  try { await api(`/api/suppliers/${id}`, { method: 'DELETE' }); loadSuppliers(); }
  catch (err) { alert('Erro: ' + err.message); }
}

// ====== EXPENSES ======
async function loadExpenses() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Despesas</h1><p class="page-subtitle">Controle de despesas operacionais</p></div>
      <button class="btn btn-primary" onclick="openExpenseModal()">+ Nova Despesa</button>
    </div>
    <div class="card">
      <div class="table-container" id="expensesTable"><div class="loading"><div class="spinner"></div>Carregando...</div></div>
    </div>
  `;
  try {
    const expenses = await api('/api/expenses');
    const table = document.getElementById('expensesTable');
    if (expenses.length === 0) {
      table.innerHTML = '<div class="empty-state"><h3>Nenhuma despesa registrada</h3></div>';
    } else {
      table.innerHTML = `
        <table>
          <thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Data</th><th>Pagamento</th><th>Ações</th></tr></thead>
          <tbody>
            ${expenses.map(e => `
              <tr>
                <td><strong>${e.description}</strong></td>
                <td>${e.category || '-'}</td>
                <td><strong style="color:var(--danger)">${formatCurrency(e.amount)}</strong></td>
                <td>${formatDate(e.expense_date)}</td>
                <td>${e.payment_method || '-'}</td>
                <td><button class="btn btn-danger" style="padding:6px 12px;font-size:12px" onclick="deleteExpense(${e.id})">Excluir</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    document.getElementById('expensesTable').innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

function openExpenseModal() {
  openModal('Nova Despesa', `
    <form id="expenseForm">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Descrição *</label><input type="text" id="expDesc" class="form-control" required></div>
        <div class="form-group"><label class="form-label">Categoria</label>
          <select id="expCategory" class="form-control">
            <option value="">Selecione</option>
            <option>Aluguel</option><option>Energia</option><option>Água</option><option>Internet</option>
            <option>Telefone</option><option>Salários</option><option>Marketing</option><option>Transporte</option>
            <option>Material de Escritório</option><option>Manutenção</option><option>Impostos</option><option>Outros</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Valor *</label><input type="number" step="0.01" id="expAmount" class="form-control" required></div>
        <div class="form-group"><label class="form-label">Data</label><input type="date" id="expDate" class="form-control" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label class="form-label">Forma de Pagamento</label>
          <select id="expPayment" class="form-control">
            <option value="">Selecione</option>
            <option>Dinheiro</option><option>PIX</option><option>Transferência</option><option>Cartão</option><option>Boleto</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button type="submit" class="btn btn-primary">Registrar</button>
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      </div>
    </form>
  `);
  document.getElementById('expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/expenses', {
        method: 'POST',
        body: {
          description: document.getElementById('expDesc').value,
          category: document.getElementById('expCategory').value,
          amount: parseFloat(document.getElementById('expAmount').value),
          expense_date: document.getElementById('expDate').value,
          payment_method: document.getElementById('expPayment').value
        }
      });
      closeModal();
      loadExpenses();
    } catch (err) { alert('Erro: ' + err.message); }
  });
}

async function deleteExpense(id) {
  if (!confirm('Excluir esta despesa?')) return;
  try { await api(`/api/expenses/${id}`, { method: 'DELETE' }); loadExpenses(); }
  catch (err) { alert('Erro: ' + err.message); }
}

// ====== ACCOUNTS RECEIVABLE ======
async function loadReceivable() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Contas a Receber</h1><p class="page-subtitle">Gerencie recebíveis e inadimplência</p></div>
      <button class="btn btn-primary" onclick="openReceivableModal()">+ Nova Conta</button>
    </div>
    <div class="card">
      <div class="table-container" id="receivableTable"><div class="loading"><div class="spinner"></div>Carregando...</div></div>
    </div>
  `;
  try {
    const receivables = await api('/api/financial/receivable');
    const table = document.getElementById('receivableTable');
    if (receivables.length === 0) {
      table.innerHTML = '<div class="empty-state"><h3>Nenhuma conta a receber</h3></div>';
    } else {
      const today = new Date().toISOString().split('T')[0];
      table.innerHTML = `
        <table>
          <thead><tr><th>Descrição</th><th>Cliente</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${receivables.map(r => {
              const isOverdue = r.status === 'pending' && r.due_date < today;
              return `
              <tr style="${isOverdue ? 'background:rgba(239,68,68,0.05)' : ''}">
                <td><strong>${r.description}</strong></td>
                <td>${r.customer_name || '-'}</td>
                <td><strong>${formatCurrency(r.amount)}</strong></td>
                <td>${formatDate(r.due_date)}</td>
                <td><span class="badge badge-${r.status === 'paid' ? 'success' : isOverdue ? 'danger' : 'warning'}">${r.status === 'paid' ? 'Pago' : isOverdue ? 'Vencida' : 'Pendente'}</span></td>
                <td>
                  ${r.status === 'pending' ? `<button class="btn btn-success" style="padding:6px 12px;font-size:12px" onclick="markReceivablePaid(${r.id})">Marcar Pago</button>` : ''}
                  <button class="btn btn-danger" style="padding:6px 12px;font-size:12px" onclick="deleteReceivable(${r.id})">Excluir</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    document.getElementById('receivableTable').innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

function openReceivableModal() {
  openModal('Nova Conta a Receber', `
    <form id="receivableForm">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Descrição *</label><input type="text" id="arDesc" class="form-control" required></div>
        <div class="form-group"><label class="form-label">Valor *</label><input type="number" step="0.01" id="arAmount" class="form-control" required></div>
        <div class="form-group"><label class="form-label">Vencimento</label><input type="date" id="arDueDate" class="form-control"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button type="submit" class="btn btn-primary">Criar</button>
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      </div>
    </form>
  `);
  document.getElementById('receivableForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/financial/receivable', {
        method: 'POST',
        body: { description: document.getElementById('arDesc').value, amount: parseFloat(document.getElementById('arAmount').value), due_date: document.getElementById('arDueDate').value }
      });
      closeModal();
      loadReceivable();
    } catch (err) { alert('Erro: ' + err.message); }
  });
}

async function markReceivablePaid(id) {
  try {
    await api(`/api/financial/receivable/${id}`, { method: 'PUT', body: { status: 'paid', paid_date: new Date().toISOString().split('T')[0] } });
    loadReceivable();
  } catch (err) { alert('Erro: ' + err.message); }
}

async function deleteReceivable(id) {
  if (!confirm('Excluir?')) return;
  try { await api(`/api/financial/receivable/${id}`, { method: 'DELETE' }); loadReceivable(); }
  catch (err) { alert('Erro: ' + err.message); }
}

// ====== ACCOUNTS PAYABLE ======
async function loadPayable() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Contas a Pagar</h1><p class="page-subtitle">Gerencie suas obrigações financeiras</p></div>
      <button class="btn btn-primary" onclick="openPayableModal()">+ Nova Conta</button>
    </div>
    <div class="card">
      <div class="table-container" id="payableTable"><div class="loading"><div class="spinner"></div>Carregando...</div></div>
    </div>
  `;
  try {
    const payables = await api('/api/financial/payable');
    const table = document.getElementById('payableTable');
    if (payables.length === 0) {
      table.innerHTML = '<div class="empty-state"><h3>Nenhuma conta a pagar</h3></div>';
    } else {
      const today = new Date().toISOString().split('T')[0];
      table.innerHTML = `
        <table>
          <thead><tr><th>Descrição</th><th>Fornecedor</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${payables.map(p => {
              const isOverdue = p.status === 'pending' && p.due_date < today;
              return `
              <tr style="${isOverdue ? 'background:rgba(239,68,68,0.05)' : ''}">
                <td><strong>${p.description}</strong></td>
                <td>${p.supplier_name || '-'}</td>
                <td><strong style="color:var(--danger)">${formatCurrency(p.amount)}</strong></td>
                <td>${formatDate(p.due_date)}</td>
                <td><span class="badge badge-${p.status === 'paid' ? 'success' : isOverdue ? 'danger' : 'warning'}">${p.status === 'paid' ? 'Pago' : isOverdue ? 'Vencida' : 'Pendente'}</span></td>
                <td>
                  ${p.status === 'pending' ? `<button class="btn btn-success" style="padding:6px 12px;font-size:12px" onclick="markPayablePaid(${p.id})">Marcar Pago</button>` : ''}
                  <button class="btn btn-danger" style="padding:6px 12px;font-size:12px" onclick="deletePayable(${p.id})">Excluir</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    document.getElementById('payableTable').innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

function openPayableModal() {
  openModal('Nova Conta a Pagar', `
    <form id="payableForm">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Descrição *</label><input type="text" id="apDesc" class="form-control" required></div>
        <div class="form-group"><label class="form-label">Valor *</label><input type="number" step="0.01" id="apAmount" class="form-control" required></div>
        <div class="form-group"><label class="form-label">Vencimento</label><input type="date" id="apDueDate" class="form-control"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button type="submit" class="btn btn-primary">Criar</button>
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      </div>
    </form>
  `);
  document.getElementById('payableForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/financial/payable', {
        method: 'POST',
        body: { description: document.getElementById('apDesc').value, amount: parseFloat(document.getElementById('apAmount').value), due_date: document.getElementById('apDueDate').value }
      });
      closeModal();
      loadPayable();
    } catch (err) { alert('Erro: ' + err.message); }
  });
}

async function markPayablePaid(id) {
  try {
    await api(`/api/financial/payable/${id}`, { method: 'PUT', body: { status: 'paid', paid_date: new Date().toISOString().split('T')[0] } });
    loadPayable();
  } catch (err) { alert('Erro: ' + err.message); }
}

async function deletePayable(id) {
  if (!confirm('Excluir?')) return;
  try { await api(`/api/financial/payable/${id}`, { method: 'DELETE' }); loadPayable(); }
  catch (err) { alert('Erro: ' + err.message); }
}

// ====== CASH FLOW ======
async function loadCashFlow() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Fluxo de Caixa</h1><p class="page-subtitle">Movimentações financeiras</p></div>
    </div>
    <div class="card">
      <div class="table-container" id="cashflowTable"><div class="loading"><div class="spinner"></div>Carregando...</div></div>
    </div>
  `;
  try {
    const data = await api('/api/financial/cashflow');
    const table = document.getElementById('cashflowTable');
    if (data.length === 0) {
      table.innerHTML = '<div class="empty-state"><h3>Sem movimentações</h3></div>';
    } else {
      let runningBalance = 0;
      const rows = data.reverse().map(d => {
        runningBalance += d.type === 'income' ? d.amount : -d.amount;
        return { ...d, balance: runningBalance };
      }).reverse();
      
      table.innerHTML = `
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Saldo</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${formatDate(r.flow_date)}</td>
                <td><span class="badge badge-${r.type === 'income' ? 'success' : 'danger'}">${r.type === 'income' ? 'Entrada' : 'Saída'}</span></td>
                <td>${r.description}</td>
                <td>${r.category || '-'}</td>
                <td style="color:${r.type === 'income' ? 'var(--success)' : 'var(--danger)'};font-weight:700">${r.type === 'income' ? '+' : '-'}${formatCurrency(r.amount)}</td>
                <td><strong>${formatCurrency(r.balance)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    document.getElementById('cashflowTable').innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

// ====== DRE ======
async function loadDRE() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">DRE - Demonstrativo de Resultados</h1><p class="page-subtitle">Análise de resultados do exercício</p></div>
    </div>
    <div class="card" id="dreContent"><div class="loading"><div class="spinner"></div>Gerando DRE...</div></div>
  `;
  try {
    const dre = await api('/api/financial/dre');
    document.getElementById('dreContent').innerHTML = `
      <div style="max-width:700px;margin:0 auto">
        <h2 style="text-align:center;margin-bottom:30px">DRE - Exercício ${dre.year}</h2>
        <div style="border-bottom:2px solid var(--primary);padding-bottom:10px;margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:16px">
            <span><strong>Receita Bruta</strong></span>
            <span style="color:var(--success);font-weight:700">${formatCurrency(dre.revenue)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;color:var(--danger)">
            <span>(-) Custo dos Produtos/Serviços</span>
            <span>${formatCurrency(dre.cogs)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border);font-weight:600;font-size:15px">
            <span>= Lucro Bruto</span>
            <span style="color:${dre.grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(dre.grossProfit)}</span>
          </div>
        </div>
        <div style="border-bottom:2px solid var(--secondary);padding-bottom:10px;margin-bottom:20px">
          <h4 style="margin-bottom:15px;color:var(--gray)">Despesas Operacionais</h4>
          ${dre.expenses.map(e => `
            <div style="display:flex;justify-content:space-between;padding:8px 0">
              <span>${e.category}</span>
              <span style="color:var(--danger)">${formatCurrency(e.total)}</span>
            </div>
          `).join('')}
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border);font-weight:600">
            <span>Total Despesas</span>
            <span style="color:var(--danger)">${formatCurrency(dre.totalExpenses)}</span>
          </div>
        </div>
        <div style="background:${dre.netProfit >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};padding:20px;border-radius:12px;text-align:center">
          <div style="font-size:14px;color:var(--gray);margin-bottom:5px">LUCRO/PREJUÍZO LÍQUIDO</div>
          <div style="font-size:28px;font-weight:700;color:${dre.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(dre.netProfit)}</div>
          <div style="font-size:14px;color:var(--gray);margin-top:10px">Margem Líquida: ${dre.margin}%</div>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('dreContent').innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

// ====== SUBSCRIPTIONS ======
async function loadSubscriptions() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Planos de Assinatura</h1><p class="page-subtitle">Gerencie sua assinatura e conheça nossos planos</p></div>
    </div>
    <div id="plansGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:25px;margin-bottom:40px">
      <div class="card"><div class="loading"><div class="spinner"></div>Carregando planos...</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3 class="card-title">📋 Sua Assinatura Atual</h3></div>
      <div id="mySubscription"><div class="loading">Carregando...</div></div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-header"><h3 class="card-title">💼 Painel Administrativo - Assinaturas</h3></div>
      <div id="adminSubscriptions"><div class="loading">Carregando...</div></div>
    </div>
  `;

  try {
    const plans = await api('/api/subscriptions/plans');
    const plansGrid = document.getElementById('plansGrid');
    plansGrid.innerHTML = plans.map(plan => `
      <div class="card" style="position:relative;${plan.popular ? 'border:2px solid var(--primary);transform:scale(1.02)' : ''}">
        ${plan.popular ? '<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--primary);color:white;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:600">MAIS POPULAR</div>' : ''}
        <h3 style="font-size:22px;margin-bottom:5px">${plan.name}</h3>
        <p style="color:var(--gray);margin-bottom:15px;font-size:14px">${plan.description}</p>
        <div style="margin-bottom:20px">
          <span style="font-size:36px;font-weight:700;color:var(--primary)">R$ ${plan.price.toFixed(2).replace('.', ',')}</span>
          <span style="color:var(--gray)">/mês</span>
        </div>
        <ul style="list-style:none;margin-bottom:25px">
          ${plan.features.map(f => `<li style="padding:6px 0;display:flex;align-items:center;gap:8px;font-size:14px">
            <svg fill="none" stroke="var(--success)" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            ${f}
          </li>`).join('')}
        </ul>
        <button class="btn ${plan.popular ? 'btn-primary' : 'btn-secondary'}" style="width:100%;justify-content:center" onclick="subscribePlan('${plan.id}', '${plan.name}', ${plan.price})">
          ${currentUser.plan === plan.id ? '✓ Plano Atual' : 'Assinar'}
        </button>
      </div>
    `).join('');

    // My subscription
    try {
      const mySub = await api('/api/subscriptions/my');
      const mySubDiv = document.getElementById('mySubscription');
      if (mySub) {
        mySubDiv.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px">
            <div><strong>Plano:</strong> ${mySub.plan_name}</div>
            <div><strong>Valor:</strong> ${formatCurrency(mySub.plan_price)}/mês</div>
            <div><strong>Status:</strong> <span class="badge badge-${mySub.status === 'active' ? 'success' : 'danger'}">${mySub.status === 'active' ? 'Ativo' : 'Inativo'}</span></div>
            <div><strong>Início:</strong> ${formatDate(mySub.start_date)}</div>
            <div><strong>Renovação Auto:</strong> ${mySub.auto_renew ? 'Sim' : 'Não'}</div>
          </div>
        `;
      } else {
        mySubDiv.innerHTML = '<p style="color:var(--gray)">Nenhuma assinatura ativa. Escolha um plano acima.</p>';
      }
    } catch (e) {
      document.getElementById('mySubscription').innerHTML = '<p style="color:var(--gray)">Nenhuma assinatura.</p>';
    }

    // Admin panel
    try {
      const stats = await api('/api/subscriptions/stats');
      const adminDiv = document.getElementById('adminSubscriptions');
      adminDiv.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:20px">
          <div class="kpi-card info" style="padding:20px">
            <div class="kpi-label">Total de Assinaturas</div>
            <div style="font-size:24px;font-weight:700;margin-top:5px">${stats.totalSubscriptions}</div>
          </div>
          <div class="kpi-card success" style="padding:20px">
            <div class="kpi-label">Assinaturas Ativas</div>
            <div style="font-size:24px;font-weight:700;margin-top:5px">${stats.activeSubscriptions}</div>
          </div>
          <div class="kpi-card" style="padding:20px">
            <div class="kpi-label">MRR (Receita Recorrente)</div>
            <div style="font-size:24px;font-weight:700;margin-top:5px">${formatCurrency(stats.mrr)}</div>
          </div>
        </div>
        ${stats.planDistribution.length > 0 ? `
          <h4 style="margin-bottom:10px">Distribuição por Plano</h4>
          <table>
            <thead><tr><th>Plano</th><th>Assinantes</th><th>Receita</th></tr></thead>
            <tbody>
              ${stats.planDistribution.map(p => `
                <tr>
                  <td><strong>${p.plan_name}</strong></td>
                  <td>${p.count}</td>
                  <td>${formatCurrency(p.revenue)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="color:var(--gray)">Nenhuma assinatura cadastrada ainda.</p>'}
      `;
    } catch (e) {
      document.getElementById('adminSubscriptions').innerHTML = '<p style="color:var(--gray);font-size:13px">Acesso administrativo necessário para ver estatísticas.</p>';
    }
  } catch (err) {
    document.getElementById('plansGrid').innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

async function subscribePlan(planId, planName, planPrice) {
  if (!confirm(`Assinar o plano ${planName} por R$ ${planPrice.toFixed(2).replace('.', ',')}/mês?`)) return;
  try {
    await api('/api/subscriptions', {
      method: 'POST',
      body: { plan_name: planName, plan_price: planPrice, payment_method: 'PIX', auto_renew: true }
    });
    alert('Assinatura realizada com sucesso!');
    loadSubscriptions();
  } catch (err) { alert('Erro: ' + err.message); }
}

// ====== INIT ======
if (token && currentUser) {
  showApp();
}
