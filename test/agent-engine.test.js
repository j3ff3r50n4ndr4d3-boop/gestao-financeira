// ============================================================
// Testes do motor do Agente IA (métricas, regras, NLU e base
// de conhecimento). Usa um banco SQLite temporário com dados
// controlados para validar as regras de especialista.
// ============================================================

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DB_FILE = path.join(os.tmpdir(), `erp-agente-engine-${process.pid}.db`);
process.env.ERP_DB_PATH = DB_FILE;
process.env.JWT_SECRET = 'segredo-de-teste';

if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);

const { initDatabase, getDb, saveDatabase } = require('../database');
const { collectMetrics } = require('../src/agent/metrics');
const { analyzeAll, analyzeDomain } = require('../src/agent/engine');
const { parse } = require('../src/agent/nlu');
const { DOMAINS } = require('../src/agent/domains');
const { KNOWLEDGE, GENERAL } = require('../src/agent/knowledge');
const { buildReport } = require('../src/agent/report');
const { compose } = require('../src/agent/compose');

let userId = null;
let db = null;

function iso(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function monthLabel(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

test.before(async () => {
  await initDatabase();
  db = getDb();
  userId = db.exec("SELECT id FROM users WHERE email = 'admin@erp.com'")[0].values[0][0];

  // cliente ativo e cliente inativo
  db.run(`INSERT INTO customers (user_id, name, email, phone, city, state) VALUES (?, 'Cliente Ativo', 'ativo@x.com', '11 1', 'SP', 'SP')`, [userId]);
  db.run(`INSERT INTO customers (user_id, name, email, phone, city, state) VALUES (?, 'Cliente Parado', 'parado@x.com', '11 2', 'RJ', 'RJ')`, [userId]);
  const ativoId = db.exec(`SELECT id FROM customers WHERE name = 'Cliente Ativo'`)[0].values[0][0];
  const paradoId = db.exec(`SELECT id FROM customers WHERE name = 'Cliente Parado'`)[0].values[0][0];

  db.run(`INSERT INTO suppliers (user_id, name, email, city, state) VALUES (?, 'Fornecedor X', 'f@x.com', 'SP', 'SP')`, [userId]);
  const supplierId = db.exec(`SELECT id FROM suppliers WHERE name = 'Fornecedor X'`)[0].values[0][0];

  // produtos: normal, em ruptura, com margem negativa e sem venda
  db.run(`INSERT INTO products (user_id, name, sku, category, cost_price, sell_price, stock_quantity, min_stock, unit) VALUES (?, 'Produto Bom', 'PB-1', 'Geral', 50, 100, 40, 10, 'UN')`, [userId]);
  db.run(`INSERT INTO products (user_id, name, sku, category, cost_price, sell_price, stock_quantity, min_stock, unit) VALUES (?, 'Produto Ruptura', 'PR-1', 'Geral', 30, 80, 0, 5, 'UN')`, [userId]);
  db.run(`INSERT INTO products (user_id, name, sku, category, cost_price, sell_price, stock_quantity, min_stock, unit) VALUES (?, 'Produto Prejuizo', 'PP-1', 'Geral', 120, 100, 20, 5, 'UN')`, [userId]);
  db.run(`INSERT INTO products (user_id, name, sku, category, cost_price, sell_price, stock_quantity, min_stock, unit) VALUES (?, 'Produto Encalhado', 'PE-1', 'Geral', 200, 400, 60, 5, 'UN')`, [userId]);
  const bomId = db.exec(`SELECT id FROM products WHERE sku = 'PB-1'`)[0].values[0][0];
  const rupturaId = db.exec(`SELECT id FROM products WHERE sku = 'PR-1'`)[0].values[0][0];
  const prejuizoId = db.exec(`SELECT id FROM products WHERE sku = 'PP-1'`)[0].values[0][0];

  // vendas: recente para o cliente ativo, antiga para o parado
  const mkSale = (customerId, dateStr, items, status = 'completed') => {
    const total = items.reduce((a, it) => a + it.qty * it.price, 0);
    db.run(
      `INSERT INTO sales (user_id, customer_id, sale_number, sale_date, total_amount, discount, payment_method, status) VALUES (?, ?, ?, ?, ?, 0, 'PIX', ?)`,
      [userId, customerId, `V-${Math.random().toString(36).slice(2)}`, dateStr, Math.round(total * 100) / 100, status]
    );
    const saleId = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
    items.forEach((it) => {
      db.run(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)`,
        [saleId, it.productId, it.name, it.qty, it.price, it.qty * it.price]
      );
    });
  };

  for (let m = 0; m < 4; m++) {
    mkSale(ativoId, `${monthLabel(m)}-10`, [{ productId: bomId, name: 'Produto Bom', qty: 10, price: 100 }]);
    mkSale(ativoId, `${monthLabel(m)}-15`, [{ productId: rupturaId, name: 'Produto Ruptura', qty: 4, price: 80 }], m === 0 ? 'pending' : 'completed');
  }
  mkSale(paradoId, `${monthLabel(6)}-05`, [{ productId: prejuizoId, name: 'Produto Prejuizo', qty: 5, price: 100 }]);

  // compra com custo acima do cadastrado (variação de custo)
  db.run(
    `INSERT INTO purchases (user_id, supplier_id, purchase_number, purchase_date, total_amount, payment_method, status) VALUES (?, ?, 'C-1', ?, 700, 'Boleto', 'completed')`,
    [userId, supplierId, `${monthLabel(1)}-05`]
  );
  const purchaseId = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  db.run(
    `INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, 'Produto Bom', 10, 70, 700)`,
    [purchaseId, bomId]
  );

  // despesas fixas
  ['Aluguel', 'Salários', 'Internet'].forEach((cat, i) => {
    for (let m = 0; m < 4; m++) {
      const amount = [2000, 3000, 200][i];
      db.run(`INSERT INTO expenses (user_id, description, category, amount, expense_date) VALUES (?, ?, ?, ?, ?)`, [userId, `Despesa ${cat}`, cat, amount, `${monthLabel(m)}-05`]);
      db.run(`INSERT INTO cash_flow (user_id, type, description, category, amount, flow_date) VALUES (?, 'expense', ?, ?, ?, ?)`, [userId, `Despesa ${cat}`, cat, amount, `${monthLabel(m)}-05`]);
    }
  });
  db.run(`INSERT INTO cash_flow (user_id, type, description, category, amount, flow_date) VALUES (?, 'income', 'Venda', 'Vendas', 5000, ?)`, [userId, iso(-5)]);

  // contas a receber: uma vencida, uma a vencer / contas a pagar: uma vencida
  db.run(`INSERT INTO accounts_receivable (user_id, customer_id, description, amount, due_date, status) VALUES (?, ?, 'Fatura vencida', 1500, ?, 'pending')`, [userId, ativoId, iso(-20)]);
  db.run(`INSERT INTO accounts_receivable (user_id, customer_id, description, amount, due_date, status) VALUES (?, ?, 'Fatura futura', 800, ?, 'pending')`, [userId, ativoId, iso(10)]);
  db.run(`INSERT INTO accounts_payable (user_id, supplier_id, description, amount, due_date, status) VALUES (?, ?, 'NF vencida', 900, ?, 'pending')`, [userId, supplierId, iso(-4)]);
  db.run(`INSERT INTO accounts_payable (user_id, supplier_id, description, amount, due_date, status) VALUES (?, ?, 'NF futura', 1200, ?, 'pending')`, [userId, supplierId, iso(5)]);

  saveDatabase();
});

test.after(() => {
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
});

// ---------- métricas ----------
test('métricas: receita, CMV e margem calculados a partir dos itens vendidos', () => {
  const m = collectMetrics(db, userId);
  assert.ok(m.hasData, 'deveria detectar dados na base');
  assert.equal(m.revenue.current, 1320, 'receita do mês = 10x100 + 4x80');
  assert.equal(m.profitability.cogsMonth, 10 * 50 + 4 * 30, 'CMV usa o custo cadastrado');
  assert.equal(m.profitability.grossProfitMonth, 1320 - 620);
  assert.equal(m.profitability.operatingResult, 1320 - 620 - m.expenses.current);
});

test('métricas: estoque identifica ruptura, excesso, encalhado e reposição', () => {
  const m = collectMetrics(db, userId);
  const bySku = (sku) => m.products.list.find((p) => p.sku === sku);
  assert.equal(m.products.stockouts, 1);
  assert.equal(bySku('PR-1').stockout, true);
  assert.ok(bySku('PR-1').suggestedReorder > 0, 'item em ruptura precisa de reposição');
  assert.equal(bySku('PE-1').neverSold, true, 'produto sem nenhuma venda');
  assert.equal(bySku('PE-1').deadStock, true, '60 unidades sem demanda = capital parado');
  assert.ok(m.products.deadList.some((p) => p.sku === 'PE-1'), 'deve entrar na lista de estoque parado');
  assert.equal(bySku('PP-1').negativeMargin, true, 'custo maior que preço');
  assert.equal(bySku('PB-1').neverSold, false);
  assert.ok(m.products.stockValueCost > 0);
});

test('métricas: clientes ativos, inativos e curva ABC', () => {
  const m = collectMetrics(db, userId);
  assert.equal(m.customers.total, 2);
  assert.equal(m.customers.active, 1);
  assert.equal(m.customers.inactive, 1);
  assert.equal(m.customers.inactiveList[0].name, 'Cliente Parado');
  assert.equal(m.customers.top[0].name, 'Cliente Ativo');
  assert.equal(m.customers.top[0].class, 'A');
});

test('métricas: aging de recebíveis e vencimentos', () => {
  const m = collectMetrics(db, userId);
  assert.equal(m.receivable.total, 2300);
  assert.equal(m.receivable.overdueTotal, 1500);
  assert.equal(m.receivable.overdueCount, 1);
  assert.equal(m.receivable.items[0].overdueDays >= 20, true);
  assert.equal(m.payable.overdueTotal, 900);
  assert.ok(m.receivable.aging['16_30'].total + m.receivable.aging['31_60'].total >= 1500);
});

test('métricas: variação de custo de compra é detectada', () => {
  const m = collectMetrics(db, userId);
  const drift = m.purchases.costDrift.find((c) => c.name === 'Produto Bom');
  assert.ok(drift, 'deveria apontar desvio entre custo cadastrado e última compra');
  assert.equal(drift.registeredCost, 50);
  assert.equal(drift.lastPurchaseCost, 70);
  assert.ok(drift.driftPct > 30);
});

test('métricas: base vazia não quebra e sinaliza ausência de dados', () => {
  const initSqlJs = require('sql.js');
  return initSqlJs().then((SQL) => {
    const empty = new SQL.Database();
    empty.run(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)`);
    empty.run(`INSERT INTO users (id, email) VALUES (99, 'vazio@x.com')`);
    ['customers (id INTEGER PRIMARY KEY, user_id INT, name TEXT, email TEXT, phone TEXT, city TEXT, state TEXT)',
     'suppliers (id INTEGER PRIMARY KEY, user_id INT, name TEXT)',
     'products (id INTEGER PRIMARY KEY, user_id INT, name TEXT, sku TEXT, category TEXT, cost_price REAL, sell_price REAL, stock_quantity INT, min_stock INT, unit TEXT)',
     'sales (id INTEGER PRIMARY KEY, user_id INT, customer_id INT, sale_number TEXT, sale_date DATE, total_amount REAL, discount REAL, payment_method TEXT, status TEXT)',
     'sale_items (id INTEGER PRIMARY KEY, sale_id INT, product_id INT, product_name TEXT, quantity INT, unit_price REAL, total_price REAL)',
     'purchases (id INTEGER PRIMARY KEY, user_id INT, supplier_id INT, purchase_number TEXT, purchase_date DATE, total_amount REAL, payment_method TEXT, status TEXT)',
     'purchase_items (id INTEGER PRIMARY KEY, purchase_id INT, product_id INT, product_name TEXT, quantity INT, unit_price REAL, total_price REAL)',
     'expenses (id INTEGER PRIMARY KEY, user_id INT, description TEXT, category TEXT, amount REAL, expense_date DATE)',
     'accounts_receivable (id INTEGER PRIMARY KEY, user_id INT, customer_id INT, description TEXT, amount REAL, due_date DATE, status TEXT)',
     'accounts_payable (id INTEGER PRIMARY KEY, user_id INT, supplier_id INT, description TEXT, amount REAL, due_date DATE, status TEXT)',
     'cash_flow (id INTEGER PRIMARY KEY, user_id INT, type TEXT, description TEXT, category TEXT, amount REAL, flow_date DATE)',
     'subscriptions (id INTEGER PRIMARY KEY, user_id INT, plan_name TEXT, plan_price REAL, status TEXT)'
    ].forEach((ddl) => empty.run(`CREATE TABLE ${ddl}`));

    const m = collectMetrics(empty, 99);
    assert.equal(m.hasData, false);
    assert.equal(m.revenue.current, 0);
    const analysis = analyzeAll(m);
    assert.equal(analysis.domains.length, 6);
    assert.match(analysis.company.summary, /dados/i);
  });
});

// ---------- motor de análise ----------
test('análise: devolve as 6 áreas com nota, nível, KPIs, leituras, alertas e recomendações', () => {
  const m = collectMetrics(db, userId);
  const analysis = analyzeAll(m);
  assert.equal(analysis.domains.length, 6);
  assert.deepEqual(analysis.domains.map((d) => d.id), DOMAINS.map((d) => d.id));
  analysis.domains.forEach((d) => {
    assert.ok(d.score === null || (d.score >= 0 && d.score <= 100), `nota inválida em ${d.id}`);
    assert.ok(d.level && d.level.label, `nível ausente em ${d.id}`);
    assert.ok(Array.isArray(d.kpis) && d.kpis.length > 0, `KPIs ausentes em ${d.id}`);
    assert.ok(Array.isArray(d.insights), `insights ausentes em ${d.id}`);
    d.kpis.forEach((k) => assert.ok(k.label && k.value !== undefined));
  });
  assert.ok(analysis.company.summary.length > 50);
  assert.ok(analysis.alerts.length > 0);
  assert.ok(analysis.recommendations.length > 0);
  assert.ok(analysis.plan.now && analysis.plan.next && analysis.plan.later);
});

test('análise: regras de especialista disparam os alertas esperados', () => {
  const m = collectMetrics(db, userId);
  const analysis = analyzeAll(m);
  const titles = analysis.alerts.map((a) => a.title).join(' | ');
  assert.match(titles, /ruptura/i, 'deve alertar ruptura de estoque');
  assert.match(titles, /prejuízo/i, 'deve alertar produto vendido com prejuízo');
  assert.match(titles, /vencidos/i, 'deve alertar recebíveis vencidos');
  assert.match(titles, /custo/i, 'deve alertar custo de compra desatualizado');

  const critical = analysis.alerts.filter((a) => a.severity === 'critica');
  assert.ok(critical.length >= 2);
  // alertas vêm ordenados por severidade
  const order = analysis.alerts.map((a) => a.weight);
  assert.deepEqual(order, [...order].sort((a, b) => b - a));
});

test('análise: recomendações têm passo a passo, prazo e impacto', () => {
  const m = collectMetrics(db, userId);
  const analysis = analyzeAll(m);
  analysis.recommendations.forEach((r) => {
    assert.ok(r.title && r.why);
    assert.ok(Array.isArray(r.steps) && r.steps.length >= 3, `passos insuficientes em ${r.title}`);
    assert.ok([1, 2, 3].includes(r.priority));
    assert.match(r.horizon, /(7|30|90) dias/);
  });
  const prioridades = analysis.recommendations.map((r) => r.priority);
  assert.deepEqual(prioridades, [...prioridades].sort((a, b) => a - b));
});

test('análise: nota da área de estoque cai quando há ruptura', () => {
  const m = collectMetrics(db, userId);
  const estoque = analyzeDomain('estoque', m);
  assert.ok(estoque.score < 80, `estoque com ruptura deveria ter nota menor, veio ${estoque.score}`);
  const comercial = analyzeDomain('comercial', m);
  assert.ok(comercial.score > estoque.score, 'área com ruptura deve ficar abaixo da área comercial saudável');
});

// ---------- NLU ----------
test('NLU: reconhece intenção e domínio em português', () => {
  const cases = [
    ['como está a saúde da empresa?', 'diagnostico', null],
    ['quais produtos estão em ruptura?', 'lista', 'estoque'],
    ['quanto tenho a receber vencido?', null, 'financeiro'],
    ['onde está o gargalo da produção?', 'lista', 'producao'],
    ['o que devo fazer primeiro nesta semana?', 'plano', null],
    ['me fale das vendas e dos clientes', null, 'comercial'],
    ['qual é o CAC e o LTV?', null, 'marketing'],
    ['como registro uma compra no sistema?', 'como_fazer', null],
    ['previsão do próximo mês', 'previsao', null],
    ['monte o DRE gerencial', 'relatorio', 'empresarial']
  ];
  cases.forEach(([text, intent, domain]) => {
    const p = parse(text);
    if (intent) assert.equal(p.intent, intent, `intenção errada para "${text}": ${p.intent}`);
    if (domain !== undefined) assert.equal(p.domain, domain, `domínio errado para "${text}": ${p.domain}`);
  });
});

test('NLU: extrai entidades de período, severidade e limite', () => {
  const p = parse('liste os top 5 clientes inativos críticos do mês passado');
  assert.equal(p.entities.limit, 5);
  assert.equal(p.entities.period, 'previous_month');
  assert.equal(p.entities.severity, 'critica');
});

// ---------- respostas ----------
test('compose: responde perguntas factuais com números reais e blocos', () => {
  const m = collectMetrics(db, userId);
  const analysis = analyzeAll(m);

  const vencidos = compose(parse('quanto tenho a receber vencido?'), m, analysis);
  assert.match(vencidos.text, /1\.500|1500/);
  assert.ok(vencidos.blocks.some((b) => b.type === 'table'));

  const ruptura = compose(parse('quais produtos estão em ruptura?'), m, analysis);
  assert.match(ruptura.text, /Produto Ruptura/);

  const diagnostico = compose(parse('como está a saúde da empresa?'), m, analysis);
  assert.match(diagnostico.text, /Diagnóstico geral/);

  const plano = compose(parse('o que devo fazer agora?'), m, analysis);
  assert.match(plano.text, /Plano de ação/);

  const conceito = compose(parse('o que é ponto de equilíbrio?'), m, analysis);
  assert.match(conceito.text, /ponto de equilíbrio|Ponto de equilíbrio/i);
});

// ---------- base de conhecimento ----------
test('conhecimento: as 6 áreas têm conceitos, playbooks e check-up', () => {
  DOMAINS.forEach((d) => {
    const k = KNOWLEDGE[d.id];
    assert.ok(k, `conhecimento ausente para ${d.id}`);
    assert.ok(k.concepts.length >= 5, `poucos conceitos em ${d.id}`);
    assert.ok(k.playbooks.length >= 3, `poucos playbooks em ${d.id}`);
    assert.ok(k.checkup.length >= 4, `check-up curto em ${d.id}`);
    k.concepts.forEach((c) => {
      assert.ok(c.term && c.formula && c.explanation && c.target);
    });
    k.playbooks.forEach((p) => {
      assert.ok(p.title && p.when && p.kpi && p.steps.length >= 4);
    });
  });
  assert.ok(GENERAL.formulas.length >= 8);
  assert.ok(GENERAL.erpHowTo.length >= 5);
});

test('domínios: metadados completos nas 6 áreas pedidas', () => {
  assert.equal(DOMAINS.length, 6);
  DOMAINS.forEach((d) => {
    assert.ok(d.id && d.name && d.icon && d.color && d.persona && d.mission);
    assert.ok(d.scope.length >= 5);
    assert.ok(d.kpis.length >= 5);
    assert.ok(d.typicalQuestions.length >= 4);
    assert.ok(d.routines.length >= 3);
  });
  const nomes = DOMAINS.map((d) => d.name.toLowerCase()).join(' | ');
  ['empresarial', 'produção e processos', 'comercial e vendas', 'marketing', 'financeira', 'estoque e expedição'].forEach((esperado) => {
    assert.ok(nomes.includes(esperado), `área ausente: ${esperado}`);
  });
});

// ---------- relatório ----------
test('relatório: markdown executivo com todas as seções', () => {
  const m = collectMetrics(db, userId);
  const analysis = analyzeAll(m);
  const md = buildReport(m, analysis, { companyName: 'Empresa de Teste' });
  assert.match(md, /# 🤖 Diagnóstico Empresarial/);
  assert.match(md, /Empresa de Teste/);
  assert.match(md, /Sumário executivo/);
  assert.match(md, /Painel das 6 áreas/);
  assert.match(md, /Indicadores consolidados/);
  assert.match(md, /Evolução mensal/);
  assert.match(md, /Análise por área/);
  assert.match(md, /Plano de ação priorizado/);
  assert.match(md, /Anexos operacionais/);
  assert.match(md, /Metodologia/);
  DOMAINS.forEach((d) => assert.ok(md.includes(d.name), `relatório sem a área ${d.name}`));
});

// ============================================================
// Ritmo do mês em andamento (mês parcial)
// Cenário determinístico: usuário próprio com datas fixas,
// analisado em três momentos diferentes do mês de março/2026.
// ============================================================
const { describe } = require('node:test');

describe('ritmo do mês em andamento', () => {
  let paceUserId = null;
  // 15/03/2026 (mês pela metade), 03/03/2026 (início) e 31/03/2026 (mês fechado)
  const NOW_MID = new Date(2026, 2, 15, 12, 0, 0);
  const NOW_START = new Date(2026, 2, 3, 12, 0, 0);
  const NOW_END = new Date(2026, 2, 31, 12, 0, 0);

  test.before(() => {
    db.run(
      `INSERT INTO users (email, password, name, role, company_name, plan) VALUES ('ritmo@teste.com', 'x', 'Empresa Ritmo', 'admin', 'Empresa Ritmo', 'basic')`
    );
    paceUserId = db.exec(`SELECT id FROM users WHERE email = 'ritmo@teste.com'`)[0].values[0][0];

    db.run(
      `INSERT INTO customers (user_id, name, email, city, state) VALUES (?, 'Cliente Ritmo', 'ritmo@x.com', 'SP', 'SP')`,
      [paceUserId]
    );
    const customerId = db.exec(`SELECT id FROM customers WHERE email = 'ritmo@x.com'`)[0].values[0][0];

    // custo 50 / preço 100 → margem bruta de 50%
    db.run(
      `INSERT INTO products (user_id, name, sku, category, cost_price, sell_price, stock_quantity, min_stock, unit) VALUES (?, 'Produto Ritmo', 'RT-1', 'Geral', 50, 100, 500, 20, 'UN')`,
      [paceUserId]
    );
    const productId = db.exec(`SELECT id FROM products WHERE sku = 'RT-1'`)[0].values[0][0];

    const mkSale = (dateStr, qty) => {
      db.run(
        `INSERT INTO sales (user_id, customer_id, sale_number, sale_date, total_amount, discount, payment_method, status) VALUES (?, ?, ?, ?, ?, 0, 'PIX', 'completed')`,
        [paceUserId, customerId, `RT-${dateStr}`, dateStr, qty * 100]
      );
      const saleId = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
      db.run(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, 'Produto Ritmo', ?, 100, ?)`,
        [saleId, productId, qty, qty * 100]
      );
    };

    // 3 meses fechados iguais: receita 20.000, CMV 10.000
    ['2025-12', '2026-01', '2026-02'].forEach((key) => {
      mkSale(`${key}-10`, 200);
      // despesa fixa 4.000 + variável 1.000
      db.run(`INSERT INTO expenses (user_id, description, category, amount, expense_date) VALUES (?, 'Aluguel', 'Aluguel', 4000, ?)`, [paceUserId, `${key}-05`]);
      db.run(`INSERT INTO expenses (user_id, description, category, amount, expense_date) VALUES (?, 'Comissões', 'Comissões', 1000, ?)`, [paceUserId, `${key}-20`]);
    });

    // mês corrente (março): 15.000 vendidos até o dia 5 → ritmo acima de fevereiro,
    // mas a comparação crua (15.000 x 20.000) indicaria queda de 25%
    mkSale('2026-03-05', 150);
    db.run(`INSERT INTO expenses (user_id, description, category, amount, expense_date) VALUES (?, 'Aluguel', 'Aluguel', 4000, ?)`, [paceUserId, '2026-03-05']);

    saveDatabase();
  });

  test('métricas: mês pela metade projeta pelo ritmo dos dias vividos', () => {
    const m = collectMetrics(db, paceUserId, { now: NOW_MID });
    assert.strictEqual(m.pace.isPartial, true, 'março/15 deve ser mês parcial');
    assert.strictEqual(m.pace.reliable, true, 'com 15 dias a projeção é confiável');
    assert.strictEqual(m.pace.daysElapsed, 15);
    assert.strictEqual(m.pace.daysInMonth, 31);
    assert.strictEqual(m.revenue.current, 15000, 'receita lançada até agora');
    // 15.000 x (31/15) = 31.000
    assert.ok(Math.abs(m.pace.revenue - 31000) < 1, `ritmo projetado esperado ~31.000, veio ${m.pace.revenue}`);
    assert.ok(m.pace.growth > 0, 'o ritmo projetado cresce sobre fevereiro');
    assert.ok(m.revenue.growth < 0, 'a comparação crua indicaria queda');
    assert.strictEqual(m.series[m.series.length - 1].partial, true, 'a série marca o mês parcial');
  });

  test('métricas: no início do mês projeta pela média dos meses fechados', () => {
    const m = collectMetrics(db, paceUserId, { now: NOW_START });
    assert.strictEqual(m.pace.isPartial, true);
    assert.strictEqual(m.pace.reliable, false, '3 dias é amostra pequena para extrapolar');
    // média dos 3 meses fechados = 20.000 (e não 15.000 x 10,3)
    assert.ok(Math.abs(m.pace.revenue - 20000) < 1, `esperado ~20.000, veio ${m.pace.revenue}`);
    assert.ok(m.pace.basis.includes('média'), 'informa a base usada na projeção');
  });

  test('métricas: mês fechado não projeta nada', () => {
    const m = collectMetrics(db, paceUserId, { now: NOW_END });
    assert.strictEqual(m.pace.isPartial, false);
    assert.strictEqual(m.pace.revenue, m.revenue.current);
    assert.strictEqual(m.pace.revenue, 15000);
    assert.strictEqual(m.pace.basis, 'mês fechado');
  });

  test('métricas: ponto de equilíbrio usa margem de contribuição real (CMV + despesas variáveis)', () => {
    const m = collectMetrics(db, paceUserId, { now: NOW_MID });
    const prof = m.profitability;
    // CMV 50% + variáveis 5% → margem de contribuição de 45%
    assert.strictEqual(prof.cogsRatePct, 50);
    assert.strictEqual(prof.variableExpenseRatePct, 5);
    assert.strictEqual(prof.contributionMarginPct, 45);
    // despesas fixas 4.000 / 45% = 8.888,89
    assert.ok(Math.abs(prof.breakEvenRevenue - 8888.89) < 1, `break-even esperado ~8.888,89, veio ${prof.breakEvenRevenue}`);
    assert.ok(prof.breakEvenGap > 0, 'o ritmo projetado cobre o ponto de equilíbrio');
  });

  test('métricas: sazonalidade ignora o mês em andamento', () => {
    const partial = collectMetrics(db, paceUserId, { now: NOW_MID });
    const closed = collectMetrics(db, paceUserId, { now: NOW_END });
    // meses fechados são idênticos → variação zero; com o mês parcial entraria um vale
    assert.strictEqual(partial.marketing.seasonalityCv, 0);
    assert.ok(closed.marketing.seasonalityCv > 0, 'no mês fechado a diferença aparece');
  });

  test('análise: mês parcial não gera alerta falso de queda de receita', () => {
    const metrics = collectMetrics(db, paceUserId, { now: NOW_MID });
    const analysis = analyzeAll(metrics);
    const empresarial = analysis.domains.find((d) => d.id === 'empresarial');
    const titles = empresarial.alerts.map((a) => a.title);
    assert.ok(!titles.some((t) => /queda/i.test(t)), `não deveria alertar queda: ${titles.join(' | ')}`);
    assert.ok(!titles.some((t) => /prejuízo/i.test(t)), 'não deveria alertar prejuízo com resultado projetado positivo');
    assert.ok(
      empresarial.insights.some((i) => /mês em andamento|projeção/i.test(i)),
      'a leitura deve deixar claro que o mês está em andamento'
    );
    assert.ok(analysis.company.summary.includes('projeção'), 'o sumário cita a projeção do mês');
  });

  test('análise: mês fechado abaixo do mês anterior alerta queda de receita', () => {
    const metrics = collectMetrics(db, paceUserId, { now: NOW_END });
    const analysis = analyzeAll(metrics);
    const empresarial = analysis.domains.find((d) => d.id === 'empresarial');
    assert.ok(
      empresarial.alerts.some((a) => /queda/i.test(a.title)),
      'com o mês fechado em 15.000 x 20.000 o alerta de queda é devido'
    );
  });

  test('análise: ponto de equilíbrio e prejuízo nunca se contradizem', () => {
    const metrics = collectMetrics(db, paceUserId, { now: NOW_MID });

    // cenário saudável (dados reais): acima do ponto de equilíbrio e sem prejuízo
    const ok = analyzeAll(metrics);
    const okEmp = ok.domains.find((d) => d.id === 'empresarial');
    assert.ok(okEmp.insights.some((i) => /acima do ponto de equilíbrio/i.test(i)), 'deve dizer que está acima do ponto de equilíbrio');
    assert.ok(!okEmp.alerts.some((a) => a.title === 'Operação no prejuízo'), 'sem alerta de prejuízo');

    // cenário ruim (mesma base, ritmo abaixo do ponto de equilíbrio)
    const badRevenue = Math.round(metrics.profitability.breakEvenRevenue * 0.6);
    const worst = {
      ...metrics,
      pace: { ...metrics.pace, revenue: badRevenue, result: -3000, cogs: Math.round(badRevenue * 0.5), expenses: 5000 },
      profitability: { ...metrics.profitability, breakEvenGap: badRevenue - metrics.profitability.breakEvenRevenue }
    };
    const bad = analyzeAll(worst);
    const badEmp = bad.domains.find((d) => d.id === 'empresarial');
    assert.ok(badEmp.alerts.some((a) => a.title === 'Abaixo do ponto de equilíbrio'), 'deve alertar ponto de equilíbrio');
    assert.ok(badEmp.alerts.some((a) => a.title === 'Operação no prejuízo'), 'deve alertar prejuízo');
    assert.ok(!badEmp.insights.some((i) => /acima do ponto de equilíbrio/i.test(i)), 'não pode dizer que está acima');
  });

  test('compose: projeção separa fechamento do mês corrente do mês seguinte', () => {
    const metrics = collectMetrics(db, paceUserId, { now: NOW_MID });
    const analysis = analyzeAll(metrics);
    const answer = compose(parse('previsão do próximo mês'), metrics, analysis);
    assert.ok(/Fechamento do mês corrente/.test(answer.text), 'traz o fechamento do mês em andamento');
    assert.ok(/Projeção para o próximo mês/.test(answer.text), 'traz a projeção do mês seguinte');
    const forecast = answer.blocks.find((b) => b.type === 'forecast');
    assert.ok(forecast, 'devolve o bloco de projeção');
    // mesma decomposição de custos do ponto de equilíbrio → nunca se contradizem
    const esperado = forecast.projectedRevenue - forecast.projectedCogs - forecast.projectedExpenses;
    assert.ok(Math.abs(esperado - forecast.projectedResult) < 1, 'resultado projetado fecha com as parcelas');
    const acima = forecast.projectedRevenue >= metrics.profitability.breakEvenRevenue;
    assert.strictEqual(forecast.projectedResult >= 0, acima, 'projeção e ponto de equilíbrio coerentes');
  });
});

// ============================================================
// Qualidade do texto gerado (regressões encontradas em QA)
// ============================================================
describe('qualidade das respostas', () => {
  let metrics = null;
  let analysis = null;

  test.before(() => {
    metrics = collectMetrics(db, userId);
    analysis = analyzeAll(metrics);
  });

  test('nenhum texto gerado contém NaN, undefined ou [object]', () => {
    const textos = [];
    const coletar = (obj) => {
      if (obj === null || obj === undefined) return;
      if (typeof obj === 'string') { textos.push(obj); return; }
      if (Array.isArray(obj)) { obj.forEach(coletar); return; }
      if (typeof obj === 'object') Object.values(obj).forEach(coletar);
    };
    coletar(analysis);
    DOMAINS.forEach((d) => coletar(compose(parse(`como está a área de ${d.name}?`), metrics, analysis)));
    coletar(buildReport(metrics, analysis, 'Empresa Teste'));
    const sujos = textos.filter((t) => /NaN|undefined|\[object|Infinity/.test(t));
    assert.deepStrictEqual(sujos, [], `textos com valor inválido: ${sujos.slice(0, 3).join(' || ')}`);
  });

  test('contagens concordam em gênero e número (sem "1 clientes")', () => {
    const textos = [];
    const coletar = (obj) => {
      if (typeof obj === 'string') return textos.push(obj);
      if (Array.isArray(obj)) return obj.forEach(coletar);
      if (obj && typeof obj === 'object') Object.values(obj).forEach(coletar);
    };
    coletar(analysis);
    coletar(buildReport(metrics, analysis, 'Empresa Teste'));
    DOMAINS.forEach((d) => coletar(compose(parse(`plano de ação para ${d.name}`), metrics, analysis)));
    const errados = textos.filter((t) => /\b1 [a-záéíóúãõç]{3,}s\b/.test(t));
    assert.deepStrictEqual(errados, [], `plural errado após 1: ${errados.slice(0, 3).join(' || ')}`);
    assert.ok(!textos.some((t) => /mês\(es\)|\(s\)\b/.test(t)), 'não deve sobrar o padrão "palavra(s)"');
  });

  test('alerta de clientes inativos tem título com contagem válida', () => {
    const comercial = analysis.domains.find((d) => d.id === 'comercial');
    const inativos = comercial.alerts.filter((a) => /inativos? há mais de 90 dias/i.test(a.title));
    inativos.forEach((a) => {
      assert.match(a.title, /^\d+ (cliente inativo|clientes inativos) há mais de 90 dias$/);
    });
  });

  test('compose: "a empresa dá lucro?" responde sim/não com DRE e ponto de equilíbrio', () => {
    const r = compose(parse('a empresa dá lucro?'), metrics, analysis);
    assert.match(r.text, /^## (✅ Sim|⚠️ Não) — a operação/);
    assert.ok(/Resultado/.test(r.text) && /Margem bruta/.test(r.text), 'traz resultado e margem');
    const tabela = r.blocks.find((b) => b.type === 'table' && /DRE/.test(b.title));
    assert.ok(tabela, 'devolve a tabela de DRE gerencial');
    assert.ok(tabela.rows.some((row) => /CMV/.test(row[0])), 'DRE inclui o CMV');
    const kpis = r.blocks.find((b) => b.type === 'kpis');
    assert.ok(kpis && kpis.items.length >= 3, 'devolve KPIs de rentabilidade');
  });

  test('compose: respeita a polaridade de "estamos no prejuízo?"', () => {
    const lucro = compose(parse('a empresa dá lucro?'), metrics, analysis);
    const prejuizo = compose(parse('estamos no prejuízo?'), metrics, analysis);
    const positivo = metrics.pace.isPartial ? metrics.pace.result : metrics.profitability.operatingResult;
    if (positivo > 0) {
      assert.match(lucro.text, /✅ Sim/, 'pergunta afirmativa → "Sim"');
      assert.match(prejuizo.text, /✅ Não/, 'pergunta negativa → "Não"');
    } else {
      assert.match(lucro.text, /⚠️ Não/, 'pergunta afirmativa → "Não"');
      assert.match(prejuizo.text, /⚠️ Sim/, 'pergunta negativa → "Sim"');
    }
    // o conteúdo é o mesmo: só o enquadramento da resposta muda
    assert.strictEqual(lucro.blocks.length, prejuizo.blocks.length);
  });

  test('compose: pergunta neutra recebe título declarativo, não sim/não', () => {
    const r = compose(parse('qual é o resultado do mês?'), metrics, analysis);
    assert.match(r.text, /^## 📊 Resultado/);
  });

  test('compose: plano filtrado por área não traz horizonte vazio', () => {
    DOMAINS.forEach((d) => {
      const r = compose(parse('o que devo fazer?', { domain: d.id }), metrics, analysis);
      const recs = analysis.recommendations.filter((x) => x.domain === d.id);
      [1, 2, 3].forEach((prio) => {
        const tem = recs.some((x) => x.priority === prio);
        const titulo = prio === 1 ? 'Agora — próximos 7 dias' : prio === 2 ? 'Próximos 30 dias' : 'Próximos 90 dias';
        if (!tem) {
          const idx = r.text.indexOf(titulo);
          if (idx >= 0) {
            const depois = r.text.slice(idx + titulo.length).trim();
            assert.ok(depois.length > 0, `seção "${titulo}" vazia em ${d.id}`);
          }
        }
      });
    });
  });

  test('relatório: mês em andamento mostra lançado e projeção', () => {
    const md = buildReport(metrics, analysis, 'Empresa Teste');
    if (metrics.pace.isPartial) {
      assert.ok(/Mês em andamento/.test(md), 'sinaliza o mês em andamento');
      assert.ok(/projeção R\$/.test(md), 'mostra a projeção ao lado do valor lançado');
      assert.ok(!/Sem movimentação registrada nos 0 /.test(md), 'não menciona zero meses vazios');
    } else {
      assert.ok(/Receita do mês \|/.test(md) || /Receita do mês/.test(md), 'mostra a receita do mês fechado');
    }
  });
});
