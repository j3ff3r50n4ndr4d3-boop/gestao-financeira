/* ═══════════════════════════════════════════════
   ÉLAN · Moda Feminina — app principal
   Sacola · Quick view · Checkout · Pagamentos
   ═══════════════════════════════════════════════ */
(() => {
"use strict";

/* ───────── helpers ───────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const onlyDigits = s => String(s).replace(/\D/g, "");
const productById = id => PRODUCTS.find(p => p.id === id);
const pad = n => String(n).padStart(2, "0");

/* ───────── estado ───────── */
const state = {
  cart: JSON.parse(localStorage.getItem("elan_cart") || "[]"),
  coupon: localStorage.getItem("elan_coupon") === "1",
  filter: "todos",
  ship: "standard",
  pay: "card",
  step: 1,
  qv: null, qvSize: null, qvQty: 1,
  boletoCode: "",
};
const saveCart = () => localStorage.setItem("elan_cart", JSON.stringify(state.cart));
const cartQty = () => state.cart.reduce((s, it) => s + it.qty, 0);

/* ───────── totais ───────── */
function totals() {
  const subtotal = state.cart.reduce((s, it) => s + productById(it.id).price * it.qty, 0);
  const discount = state.coupon ? subtotal * COUPON.percent / 100 : 0;
  const afterCoupon = subtotal - discount;
  const freeShip = afterCoupon >= FREE_SHIPPING_MIN;
  const shipCost = state.ship === "express" ? SHIPPING_EXPRESS : (freeShip ? 0 : SHIPPING_STANDARD);
  const pixDisc = state.pay === "pix" ? afterCoupon * PIX_DISCOUNT : 0;
  return { subtotal, discount, afterCoupon, shipCost, pixDisc, freeShip,
           cardTotal: afterCoupon + shipCost,
           total: afterCoupon + shipCost - pixDisc };
}

/* ───────── toasts ───────── */
function toast(msg, type = "") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = msg;
  $("#toasts").appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 350); }, 2600);
}

/* ═════════ GRID DE PRODUTOS ═════════ */
function productCard(p) {
  const maxI = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(p.price / MIN_INSTALLMENT)));
  return `<article class="p-card" data-id="${p.id}">
    <div class="p-media">
      ${p.tag ? `<span class="p-badge ${p.old ? "sale" : ""}">${p.tag}</span>` : ""}
      <img src="${p.img}" alt="${p.name}" loading="lazy">
      <button class="p-quick" data-add="${p.id}" type="button">Adicionar rápido</button>
    </div>
    <div class="p-info">
      <h3 class="p-name">${p.name}</h3>
      <p class="p-rating"><span class="stars">★★★★★</span> ${p.rating.toFixed(1).replace(".", ",")} (${p.reviews})</p>
      <div class="p-price"><strong>${fmt(p.price)}</strong>${p.old ? `<span class="old">${fmt(p.old)}</span>` : ""}</div>
      <p class="p-installments">até ${maxI}x sem juros · <span class="p-pix">${fmt(p.price * (1 - PIX_DISCOUNT))} no PIX</span></p>
    </div>
  </article>`;
}

function renderProducts() {
  const grid = $("#product-grid");
  let list = PRODUCTS;
  if (state.filter === "roupas" || state.filter === "acessorios") list = list.filter(p => p.cat === state.filter);
  if (state.filter === "promo") list = list.filter(p => p.old);
  grid.innerHTML = list.map(productCard).join("");
  $$(".p-card", grid).forEach(card =>
    card.addEventListener("click", () => openQuickView(card.dataset.id)));
  $$("[data-add]", grid).forEach(btn =>
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const p = productById(btn.dataset.add);
      addToCart(p.id, p.sizes[Math.floor((p.sizes.length - 1) / 2)], 1);
      openDrawer();
    }));
}

