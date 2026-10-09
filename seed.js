// ============================================================
// SEED - Base de demonstração do ERP
// Gera dados coerentes entre si para que todos os módulos
// (inclusive o Agente IA) tenham o que analisar:
//   clientes, fornecedores, produtos, vendas COM itens,
//   compras COM itens, despesas, fluxo de caixa, contas a
//   receber/pagar e assinatura.
//
// Uso:
//   node seed.js          (não duplica se já houver vendas)
//   node seed.js --force  (insere mesmo com dados existentes)
// ============================================================

const { getDb, saveDatabase, initDatabase } = require('./database');

const round2 = (v) => Math.round(Number(v) * 100) / 100;

// Gerador pseudoaleatório determinístico (mulberry32): a base demo é reproduzível.
// Para variar o cenário: SEED=123 npm run seed
let _prngState = Number(process.env.SEED || 20261009);
function rnd() {
  _prngState = (_prngState + 0x6d2b79f5) | 0;
  let t = Math.imul(_prngState ^ (_prngState >>> 15), 1 | _prngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(rnd() * list.length)];
const rand = (min, max) => min + (max - min) * rnd();
const randInt = (min, max) => Math.floor(rand(min, max + 1));

function lastId(db) {
  const r = db.exec('SELECT last_insert_rowid() AS id');
  return r.length ? r[0].values[0][0] : null;
}

function idsOf(db, table, userId) {
  const r = db.exec(`SELECT id FROM ${table} WHERE user_id = ? ORDER BY id`, [userId]);
  return r.length ? r[0].values.map((v) => v[0]) : [];
}

function isoDay(date) {
  return date.toISOString().split('T')[0];
}

async function seed() {
  const force = process.argv.includes('--force');
  await initDatabase();
  const db = getDb();

  const userResult = db.exec("SELECT id FROM users WHERE email = 'admin@erp.com'");
  const userId = userResult[0].values[0][0];

  const existingSales = db.exec('SELECT COUNT(*) FROM sales WHERE user_id = ?', [userId]);
  const salesCount = existingSales.length ? existingSales[0].values[0][0] : 0;
  if (salesCount > 0 && !force) {
    console.log('ℹ️  A base já possui dados de demonstração. Use "node seed.js --force" para inserir novamente.');
    return;
  }

  console.log('🌱 Seeding database with demo data...');

  // ---------- Clientes ----------
  const customers = [
    ['Maria Silva', 'maria@email.com', '(11) 98765-4321', '123.456.789-00', 'Rua das Flores, 123', 'São Paulo', 'SP', '01234-567'],
    ['João Santos', 'joao@email.com', '(21) 97654-3210', '987.654.321-00', 'Av. Brasil, 456', 'Rio de Janeiro', 'RJ', '20000-000'],
    ['Ana Oliveira', 'ana@empresa.com', '(31) 96543-2109', '12.345.678/0001-90', 'Rua Minas, 789', 'Belo Horizonte', 'MG', '30000-000'],
    ['Carlos Ferreira', 'carlos@email.com', '(41) 95432-1098', '456.789.123-00', 'Rua Paraná, 321', 'Curitiba', 'PR', '80000-000'],
    ['Fernanda Costa', 'fernanda@loja.com', '(51) 94321-0987', '78.912.345/0001-60', 'Av. Farroupilha, 654', 'Porto Alegre', 'RS', '90000-000'],
    ['Pedro Almeida', 'pedro@email.com', '(61) 93210-9876', '321.654.987-00', 'SQS 308 Bloco A', 'Brasília', 'DF', '70000-000'],
    ['Lucia Rodrigues', 'lucia@comercio.com', '(71) 92109-8765', '45.678.912/0001-30', 'Rua Chile, 100', 'Salvador', 'BA', '40000-000'],
    ['Roberto Lima', 'roberto@email.com', '(81) 91098-7654', '654.321-987-00', 'Av. Boa Viagem, 200', 'Recife', 'PE', '51000-000']
  ];

  let customerIds = idsOf(db, 'customers', userId);
  if (!customerIds.length) {
    customers.forEach((c) => {
      db.run(
        `INSERT INTO customers (user_id, name, email, phone, document, address, city, state, zip_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, ...c]
      );
    });
    customerIds = idsOf(db, 'customers', userId);
  }

  // ---------- Fornecedores ----------
  const suppliers = [
    ['Distribuidora Central LTDA', 'vendas@distcentral.com', '(11) 3456-7890', '12.345.678/0001-01', 'São Paulo', 'SP', 'Ricardo'],
    ['Fornecedor Nacional SA', 'comercial@fornac.com', '(21) 3456-1234', '98.765.432/0001-02', 'Rio de Janeiro', 'RJ', 'Ana'],
    ['Importadora Brasil', 'contato@impbrasil.com', '(11) 2345-6789', '45.678.912/0001-03', 'São Paulo', 'SP', 'Marcos']
  ];

  let supplierIds = idsOf(db, 'suppliers', userId);
  if (!supplierIds.length) {
    suppliers.forEach((s) => {
      db.run(
        `INSERT INTO suppliers (user_id, name, email, phone, document, city, state, contact_person) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, ...s]
      );
    });
    supplierIds = idsOf(db, 'suppliers', userId);
  }

  // ---------- Produtos ----------
  // [nome, sku, categoria, custo, preço, estoque inicial, estoque mínimo, unidade]
  const products = [
    ['Notebook Dell Inspiron', 'NB-DELL-001', 'Eletrônicos', 2800, 3999.9, 15, 3, 'UN'],
    ['Mouse Logitech MX', 'MS-LOG-001', 'Periféricos', 45, 89.9, 50, 10, 'UN'],
    ['Teclado Mecânico RGB', 'TC-MEC-001', 'Periféricos', 85, 199.9, 30, 5, 'UN'],
    ['Monitor 27" 4K', 'MN-27-4K1', 'Eletrônicos', 1200, 2199.9, 8, 2, 'UN'],
    ['Headset Gamer', 'HS-GMR-001', 'Periféricos', 35, 79.9, 25, 5, 'UN'],
    ['Webcam Full HD', 'WC-FHD-001', 'Periféricos', 25, 59.9, 20, 5, 'UN'],
    ['SSD 1TB NVMe', 'SSD-1TB-01', 'Componentes', 250, 449.9, 12, 3, 'UN'],
    ['Cadeira Ergonômica', 'CD-ERG-001', 'Móveis', 450, 899.9, 5, 2, 'UN'],
    ['Mesa Escritório', 'MS-ESCR-01', 'Móveis', 300, 649.9, 4, 1, 'UN'],
    ['Impressora Laser', 'IMP-LSR-01', 'Eletrônicos', 800, 1499.9, 6, 2, 'UN']
  ];

  let productList = [];
  const existingProducts = db.exec('SELECT id, name, sku, cost_price, sell_price, stock_quantity, min_stock, unit FROM products WHERE user_id = ? ORDER BY id', [userId]);
  if (existingProducts.length && existingProducts[0].values.length) {
    productList = existingProducts[0].values.map((v) => ({
      id: v[0], name: v[1], sku: v[2], cost: Number(v[3] || 0), price: Number(v[4] || 0),
      stock: Number(v[5] || 0), minStock: Number(v[6] || 0), unit: v[7] || 'UN'
    }));
  } else {
    products.forEach((p) => {
      db.run(
        `INSERT INTO products (user_id, name, sku, category, cost_price, sell_price, stock_quantity, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, ...p]
      );
    });
    productList = idsOf(db, 'products', userId).map((id, i) => ({
      id, name: products[i][0], sku: products[i][1], cost: products[i][3], price: products[i][4],
      stock: products[i][5], minStock: products[i][6], unit: products[i][7]
    }));
  }

  // ---------- Período (últimos 6 meses) ----------
  const months = [];
  const now = new Date();
  const todayDay = now.getDate();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    months.push({
      label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      date: d,
      // o mês corrente só pode ter lançamentos até hoje: a meta é proporcional
      // aos dias vividos, para que o comparativo de "ritmo do mês" faça sentido
      current: i === 0,
      maxDay: i === 0 ? todayDay : daysInMonth,
      daysInMonth,
      pace: i === 0 ? todayDay / daysInMonth : 1
    });
  }

  // ---------- Vendas COM itens ----------
  // Itens de maior giro aparecem com mais frequência (curva ABC realista)
  const weights = productList.map((_, i) => (i < 3 ? 5 : i < 6 ? 3 : i < 8 ? 2 : 1));
  const weightedPool = [];
  productList.forEach((p, i) => {
    for (let w = 0; w < weights[i]; w++) weightedPool.push(p);
  });

  const saleTargets = [16000, 19000, 21000, 24000, 22000, 27000];
  const methods = ['PIX', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro', 'Boleto'];
  const soldByProduct = new Map(productList.map((p) => [p.id, 0]));
  let salesCreated = 0;
  let itemsCreated = 0;

  months.forEach((m, mi) => {
    // vende até atingir o orçamento do mês (proporcional aos dias vividos no mês corrente)
    const monthBudget = saleTargets[mi] * (m.current ? m.pace * rand(1.0, 1.08) : rand(0.95, 1.05));
    const minSales = m.current ? 2 : 4;
    const maxSales = m.current ? 5 : 10;
    let monthTotal = 0;
    let i = 0;
    while ((monthTotal < monthBudget || i < minSales) && i < maxSales) {
      const day = String(Math.min(m.maxDay, Math.max(1, Math.round(((i + 1) / (maxSales + 1)) * m.maxDay) + randInt(-1, 1)))).padStart(2, '0');
      const saleDate = `${m.label}-${day}`;
      const customerId = pick(customerIds);
      const remainingSales = Math.max(1, Math.ceil((monthBudget - monthTotal) / 3000));
      const target = Math.max(700, ((monthBudget - monthTotal) / Math.min(remainingSales, maxSales - i))) * rand(0.85, 1.15);

      // monta os itens da venda
      const itemCount = randInt(1, 3);
      const chosen = new Map();
      for (let k = 0; k < itemCount; k++) {
        const prod = pick(weightedPool);
        const unitPrice = rnd() < 0.35 ? round2(prod.price * rand(0.92, 0.99)) : prod.price;
        const qtyBudget = Math.max(1, Math.floor(target / itemCount / Math.max(1, unitPrice)));
        const qty = prod.price > 1000 ? randInt(1, 2) : prod.price > 200 ? randInt(1, Math.min(3, qtyBudget)) : randInt(1, Math.min(6, qtyBudget));
        const prev = chosen.get(prod.id) || { prod, qty: 0, unitPrice };
        chosen.set(prod.id, { prod, qty: prev.qty + qty, unitPrice });
      }

      const items = [...chosen.values()].map((c) => ({ ...c, total: round2(c.qty * c.unitPrice) }));
      const grossTotal = round2(items.reduce((a, it) => a + it.total, 0));
      const listTotal = round2(items.reduce((a, it) => a + it.qty * it.prod.price, 0));
      const discount = round2(Math.max(0, listTotal - grossTotal));

      // a venda mais recente do mês fica pendente de expedição (fila real para o agente)
      const isLastOfMonth = mi === months.length - 1 && i >= minSales - 1;
      const status = isLastOfMonth && monthTotal + grossTotal >= monthBudget * 0.7 ? 'pending' : 'completed';

      db.run(
        `INSERT INTO sales (user_id, customer_id, sale_number, sale_date, total_amount, discount, payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, customerId, `VND-${m.label.replace('-', '')}-${String(i + 1).padStart(3, '0')}`, saleDate, grossTotal, discount, pick(methods), status]
      );
      const saleId = lastId(db);
      items.forEach((it) => {
        db.run(
          `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)`,
          [saleId, it.prod.id, it.prod.name, it.qty, it.unitPrice, it.total]
        );
        itemsCreated += 1;
        soldByProduct.set(it.prod.id, (soldByProduct.get(it.prod.id) || 0) + it.qty);
      });
      monthTotal += grossTotal;
      salesCreated += 1;
      i += 1;
    }
  });

  // ---------- Compras COM itens (últimos 3 meses) ----------
  // Reposição orientada pela demanda: compra-se ~85% do que foi vendido,
  // distribuído em pedidos aos fornecedores. O custo da compra oscila em
  // relação ao custo cadastrado (gera variação de custo real para análise).
  let purchasesCreated = 0;
  let purchaseItemsCreated = 0;
  const purchasedByProduct = new Map(productList.map((p) => [p.id, 0]));

  const need = productList
    .map((p) => ({ prod: p, qty: Math.round((soldByProduct.get(p.id) || 0) * rand(0.7, 1.0)) }))
    .filter((n) => n.qty > 0)
    .sort((a, b) => b.qty * b.prod.cost - a.qty * a.prod.cost);

  const purchaseMonths = months.slice(-3);
  const ordersPerMonth = 2;
  const orders = [];
  purchaseMonths.forEach((m) => {
    for (let i = 0; i < ordersPerMonth; i++) {
      orders.push({ month: m, index: i, supplierId: pick(supplierIds), items: [] });
    }
  });

  need.forEach((n, idx) => {
    const order = orders[idx % orders.length];
    const drift = rand(-0.04, 0.14);
    const unitPrice = round2(n.prod.cost * (1 + drift));
    // divide em lotes menores quando a necessidade é grande
    const lots = n.qty > 12 ? 2 : 1;
    const base = Math.floor(n.qty / lots);
    for (let l = 0; l < lots; l++) {
      const qty = l === lots - 1 ? n.qty - base * (lots - 1) : base;
      if (qty <= 0) continue;
      const target = orders[(idx + l) % orders.length];
      target.items.push({ prod: n.prod, qty, unitPrice, total: round2(qty * unitPrice) });
    }
  });

  orders.forEach((order) => {
    if (!order.items.length) return;
    const day = String(randInt(2, Math.max(2, Math.min(25, order.month.maxDay)))).padStart(2, '0');
    const purchaseDate = `${order.month.label}-${day}`;
    const total = round2(order.items.reduce((a, it) => a + it.total, 0));
    db.run(
      `INSERT INTO purchases (user_id, supplier_id, purchase_number, purchase_date, total_amount, payment_method, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, order.supplierId, `CMP-${order.month.label.replace('-', '')}-${String(order.index + 1).padStart(3, '0')}`, purchaseDate, total, pick(['Boleto', 'PIX', 'Cartão Crédito']), 'completed']
    );
    const purchaseId = lastId(db);
    order.items.forEach((it) => {
      db.run(
        `INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)`,
        [purchaseId, it.prod.id, it.prod.name, it.qty, it.unitPrice, it.total]
      );
      purchaseItemsCreated += 1;
      purchasedByProduct.set(it.prod.id, (purchasedByProduct.get(it.prod.id) || 0) + it.qty);
    });
    purchasesCreated += 1;
  });

  // ---------- Estoque coerente com o movimento ----------
  // saldo = estoque inicial - vendido + comprado (nunca negativo)
  productList.forEach((p) => {
    const sold = soldByProduct.get(p.id) || 0;
    const bought = purchasedByProduct.get(p.id) || 0;
    const newStock = Math.max(0, p.stock - sold + bought);
    db.run(`UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`, [newStock, p.id, userId]);
    p.stock = newStock;
  });

  // Cenário proposital para o agente encontrar material de análise:
  // 1 item em ruptura, 2 abaixo do mínimo e 1 com excesso.
  if (productList.length >= 6) {
    db.run(`UPDATE products SET stock_quantity = 0 WHERE id = ? AND user_id = ?`, [productList[3].id, userId]);
    db.run(`UPDATE products SET stock_quantity = 1 WHERE id = ? AND user_id = ?`, [productList[4].id, userId]);
    db.run(`UPDATE products SET stock_quantity = 2 WHERE id = ? AND user_id = ?`, [productList[7].id, userId]);
    db.run(`UPDATE products SET stock_quantity = 320 WHERE id = ? AND user_id = ?`, [productList[5].id, userId]);
  }

  // ---------- Despesas + fluxo de caixa ----------
  const expenseCategories = [
    ['Aluguel', 2400], ['Energia', 380], ['Internet', 199], ['Salários', 4300],
    ['Marketing', 800], ['Material de Escritório', 220], ['Transporte', 380],
    ['Manutenção', 200], ['Impostos', 900], ['Telefone', 150]
  ];

  let expensesCreated = 0;
  months.forEach((m) => {
    expenseCategories.forEach(([cat, baseVal], ci) => {
      // no mês corrente só entram as despesas já vencidas até hoje
      // (fixas do início do mês + variáveis proporcionais aos dias vividos)
      if (m.current && ci >= 4 && rnd() > m.pace) return;
      const day = String(randInt(1, m.maxDay)).padStart(2, '0');
      const amount = round2(baseVal * (m.current && ci >= 4 ? m.pace : 1) * rand(0.85, 1.2));
      db.run(`INSERT INTO expenses (user_id, description, category, amount, expense_date) VALUES (?, ?, ?, ?, ?)`, [
        userId, `Despesa de ${cat}`, cat, amount, `${m.label}-${day}`
      ]);
      db.run(`INSERT INTO cash_flow (user_id, type, description, category, amount, flow_date) VALUES (?, 'expense', ?, ?, ?, ?)`, [
        userId, `Despesa de ${cat}`, cat, amount, `${m.label}-${day}`
      ]);
      expensesCreated += 1;
    });
  });

  // Entradas de caixa das vendas + compras como saída
  db.run(
    `INSERT INTO cash_flow (user_id, type, description, category, amount, flow_date)
     SELECT user_id, 'income', 'Receita de Vendas', 'Vendas', SUM(total_amount), sale_date
       FROM sales WHERE user_id = ? GROUP BY sale_date`,
    [userId]
  );
  // 60% das compras saem do caixa no mês; o restante fica a prazo com o fornecedor
  db.run(
    `INSERT INTO cash_flow (user_id, type, description, category, amount, flow_date)
     SELECT user_id, 'expense', 'Compra de Mercadoria (entrada à vista)', 'Compras', ROUND(SUM(total_amount) * 0.6, 2), purchase_date
       FROM purchases WHERE user_id = ? GROUP BY purchase_date`,
    [userId]
  );

  // ---------- Contas a receber (algumas vencidas) ----------
  const today = new Date();
  let arCreated = 0;
  for (let i = 0; i < 10; i++) {
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + (i < 5 ? -(i + 1) * 6 : (i - 4) * 7));
    const status = i < 2 ? 'paid' : 'pending';
    db.run(
      `INSERT INTO accounts_receivable (user_id, customer_id, description, amount, due_date, status, paid_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, pick(customerIds), `Fatura #${1000 + i}`, round2(rand(600, 3200)), isoDay(dueDate), status, status === 'paid' ? isoDay(today) : null]
    );
    arCreated += 1;
  }

  // ---------- Contas a pagar (uma vencida) ----------
  let apCreated = 0;
  for (let i = 0; i < 8; i++) {
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + (i < 3 ? -(i + 1) * 4 : (i - 2) * 6));
    const status = i < 2 ? 'paid' : 'pending';
    db.run(
      `INSERT INTO accounts_payable (user_id, supplier_id, description, amount, due_date, status, paid_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, pick(supplierIds), `NF Fornecedor #${2000 + i}`, round2(rand(900, 4200)), isoDay(dueDate), status, status === 'paid' ? isoDay(today) : null]
    );
    apCreated += 1;
  }

  // ---------- Assinatura ----------
  const hasSub = db.exec('SELECT COUNT(*) FROM subscriptions WHERE user_id = ?', [userId]);
  if (!hasSub.length || hasSub[0].values[0][0] === 0) {
    db.run(
      `INSERT INTO subscriptions (user_id, plan_name, plan_price, status, payment_method, auto_renew) VALUES (?, 'Professional', 149.90, 'active', 'PIX', 1)`,
      [userId]
    );
  }

  saveDatabase();

  console.log('✅ Database seeded with demo data!');
  console.log(`   - ${customerIds.length} clientes`);
  console.log(`   - ${supplierIds.length} fornecedores`);
  console.log(`   - ${productList.length} produtos`);
  console.log(`   - ${salesCreated} vendas com ${itemsCreated} itens`);
  console.log(`   - ${purchasesCreated} compras com ${purchaseItemsCreated} itens`);
  console.log(`   - ${expensesCreated} despesas em ${months.length} meses`);
  console.log(`   - ${arCreated} contas a receber e ${apCreated} contas a pagar`);
  console.log('   - Cenários de ruptura, estoque baixo e excesso incluídos de propósito');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
