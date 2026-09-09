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
    const result = db.exec("SELECT * FROM suppliers WHERE user_id = ? ORDER BY name", [req.user.id]);
    res.json(resultToObjects(result));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar fornecedores' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, email, phone, document, address, city, state, contact_person } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    db.run(`INSERT INTO suppliers (user_id, name, email, phone, document, address, city, state, contact_person) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, email || '', phone || '', document || '', address || '', city || '', state || '', contact_person || '']);
    saveDatabase();
    const result = db.exec("SELECT last_insert_rowid()");
    const id = result[0].values[0][0];
    const supplier = db.exec("SELECT * FROM suppliers WHERE id = ?", [id]);
    res.status(201).json(resultToObjects(supplier)[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar fornecedor' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, email, phone, document, address, city, state, contact_person } = req.body;
    db.run(`UPDATE suppliers SET name=?, email=?, phone=?, document=?, address=?, city=?, state=?, contact_person=? WHERE id=? AND user_id=?`,
      [name, email || '', phone || '', document || '', address || '', city || '', state || '', contact_person || '', req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Fornecedor atualizado' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.run("DELETE FROM suppliers WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    saveDatabase();
    res.json({ message: 'Fornecedor excluído' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir fornecedor' });
  }
});

module.exports = router;