function setFilter(f) {
  state.filter = f;
  $$("#filters .chip").forEach(c => c.classList.toggle("active", c.dataset.filter === f));
  renderProducts();
}
$$("#filters .chip").forEach(c => c.addEventListener("click", () => setFilter(c.dataset.filter)));
$$(".cat-card").forEach(a => a.addEventListener("click", () => setFilter(a.dataset.filter)));

/* ═════════ DEPOIMENTOS ═════════ */
$("#testimonials").innerHTML = TESTIMONIALS.map(t => `
  <div class="t-card">
    <span class="stars">${"★".repeat(t.rating)}</span>
    <p class="t-quote">“${t.quote}”</p>
    <p class="t-author"><strong>${t.name}</strong>${t.city} · <span class="t-verified">✓ Compra verificada</span></p>
  </div>`).join("");

/* ═════════ SACOLA (DRAWER) ═════════ */
const drawer = $("#drawer");
const drawerOverlay = $("#drawer-overlay");

function lockScroll(on) { document.body.style.overflow = on ? "hidden" : ""; }

function openDrawer() {
  renderCart();
  drawerOverlay.hidden = false;
  requestAnimationFrame(() => drawerOverlay.classList.add("show"));
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  lockScroll(true);
}
function closeDrawer() {
  drawer.classList.remove("open");
  drawerOverlay.classList.remove("show");
  drawer.setAttribute("aria-hidden", "true");
  setTimeout(() => { drawerOverlay.hidden = true; }, 300);
  if ($("#checkout").hidden && $("#qv-overlay").hidden) lockScroll(false);
}

function addToCart(id, size, qty) {
  const item = state.cart.find(it => it.id === id && it.size === size);
  const stock = productById(id).stock;
  if (item) item.qty = Math.min(stock, item.qty + qty);
  else state.cart.push({ id, size, qty: Math.min(stock, qty) });
  saveCart();
  updateAll();
  toast("✓ Adicionado à sacola", "ok");
}
function changeQty(idx, delta) {
  const it = state.cart[idx];
  if (!it) return;
  it.qty += delta;
  if (it.qty <= 0) state.cart.splice(idx, 1);
  else it.qty = Math.min(productById(it.id).stock, it.qty);
  saveCart();
  updateAll();
}
function removeItem(idx) { state.cart.splice(idx, 1); saveCart(); updateAll(); }

function renderCart() {
  const box = $("#drawer-items");
  const qty = cartQty();
  const badge = $("#cart-count");
  badge.hidden = qty === 0;
  badge.textContent = qty;
  $("#drawer-count").textContent = qty ? `(${qty} ${qty === 1 ? "item" : "itens"})` : "";

  if (!state.cart.length) {
    box.innerHTML = `<div class="drawer-empty"><p class="big">Sua sacola está vazia</p><p>Adicione peças para continuar ✨</p></div>`;
    $("#drawer-foot").hidden = true;
    $("#ship-progress").style.display = "none";
    return;
  }
  $("#drawer-foot").hidden = false;
  $("#ship-progress").style.display = "";

  box.innerHTML = state.cart.map((it, i) => {
    const p = productById(it.id);
    return `<div class="d-item">
      <img src="${p.img}" alt="${p.name}">
      <div>
        <p class="d-name">${p.name}</p>
        <p class="d-meta">Tam. ${it.size}</p>
        <div class="d-qty">
          <button data-act="minus" data-idx="${i}" aria-label="Diminuir">−</button>
          <span>${it.qty}</span>
          <button data-act="plus" data-idx="${i}" aria-label="Aumentar">+</button>
        </div>
      </div>
      <div class="d-right">
        <strong class="d-price">${fmt(p.price * it.qty)}</strong>
        <button class="d-remove" data-act="remove" data-idx="${i}">Remover</button>
      </div>
    </div>`;
  }).join("");

  $$("#drawer-items [data-act]").forEach(b => b.addEventListener("click", () => {
    const i = +b.dataset.idx;
    if (b.dataset.act === "remove") removeItem(i);
    else changeQty(i, b.dataset.act === "plus" ? 1 : -1);
  }));

  const t = totals();
  const remain = FREE_SHIPPING_MIN - t.subtotal;
  $("#ship-text").innerHTML = remain > 0
    ? `Faltam <strong>${fmt(remain)}</strong> para você ganhar <strong>frete grátis</strong> 🚚`
    : `<strong>🎉 Você ganhou frete grátis!</strong>`;
  $("#ship-fill").style.width = Math.min(100, t.subtotal / FREE_SHIPPING_MIN * 100) + "%";

  $("#cart-subtotal").textContent = fmt(t.subtotal);
  $("#cart-discount-row").hidden = !state.coupon;
  $("#cart-discount").textContent = "−" + fmt(t.discount);
  if (state.coupon) $("#cart-coupon").value = COUPON.code;
}

