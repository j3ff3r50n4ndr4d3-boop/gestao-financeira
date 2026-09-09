const { getDb, saveDatabase, initDatabase } = require('./database');

async function seed() {
  await initDatabase();
  const db = getDb();
  
  console.log('🌱 Seeding database with demo data...');
  
  // Get admin user ID
  const userResult = db.exec("SELECT id FROM users WHERE email = 'admin@erp.com'");
  const userId = userResult[0].values[0][0];
  
  // Add customers
  const customers = [
    ['Maria Silva', 'maria@email.com', '(11) 98765-4321', '123.456.789-00', 'Rua das Flores, 123', 'São Paulo', 'SP', '01234-567'],
    ['João Santos', 'joao@email.com', '(21) 97654-3210', '987.654.321-00', 'Av. Brasil, 456', 'Rio de Janeiro', 'RJ', '20000-000'],
    ['Ana Oliveira', 'ana@empresa.com', '(31) 96543-2109', '12.345.678/0001-90', 'Rua Minas, 789', 'Belo Horizonte', 'MG', '30000-000'],
    ['Carlos Ferreira', 'carlos@email.com', '(41) 95432-1098', '456.789.123-00', 'Rua Paraná, 321', 'Curitiba', 'PR', '80000-000'],
    ['Fernanda Costa', 'fernanda@loja.com', '(51) 94321-0987', '78.912.345/0001-60', 'Av. Farroupilha, 654', 'Porto Alegre', 'RS', '90000-000'],
    ['Pedro Almeida', 'pedro@email.com', '(61) 93210-9876', '321.654.987-00', 'SQS 308 Bloco A', 'Brasília', 'DF', '70000-000'],
    ['Lucia Rodrigues', 'lucia@comercio.com', '(71) 92109-8765', '45.678.912/0001-30', 'Rua Chile, 100', 'Salvador', 'BA', '40000-000'],
    ['Roberto Lima', 'roberto@email.com', '(81) 91098-7654', '654.321.987-00', 'Av. Boa Viagem, 200', 'Recife', 'PE', '51000-000']
  ];
  
  customers.forEach(c => {
    db.run(`INSERT INTO customers (user_id, name, email, phone, document, address, city, state, zip_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, ...c]);
  });
  
  // Add suppliers
  const suppliers = [
    ['Distribuidora Central LTDA', 'vendas@distcentral.com', '(11) 3456-7890', '12.345.678/0001-01', 'São Paulo', 'SP', 'Ricardo'],
    ['Fornecedor Nacional SA', 'comercial@fornac.com', '(21) 3456-1234', '98.765.432/0001-02', 'Rio de Janeiro', 'RJ', 'Ana'],
    ['Importadora Brasil', 'contato@impbrasil.com', '(11) 2345-6789', '45.678.912/0001-03', 'São Paulo', 'SP', 'Marcos']
  ];
  
  suppliers.forEach(s => {
    db.run(`INSERT INTO suppliers (user_id, name, email, phone, document, city, state, contact_person) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, ...s]);
  });
  
  // Add products
  const products = [
    ['Notebook Dell Inspiron', 'NB-DELL-001', 'Eletrônicos', 2800, 3999.90, 15, 3, 'UN'],
    ['Mouse Logitech MX', 'MS-LOG-001', 'Periféricos', 45, 89.90, 50, 10, 'UN'],
    ['Teclado Mecânico RGB', 'TC-MEC-001', 'Periféricos', 85, 199.90, 30, 5, 'UN'],
    ['Monitor 27" 4K', 'MN-27-4K1', 'Eletrônicos', 1200, 2199.90, 8, 2, 'UN'],
    ['Headset Gamer', 'HS-GMR-001', 'Periféricos', 35, 79.90, 25, 5, 'UN'],
    ['Webcam Full HD', 'WC-FHD-001', 'Periféricos', 25, 59.90, 20, 5, 'UN'],
    ['SSD 1TB NVMe', 'SSD-1TB-01', 'Componentes', 250, 449.90, 12, 3, 'UN'],
    ['Cadeira Ergonômica', 'CD-ERG-001', 'Móveis', 450, 899.90, 5, 2, 'UN'],
    ['Mesa Escritório', 'MS-ESCR-01', 'Móveis', 300, 649.90, 4, 1, 'UN'],
    ['Impressora Laser', 'IMP-LSR-01', 'Eletrônicos', 800, 1499.90, 6, 2, 'UN']
  ];
  
  products.forEach(p => {
    db.run(`INSERT INTO products (user_id, name, sku, category, cost_price, sell_price, stock_quantity, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, ...p]);
  });
  
  // Add sales for last 6 months
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth(), year: d.getFullYear(), label: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` });
  }
  
  const saleValues = [12000, 15000, 18000, 22000, 19500, 25000];
  
  months.forEach((m, mi) => {
    const numSales = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < numSales; i++) {
      const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
      const saleDate = `${m.label}-${day}`;
      const customerId = 1 + Math.floor(Math.random() * 8);
      const amount = (saleValues[mi] / numSales) * (0.7 + Math.random() * 0.6);
      const methods = ['PIX', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro', 'Boleto'];
      const method = methods[Math.floor(Math.random() * methods.length)];
      
      db.run(`INSERT INTO sales (user_id, customer_id, sale_number, sale_date, total_amount, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
        [userId, customerId, `VND-${Date.now()}${mi}${i}`, saleDate, Math.round(amount * 100) / 100, method]);
    }
  });
  
  // Add expenses
  const expenseCategories = [
    ['Aluguel', 3500], ['Energia', 450], ['Internet', 199], ['Salários', 8000],
    ['Marketing', 1200], ['Material de Escritório', 350], ['Transporte', 600],
    ['Manutenção', 280], ['Impostos', 2500], ['Telefone', 150]
  ];
  
  months.forEach((m) => {
    expenseCategories.forEach(([cat, baseVal]) => {
      const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
      const amount = baseVal * (0.8 + Math.random() * 0.4);
      db.run(`INSERT INTO expenses (user_id, description, category, amount, expense_date) VALUES (?, ?, ?, ?, ?)`,
        [userId, `Despesa de ${cat}`, cat, Math.round(amount * 100) / 100, `${m.label}-${day}`]);
      
      // Cash flow
      db.run(`INSERT INTO cash_flow (user_id, type, description, category, amount, flow_date) VALUES (?, 'expense', ?, ?, ?, ?)`,
        [userId, `Despesa de ${cat}`, cat, Math.round(amount * 100) / 100, `${m.label}-${day}`]);
    });
  });
  
  // Add cash flow entries for sales
  db.run(`INSERT INTO cash_flow (user_id, type, description, category, amount, flow_date) SELECT user_id, 'income', 'Receita de Vendas', 'Vendas', SUM(total_amount), sale_date FROM sales WHERE user_id = ? GROUP BY sale_date`, [userId]);
  
  // Add accounts receivable
  const today = new Date();
  for (let i = 0; i < 8; i++) {
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + (i < 3 ? -i * 5 : i * 7));
    const status = i < 2 ? 'paid' : 'pending';
    db.run(`INSERT INTO accounts_receivable (user_id, customer_id, description, amount, due_date, status, paid_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, 1 + (i % 8), `Fatura #${1000 + i}`, Math.round((500 + Math.random() * 2000) * 100) / 100, dueDate.toISOString().split('T')[0], status, status === 'paid' ? today.toISOString().split('T')[0] : null]);
  }
  
  // Add accounts payable
  for (let i = 0; i < 6; i++) {
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + (i < 2 ? -i * 3 : i * 5));
    const status = i < 1 ? 'paid' : 'pending';
    db.run(`INSERT INTO accounts_payable (user_id, supplier_id, description, amount, due_date, status, paid_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, 1 + (i % 3), `NF Fornecedor #${2000 + i}`, Math.round((800 + Math.random() * 3000) * 100) / 100, dueDate.toISOString().split('T')[0], status, status === 'paid' ? today.toISOString().split('T')[0] : null]);
  }
  
  // Add subscription
  db.run(`INSERT INTO subscriptions (user_id, plan_name, plan_price, status, payment_method, auto_renew) VALUES (?, 'Professional', 149.90, 'active', 'PIX', 1)`, [userId]);
  
  saveDatabase();
  console.log('✅ Database seeded with demo data!');
  console.log(`   - ${customers.length} clientes`);
  console.log(`   - ${suppliers.length} fornecedores`);
  console.log(`   - ${products.length} produtos`);
  console.log(`   - Vendas nos últimos 6 meses`);
  console.log(`   - Despesas mensais`);
  console.log(`   - Contas a receber e pagar`);
}

seed().catch(console.error);
