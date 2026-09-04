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
      const achado = this.querySelectorAll(sel);
      if (achado.length) return achado[0];
      if (!cache.has(sel)) cache.set(sel, criarElemento('div', this));
      return cache.get(sel);
    },
    querySelectorAll(sel) {
      const [raiz, resto] = dividirSeletor(sel);
      if (raiz) return [];            // descendente de outro elemento: não é filho direto
      return this.children.filter((f) => combinar(f, resto || sel));
    },
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

/** Separa "#container .classe" em raiz + resto. Devolve raiz vazia para seletores simples. */
function dividirSeletor(sel) {
  const partes = String(sel).trim().split(/\s+/);
  if (partes.length < 2) return ['', String(sel).trim()];
  return [partes[0], partes.slice(1).join(' ')];
}

/** Casa um elemento com um seletor simples (lista separada por vírgula de tag ou .classe). */
function combinar(el, sel) {
  return String(sel).split(',').map((x) => x.trim()).filter(Boolean).some((p) => {
    if (p.startsWith('.')) {
      const classe = p.slice(1);
      return String(el.className || '').split(/\s+/).includes(classe) || el.classList.contains(classe);
    }
    return el.tagName === p.toUpperCase();
  });
}

function criarDom() {
  const registry = new Map();
  const document = {
    querySelector(sel) {
      if (!registry.has(sel)) registry.set(sel, criarElemento('div'));
      return registry.get(sel);
    },
    querySelectorAll(sel) {
      const [raiz, resto] = dividirSeletor(sel);
      const alvo = raiz ? this.querySelector(raiz) : null;
      if (!alvo) return [];
      return alvo.children.filter((f) => combinar(f, resto));
    },
    createElement: (tag) => criarElemento(tag),
    createElementNS: (_ns, tag) => criarElemento(tag),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
  };
  return { document, registry };
}

/* ---------------------------------------------------------------- contexto --- */

function subirAplicacao(baseUrl, dadosApi, preparar = null) {
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

  // Permite montar o pedaço de DOM que vem do HTML (botões de granularidade, por
  // exemplo) antes que o boot registre os listeners — igual ao navegador.
  if (preparar) preparar({ document, registry, criarElemento });

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

/** Espera o boot (carregarCadastros) terminar — sinal: nome da fábrica no cabeçalho. */
function aguardarBoot(registry) {
  return esperar(() => (registry.get('#nome-fabrica')?.textContent || '').length > 0);
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
  const api2 = async (p, corpo) => (await fetch(base + p, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
  })).json();
  dadosApi = {
    '/api/catalogos': await get('/api/catalogos'),
    '/api/turnos': await get('/api/turnos'),
    '/api/maquinas': await get('/api/maquinas'),
    '/api/modelos': await get('/api/modelos'),
    '/api/dashboard': await get('/api/dashboard'),
    '/api/apontamentos': await get('/api/apontamentos?limite=400'),
    '/api/equipes': await get('/api/equipes'),
    '/api/operadores': await get('/api/operadores'),
    '/api/acompanhamento': await get('/api/acompanhamento'),
    '/api/modelos/1/sequencia': await get('/api/modelos/1/sequencia'),
    '/api/cronometragens': await get('/api/cronometragens?modeloId=1'),
    '/api/balancos': [],
    '/api/balanceamento/simular': await api2(
      '/api/balanceamento/simular',
      { modelo_id: 1, meta_pecas_hora: 60, minutos_disponiveis: 420, max_postos: 0 }
    ),
  };
});

test.after(() => { if (server) server.close(); });

