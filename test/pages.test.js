'use strict';

/**
 * Testa a build estática de verdade: a pasta `docs/` que vai para o GitHub Pages.
 *
 * Dois pontos que este teste garante e que mais nada garante:
 *   1. a ordem de carregamento gerada no `index.html` funciona — os motores
 *      precisam existir antes de `banco-local.js` usá-los;
 *   2. a página não faz NENHUM fetch. Se fizer, não é estática e o Pages quebra.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { criarDom } = require('./ajuda/dom');
const { gerar, SAIDA } = require('../scripts/gerar-estatico');

let html = '';

test.before(() => {
  gerar();
  html = fs.readFileSync(path.join(SAIDA, 'index.html'), 'utf8');
});

/* ------------------------------------------------------------------ build -- */

test('a build gera os arquivos e embute o cenário de exemplo', () => {
  for (const f of ['index.html', 'css/estilos.css', 'js/aplicacao.js', 'js/graficos.js',
    'js/banco-local.js', 'js/api-local.js', 'js/motores/oee.js', 'js/motores/tempos.js',
    'js/motores/balanceamento.js', '.nojekyll']) {
    assert.ok(fs.existsSync(path.join(SAIDA, f)), `docs/${f} deve existir`);
  }
  assert.match(html, /window\.DADOS_INICIAIS = \{/, 'cenário embutido na página');
  assert.match(html, /Versão estática/, 'aviso de que os dados são locais');
  assert.doesNotMatch(html, /<script src="js\/aplicacao\.js"><\/script>\s*<script src="js\/aplicacao\.js"/,
    'nenhum script duplicado');
});

test('a ordem dos scripts põe os motores antes de quem os usa', () => {
  const ordem = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(ordem, [
    'js/motores/oee.js', 'js/motores/tempos.js', 'js/motores/balanceamento.js',
    'js/banco-local.js', 'js/api-local.js', 'js/graficos.js', 'js/aplicacao.js',
  ], 'ordem exata de carregamento');
  assert.ok(ordem.indexOf('js/motores/oee.js') < ordem.indexOf('js/banco-local.js'));
  assert.ok(ordem.indexOf('js/api-local.js') < ordem.indexOf('js/aplicacao.js'),
    'a aplicação é a última, para encontrar API_LOCAL já definido');
});

test('a página não referencia nenhum endpoint absoluto do servidor', () => {
  // Links e fetches absolutos dariam 404 no Pages.
  assert.doesNotMatch(html, /href="\/api\//, 'nenhum link absoluto para /api/');
  assert.doesNotMatch(html, /src="\/(js|css)\//, 'assets com caminho relativo');
});

/* ------------------------------------------------------- página carregada -- */

function subirPagina() {
  const { document, registry } = criarDom();
  const fetchProibido = () => { throw new Error('a versão estática não pode usar fetch'); };

  const contexto = {
    document,
    console,
    fetch: fetchProibido,
    confirm: () => true,
    URL, URLSearchParams, structuredClone,
    Blob: class {},
    localStorage: (() => {
      const m = new Map();
      return {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => m.set(k, String(v)),
        removeItem: (k) => m.delete(k),
      };
    })(),
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: () => {},
  };
  contexto.window = contexto;
  contexto.globalThis = contexto;
  contexto.scrollTo = () => {};
  contexto.location = { href: 'https://exemplo.github.io/gestao-financeira/' };
  vm.createContext(contexto);

  // O <script> inline com o cenário, exatamente como o navegador o executaria.
  const inline = html.match(/<script>(window\.DADOS_INICIAIS = [\s\S]*?)<\/script>/);
  assert.ok(inline, 'script inline com o cenário encontrado');
  vm.runInContext(inline[1], contexto, { filename: 'dados-iniciais' });

  for (const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1])) {
    vm.runInContext(fs.readFileSync(path.join(SAIDA, src), 'utf8'), contexto, { filename: src });
  }
  return { contexto, registry };
}

async function esperar(condicao, ms = 5000) {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    if (condicao()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}

test('a página sobe sozinha, sem fetch, e renderiza o painel com o cenário embutido', async () => {
  const { contexto, registry } = subirPagina();

  assert.ok(contexto.DADOS_INICIAIS, 'DADOS_INICIAIS disponível');
  assert.equal(contexto.DADOS_INICIAIS.contagem.apontamentos, 373, 'cenário completo embutido');

  const boot = await esperar(() => (registry.get('#nome-fabrica')?.textContent || '').length > 0);
  assert.ok(boot, 'a aplicação iniciou sem servidor');
  assert.equal(registry.get('#nome-fabrica').textContent, 'Confecção Aurora LTDA');

  // Os quatro medidores foram desenhados de verdade, não apenas o HTML montado.
  // Cada gauge vive no seu próprio elemento [data-medidor="i"], filho do cache
  // do container — é assim que o DOM mínimo representa a árvore.
  const contMedidores = registry.get('#medidores');
  for (const rotulo of ['OEE', 'Disponibilidade', 'Desempenho', 'Qualidade']) {
    assert.match(contMedidores.innerHTML, new RegExp(`data-medidor="\\d+"`), 'container do medidor');
    void rotulo;
  }
  let comSvg = 0;
  for (let i = 0; i < 4; i++) {
    const alvo = contMedidores.querySelector(`[data-medidor="${i}"]`);
    assert.ok(alvo, `elemento do medidor ${i}`);
    if (alvo.children.some((c) => c.tagName === 'SVG')) comSvg += 1;
  }
  assert.equal(comSvg, 4, `${comSvg} medidores desenhados em SVG`);

  const kpis = registry.get('#kpis').innerHTML;
  assert.match(kpis, /Peças produzidas/, 'KPI de peças presente');
  assert.match(kpis, /peças boas/, 'KPI com peças boas');
  assert.doesNotMatch(kpis, /NaN|undefined/, 'KPIs sem NaN/undefined');

  const linhas = registry.get('#tabela-apontamentos tbody').innerHTML.split('<tr>').length - 1;
  assert.ok(linhas > 50, `${linhas} apontamentos listados`);
});

test('as abas novas também funcionam sem servidor', async () => {
  const { contexto, registry } = subirPagina();
  assert.ok(await esperar(() => (registry.get('#nome-fabrica')?.textContent || '').length > 0));

  await contexto.carregarAcompanhamento();
  const kpis = registry.get('#kpis-acomp').innerHTML;
  assert.match(kpis, /Eficiência média/);
  assert.doesNotMatch(kpis, /NaN|undefined/);
  assert.equal(registry.get('#tabela-acomp-operador tbody').innerHTML.split('<tr>').length - 1, 36,
    '36 operadores no ranking individual');

  contexto.document.querySelector('#cr-modelo').value = '1';
  await contexto.carregarSequencia();
  assert.match(registry.get('#cr-resumo-sam').innerHTML, /SAM pela sequência/);

  contexto.document.querySelector('#bl-modelo').value = '1';
  contexto.document.querySelector('#bl-meta').value = '60';
  await contexto.simularBalanceamento(null);
  assert.match(registry.get('#resultado-balanceamento').innerHTML, /class="posto[ "]/);
});

test('o que é lançado fica no localStorage e volta na próxima visita', async () => {
  const { contexto, registry } = subirPagina();
  assert.ok(await esperar(() => (registry.get('#nome-fabrica')?.textContent || '').length > 0));

  const antes = await contexto.api('/api/apontamentos?limite=1000');
  const criado = await contexto.api('/api/apontamentos', {
    method: 'POST',
    body: {
      data: '2026-09-04', maquina_id: 2, turno_id: 1, modelo_id: 1,
      pecas_produzidas: 321, pecas_defeito: 3, pecas_retrabalho: 0,
      paradas: [{ motivo: 'QUEBRA', minutos: 20, descricao: 'persistida' }],
    },
  });
  assert.equal(criado.pecasProduzidas, 321);

  // Uma segunda "visita": contexto novo, mesmo localStorage.
  const { contexto: deNovo } = subirPaginaComMesmoArmazenamento(contexto);
  const depois = await deNovo.api('/api/apontamentos?limite=1000');
  assert.equal(depois.total, antes.total + 1, 'o lançamento sobreviveu');
  const achado = depois.itens.find((a) => a.id === criado.id);
  assert.ok(achado, 'apontamento encontrado na segunda visita');
  assert.equal(achado.paradas[0].descricao, 'persistida');
});

/** Reusa o localStorage da instância anterior para simular uma nova visita. */
function subirPaginaComMesmoArmazenamento(anterior) {
  const salvo = anterior.localStorage.getItem('eficiencia-producao-v1');
  const { document, registry } = criarDom();
  const m = new Map([['eficiencia-producao-v1', salvo]]);
  const contexto = {
    document, console,
    fetch: () => { throw new Error('a versão estática não pode usar fetch'); },
    confirm: () => true,
    URL, URLSearchParams, structuredClone, Blob: class {},
    localStorage: {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    },
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: () => {},
  };
  contexto.window = contexto;
  contexto.globalThis = contexto;
  contexto.scrollTo = () => {};
  contexto.location = { href: 'https://exemplo.github.io/gestao-financeira/' };
  vm.createContext(contexto);
  const inline = html.match(/<script>(window\.DADOS_INICIAIS = [\s\S]*?)<\/script>/);
  vm.runInContext(inline[1], contexto, { filename: 'dados-iniciais' });
  for (const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((x) => x[1])) {
    vm.runInContext(fs.readFileSync(path.join(SAIDA, src), 'utf8'), contexto, { filename: src });
  }
  return { contexto, registry };
}
