'use strict';

/* =============================================================== estado === */

const estado = {
  catalogos: { motivosParada: [], seisPerdas: [], setores: [], metas: {} },
  turnos: [],
  maquinas: [],
  modelos: [],
  dashboard: null,
  apontamentos: [],
  equipes: [],
  operadores: [],
  sequencia: null,
  cronometragens: [],
  balancos: [],
  acompanhamento: null,
  balanceamentoAtual: null,
  granularidade: 'dia',
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
  const [catalogos, turnos, maquinas, modelos, equipes, operadores] = await Promise.all([
    api('/api/catalogos'), api('/api/turnos'), api('/api/maquinas'), api('/api/modelos'),
    api('/api/equipes'), api('/api/operadores'),
  ]);
  estado.catalogos = catalogos;
  estado.turnos = turnos;
  estado.maquinas = maquinas;
  estado.modelos = modelos;
  estado.equipes = equipes;
  estado.operadores = operadores;

  $('#nome-fabrica').textContent = catalogos.metas.nomeFabrica;
  popularFiltroLinha();
  popularSelectsFormulario();
  popularSelectsNovos();
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
  $('#lista-producao').innerHTML = '';
  estado.editandoApontamento = null;
  atualizarResumoParadas();
  atualizarResumoProducao();
}

async function preencherFormApontamento(a) {
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

  $('#lista-producao').innerHTML = '';
  try {
    const producao = await api(`/api/apontamentos/${a.id}/producao`);
    for (const item of producao) {
      adicionarLinhaProducao({
        operador_id: item.operadorId,
        minutos: item.minutos,
        pecas: item.pecas,
        defeitos: item.defeitos,
        tempo_padrao_min: item.basePadrao === 'POSTO' ? item.minutosPadraoUnit : null,
      });
    }
  } catch { /* produção individual é opcional */ }
  atualizarResumoProducao();
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
    let id = estado.editandoApontamento;
    if (id) {
      await api(`/api/apontamentos/${id}`, { method: 'PUT', body: dados });
    } else {
      const criado = await api('/api/apontamentos', { method: 'POST', body: dados });
      id = criado.id;
    }
    await salvarProducaoIndividual(id);
    avisar(id === estado.editandoApontamento ? 'Apontamento atualizado.' : 'Apontamento registrado.', 'sucesso');
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

async function trocarAba(nome) {
  $$('.aba').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === nome));
  $$('.painel').forEach((p) => p.classList.toggle('ativa', p.id === `view-${nome}`));
  if (nome === 'linhas') renderMaquinas();
  if (nome === 'modelos') renderModelos();
  if (nome === 'turnos') renderTurnos();
  if (nome === 'equipes') { renderEquipes(); renderOperadores(); }
  if (nome === 'cronometragem') { await carregarSequencia(); }
  if (nome === 'balanceamento') { await carregarBalancos(); }
  if (nome === 'acompanhamento') { await carregarAcompanhamento().catch((e) => avisar(e.message, 'erro')); }
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
      if (item) preencherFormApontamento(item).catch((err) => avisar(err.message, 'erro'));
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

  // ---- cronometragem e sequência ----
  $('#cr-modelo').addEventListener('change', () => carregarSequencia().catch((e) => avisar(e.message, 'erro')));
  $('#form-operacao').addEventListener('submit', salvarOperacao);
  $('#btn-cancelar-operacao').addEventListener('click', () => {
    $('#form-operacao').reset();
    $('#op-id').value = '';
  });
  $('#btn-recalcular-sam').addEventListener('click', recalcularSam);
  $('#tabela-sequencia').addEventListener('click', async (e) => {
    const cronometrar = e.target.closest('[data-cronometrar]');
    const excluir = e.target.closest('[data-excluir-op]');
    if (cronometrar) {
      $('#cm-operacao').value = cronometrar.dataset.cronometrar;
      $('#cm-leituras').focus();
    }
    if (excluir && confirm('Excluir esta operação? As cronometragens dela também serão removidas.')) {
      try {
        await api(`/api/operacoes/${excluir.dataset.excluirOp}`, { method: 'DELETE' });
        avisar('Operação excluída.', 'sucesso');
        await carregarSequencia();
      } catch (err) { avisar(err.message, 'erro'); }
    }
  });

  $('#form-cronometragem').addEventListener('submit', salvarCronometragem);
  for (const sel of ['#cm-leituras', '#cm-ritmo', '#cm-tolerancia']) {
    $(sel).addEventListener('input', preverCronometragem);
  }
  $('#tabela-cronometragens').addEventListener('click', async (e) => {
    const excluir = e.target.closest('[data-excluir-cm]');
    if (!excluir || !confirm('Excluir esta cronometragem?')) return;
    try {
      await api(`/api/cronometragens/${excluir.dataset.excluirCm}`, { method: 'DELETE' });
      avisar('Cronometragem excluída.', 'sucesso');
      await carregarSequencia();
    } catch (err) { avisar(err.message, 'erro'); }
  });

  // ---- balanceamento ----
  $('#form-balanceamento').addEventListener('submit', simularBalanceamento);
  $('#btn-salvar-balanceamento').addEventListener('click', salvarBalanceamento);
  $('#tabela-balancos').addEventListener('click', async (e) => {
    const ver = e.target.closest('[data-ver-balanceamento]');
    const excluir = e.target.closest('[data-excluir-balanceamento]');
    if (ver) {
      const b = estado.balancos.find((x) => String(x.id) === ver.dataset.verBalanceamento);
      if (b) renderBalanceamento(b.resultado, { codigo: b.modelo_codigo, nome: b.modelo_nome });
    }
    if (excluir && confirm('Excluir este cenário?')) {
      try {
        await api(`/api/balancos/${excluir.dataset.excluirBalanceamento}`, { method: 'DELETE' });
        avisar('Cenário excluído.', 'sucesso');
        await carregarBalancos();
      } catch (err) { avisar(err.message, 'erro'); }
    }
  });

  // ---- produção individual dentro do apontamento ----
  $('#btn-add-producao').addEventListener('click', () => adicionarLinhaProducao());
  $('#btn-distribuir-producao').addEventListener('click', distribuirPorBalanceamento);

  // ---- equipes e operadores ----
  $('#form-equipe').addEventListener('submit', salvarEquipe);
  $('#btn-cancelar-equipe').addEventListener('click', () => preencherFormEquipe(null));
  $('#tabela-equipes').addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar-eq]');
    const excluir = e.target.closest('[data-excluir-eq]');
    if (editar) preencherFormEquipe(estado.equipes.find((x) => String(x.id) === editar.dataset.editarEq));
    if (excluir && confirm('Excluir esta equipe?')) {
      try {
        await api(`/api/equipes/${excluir.dataset.excluirEq}`, { method: 'DELETE' });
        avisar('Equipe excluída.', 'sucesso');
        await carregarCadastros();
        renderEquipes();
      } catch (err) { avisar(err.message, 'erro'); }
    }
  });

  $('#form-operador').addEventListener('submit', salvarOperador);
  $('#btn-cancelar-operador').addEventListener('click', () => preencherFormOperador(null));
  $('#tabela-operadores').addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar-opr]');
    const excluir = e.target.closest('[data-excluir-opr]');
    if (editar) preencherFormOperador(estado.operadores.find((x) => String(x.id) === editar.dataset.editarOpr));
    if (excluir && confirm('Excluir este operador?')) {
      try {
        await api(`/api/operadores/${excluir.dataset.excluirOpr}`, { method: 'DELETE' });
        avisar('Operador excluído.', 'sucesso');
        await carregarCadastros();
        renderOperadores();
      } catch (err) { avisar(err.message, 'erro'); }
    }
  });

  // ---- acompanhamento ----
  $$('#granularidade button').forEach((b) => b.addEventListener('click', () => {
    estado.granularidade = b.dataset.gran;
    $$('#granularidade button').forEach((x) => x.classList.toggle('ativo', x === b));
    renderAcompanhamento();
  }));
  $('#acomp-equipe').addEventListener('change', () => carregarAcompanhamento().catch((e) => avisar(e.message, 'erro')));
  $('#acomp-operador').addEventListener('change', () => carregarAcompanhamento().catch((e) => avisar(e.message, 'erro')));

  $('#form-metas').addEventListener('submit', salvarMetas);
}