$("#btn-cart").addEventListener("click", openDrawer);
$("#btn-close-drawer").addEventListener("click", closeDrawer);
$("#btn-continue").addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);

/* ═════════ CUPOM ═════════ */
function applyCoupon(code, msgEl) {
  code = code.trim().toUpperCase();
  if (!code) return;
  if (code === COUPON.code && state.coupon) {
    state.coupon = false; localStorage.removeItem("elan_coupon");
    if (msgEl) { msgEl.textContent = "Cupom removido."; msgEl.className = "coupon-msg err"; }
  } else if (code === COUPON.code) {
    state.coupon = true; localStorage.setItem("elan_coupon", "1");
    if (msgEl) { msgEl.textContent = `Cupom ${COUPON.code} aplicado: −${COUPON.percent}% 🎉`; msgEl.className = "coupon-msg ok"; }
    toast(`Cupom ${COUPON.code} aplicado: −${COUPON.percent}%`, "ok");
  } else {
    if (msgEl) { msgEl.textContent = "Cupom inválido 😕"; msgEl.className = "coupon-msg err"; }
    toast("Cupom inválido", "err");
    return;
  }
  updateAll();
}
$("#btn-apply-coupon").addEventListener("click", () => applyCoupon($("#cart-coupon").value, $("#coupon-msg")));
$("#cart-coupon").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); applyCoupon($("#cart-coupon").value, $("#coupon-msg")); } });
$("#btn-sum-coupon").addEventListener("click", () => applyCoupon($("#sum-coupon").value, null));
$("#sum-coupon").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); applyCoupon($("#sum-coupon").value, null); } });
$("#btn-copy-coupon").addEventListener("click", () => copyText(COUPON.code, "Cupom BEMVINDA10 copiado ✓"));

async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
  toast(okMsg, "ok");
}

/* ═════════ QUICK VIEW ═════════ */
const qvOverlay = $("#qv-overlay");

