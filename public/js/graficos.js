'use strict';

/**
 * Gráficos em SVG puro, sem dependência externa.
 * Cada função desenha dentro do elemento informado, limpando o conteúdo anterior.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}, filhos = []) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    el.setAttribute(k, v);
  }
  for (const f of [].concat(filhos)) el.appendChild(f);
  return el;
}

function txt(x, y, conteudo, attrs = {}) {
  const el = svg('text', { x, y, ...attrs });
  el.textContent = conteudo;
  return el;
}

function polar(cx, cy, r, graus) {
  const rad = ((graus - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function caminhoArco(cx, cy, r, de, ate) {
  const [x0, y0] = polar(cx, cy, r, de);
  const [x1, y1] = polar(cx, cy, r, ate);
  const grande = Math.abs(ate - de) > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${grande} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function limpar(el) {
  if (!el) return null;
  el.innerHTML = '';
  return el;
}

function vazio(el, mensagem) {
  limpar(el);
  const p = document.createElement('p');
  p.className = 'grafico-vazio';
  p.textContent = mensagem;
  el.appendChild(p);
}

/** Cor pela proximidade da meta. */
function corPorMeta(valor, meta) {
  if (valor >= meta) return 'var(--ok)';
  if (valor >= meta * 0.75) return 'var(--atencao)';
  return 'var(--critico)';
}

/* ------------------------------------------------------------------ gauge --- */

/**
 * Medidor em arco de 270°.
 * @param {HTMLElement} el
 * @param {{valor:number, rotulo:string, meta?:number, sufixo?:string, legenda?:string}} cfg
 */
function gauge(el, cfg) {
  if (!limpar(el)) return;
  const bruto = Number.isFinite(cfg.valor) ? cfg.valor : 0;
  // O arco é desenhado até 100%; o número exibido é o valor real, que pode passar
  // de 100% (desempenho acima do padrão) e precisa ser visível como tal.
  const valor = Math.max(0, Math.min(100, bruto));
  const meta = cfg.meta ?? 85;
  const sufixo = cfg.sufixo ?? '%';

  const tam = 200;
  const cx = tam / 2;
  const cy = tam / 2 + 6;
  const r = 74;
  const INICIO = -135;
  const FIM = 135;
  const cor = cfg.cor || corPorMeta(bruto, meta);

  const angulo = INICIO + ((FIM - INICIO) * valor) / 100;
  const metaAngulo = INICIO + ((FIM - INICIO) * Math.min(100, meta)) / 100;

  const s = svg('svg', { viewBox: `0 0 ${tam} ${tam}`, class: 'gauge-svg', role: 'img' });
  s.appendChild(
    svg('title', {}, [document.createTextNode(`${cfg.rotulo}: ${bruto.toFixed(1)}${sufixo}`)])
  );
  // trilho
  s.appendChild(svg('path', { d: caminhoArco(cx, cy, r, INICIO, FIM), class: 'gauge-trilho' }));
  // valor
  if (valor > 0.2) {
    s.appendChild(
      svg('path', { d: caminhoArco(cx, cy, r, INICIO, angulo), class: 'gauge-valor', stroke: cor })
    );
  }
  // marcador da meta
  const [mx0, my0] = polar(cx, cy, r - 12, metaAngulo);
  const [mx1, my1] = polar(cx, cy, r + 12, metaAngulo);
  s.appendChild(svg('line', { x1: mx0, y1: my0, x2: mx1, y2: my1, class: 'gauge-meta' }));

  s.appendChild(txt(cx, cy - 4, bruto.toFixed(1), { class: 'gauge-numero', 'text-anchor': 'middle' }));
  s.appendChild(txt(cx, cy + 20, sufixo, { class: 'gauge-sufixo', 'text-anchor': 'middle' }));
  s.appendChild(txt(cx, cy + 46, `meta ${meta.toFixed(0)}${sufixo}`, { class: 'gauge-meta-txt', 'text-anchor': 'middle' }));

  el.appendChild(s);

  const rodape = document.createElement('div');
  rodape.className = 'gauge-rotulo';
  rodape.textContent = cfg.rotulo;
  el.appendChild(rodape);
  if (cfg.legenda) {
    const leg = document.createElement('div');
    leg.className = 'gauge-legenda';
    leg.textContent = cfg.legenda;
    el.appendChild(leg);
  }
}

/* -------------------------------------------------------------- gráfico linha --- */

/**
 * Gráfico de linhas com eixos, grade e linha de meta.
 * @param {HTMLElement} el
 * @param {{labels:string[], series:Array<{nome:string, valores:number[], cor:string, tracejado?:boolean}>, meta?:number, altura?:number, sufixo?:string, max?:number}} cfg
 */