/* ============================================ selects dos módulos novos === */

function popularSelectsNovos() {
  const opcoesModelos = estado.modelos
    .map((m) => `<option value="${m.id}">${escapar(m.codigo)} · ${escapar(m.nome)} (SAM ${fmtNum(m.sam_min, 2)} min)</option>`)
    .join('');

  for (const id of ['#cr-modelo', '#bl-modelo']) {
    const sel = $(id);
    const atual = sel.value;
    sel.innerHTML = estado.modelos.length ? opcoesModelos : '<option value="">— cadastre um modelo —</option>';
    if (atual && estado.modelos.some((m) => String(m.id) === atual)) sel.value = atual;
  }

  const selEq = $('#opr-equipe');
  const eqAtual = selEq.value;
  selEq.innerHTML = '<option value="">— sem equipe —</option>' +
    estado.equipes.map((e) => `<option value="${e.id}">${escapar(e.nome)}</option>`).join('');
  if (eqAtual) selEq.value = eqAtual;

  const filtroEq = $('#acomp-equipe');
  const filtroEqAtual = filtroEq.value;
  filtroEq.innerHTML = '<option value="">Todas as equipes</option>' +
    estado.equipes.map((e) => `<option value="${e.id}">${escapar(e.nome)}</option>`).join('');
  if (filtroEqAtual) filtroEq.value = filtroEqAtual;

  const filtroOp = $('#acomp-operador');
  const filtroOpAtual = filtroOp.value;
  filtroOp.innerHTML = '<option value="">Todos os operadores</option>' +
    estado.operadores.map((o) => `<option value="${o.id}">${escapar(o.nome)}</option>`).join('');
  if (filtroOpAtual) filtroOp.value = filtroOpAtual;

  const selOp = $('#cm-operador');
  const opAtual = selOp.value;
  selOp.innerHTML = '<option value="">— não informado —</option>' +
    estado.operadores.map((o) => `<option value="${o.id}">${escapar(o.nome)}</option>`).join('');
  if (opAtual) selOp.value = opAtual;

  $('#lista-maquinas-operacao').innerHTML =
    [...new Set(estado.maquinas.map((m) => m.tipo).filter(Boolean))]
      .flatMap((t) => t.split('+').map((x) => x.trim()))
      .filter(Boolean)
      .concat(['Reta', 'Overloque', 'Galoneira', 'Interloque', 'Travete', 'Botoneira'])
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((t) => `<option value="${escapar(t)}"></option>`).join('');

  $('#lista-setores-eq').innerHTML = estado.catalogos.setores
    .map((x) => `<option value="${escapar(x)}"></option>`).join('');
}

