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
      SELECT s.*, c.name as customer_name 
      FROM sales s LEFT JOIN customers c ON s.customer_id = c.id 
      WHERE s.user_id = ? ORDER BY s.created_at DESC
    `, [req.user.id]);
    const sales = resultToObjects(result);
    // Get items for each sale
    sales.forEach(sale => {
      const items = db.exec("SELECT * FROM sale_items WHERE sale_id = ?", [sale.id]);
      sale.items = resultToObjects(items);
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar vendas' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec("SELECT s.*, c.name as customer_name FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = ? AND s.user_id = ?", [req.params.id, req.user.id]);
    const sales = resultToObjects(result);
    if (sales.length === 0) return res.status(404).json({ error: 'Venda não encontrada' });
    const sale = sales[0];
    const items = db.exec("SELECT * FROM sale_items WHERE sale_id = ?", [sale.id]);
    sale.items = resultToObjects(items);
    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar venda' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { customer_id, items, discount, payment_method, notes, sale_date } = req.body;
    
    const saleNumber = 'VND-' + Date.now();
    const totalAmount = items ? items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) : 0;
    
    db.run(`
      INSERT INTO sales (user_id, customer_id, sale_number, sale_date, total_amount, discount, payment_method, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)
    `, [req.user.id, customer_id || null, saleNumber, sale_date || new Date().toISOString().split('T')[0], totalAmount, discount || 0, payment_method || '', notes || '']);
    saveDatabase();

    const result = db.exec("SELECT last_insert_rowid()");
    const saleId = result[0].values[0][0];

    if (items && items.length > 0) {
      items.forEach(item => {
        db.run(`
          INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [saleId, item.product_id || null, item.product_name || '', item.quantity || 1, item.unit_price || 0, (item.quantity || 1) * (item.unit_price || 0)]);
        
        // Update stock
        if (item.product_id) {
          db.run("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND user_id = ?", [item.quantity || 1, item.product_id, req.user.id]);
        }
      });
    }
    
    // Add to cash flow
    db.run(`
      INSERT INTO cash_flow (user_id, type, description, category, amount, flow_date)
      VALUES (?, 'income', 'Venda ${saleNumber}', 'Vendas', ?, ?)
    `, [req.user.id, totalAmount - (discount || 0), sale_date || new Date().toISOString().split('T')[0]]);

    saveDatabase();
    const sale = db.exec("SELECT * FROM sales WHERE id = ?", [saleId]);
    const saleData = resultToObjects(sale)[0];
    const saleItems = db.exec("SELECT * FROM sale_items WHERE sale_id = ?", [saleId]);
    saleData.items = resultToObjects(saleItems);
    res.status(201).json(saleData);
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ error: 'Erro ao criar venda' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { status, notes } = req.body;
    db.run("UPDATE sales SET status=?, notes=? WHERE id=? AND user_id=?", [status, notes || '', req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Venda atualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar venda' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.run("DELETE FROM sale_items WHERE sale_id = ?", [req.params.id]);
    db.run("DELETE FROM sales WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Venda excluída' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir venda' });
  }
});

module.exports = router;
