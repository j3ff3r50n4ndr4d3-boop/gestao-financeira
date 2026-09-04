'use strict';

/* =============================================================== estado === */

const estado = {
  catalogos: { motivosParada: [], seisPerdas: [], setores: [], metas: {} },
  turnos: [],
  maquinas: [],
  modelos: [],
  dashboard: null,
  apontamentos: [],
  editandoApontamento: null,
  serieVisivel: { oee: true, disponibilidade: false, desempenho: false, qualidade: false },
};

const CORES = {
  oee: '#0f766e',
  disponibilidade: '#2563eb',
  desempenho: '#7c3aed',
  qualidade: '#16a34a',
  ok: '#16a34a',
  atencao: '#f59e0b',
  critico: '#dc2626',
  roxo: '#7c3aed',
};

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/* ============================================================= formatação == */

const fmtPct = (v, casas = 1) =>
  `${Number.isFinite(v) ? v.toFixed(casas).replace('.', ',') : '0,0'}%`;

const fmtNum = (v, casas = 0) =>
  Number.isFinite(v)
    ? v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
    : '0';

const fmtBRL = (v) =>
  `R$ ${Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}`;

function fmtMinutos(min) {
  if (!Number.isFinite(min) || min <= 0) return '0 min';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

const fmtDataCurta = (iso) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}`;
};
const fmtDataLonga = (iso) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

function escapar(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function pilula(valor, meta, rotulo) {
  const classe = valor >= meta ? 'ok' : valor >= meta * 0.75 ? 'atencao' : 'critico';
  return `<span class="pilula ${classe}">${rotulo ?? fmtPct(valor)}</span>`;
}

function barraMini(valor, max = 100) {
  const cor = valor >= max ? CORES.ok : valor >= max * 0.75 ? CORES.atencao : CORES.critico;
  const largura = Math.max(2, Math.min(100, (valor / max) * 100));
  return `<span class="barra-mini"><span style="width:${largura}%;background:${cor}"></span></span>`;
}

/* ================================================================== avisos == */

let timerAviso = null;
function avisar(mensagem, tipo = '') {
  const el = $('#aviso');
  el.textContent = mensagem;
  el.className = `aviso visivel ${tipo}`;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => { el.className = 'aviso'; }, 3600);
}

/* ===================================================================== API == */

async function api(caminho, opcoes = {}) {
  const res = await fetch(caminho, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(dados.erro || `Erro ${res.status}`);
  return dados;
}

/* ============================================================== carregamento == */

async function carregarCadastros() {
  const [catalogos, turnos, maquinas, modelos] = await Promise.all([
    api('/api/catalogos'), api('/api/turnos'), api('/api/maquinas'), api('/api/modelos'),
  ]);
  estado.catalogos = catalogos;
  estado.turnos = turnos;
  estado.maquinas = maquinas;
  estado.modelos = modelos;

  $('#nome-fabrica').textContent = catalogos.metas.nomeFabrica;
  popularFiltroLinha();
  popularSelectsFormulario();
  preencherFormMetas();
}

function popularFiltroLinha() {
  const sel = $('#filtro-linha');
  const atual = sel.value;
  sel.innerHTML = '<option value="">Todas as linhas</option>' +
    estado.maquinas.map((m) => `<option value="${m.id}">${escapar(m.nome)}</option>`).join('');
  if (atual && estado.maquinas.some((m) => String(m.id) === atual)) sel.value = atual;
}

function popularSelectsFormulario() {
  const selMaq = $('#ap-maquina');
  selMaq.innerHTML = estado.maquinas.map((m) =>
    `<option value="${m.id}">${escapar(m.nome)} · ${m.operadores} op.</option>`).join('');

  $('#ap-turno').innerHTML = estado.turnos.map((t) =>
    `<option value="${t.id}">${escapar(t.nome)} (${t.hora_inicio}–${t.hora_fim})</option>`).join('');

  $('#ap-modelo').innerHTML = '<option value="">— sem modelo —</option>' +
    estado.modelos.map((m) =>
      `<option value="${m.id}">${escapar(m.codigo)} · ${escapar(m.nome)} (SAM ${m.sam_min} min)</option>`).join('');

  $('#lista-setores').innerHTML = estado.catalogos.setores
    .map((s) => `<option value="${escapar(s)}"></option>`).join('');
}

async function carregarPainel() {
  const params = new URLSearchParams();
  if ($('#filtro-de').value) params.set('de', $('#filtro-de').value);
  if ($('#filtro-ate').value) params.set('ate', $('#filtro-ate').value);
  if ($('#filtro-linha').value) params.set('maquinaId', $('#filtro-linha').value);
  const query = params.toString();

  const [dash, lista] = await Promise.all([
    api(`/api/dashboard${query ? '?' + query : ''}`),
    api(`/api/apontamentos${query ? '?' + query : ''}&limite=400`),
  ]);
  estado.dashboard = dash;
  estado.apontamentos = lista.itens;

  renderPainel(dash);
  renderApontamentos();
}

/* =================================================================== painel == */

function renderPainel(d) {
  if (!d) return;
  const m = d.metas;
  const g = d.geral;

  // ---- medidores ----
  const defs = [
    { rotulo: 'OEE', valor: g.oeePct, meta: m.metaOee * 100, legenda: `${g.apontamentos} apontamentos` },
    { rotulo: 'Disponibilidade', valor: g.disponibilidadePct, meta: m.metaDisponibilidade * 100, legenda: `${fmtMinutos(g.paradasNaoPlanejadas)} de parada` },
    { rotulo: 'Desempenho', valor: g.desempenhoPct, meta: m.metaDesempenho * 100, legenda: 'ritmo vs. SAM' },
    { rotulo: 'Qualidade', valor: g.qualidadePct, meta: m.metaQualidade * 100, legenda: `${fmtNum(g.pecasDefeito)} peças refugadas` },
  ];
  const contMedidores = $('#medidores');
  contMedidores.innerHTML = defs.map((_, i) => '<div class="medidor" data-medidor="' + i + '"></div>').join('');
  defs.forEach((def, i) => {
    Graficos.gauge($(`[data-medidor="${i}"]`, contMedidores), def);
  });

  // ---- KPIs ----
  $('#kpis').innerHTML = [
    { rotulo: 'Peças produzidas', valor: fmtNum(g.pecasProduzidas), nota: `${fmtNum(g.pecasBoas)} peças boas`, negativo: false },
    { rotulo: 'Refugo', valor: fmtPct(g.taxaDefeitosPct, 2), nota: `meta ≤ ${fmtPct(m.metaDefeitosPct, 1)}`, negativo: g.taxaDefeitosPct > m.metaDefeitosPct },
    { rotulo: 'Produtividade', valor: `${fmtNum(g.producaoHora, 1)} pç/h`, nota: 'por hora de operação', negativo: false },
    { rotulo: 'Paradas não planejadas', valor: fmtMinutos(g.paradasNaoPlanejadas), nota: `de ${fmtMinutos(g.tempoPlanejado)} planejados`, negativo: g.disponibilidadePct < m.metaDisponibilidade * 100 },
    { rotulo: 'Custo da perda', valor: fmtBRL(g.custoPerdaTotal), nota: 'indisponibilidade + ritmo + refugo', negativo: true },
    { rotulo: 'Desvio da meta', valor: `${g.gapMeta >= 0 ? '+' : ''}${fmtPct(g.gapMeta, 1)}`, nota: `meta ${fmtPct(m.metaOee * 100, 0)}`, negativo: g.gapMeta < 0 },
  ].map((k) => `
    <div class="kpi ${k.negativo ? 'negativo' : ''}">
      <div class="kpi-rotulo">${k.rotulo}</div>
      <div class="kpi-valor">${k.valor}</div>
      <div class="kpi-nota">${k.nota}</div>
    </div>`).join('');

  if (g.desempenhoPct > 100.5) {
    avisar(`Desempenho de ${fmtPct(g.desempenhoPct)} acima do padrão: revise o SAM cadastrado.`, '');
  }

  renderTendencia(d);
  Graficos.pareto($('#grafico-pareto'), {
    itens: d.paretoParadas.map((p) => ({ rotulo: p.rotulo, valor: p.minutos })),
    unidade: 'min',
  });

  Graficos.barraEmpilhada($('#grafico-perdas'), {
    itens: d.perdasPorGrupo.map((p) => ({
      rotulo: p.rotulo,
      valor: p.minutos,
      cor: p.codigo === 'DISPONIBILIDADE' ? CORES.critico : p.codigo === 'DESEMPENHO' ? CORES.atencao : CORES.roxo,
    })),
    unidade: 'min',
  });

  renderSeisPerdas(d.seisPerdas);
  renderRanking(d.ranking);
  renderModelosDesempenho(d.modelos);
}

function renderTendencia(d) {
  const cores = {
    oee: CORES.oee, disponibilidade: CORES.disponibilidade,
    desempenho: CORES.desempenho, qualidade: CORES.qualidade,
  };
  const chaves = ['oee', 'disponibilidade', 'desempenho', 'qualidade'].filter((k) => estado.serieVisivel[k]);
  const mapa = {
    oee: 'oeePct', disponibilidade: 'disponibilidadePct',
    desempenho: 'desempenhoPct', qualidade: 'qualidadePct',
  };
  const nomes = { oee: 'OEE', disponibilidade: 'Disponibilidade', desempenho: 'Desempenho', qualidade: 'Qualidade' };

  Graficos.lineChart($('#grafico-tendencia'), {
    labels: d.tendencia.map((t) => fmtDataCurta(t.data)),
    series: chaves.map((k) => ({
      nome: nomes[k],
      valores: d.tendencia.map((t) => t[mapa[k]]),
      cor: cores[k],
      tracejado: k !== 'oee',
    })),
    meta: estado.serieVisivel.oee ? d.metas.metaOee * 100 : undefined,
    altura: 300,
  });
}

function renderSeisPerdas(seis) {
  const cont = $('#seis-perdas');
  const itens = (seis || []).filter((p) => p.minutos > 0);
  if (itens.length === 0) {
    cont.innerHTML = '<p class="dica">Nenhuma perda registrada no período.</p>';
    return;
  }
  const max = Math.max(...itens.map((i) => i.minutos));
  cont.innerHTML = `<div class="seis-perdas-lista">` + itens.map((p) => {
    const cor = p.origem === 'DISPONIBILIDADE' ? CORES.critico
      : p.origem === 'DESEMPENHO' ? CORES.atencao
      : p.origem === 'QUALIDADE' ? '#7c3aed' : '#94a3b8';
    return `
      <div class="seis-perdas-item">
        <span class="nome">${escapar(p.rotulo)} <small>· ${escapar(p.origem.toLowerCase())}</small></span>
        <span class="qtd">${fmtMinutos(p.minutos)}</span>
        <span class="trilha"><span style="width:${((p.minutos / max) * 100).toFixed(1)}%;background:${cor}"></span></span>
      </div>`;
  }).join('') + `</div>`;
}

function renderRanking(ranking) {
  const tbody = $('#tabela-ranking tbody');
  if (!ranking.length) {
    tbody.innerHTML = '<tr><td class="vazio-linha" colspan="12">Sem dados no período selecionado</td></tr>';
    return;
  }
  tbody.innerHTML = ranking.map((r) => {
    const situacao = r.oeePct >= r.metaOee * 100 ? '<span class="pilula ok">Meta atingida</span>'
      : r.oeePct >= r.metaOee * 75 ? '<span class="pilula atencao">Abaixo da meta</span>'
      : '<span class="pilula critico">Crítico</span>';
    return `<tr>
      <td><strong>${escapar(r.maquina)}</strong></td>
      <td>${escapar(r.setor)}</td>
      <td class="num"><strong>${fmtPct(r.oeePct)}</strong> ${barraMini(r.oeePct)}</td>
      <td class="num">${fmtPct(r.disponibilidadePct)}</td>
      <td class="num">${fmtPct(r.desempenhoPct)}</td>
      <td class="num">${fmtPct(r.qualidadePct)}</td>
      <td class="num">${fmtNum(r.pecasProduzidas)}</td>
      <td class="num">${fmtPct(r.taxaDefeitosPct, 2)}</td>
      <td class="num">${fmtNum(r.producaoHora, 1)}</td>
      <td class="num">${fmtMinutos(r.paradasNaoPlanejadas)}</td>
      <td class="num">${fmtBRL(r.custoPerdaTotal)}</td>
      <td>${situacao}</td>
    </tr>`;
  }).join('');
}

function renderModelosDesempenho(modelos) {
  const tbody = $('#tabela-modelos-desempenho tbody');
  if (!modelos.length) {
    tbody.innerHTML = '<tr><td class="vazio-linha" colspan="8">Sem dados no período selecionado</td></tr>';
    return;
  }
  tbody.innerHTML = modelos.map((m) => `<tr>
    <td><strong>${escapar(m.modeloCodigo)}</strong></td>
    <td>${escapar(m.modeloNome)}</td>
    <td>${escapar(m.categoria || '—')}</td>
    <td class="num">${fmtNum(m.pecasProduzidas)}</td>
    <td class="num">${fmtPct(m.taxaDefeitosPct, 2)}</td>
    <td class="num">${fmtNum(m.producaoHora, 1)}</td>
    <td class="num">${fmtPct(m.desempenhoPct)}</td>
    <td class="num">${fmtPct(m.oeePct)}</td>
  </tr>`).join('');
}

/* =========================================================== apontamentos == */

function renderApontamentos() {
  const tbody = $('#tabela-apontamentos tbody');
  $('#contador-apontamentos').textContent = `${estado.apontamentos.length} registros no período`;

  if (!estado.apontamentos.length) {
    tbody.innerHTML = '<tr><td class="vazio-linha" colspan="12">Nenhum apontamento no período. Registre o primeiro acima.</td></tr>';
    return;
  }
  tbody.innerHTML = estado.apontamentos.map((a) => {
    const i = a.indicadores;
    return `<tr>
      <td>${fmtDataLonga(a.data)}</td>
      <td>${escapar(a.maquina)}</td>
      <td>${escapar(a.turno)}</td>
      <td>${escapar(a.modeloNome || '—')}</td>
      <td class="num">${fmtNum(a.pecasProduzidas)}</td>
      <td class="num">${fmtNum(a.pecasDefeito)}</td>
      <td class="num">${fmtPct(i.disponibilidadePct)}</td>
      <td class="num">${fmtPct(i.desempenhoPct)}${i.desempenhoAcimaDoPadrao ? ' ⚠' : ''}</td>
      <td class="num">${fmtPct(i.qualidadePct)}</td>
      <td class="num">${pilula(i.oeePct, 85)}</td>
      <td class="num">${fmtNum(i.producaoHora, 1)}</td>
      <td>
        <button class="btn btn-secundario btn-mini" data-editar-ap="${a.id}">Editar</button>
        <button class="btn btn-perigo btn-mini" data-excluir-ap="${a.id}">Excluir</button>
      </td>
    </tr>`;
  }).join('');
}

function opcoesMotivos() {
  const porCategoria = { PLANEJADA: [], NAO_PLANEJADA: [] };
  for (const m of estado.catalogos.motivosParada) {
    (porCategoria[m.categoria] || porCategoria.NAO_PLANEJADA).push(m);
  }
  return `
    <optgroup label="Não planejadas (penalizam disponibilidade)">
      ${porCategoria.NAO_PLANEJADA.map((m) => `<option value="${m.codigo}">${escapar(m.rotulo)}</option>`).join('')}
    </optgroup>
    <optgroup label="Planejadas (não penalizam disponibilidade)">
      ${porCategoria.PLANEJADA.map((m) => `<option value="${m.codigo}">${escapar(m.rotulo)}</option>`).join('')}
    </optgroup>`;
}

function adicionarLinhaParada(dados = {}) {
  const div = document.createElement('div');
  div.className = 'linha-parada';
  div.innerHTML = `
    <select class="par-motivo">${opcoesMotivos()}</select>
    <input type="number" class="par-minutos min-parada" min="1" step="1" value="${dados.minutos ?? 15}" aria-label="Minutos">
    <input type="text" class="par-descricao" placeholder="Descrição (opcional)" value="${escapar(dados.descricao || '')}" maxlength="300">
    <button type="button" class="btn btn-perigo btn-mini" title="Remover parada">✕</button>`;
  div.querySelector('.par-motivo').value = dados.motivo || 'QUEBRA';
  div.querySelector('button').addEventListener('click', () => { div.remove(); atualizarResumoParadas(); });
  div.querySelectorAll('input, select').forEach((inp) => inp.addEventListener('input', atualizarResumoParadas));
  $('#lista-paradas').appendChild(div);
  atualizarResumoParadas();
}

function lerParadas() {
  return $$('#lista-paradas .linha-parada').map((linha) => ({
    motivo: $('.par-motivo', linha).value,
    minutos: parseFloat($('.par-minutos', linha).value) || 0,
    descricao: $('.par-descricao', linha).value.trim(),
  })).filter((p) => p.minutos > 0);
}

function atualizarResumoParadas() {
  const paradas = lerParadas();
  const total = paradas.reduce((s, p) => s + p.minutos, 0);
  const catalogadas = new Map(estado.catalogos.motivosParada.map((m) => [m.codigo, m]));
  const planejadas = paradas
    .filter((p) => catalogadas.get(p.motivo)?.categoria === 'PLANEJADA')
    .reduce((s, p) => s + p.minutos, 0);
  $('#resumo-paradas').textContent =
    `${fmtMinutos(total)} no total · ${fmtMinutos(total - planejadas)} não planejadas` +
    (planejadas > 0 ? ` · ${fmtMinutos(planejadas)} planejadas` : '');
}

function limparFormApontamento() {
  $('#form-apontamento').reset();
  $('#ap-id').value = '';
  $('#ap-data').value = hoje();
  $('#lista-paradas').innerHTML = '';
  estado.editandoApontamento = null;
  atualizarResumoParadas();
}

function preencherFormApontamento(a) {
  estado.editandoApontamento = a.id;
  $('#ap-id').value = a.id;
  $('#ap-data').value = a.data;
  $('#ap-maquina').value = a.maquinaId;
  $('#ap-turno').value = a.turnoId;
  $('#ap-modelo').value = a.modeloId || '';
  $('#ap-lider').value = a.lider || '';
  $('#ap-pecas').value = a.pecasProduzidas;
  $('#ap-defeito').value = a.pecasDefeito;
  $('#ap-retrabalho').value = a.pecasRetrabalho;
  $('#ap-observacao').value = a.observacao || '';
  $('#lista-paradas').innerHTML = '';
  for (const p of a.paradas) adicionarLinhaParada(p);
  atualizarResumoParadas();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function dadosDoFormApontamento() {
  return {
    data: $('#ap-data').value,
    maquina_id: parseInt($('#ap-maquina').value, 10),
    turno_id: parseInt($('#ap-turno').value, 10),
    modelo_id: $('#ap-modelo').value ? parseInt($('#ap-modelo').value, 10) : null,
    lider: $('#ap-lider').value.trim(),
    pecas_produzidas: parseInt($('#ap-pecas').value || '0', 10),
    pecas_defeito: parseInt($('#ap-defeito').value || '0', 10),
    pecas_retrabalho: parseInt($('#ap-retrabalho').value || '0', 10),
    observacao: $('#ap-observacao').value.trim(),
    paradas: lerParadas(),
  };
}

async function salvarApontamento(evento) {
  evento.preventDefault();
  const dados = dadosDoFormApontamento();
  try {
    if (estado.editandoApontamento) {
      await api(`/api/apontamentos/${estado.editandoApontamento}`, { method: 'PUT', body: dados });
      avisar('Apontamento atualizado.', 'sucesso');
    } else {
      await api('/api/apontamentos', { method: 'POST', body: dados });
      avisar('Apontamento registrado.', 'sucesso');
    }
    limparFormApontamento();
    await carregarPainel();
  } catch (e) {
    avisar(e.message, 'erro');
  }
}

async function excluirApontamento(id) {
  if (!confirm('Excluir este apontamento?')) return;
  try {
    await api(`/api/apontamentos/${id}`, { method: 'DELETE' });
    avisar('Apontamento excluído.', 'sucesso');
    await carregarPainel();
  } catch (e) {
    avisar(e.message, 'erro');
  }
}

async function simularOEE() {
  try {
    const r = await api('/api/simular', { method: 'POST', body: dadosDoFormApontamento() });
    const i = r.indicadores;
    $('#corpo-simulacao').innerHTML = `
      <p class="dica">${escapar(r.linha)} · ${escapar(r.turno)} · ${escapar(r.modelo || 'sem modelo')}</p>
      <div class="simulacao-grade">
        <div class="simulacao-item"><div class="rotulo">OEE</div><div class="valor" style="color:${Graficos.corPorMeta(i.oeePct, 85)}">${fmtPct(i.oeePct)}</div></div>
        <div class="simulacao-item"><div class="rotulo">Disponibilidade</div><div class="valor">${fmtPct(i.disponibilidadePct)}</div></div>
        <div class="simulacao-item"><div class="rotulo">Desempenho</div><div class="valor">${fmtPct(i.desempenhoPct)}</div></div>
        <div class="simulacao-item"><div class="rotulo">Qualidade</div><div class="valor">${fmtPct(i.qualidadePct)}</div></div>
      </div>
      <table class="tabela tabela-compacta">
        <tbody>
          <tr><td>Tempo planejado</td><td class="num">${fmtMinutos(i.tempoPlanejado)}</td></tr>
          <tr><td>Paradas não planejadas</td><td class="num">${fmtMinutos(i.paradasNaoPlanejadas)}</td></tr>
          <tr><td>Tempo de operação</td><td class="num">${fmtMinutos(i.tempoOperacao)}</td></tr>
          <tr><td>Tempo ciclo ideal</td><td class="num">${fmtNum(i.tempoCicloIdealMin, 2)} min/peça</td></tr>
          <tr><td>Peças teóricas no tempo de operação</td><td class="num">${fmtNum(i.pecasTeoricas, 1)}</td></tr>
          <tr><td>Peças produzidas</td><td class="num">${fmtNum(i.pecasProduzidas)}</td></tr>
          <tr><td>Capacidade do tempo planejado</td><td class="num">${fmtNum(i.pecasTeoricasPlanejadas, 1)} peças</td></tr>
          <tr><td>Peças perdidas (parada + ritmo + refugo)</td><td class="num">${fmtNum(i.pecasPerdidasTotal, 1)}</td></tr>
          <tr><td>Custo da perda</td><td class="num">${fmtBRL(i.custoPerdaTotal)}</td></tr>
        </tbody>
      </table>
      ${i.desempenhoAcimaDoPadrao ? '<p class="dica" style="color:var(--atencao)">⚠ Desempenho acima de 100%: o SAM cadastrado provavelmente está defasado.</p>' : ''}`;
    $('#modal-simulacao').hidden = false;
  } catch (e) {
    avisar(e.message, 'erro');
  }
}

/* ================================================================== cadastros == */

function renderMaquinas() {
  const tbody = $('#tabela-maquinas tbody');
  if (!estado.maquinas.length) {
    tbody.innerHTML = '<tr><td class="vazio-linha" colspan="7">Nenhuma linha cadastrada</td></tr>';
    return;
  }
  tbody.innerHTML = estado.maquinas.map((m) => `<tr>
    <td><strong>${escapar(m.nome)}</strong></td>
    <td>${escapar(m.setor)}</td>
    <td>${escapar(m.tipo || '—')}</td>
    <td class="num">${m.operadores}</td>
    <td class="num">${fmtBRL(m.custo_hora)}</td>
    <td class="num">${fmtPct(m.meta_oee * 100, 0)}</td>
    <td>
      <button class="btn btn-secundario btn-mini" data-editar-mq="${m.id}">Editar</button>
      <button class="btn btn-perigo btn-mini" data-excluir-mq="${m.id}">Excluir</button>
    </td>
  </tr>`).join('');
}

function preencherFormMaquina(m) {
  $('#mq-id').value = m ? m.id : '';
  $('#mq-nome').value = m ? m.nome : '';
  $('#mq-setor').value = m ? m.setor : '';
  $('#mq-tipo').value = m ? m.tipo : '';
  $('#mq-operadores').value = m ? m.operadores : 1;
  $('#mq-custo').value = m ? m.custo_hora : 0;
  $('#mq-meta').value = m ? Math.round(m.meta_oee * 100) : 85;
  $('#mq-obs').value = m ? m.observacao : '';
}

async function salvarMaquina(evento) {
  evento.preventDefault();
  const id = $('#mq-id').value;
  const corpo = {
    nome: $('#mq-nome').value.trim(),
    setor: $('#mq-setor').value.trim(),
    tipo: $('#mq-tipo').value.trim(),
    operadores: parseInt($('#mq-operadores').value || '1', 10),
    custo_hora: parseFloat($('#mq-custo').value || '0'),
    meta_oee: (parseFloat($('#mq-meta').value || '85') || 85) / 100,
    observacao: $('#mq-obs').value.trim(),
  };
  try {
    if (id) await api(`/api/maquinas/${id}`, { method: 'PUT', body: corpo });
    else await api('/api/maquinas', { method: 'POST', body: corpo });
    avisar('Linha salva.', 'sucesso');
    preencherFormMaquina(null);
    await carregarCadastros();
    renderMaquinas();
    await carregarPainel();
  } catch (e) {
    avisar(e.message, 'erro');
  }
}

function renderModelos() {
  const tbody = $('#tabela-modelos tbody');
  if (!estado.modelos.length) {
    tbody.innerHTML = '<tr><td class="vazio-linha" colspan="6">Nenhum modelo cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = estado.modelos.map((m) => `<tr>
    <td><strong>${escapar(m.codigo)}</strong></td>
    <td>${escapar(m.nome)}</td>
    <td>${escapar(m.categoria || '—')}</td>
    <td class="num">${fmtNum(m.sam_min, 1)}</td>
    <td class="num">${fmtBRL(m.preco_venda)}</td>
    <td>
      <button class="btn btn-secundario btn-mini" data-editar-md="${m.id}">Editar</button>
      <button class="btn btn-perigo btn-mini" data-excluir-md="${m.id}">Excluir</button>
    </td>
  </tr>`).join('');
}

function preencherFormModelo(m) {
  $('#md-id').value = m ? m.id : '';
  $('#md-codigo').value = m ? m.codigo : '';
  $('#md-nome').value = m ? m.nome : '';
  $('#md-categoria').value = m ? m.categoria : '';
  $('#md-sam').value = m ? m.sam_min : 10;
  $('#md-preco').value = m ? m.preco_venda : 0;
}

async function salvarModelo(evento) {
  evento.preventDefault();
  const id = $('#md-id').value;
  const corpo = {
    codigo: $('#md-codigo').value.trim(),
    nome: $('#md-nome').value.trim(),
    categoria: $('#md-categoria').value.trim(),
    sam_min: parseFloat($('#md-sam').value || '0'),
    preco_venda: parseFloat($('#md-preco').value || '0'),
  };
  try {
    if (id) await api(`/api/modelos/${id}`, { method: 'PUT', body: corpo });
    else await api('/api/modelos', { method: 'POST', body: corpo });
    avisar('Modelo salvo.', 'sucesso');
    preencherFormModelo(null);
    await carregarCadastros();
    renderModelos();
    await carregarPainel();
  } catch (e) {
    avisar(e.message, 'erro');
  }
}

function renderTurnos() {
  const tbody = $('#tabela-turnos tbody');
  if (!estado.turnos.length) {
    tbody.innerHTML = '<tr><td class="vazio-linha" colspan="7">Nenhum turno cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = estado.turnos.map((t) => `<tr>
    <td><strong>${escapar(t.nome)}</strong></td>
    <td>${t.hora_inicio}</td>
    <td>${t.hora_fim}</td>
    <td class="num">${fmtMinutos(t.minutos_totais)}</td>
    <td class="num">${fmtMinutos(t.pausas_planejadas)}</td>
    <td class="num"><strong>${fmtMinutos(t.minutos_totais - t.pausas_planejadas)}</strong></td>
    <td>
      <button class="btn btn-secundario btn-mini" data-editar-tn="${t.id}">Editar</button>
      <button class="btn btn-perigo btn-mini" data-excluir-tn="${t.id}">Excluir</button>
    </td>
  </tr>`).join('');
}

function preencherFormTurno(t) {
  $('#tn-id').value = t ? t.id : '';
  $('#tn-nome').value = t ? t.nome : '';
  $('#tn-inicio').value = t ? t.hora_inicio : '07:00';
  $('#tn-fim').value = t ? t.hora_fim : '16:00';
  $('#tn-minutos').value = t ? t.minutos_totais : '';
  $('#tn-pausas').value = t ? t.pausas_planejadas : 60;
}

async function salvarTurno(evento) {
  evento.preventDefault();
  const id = $('#tn-id').value;
  const corpo = {
    nome: $('#tn-nome').value.trim(),
    hora_inicio: $('#tn-inicio').value,
    hora_fim: $('#tn-fim').value,
    pausas_planejadas: parseInt($('#tn-pausas').value || '0', 10),
  };
  const minutos = parseInt($('#tn-minutos').value || '0', 10);
  if (minutos > 0) corpo.minutos_totais = minutos;
  try {
    if (id) await api(`/api/turnos/${id}`, { method: 'PUT', body: corpo });
    else await api('/api/turnos', { method: 'POST', body: corpo });
    avisar('Turno salvo.', 'sucesso');
    preencherFormTurno(null);
    await carregarCadastros();
    renderTurnos();
    await carregarPainel();
  } catch (e) {
    avisar(e.message, 'erro');
  }
}

function preencherFormMetas() {
  const m = estado.catalogos.metas;
  $('#cfg-fabrica').value = m.nomeFabrica || '';
  $('#cfg-oee').value = Math.round(m.metaOee * 100);
  $('#cfg-disp').value = Math.round(m.metaDisponibilidade * 100);
  $('#cfg-desemp').value = Math.round(m.metaDesempenho * 100);
  $('#cfg-qual').value = Math.round(m.metaQualidade * 100);
}

async function salvarMetas(evento) {
  evento.preventDefault();
  try {
    await api('/api/metas', {
      method: 'PUT',
      body: {
        nomeFabrica: $('#cfg-fabrica').value.trim(),
        metaOee: (parseFloat($('#cfg-oee').value) || 85) / 100,
        metaDisponibilidade: (parseFloat($('#cfg-disp').value) || 90) / 100,
        metaDesempenho: (parseFloat($('#cfg-desemp').value) || 95) / 100,
        metaQualidade: (parseFloat($('#cfg-qual').value) || 99) / 100,
      },
    });
    avisar('Metas salvas.', 'sucesso');
    await carregarCadastros();
    await carregarPainel();
  } catch (e) {
    avisar(e.message, 'erro');
  }
}

/* ================================================================ eventos == */

function trocarAba(nome) {
  $$('.aba').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === nome));
  $$('.painel').forEach((p) => p.classList.toggle('ativa', p.id === `view-${nome}`));
  if (nome === 'linhas') renderMaquinas();
  if (nome === 'modelos') renderModelos();
  if (nome === 'turnos') renderTurnos();
}

function aplicarPeriodo(dias) {
  $('#filtro-de').value = diasAtras(dias - 1);
  $('#filtro-ate').value = hoje();
  recarregar();
}

async function recarregar() {
  const btn = $('#btn-atualizar');
  btn.disabled = true;
  try {
    await carregarPainel();
  } catch (e) {
    avisar(e.message, 'erro');
  } finally {
    btn.disabled = false;
  }
}

function ligarEventos() {
  $$('.aba').forEach((b) => b.addEventListener('click', () => trocarAba(b.dataset.aba)));

  $$('.atalhos-periodo button').forEach((b) =>
    b.addEventListener('click', () => aplicarPeriodo(parseInt(b.dataset.periodo, 10))));

  $('#btn-atualizar').addEventListener('click', recarregar);
  $('#filtro-de').addEventListener('change', recarregar);
  $('#filtro-ate').addEventListener('change', recarregar);
  $('#filtro-linha').addEventListener('change', recarregar);

  $$('#alternar-series input').forEach((inp) =>
    inp.addEventListener('change', () => {
      estado.serieVisivel[inp.dataset.serie] = inp.checked;
      renderTendencia(estado.dashboard);
    }));

  // ---- apontamentos ----
  $('#form-apontamento').addEventListener('submit', salvarApontamento);
  $('#btn-add-parada').addEventListener('click', () => adicionarLinhaParada());
  $('#btn-cancelar-apontamento').addEventListener('click', limparFormApontamento);
  $('#btn-novo-apontamento').addEventListener('click', limparFormApontamento);
  $('#btn-simular').addEventListener('click', simularOEE);
  $('#fechar-simulacao').addEventListener('click', () => { $('#modal-simulacao').hidden = true; });
  $('#modal-simulacao').addEventListener('click', (e) => {
    if (e.target.id === 'modal-simulacao') $('#modal-simulacao').hidden = true;
  });

  $('#btn-exportar-csv').addEventListener('click', () => {
    const p = new URLSearchParams();
    if ($('#filtro-de').value) p.set('de', $('#filtro-de').value);
    if ($('#filtro-ate').value) p.set('ate', $('#filtro-ate').value);
    if ($('#filtro-linha').value) p.set('maquinaId', $('#filtro-linha').value);
    window.location.href = `/api/export/apontamentos.csv?${p.toString()}`;
  });

  $('#tabela-apontamentos').addEventListener('click', (e) => {
    const editar = e.target.closest('[data-editar-ap]');
    const excluir = e.target.closest('[data-excluir-ap]');
    if (editar) {
      const item = estado.apontamentos.find((a) => String(a.id) === editar.dataset.editarAp);
      if (item) preencherFormApontamento(item);
    }
    if (excluir) excluirApontamento(parseInt(excluir.dataset.excluirAp, 10));
  });

  // ---- linhas ----
  $('#form-maquina').addEventListener('submit', salvarMaquina);
  $('#btn-cancelar-maquina').addEventListener('click', () => preencherFormMaquina(null));
  $('#tabela-maquinas').addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar-mq]');
    const excluir = e.target.closest('[data-excluir-mq]');
    if (editar) preencherFormMaquina(estado.maquinas.find((m) => String(m.id) === editar.dataset.editarMq));
    if (excluir && confirm('Excluir esta linha?')) {
      try {
        await api(`/api/maquinas/${excluir.dataset.excluirMq}`, { method: 'DELETE' });
        avisar('Linha excluída.', 'sucesso');
        await carregarCadastros();
        renderMaquinas();
        await carregarPainel();
      } catch (err) { avisar(err.message, 'erro'); }
    }
  });

  // ---- modelos ----
  $('#form-modelo').addEventListener('submit', salvarModelo);
  $('#btn-cancelar-modelo').addEventListener('click', () => preencherFormModelo(null));
  $('#tabela-modelos').addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar-md]');
    const excluir = e.target.closest('[data-excluir-md]');
    if (editar) preencherFormModelo(estado.modelos.find((m) => String(m.id) === editar.dataset.editarMd));
    if (excluir && confirm('Excluir este modelo?')) {
      try {
        await api(`/api/modelos/${excluir.dataset.excluirMd}`, { method: 'DELETE' });
        avisar('Modelo excluído.', 'sucesso');
        await carregarCadastros();
        renderModelos();
        await carregarPainel();
      } catch (err) { avisar(err.message, 'erro'); }
    }
  });

  // ---- turnos ----
  $('#form-turno').addEventListener('submit', salvarTurno);
  $('#btn-cancelar-turno').addEventListener('click', () => preencherFormTurno(null));
  $('#tabela-turnos').addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar-tn]');
    const excluir = e.target.closest('[data-excluir-tn]');
    if (editar) preencherFormTurno(estado.turnos.find((t) => String(t.id) === editar.dataset.editarTn));
    if (excluir && confirm('Excluir este turno?')) {
      try {
        await api(`/api/turnos/${excluir.dataset.excluirTn}`, { method: 'DELETE' });
        avisar('Turno excluído.', 'sucesso');
        await carregarCadastros();
        renderTurnos();
        await carregarPainel();
      } catch (err) { avisar(err.message, 'erro'); }
    }
  });

  $('#form-metas').addEventListener('submit', salvarMetas);
}

/* ==================================================================== boot == */

async function iniciar() {
  ligarEventos();
  $('#filtro-de').value = diasAtras(29);
  $('#filtro-ate').value = hoje();
  $('#ap-data').value = hoje();
  atualizarResumoParadas();

  try {
    await carregarCadastros();
    await carregarPainel();
  } catch (e) {
    avisar(`Falha ao carregar: ${e.message}`, 'erro');
  }
}

iniciar();
