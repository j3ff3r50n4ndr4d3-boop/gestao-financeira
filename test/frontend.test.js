'use strict';

/**
 * Teste do frontend: carrega os scripts reais de navegador (graficos.js e
 * aplicacao.js) dentro de um contexto com um DOM mínimo e alimenta a aplicação
 * com respostas reais da API. O objetivo é executar de fato os caminhos de
 * renderização — que não são alcançados pelos testes de HTTP — e verificar o
 * HTML/SVG produzido.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { once } = require('node:events');

const { abrir } = require('../server/db');
const { semear } = require('../server/seed');
const { createServer } = require('../server/index');

const PUBLIC = path.join(__dirname, '..', 'public');

/* ------------------------------------------------------------ DOM mínimo --- */

function criarElemento(tag = 'div', dono = null) {
  const cache = new Map();
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    _attrs: {},
    _listeners: {},
    _innerHTML: '',
    style: {},
    dataset: {},
    value: '',
    textContent: '',
    className: '',
    disabled: false,
    hidden: false,
    dono,

    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = String(v); this.children = []; },

    setAttribute(k, v) {
      this._attrs[k] = v;
      if (k.startsWith('data-')) {
        this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
      }
    },
    getAttribute(k) { return this._attrs[k] ?? null; },
    appendChild(filho) { this.children.push(filho); return filho; },
    remove() {},
    reset() {},
    focus() {},
    scrollIntoView() {},
    addEventListener(tipo, fn) { (this._listeners[tipo] ||= []).push(fn); },
    dispatch(tipo, evento) { (this._listeners[tipo] || []).forEach((fn) => fn(evento)); },

    querySelector(sel) {
      if (!cache.has(sel)) cache.set(sel, criarElemento('div', this));
      return cache.get(sel);
    },
    querySelectorAll() { return []; },
    closest() { return null; },

    classList: {
      _set: new Set(),
      add(...c) { c.forEach((x) => this._set.add(x)); },
      remove(...c) { c.forEach((x) => this._set.delete(x)); },
      contains(c) { return this._set.has(c); },
      toggle(c, forcar) {
        const quer = forcar === undefined ? !this._set.has(c) : !!forcar;
        if (quer) this._set.add(c); else this._set.delete(c);
        return quer;
      },
    },
  };
  return el;
}

function criarDom() {
  const registry = new Map();
  const document = {
    querySelector(sel) {
      if (!registry.has(sel)) registry.set(sel, criarElemento('div'));
      return registry.get(sel);
    },
    querySelectorAll() { return []; },
    createElement: (tag) => criarElemento(tag),
    createElementNS: (_ns, tag) => criarElemento(tag),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
  };
  return { document, registry };
}

/* ---------------------------------------------------------------- contexto --- */

function subirAplicacao(baseUrl, dadosApi) {
  const { document, registry } = criarDom();

  const fetchStub = async (caminho, opts = {}) => {
    const chave = String(caminho).split('?')[0];
    const registro = dadosApi[chave] || dadosApi[String(caminho)];
    if (!registro) throw new Error(`fetch sem stub para ${caminho}`);
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => structuredClone(registro),
      text: async () => JSON.stringify(registro),
    };
  };

  const timers = [];
  const contexto = {
    document,
    window: null,
    console,
    fetch: fetchStub,
    confirm: () => true,
    URLSearchParams,
    structuredClone,
    setTimeout: (fn, ms) => { timers.push(fn); return timers.length; },
    clearTimeout: () => {},
  };
  // No navegador `window` É o objeto global — é isso que faz `window.Graficos = ...`
  // criar o global `Graficos` usado pela aplicação. O stub precisa reproduzir isso.
  contexto.window = contexto;
  contexto.globalThis = contexto;
  contexto.scrollTo = () => {};
  contexto.location = { href: '' };
  vm.createContext(contexto);

  for (const arquivo of ['js/graficos.js', 'js/aplicacao.js']) {
    const codigo = fs.readFileSync(path.join(PUBLIC, arquivo), 'utf8');
    vm.runInContext(codigo, contexto, { filename: arquivo });
  }

  return { contexto, registry, timers, document };
}

