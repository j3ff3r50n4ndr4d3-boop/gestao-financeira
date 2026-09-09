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
    const result = db.exec("SELECT * FROM products WHERE user_id = ? ORDER BY name", [req.user.id]);
    res.json(resultToObjects(result));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec("SELECT * FROM products WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    const products = resultToObjects(result);
    if (products.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(products[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, sku, description, category, cost_price, sell_price, stock_quantity, min_stock, unit } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    db.run(`
      INSERT INTO products (user_id, name, sku, description, category, cost_price, sell_price, stock_quantity, min_stock, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.user.id, name, sku || '', description || '', category || '', cost_price || 0, sell_price || 0, stock_quantity || 0, min_stock || 0, unit || 'UN']);
    saveDatabase();

    const result = db.exec("SELECT last_insert_rowid()");
    const id = result[0].values[0][0];
    const product = db.exec("SELECT * FROM products WHERE id = ?", [id]);
    res.status(201).json(resultToObjects(product)[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, sku, description, category, cost_price, sell_price, stock_quantity, min_stock, unit } = req.body;
    db.run(`
      UPDATE products SET name=?, sku=?, description=?, category=?, cost_price=?, sell_price=?, stock_quantity=?, min_stock=?, unit=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND user_id=?
    `, [name, sku || '', description || '', category || '', cost_price || 0, sell_price || 0, stock_quantity || 0, min_stock || 0, unit || 'UN', req.params.id, req.user.id]);
    saveDatabase();
    const result = db.exec("SELECT * FROM products WHERE id = ?", [req.params.id]);
    res.json(resultToObjects(result)[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.run("DELETE FROM products WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Produto excluído' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir produto' });
  }
});

module.exports = router;