function popularSelectOperacoes() {
  const sel = $('#cm-operacao');
  if (!estado.sequencia || estado.sequencia.totalOperacoes === 0) {
    sel.innerHTML = '<option value="">— cadastre operações —</option>';
    return;
  }
  sel.innerHTML = estado.sequencia.operacoes.map((o) =>
    `<option value="${o.id}">${o.sequencia}. ${escapar(o.descricao)} — ${fmtNum(o.tempoPadraoSeg, 1)} s</option>`).join('');
}

/* ======================================================== acompanhamento == */

async function carregarAcompanhamento() {
  const params = new URLSearchParams();
  if ($('#filtro-de').value) params.set('de', $('#filtro-de').value);
  if ($('#filtro-ate').value) params.set('ate', $('#filtro-ate').value);
  if ($('#acomp-equipe').value) params.set('equipeId', $('#acomp-equipe').value);
  if ($('#acomp-operador').value) params.set('operadorId', $('#acomp-operador').value);
  if ($('#filtro-linha').value) params.set('maquinaId', $('#filtro-linha').value);
  estado.acompanhamento = await api('/api/acompanhamento?' + params.toString());
  renderAcompanhamento();
}

function renderAcompanhamento() {
  const a = estado.acompanhamento;
  if (!a) return;
  const r = a.resumo;
  const diario = estado.granularidade === 'dia';
  const serie = diario ? a.porDia : a.porMes;

  $('#kpis-acomp').innerHTML = [
    { rotulo: 'Peças produzidas', valor: fmtNum(r.pecas), nota: `${fmtNum(r.pecasPorDia, 0)} peças/dia` },
    { rotulo: 'Eficiência média', valor: fmtPct(r.eficienciaPct), nota: 'peças × tempo padrão ÷ horas', negativo: r.eficienciaPct < 85 },
    { rotulo: 'Produtividade', valor: `${fmtNum(r.pecasHora, 1)} pç/h`, nota: `${fmtNum(r.horas, 0)} horas apontadas` },
    { rotulo: 'Refugo', valor: fmtPct(r.taxaDefeitosPct, 2), nota: `${fmtNum(r.defeitos)} peças`, negativo: r.taxaDefeitosPct > a.metas.metaDefeitosPct },
    { rotulo: 'Operadores', valor: fmtNum(r.operadores), nota: `${fmtNum(r.equipes)} equipes · ${fmtNum(r.dias)} dias` },
  ].map((k) => `
    <div class="kpi ${k.negativo ? 'negativo' : ''}">
      <div class="kpi-rotulo">${k.rotulo}</div>
      <div class="kpi-valor">${k.valor}</div>
      <div class="kpi-nota">${k.nota}</div>
    </div>`).join('');

  Graficos.barChart($('#grafico-acomp'), {
    labels: serie.map((d) => (diario ? fmtDataCurta(d.data) : d.mes)),
    valores: serie.map((d) => d.pecas),
    nomeBarra: diario ? 'Peças por dia' : 'Peças por mês',
    linhaValores: serie.map((d) => d.eficienciaPct),
    nomeLinha: 'Eficiência',
    meta: 85,
    unidade: 'peças',
    altura: 300,
  });

  $('#titulo-serie-acomp').textContent = diario ? 'Produção diária' : 'Produção mensal';
  const tbodySerie = $('#tabela-acomp-serie tbody');
  if (!serie.length) {
    tbodySerie.innerHTML = '<tr><td class="vazio-linha" colspan="9">Sem produção individual registrada no período</td></tr>';
  } else {
    tbodySerie.innerHTML = serie.map((d) => `<tr>
      <td><strong>${diario ? fmtDataLonga(d.data) + ' (' + d.diaSemana + ')' : d.mes}</strong></td>
      <td class="num">${fmtNum(d.operadores)}</td>
      <td class="num">${fmtNum(d.pecas)}</td>
      <td class="num">${fmtNum(diario ? d.pecas : d.pecas / Math.max(1, d.dias || 1), 0)}</td>
      <td class="num">${fmtNum(d.horas, 1)}</td>
      <td class="num">${fmtNum(d.pecasHora, 1)}</td>
      <td class="num">${pilula(d.eficienciaPct, 85)}</td>
      <td class="num">${fmtPct(d.taxaDefeitosPct, 2)}</td>
      <td>${barraMini(d.eficienciaPct)}</td>
    </tr>`).join('');
  }

  const tbodyOp = $('#tabela-acomp-operador tbody');
  tbodyOp.innerHTML = a.porOperador.length ? a.porOperador.map((o) => `<tr>
    <td><strong>${escapar(o.operador)}</strong> <span class="tag-base" title="Base do tempo padrão">${o.basePadrao === 'POSTO' ? 'posto' : o.basePadrao === 'OPERACAO' ? 'operação' : 'SAM'}</span></td>
    <td>${escapar(o.equipe)}</td>
    <td class="num">${o.diasTrabalhados}</td>
    <td class="num">${fmtNum(o.pecas)}</td>
    <td class="num">${fmtNum(o.pecasHora, 1)}</td>
    <td class="num">${pilula(o.eficienciaPct, 85)}</td>
    <td class="num">${fmtPct(o.taxaDefeitosPct, 2)}</td>
  </tr>`).join('') : '<tr><td class="vazio-linha" colspan="7">Sem dados</td></tr>';

  const tbodyEq = $('#tabela-acomp-equipe tbody');
  tbodyEq.innerHTML = a.porEquipe.length ? a.porEquipe.map((e) => `<tr>
    <td><strong>${escapar(e.equipe)}</strong></td>
    <td class="num">${e.operadores}</td>
    <td class="num">${fmtNum(e.pecas)}</td>
    <td class="num">${fmtNum(e.pecasHora, 1)}</td>
    <td class="num">${pilula(e.eficienciaPct, 85)}</td>
    <td class="num">${fmtPct(e.taxaDefeitosPct, 2)}</td>
  </tr>`).join('') : '<tr><td class="vazio-linha" colspan="6">Sem dados</td></tr>';

  Graficos.barChart($('#grafico-equipes'), {
    labels: a.porEquipe.map((e) => e.equipe),
    valores: a.porEquipe.map((e) => e.eficienciaPct),
    cor: 'var(--marca-clara)',
    nomeBarra: 'Eficiência por equipe (%)',
    unidade: '%',
    meta: 85,
    altura: 200,
  });

  const tbodyMd = $('#tabela-acomp-modelo tbody');
  tbodyMd.innerHTML = a.porModelo.length ? a.porModelo.map((m) => `<tr>
    <td><strong>${escapar(m.modeloCodigo || '—')}</strong> ${escapar(m.modeloNome)}</td>
    <td class="num">${fmtNum(m.pecas)}</td>
    <td class="num">${fmtNum(m.pecasHora, 1)}</td>
    <td class="num">${fmtPct(m.eficienciaPct)}</td>
    <td class="num">${fmtPct(m.taxaDefeitosPct, 2)}</td>
  </tr>`).join('') : '<tr><td class="vazio-linha" colspan="5">Sem dados</td></tr>';
}

