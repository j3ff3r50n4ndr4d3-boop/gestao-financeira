// ============================================================
// AGENTE IA ERP - Persistência de conversas
// Histórico por usuário em SQLite (tabelas criadas em database.js)
// ============================================================

const { getDb, saveDatabase } = require('../../database');
const { rows } = require('./metrics');

function ensureTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT,
      domain TEXT,
      message_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      structured TEXT,
      source TEXT DEFAULT 'local',
      domain TEXT,
      intent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id) ON DELETE CASCADE
    )
  `);
}

function createConversation(userId, { title = 'Nova conversa', domain = null } = {}) {
  const db = getDb();
  ensureTables(db);
  db.run(`INSERT INTO agent_conversations (user_id, title, domain) VALUES (?, ?, ?)`, [userId, title, domain]);
  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  saveDatabase();
  return id;
}

function touchConversation(conversationId, userId, patch = {}) {
  const db = getDb();
  ensureTables(db);
  const result = db.exec('SELECT COUNT(*) FROM agent_messages WHERE conversation_id = ?', [conversationId]);
  const count = result.length ? result[0].values[0][0] : 0;
  const sets = ['updated_at = CURRENT_TIMESTAMP', 'message_count = ?'];
  const params = [count];
  if (patch.title !== undefined) {
    sets.push('title = ?');
    params.push(patch.title);
  }
  if (patch.domain !== undefined) {
    sets.push('domain = ?');
    params.push(patch.domain);
  }
  params.push(conversationId, userId);
  db.run(`UPDATE agent_conversations SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
  saveDatabase();
}

function addMessage({ conversationId, userId, role, content, structured = null, source = 'local', domain = null, intent = null }) {
  const db = getDb();
  ensureTables(db);
  db.run(
    `INSERT INTO agent_messages (conversation_id, user_id, role, content, structured, source, domain, intent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [conversationId, userId, role, content, structured ? JSON.stringify(structured) : null, source, domain, intent]
  );
  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  saveDatabase();
  return id;
}

function listConversations(userId, limit = 30) {
  const db = getDb();
  ensureTables(db);
  return rows(
    db,
    `SELECT c.*, (SELECT COUNT(*) FROM agent_messages m WHERE m.conversation_id = c.id) AS message_count
       FROM agent_conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC LIMIT ?`,
    [userId, limit]
  ).map((c) => ({
    id: c.id,
    title: c.title,
    domain: c.domain,
    messageCount: Number(c.message_count || 0),
    createdAt: c.created_at,
    updatedAt: c.updated_at
  }));
}

function getConversation(conversationId, userId) {
  const db = getDb();
  ensureTables(db);
  const conv = rows(db, `SELECT * FROM agent_conversations WHERE id = ? AND user_id = ?`, [conversationId, userId])[0];
  if (!conv) return null;
  const messages = rows(
    db,
    `SELECT * FROM agent_messages WHERE conversation_id = ? AND user_id = ? ORDER BY id ASC`,
    [conversationId, userId]
  ).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    source: m.source,
    domain: m.domain,
    intent: m.intent,
    createdAt: m.created_at,
    structured: m.structured ? safeParse(m.structured) : null
  }));
  return {
    id: conv.id,
    title: conv.title,
    domain: conv.domain,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
    messages
  };
}

function deleteConversation(conversationId, userId) {
  const db = getDb();
  ensureTables(db);
  db.run(`DELETE FROM agent_messages WHERE conversation_id = ? AND user_id = ?`, [conversationId, userId]);
  db.run(`DELETE FROM agent_conversations WHERE id = ? AND user_id = ?`, [conversationId, userId]);
  saveDatabase();
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

module.exports = {
  ensureTables,
  createConversation,
  touchConversation,
  addMessage,
  listConversations,
  getConversation,
  deleteConversation
};
