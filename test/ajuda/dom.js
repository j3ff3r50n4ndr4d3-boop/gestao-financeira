'use strict';

/**
 * DOM mínimo para executar os scripts de navegador dentro do Node.
 * Compartilhado entre frontend.test.js e pages.test.js.
 */

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

module.exports = { criarElemento, criarDom };
