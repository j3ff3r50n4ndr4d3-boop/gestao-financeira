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

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec("SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC", [req.user.id]);
    res.json(resultToObjects(result));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar despesas' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { description, category, amount, expense_date, payment_method, notes } = req.body;
    if (!description || !amount) return res.status(400).json({ error: 'Descrição e valor são obrigatórios' });

    db.run(`
      INSERT INTO expenses (user_id, description, category, amount, expense_date, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [req.user.id, description, category || '', amount, expense_date || new Date().toISOString().split('T')[0], payment_method || '', notes || '']);
    
    // Add to cash flow
    db.run(`
      INSERT INTO cash_flow (user_id, type, description, category, amount, flow_date)
      VALUES (?, 'expense', ?, ?, ?, ?)
    `, [req.user.id, description, category || '', amount, expense_date || new Date().toISOString().split('T')[0]]);
    
    saveDatabase();
    const result = db.exec("SELECT last_insert_rowid()");
    const id = result[0].values[0][0];
    const expense = db.exec("SELECT * FROM expenses WHERE id = ?", [id]);
    res.status(201).json(resultToObjects(expense)[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar despesa' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { description, category, amount, expense_date, payment_method, notes } = req.body;
    db.run(`UPDATE expenses SET description=?, category=?, amount=?, expense_date=?, payment_method=?, notes=? WHERE id=? AND user_id=?`,
      [description, category || '', amount, expense_date, payment_method || '', notes || '', req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Despesa atualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar despesa' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.run("DELETE FROM expenses WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Despesa excluída' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir despesa' });
  }
});

module.exports = router;