/* ========================================================= cronometragem === */

async function carregarSequencia() {
  const modeloId = $('#cr-modelo').value;
  if (!modeloId) { estado.sequencia = null; renderSequencia(); return; }
  estado.sequencia = await api(`/api/modelos/${modeloId}/sequencia`);
  renderSequencia();
  popularSelectOperacoes();
  await carregarCronometragens();
}

function renderSequencia() {
  const seq = estado.sequencia;
  const resumo = $('#cr-resumo-sam');
  const tbody = $('#tabela-sequencia tbody');
  if (!seq) {
    resumo.innerHTML = '';
    tbody.innerHTML = '<tr><td class="vazio-linha" colspan="8">Selecione um modelo</td></tr>';
    return;
  }

  const divergente = Math.abs(seq.divergenciaMin) > 0.01;
  resumo.innerHTML = `
    <div class="item"><div class="rotulo">Operações</div><div class="valor">${seq.totalOperacoes}</div></div>
    <div class="item ${divergente ? 'alerta' : ''}"><div class="rotulo">SAM pela sequência</div><div class="valor">${fmtNum(seq.samCalculadoMin, 3)} min</div></div>
    <div class="item"><div class="rotulo">SAM cadastrado</div><div class="valor">${fmtNum(seq.samCadastradoMin, 3)} min</div></div>
    <div class="item ${divergente ? 'alerta' : ''}"><div class="rotulo">Divergência</div><div class="valor">${seq.divergenciaMin >= 0 ? '+' : ''}${fmtNum(seq.divergenciaMin, 3)} min (${fmtNum(seq.divergenciaPct, 1)}%)</div></div>
    <div class="item ${seq.operacoesSemCronometragem ? 'alerta' : ''}"><div class="rotulo">Sem cronometragem</div><div class="valor">${seq.operacoesSemCronometragem}</div></div>`;

  tbody.innerHTML = seq.operacoes.length ? seq.operacoes.map((o) => `<tr>
    <td class="num">${o.sequencia}</td>
    <td>${escapar(o.codigo)}</td>
    <td><strong>${escapar(o.descricao)}</strong></td>
    <td>${escapar(o.maquina || '—')}</td>
    <td class="num">${fmtNum(o.tempoPadraoSeg, 1)} s<br><small>${fmtNum(o.tempoPadraoMin, 3)} min</small></td>
    <td class="num">${fmtNum(o.tempoPadraoMin > 0 ? 60 / o.tempoPadraoMin : 0, 1)}</td>
    <td>${o.temCronometragem
      ? `<span class="pilula ${o.cronometragemVigente.confiavel ? 'ok' : 'atencao'}">${o.cronometragemVigente.quantidadeLeituras} leituras</span>`
      : '<span class="pilula neutro">sem estudo</span>'}</td>
    <td>
      <button class="btn btn-secundario btn-mini" data-cronometrar="${o.id}">⏱️ Cronometrar</button>
      <button class="btn btn-perigo btn-mini" data-excluir-op="${o.id}">Excluir</button>
    </td>
  </tr>`).join('') : '<tr><td class="vazio-linha" colspan="8">Nenhuma operação cadastrada</td></tr>';
}

async function carregarCronometragens() {
  const modeloId = $('#cr-modelo').value;
  estado.cronometragens = modeloId ? await api(`/api/cronometragens?modeloId=${modeloId}`) : [];
  const tbody = $('#tabela-cronometragens tbody');
  tbody.innerHTML = estado.cronometragens.length ? estado.cronometragens.slice(0, 20).map((c) => `<tr>
    <td>${fmtDataLonga(c.data)}</td>
    <td>${c.operacaoSequencia}. ${escapar(c.operacaoDescricao)}</td>
    <td class="num">${c.resumo.quantidadeLeituras}</td>
    <td class="num">${fmtNum(c.resumo.tempoObservadoMedio, 1)}</td>
    <td class="num">${fmtNum(c.fatorRitmo * 100, 0)}%</td>
    <td class="num"><strong>${fmtNum(c.resumo.tempoPadrao, 1)}</strong></td>
    <td><button class="btn btn-perigo btn-mini" data-excluir-cm="${c.id}">✕</button></td>
  </tr>`).join('') : '<tr><td class="vazio-linha" colspan="7">Nenhuma cronometragem registrada</td></tr>';
}

