const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, saveDatabase } = require('../../database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const db = getDb();
    const result = db.exec("SELECT * FROM users WHERE email = ?", [email]);
    
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const columns = result[0].columns;
    const userRow = result[0].values[0];
    const user = {};
    columns.forEach((col, index) => {
      user[col] = userRow[index];
    });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Conta desativada' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_name: user.company_name,
        plan: user.plan
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, company_name, plan } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
    }

    const db = getDb();
    
    // Check if user exists
    const existing = db.exec("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(`
      INSERT INTO users (email, password, name, company_name, plan)
      VALUES (?, ?, ?, ?, ?)
    `, [email, hashedPassword, name, company_name || '', plan || 'basic']);
    
    saveDatabase();

    const result = db.exec("SELECT * FROM users WHERE email = ?", [email]);
    const columns = result[0].columns;
    const userRow = result[0].values[0];
    const user = {};
    columns.forEach((col, index) => {
      user[col] = userRow[index];
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_name: user.company_name,
        plan: user.plan
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
});

// Get current user
router.get('/me', (req, res) => {
  const db = getDb();
  const result = db.exec("SELECT id, email, name, role, company_name, plan, created_at FROM users WHERE id = ?", [req.user.id]);
  
  if (result.length === 0 || result[0].values.length === 0) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  const columns = result[0].columns;
  const userRow = result[0].values[0];
  const user = {};
  columns.forEach((col, index) => {
    user[col] = userRow[index];
  });

  res.json(user);
});

module.exports = router;
