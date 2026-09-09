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
    const result = db.exec(`
      SELECT p.*, s.name as supplier_name 
      FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id 
      WHERE p.user_id = ? ORDER BY p.created_at DESC
    `, [req.user.id]);
    const purchases = resultToObjects(result);
    purchases.forEach(p => {
      const items = db.exec("SELECT * FROM purchase_items WHERE purchase_id = ?", [p.id]);
      p.items = resultToObjects(items);
    });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar compras' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { supplier_id, items, payment_method, notes, purchase_date } = req.body;
    const purchaseNumber = 'PUR-' + Date.now();
    const totalAmount = items ? items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) : 0;

    db.run(`INSERT INTO purchases (user_id, supplier_id, purchase_number, purchase_date, total_amount, payment_method, status, notes) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
      [req.user.id, supplier_id || null, purchaseNumber, purchase_date || new Date().toISOString().split('T')[0], totalAmount, payment_method || '', notes || '']);
    saveDatabase();

    const result = db.exec("SELECT last_insert_rowid()");
    const purchaseId = result[0].values[0][0];

    if (items && items.length > 0) {
      items.forEach(item => {
        db.run(`INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)`,
          [purchaseId, item.product_id || null, item.product_name || '', item.quantity || 1, item.unit_price || 0, (item.quantity || 1) * (item.unit_price || 0)]);
        if (item.product_id) {
          db.run("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND user_id = ?", [item.quantity || 1, item.product_id, req.user.id]);
        }
      });
    }

    // Add to cash flow
    db.run(`INSERT INTO cash_flow (user_id, type, description, category, amount, flow_date) VALUES (?, 'expense', 'Compra ${purchaseNumber}', 'Compras', ?, ?)`,
      [req.user.id, totalAmount, purchase_date || new Date().toISOString().split('T')[0]]);

    saveDatabase();
    const purchase = db.exec("SELECT * FROM purchases WHERE id = ?", [purchaseId]);
    const purchaseData = resultToObjects(purchase)[0];
    const purchaseItems = db.exec("SELECT * FROM purchase_items WHERE purchase_id = ?", [purchaseId]);
    purchaseData.items = resultToObjects(purchaseItems);
    res.status(201).json(purchaseData);
  } catch (error) {
    console.error('Create purchase error:', error);
    res.status(500).json({ error: 'Erro ao criar compra' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.run("DELETE FROM purchase_items WHERE purchase_id = ?", [req.params.id]);
    db.run("DELETE FROM purchases WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Compra excluída' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir compra' });
  }
});

module.exports = router;