/** Espelha a lógica do servidor para mostrar a prévia antes de gravar. */
function preverCronometragem() {
  const leituras = ($('#cm-leituras').value || '')
    .split(/[\s,;]+/).map((v) => parseFloat(v.replace(',', '.'))).filter((v) => Number.isFinite(v) && v > 0);
  const alvo = $('#cm-previa');
  if (leituras.length === 0) { alvo.innerHTML = ''; return; }

  const ordenadas = [...leituras].sort((a, b) => a - b);
  const meio = Math.floor(ordenadas.length / 2);
  const mediana = ordenadas.length % 2 ? ordenadas[meio] : (ordenadas[meio - 1] + ordenadas[meio]) / 2;
  const validas = leituras.filter((v) => Math.abs(v - mediana) <= mediana * 0.25);
  const base = validas.length ? validas : leituras;
  const to = base.reduce((s, v) => s + v, 0) / base.length;
  const ritmo = parseFloat($('#cm-ritmo').value) || 1;
  const tol = parseFloat($('#cm-tolerancia').value) || 0;
  const tn = to * ritmo;
  const tp = tn * (1 + tol / 100);

  alvo.innerHTML = `
    <div class="linha"><span>Leituras válidas</span><strong>${base.length} de ${leituras.length}</strong></div>
    <div class="linha"><span>Tempo observado médio (TO)</span><strong>${to.toFixed(2)} s</strong></div>
    <div class="linha"><span>Tempo normal (TO × ${ritmo.toFixed(2)})</span><strong>${tn.toFixed(2)} s</strong></div>
    <div class="linha"><span>Tempo padrão (TN + ${tol.toFixed(0)}%)</span><strong>${tp.toFixed(2)} s · ${(tp / 60).toFixed(3)} min</strong></div>
    <div class="linha"><span>Peças/hora nesta operação</span><strong>${tp > 0 ? (3600 / tp).toFixed(1) : '—'}</strong></div>
    ${leituras.length - base.length > 0 ? `<div class="aviso-cron">${leituras.length - base.length} leitura(s) fora de ±25% da mediana serão excluídas da média.</div>` : ''}
    ${leituras.length < 5 ? '<div class="aviso-cron">Recomendado: pelo menos 5 leituras.</div>' : ''}`;
}

async function salvarOperacao(evento) {
  evento.preventDefault();
  const modeloId = $('#cr-modelo').value;
  if (!modeloId) return avisar('Selecione um modelo primeiro.', 'erro');
  const corpo = {
    modelo_id: parseInt(modeloId, 10),
    sequencia: parseInt($('#op-sequencia').value || '1', 10),
    descricao: $('#op-descricao').value.trim(),
    maquina: $('#op-maquina').value.trim(),
    tempo_padrao: parseFloat($('#op-tempo').value || '0'),
    dificuldade: parseInt($('#op-dificuldade').value || '2', 10),
  };
  try {
    if ($('#op-id').value) await api(`/api/operacoes/${$('#op-id').value}`, { method: 'PUT', body: corpo });
    else await api('/api/operacoes', { method: 'POST', body: corpo });
    avisar('Operação salva.', 'sucesso');
    $('#form-operacao').reset();
    $('#op-id').value = '';
    await carregarSequencia();
  } catch (e) { avisar(e.message, 'erro'); }
}

async function salvarCronometragem(evento) {
  evento.preventDefault();
  const operacaoId = $('#cm-operacao').value;
  if (!operacaoId) return avisar('Selecione uma operação.', 'erro');
  const leituras = ($('#cm-leituras').value || '')
    .split(/[\s,;]+/).map((v) => parseFloat(v.replace(',', '.'))).filter((v) => Number.isFinite(v) && v > 0);
  if (leituras.length === 0) return avisar('Informe as leituras do cronômetro.', 'erro');

  try {
    const r = await api('/api/cronometragens', {
      method: 'POST',
      body: {
        operacao_id: parseInt(operacaoId, 10),
        operador_id: $('#cm-operador').value ? parseInt($('#cm-operador').value, 10) : null,
        data: $('#cm-data').value,
        leituras,
        fator_ritmo: parseFloat($('#cm-ritmo').value) || 1,
        tolerancia_pct: parseFloat($('#cm-tolerancia').value) || 0,
      },
    });
    avisar(`Cronometragem registrada — tempo padrão ${r.resumo.tempoPadrao.toFixed(2)} s.`, 'sucesso');
    $('#cm-leituras').value = '';
    $('#cm-previa').innerHTML = '';
    await carregarSequencia();
    await carregarCadastros();
  } catch (e) { avisar(e.message, 'erro'); }
}

async function recalcularSam() {
  const modeloId = $('#cr-modelo').value;
  if (!modeloId) return avisar('Selecione um modelo.', 'erro');
  try {
    const r = await api(`/api/modelos/${modeloId}/recalcular-sam`, { method: 'POST' });
    avisar(`SAM atualizado para ${fmtNum(r.samCalculadoMin, 3)} min.`, 'sucesso');
    await carregarSequencia();
    await carregarCadastros();
    await carregarPainel();
  } catch (e) { avisar(e.message, 'erro'); }
}

/* ========================================================= balanceamento === */