async function esperar(condicao, ms = 4000) {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    if (condicao()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}

/* ================================================================== testes === */

let base = '';
let server = null;
let db = null;
let dadosApi = null;

test.before(async () => {
  db = abrir(':memory:');
  semear(db, { dias: 45, limpar: true });
  server = createServer(db);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;

  // Respostas reais da API, gravadas para alimentar o frontend.
  const get = async (p) => (await fetch(base + p)).json();
  dadosApi = {
    '/api/catalogos': await get('/api/catalogos'),
    '/api/turnos': await get('/api/turnos'),
    '/api/maquinas': await get('/api/maquinas'),
    '/api/modelos': await get('/api/modelos'),
    '/api/dashboard': await get('/api/dashboard'),
    '/api/apontamentos': await get('/api/apontamentos?limite=400'),
  };
});

test.after(() => { if (server) server.close(); });

test('módulo de gráficos é exportado com as funções usadas pela interface', () => {
  const { contexto } = subirAplicacao(base, dadosApi);
  for (const fn of ['gauge', 'lineChart', 'pareto', 'barraEmpilhada', 'corPorMeta']) {
    assert.equal(typeof contexto.window.Graficos[fn], 'function', `Graficos.${fn} deve existir`);
  }
});

test('gauge desenha trilho, arco de valor, marcador de meta e rótulo', () => {
  const { contexto, document } = subirAplicacao(base, dadosApi);
  const alvo = criarElementoParaTeste();
  contexto.window.Graficos.gauge(alvo, { valor: 75.4, rotulo: 'OEE', meta: 85 });

  const svgEl = alvo.children.find((c) => c.tagName === 'SVG');
  assert.ok(svgEl, 'deve criar um <svg>');
  const caminhos = svgEl.children.filter((c) => c.tagName === 'PATH').map((c) => c._attrs.d);
  assert.equal(caminhos.length, 2, 'trilho + arco de valor');
  for (const d of caminhos) {
    assert.match(d, /^M [\d.]+ [\d.]+ A \d+ \d+ 0 [01] 1 [\d.]+ [\d.]+$/, `arco SVG válido: ${d}`);
    assert.ok(!d.includes('NaN'), 'arco não pode conter NaN');
  }
  assert.ok(svgEl.children.some((c) => c.tagName === 'LINE'), 'marcador da meta');
  assert.ok(alvo.children.some((c) => c.textContent === 'OEE'), 'rótulo do medidor');

  // valor zero não pode quebrar o desenho
  const zerado = criarElementoParaTeste();
  contexto.window.Graficos.gauge(zerado, { valor: 0, rotulo: 'OEE', meta: 85 });
  const svgZero = zerado.children.find((c) => c.tagName === 'SVG');
  assert.ok(svgZero, 'gauge com valor 0 ainda desenha o trilho');

  // desempenho acima de 100%: o arco satura em 100%, mas o número exibido é o real
  const acima = criarElementoParaTeste();
  contexto.window.Graficos.gauge(acima, { valor: 142.9, rotulo: 'Desempenho', meta: 95 });
  const svgAcima = acima.children.find((c) => c.tagName === 'SVG');
  const numero = svgAcima.children.find((c) => c.tagName === 'TEXT' && c._attrs.class === 'gauge-numero');
  assert.equal(numero.textContent, '142.9', 'mostra o valor real, não 100');
  const arcoAcima = svgAcima.children.filter((c) => c.tagName === 'PATH').map((c) => c._attrs.d)[1];
  const arcoCheio = (() => {
    const alvo = criarElementoParaTeste();
    contexto.window.Graficos.gauge(alvo, { valor: 100, rotulo: 'X' });
    return alvo.children.find((c) => c.tagName === 'SVG').children
      .filter((c) => c.tagName === 'PATH').map((c) => c._attrs.d)[1];
  })();
  assert.equal(arcoAcima, arcoCheio, 'arco saturado em 100% quando o valor passa disso');
});

function criarElementoParaTeste() {
  // Elemento isolado com a mesma interface do stub, para inspecionar o desenho.
  const el = {
    tagName: 'DIV',
    children: [],
    _innerHTML: '',
    _attrs: {},
    style: {},
    textContent: '',
    className: '',
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this._attrs[k] = v; },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = String(v); this.children = []; },
  };
  return el;
}