function lineChart(el, cfg) {
  if (!limpar(el)) return;
  const labels = cfg.labels || [];
  if (labels.length === 0) return vazio(el, 'Sem dados no período selecionado');

  // Largura lógica fixa: o viewBox escala uniformemente com o contêiner,
  // preservando a proporção de textos e pontos.
  const largura = 880;
  const altura = cfg.altura || 300;
  const margem = { t: 18, r: 16, b: 40, l: 46 };
  const w = largura - margem.l - margem.r;
  const h = altura - margem.t - margem.b;
  const max = cfg.max ?? 100;
  const sufixo = cfg.sufixo ?? '%';

  const x = (i) => margem.l + (labels.length === 1 ? w / 2 : (w * i) / (labels.length - 1));
  const y = (v) => margem.t + h - (h * Math.max(0, Math.min(max, v))) / max;

  const s = svg('svg', { viewBox: `0 0 ${largura} ${altura}`, class: 'grafico-svg' });

  // grade horizontal + rótulos do eixo Y
  for (let i = 0; i <= 4; i++) {
    const valor = (max * i) / 4;
    const yy = y(valor);
    s.appendChild(svg('line', { x1: margem.l, y1: yy, x2: largura - margem.r, y2: yy, class: 'grade' }));
    s.appendChild(txt(margem.l - 8, yy + 4, String(Math.round(valor)), { class: 'rotulo-eixo', 'text-anchor': 'end' }));
  }

  // linha de meta
  if (cfg.meta !== undefined) {
    s.appendChild(svg('line', { x1: margem.l, y1: y(cfg.meta), x2: largura - margem.r, y2: y(cfg.meta), class: 'linha-meta' }));
    s.appendChild(
      txt(largura - margem.r - 4, y(cfg.meta) - 6, `meta ${cfg.meta}${sufixo}`, {
        class: 'rotulo-meta', 'text-anchor': 'end',
      })
    );
  }

  // rótulos do eixo X (um a cada n para não sobrepor)
  const passo = Math.max(1, Math.ceil(labels.length / 12));
  labels.forEach((lb, i) => {
    if (i % passo !== 0 && i !== labels.length - 1) return;
    s.appendChild(
      txt(x(i), altura - margem.b + 18, lb, { class: 'rotulo-eixo', 'text-anchor': 'middle' })
    );
  });

  for (const serie of cfg.series) {
    const pontos = serie.valores
      .map((v, i) => (Number.isFinite(v) ? `${x(i).toFixed(2)},${y(v).toFixed(2)}` : null))
      .filter(Boolean);
    if (pontos.length === 0) continue;

    // área preenchida apenas para a série principal
    if (!serie.tracejado && pontos.length > 1) {
      s.appendChild(
        svg('polygon', {
          points: `${margem.l},${margem.t + h} ${pontos.join(' ')} ${x(labels.length - 1).toFixed(2)},${margem.t + h}`,
          class: 'area-grafico',
          fill: serie.cor,
        })
      );
    }
    s.appendChild(
      svg('polyline', {
        points: pontos.join(' '),
        class: 'linha-grafico',
        stroke: serie.cor,
        'stroke-dasharray': serie.tracejado ? '5 4' : null,
      })
    );
    if (!serie.tracejado) {
      serie.valores.forEach((v, i) => {
        if (!Number.isFinite(v)) return;
        s.appendChild(svg('circle', { cx: x(i), cy: y(v), r: 3, class: 'ponto-grafico', fill: serie.cor }));
      });
    }
  }

  el.appendChild(s);

  if (cfg.series.length > 1) {
    const legenda = document.createElement('div');
    legenda.className = 'legenda-grafico';
    for (const serie of cfg.series) {
      const item = document.createElement('span');
      item.innerHTML = `<i style="background:${serie.cor}"></i>${serie.nome}`;
      legenda.appendChild(item);
    }
    el.appendChild(legenda);
  }
}

/* ------------------------------------------------------------------ Pareto --- */

/**
 * Pareto: barras decrescentes + curva de percentual acumulado.
 * @param {HTMLElement} el
 * @param {{itens:Array<{rotulo:string, valor:number}>, unidade?:string, altura?:number}} cfg
 */