async function simularBalanceamento(evento) {
  if (evento) evento.preventDefault();
  const modeloId = $('#bl-modelo').value;
  if (!modeloId) return avisar('Selecione um modelo.', 'erro');
  const meta = parseFloat($('#bl-meta').value || '0');
  if (meta <= 0) return avisar('Informe uma meta de peças/hora.', 'erro');

  try {
    const r = await api('/api/balanceamento/simular', {
      method: 'POST',
      body: {
        modelo_id: parseInt(modeloId, 10),
        meta_pecas_hora: meta,
        minutos_disponiveis: parseFloat($('#bl-minutos').value || '420'),
        max_postos: parseInt($('#bl-maxpostos').value || '0', 10),
      },
    });
    estado.balanceamentoAtual = r.resultado;
    renderBalanceamento(r.resultado, r.modelo);
  } catch (e) { avisar(e.message, 'erro'); }
}

function renderBalanceamento(res, modelo) {
  const cont = $('#resultado-balanceamento');
  if (!res || res.postosUsados === 0) {
    cont.innerHTML = '<div class="cartao"><p class="dica">Cadastre a sequência operacional do modelo para balancear a linha.</p></div>';
    return;
  }
  const tempoCiclo = res.tempoCiclo;

  cont.innerHTML = `
    <div class="cartao">
      <div class="cartao-cabecalho">
        <h2>Resultado ${modelo ? '— ' + escapar(modelo.codigo) + ' ' + escapar(modelo.nome) : ''}</h2>
        ${res.atendimentoMeta
          ? '<span class="pilula ok">Meta atingida</span>'
          : '<span class="pilula critico">Meta não atingida</span>'}
      </div>
      <div class="resumo-balanceamento">
        <div class="item"><div class="rotulo">SAM</div><div class="valor">${fmtNum(res.sam, 3)} min</div></div>
        <div class="item"><div class="rotulo">Pitch time</div><div class="valor">${fmtNum(res.pitchTime, 3)} min</div></div>
        <div class="item"><div class="rotulo">Mín. teórico de postos</div><div class="valor">${res.minTeoricoPostos}</div></div>
        <div class="item ${res.postosUsados > res.minTeoricoPostos ? 'destaque' : 'ok'}"><div class="rotulo">Postos usados</div><div class="valor">${res.postosUsados}</div></div>
        <div class="item"><div class="rotulo">Tempo de ciclo</div><div class="valor">${fmtNum(tempoCiclo, 3)} min</div></div>
        <div class="item ${res.atendimentoMeta ? 'ok' : 'destaque'}"><div class="rotulo">Produção</div><div class="valor">${fmtNum(res.producaoHora, 1)} pç/h</div></div>
        <div class="item"><div class="rotulo">Peças no turno</div><div class="valor">${fmtNum(res.producaoTurno, 0)}</div></div>
        <div class="item ${res.eficienciaPct >= 85 ? 'ok' : 'destaque'}"><div class="rotulo">Eficiência do balanceamento</div><div class="valor">${fmtPct(res.eficienciaPct)}</div></div>
        <div class="item"><div class="rotulo">Tempo ocioso total</div><div class="valor">${fmtNum(res.tempoOciosoTotal, 2)} min</div></div>
      </div>

      <h3>Distribuição por posto</h3>
      <div class="postos">
        ${res.estacoes.map((e) => {
          const ehGargalo = e.tempo === tempoCiclo;
          const utilizacao = e.utilizacao * 100;
          return `<div class="posto ${ehGargalo ? 'gargalo' : ''}">
            <div class="posto-cabecalho">
              <span class="numero">Posto ${e.numero} ${ehGargalo ? '· gargalo' : ''}</span>
              <span class="tempo">${fmtNum(e.tempo, 2)} / ${fmtNum(tempoCiclo, 2)} min</span>
            </div>
            <div class="posto-barra"><span style="width:${utilizacao.toFixed(1)}%;background:${ehGargalo ? 'var(--critico)' : 'var(--marca-clara)'}"></span></div>
            <ul class="posto-ops">
              ${e.operacoes.map((o) => `<li><span>${o.sequencia}. ${escapar(o.descricao)}</span><span>${fmtNum(o.tempoPadraoMin, 2)}</span></li>`).join('')}
            </ul>
            <div class="posto-ocioso">ociosidade ${fmtNum(e.ociosidade, 2)} min · ${fmtNum(utilizacao, 0)}% de uso</div>
          </div>`;
        }).join('')}
      </div>

      <div class="recomendacoes">
        <h3>Diagnóstico</h3>
        <ul>${res.recomendacoes.map((r2) => `<li>${escapar(r2)}</li>`).join('')}</ul>
      </div>
    </div>`;
}

async function salvarBalanceamento() {
  const nome = $('#bl-nome').value.trim();
  if (!nome) return avisar('Informe um nome para o cenário.', 'erro');
  try {
    await api('/api/balancos', {
      method: 'POST',
      body: {
        nome,
        modelo_id: parseInt($('#bl-modelo').value, 10),
        meta_pecas_hora: parseFloat($('#bl-meta').value || '0'),
        minutos_disponiveis: parseFloat($('#bl-minutos').value || '420'),
        max_postos: parseInt($('#bl-maxpostos').value || '0', 10),
      },
    });
    avisar('Cenário salvo.', 'sucesso');
    await carregarBalancos();
  } catch (e) { avisar(e.message, 'erro'); }
}