function openQuickView(id) {
  const p = productById(id);
  if (!p) return;
  state.qv = p; state.qvQty = 1;
  state.qvSize = p.sizes[Math.floor((p.sizes.length - 1) / 2)];

  $("#qv-img").src = p.img; $("#qv-img").alt = p.name;
  $("#qv-tag").textContent = p.tag || "Coleção Primavera 26";
  $("#qv-name").textContent = p.name;
  $("#qv-rating").textContent = `${p.rating.toFixed(1).replace(".", ",")} · ${p.reviews} avaliações`;
  $("#qv-old").textContent = p.old ? fmt(p.old) : "";
  $("#qv-price").textContent = fmt(p.price);
  $("#qv-pix").textContent = `${fmt(p.price * (1 - PIX_DISCOUNT))} no PIX`;
  const maxI = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(p.price / MIN_INSTALLMENT)));
  $("#qv-installments").textContent = maxI > 1
    ? `ou ${maxI}x de ${fmt(p.price / maxI)} sem juros no cartão`
    : "à vista no cartão ou PIX";
  $("#qv-desc").textContent = p.desc;
  $("#qv-qty").textContent = "1";
  $("#qv-sizes").innerHTML = p.sizes.map(s =>
    `<button class="size-btn ${s === state.qvSize ? "active" : ""}" type="button">${s}</button>`).join("");
  $$("#qv-sizes .size-btn").forEach(b => b.addEventListener("click", () => {
    state.qvSize = b.textContent.trim();
    $$("#qv-sizes .size-btn").forEach(x => x.classList.toggle("active", x === b));
  }));
  const scarcity = $("#qv-scarcity");
  if (p.stock <= 5) { scarcity.hidden = false; scarcity.textContent = `🔥 Restam apenas ${p.stock} unidades em estoque`; }
  else scarcity.hidden = true;

  qvOverlay.hidden = false;
  requestAnimationFrame(() => qvOverlay.classList.add("show"));
  lockScroll(true);
}
function closeQuickView() {
  qvOverlay.classList.remove("show");
  setTimeout(() => { qvOverlay.hidden = true; }, 300);
  lockScroll(false);
}
$("#qv-close").addEventListener("click", closeQuickView);
qvOverlay.addEventListener("click", e => { if (e.target === qvOverlay) closeQuickView(); });
$("#qv-minus").addEventListener("click", () => { state.qvQty = Math.max(1, state.qvQty - 1); $("#qv-qty").textContent = state.qvQty; });
$("#qv-plus").addEventListener("click", () => { state.qvQty = Math.min(state.qv.stock, state.qvQty + 1); $("#qv-qty").textContent = state.qvQty; });
$("#qv-add").addEventListener("click", () => {
  addToCart(state.qv.id, state.qvSize, state.qvQty);
  closeQuickView();
  setTimeout(openDrawer, 200);
});
$("#qv-size-guide").addEventListener("click", () => toast("📏 PP 36 · P 38 · M 40 · G 42 · GG 44"));
$$("[data-open-product]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); openQuickView(a.dataset.openProduct); }));

/* ═════════ CHECKOUT — abertura / resumo ═════════ */
const checkoutEl = $("#checkout");

$("#btn-checkout").addEventListener("click", () => {
  if (!state.cart.length) { toast("Sua sacola está vazia", "err"); return; }
  closeDrawer();
  setTimeout(openCheckout, 250);
});

function openCheckout() {
  checkoutEl.hidden = false;
  lockScroll(true);
  checkoutEl.scrollTop = 0;
  goStep(1);
  updateAll();
}
function hideCheckout() {
  checkoutEl.hidden = true;
  lockScroll(false);
}
$("#btn-back-store").addEventListener("click", hideCheckout);

function goStep(n) {
  state.step = n;
  for (let i = 1; i <= 4; i++) $("#panel-" + i).hidden = i !== n;
  $$("#steps li").forEach(li => {
    const s = +li.dataset.step;
    li.classList.toggle("active", s === n);
    li.classList.toggle("done", s < n);
  });
  checkoutEl.scrollTop = 0;
}

function renderSummary() {
  const t = totals();
  $("#sum-items").innerHTML = state.cart.map(it => {
    const p = productById(it.id);
    return `<div class="sum-item">
      <img src="${p.img}" alt="${p.name}">
      <div><p class="n">${p.name}</p><p class="m">Tam. ${it.size} · Qtd. ${it.qty}</p></div>
      <strong>${fmt(p.price * it.qty)}</strong>
    </div>`;
  }).join("");
  $("#sum-subtotal").textContent = fmt(t.subtotal);
  $("#sum-discount-row").hidden = !state.coupon;
  $("#sum-discount").textContent = "−" + fmt(t.discount);
  $("#sum-ship").textContent = t.shipCost === 0 ? "Grátis ✓" : fmt(t.shipCost);
  $("#sum-pix-row").hidden = state.pay !== "pix";
  $("#sum-pix").textContent = "−" + fmt(t.pixDisc);
  $("#sum-total").textContent = fmt(t.total);
  if (state.coupon) $("#sum-coupon").value = COUPON.code;
}

function updatePaymentUI() {
  const t = totals();
  $("#ship-standard-price").textContent = t.freeShip ? "Grátis" : fmt(SHIPPING_STANDARD);
  /* cartão */
  const sel = $("#c-parc");
  const maxI = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(t.cardTotal / MIN_INSTALLMENT)));
  const prev = sel.value;
  sel.innerHTML = "";
  for (let n = 1; n <= maxI; n++) {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n === 1 ? `1x de ${fmt(t.cardTotal)} à vista` : `${n}x de ${fmt(t.cardTotal / n)} sem juros`;
    sel.appendChild(opt);
  }
  sel.value = prev && +prev <= maxI ? prev : maxI;
  $("#pay-card-total").textContent = fmt(t.cardTotal);
  /* pix */
  $("#pix-total").textContent = fmt(t.total);
  $("#pix-old").textContent = fmt(t.cardTotal);
}