function pareto(el, cfg) {
  if (!limpar(el)) return;
  const itens = (cfg.itens || []).filter((i) => i.valor > 0);
  if (itens.length === 0) return vazio(el, 'Nenhuma parada registrada no período');

  const unidade = cfg.unidade || 'min';
  const largura = Math.max(520, itens.length * 90);
  const altura = cfg.altura || 300;
  const m = { t: 20, r: 46, b: 78, l: 52 };
  const w = largura - m.l - m.r;
  const h = altura - m.t - m.b;

  const maxValor = Math.max(...itens.map((i) => i.valor)) * 1.1;
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const larguraBarra = (w / itens.length) * 0.62;

  const s = svg('svg', { viewBox: `0 0 ${largura} ${altura}`, class: 'grafico-svg' });
  // Com muitas barras o gráfico cresce e o contêiner .rolavel-x cuida da rolagem.
  s.style.minWidth = `${largura}px`;

  for (let i = 0; i <= 4; i++) {
    const yy = m.t + (h * i) / 4;
    s.appendChild(svg('line', { x1: m.l, y1: yy, x2: largura - m.r, y2: yy, class: 'grade' }));
    s.appendChild(
      txt(m.l - 8, yy + 4, String(Math.round((maxValor * (4 - i)) / 4)), { class: 'rotulo-eixo', 'text-anchor': 'end' })
    );
    s.appendChild(
      txt(largura - m.r + 8, yy + 4, `${Math.round(((4 - i) / 4) * 100)}%`, { class: 'rotulo-eixo', 'text-anchor': 'start' })
    );
  }

  let acumulado = 0;
  const pontosAcum = [];
  itens.forEach((item, i) => {
    const cx = m.l + (w / itens.length) * (i + 0.5);
    const alturaBarra = (h * item.valor) / maxValor;
    s.appendChild(
      svg('rect', {
        x: cx - larguraBarra / 2,
        y: m.t + h - alturaBarra,
        width: larguraBarra,
        height: alturaBarra,
        class: 'barra-pareto',
        rx: 3,
      })
    );
    s.appendChild(
      svg('title', {}, [document.createTextNode(`${item.rotulo}: ${item.valor.toFixed(0)} ${unidade}`)])
    );
    s.appendChild(
      txt(cx, m.t + h - alturaBarra - 6, String(Math.round(item.valor)), { class: 'rotulo-barra', 'text-anchor': 'middle' })
    );

    const rotulo = svg('text', {
      x: cx, y: m.t + h + 14, class: 'rotulo-eixo', 'text-anchor': 'end',
      transform: `rotate(-38 ${cx} ${m.t + h + 14})`,
    });
    rotulo.textContent = item.rotulo;
    s.appendChild(rotulo);

    acumulado += item.valor;
    pontosAcum.push(`${cx.toFixed(2)},${(m.t + h - (h * acumulado) / total).toFixed(2)}`);
  });

  s.appendChild(svg('polyline', { points: pontosAcum.join(' '), class: 'linha-acumulado' }));
  s.appendChild(
    txt(m.l - 34, m.t - 6, unidade, { class: 'rotulo-eixo', 'text-anchor': 'start' })
  );

  el.appendChild(s);
}

/* ----------------------------------------------------------- barra empilhada --- */

/**
 * Composição das perdas em uma barra empilhada horizontal.
 * @param {HTMLElement} el
 * @param {{itens:Array<{rotulo:string, valor:number, cor:string}>, unidade?:string}} cfg
 */
function barraEmpilhada(el, cfg) {
  if (!limpar(el)) return;
  const itens = (cfg.itens || []).filter((i) => i.valor > 0);
  if (itens.length === 0) return vazio(el, 'Sem perdas registradas');

  const total = itens.reduce((s, i) => s + i.valor, 0);
  const unidade = cfg.unidade || 'min';
  const largura = 640;
  const alturaBarra = 34;

  const s = svg('svg', { viewBox: `0 0 ${largura} ${alturaBarra + 8}`, class: 'grafico-svg' });
  let xCursor = 0;
  for (const item of itens) {
    const w = (largura * item.valor) / total;
    s.appendChild(
      svg('rect', { x: xCursor, y: 0, width: Math.max(1, w), height: alturaBarra, fill: item.cor, rx: 2 })
    );
    s.appendChild(
      svg('title', {}, [
        document.createTextNode(`${item.rotulo}: ${item.valor.toFixed(0)} ${unidade} (${((item.valor / total) * 100).toFixed(1)}%)`),
      ])
    );
    if (w > 54) {
      s.appendChild(
        txt(xCursor + w / 2, alturaBarra / 2 + 5, `${((item.valor / total) * 100).toFixed(0)}%`, {
          class: 'rotulo-empilhado', 'text-anchor': 'middle',
        })
      );
    }
    xCursor += w;
  }
  el.appendChild(s);

  const legenda = document.createElement('div');
  legenda.className = 'legenda-grafico';
  for (const item of itens) {
    const span = document.createElement('span');
    span.innerHTML = `<i style="background:${item.cor}"></i>${item.rotulo} · ${item.valor.toFixed(0)} ${unidade}`;
    legenda.appendChild(span);
  }
  el.appendChild(legenda);
}

