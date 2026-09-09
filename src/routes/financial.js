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

// Accounts Receivable
router.get('/receivable', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(`
      SELECT ar.*, c.name as customer_name 
      FROM accounts_receivable ar 
      LEFT JOIN customers c ON ar.customer_id = c.id 
      WHERE ar.user_id = ? ORDER BY ar.due_date ASC
    `, [req.user.id]);
    res.json(resultToObjects(result));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar contas a receber' });
  }
});

router.post('/receivable', (req, res) => {
  try {
    const db = getDb();
    const { customer_id, description, amount, due_date, notes } = req.body;
    if (!description || !amount) return res.status(400).json({ error: 'Descrição e valor são obrigatórios' });
    
    db.run(`INSERT INTO accounts_receivable (user_id, customer_id, description, amount, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, customer_id || null, description, amount, due_date || null, notes || '']);
    saveDatabase();
    
    const result = db.exec("SELECT last_insert_rowid()");
    const id = result[0].values[0][0];
    const record = db.exec("SELECT * FROM accounts_receivable WHERE id = ?", [id]);
    res.status(201).json(resultToObjects(record)[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar conta a receber' });
  }
});

router.put('/receivable/:id', (req, res) => {
  try {
    const db = getDb();
    const { status, paid_date } = req.body;
    db.run("UPDATE accounts_receivable SET status=?, paid_date=? WHERE id=? AND user_id=?",
      [status, paid_date || null, req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Conta atualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar conta' });
  }
});

router.delete('/receivable/:id', (req, res) => {
  try {
    const db = getDb();
    db.run("DELETE FROM accounts_receivable WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Conta excluída' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir conta' });
  }
});

// Accounts Payable
router.get('/payable', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(`
      SELECT ap.*, s.name as supplier_name 
      FROM accounts_payable ap 
      LEFT JOIN suppliers s ON ap.supplier_id = s.id 
      WHERE ap.user_id = ? ORDER BY ap.due_date ASC
    `, [req.user.id]);
    res.json(resultToObjects(result));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar contas a pagar' });
  }
});

router.post('/payable', (req, res) => {
  try {
    const db = getDb();
    const { supplier_id, description, amount, due_date, notes } = req.body;
    if (!description || !amount) return res.status(400).json({ error: 'Descrição e valor são obrigatórios' });
    
    db.run(`INSERT INTO accounts_payable (user_id, supplier_id, description, amount, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, supplier_id || null, description, amount, due_date || null, notes || '']);
    saveDatabase();
    
    const result = db.exec("SELECT last_insert_rowid()");
    const id = result[0].values[0][0];
    const record = db.exec("SELECT * FROM accounts_payable WHERE id = ?", [id]);
    res.status(201).json(resultToObjects(record)[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar conta a pagar' });
  }
});

router.put('/payable/:id', (req, res) => {
  try {
    const db = getDb();
    const { status, paid_date } = req.body;
    db.run("UPDATE accounts_payable SET status=?, paid_date=? WHERE id=? AND user_id=?",
      [status, paid_date || null, req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Conta atualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar conta' });
  }
});

router.delete('/payable/:id', (req, res) => {
  try {
    const db = getDb();
    db.run("DELETE FROM accounts_payable WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Conta excluída' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir conta' });
  }
});

// Cash Flow
router.get('/cashflow', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec("SELECT * FROM cash_flow WHERE user_id = ? ORDER BY flow_date DESC LIMIT 100", [req.user.id]);
    res.json(resultToObjects(result));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar fluxo de caixa' });
  }
});

// DRE (Demonstrativo de Resultados)
router.get('/dre', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const year = req.query.year || new Date().getFullYear();
    
    const revenueResult = db.exec(`
      SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE user_id = ? AND strftime('%Y', sale_date) = ?
    `, [userId, String(year)]);
    const revenue = revenueResult[0]?.values[0]?.[0] || 0;
    
    const cogsResult = db.exec(`
      SELECT COALESCE(SUM(total_amount), 0) FROM purchases WHERE user_id = ? AND strftime('%Y', purchase_date) = ?
    `, [userId, String(year)]);
    const cogs = cogsResult[0]?.values[0]?.[0] || 0;
    
    const grossProfit = revenue - cogs;
    
    const expenseResult = db.exec(`
      SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND strftime('%Y', expense_date) = ? GROUP BY category
    `, [userId, String(year)]);
    const expenses = resultToObjects(expenseResult);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0);
    
    const netProfit = grossProfit - totalExpenses;
    const margin = revenue > 0 ? (netProfit / revenue * 100).toFixed(1) : 0;

    res.json({
      year,
      revenue,
      cogs,
      grossProfit,
      expenses: expenses.map(e => ({ category: e.category || 'Geral', total: e.total })),
      totalExpenses,
      netProfit,
      margin: parseFloat(margin)
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar DRE' });
  }
});

module.exports = router;