async function carregarBalancos() {
  estado.balancos = await api('/api/balancos');
  const tbody = $('#tabela-balancos tbody');
  tbody.innerHTML = estado.balancos.length ? estado.balancos.map((b) => `<tr>
    <td><strong>${escapar(b.nome)}</strong></td>
    <td>${escapar(b.modelo_codigo)} · ${escapar(b.modelo_nome)}</td>
    <td class="num">${fmtNum(b.meta_pecas_hora, 0)}</td>
    <td class="num">${b.resultado.postosUsados ?? '—'}</td>
    <td class="num">${fmtNum(b.resultado.producaoHora ?? 0, 1)}</td>
    <td class="num">${pilula(b.resultado.eficienciaPct ?? 0, 85)}</td>
    <td>
      <button class="btn btn-secundario btn-mini" data-ver-balanceamento="${b.id}">Ver</button>
      <button class="btn btn-perigo btn-mini" data-excluir-balanceamento="${b.id}">Excluir</button>
    </td>
  </tr>`).join('') : '<tr><td class="vazio-linha" colspan="7">Nenhum cenário salvo</td></tr>';
}

/* ================================================== produção individual === */

function adicionarLinhaProducao(dados = {}) {
  const div = document.createElement('div');
  div.className = 'linha-parada linha-producao';
  const opcoesEq = estado.operadores
    .map((o) => `<option value="${o.id}">${escapar(o.nome)}${o.equipe_nome ? ' · ' + escapar(o.equipe_nome) : ''}</option>`)
    .join('');
  div.innerHTML = `
    <select class="pr-operador" aria-label="Operador"><option value="">— operador —</option>${opcoesEq}</select>
    <input type="number" class="pr-minutos" min="0" step="1" value="${dados.minutos ?? 420}" aria-label="Minutos" title="Minutos trabalhados">
    <input type="number" class="pr-pecas" min="0" step="1" value="${dados.pecas ?? 0}" aria-label="Peças" title="Peças produzidas">
    <input type="number" class="pr-defeitos" min="0" step="1" value="${dados.defeitos ?? 0}" aria-label="Defeitos" title="Defeitos">
    <input type="number" class="pr-padrao" min="0" step="0.001" value="${dados.tempo_padrao_min ?? ''}" placeholder="TP min" aria-label="Tempo padrão em minutos">
    <button type="button" class="btn btn-perigo btn-mini" title="Remover">✕</button>`;
  if (dados.operador_id) div.querySelector('.pr-operador').value = String(dados.operador_id);
  div.querySelector('button').addEventListener('click', () => { div.remove(); atualizarResumoProducao(); });
  div.querySelectorAll('input, select').forEach((i) => i.addEventListener('input', atualizarResumoProducao));
  $('#lista-producao').appendChild(div);
  atualizarResumoProducao();
}

function lerProducao() {
  return $$('#lista-producao .linha-producao').map((l) => ({
    operador_id: parseInt($('.pr-operador', l).value || '0', 10),
    minutos: parseFloat($('.pr-minutos', l).value) || 0,
    pecas: parseFloat($('.pr-pecas', l).value) || 0,
    defeitos: parseFloat($('.pr-defeitos', l).value) || 0,
    tempo_padrao_min: $('.pr-padrao', l).value ? parseFloat($('.pr-padrao', l).value) : null,
  })).filter((p) => p.operador_id > 0);
}

function atualizarResumoProducao() {
  const itens = lerProducao();
  const pecas = itens.reduce((s, i) => s + i.pecas, 0);
  const minutos = itens.reduce((s, i) => s + i.minutos, 0);
  $('#resumo-producao').textContent = itens.length
    ? `${itens.length} operador(es) · ${fmtNum(pecas)} peças · ${fmtMinutos(minutos)}`
    : 'nenhum operador lançado';
}

/**
 * Escolhe os operadores que compõem a linha. Regra: a equipe do mesmo setor da
 * linha e, entre elas, a que tem a mesma quantidade de operadores cadastrada na
 * célula. Sem equipe compatível, usa todos os operadores ativos.
 */
function equipeDaLinha(maquina) {
  const doSetor = estado.equipes.filter((e) => !maquina || e.setor === maquina.setor);
  const equipe = doSetor.find((e) => maquina && e.operadores === maquina.operadores) || doSetor[0] || null;
  if (!equipe) return { equipe: null, operadores: estado.operadores };
  const daEquipe = estado.operadores.filter((o) => o.equipe_id === equipe.id);
  return { equipe, operadores: daEquipe.length ? daEquipe : estado.operadores };
}

async function distribuirPorBalanceamento() {
  const modeloId = $('#ap-modelo').value;
  const pecas = parseInt($('#ap-pecas').value || '0', 10);
  const maquinaId = $('#ap-maquina').value;
  const turnoId = $('#ap-turno').value;
  if (!modeloId) return avisar('Selecione o modelo produzido.', 'erro');
  if (pecas <= 0) return avisar('Informe as peças produzidas.', 'erro');

  const turno = estado.turnos.find((t) => String(t.id) === String(turnoId));
  const maquina = estado.maquinas.find((m) => String(m.id) === String(maquinaId));
  const minutosDisponiveis = turno ? turno.minutos_totais - turno.pausas_planejadas : 420;
  const metaHora = (pecas / minutosDisponiveis) * 60;

  try {
    const r = await api('/api/balanceamento/simular', {
      method: 'POST',
      body: { modelo_id: parseInt(modeloId, 10), meta_pecas_hora: metaHora, minutos_disponiveis: minutosDisponiveis, max_postos: maquina ? maquina.operadores : 0 },
    });
    const { equipe, operadores } = equipeDaLinha(maquina);
    if (operadores.length === 0) return avisar('Cadastre operadores para distribuir a produção.', 'erro');

    $('#lista-producao').innerHTML = '';
    let lancados = 0;
    r.resultado.estacoes.forEach((posto, i) => {
      const operador = operadores[i];
      if (!operador) return;
      adicionarLinhaProducao({
        operador_id: operador.id,
        minutos: minutosDisponiveis,
        pecas,
        defeitos: 0,
        tempo_padrao_min: Number(posto.tempo.toFixed(4)),
      });
      lancados += 1;
    });
    const falta = r.resultado.postosUsados - lancados;
    avisar(
      `Distribuído em ${lancados} de ${r.resultado.postosUsados} posto(s)`
      + (equipe ? ` com a ${equipe.nome}` : '')
      + ` — pitch ${r.resultado.pitchTime.toFixed(3)} min.`
      + (falta > 0 ? ` Faltam ${falta} operador(es) cadastrados para cobrir todos os postos.` : ''),
      falta > 0 ? 'atencao' : 'sucesso'
    );
  } catch (e) { avisar(e.message, 'erro'); }
}