test('lineChart, pareto e barraEmpilhada produzem SVG sem NaN', () => {
  const { contexto } = subirAplicacao(base, dadosApi);
  const G = contexto.window.Graficos;

  const linha = criarElementoParaTeste();
  G.lineChart(linha, {
    labels: ['01/09', '02/09', '03/09'],
    series: [{ nome: 'OEE', valores: [70, 74.5, 80], cor: '#0f766e' }],
    meta: 85,
  });
  const svgLinha = linha.children.find((c) => c.tagName === 'SVG');
  assert.ok(svgLinha.children.some((c) => c.tagName === 'POLYLINE'), 'série desenhada');
  const pontos = svgLinha.children.find((c) => c.tagName === 'POLYLINE')._attrs.points;
  assert.ok(!pontos.includes('NaN'), `pontos sem NaN: ${pontos}`);

  const par = criarElementoParaTeste();
  G.pareto(par, { itens: [{ rotulo: 'Quebra', valor: 120 }, { rotulo: 'Setup', valor: 80 }], unidade: 'min' });
  const svgPar = par.children.find((c) => c.tagName === 'SVG');
  assert.ok(svgPar.children.some((c) => c.tagName === 'RECT'), 'barras do Pareto');

  const emp = criarElementoParaTeste();
  G.barraEmpilhada(emp, { itens: [{ rotulo: 'Indisponibilidade', valor: 60, cor: '#dc2626' }] });
  assert.ok(emp.children.length > 0, 'barra empilhada desenhada');

  // casos vazios devem mostrar mensagem, não estourar
  for (const [fn, cfg] of [
    ['lineChart', { labels: [], series: [] }],
    ['pareto', { itens: [] }],
    ['barraEmpilhada', { itens: [] }],
  ]) {
    const alvo = criarElementoParaTeste();
    G[fn](alvo, cfg);
    assert.equal(alvo.children.length, 1, `${fn} vazio mostra aviso`);
    assert.equal(alvo.children[0].className, 'grafico-vazio');
  }
});

