// ============================================================
// AGENTE IA ERP - Adaptador de LLM (opcional)
// O agente funciona 100% offline com o motor local. Quando uma
// chave de provedor é configurada via variáveis de ambiente, a
// resposta local é enriquecida por um modelo de linguagem.
//
// Variáveis suportadas:
//   AGENT_LLM_PROVIDER   = auto | openai | anthropic | gemini | ollama | none
//   AGENT_LLM_MODEL      = modelo padrão (sobrepõe o do provedor)
//   AGENT_LLM_TIMEOUT_MS = timeout (padrão 45000)
//   OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL
//   ANTHROPIC_API_KEY / ANTHROPIC_MODEL
//   GEMINI_API_KEY (ou GOOGLE_API_KEY) / GEMINI_MODEL
//   OLLAMA_BASE_URL / OLLAMA_MODEL
//
// Nenhuma chave é exposta pela API: /api/agent/config devolve
// apenas provedor, modelo e se está habilitado.
// ============================================================

const DEFAULTS = {
  openai: { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
  anthropic: { model: 'claude-3-5-sonnet-latest', baseUrl: 'https://api.anthropic.com' },
  gemini: { model: 'gemini-1.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  ollama: { model: 'llama3.1', baseUrl: 'http://localhost:11434' }
};

function env(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
}

function detectProvider() {
  const forced = (env('AGENT_LLM_PROVIDER') || 'auto').toLowerCase();
  if (forced === 'none' || forced === 'off' || forced === 'disabled') return { provider: null, reason: 'LLM desabilitado por configuração (AGENT_LLM_PROVIDER=none)' };
  if (forced !== 'auto' && !DEFAULTS[forced]) return { provider: null, reason: `Provedor desconhecido: ${forced}` };

  const candidates = forced === 'auto' ? ['openai', 'anthropic', 'gemini', 'ollama'] : [forced];
  for (const provider of candidates) {
    if (provider === 'openai' && env('OPENAI_API_KEY')) return { provider };
    if (provider === 'anthropic' && env('ANTHROPIC_API_KEY')) return { provider };
    if (provider === 'gemini' && (env('GEMINI_API_KEY') || env('GOOGLE_API_KEY'))) return { provider };
    if (provider === 'ollama' && (env('OLLAMA_BASE_URL') || forced === 'ollama')) return { provider };
  }
  return { provider: null, reason: 'Nenhuma chave de provedor configurada — o agente opera com o motor local (offline).' };
}

function getConfig() {
  const { provider, reason } = detectProvider();
  if (!provider) return { enabled: false, provider: null, model: null, reason };
  const model = env('AGENT_LLM_MODEL') || env(`${provider.toUpperCase()}_MODEL`) || DEFAULTS[provider].model;
  return { enabled: true, provider, model, reason: null };
}

function timeoutMs() {
  const value = Number(env('AGENT_LLM_TIMEOUT_MS') || 45000);
  return Number.isFinite(value) && value > 1000 ? value : 45000;
}

async function postJson(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      json = null;
    }
    if (!res.ok) {
      const message = json?.error?.message || json?.message || text?.slice(0, 200) || `HTTP ${res.status}`;
      const err = new Error(`Falha no provedor LLM: ${message}`);
      err.status = res.status;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI({ system, user, model, temperature, maxTokens }) {
  const baseUrl = env('OPENAI_BASE_URL') || DEFAULTS.openai.baseUrl;
  const json = await postJson(
    `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    { Authorization: `Bearer ${env('OPENAI_API_KEY')}` },
    {
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    }
  );
  return json?.choices?.[0]?.message?.content?.trim() || null;
}

async function callAnthropic({ system, user, model, temperature, maxTokens }) {
  const json = await postJson(
    `${DEFAULTS.anthropic.baseUrl}/v1/messages`,
    { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
    {
      model,
      temperature,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }]
    }
  );
  const blocks = json?.content || [];
  return blocks.map((b) => (b.type === 'text' ? b.text : '')).join('\n').trim() || null;
}

async function callGemini({ system, user, model, temperature, maxTokens }) {
  const key = env('GEMINI_API_KEY') || env('GOOGLE_API_KEY');
  const baseUrl = env('GEMINI_BASE_URL') || DEFAULTS.gemini.baseUrl;
  const json = await postJson(
    `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {},
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    }
  );
  const parts = json?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('\n').trim() || null;
}

async function callOllama({ system, user, model, temperature }) {
  const baseUrl = env('OLLAMA_BASE_URL') || DEFAULTS.ollama.baseUrl;
  const json = await postJson(
    `${baseUrl.replace(/\/$/, '')}/api/chat`,
    {},
    {
      model,
      stream: false,
      options: { temperature },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    }
  );
  return json?.message?.content?.trim() || null;
}

const CALLERS = {
  openai: callOpenAI,
  anthropic: callAnthropic,
  gemini: callGemini,
  ollama: callOllama
};

/**
 * Gera texto com o LLM configurado.
 * @returns {Promise<{text: string, provider: string, model: string}>}
 * @throws quando o provedor falha (o chamador decide se usa o fallback local)
 */
async function generate({ system, user, temperature = 0.3, maxTokens = 1400 }) {
  const config = getConfig();
  if (!config.enabled) {
    const err = new Error(config.reason || 'LLM não configurado');
    err.code = 'LLM_DISABLED';
    throw err;
  }
  const caller = CALLERS[config.provider];
  if (!caller) {
    const err = new Error(`Provedor não suportado: ${config.provider}`);
    err.code = 'LLM_UNSUPPORTED';
    throw err;
  }
  const text = await caller({ system, user, model: config.model, temperature, maxTokens });
  if (!text) throw new Error('O provedor retornou resposta vazia');
  return { text, provider: config.provider, model: config.model };
}

module.exports = { generate, getConfig, detectProvider, DEFAULTS };
