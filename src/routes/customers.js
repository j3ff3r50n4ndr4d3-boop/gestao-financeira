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

// List all customers
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec("SELECT * FROM customers WHERE user_id = ? ORDER BY name", [req.user.id]);
    res.json(resultToObjects(result));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
});

// Get single customer
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec("SELECT * FROM customers WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    const customers = resultToObjects(result);
    if (customers.length === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(customers[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});

// Create customer
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, email, phone, document, address, city, state, zip_code, notes } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    db.run(`
      INSERT INTO customers (user_id, name, email, phone, document, address, city, state, zip_code, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.user.id, name, email || '', phone || '', document || '', address || '', city || '', state || '', zip_code || '', notes || '']);
    
    saveDatabase();
    
    const result = db.exec("SELECT last_insert_rowid()");
    const id = result[0].values[0][0];
    
    const customer = db.exec("SELECT * FROM customers WHERE id = ?", [id]);
    res.status(201).json(resultToObjects(customer)[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar cliente' });
  }
});

// Update customer
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, email, phone, document, address, city, state, zip_code, notes } = req.body;
    
    db.run(`
      UPDATE customers SET name=?, email=?, phone=?, document=?, address=?, city=?, state=?, zip_code=?, notes=?
      WHERE id=? AND user_id=?
    `, [name, email || '', phone || '', document || '', address || '', city || '', state || '', zip_code || '', notes || '', req.params.id, req.user.id]);
    
    saveDatabase();
    
    const result = db.exec("SELECT * FROM customers WHERE id = ?", [req.params.id]);
    res.json(resultToObjects(result)[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

// Delete customer
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.run("DELETE FROM customers WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Cliente excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir cliente' });
  }
});

module.exports = router;
