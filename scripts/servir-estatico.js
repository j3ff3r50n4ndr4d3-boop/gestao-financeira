'use strict';

/**
 * Serve a pasta docs/ do jeito que o GitHub Pages serviria.
 *
 * Serve para conferir a build estática antes de publicar: mesma estrutura de
 * caminhos, sem servidor de aplicação por trás. Se algo aqui tentar chamar uma
 * API, o pedido cai em 404 — que é exatamente o que aconteceria no Pages.
 *
 * Uso: node scripts/servir-estatico.js [porta]
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..', 'docs');
const PORTA = Number(process.argv[2] || process.env.PORT || 3001);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const servidor = http.createServer((req, res) => {
  // Sem query string e sem normalizar para fora da pasta servida.
  const alvo = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let arquivo = path.join(RAIZ, alvo);
  if (!arquivo.startsWith(RAIZ)) {
    res.writeHead(403).end('fora da pasta servida');
    return;
  }
  if (alvo === '/' || alvo === '') arquivo = path.join(RAIZ, 'index.html');
  if (!fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 — não encontrado');
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
});

servidor.listen(PORTA, '0.0.0.0', () => {
  console.log(`[estático] docs/ em http://0.0.0.0:${PORTA}`);
});
