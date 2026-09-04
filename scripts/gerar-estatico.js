'use strict';

/**
 * Gera a pasta `docs/` — a versão estática publicável no GitHub Pages.
 *
 * O que ela faz:
 *   1. copia o front-end e os motores de cálculo (os MESMOS arquivos do servidor);
 *   2. semeia um banco em memória e o exporta como `DADOS_INICIAIS`, embutido na
 *      página — assim o primeiro acesso já vem com o cenário de exemplo, sem
 *      precisar de fetch (funciona até abrindo o arquivo direto do disco).
 *
 * Rode com: node scripts/gerar-estatico.js
 */

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'docs');

const { abrir } = require('../server/db');
const { semear } = require('../server/seed');
const backup = require('../server/lib/backup');

const COPIAS = [
  ['public/index.html', 'index.html'],
  ['public/css/estilos.css', 'css/estilos.css'],
  ['public/js/graficos.js', 'js/graficos.js'],
  ['public/js/aplicacao.js', 'js/aplicacao.js'],
  ['public/js/banco-local.js', 'js/banco-local.js'],
  ['public/js/api-local.js', 'js/api-local.js'],
  ['server/lib/oee.js', 'js/motores/oee.js'],
  ['server/lib/tempos.js', 'js/motores/tempos.js'],
  ['server/lib/balanceamento.js', 'js/motores/balanceamento.js'],
];

/** Ordem de carregamento: motores → dados → roteador → gráficos → aplicação. */
const SCRIPTS = [
  'js/motores/oee.js',
  'js/motores/tempos.js',
  'js/motores/balanceamento.js',
  'js/banco-local.js',
  'js/api-local.js',
  'js/graficos.js',
  'js/aplicacao.js',
];

const AVISO = `
<div style="background:#0f172a;color:#e2e8f0;padding:9px 18px;font-size:.82rem;text-align:center;line-height:1.45">
  <strong>Versão estática</strong> — os dados ficam salvos <strong>somente neste navegador</strong>
  (localStorage). Não há servidor nem base compartilhada: outro computador ou uma janela
  anônima começam do zero, e limpar os dados do site apaga tudo.
  Use <em>Como calcular → Cópia de segurança</em> para exportar o que lançar.
</div>`;

function gerar() {
  fs.rmSync(SAIDA, { recursive: true, force: true });

  for (const [origem, destino] of COPIAS) {
    const alvo = path.join(SAIDA, destino);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, origem), alvo);
  }

  // Cenário de exemplo, igual ao que `npm run seed` produz no servidor.
  const db = abrir(':memory:');
  const resumo = semear(db, { dias: 45, limpar: true });
  const snapshot = backup.exportar(db);

  // `geradoEm` é a hora da exportação. Fixo aqui porque a build precisa ser
  // determinística: sem isto, rodar os testes (que regeneram docs/) suja um
  // arquivo já commitado só pelo timestamp. O campo é só metadado — `importar`
  // valida `versao` e `tabelas`, não a data.
  snapshot.geradoEm = resumo.periodo.ate + 'T00:00:00.000Z';

  let html = fs.readFileSync(path.join(SAIDA, 'index.html'), 'utf8');

  // Remove as tags de script originais e insere a ordem da versão estática.
  html = html.replace(/<script src="[^"]*"><\/script>\s*/g, '');
  const tags = [
    `<script>window.DADOS_INICIAIS = ${JSON.stringify(snapshot)};</script>`,
    ...SCRIPTS.map((s) => `<script src="${s}"></script>`),
  ].join('\n');
  if (!html.includes('</body>')) throw new Error('index.html sem </body>');
  html = html.replace('</body>', `${tags}\n</body>`);

  // Aviso de que os dados são locais, logo depois do cabeçalho.
  html = html.replace(/(<\/header>)/, `$1${AVISO}`);

  // O Pages serve em https://usuario.github.io/repositorio/, então caminhos
  // absolutos como /css/estilos.css escapariam do diretório e dariam 404.
  html = html.replace(/(href|src)="\/(?!\/)/g, '$1="');

  // O download de backup não tem URL sem servidor: vira botão que gera o arquivo.
  html = html.replace(
    /<a class="btn btn-primario" href="api\/backup" download>([^<]*)<\/a>/,
    '<button type="button" class="btn btn-primario" id="btn-backup-estatico">$1</button>');

  fs.writeFileSync(path.join(SAIDA, 'index.html'), html);
  fs.writeFileSync(path.join(SAIDA, '.nojekyll'), '');

  const tamanho = fs.statSync(path.join(SAIDA, 'index.html')).size;
  return { resumo, snapshot, tamanhoKb: Math.round(tamanho / 1024) };
}

if (require.main === module) {
  const r = gerar();
  console.log(`[estático] docs/ gerado — index.html com ${r.tamanhoKb} KB (cenário embutido)`);
  console.log(`[estático] cenário: ${r.resumo.apontamentos} apontamentos, ${r.resumo.paradas} paradas, `
    + `${r.snapshot.contagem.producao_operador} registros individuais (${r.resumo.periodo.de} a ${r.resumo.periodo.ate})`);
}

module.exports = { gerar, SAIDA };
