'use strict';

/**
 * Gera UM arquivo .html autossuficiente: CSS, JS e o cenário de exemplo tudo
 * dentro, sem nenhum pedido externo.
 *
 * Abre com dois cliques, direto do disco — sem servidor, sem internet, sem
 * instalar nada. Serve para levar num pendrive ou mandar por mensagem.
 *
 * Parte da pasta docs/, então as duas publicações vêm do mesmo código:
 *   node scripts/gerar-estatico.js && node scripts/gerar-html-unico.js
 */

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const DOCS = path.join(RAIZ, 'docs');
const SAIDA = path.join(DOCS, 'eficiencia-producao.html');

function gerar() {
  if (!fs.existsSync(path.join(DOCS, 'index.html'))) {
    throw new Error('docs/index.html não existe — rode antes: npm run pages');
  }

  let html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');

  // O CSS entra no lugar do <link>, para continuar valendo antes do corpo.
  html = html.replace(
    /<link rel="stylesheet" href="([^"]+)">/,
    (_m, href) => `<style>\n${fs.readFileSync(path.join(DOCS, href), 'utf8')}\n</style>`,
  );

  // Cada <script src> vira um <script> inline, na MESMA ordem — os motores
  // precisam existir antes de banco-local.js usá-los.
  html = html.replace(
    /<script src="([^"]+)"><\/script>/g,
    (_m, src) => {
      const codigo = fs.readFileSync(path.join(DOCS, src), 'utf8');
      // Uma ocorrência de "</script" dentro do código fecharia a tag no meio.
      if (/<\/script/i.test(codigo)) throw new Error(`</script em ${src} quebraria o inline`);
      // Sem `src`: com o atributo presente o navegador ignora o conteúdo inline
      // e vai buscar o arquivo. Fica `data-origem` só para saber de onde veio.
      return `<script data-origem="${src}">\n${codigo}\n</script>`;
    },
  );

  if (/<script src=/.test(html)) throw new Error('sobrou script externo — não ficou autossuficiente');
  if (/<link rel="stylesheet"/.test(html)) throw new Error('sobrou CSS externo');

  html = html.replace(
    '<meta name="description"',
    '<meta name="generator" content="arquivo único, funciona offline">\n<meta name="description"',
  );

  fs.writeFileSync(SAIDA, html);
  return { arquivo: SAIDA, kb: Math.round(fs.statSync(SAIDA).size / 1024) };
}

if (require.main === module) {
  const r = gerar();
  console.log(`[html único] ${path.relative(RAIZ, r.arquivo)} — ${r.kb} KB, zero pedidos externos`);
}

module.exports = { gerar, SAIDA };
