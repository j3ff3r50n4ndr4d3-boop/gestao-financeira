// ============================================================
// AGENTE IA ERP - Camada de métricas
// Lê o banco (SQLite/sql.js) e monta o "retrato do negócio":
// números reais que alimentam o motor de análise e o LLM.
// Nada aqui inventa dado: se não há registro, o valor vem zerado
// e o motor sinaliza "sem dados" em vez de estimar.
// ============================================================

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------- utilidades de banco ----------
function rows(db, sql, params = []) {
  const result = db.exec(sql, params);
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function one(db, sql, params = []) {
  const list = rows(db, sql, params);
  return list.length ? list[0] : null;
}

function scalar(db, sql, params = [], fallback = 0) {
  const result = db.exec(sql, params);
  if (!result || result.length === 0 || result[0].values.length === 0) return fallback;
  const value = result[0].values[0][0];
  return value === null || value === undefined ? fallback : value;
}

// ---------- utilidades de data ----------
function isoDate(date) {
  return date.toISOString().split('T')[0];
}

function daysAgo(n, from = new Date()) {
  return isoDate(new Date(from.getTime() - n * DAY_MS));
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function monthLabel(key) {
  const [, m] = String(key).split('-');
  return MONTH_LABELS[Number(m) - 1] || key;
}

function lastMonths(count, from = new Date()) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

function parseDateOnly(value) {
  if (!value) return null;
  const str = String(value).slice(0, 10);
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const fmtBrl = (value) =>
  'R$ ' + Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (value) => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';

function round(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function safeDiv(a, b, fallback = 0) {
  const n = Number(b);
  if (!n || !Number.isFinite(n)) return fallback;
  return Number(a) / n;
}

function pct(a, b, digits = 1) {
  return round(safeDiv(a, b) * 100, digits);
}

function growth(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return round(((current - previous) / Math.abs(previous)) * 100, 1);
}

// Categorias tipicamente fixas (usadas em ponto de equilíbrio e custo fixo)
const FIXED_CATEGORIES = [
  'aluguel', 'salário', 'salarios', 'salário ', 'internet', 'telefone', 'contador', 'contabilidade',
  'software', 'assinatura', 'seguro', 'imposto', 'taxas', 'condomínio', 'condominio', 'limpeza',
  'segurança', 'seguranca', 'manutenção', 'manutencao', 'marketing'
];

function isFixedCategory(category) {
  const c = String(category || '').toLowerCase();
  return FIXED_CATEGORIES.some((f) => c.includes(f));
}

// ============================================================
// Coleta principal
// ============================================================
function collectMetrics(db, userId, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const today = isoDate(now);
  const currentKey = monthKey(now);
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousKey = monthKey(previousDate);
  const seriesKeys = lastMonths(options.months || 12, now);
  const startOfSeries = `${seriesKeys[0]}-01`;

  const hasSales = scalar(db, 'SELECT COUNT(*) FROM sales WHERE user_id = ?', [userId]) > 0;

  // ---------- Séries mensais ----------
  const revenueByMonthRaw = rows(
    db,
    `SELECT strftime('%Y-%m', sale_date) AS m, SUM(total_amount) AS total, COUNT(*) AS qty
       FROM sales WHERE user_id = ? AND sale_date >= ? GROUP BY m`,
    [userId, startOfSeries]
  );
  const expenseByMonthRaw = rows(
    db,
    `SELECT strftime('%Y-%m', expense_date) AS m, SUM(amount) AS total
       FROM expenses WHERE user_id = ? AND expense_date >= ? GROUP BY m`,
    [userId, startOfSeries]
  );
  const purchaseByMonthRaw = rows(
    db,
    `SELECT strftime('%Y-%m', purchase_date) AS m, SUM(total_amount) AS total
       FROM purchases WHERE user_id = ? AND purchase_date >= ? GROUP BY m`,
    [userId, startOfSeries]
  );
  const cogsByMonthRaw = rows(
    db,
    `SELECT strftime('%Y-%m', s.sale_date) AS m,
            COALESCE(SUM(si.quantity * COALESCE(p.cost_price, 0)), 0) AS total
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
      WHERE s.user_id = ? AND s.sale_date >= ? GROUP BY m`,
    [userId, startOfSeries]
  );

  const byMonth = (list) => {
    const map = new Map();
    list.forEach((r) => map.set(r.m, { total: Number(r.total || 0), qty: Number(r.qty || 0) }));
    return map;
  };
  const revMap = byMonth(revenueByMonthRaw);
  const expMap = byMonth(expenseByMonthRaw);
  const purMap = byMonth(purchaseByMonthRaw);
  const cogsMap = byMonth(cogsByMonthRaw);

  const series = seriesKeys.map((k) => {
    const revenue = revMap.get(k)?.total || 0;
    const expenses = expMap.get(k)?.total || 0;
    const purchases = purMap.get(k)?.total || 0;
    const cogs = cogsMap.get(k)?.total || 0;
    return {
      key: k,
      label: monthLabel(k),
      revenue: round(revenue),
      expenses: round(expenses),
      purchases: round(purchases),
      cogs: round(cogs),
      grossProfit: round(revenue - cogs),
      // DRE completo (receita - CMV - despesas): é este que o agente usa
      result: round(revenue - cogs - expenses),
      // Visão simplificada do dashboard do ERP (receita - despesas)
      simpleResult: round(revenue - expenses),
      salesCount: revMap.get(k)?.qty || 0
    };
  });

  const emptyMonth = { revenue: 0, expenses: 0, purchases: 0, cogs: 0, grossProfit: 0, result: 0, simpleResult: 0, salesCount: 0 };
  const current = series[series.length - 1] || emptyMonth;
  const previous = series[series.length - 2] || emptyMonth;

  // ---- Ritmo do mês corrente ----
  // Comparar um mês em andamento com meses fechados geraria alertas falsos de
  // queda. Projetamos o mês corrente pelo dias vividos (ritmo linear) e marcamos
  // a série como parcial para a interface sinalizar.
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const monthIsPartial = daysElapsed < daysInMonth;
  const paceFactor = monthIsPartial ? daysInMonth / Math.max(1, daysElapsed) : 1;
  if (monthIsPartial && current) current.partial = true;

  // ---------- CMV e margem bruta (custo real dos itens vendidos) ----------
  const cogsRow = one(
    db,
    `SELECT COALESCE(SUM(si.quantity * COALESCE(p.cost_price, 0)), 0) AS cogs,
            COALESCE(SUM(si.total_price), 0) AS gross
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
      WHERE s.user_id = ? AND s.sale_date >= ?`,
    [userId, startOfSeries]
  );
  const cogsSeries = round(cogsRow?.cogs || 0);
  const grossSeries = round(cogsRow?.gross || 0);

  const cogsMonthRow = one(
    db,
    `SELECT COALESCE(SUM(si.quantity * COALESCE(p.cost_price, 0)), 0) AS cogs
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
      WHERE s.user_id = ? AND strftime('%Y-%m', s.sale_date) = ?`,
    [userId, currentKey]
  );
  const cogsMonth = round(cogsMonthRow?.cogs || 0);

  // ---------- Clientes ----------
  const customers = rows(db, `SELECT * FROM customers WHERE user_id = ? ORDER BY name`, [userId]);
  const customerSales = rows(
    db,
    `SELECT c.id, c.name, c.email, c.city, c.state,
            COUNT(s.id) AS orders,
            COALESCE(SUM(s.total_amount), 0) AS revenue,
            MIN(s.sale_date) AS first_sale,
            MAX(s.sale_date) AS last_sale
       FROM customers c
       LEFT JOIN sales s ON s.customer_id = c.id AND s.user_id = c.user_id
      WHERE c.user_id = ?
      GROUP BY c.id ORDER BY revenue DESC`,
    [userId]
  );

  const activeWindow = daysAgo(90, now);
  const activeCustomers = customerSales.filter((c) => c.last_sale && c.last_sale >= activeWindow);
  const inactiveCustomers = customerSales.filter((c) => c.last_sale && c.last_sale < activeWindow);
  const neverBought = customerSales.filter((c) => !c.last_sale);
  const newCustomersByMonth = {};
  customerSales.forEach((c) => {
    if (!c.first_sale) return;
    const key = String(c.first_sale).slice(0, 7);
    newCustomersByMonth[key] = (newCustomersByMonth[key] || 0) + 1;
  });
  const repeatCustomers = customerSales.filter((c) => Number(c.orders) > 1);
  const totalCustomerRevenue = customerSales.reduce((acc, c) => acc + Number(c.revenue || 0), 0);
  const top5Revenue = customerSales.slice(0, 5).reduce((acc, c) => acc + Number(c.revenue || 0), 0);

  // ---------- Produtos / estoque ----------
  const products = rows(db, `SELECT * FROM products WHERE user_id = ? ORDER BY name`, [userId]);

  const demand90 = rows(
    db,
    `SELECT si.product_id AS product_id, COALESCE(SUM(si.quantity), 0) AS units
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.user_id = ? AND s.sale_date >= ?
      GROUP BY si.product_id`,
    [userId, daysAgo(90, now)]
  );
  const demandAll = rows(
    db,
    `SELECT si.product_id AS product_id, COALESCE(SUM(si.quantity), 0) AS units,
            COALESCE(SUM(si.total_price), 0) AS revenue
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.user_id = ?
      GROUP BY si.product_id`,
    [userId]
  );
  const lastSaleByProduct = rows(
    db,
    `SELECT si.product_id AS product_id, MAX(s.sale_date) AS last_sale
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.user_id = ? GROUP BY si.product_id`,
    [userId]
  );
  const demand90Map = new Map(demand90.map((d) => [d.product_id, Number(d.units || 0)]));
  const demandAllMap = new Map(demandAll.map((d) => [d.product_id, { units: Number(d.units || 0), revenue: Number(d.revenue || 0) }]));
  const lastSaleMap = new Map(lastSaleByProduct.map((d) => [d.product_id, d.last_sale]));

  const productAnalysis = products.map((p) => {
    const stock = Number(p.stock_quantity || 0);
    const minStock = Number(p.min_stock || 0);
    const cost = Number(p.cost_price || 0);
    const price = Number(p.sell_price || 0);
    const units90 = demand90Map.get(p.id) || 0;
    const all = demandAllMap.get(p.id) || { units: 0, revenue: 0 };
    const dailyDemand = round(units90 / 90, 3);
    const coverageDays = dailyDemand > 0 ? Math.round(stock / dailyDemand) : null;
    const marginPct = price > 0 ? round(((price - cost) / price) * 100, 1) : 0;
    const markup = cost > 0 ? round((price - cost) / cost * 100, 1) : null;
    const lastSale = lastSaleMap.get(p.id) || null;
    const daysWithoutSale = lastSale ? Math.max(0, Math.floor((now - parseDateOnly(lastSale)) / DAY_MS)) : null;
    const stockValueCost = round(stock * cost);
    const stockValueSale = round(stock * price);
    // Reposição sugerida: cobre 30 dias de demanda + estoque mínimo de segurança
    const suggestedReorder = Math.max(0, Math.ceil(dailyDemand * 30 + minStock - stock));

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category || 'Sem categoria',
      unit: p.unit || 'UN',
      stock,
      minStock,
      cost,
      price,
      marginPct,
      markup,
      units90,
      totalUnits: all.units,
      totalRevenue: round(all.revenue),
      dailyDemand,
      coverageDays,
      lastSale,
      daysWithoutSale,
      stockValueCost,
      stockValueSale,
      suggestedReorder,
      stockout: stock <= 0,
      belowMin: stock > 0 && minStock > 0 && stock <= minStock,
      // cobertura acima de 90 dias para itens que ainda vendem
      overstock: coverageDays !== null && coverageDays > 90,
      // capital parado: sem venda há 90+ dias (ou nunca vendido) com saldo em estoque
      deadStock: stock > 0 && (!lastSale || (daysWithoutSale !== null && daysWithoutSale > 90)),
      neverSold: !lastSale && stock > 0,
      excessCapital: stock > 0 && ((coverageDays !== null && coverageDays > 90) || !lastSale || (daysWithoutSale !== null && daysWithoutSale > 90)),
      negativeMargin: price > 0 && cost >= price
    };
  });

  const stockValueCost = round(productAnalysis.reduce((a, p) => a + p.stockValueCost, 0));
  const stockValueSale = round(productAnalysis.reduce((a, p) => a + p.stockValueSale, 0));

  // ---------- Curva ABC (por receita vendida) ----------
  const abc = (list, valueKey) => {
    const sorted = [...list].sort((a, b) => Number(b[valueKey] || 0) - Number(a[valueKey] || 0));
    const total = sorted.reduce((a, x) => a + Number(x[valueKey] || 0), 0) || 1;
    let acc = 0;
    return sorted.map((item) => {
      // o acumulado ANTES do item define a classe: quem cruza o corte pertence
      // à classe superior (prática padrão de curva ABC)
      const accBefore = round((acc / total) * 100, 1);
      acc += Number(item[valueKey] || 0);
      const share = round((Number(item[valueKey] || 0) / total) * 100, 2);
      const accShare = round((acc / total) * 100, 1);
      const klass = accBefore < 80 ? 'A' : accBefore < 95 ? 'B' : 'C';
      return { ...item, share, accShare, class: klass };
    });
  };
  const productsAbc = abc(productAnalysis, 'totalRevenue');
  const customersAbc = abc(
    customerSales.map((c) => ({ ...c, revenue: round(Number(c.revenue || 0)) })),
    'revenue'
  );

  const classSummary = (list) => {
    const out = { A: { count: 0, value: 0 }, B: { count: 0, value: 0 }, C: { count: 0, value: 0 } };
    list.forEach((i) => {
      if (!out[i.class]) return;
      out[i.class].count += 1;
      out[i.class].value = round(out[i.class].value + Number(i.totalRevenue ?? i.revenue ?? 0));
    });
    return out;
  };

  // ---------- Vendas / comercial ----------
  const salesCount = scalar(db, 'SELECT COUNT(*) FROM sales WHERE user_id = ?', [userId]);
  const avgItemsPerSale = round(
    scalar(
      db,
      `SELECT AVG(q) FROM (SELECT COUNT(*) AS q FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.user_id = ? GROUP BY si.sale_id)`,
      [userId]
    ),
    2
  );
  const discountRow = one(
    db,
    `SELECT COALESCE(SUM(discount), 0) AS total, COALESCE(SUM(total_amount), 0) AS revenue,
            SUM(CASE WHEN discount > 0 THEN 1 ELSE 0 END) AS with_discount
       FROM sales WHERE user_id = ?`,
    [userId]
  );
  const paymentMethods = rows(
    db,
    `SELECT COALESCE(payment_method, 'Não informado') AS method, COUNT(*) AS qty, COALESCE(SUM(total_amount), 0) AS total
       FROM sales WHERE user_id = ? GROUP BY method ORDER BY total DESC`,
    [userId]
  );
  const salesByCategory = rows(
    db,
    `SELECT COALESCE(p.category, 'Sem categoria') AS category,
            COALESCE(SUM(si.total_price), 0) AS revenue, COALESCE(SUM(si.quantity), 0) AS units
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
      WHERE s.user_id = ? GROUP BY category ORDER BY revenue DESC`,
    [userId]
  );
  const pendingShipments = scalar(
    db,
    `SELECT COUNT(*) FROM sales WHERE user_id = ? AND status IN ('pending','pendente','processing')`,
    [userId]
  );
  const pendingShipmentValue = round(
    scalar(
      db,
      `SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE user_id = ? AND status IN ('pending','pendente','processing')`,
      [userId]
    )
  );
  const salesStatus = rows(
    db,
    `SELECT status, COUNT(*) AS qty, COALESCE(SUM(total_amount),0) AS total FROM sales WHERE user_id = ? GROUP BY status`,
    [userId]
  );

  // ---------- Despesas ----------
  const expensesByCategory = rows(
    db,
    `SELECT COALESCE(category, 'Sem categoria') AS category, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS qty
       FROM expenses WHERE user_id = ? GROUP BY category ORDER BY total DESC`,
    [userId]
  );
  const expensesCurrentMonth = rows(
    db,
    `SELECT COALESCE(category, 'Sem categoria') AS category, COALESCE(SUM(amount), 0) AS total
       FROM expenses WHERE user_id = ? AND strftime('%Y-%m', expense_date) = ? GROUP BY category ORDER BY total DESC`,
    [userId, currentKey]
  );
  const fixedExpenseMonth = round(
    expensesCurrentMonth.filter((e) => isFixedCategory(e.category)).reduce((a, e) => a + Number(e.total || 0), 0)
  );
  const fixedRows = rows(db, `SELECT category, COALESCE(SUM(amount),0) AS total FROM expenses WHERE user_id = ? GROUP BY category`, [userId]);
  const fixedExpenseAll = round(
    fixedRows.filter((r) => isFixedCategory(r.category)).reduce((a, r) => a + Number(r.total || 0), 0)
  );
  const monthsWithData = series.filter((m) => m.expenses > 0).length || 1;
  const fixedExpenseAvgMonth = round(fixedExpenseAll / monthsWithData);

  // ---------- Contas a receber / pagar ----------
  const ar = rows(
    db,
    `SELECT ar.*, c.name AS customer_name FROM accounts_receivable ar
       LEFT JOIN customers c ON c.id = ar.customer_id
      WHERE ar.user_id = ? ORDER BY ar.due_date ASC`,
    [userId]
  );
  const ap = rows(
    db,
    `SELECT ap.*, s.name AS supplier_name FROM accounts_payable ap
       LEFT JOIN suppliers s ON s.id = ap.supplier_id
      WHERE ap.user_id = ? ORDER BY ap.due_date ASC`,
    [userId]
  );

  const agingBucket = (dueDate) => {
    const d = parseDateOnly(dueDate);
    if (!d) return 'sem_vencimento';
    const diff = Math.floor((now - d) / DAY_MS);
    if (diff <= 0) return 'a_vencer';
    if (diff <= 15) return '1_15';
    if (diff <= 30) return '16_30';
    if (diff <= 60) return '31_60';
    return '60_plus';
  };

  const buildAging = (list) => {
    const buckets = {
      a_vencer: { qty: 0, total: 0 },
      '1_15': { qty: 0, total: 0 },
      '16_30': { qty: 0, total: 0 },
      '31_60': { qty: 0, total: 0 },
      '60_plus': { qty: 0, total: 0 }
    };
    list.forEach((item) => {
      const b = agingBucket(item.due_date);
      if (!buckets[b]) return;
      buckets[b].qty += 1;
      buckets[b].total = round(buckets[b].total + Number(item.amount || 0));
    });
    Object.keys(buckets).forEach((k) => (buckets[k].total = round(buckets[k].total)));
    return buckets;
  };

  const arPending = ar.filter((r) => String(r.status).toLowerCase() === 'pending' || String(r.status).toLowerCase() === 'pendente');
  const apPending = ap.filter((r) => String(r.status).toLowerCase() === 'pending' || String(r.status).toLowerCase() === 'pendente');
  const arOverdue = arPending.filter((r) => r.due_date && r.due_date < today);
  const apOverdue = apPending.filter((r) => r.due_date && r.due_date < today);
  const arDueNext7 = arPending.filter((r) => r.due_date && r.due_date >= today && r.due_date <= daysAgo(-7, now));
  const apDueNext7 = apPending.filter((r) => r.due_date && r.due_date >= today && r.due_date <= daysAgo(-7, now));

  const arTotal = round(arPending.reduce((a, r) => a + Number(r.amount || 0), 0));
  const apTotal = round(apPending.reduce((a, r) => a + Number(r.amount || 0), 0));
  const arOverdueTotal = round(arOverdue.reduce((a, r) => a + Number(r.amount || 0), 0));
  const apOverdueTotal = round(apOverdue.reduce((a, r) => a + Number(r.amount || 0), 0));
  const arPaid = round(ar.filter((r) => String(r.status).toLowerCase() === 'paid').reduce((a, r) => a + Number(r.amount || 0), 0));
  const apPaid = round(ap.filter((r) => String(r.status).toLowerCase() === 'paid').reduce((a, r) => a + Number(r.amount || 0), 0));

  // DSO / DPO aproximados sobre o período efetivamente movimentado
  const revenueSeriesTotal = round(series.reduce((a, m) => a + m.revenue, 0));
  const purchasesSeriesTotal = round(series.reduce((a, m) => a + m.purchases, 0));
  const activeMonths = series.filter((m) => m.revenue > 0 || m.purchases > 0).length || seriesKeys.length;
  const activeDays = activeMonths * 30;
  const dso = revenueSeriesTotal > 0 ? round(safeDiv(arTotal * activeDays, revenueSeriesTotal)) : null;
  const dpo = purchasesSeriesTotal > 0 ? round(safeDiv(apTotal * activeDays, purchasesSeriesTotal)) : null;

  // ---------- Caixa ----------
  const cashIncome = round(scalar(db, `SELECT COALESCE(SUM(amount),0) FROM cash_flow WHERE user_id = ? AND type = 'income'`, [userId]));
  const cashExpense = round(scalar(db, `SELECT COALESCE(SUM(amount),0) FROM cash_flow WHERE user_id = ? AND type = 'expense'`, [userId]));
  const cashBalance = round(cashIncome - cashExpense);
  const cashLast30 = round(
    scalar(
      db,
      `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END),0) FROM cash_flow WHERE user_id = ? AND flow_date >= ?`,
      [userId, daysAgo(30, now)]
    )
  );
  const cashByCategory = rows(
    db,
    `SELECT COALESCE(category,'Sem categoria') AS category, type, COALESCE(SUM(amount),0) AS total
       FROM cash_flow WHERE user_id = ? GROUP BY category, type ORDER BY total DESC`,
    [userId]
  );

  // ---------- Fornecedores / compras ----------
  const suppliers = rows(db, `SELECT * FROM suppliers WHERE user_id = ? ORDER BY name`, [userId]);
  const purchases = rows(
    db,
    `SELECT p.*, s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.user_id = ? ORDER BY p.purchase_date DESC`,
    [userId]
  );
  const supplierSpend = rows(
    db,
    `SELECT COALESCE(s.name, 'Sem fornecedor') AS supplier, COALESCE(SUM(p.total_amount),0) AS total, COUNT(*) AS qty
       FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.user_id = ? GROUP BY supplier ORDER BY total DESC`,
    [userId]
  );
  const totalSupplierSpend = round(supplierSpend.reduce((a, s) => a + Number(s.total || 0), 0));

  // Variação do custo de compra por produto (última compra x custo cadastrado)
  const purchaseItems = rows(
    db,
    `SELECT pi.product_id AS product_id, pi.product_name AS name, pi.unit_price AS unit_price,
            pi.quantity AS quantity, p.purchase_date AS purchase_date
       FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id
      WHERE p.user_id = ? ORDER BY p.purchase_date DESC`,
    [userId]
  );
  const costDrift = [];
  const seenProduct = new Set();
  purchaseItems.forEach((pi) => {
    if (!pi.product_id || seenProduct.has(pi.product_id)) return;
    seenProduct.add(pi.product_id);
    const prod = products.find((p) => p.id === pi.product_id);
    if (!prod) return;
    const registered = Number(prod.cost_price || 0);
    const lastPaid = Number(pi.unit_price || 0);
    if (registered <= 0 || lastPaid <= 0) return;
    const drift = round(((lastPaid - registered) / registered) * 100, 1);
    if (Math.abs(drift) >= 5) {
      costDrift.push({
        productId: prod.id,
        name: prod.name,
        registeredCost: registered,
        lastPurchaseCost: lastPaid,
        driftPct: drift,
        purchaseDate: pi.purchase_date,
        impactPerUnit: round(lastPaid - registered),
        stockImpact: round((lastPaid - registered) * Number(prod.stock_quantity || 0))
      });
    }
  });

  // ---------- Qualidade cadastral (processos) ----------
  const catalogIssues = {
    withoutCategory: products.filter((p) => !p.category).length,
    withoutSku: products.filter((p) => !p.sku).length,
    withoutMinStock: products.filter((p) => !Number(p.min_stock)).length,
    withoutCost: products.filter((p) => !Number(p.cost_price)).length,
    negativeMargin: productAnalysis.filter((p) => p.negativeMargin).length,
    customersWithoutEmail: customers.filter((c) => !c.email).length,
    customersWithoutPhone: customers.filter((c) => !c.phone).length,
    salesWithoutCustomer: scalar(db, `SELECT COUNT(*) FROM sales WHERE user_id = ? AND (customer_id IS NULL OR customer_id = 0)`, [userId])
  };

  // ---------- Assinaturas (recorrência) ----------
  const subscriptions = rows(db, `SELECT * FROM subscriptions WHERE user_id = ?`, [userId]);
  const activeSubscriptions = subscriptions.filter((s) => String(s.status).toLowerCase() === 'active');
  const mrr = round(activeSubscriptions.reduce((a, s) => a + Number(s.plan_price || 0), 0));

  // ---------- Derivados de negócio ----------
  // DRE completo: Receita - CMV = Lucro bruto; Lucro bruto - Despesas = Resultado operacional
  const grossProfitMonth = round(current.revenue - cogsMonth);
  const grossMarginPct = pct(grossProfitMonth, current.revenue);
  const operatingResult = round(grossProfitMonth - current.expenses);
  const netMarginPct = pct(operatingResult, current.revenue);
  // Visão simplificada usada pelo dashboard do ERP (receita - despesas, sem CMV)
  const simpleResult = round(current.simpleResult !== undefined ? current.simpleResult : current.revenue - current.expenses);
  const averageTicket = round(safeDiv(current.revenue, current.salesCount));
  // ---- Base estável para ponto de equilíbrio, ritmo do mês e projeções ----
  // Usa os últimos meses fechados (o mês em andamento fica de fora) para derivar
  // as taxas de CMV e de despesas variáveis. Assim, ponto de equilíbrio,
  // projeção e resultado usam exatamente a mesma decomposição de custos.
  const closedMonths = (monthIsPartial ? series.slice(0, -1) : series).filter((x) => x.revenue > 0);
  const basisMonths = (closedMonths.length ? closedMonths : series.filter((x) => x.revenue > 0)).slice(-3);
  const basisRevenue = basisMonths.reduce((a, x) => a + x.revenue, 0);
  const basisCogs = basisMonths.reduce((a, x) => a + (x.cogs || 0), 0);
  const basisExpenses = basisMonths.reduce((a, x) => a + x.expenses, 0);
  const basisCount = basisMonths.length || 1;
  const cogsRatePct = basisRevenue > 0 ? round(pct(basisCogs, basisRevenue), 1) : (current.revenue > 0 ? grossMarginPct !== null ? round(100 - grossMarginPct, 1) : null : null);
  const variableExpenseAvg = Math.max(0, basisExpenses / basisCount - fixedExpenseAvgMonth);
  const variableExpenseRatePct = basisRevenue > 0 ? round(pct(variableExpenseAvg * basisCount, basisRevenue), 1) : 0;
  const contributionMarginPct = cogsRatePct === null
    ? null
    : round(100 - cogsRatePct - variableExpenseRatePct, 1);
  const breakEvenRevenue = fixedExpenseAvgMonth > 0 && contributionMarginPct && contributionMarginPct > 0
    ? round(fixedExpenseAvgMonth / (contributionMarginPct / 100))
    : null;

  // ---- Ritmo do mês corrente (comparação justa em mês em andamento) ----
  // Nos primeiros dias do mês a extrapolação linear é instável (3 vendas no dia 1
  // virariam 90 no mês); abaixo de 5 dias projetamos pela média dos meses fechados.
  const paceReliable = daysElapsed >= 5;
  const basisRevenueAvg = closedMonths.length
    ? closedMonths.slice(-3).reduce((a, x) => a + x.revenue, 0) / Math.min(3, closedMonths.slice(-3).length)
    : 0;
  const basisSalesAvg = closedMonths.length
    ? closedMonths.slice(-3).reduce((a, x) => a + x.salesCount, 0) / Math.min(3, closedMonths.slice(-3).length)
    : 0;
  const runRateRevenue = current.revenue * paceFactor;
  const paceRevenue = monthIsPartial
    ? round(paceReliable || !basisRevenueAvg ? Math.max(runRateRevenue, current.revenue) : basisRevenueAvg)
    : round(current.revenue);
  const monthCogsRate = current.revenue > 0 ? cogsMonth / current.revenue : (cogsRatePct !== null ? cogsRatePct / 100 : 0);
  const paceCogs = round(paceRevenue * (monthIsPartial && !paceReliable && basisRevenueAvg ? (cogsRatePct !== null ? cogsRatePct / 100 : monthCogsRate) : monthCogsRate));
  const paceModelExpenses = round(fixedExpenseAvgMonth + paceRevenue * (variableExpenseRatePct / 100));
  const expenseHistory = (monthIsPartial ? series.slice(0, -1) : series).filter((x) => x.expenses > 0).slice(-3);
  const expenseAvg = expenseHistory.length
    ? expenseHistory.reduce((a, x) => a + x.expenses, 0) / expenseHistory.length
    : current.expenses;
  // nunca projeta menos do que já foi lançado nem menos que a média recente
  const paceExpenses = monthIsPartial
    ? round(Math.max(current.expenses, paceModelExpenses, basisCount > 1 ? expenseAvg : 0))
    : round(current.expenses);
  const pace = {
    daysElapsed,
    daysInMonth,
    isPartial: monthIsPartial,
    reliable: !monthIsPartial || paceReliable,
    factor: round(paceFactor, 3),
    revenue: paceRevenue,
    cogs: paceCogs,
    expenses: paceExpenses,
    purchases: round(monthIsPartial && !paceReliable && basisRevenueAvg ? current.purchases : current.purchases * paceFactor),
    result: round(paceRevenue - paceCogs - paceExpenses),
    salesCount: monthIsPartial && !paceReliable && basisSalesAvg
      ? Math.round(basisSalesAvg)
      : Math.round(current.salesCount * paceFactor),
    growth: growth(paceRevenue, previous.revenue),
    basis: monthIsPartial
      ? (paceReliable
          ? `ritmo dos ${daysElapsed} primeiros dias do mês`
          : 'média dos últimos meses fechados (início do mês, amostra pequena)')
      : 'mês fechado',
    expenseBasis: monthIsPartial
      ? `despesas fixas de ${fmtBrl(fixedExpenseAvgMonth)} + ${fmtPct(variableExpenseRatePct)} de variáveis sobre a receita`
      : 'mês fechado'
  };
  const inventoryTurnover = stockValueCost > 0 ? round(safeDiv(cogsSeries, stockValueCost), 2) : null;
  const turnoverAnnualized = inventoryTurnover !== null ? round(inventoryTurnover * (12 / activeMonths), 2) : null;
  const workingCapital = round(arTotal + stockValueCost - apTotal);
  const inventoryDays = inventoryTurnover && inventoryTurnover > 0 ? round(safeDiv(activeDays, inventoryTurnover)) : null;
  const cashCycle = dso !== null && dpo !== null && inventoryDays !== null ? round(dso + inventoryDays - dpo) : null;

  // LTV: receita anualizada por cliente x margem bruta x horizonte de relacionamento
  const buyingCustomers = Math.max(1, customerSales.filter((c) => c.orders > 0).length);
  const revenuePerCustomer = safeDiv(totalCustomerRevenue, buyingCustomers);
  const revenuePerCustomerYear = round(revenuePerCustomer * (12 / activeMonths));
  const repeatRate = pct(repeatCustomers.length, buyingCustomers);
  const lifetimeYears = round(Math.min(3, Math.max(1, 1 + repeatRate / 50)), 1);
  const ltv = round(revenuePerCustomerYear * (grossMarginPct / 100 || 0) * lifetimeYears);
  const ltvSampleSmall = buyingCustomers < 20;
  const marketingSpendSeries = round(
    fixedRows.filter((r) => String(r.category || '').toLowerCase().includes('marketing')).reduce((a, r) => a + Number(r.total || 0), 0)
  );
  const newCustomersSeries = seriesKeys.reduce((a, k) => a + (newCustomersByMonth[k] || 0), 0);
  const cac = newCustomersSeries > 0 ? round(safeDiv(marketingSpendSeries, newCustomersSeries)) : null;

  // Sazonalidade (coeficiente de variação da receita mensal)
  // mês em andamento não entra na análise de sazonalidade
  const fullSeries = monthIsPartial ? series.slice(0, -1) : series;
  const revenues = fullSeries.filter((m) => m.revenue > 0).map((m) => m.revenue);
  const meanRevenue = revenues.length ? revenues.reduce((a, b) => a + b, 0) / revenues.length : 0;
  const variance = revenues.length > 1 ? revenues.reduce((a, b) => a + (b - meanRevenue) ** 2, 0) / (revenues.length - 1) : 0;
  const seasonalityCv = meanRevenue > 0 ? round((Math.sqrt(variance) / meanRevenue) * 100, 1) : 0;
  const peakMonth = fullSeries.reduce((best, m) => (m.revenue > (best?.revenue || 0) ? m : best), null);
  const lowMonth = fullSeries.filter((m) => m.revenue > 0).reduce((worst, m) => (m.revenue < (worst?.revenue || Infinity) ? m : worst), null);

  return {
    generatedAt: now.toISOString(),
    today,
    currentMonth: currentKey,
    previousMonth: previousKey,
    hasData: hasSales || products.length > 0 || customers.length > 0,
    hasSales,
    series,
    seriesKeys,
    pace,
    revenue: {
      current: round(current.revenue),
      previous: round(previous.revenue),
      growth: growth(current.revenue, previous.revenue),
      total: round(series.reduce((a, m) => a + m.revenue, 0)),
      avgMonth: round(meanRevenue),
      salesCount: current.salesCount,
      averageTicket,
      avgItemsPerSale
    },
    expenses: {
      current: round(current.expenses),
      previous: round(previous.expenses),
      variation: growth(current.expenses, previous.expenses),
      total: round(series.reduce((a, m) => a + m.expenses, 0)),
      byCategory: expensesByCategory.map((e) => ({ category: e.category, total: round(e.total), qty: e.qty })),
      currentByCategory: expensesCurrentMonth.map((e) => ({ category: e.category, total: round(e.total) })),
      fixedAvgMonth: fixedExpenseAvgMonth,
      fixedCurrentMonth: fixedExpenseMonth,
      revenueSharePct: pct(current.expenses, current.revenue)
    },
    purchases: {
      current: round(current.purchases),
      previous: round(previous.purchases),
      variation: growth(current.purchases, previous.purchases),
      total: round(series.reduce((a, m) => a + m.purchases, 0)),
      count: purchases.length,
      supplierSpend: supplierSpend.map((s) => ({ supplier: s.supplier, total: round(s.total), qty: s.qty, sharePct: pct(s.total, totalSupplierSpend) })),
      costDrift
    },
    profitability: {
      cogsMonth,
      cogsSeries,
      grossProfitMonth,
      grossMarginPct,
      operatingResult,
      simpleResult,
      netMarginPct,
      breakEvenRevenue,
      breakEvenGap: breakEvenRevenue !== null ? round(pace.revenue - breakEvenRevenue) : null,
      contributionMarginPct,
      cogsRatePct,
      variableExpenseRatePct,
      fixedExpenseAvgMonth,
      basisMonths: basisCount
    },
    cash: {
      balance: cashBalance,
      income: cashIncome,
      expense: cashExpense,
      last30: cashLast30,
      byCategory: cashByCategory.map((c) => ({ category: c.category, type: c.type, total: round(c.total) }))
    },
    receivable: {
      total: arTotal,
      overdueTotal: arOverdueTotal,
      overdueCount: arOverdue.length,
      overduePct: pct(arOverdueTotal, arTotal),
      dueNext7: round(arDueNext7.reduce((a, r) => a + Number(r.amount || 0), 0)),
      paidTotal: arPaid,
      dso,
      aging: buildAging(arPending),
      items: arPending.slice(0, 25).map((r) => ({
        id: r.id,
        description: r.description,
        customer: r.customer_name || 'Cliente não informado',
        amount: round(r.amount),
        dueDate: r.due_date,
        overdueDays: r.due_date && r.due_date < today ? Math.floor((now - parseDateOnly(r.due_date)) / DAY_MS) : 0
      }))
    },
    payable: {
      total: apTotal,
      overdueTotal: apOverdueTotal,
      overdueCount: apOverdue.length,
      dueNext7: round(apDueNext7.reduce((a, r) => a + Number(r.amount || 0), 0)),
      paidTotal: apPaid,
      dpo,
      aging: buildAging(apPending),
      items: apPending.slice(0, 25).map((r) => ({
        id: r.id,
        description: r.description,
        supplier: r.supplier_name || 'Fornecedor não informado',
        amount: round(r.amount),
        dueDate: r.due_date,
        overdueDays: r.due_date && r.due_date < today ? Math.floor((now - parseDateOnly(r.due_date)) / DAY_MS) : 0
      }))
    },
    customers: {
      total: customers.length,
      withSales: customerSales.filter((c) => c.orders > 0).length,
      active: activeCustomers.length,
      inactive: inactiveCustomers.length,
      neverBought: neverBought.length,
      repeatCount: repeatCustomers.length,
      repeatRatePct: pct(repeatCustomers.length, customerSales.filter((c) => c.orders > 0).length),
      newByMonth: seriesKeys.map((k) => ({ key: k, label: monthLabel(k), count: newCustomersByMonth[k] || 0 })),
      newTotal: newCustomersSeries,
      top5ConcentrationPct: pct(top5Revenue, totalCustomerRevenue),
      abc: classSummary(customersAbc),
      top: customersAbc.slice(0, 10).map((c) => ({
        id: c.id,
        name: c.name,
        city: c.city,
        state: c.state,
        orders: Number(c.orders || 0),
        revenue: round(Number(c.revenue || 0)),
        sharePct: c.share,
        class: c.class,
        lastSale: c.last_sale
      })),
      inactiveList: inactiveCustomers
        .sort((a, b) => String(b.last_sale).localeCompare(String(a.last_sale)))
        .slice(0, 15)
        .map((c) => ({
          id: c.id,
          name: c.name,
          revenue: round(Number(c.revenue || 0)),
          orders: Number(c.orders || 0),
          lastSale: c.last_sale,
          daysSince: parseDateOnly(c.last_sale) ? Math.floor((now - parseDateOnly(c.last_sale)) / DAY_MS) : null
        })),
      ltv,
      ltvSampleSmall,
      lifetimeYears,
      revenuePerCustomerYear
    },
    products: {
      total: products.length,
      stockValueCost,
      stockValueSale,
      potentialMargin: round(stockValueSale - stockValueCost),
      turnover: inventoryTurnover,
      turnoverAnnualized,
      inventoryDays,
      activeMonths,
      stockouts: productAnalysis.filter((p) => p.stockout).length,
      belowMin: productAnalysis.filter((p) => p.belowMin).length,
      overstock: productAnalysis.filter((p) => p.overstock).length,
      deadStock: productAnalysis.filter((p) => p.deadStock).length,
      neverSold: productAnalysis.filter((p) => p.neverSold).length,
      negativeMargin: productAnalysis.filter((p) => p.negativeMargin).length,
      abc: classSummary(productsAbc),
      byCategory: salesByCategory.map((c) => ({ category: c.category, revenue: round(c.revenue), units: Number(c.units || 0) })),
      list: productAnalysis,
      top: productsAbc.filter((p) => p.totalRevenue > 0).slice(0, 10),
      reorderList: productAnalysis
        .filter((p) => p.suggestedReorder > 0 && (p.stockout || p.belowMin || p.coverageDays === null || p.coverageDays < 15))
        .sort((a, b) => b.dailyDemand * b.price - a.dailyDemand * a.price)
        .slice(0, 15),
      deadList: productAnalysis.filter((p) => p.deadStock || p.neverSold).slice(0, 15)
    },
    shipping: {
      pendingOrders: pendingShipments,
      pendingValue: pendingShipmentValue,
      statusBreakdown: salesStatus.map((s) => ({ status: s.status || 'sem status', qty: s.qty, total: round(s.total) })),
      stockoutsBlocking: productAnalysis.filter((p) => p.stockout && p.dailyDemand > 0).length
    },
    marketing: {
      spendTotal: marketingSpendSeries,
      spendCurrentMonth: round(expensesCurrentMonth.filter((e) => String(e.category).toLowerCase().includes('marketing')).reduce((a, e) => a + Number(e.total || 0), 0)),
      newCustomers: newCustomersSeries,
      cac,
      ltv,
      ltvCac: cac && ltv ? round(safeDiv(ltv, cac), 2) : null,
      ltvSampleSmall,
      lifetimeYears,
      revenuePerCustomerYear,
      seasonalityCv,
      peakMonth: peakMonth ? { key: peakMonth.key, label: peakMonth.label, revenue: peakMonth.revenue } : null,
      lowMonth: lowMonth ? { key: lowMonth.key, label: lowMonth.label, revenue: lowMonth.revenue } : null,
      retentionPct: pct(repeatCustomers.length, customerSales.filter((c) => c.orders > 0).length),
      paymentMethods: paymentMethods.map((p) => ({ method: p.method, qty: p.qty, total: round(p.total) })),
      discountTotal: round(discountRow?.total || 0),
      discountSharePct: pct(discountRow?.total || 0, (discountRow?.revenue || 0) + (discountRow?.total || 0)),
      salesWithDiscountPct: pct(discountRow?.with_discount || 0, salesCount),
      portfolio: buildPortfolio(productAnalysis, series)
    },
    operations: {
      workingCapital,
      cashCycle,
      activeMonths,
      inventoryDays,
      dso,
      dpo,
      catalogIssues,
      mrr,
      activeSubscriptions: activeSubscriptions.length,
      salesCount,
      suppliersCount: suppliers.length,
      purchasesCount: purchases.length,
      costDriftCount: costDrift.length
    },
    concentration: {
      topCustomerSharePct: pct(customerSales[0] ? Number(customerSales[0].revenue || 0) : 0, totalCustomerRevenue),
      topCustomerName: customerSales[0]?.name || null,
      top5SharePct: pct(top5Revenue, totalCustomerRevenue),
      topProductSharePct: productsAbc[0] ? productsAbc[0].share : 0,
      topProductName: productsAbc[0]?.name || null,
      topSupplierSharePct: supplierSpend[0] ? pct(supplierSpend[0].total, totalSupplierSpend) : 0,
      topSupplierName: supplierSpend[0]?.supplier || null
    }
  };
}

// Matriz BCG simplificada: participação (receita) x giro (demanda nos últimos 90 dias)
function buildPortfolio(productAnalysis, series) {
  const totalRevenue = productAnalysis.reduce((a, p) => a + p.totalRevenue, 0) || 1;
  const avgUnits = productAnalysis.length
    ? productAnalysis.reduce((a, p) => a + p.units90, 0) / productAnalysis.length
    : 0;
  const groups = { estrela: [], vaca: [], interrogacao: [], abacaxi: [] };
  productAnalysis.forEach((p) => {
    const share = (p.totalRevenue / totalRevenue) * 100;
    const highShare = share >= 10;
    const highMovement = p.units90 >= Math.max(1, avgUnits);
    const item = { id: p.id, name: p.name, sharePct: round(share, 1), units90: p.units90, marginPct: p.marginPct, stock: p.stock };
    if (highShare && highMovement) groups.estrela.push(item);
    else if (highShare && !highMovement) groups.vaca.push(item);
    else if (!highShare && highMovement) groups.interrogacao.push(item);
    else groups.abacaxi.push(item);
  });
  return groups;
}

module.exports = {
  collectMetrics,
  rows,
  one,
  scalar,
  isoDate,
  daysAgo,
  monthKey,
  monthLabel,
  lastMonths,
  round,
  safeDiv,
  pct,
  growth,
  isFixedCategory,
  parseDateOnly
};