test('a aplicação carrega sozinha e renderiza o painel com dados reais', async () => {
  const { registry, document } = subirAplicacao(base, dadosApi);

  const pronto = await esperar(() => {
    const tbody = registry.get('#tabela-ranking tbody');
    return tbody && tbody.innerHTML.length > 100;
  });
  assert.ok(pronto, 'painel deveria terminar de renderizar');

  // ---- nome da fábrica vindo da configuração
  assert.equal(registry.get('#nome-fabrica').textContent, dadosApi['/api/catalogos'].metas.nomeFabrica);

  // ---- quatro medidores, cada um com SVG e rótulo próprios
  const contMedidores = registry.get('#medidores');
  const esperados = ['OEE', 'Disponibilidade', 'Desempenho', 'Qualidade'];
  for (let i = 0; i < 4; i++) {
    assert.ok(contMedidores.innerHTML.includes(`data-medidor="${i}"`), `container do medidor ${i}`);
    const medidor = contMedidores.querySelector(`[data-medidor="${i}"]`);
    assert.ok(medidor.children.some((c) => c.tagName === 'SVG'), `medidor ${i} desenhou o gauge`);
    assert.ok(
      medidor.children.some((c) => c.textContent === esperados[i]),
      `medidor ${i} rotulado como "${esperados[i]}"`
    );
  }

  // ---- KPIs
  const kpis = registry.get('#kpis').innerHTML;
  for (const esperado of ['Peças produzidas', 'Refugo', 'Produtividade', 'Paradas não planejadas', 'Custo da perda', 'Desvio da meta']) {
    assert.ok(kpis.includes(esperado), `KPI ${esperado}`);
  }
  assert.ok(kpis.includes('R$'), 'custo formatado em reais');
  assert.ok(!kpis.includes('NaN'), 'nenhum NaN nos KPIs');
  assert.ok(!kpis.includes('undefined'), 'nenhum undefined nos KPIs');

  // ---- ranking: todas as linhas do cenário de exemplo
  const ranking = registry.get('#tabela-ranking tbody').innerHTML;
  for (const m of dadosApi['/api/maquinas']) {
    assert.ok(ranking.includes(m.nome.replace('&', '&amp;')), `linha ${m.nome} no ranking`);
  }
  assert.ok(!ranking.includes('NaN'));
  assert.ok(ranking.includes('pilula'), 'situação em pilula colorida');

  // ---- análise por modelo
  const modelos = registry.get('#tabela-modelos-desempenho tbody').innerHTML;
  assert.ok(modelos.includes('CAM-100') || modelos.includes('CAL-420'), 'código de modelo na tabela');
  assert.ok(!modelos.includes('NaN'));

  // ---- 6 grandes perdas
  assert.ok(registry.get('#seis-perdas').innerHTML.includes('seis-perdas-item'), 'lista das 6 grandes perdas');

  // ---- histórico de apontamentos
  const historico = registry.get('#tabela-apontamentos tbody').innerHTML;
  assert.ok(historico.length > 500, 'histórico renderizado');
  assert.ok(historico.includes('data-editar-ap'), 'botão editar presente');
  assert.ok(historico.includes('data-excluir-ap'), 'botão excluir presente');
  assert.ok(!historico.includes('NaN'));
  const linhasHistorico = (historico.match(/<tr>/g) || []).length;
  assert.equal(linhasHistorico, dadosApi['/api/apontamentos'].itens.length, 'uma linha por apontamento');
  assert.ok(registry.get('#contador-apontamentos').textContent.includes(String(linhasHistorico)));

  // ---- gráficos receberam SVG
  for (const sel of ['#grafico-tendencia', '#grafico-pareto', '#grafico-perdas']) {
    const alvo = registry.get(sel);
    assert.ok(alvo.children.length > 0, `${sel} tem conteúdo desenhado`);
    const svgEl = alvo.children.find((c) => c.tagName === 'SVG');
    assert.ok(svgEl, `${sel} contém <svg>`);
  }

  // ---- filtros inicializados com 30 dias
  assert.match(registry.get('#filtro-de').value, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(registry.get('#filtro-ate').value, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(registry.get('#filtro-de').value <= registry.get('#filtro-ate').value, 'período coerente');

  // ---- selects de formulário populados pelos cadastros
  const optMaquinas = registry.get('#ap-maquina').innerHTML;
  for (const m of dadosApi['/api/maquinas']) assert.ok(optMaquinas.includes(`value="${m.id}"`));
  const optModelos = registry.get('#ap-modelo').innerHTML;
  for (const mo of dadosApi['/api/modelos']) assert.ok(optModelos.includes(`value="${mo.id}"`));
  assert.ok(optModelos.includes('sem modelo'), 'opção de apontar sem modelo');
});

test('formulário de apontamento monta linhas de parada com o catálogo real', async () => {
  const { registry, contexto } = subirAplicacao(base, dadosApi);
  await esperar(() => (registry.get('#tabela-ranking tbody')?.innerHTML.length || 0) > 100);

  // As funções declaradas no topo do script ficam no global do contexto.
  assert.equal(typeof contexto.adicionarLinhaParada, 'function');
  assert.equal(typeof contexto.opcoesMotivos, 'function');

  const opcoes = contexto.opcoesMotivos();
  assert.ok(opcoes.includes('Não planejadas (penalizam disponibilidade)'), 'optgroup das não planejadas');
  assert.ok(opcoes.includes('Planejadas (não penalizam disponibilidade)'), 'optgroup das planejadas');
  for (const m of dadosApi['/api/catalogos'].motivosParada) {
    assert.ok(opcoes.includes(`value="${m.codigo}"`), `motivo ${m.codigo} disponível`);
  }

  contexto.adicionarLinhaParada({ motivo: 'QUEBRA', minutos: 45, descricao: 'parada teste' });
  contexto.adicionarLinhaParada({ motivo: 'SETUP', minutos: 20 });
  const lista = registry.get('#lista-paradas');
  assert.equal(lista.children.length, 2, 'duas linhas de parada adicionadas');

  const primeira = lista.children[0];
  assert.match(primeira.innerHTML, /class="par-motivo"/);
  assert.match(primeira.innerHTML, /class="par-minutos min-parada"/);
  assert.match(primeira.innerHTML, /value="45"/, 'minutos preenchidos');
  assert.match(primeira.innerHTML, /parada teste/, 'descrição preenchida');
  assert.equal(primeira.querySelector('.par-motivo').value, 'QUEBRA', 'motivo selecionado');

  // Com o DOM mínimo a leitura devolve lista vazia e o resumo não pode quebrar.
  assert.match(registry.get('#resumo-paradas').textContent, /0 min no total/);
});

test('erros de API são avisados ao usuário sem derrubar a aplicação', async () => {
  const { registry } = subirAplicacao(base, {}); // nenhum stub → fetch rejeita
  const mostrou = await esperar(() => (registry.get('#aviso')?.textContent || '').length > 0);
  assert.ok(mostrou, 'aviso de erro exibido');
  assert.match(registry.get('#aviso').className, /erro/);
  assert.match(registry.get('#aviso').textContent, /Falha ao carregar/);
});
