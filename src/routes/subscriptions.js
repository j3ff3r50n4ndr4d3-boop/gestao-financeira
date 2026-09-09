const express = require('express');
const { getDb, saveDatabase } = require('../../database');
const router = express.Router();

function resultToObjects(result) {
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

// Get subscription plans
router.get('/plans', (req, res) => {
  res.json([
    {
      id: 'starter',
      name: 'Starter',
      price: 49.90,
      description: 'Ideal para pequenos negócios iniciando',
      features: [
        'Até 1 usuário',
        'Dashboard básico',
        'Cadastro de clientes',
        'Controle de vendas',
        'Relatórios simples',
        'Suporte por email'
      ],
      limits: {
        users: 1,
        products: 100,
        customers: 50,
        storage: '500MB'
      }
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 149.90,
      description: 'Para empresas em crescimento',
      popular: true,
      features: [
        'Até 5 usuários',
        'Dashboard completo com KPIs',
        'Controle de estoque avançado',
        'Contas a pagar e receber',
        'Fluxo de caixa',
        'Relatórios financeiros (DRE)',
        'Gestão de fornecedores',
        'Suporte prioritário'
      ],
      limits: {
        users: 5,
        products: 1000,
        customers: 500,
        storage: '5GB'
      }
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 349.90,
      description: 'Solução completa para grandes empresas',
      features: [
        'Usuários ilimitados',
        'Todos os módulos',
        'Multi-empresas',
        'API de integração',
        'Personalização completa',
        'Backup automático diário',
        'Suporte 24/7 dedicado',
        'Treinamento da equipe',
        'Consultoria financeira inclusa'
      ],
      limits: {
        users: -1,
        products: -1,
        customers: -1,
        storage: '50GB'
      }
    }
  ]);
});

// Get all subscriptions (admin only)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const result = db.exec(`
      SELECT s.*, u.name as user_name, u.email as user_email, u.company_name
      FROM subscriptions s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `);
    res.json(resultToObjects(result));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar assinaturas' });
  }
});

// Get user subscription
router.get('/my', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", [req.user.id]);
    const subs = resultToObjects(result);
    res.json(subs.length > 0 ? subs[0] : null);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
});

// Create subscription
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { user_id, plan_name, plan_price, end_date, payment_method, auto_renew } = req.body;
    
    db.run(`INSERT INTO subscriptions (user_id, plan_name, plan_price, end_date, payment_method, auto_renew) VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id || req.user.id, plan_name, plan_price, end_date || null, payment_method || '', auto_renew ? 1 : 0]);
    
    // Update user plan
    if (user_id) {
      db.run("UPDATE users SET plan = ? WHERE id = ?", [plan_name, user_id]);
    } else {
      db.run("UPDATE users SET plan = ? WHERE id = ?", [plan_name, req.user.id]);
    }
    
    saveDatabase();
    const result = db.exec("SELECT last_insert_rowid()");
    const id = result[0].values[0][0];
    const sub = db.exec("SELECT * FROM subscriptions WHERE id = ?", [id]);
    res.status(201).json(resultToObjects(sub)[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar assinatura' });
  }
});

// Update subscription status
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;
    db.run("UPDATE subscriptions SET status = ? WHERE id = ?", [status, req.params.id]);
    saveDatabase();
    res.json({ message: 'Assinatura atualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar assinatura' });
  }
});

// Subscription stats (for admin dashboard)
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const totalSubs = db.exec("SELECT COUNT(*) FROM subscriptions");
    const activeSubs = db.exec("SELECT COUNT(*) FROM subscriptions WHERE status = 'active'");
    const mrr = db.exec("SELECT COALESCE(SUM(plan_price), 0) FROM subscriptions WHERE status = 'active'");
    const planDistribution = db.exec("SELECT plan_name, COUNT(*) as count, SUM(plan_price) as revenue FROM subscriptions WHERE status = 'active' GROUP BY plan_name");

    res.json({
      totalSubscriptions: totalSubs[0]?.values[0]?.[0] || 0,
      activeSubscriptions: activeSubs[0]?.values[0]?.[0] || 0,
      mrr: mrr[0]?.values[0]?.[0] || 0,
      planDistribution: resultToObjects(planDistribution)
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

module.exports = router;