test('módulo de gráficos é exportado com as funções usadas pela interface', () => {
  const { contexto } = subirAplicacao(base, dadosApi);
  for (const fn of ['gauge', 'lineChart', 'pareto', 'barraEmpilhada', 'barChart', 'corPorMeta']) {
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

/* ========================= módulos novos: cronometragem / acompanhamento == */

test('barChart desenha colunas, linha de eficiência e eixo duplo sem NaN', () => {
  const { contexto } = subirAplicacao(base, dadosApi);
  const alvo = criarElementoParaTeste();
  contexto.window.Graficos.barChart(alvo, {
    labels: ['01/08', '02/08', '03/08'],
    valores: [1200, 980, 1540],
    nomeBarra: 'Peças por dia',
    linhaValores: [82, 76, 91],
    nomeLinha: 'Eficiência',
    meta: 85,
    unidade: 'peças',
  });

  const svgEl = alvo.children.find((c) => c.tagName === 'SVG');
  assert.ok(svgEl, 'deve criar um <svg>');
  const retangulos = svgEl.children.filter((c) => c.tagName === 'RECT');
  assert.equal(retangulos.length, 3, 'uma coluna por período');
  for (const r of retangulos) {
    assert.ok(Number(r._attrs.height) >= 0, 'altura não negativa');
    assert.ok(!String(r._attrs.y).includes('NaN'), 'y sem NaN');
  }
  const polilinhas = svgEl.children.filter((c) => c.tagName === 'POLYLINE');
  assert.equal(polilinhas.length, 1, 'linha de eficiência');
  assert.ok(!polilinhas[0]._attrs.points.includes('NaN'), 'pontos sem NaN');
  const metas = svgEl.children.filter((c) => c.tagName === 'LINE' && c._attrs.class === 'linha-meta');
  assert.equal(metas.length, 1, 'linha de meta desenhada');
  assert.match(alvo.innerHTML + alvo.children.length, /\d/);
});

test('barChart sem dados exibe o estado vazio em vez de gráfico quebrado', () => {
  const { contexto } = subirAplicacao(base, dadosApi);
  const alvo = criarElementoParaTeste();
  contexto.window.Graficos.barChart(alvo, { labels: [], valores: [] });
  assert.ok(!alvo.children.some((c) => c.tagName === 'SVG'), 'nenhum <svg> criado');
  assert.equal(alvo.children.length, 1, 'apenas o aviso de vazio');
  assert.equal(alvo.children[0].className, 'grafico-vazio');
  assert.equal(alvo.children[0].textContent, 'Sem dados no período selecionado');
});

test('acompanhamento renderiza KPIs, série diária e ranking individual', async () => {
  const { contexto, registry } = subirAplicacao(base, dadosApi);
  await contexto.carregarAcompanhamento();

  const kpis = registry.get('#kpis-acomp').innerHTML;
  assert.match(kpis, /Peças produzidas/);
  assert.match(kpis, /Eficiência média/);
  assert.match(kpis, /Produtividade/);
  assert.match(kpis, /Operadores/);
  assert.doesNotMatch(kpis, /NaN|undefined/, 'KPIs sem NaN/undefined');

  const serie = registry.get('#tabela-acomp-serie tbody').innerHTML;
  const linhas = serie.split('<tr>').length - 1;
  assert.equal(linhas, 45, 'uma linha por dia semeado');
  assert.doesNotMatch(serie, /NaN|undefined/);

  const individual = registry.get('#tabela-acomp-operador tbody').innerHTML;
  assert.equal(individual.split('<tr>').length - 1, 36, 'um operador por linha');
  assert.match(individual, /posto/i, 'base do tempo padrão exibida');

  const equipes = registry.get('#tabela-acomp-equipe tbody').innerHTML;
  assert.equal(equipes.split('<tr>').length - 1, 3, 'três equipes');
  assert.equal(registry.get('#tabela-acomp-modelo tbody').innerHTML.split('<tr>').length - 1, 10);

  // o gráfico de equipes foi desenhado em SVG
  const caixaEquipes = registry.get('#grafico-equipes');
  assert.ok(caixaEquipes.children.some((c) => c.tagName === 'SVG'), 'gráfico de equipes criado');
});

test('alternar a granularidade troca a série de diária para mensal', async () => {
  const { contexto, registry } = subirAplicacao(base, dadosApi, ({ document, criarElemento: novo }) => {
    // os botões vêm do HTML; o harness precisa deles antes do boot registrar os cliques
    const caixa = document.querySelector('#granularidade');
    for (const gran of ['dia', 'mes']) {
      const b = novo('button');
      b.dataset.gran = gran;
      caixa.appendChild(b);
    }
  });
  await contexto.carregarAcompanhamento();

  const diaria = registry.get('#tabela-acomp-serie tbody').innerHTML;
  assert.equal(diaria.split('<tr>').length - 1, 45, 'começa na visão diária');
  assert.equal(registry.get('#titulo-serie-acomp').textContent, 'Produção diária');

  const [, botaoMensal] = registry.get('#granularidade').children;
  botaoMensal.dispatch('click', {});

  assert.equal(registry.get('#titulo-serie-acomp').textContent, 'Produção mensal');
  const mensal = registry.get('#tabela-acomp-serie tbody').innerHTML;
  assert.equal(mensal.split('<tr>').length - 1, 3, 'três linhas na visão mensal');
  assert.match(mensal, /2026-0[789]/, 'rótulo do mês presente');
  assert.ok(botaoMensal.classList.contains('ativo'), 'botão mensal marcado como ativo');
});

test('prévia de cronometragem aplica ritmo e tolerância sobre a média válida', () => {
  const { contexto, document, registry } = subirAplicacao(base, dadosApi);
  document.querySelector('#cm-leituras').value = '28.4, 29.1, 27.9, 30.2, 28.8, 29.5';
  document.querySelector('#cm-ritmo').value = '1.00';
  document.querySelector('#cm-tolerancia').value = '12';

  contexto.preverCronometragem();
  const previa = registry.get('#cm-previa').innerHTML;

  // TO = 173.9/6 = 28.983 s ; TN = TO×1.00 ; TP = TN×1.12 = 32.461 s
  assert.match(previa, /28\.98 s/, 'tempo observado médio');
  assert.match(previa, /32\.46 s/, 'tempo padrão com 12% de tolerância');
  assert.match(previa, /6 de 6/, 'nenhuma leitura descartada neste conjunto');
  assert.doesNotMatch(previa, /NaN/);
});

test('prévia de cronometragem descarta leituras discrepantes e avisa', () => {
  const { contexto, document, registry } = subirAplicacao(base, dadosApi);
  document.querySelector('#cm-leituras').value = '28, 29, 28.5, 29.5, 80';
  document.querySelector('#cm-ritmo').value = '0.9';
  document.querySelector('#cm-tolerancia').value = '0';
  contexto.preverCronometragem();

  const previa = registry.get('#cm-previa').innerHTML;
  assert.match(previa, /4 de 5/, 'a leitura de 80 s é excluída');
  assert.match(previa, /fora de ±25% da mediana/, 'aviso ao operador');
  // TO das válidas = (28+29+28.5+29.5)/4 = 28.75 ; TN = 28.75×0.9 = 25.875
  assert.match(previa, /28\.75 s/, 'média das leituras válidas');
  assert.match(previa, /25\.88 s/, 'tempo normal com ritmo 0,90');
});

test('sequência operacional mostra o SAM da sequência e a divergência', async () => {
  const { contexto, document, registry } = subirAplicacao(base, dadosApi);
  document.querySelector('#cr-modelo').value = '1';
  await contexto.carregarSequencia();

  const resumo = registry.get('#cr-resumo-sam').innerHTML;
  assert.match(resumo, /SAM pela sequência/);
  assert.match(resumo, /SAM cadastrado/);
  assert.match(resumo, /Divergência/);
  assert.doesNotMatch(resumo, /NaN|undefined/);

  const linhas = registry.get('#tabela-sequencia tbody').innerHTML;
  const total = dadosApi['/api/modelos/1/sequencia'].operacoes.length;
  assert.equal(linhas.split('<tr>').length - 1, total, 'uma linha por operação');
  assert.match(linhas, /data-cronometrar=/, 'atalho para cronometrar a operação');
  assert.match(linhas, /leituras/, 'situação da cronometragem visível');

  // o select de operações do formulário foi populado a partir da mesma sequência
  const opcoes = registry.get('#cm-operacao').innerHTML;
  assert.equal(opcoes.split('<option').length - 1, total);
});

test('balanceamento desenha os postos, marca o gargalo e lista recomendações', async () => {
  const { contexto, document, registry } = subirAplicacao(base, dadosApi);
  assert.ok(await aguardarBoot(registry), 'boot concluído (seletores de modelo populados)');
  // os campos do formulário só entram no registry quando a aplicação os consulta;
  // usar document.querySelector aqui devolve exatamente o mesmo elemento.
  document.querySelector('#bl-modelo').value = '1';
  document.querySelector('#bl-meta').value = '60';
  document.querySelector('#bl-minutos').value = '420';
  document.querySelector('#bl-maxpostos').value = '0';

  await contexto.simularBalanceamento(null);

  const html = registry.get('#resultado-balanceamento').innerHTML;
  const postos = (html.match(/class="posto[ "]/g) || []).length;
  const esperados = dadosApi['/api/balanceamento/simular'].resultado.postosUsados;
  assert.equal(postos, esperados, `um cartão por posto (esperado ${esperados})`);
  assert.equal((html.match(/class="posto gargalo"/g) || []).length, 1, 'exatamente um gargalo');
  assert.match(html, /gargalo/, 'posto gargalo destacado');
  assert.match(html, /Pitch time/);
  assert.match(html, /Eficiência do balanceamento/);
  assert.match(html, /Diagnóstico/);
  assert.match(html, /CAM-100/, 'modelo identificado no resultado');
  assert.doesNotMatch(html, /NaN|undefined/);

  // a soma dos tempos de posto deve fechar com o SAM exibido
  const res = dadosApi['/api/balanceamento/simular'].resultado;
  const soma = res.estacoes.reduce((s, e) => s + e.tempo, 0);
  assert.ok(Math.abs(soma - res.sam) < 1e-9, 'conservação do SAM entre os postos');
});

test('equipes e operadores são listados a partir do cadastro real', async () => {
  const { contexto, registry } = subirAplicacao(base, dadosApi);
  assert.ok(await aguardarBoot(registry), 'boot concluído (equipes carregadas)');
  contexto.renderEquipes();
  contexto.renderOperadores();

  const equipes = registry.get('#tabela-equipes tbody').innerHTML;
  assert.equal(equipes.split('<tr>').length - 1, 3, 'três equipes');
  assert.match(equipes, /Equipe Alfa/);
  assert.match(equipes, /data-editar-eq=/);

  const operadores = registry.get('#tabela-operadores tbody').innerHTML;
  assert.equal(operadores.split('<tr>').length - 1, 36, 'trinta e seis operadores');
  assert.match(operadores, /data-editar-opr=/);
  assert.doesNotMatch(operadores, /NaN|undefined/);

  // os selects derivados foram populados no boot
  const filtro = registry.get('#acomp-equipe').innerHTML;
  assert.equal(filtro.split('<option').length - 1, 4, 'todas + 3 equipes');
  assert.equal(registry.get('#acomp-operador').innerHTML.split('<option').length - 1, 37);
});

test('lançamento de produção individual é lido de volta para envio à API', async () => {
  const { contexto, registry } = subirAplicacao(base, dadosApi);
  assert.ok(await aguardarBoot(registry), 'boot concluído (operadores carregados)');

  contexto.adicionarLinhaProducao({ operador_id: 5 });
  contexto.adicionarLinhaProducao({ operador_id: 6 });

  const lista = registry.get('#lista-producao');
  assert.equal(lista.children.length, 2, 'duas linhas de operador');
  assert.match(lista.children[0].innerHTML, /pr-padrao/, 'campo de tempo padrão presente');

  // O DOM mínimo não interpreta atributos value= dentro de innerHTML, então os
  // campos são preenchidos aqui exatamente como o usuário faria digitando.
  const preencher = (linha, v) => {
    for (const [sel, val] of Object.entries(v)) linha.querySelector(sel).value = val;
  };
  preencher(lista.children[0], { '.pr-minutos': '420', '.pr-pecas': '320', '.pr-defeitos': '4', '.pr-padrao': '0.9' });
  preencher(lista.children[1], { '.pr-minutos': '420', '.pr-pecas': '298', '.pr-defeitos': '1' });
  contexto.atualizarResumoProducao();

  const itens = contexto.lerProducao();
  assert.equal(itens.length, 2, 'duas linhas lidas');
  // os objetos nascem no contexto vm (outro realm), então são espalhados aqui
  assert.deepEqual({ ...itens[0] }, {
    operador_id: 5, minutos: 420, pecas: 320, defeitos: 4, tempo_padrao_min: 0.9,
  });
  assert.deepEqual({ ...itens[1] }, {
    operador_id: 6, minutos: 420, pecas: 298, defeitos: 1, tempo_padrao_min: null,
  }, 'tempo padrão opcional vira null');
  assert.match(registry.get('#resumo-producao').textContent, /618 peças/, 'resumo soma as peças');
  assert.match(registry.get('#resumo-producao').textContent, /14 h/, 'resumo soma os minutos (840 min = 14 h)');

  // linhas sem operador selecionado não podem chegar à API
  contexto.adicionarLinhaProducao({});
  assert.equal(contexto.lerProducao().length, 2, 'linha sem operador é descartada');
});

test('distribuição escolhe a equipe do setor com o mesmo número de operadores', async () => {
  const { contexto, registry } = subirAplicacao(base, dadosApi);
  assert.ok(await aguardarBoot(registry), 'boot concluído');
  const maquinas = dadosApi['/api/maquinas'];

  // as três linhas de costura casam 1:1 com as equipes pelo número de operadores
  for (const [linha, equipe, total] of [['Linha 1', 'Equipe Alfa', 14], ['Linha 2', 'Equipe Beta', 12], ['Linha 3', 'Equipe Gama', 10]]) {
    const escolhida = contexto.equipeDaLinha(maquinas.find((m) => m.nome.startsWith(linha)));
    assert.equal(escolhida.equipe.nome, equipe, `${linha} → ${equipe}`);
    assert.equal(escolhida.operadores.length, total, `${linha} tem ${total} operadores`);
  }

  // setor sem equipe cadastrada cai no conjunto completo, sem quebrar
  const corte = contexto.equipeDaLinha(maquinas.find((m) => m.setor === 'Corte'));
  assert.equal(corte.equipe, null, 'nenhuma equipe no setor Corte');
  assert.equal(corte.operadores.length, dadosApi['/api/operadores'].length, 'usa todos os operadores');

  // sem célula selecionada também não pode explodir
  const geral = contexto.equipeDaLinha(null);
  assert.ok(geral.operadores.length > 0, 'devolve operadores mesmo sem célula');
});
