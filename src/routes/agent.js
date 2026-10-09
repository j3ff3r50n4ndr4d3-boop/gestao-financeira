// ============================================================
// AGENTE IA ERP - Rotas da API (/api/agent)
// Todas protegidas por JWT (authenticateToken no server.js)
// ============================================================

const express = require('express');
const { getDb } = require('../../database');
const agent = require('../agent');

const router = express.Router();

function handleError(res, error, fallback = 'Erro no agente') {
  console.error('[agente]', error);
  const status = error.status || 500;
  res.status(status).json({ error: status === 500 ? fallback : error.message });
}

// Configuração do agente (nunca expõe chaves)
router.get('/config', (req, res) => {
  try {
    res.json(agent.config());
  } catch (error) {
    handleError(res, error);
  }
});

// Sugestões de perguntas
router.get('/quick-prompts', (req, res) => {
  try {
    res.json({ prompts: agent.quickPrompts() });
  } catch (error) {
    handleError(res, error);
  }
});

// Áreas com nota de saúde
router.get('/domains', (req, res) => {
  try {
    res.json(agent.domainsWithScores(getDb(), req.user.id));
  } catch (error) {
    handleError(res, error);
  }
});

// Diagnóstico completo (6 áreas)
router.get('/diagnostic', (req, res) => {
  try {
    res.json(agent.diagnostic(getDb(), req.user.id, req.user));
  } catch (error) {
    handleError(res, error);
  }
});

// Relatório em markdown (completo ou por área)
router.get('/report', (req, res) => {
  try {
    const domain = req.query.domain || null;
    const result = agent.reportMarkdown(getDb(), req.user.id, req.user, { domain });
    if (!result) return res.status(404).json({ error: 'Relatório não encontrado' });
    if (req.query.download === '1') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.content);
    }
    res.json({ filename: result.filename, format: 'markdown', content: result.content });
  } catch (error) {
    handleError(res, error);
  }
});

// Alertas priorizados
router.get('/alerts', (req, res) => {
  try {
    res.json(agent.alerts(getDb(), req.user.id, { domain: req.query.domain || null, severity: req.query.severity || null }));
  } catch (error) {
    handleError(res, error);
  }
});

// Plano de ação 7/30/90
router.get('/plan', (req, res) => {
  try {
    res.json(agent.actionPlan(getDb(), req.user.id));
  } catch (error) {
    handleError(res, error);
  }
});

// Base de conhecimento (conceitos, fórmulas e playbooks)
router.get('/knowledge', (req, res) => {
  try {
    const result = agent.knowledge(null);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

// Conversas anteriores
router.get('/conversations', (req, res) => {
  try {
    res.json({ conversations: agent.conversations.list(req.user.id) });
  } catch (error) {
    handleError(res, error);
  }
});

// Chat com o agente
router.post('/chat', async (req, res) => {
  try {
    const { message, domain = null, conversationId = null, useLlm = true } = req.body || {};
    const result = await agent.chat({
      db: getDb(),
      userId: req.user.id,
      user: req.user,
      message,
      domain,
      conversationId,
      useLlm: useLlm !== false && useLlm !== 'false'
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Erro ao processar a mensagem');
  }
});

// ---- rotas com parâmetro (por último para não sombrear as fixas) ----

router.get('/knowledge/:domain', (req, res) => {
  try {
    const result = agent.knowledge(req.params.domain);
    if (!result) return res.status(404).json({ error: 'Domínio não encontrado' });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/domains/:id', (req, res) => {
  try {
    res.json(agent.domainReport(getDb(), req.user.id, req.params.id));
  } catch (error) {
    handleError(res, error, 'Erro ao montar o relatório da área');
  }
});

router.get('/conversations/:id', (req, res) => {
  try {
    const conversation = agent.conversations.get(Number(req.params.id), req.user.id);
    if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada' });
    res.json(conversation);
  } catch (error) {
    handleError(res, error);
  }
});

router.delete('/conversations/:id', (req, res) => {
  try {
    agent.conversations.remove(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