/* ------------------------------------------------ coluna + linha dupla ----- */

/**
 * Colunas no eixo esquerdo com uma linha opcional no eixo direito (0–100%).
 * Usada no acompanhamento: peças por período (colunas) e eficiência (linha).
 * @param {HTMLElement} el
 * @param {{labels:string[], valores:number[], cor?:string, nomeBarra?:string,
 *          linhaValores?:number[], linhaCor?:string, nomeLinha?:string,
 *          meta?:number, altura?:number, unidade?:string}} cfg
 */
function barChart(el, cfg) {
  if (!limpar(el)) return;
  const labels = cfg.labels || [];
  if (labels.length === 0) return vazio(el, 'Sem dados no período selecionado');

  const largura = 880;
  const altura = cfg.altura || 300;
  const m = { t: 18, r: 48, b: 44, l: 58 };
  const w = largura - m.l - m.r;
  const h = altura - m.t - m.b;

  const maxBarra = Math.max(1, ...cfg.valores.map((v) => (Number.isFinite(v) ? v : 0))) * 1.12;
  const larguraBarra = Math.max(3, (w / labels.length) * 0.66);
  const cor = cfg.cor || 'var(--marca)';
  const x = (i) => m.l + (w / labels.length) * (i + 0.5);
  const yBarra = (v) => m.t + h - (h * Math.max(0, v)) / maxBarra;
  const yLinha = (v) => m.t + h - (h * Math.max(0, Math.min(100, v))) / 100;

  const s = svg('svg', { viewBox: `0 0 ${largura} ${altura}`, class: 'grafico-svg' });

  for (let i = 0; i <= 4; i++) {
    const yy = m.t + (h * i) / 4;
    s.appendChild(svg('line', { x1: m.l, y1: yy, x2: largura - m.r, y2: yy, class: 'grade' }));
    s.appendChild(
      txt(m.l - 8, yy + 4, String(Math.round((maxBarra * (4 - i)) / 4)), { class: 'rotulo-eixo', 'text-anchor': 'end' })
    );
    if (cfg.linhaValores) {
      s.appendChild(
        txt(largura - m.r + 8, yy + 4, `${Math.round(((4 - i) / 4) * 100)}%`, { class: 'rotulo-eixo', 'text-anchor': 'start' })
      );
    }
  }

  if (cfg.meta !== undefined && cfg.linhaValores) {
    s.appendChild(svg('line', { x1: m.l, y1: yLinha(cfg.meta), x2: largura - m.r, y2: yLinha(cfg.meta), class: 'linha-meta' }));
  }

  const passo = Math.max(1, Math.ceil(labels.length / 14));
  labels.forEach((lb, i) => {
    if (i % passo !== 0 && i !== labels.length - 1) return;
    s.appendChild(txt(x(i), altura - m.b + 16, lb, { class: 'rotulo-eixo', 'text-anchor': 'middle' }));
  });

  cfg.valores.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    const alturaBarra = Math.max(0, m.t + h - yBarra(v));
    s.appendChild(
      svg('rect', { x: x(i) - larguraBarra / 2, y: yBarra(v), width: larguraBarra, height: alturaBarra, rx: 2, fill: cor, class: 'barra-coluna' })
    );
    s.appendChild(svg('title', {}, [document.createTextNode(`${labels[i]}: ${Math.round(v)} ${cfg.unidade || ''}`)]));
  });

  if (cfg.linhaValores) {
    const pontos = cfg.linhaValores
      .map((v, i) => (Number.isFinite(v) ? `${x(i).toFixed(2)},${yLinha(v).toFixed(2)}` : null))
      .filter(Boolean);
    if (pontos.length > 1) {
      s.appendChild(svg('polyline', { points: pontos.join(' '), class: 'linha-grafico', stroke: cfg.linhaCor || 'var(--critico)' }));
    }
  }

  el.appendChild(s);

  if (cfg.linhaValores || cfg.nomeBarra) {
    const legenda = document.createElement('div');
    legenda.className = 'legenda-grafico';
    if (cfg.nomeBarra) legenda.innerHTML += `<span><i style="background:${cor}"></i>${cfg.nomeBarra}</span>`;
    if (cfg.linhaValores) legenda.innerHTML += `<span><i style="background:${cfg.linhaCor || 'var(--critico)'}"></i>${cfg.nomeLinha || 'Eficiência'}</span>`;
    el.appendChild(legenda);
  }
}

window.Graficos = { gauge, lineChart, pareto, barraEmpilhada, barChart, corPorMeta };