function updateAll() {
  renderCart();
  if (!checkoutEl.hidden) { renderSummary(); updatePaymentUI(); }
}

/* ═════════ CHECKOUT — máscaras e validações ═════════ */
function maskCPF(v) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length > 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0,3)}.${d.slice(3)}`;
  return d;
}
function maskPhone(v) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length > 10) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length > 6) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  if (d.length > 2) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return d;
}
function maskCEP(v) { const d = onlyDigits(v).slice(0, 8); return d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d; }
function maskCard(v) { return onlyDigits(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 "); }
function maskExp(v) {
  let d = onlyDigits(v);
  if (d.length >= 1 && +d[0] > 1) d = "0" + d;
  d = d.slice(0, 4);
  return d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d;
}

function bindMask(el, fn) {
  el.addEventListener("input", () => {
    const pos = el.selectionStart;
    el.value = fn(el.value);
    try { el.setSelectionRange(pos, pos); } catch {}
  });
}
bindMask($("#f-cpf"), maskCPF);
bindMask($("#f-fone"), maskPhone);
bindMask($("#f-cep"), maskCEP);
bindMask($("#c-num"), maskCard);
bindMask($("#c-val"), maskExp);
$("#c-cvv").addEventListener("input", e => { e.target.value = onlyDigits(e.target.value).slice(0, 4); });

$("#c-num").addEventListener("input", () => { $("#c-brand").textContent = cardBrand(onlyDigits($("#c-num").value)); });

function cardBrand(num) {
  if (/^4/.test(num)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(num)) return "MASTERCARD";
  if (/^3[47]/.test(num)) return "AMEX";
  if (/^(4011|4312|4389|5041|5066|509\d|6277|6362|6363|650\d|6516|6550)/.test(num)) return "ELO";
  return "";
}
function validCPF(cpf) {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== +d[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  return r === +d[10];
}
function luhn(num) {
  let s = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = +num[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    s += n; alt = !alt;
  }
  return s % 10 === 0;
}
function setErr(input, msg) {
  const f = input.closest(".field");
  if (!f) return;
  f.classList.toggle("invalid", !!msg);
  const e = f.querySelector(".err");
  if (e) e.textContent = msg || "";
}
function clearErrors(scope) {
  $$(".field", scope).forEach(f => { f.classList.remove("invalid"); const e = f.querySelector(".err"); if (e) e.textContent = ""; });
}

/* ═════════ CHECKOUT — navegação de passos ═════════ */
$("#btn-to-2").addEventListener("click", () => {
  clearErrors($("#panel-1"));
  let ok = true;
  const nome = $("#f-nome"), email = $("#f-email"), cpf = $("#f-cpf"), fone = $("#f-fone");
  if (nome.value.trim().length < 5 || !nome.value.trim().includes(" ")) { setErr(nome, "Informe seu nome completo"); ok = false; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setErr(email, "E-mail inválido"); ok = false; }
  if (!validCPF(cpf.value)) { setErr(cpf, "CPF inválido"); ok = false; }
  if (onlyDigits(fone.value).length < 10) { setErr(fone, "Telefone inválido"); ok = false; }
  if (ok) goStep(2);
  else toast("Confira os campos destacados", "err");
});

$("#btn-to-3").addEventListener("click", () => {
  clearErrors($("#panel-2"));
  let ok = true;
  const req = [
    ["#f-cep", v => onlyDigits(v).length === 8, "CEP incompleto"],
    ["#f-end", v => v.trim().length >= 4, "Informe o endereço"],
    ["#f-num", v => v.trim().length >= 1, "Obrigatório"],
    ["#f-bairro", v => v.trim().length >= 2, "Obrigatório"],
    ["#f-cidade", v => v.trim().length >= 2, "Obrigatório"],
    ["#f-uf", v => v.trim().length === 2, "UF"],
  ];
  for (const [sel, test, msg] of req) {
    const el = $(sel);
    if (!test(el.value)) { setErr(el, msg); ok = false; }
  }
  if (ok) { goStep(3); renderSummary(); updatePaymentUI(); if (state.pay === "pix") genPix(); if (state.pay === "boleto") genBoleto(); }
  else toast("Confira os campos destacados", "err");
});

$("#btn-back-1").addEventListener("click", () => goStep(1));
$("#btn-back-2").addEventListener("click", () => goStep(2));
$$('input[name="ship"]').forEach(r => r.addEventListener("change", () => {
  state.ship = r.value;
  updateAll();
}));

/* ── ViaCEP ── */
$("#f-cep").addEventListener("blur", lookupCEP);
$("#f-cep").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); lookupCEP(); } });
async function lookupCEP() {
  const d = onlyDigits($("#f-cep").value);
  const st = $("#cep-status");
  if (d.length !== 8) return;
  st.textContent = "Buscando endereço…";
  st.className = "cep-hint loading";
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    if (j.erro) { st.textContent = "CEP não encontrado — preencha manualmente"; st.className = "cep-hint err"; return; }
    if (j.logradouro) $("#f-end").value = j.logradouro;
    if (j.bairro) $("#f-bairro").value = j.bairro;
    if (j.localidade) $("#f-cidade").value = j.localidade;
    if (j.uf) $("#f-uf").value = j.uf;
    st.textContent = "✓ Endereço preenchido automaticamente";
    st.className = "cep-hint ok";
  } catch {
    st.textContent = "Não foi possível buscar o CEP — preencha manualmente";
    st.className = "cep-hint err";
  }
}

/* ═════════ CHECKOUT — abas de pagamento ═════════ */
$$(".pay-tab").forEach(tab => tab.addEventListener("click", () => {
  state.pay = tab.dataset.pay;
  $$(".pay-tab").forEach(t => t.classList.toggle("active", t === tab));
  $("#pane-card").hidden = state.pay !== "card";
  $("#pane-pix").hidden = state.pay !== "pix";
  $("#pane-boleto").hidden = state.pay !== "boleto";
  renderSummary(); updatePaymentUI();
  if (state.pay === "pix") genPix();
  if (state.pay === "boleto") genBoleto();
}));

/* ── Cartão ── */
$("#btn-pay-card").addEventListener("click", async () => {
  clearErrors($("#pane-card"));
  let ok = true;
  const num = onlyDigits($("#c-num").value);
  if (num.length < 13 || num.length > 16 || !luhn(num)) { setErr($("#c-num"), "Número do cartão inválido"); ok = false; }
  if ($("#c-nome").value.trim().length < 3) { setErr($("#c-nome"), "Informe o nome impresso"); ok = false; }
  const exp = $("#c-val").value;
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(exp)) { setErr($("#c-val"), "Use MM/AA"); ok = false; }
  else {
    const [mm, yy] = exp.split("/").map(Number);
    const end = new Date(2000 + yy, mm, 0, 23, 59);
    if (end < new Date()) { setErr($("#c-val"), "Cartão vencido"); ok = false; }
  }
  if (!/^\d{3,4}$/.test($("#c-cvv").value)) { setErr($("#c-cvv"), "CVV inválido"); ok = false; }
  if (!ok) { toast("Confira os dados do cartão", "err"); return; }

  const t = totals();
  const parc = +$("#c-parc").value;
  await processing(parc > 1 ? `Processando em ${parc}x…` : "Processando pagamento…", 2200);
  finishOrder("card", parc === 1 ? `Cartão ${$("#c-brand").textContent || "de crédito"} · à vista` : `Cartão ${$("#c-brand").textContent || "de crédito"} · ${parc}x de ${fmt(t.cardTotal / parc)}`);
});

/* ── PIX ── */
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function genPix() {
  const t = totals();
  const amount = t.total.toFixed(2);
  const key = "pagamentos@elan.com.br";
  const mai = `0014BR.GOV.BCB.PIX01${String(key.length).padStart(2, "0")}${key}`;
  const payload = `00020126${String(mai.length).padStart(2, "0")}${mai}52040000530398654${String(amount.length).padStart(2, "0")}${amount}5802BR5909ELAN MODA6013MONTES CLAROS62070503***6304`;
  const code = payload + crc16(payload);
  $("#pix-code").value = code;
  drawQR($("#pix-canvas"), code);
}
function seededRandom(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function drawQR(canvas, text) {
  const n = 29, cell = Math.floor(canvas.width / (n + 2));
  const ctx = canvas.getContext("2d");
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const rnd = seededRandom(h);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#171512";
  const off = Math.floor((canvas.width - cell * n) / 2);
  const inFinder = (x, y) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (inFinder(x, y)) continue;
    if (x === 6 || y === 6) { if ((x + y) % 2 === 0) ctx.fillRect(off + x * cell, off + y * cell, cell, cell); continue; }
    if (rnd() < 0.47) ctx.fillRect(off + x * cell, off + y * cell, cell, cell);
  }
  const finder = (fx, fy) => {
    ctx.fillRect(off + fx * cell, off + fy * cell, cell * 7, cell * 7);
    ctx.fillStyle = "#fff"; ctx.fillRect(off + (fx + 1) * cell, off + (fy + 1) * cell, cell * 5, cell * 5);
    ctx.fillStyle = "#171512"; ctx.fillRect(off + (fx + 2) * cell, off + (fy + 2) * cell, cell * 3, cell * 3);
  };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
}
$("#btn-copy-pix").addEventListener("click", () => copyText($("#pix-code").value, "Código PIX copiado ✓"));
$("#btn-pix-done").addEventListener("click", async () => {
  await processing("Verificando pagamento PIX…", 1600);
  finishOrder("pix", "PIX · aprovação imediata");
});

/* ── Boleto ── */
function genBoleto() {
  const rand = len => Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
  const t = totals();
  const amt = Math.round(t.cardTotal * 100).toString().padStart(10, "0");
  const digits = `34191${rand(10)}${rand(10)}${rand(10)}${amt}`.slice(0, 47);
  const code = `${digits.slice(0,5)}.${digits.slice(5,10)} ${digits.slice(10,15)}.${digits.slice(15,21)} ${digits.slice(21,26)}.${digits.slice(26,32)} ${digits.slice(32,33)} ${digits.slice(33)}`;
  state.boletoCode = code;
  $("#boleto-code").textContent = code;
  drawBarcode($("#boleto-canvas"), digits);
}
function drawBarcode(canvas, digits) {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#171512";
  let x = 12;
  const maxW = canvas.width - 24;
  const units = digits.split("").map(d => 1 + (d % 3));
  const unit = maxW / units.reduce((a, b) => a + b, 0);
  units.forEach((w, i) => {
    if (i % 2 === 0 || +digits[i] % 2 === 0) ctx.fillRect(x, 10, w * unit * 0.8, canvas.height - 20);
    x += w * unit;
  });
}
$("#btn-copy-boleto").addEventListener("click", () => copyText(state.boletoCode, "Linha digitável copiada ✓"));
$("#btn-boleto-done").addEventListener("click", async () => {
  await processing("Gerando boleto…", 1200);
  finishOrder("boleto", "Boleto bancário · vencimento em 3 dias úteis");
});

/* ── processamento simulado ── */
function processing(text, ms = 2000) {
  return new Promise(res => {
    $("#processing-text").textContent = text;
    $("#processing").hidden = false;
    setTimeout(() => { $("#processing").hidden = true; res(); }, ms);
  });
}

/* ── confirmação ── */
function finishOrder(method, methodLabel) {
  const orderNo = "EL" + Date.now().toString(36).toUpperCase().slice(-8);
  $("#confirm-order").textContent = orderNo;
  $("#confirm-method").textContent = methodLabel;
  const email = $("#f-email").value || "seu e-mail";
  $("#confirm-email-note").textContent = `Enviamos a confirmação e o rastreio para ${email}. Acompanhe também pelo WhatsApp.`;
  if (method === "boleto") {
    $("#confirm-title").textContent = "Pedido registrado!";
    $("#confirm-text").textContent = "Seu boleto foi gerado e enviado para o seu e-mail. O pedido será preparado assim que o pagamento for compensado.";
  } else {
    $("#confirm-title").textContent = "Pedido confirmado!";
    $("#confirm-text").textContent = "Pagamento aprovado com sucesso. Seu pedido já está em preparação e será enviado em até 24h úteis. 💛";
  }
  state.cart = []; saveCart();
  renderCart();
  goStep(4);
}
$("#btn-finish").addEventListener("click", () => { hideCheckout(); goStep(1); });

/* ═════════ COUNTDOWN ═════════ */
function tickCountdown() {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  let s = Math.max(0, Math.floor((end - now) / 1000));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  $("#bar-countdown").textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
}
tickCountdown();
setInterval(tickCountdown, 1000);

/* ═════════ NEWSLETTER ═════════ */
$("#news-form").addEventListener("submit", e => {
  e.preventDefault();
  const email = $("#news-email").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("Digite um e-mail válido", "err"); return; }
  localStorage.setItem("elan_news", "1");
  state.coupon = true; localStorage.setItem("elan_coupon", "1");
  $("#news-ok").hidden = false;
  $("#news-form").style.display = "none";
  updateAll();
  toast("🎉 Cupom BEMVINDA10 ativado na sua sacola!", "ok");
});
if (localStorage.getItem("elan_news") === "1") {
  $("#news-ok").hidden = false;
  $("#news-form").style.display = "none";
}

/* ═════════ PROVA SOCIAL ═════════ */
let spIdx = 0;
function showSocialProof() {
  if (!checkoutEl.hidden || !$("#qv-overlay").hidden) return;
  const ev = SOCIAL_PROOF[spIdx % SOCIAL_PROOF.length]; spIdx++;
  const p = productById(ev.product);
  if (!p) return;
  $("#sp-img").src = p.img;
  $("#sp-name").textContent = ev.name;
  $("#sp-detail").textContent = `comprou ${p.name}`;
  $("#sp-time").textContent = ev.time + " · ✓ compra verificada";
  const el = $("#social-proof");
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 6500);
}
$("#sp-close").addEventListener("click", () => { $("#social-proof").hidden = true; });
setTimeout(showSocialProof, 9000);
setInterval(showSocialProof, 16000);

/* ═════════ TECLADO ═════════ */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("#processing").hidden) return;
  if (!$("#qv-overlay").hidden) { closeQuickView(); return; }
  if (drawer.classList.contains("open")) { closeDrawer(); return; }
  if (!checkoutEl.hidden) { hideCheckout(); }
});

/* ═════════ INIT ═════════ */
renderProducts();
updateAll();
})();