async function salvarProducaoIndividual(apontamentoId) {
  const itens = lerProducao();
  if (itens.length === 0) return;
  await api(`/api/apontamentos/${apontamentoId}/producao`, { method: 'PUT', body: { itens } });
}

/* =============================================================== equipes === */

function renderEquipes() {
  const tbody = $('#tabela-equipes tbody');
  tbody.innerHTML = estado.equipes.length ? estado.equipes.map((e) => `<tr>
    <td><strong>${escapar(e.nome)}</strong></td>
    <td>${escapar(e.setor || '—')}</td>
    <td>${escapar(e.lider || '—')}</td>
    <td class="num">${e.operadores}</td>
    <td>
      <button class="btn btn-secundario btn-mini" data-editar-eq="${e.id}">Editar</button>
      <button class="btn btn-perigo btn-mini" data-excluir-eq="${e.id}">Excluir</button>
    </td>
  </tr>`).join('') : '<tr><td class="vazio-linha" colspan="5">Nenhuma equipe cadastrada</td></tr>';
}

function preencherFormEquipe(e) {
  $('#eq-id').value = e ? e.id : '';
  $('#eq-nome').value = e ? e.nome : '';
  $('#eq-setor').value = e ? e.setor : '';
  $('#eq-lider').value = e ? e.lider : '';
}

async function salvarEquipe(evento) {
  evento.preventDefault();
  const corpo = { nome: $('#eq-nome').value.trim(), setor: $('#eq-setor').value.trim(), lider: $('#eq-lider').value.trim() };
  try {
    if ($('#eq-id').value) await api(`/api/equipes/${$('#eq-id').value}`, { method: 'PUT', body: corpo });
    else await api('/api/equipes', { method: 'POST', body: corpo });
    avisar('Equipe salva.', 'sucesso');
    preencherFormEquipe(null);
    await carregarCadastros();
    renderEquipes();
  } catch (e) { avisar(e.message, 'erro'); }
}

function renderOperadores() {
  const tbody = $('#tabela-operadores tbody');
  tbody.innerHTML = estado.operadores.length ? estado.operadores.map((o) => `<tr>
    <td><strong>${escapar(o.nome)}</strong></td>
    <td>${escapar(o.matricula || '—')}</td>
    <td>${escapar(o.equipe_nome || '—')}</td>
    <td>${escapar(o.funcao || '—')}</td>
    <td class="num">${fmtBRL(o.custo_hora)}</td>
    <td>
      <button class="btn btn-secundario btn-mini" data-editar-opr="${o.id}">Editar</button>
      <button class="btn btn-perigo btn-mini" data-excluir-opr="${o.id}">Excluir</button>
    </td>
  </tr>`).join('') : '<tr><td class="vazio-linha" colspan="6">Nenhum operador cadastrado</td></tr>';
}

function preencherFormOperador(o) {
  $('#opr-id').value = o ? o.id : '';
  $('#opr-nome').value = o ? o.nome : '';
  $('#opr-matricula').value = o ? (o.matricula || '') : '';
  $('#opr-equipe').value = o && o.equipe_id ? String(o.equipe_id) : '';
  $('#opr-funcao').value = o ? (o.funcao || '') : '';
  $('#opr-maquina').value = o ? (o.maquina || '') : '';
  $('#opr-custo').value = o ? o.custo_hora : 0;
}

async function salvarOperador(evento) {
  evento.preventDefault();
  const corpo = {
    nome: $('#opr-nome').value.trim(),
    matricula: $('#opr-matricula').value.trim() || null,
    equipe_id: $('#opr-equipe').value ? parseInt($('#opr-equipe').value, 10) : null,
    funcao: $('#opr-funcao').value.trim(),
    maquina: $('#opr-maquina').value.trim(),
    custo_hora: parseFloat($('#opr-custo').value || '0'),
  };
  try {
    if ($('#opr-id').value) await api(`/api/operadores/${$('#opr-id').value}`, { method: 'PUT', body: corpo });
    else await api('/api/operadores', { method: 'POST', body: corpo });
    avisar('Operador salvo.', 'sucesso');
    preencherFormOperador(null);
    await carregarCadastros();
    renderOperadores();
  } catch (e) { avisar(e.message, 'erro'); }
}

/* ==================================================================== boot == */

async function iniciar() {
  ligarEventos();
  $('#filtro-de').value = diasAtras(29);
  $('#filtro-ate').value = hoje();
  $('#ap-data').value = hoje();
  atualizarResumoParadas();

  $('#cm-data').value = hoje();
  try {
    await carregarCadastros();
    await carregarPainel();
  } catch (e) {
    avisar(`Falha ao carregar: ${e.message}`, 'erro');
  }
}

iniciar();
