'use strict';

/**
 * Camada de dados da versão estática (GitHub Pages).
 *
 * A interface (`aplicacao.js`) não sabe onde os dados moram: ela chama `api()`,
 * que delega para `window.API_LOCAL` quando este arquivo está carregado. Assim o
 * mesmo front-end roda contra o servidor Node ou contra o navegador.
 *
 * Diferenças reais em relação à versão com servidor, e que não dá para esconder:
 *   - os dados ficam no `localStorage` deste navegador. Não há base compartilhada:
 *     outro computador, outro navegador ou uma janela anônima começam vazios;
 *   - limpar os dados do site apaga tudo — use o backup em JSON;
 *   - não há concorrência nem transação de verdade.
 *
 * Os motores de cálculo (OEE, cronometragem, balanceamento) são os MESMOS
 * arquivos do servidor, expostos como globais. Não existe lógica duplicada.
 *
 * O esquema das tabelas é idêntico ao SQLite de propósito: o JSON exportado por
 * `GET /api/backup` no servidor carrega aqui sem nenhuma transformação.
 */

(function () {
  const CHAVE_ARMAZENAMENTO = 'eficiencia-producao-v1';

  const TABELAS = [
    'turnos', 'setores', 'maquinas', 'modelos', 'equipes', 'operadores',
    'operacoes', 'cronometragens', 'leituras_cronometro', 'apontamentos',
    'paradas', 'producao_operador', 'balancos',
  ];

  const CONFIG_PADRAO = {
    meta_oee: '0.85',
    meta_disponibilidade: '0.90',
    meta_desempenho: '0.95',
    meta_qualidade: '0.99',
    meta_defeitos_pct: '1.5',
    nome_fabrica: 'Confecção Aurora LTDA',
  };

  /* ------------------------------------------------------- armazenamento -- */

  let dados = null;

  function vazio() {
    const d = { config: [] };
    for (const t of TABELAS) d[t] = [];
    for (const [chave, valor] of Object.entries(CONFIG_PADRAO)) d.config.push({ chave, valor });
    return d;
  }

  function carregar() {
    if (dados) return dados;
    try {
      const bruto = window.localStorage.getItem(CHAVE_ARMAZENAMENTO);
      if (bruto) {
        const lido = JSON.parse(bruto);
        dados = vazio();
        for (const t of TABELAS) if (Array.isArray(lido[t])) dados[t] = lido[t];
        if (Array.isArray(lido.config) && lido.config.length) dados.config = lido.config;
        return dados;
      }
    } catch (e) {
      console.warn('não foi possível ler o armazenamento local:', e.message);
    }
    dados = vazio();
    // Primeiro acesso: usa o cenário de exemplo embutido na página pela build
    // estática. É um objeto no HTML, não um fetch — assim funciona até abrindo
    // o arquivo direto do disco, sem servidor nem CORS.
    if (typeof window.DADOS_INICIAIS !== 'undefined' && window.DADOS_INICIAIS) {
      try { importar(window.DADOS_INICIAIS); } catch (e) { console.warn('cenário inicial inválido:', e.message); }
    }
    return dados;
  }

  function persistir() {
    try {
      window.localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(dados));
      return true;
    } catch (e) {
      throw new Error(`Sem espaço no armazenamento do navegador: ${e.message}`);
    }
  }

  const tab = (nome) => carregar()[nome];
  const porId = (nome, id) => carregar()[nome].find((r) => String(r.id) === String(id)) || null;
  const numero = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const agora = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

  function proximoId(nome) {
    return carregar()[nome].reduce((m, r) => Math.max(m, numero(r.id)), 0) + 1;
  }

  function inserir(nome, objeto) {
    const linha = { id: proximoId(nome), ...objeto };
    carregar()[nome].push(linha);
    return linha;
  }

  /* ------------------------------------------------------------- config --- */

  function getConfig() {
    const cfg = { ...CONFIG_PADRAO };
    for (const l of carregar().config) cfg[l.chave] = l.valor;
    return {
      metaOee: parseFloat(cfg.meta_oee) || 0.85,
      metaDisponibilidade: parseFloat(cfg.meta_disponibilidade) || 0.9,
      metaDesempenho: parseFloat(cfg.meta_desempenho) || 0.95,
      metaQualidade: parseFloat(cfg.meta_qualidade) || 0.99,
      metaDefeitosPct: parseFloat(cfg.meta_defeitos_pct) || 1.5,
      nomeFabrica: cfg.nome_fabrica || 'Fábrica',
    };
  }

  function setConfig(pares) {
    for (const [chave, valor] of Object.entries(pares || {})) {
      const linha = carregar().config.find((c) => c.chave === chave);
      if (linha) linha.valor = String(valor);
      else carregar().config.push({ chave, valor: String(valor) });
    }
    return getConfig();
  }

  /* ---------------------------------------------- importação de snapshot -- */

  /** Carrega um JSON no formato de `GET /api/backup`. Substitui tudo. */
  function importar(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') throw new Error('Conteúdo do backup inválido');
    if (!snapshot.tabelas || typeof snapshot.tabelas !== 'object') throw new Error('Backup sem a seção "tabelas"');
    const novo = vazio();
    let achou = false;
    for (const t of TABELAS) {
      if (Array.isArray(snapshot.tabelas[t])) { novo[t] = snapshot.tabelas[t].map((r) => ({ ...r })); achou = true; }
    }
    if (Array.isArray(snapshot.tabelas.config) && snapshot.tabelas.config.length) {
      novo.config = snapshot.tabelas.config.map((r) => ({ ...r }));
      achou = true;
    }
    if (!achou) throw new Error('Nenhuma tabela conhecida encontrada no backup');
    dados = novo;
    persistir();
    return { tabelas: TABELAS.filter((t) => Array.isArray(snapshot.tabelas[t])).length };
  }

  function exportar() {
    carregar();
    const tabelas = {};
    const contagem = {};
    for (const t of [...TABELAS, 'config']) {
      tabelas[t] = dados[t].map((r) => ({ ...r }));
      contagem[t] = dados[t].length;
    }
    return { versao: 1, geradoEm: new Date().toISOString(), contagem, tabelas };
  }

  /* ------------------------------------------------------------ erros ----- */

  class HttpErro extends Error {
    constructor(status, mensagem) { super(mensagem); this.status = status; }
  }
  function exigir(condicao, mensagem, status = 400) {
    if (!condicao) throw new HttpErro(status, mensagem);
  }

  /* ------------------------------------------------- join de apontamento -- */

  function linhaApontamento(a) {
    const m = porId('maquinas', a.maquina_id) || {};
    const t = porId('turnos', a.turno_id) || {};
    const mo = porId('modelos', a.modelo_id);
    return {
      id: a.id, data: a.data, maquina_id: a.maquina_id, turno_id: a.turno_id, modelo_id: a.modelo_id,
      lider: a.lider, pecas_produzidas: a.pecas_produzidas, pecas_defeito: a.pecas_defeito,
      pecas_retrabalho: a.pecas_retrabalho, observacao: a.observacao,
      criado_em: a.criado_em, atualizado_em: a.atualizado_em,
      maquina: m.nome, setor: m.setor, maquina_tipo: m.tipo, operadores: m.operadores,
      custo_hora: m.custo_hora, meta_oee_maquina: m.meta_oee,
      turno: t.nome, minutos_totais: t.minutos_totais, pausas_planejadas: t.pausas_planejadas,
      hora_inicio: t.hora_inicio,
      modelo_codigo: mo ? mo.codigo : null, modelo_nome: mo ? mo.nome : null,
      modelo_categoria: mo ? mo.categoria : null, sam_min: mo ? mo.sam_min : null,
    };
  }

  const paradasDe = (apontamentoId) =>
    tab('paradas').filter((p) => String(p.apontamento_id) === String(apontamentoId))
      .map((p) => ({ motivo: p.motivo, minutos: p.minutos, descricao: p.descricao }));

  function paraInputOEE(l, paradas) {
    return {
      minutosTurno: l.minutos_totais,
      pausasPlanejadasTurno: l.pausas_planejadas,
      paradas,
      pecasProduzidas: l.pecas_produzidas,
      pecasDefeito: l.pecas_defeito,
      pecasRetrabalho: l.pecas_retrabalho,
      samMin: l.sam_min,
      operadores: l.operadores,
      custoHoraCelula: l.custo_hora,
    };
  }

  function detalharApontamento(l, paradas) {
    const evs = paradas || paradasDe(l.id);
    return {
      id: l.id, data: l.data, maquinaId: l.maquina_id, maquina: l.maquina, setor: l.setor,
      turnoId: l.turno_id, turno: l.turno, modeloId: l.modelo_id, modeloCodigo: l.modelo_codigo,
      modeloNome: l.modelo_nome, modeloCategoria: l.modelo_categoria, samMin: l.sam_min,
      operadores: l.operadores, lider: l.lider,
      pecasProduzidas: l.pecas_produzidas, pecasDefeito: l.pecas_defeito,
      pecasRetrabalho: l.pecas_retrabalho, observacao: l.observacao,
      paradas: evs,
      indicadores: window.OEE.calcularOEE(paraInputOEE(l, evs)),
    };
  }

  function listarApontamentos(f = {}) {
    let linhas = tab('apontamentos').map(linhaApontamento);
    if (f.de) linhas = linhas.filter((l) => l.data >= f.de);
    if (f.ate) linhas = linhas.filter((l) => l.data <= f.ate);
    if (f.maquinaId) linhas = linhas.filter((l) => String(l.maquina_id) === String(f.maquinaId));
    if (f.setor) linhas = linhas.filter((l) => l.setor === f.setor);
    linhas.sort((a, b) =>
      (a.data < b.data ? 1 : a.data > b.data ? -1 : 0) ||
      (String(a.maquina) < String(b.maquina) ? -1 : String(a.maquina) > String(b.maquina) ? 1 : 0) ||
      String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
    if (f.limite) linhas = linhas.slice(0, Math.max(1, parseInt(f.limite, 10)));
    return linhas.map((l) => detalharApontamento(l));
  }

  const obterApontamento = (id) => {
    const a = porId('apontamentos', id);
    return a ? detalharApontamento(linhaApontamento(a)) : null;
  };

  function resolverPeriodo(f = {}) {
    if (f.de && f.ate) return { de: f.de, ate: f.ate };
    const datas = tab('apontamentos').map((a) => a.data).sort();
    const ate = f.ate || datas[datas.length - 1] || new Date().toISOString().slice(0, 10);
    const d = new Date(ate + 'T00:00:00');
    d.setDate(d.getDate() - 29);
    return { de: f.de || d.toISOString().slice(0, 10), ate };
  }

  /* --------------------------------------------------------- dashboard --- */

  function dashboard(f = {}) {
    const metas = getConfig();
    const { de, ate } = resolverPeriodo(f);
    const detalhados = listarApontamentos({ ...f, de, ate })
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0) ||
        (String(a.maquina) < String(b.maquina) ? -1 : String(a.maquina) > String(b.maquina) ? 1 : 0));
    const geral = window.OEE.agregarOEE(detalhados.map((d) => d.indicadores));

    const porDia = new Map();
    for (const d of detalhados) {
      if (!porDia.has(d.data)) porDia.set(d.data, []);
      porDia.get(d.data).push(d.indicadores);
    }
    const tendencia = [...porDia.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([data, rs]) => {
        const g = window.OEE.agregarOEE(rs);
        return {
          data, oeePct: g.oeePct, disponibilidadePct: g.disponibilidadePct,
          desempenhoPct: g.desempenhoPct, qualidadePct: g.qualidadePct,
          pecasProduzidas: g.pecasProduzidas, pecasDefeito: g.pecasDefeito, apontamentos: rs.length,
        };
      });

    const porMaquina = new Map();
    for (const d of detalhados) {
      if (!porMaquina.has(d.maquinaId)) porMaquina.set(d.maquinaId, { maquinaId: d.maquinaId, maquina: d.maquina, setor: d.setor, resultados: [] });
      porMaquina.get(d.maquinaId).resultados.push(d.indicadores);
    }
    const ranking = [...porMaquina.values()].map((item) => {
      const g = window.OEE.agregarOEE(item.resultados);
      const m = porId('maquinas', item.maquinaId);
      const meta = m ? m.meta_oee : metas.metaOee;
      return {
        maquinaId: item.maquinaId, maquina: item.maquina, setor: item.setor,
        apontamentos: g.quantidade, oeePct: g.oeePct, disponibilidadePct: g.disponibilidadePct,
        desempenhoPct: g.desempenhoPct, qualidadePct: g.qualidadePct,
        pecasProduzidas: g.pecasProduzidas, pecasDefeito: g.pecasDefeito,
        taxaDefeitosPct: g.taxaDefeitosPct, producaoHora: g.producaoHora,
        paradasNaoPlanejadas: g.paradasNaoPlanejadas, tempoPlanejado: g.tempoPlanejado,
        custoPerdaTotal: g.custoPerdaTotal,
        pecasPerdidasTotal: g.tempoProduzidoMin > 0 && g.pecasProduzidas > 0
          ? g.minutosPerdaTotal / (g.tempoProduzidoMin / g.pecasProduzidas) : 0,
        metaOee: meta, gapMeta: g.oeePct - meta * 100,
      };
    }).sort((a, b) => b.oeePct - a.oeePct);

    const porModelo = new Map();
    for (const d of detalhados) {
      const chave = d.modeloId || 0;
      if (!porModelo.has(chave)) {
        porModelo.set(chave, {
          modeloId: chave, modeloCodigo: d.modeloCodigo || '—',
          modeloNome: d.modeloNome || 'Sem modelo', categoria: d.modeloCategoria || '', resultados: [],
        });
      }
      porModelo.get(chave).resultados.push(d.indicadores);
    }
    const modelos = [...porModelo.values()].map((item) => {
      const g = window.OEE.agregarOEE(item.resultados);
      return {
        modeloId: item.modeloId, modeloCodigo: item.modeloCodigo, modeloNome: item.modeloNome,
        categoria: item.categoria, oeePct: g.oeePct, desempenhoPct: g.desempenhoPct,
        pecasProduzidas: g.pecasProduzidas, pecasDefeito: g.pecasDefeito,
        taxaDefeitosPct: g.taxaDefeitosPct, producaoHora: g.producaoHora,
      };
    }).sort((a, b) => b.pecasProduzidas - a.pecasProduzidas);

    return {
      periodo: { de, ate }, metas,
      geral: {
        oeePct: geral.oeePct, disponibilidadePct: geral.disponibilidadePct,
        desempenhoPct: geral.desempenhoPct, qualidadePct: geral.qualidadePct,
        pecasProduzidas: geral.pecasProduzidas, pecasBoas: geral.pecasBoas,
        pecasDefeito: geral.pecasDefeito, taxaDefeitosPct: geral.taxaDefeitosPct,
        producaoHora: geral.producaoHora, tempoPlanejado: geral.tempoPlanejado,
        tempoOperacao: geral.tempoOperacao, paradasNaoPlanejadas: geral.paradasNaoPlanejadas,
        paradasPlanejadas: geral.paradasPlanejadas, minutosPerdaTotal: geral.minutosPerdaTotal,
        custoPerdaTotal: geral.custoPerdaTotal, custoPerdaDisponibilidade: geral.custoPerdaDisponibilidade,
        custoPerdaDesempenho: geral.custoPerdaDesempenho, custoPerdaQualidade: geral.custoPerdaQualidade,
        apontamentos: geral.quantidade, gapMeta: geral.oeePct - metas.metaOee * 100,
      },
      tendencia, ranking, modelos,
      paretoParadas: geral.porMotivo,
      seisPerdas: geral.seisPerdas,
      perdasPorGrupo: [
        { codigo: 'DISPONIBILIDADE', rotulo: 'Indisponibilidade', minutos: geral.minutosPerdaDisponibilidade, custo: geral.custoPerdaDisponibilidade },
        { codigo: 'DESEMPENHO', rotulo: 'Ritmo abaixo do padrão', minutos: geral.minutosPerdaDesempenho, custo: geral.custoPerdaDesempenho },
        { codigo: 'QUALIDADE', rotulo: 'Defeitos e refugo', minutos: geral.minutosPerdaQualidade, custo: geral.custoPerdaQualidade },
      ],
    };
  }

  /* ------------------------------------------------ sequencia/cronometro -- */

  const leiturasDe = (cronometragemId) =>
    tab('leituras_cronometro').filter((l) => String(l.cronometragem_id) === String(cronometragemId))
      .map((l) => l.segundos);

  function detalharCronometragem(linha) {
    const leituras = leiturasDe(linha.id);
    const operador = porId('operadores', linha.operador_id);
    return {
      id: linha.id, operacaoId: linha.operacao_id, operadorId: linha.operador_id,
      operadorNome: operador ? operador.nome : null, data: linha.data, leituras,
      fatorRitmo: linha.fator_ritmo, toleranciaPct: linha.tolerancia_pct,
      observacao: linha.observacao,
      resumo: window.Tempos.resumirCronometragem({
        leituras, fatorRitmo: linha.fator_ritmo, toleranciaPct: linha.tolerancia_pct,
      }),
    };
  }

  function cronometragemVigente(operacaoId) {
    const candidatas = tab('cronometragens')
      .filter((c) => String(c.operacao_id) === String(operacaoId))
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : numero(b.id) - numero(a.id)));
    return candidatas.length ? detalharCronometragem(candidatas[0]) : null;
  }

  function listarSequencia(modeloId) {
    const modelo = porId('modelos', modeloId);
    if (!modelo) return null;
    const operacoes = tab('operacoes')
      .filter((o) => String(o.modelo_id) === String(modeloId))
      .sort((a, b) => numero(a.sequencia) - numero(b.sequencia))
      .map((op) => {
        const crono = cronometragemVigente(op.id);
        const tempoPadraoS = crono ? crono.resumo.tempoPadrao : op.tempo_padrao;
        return {
          id: op.id, modeloId: op.modelo_id, sequencia: op.sequencia, codigo: op.codigo,
          descricao: op.descricao, maquina: op.maquina, secao: op.secao, dificuldade: op.dificuldade,
          tempoPadraoSeg: tempoPadraoS, tempoPadraoMin: tempoPadraoS / 60,
          temCronometragem: Boolean(crono),
          cronometragemVigente: crono ? {
            id: crono.id, data: crono.data, operadorNome: crono.operadorNome,
            fatorRitmo: crono.fatorRitmo, toleranciaPct: crono.toleranciaPct,
            tempoObservadoMedio: crono.resumo.tempoObservadoMedio, tempoNormal: crono.resumo.tempoNormal,
            tempoPadrao: crono.resumo.tempoPadrao, coeficienteVariacaoPct: crono.resumo.coeficienteVariacaoPct,
            quantidadeLeituras: crono.resumo.quantidadeLeituras, confiavel: crono.resumo.confiavel,
            aviso: crono.resumo.aviso,
          } : null,
        };
      });

    const samCalculado = window.Tempos.samDaSequencia(operacoes.map((o) => ({ tempoPadraoMin: o.tempoPadraoMin })));
    return {
      modelo: { id: modelo.id, codigo: modelo.codigo, nome: modelo.nome, categoria: modelo.categoria, samMin: modelo.sam_min },
      operacoes,
      samCalculadoMin: samCalculado,
      samCadastradoMin: modelo.sam_min,
      divergenciaMin: samCalculado - modelo.sam_min,
      divergenciaPct: modelo.sam_min > 0 ? ((samCalculado - modelo.sam_min) / modelo.sam_min) * 100 : 0,
      totalOperacoes: operacoes.length,
      operacoesSemCronometragem: operacoes.filter((o) => !o.temCronometragem).length,
    };
  }

  function recalcularSam(modeloId) {
    const seq = listarSequencia(modeloId);
    if (!seq) return null;
    porId('modelos', modeloId).sam_min = seq.samCalculadoMin;
    persistir();
    return { ...seq, modelo: { ...seq.modelo, samMin: seq.samCalculadoMin }, divergenciaMin: 0, divergenciaPct: 0 };
  }

  function listarCronometragens(f = {}) {
    return tab('cronometragens')
      .map((c) => {
        const op = porId('operacoes', c.operacao_id);
        const mo = op ? porId('modelos', op.modelo_id) : null;
        return { c, op, mo };
      })
      .filter(({ c, op, mo }) => {
        if (f.operacaoId && String(c.operacao_id) !== String(f.operacaoId)) return false;
        if (f.modeloId && (!op || String(op.modelo_id) !== String(f.modeloId))) return false;
        if (f.de && c.data < f.de) return false;
        if (f.ate && c.data > f.ate) return false;
        return Boolean(op && mo);
      })
      .sort((a, b) => (a.c.data < b.c.data ? 1 : a.c.data > b.c.data ? -1 : numero(b.c.id) - numero(a.c.id)))
      .map(({ c, op, mo }) => ({
        ...detalharCronometragem(c),
        operacaoDescricao: op.descricao,
        operacaoSequencia: op.sequencia,
        modeloCodigo: mo.codigo,
        modeloNome: mo.nome,
      }));
  }

  const operacoesParaBalanceamento = (modeloId) =>
    tab('operacoes').filter((o) => String(o.modelo_id) === String(modeloId))
      .sort((a, b) => numero(a.sequencia) - numero(b.sequencia))
      .map((op) => ({
        id: op.id, sequencia: op.sequencia, codigo: op.codigo, descricao: op.descricao,
        maquina: op.maquina, secao: op.secao, tempoPadraoMin: op.tempo_padrao / 60,
      }));

  /* --------------------------------------------------- produção individual -- */

  function listarProducaoIndividual(f = {}) {
    return tab('producao_operador')
      .map((po) => {
        const a = porId('apontamentos', po.apontamento_id);
        const o = porId('operadores', po.operador_id);
        if (!a || !o) return null;
        const e = porId('equipes', o.equipe_id);
        const m = porId('maquinas', a.maquina_id);
        const t = porId('turnos', a.turno_id);
        const mo = porId('modelos', a.modelo_id);
        const opx = po.operacao_id ? porId('operacoes', po.operacao_id) : null;
        return { po, a, o, e, m, t, mo, opx };
      })
      .filter(Boolean)
      .filter(({ po, a, o }) => {
        if (f.de && a.data < f.de) return false;
        if (f.ate && a.data > f.ate) return false;
        if (f.equipeId && String(o.equipe_id) !== String(f.equipeId)) return false;
        if (f.operadorId && String(po.operador_id) !== String(f.operadorId)) return false;
        if (f.maquinaId && String(a.maquina_id) !== String(f.maquinaId)) return false;
        if (f.modeloId && String(a.modelo_id) !== String(f.modeloId)) return false;
        if (f.apontamentoId && String(po.apontamento_id) !== String(f.apontamentoId)) return false;
        return true;
      })
      .sort((a, b) => (a.a.data < b.a.data ? -1 : a.a.data > b.a.data ? 1 : 0) ||
        (String(a.o.nome) < String(b.o.nome) ? -1 : String(a.o.nome) > String(b.o.nome) ? 1 : 0))
      .map(({ po, a, o, e, m, t, mo, opx }) => {
        const temPosto = numero(po.tempo_padrao_min) > 0;
        const usaOperacao = !temPosto && po.operacao_id != null && numero(opx && opx.tempo_padrao) > 0;
        const minutosPadraoUnit = temPosto
          ? numero(po.tempo_padrao_min)
          : usaOperacao ? numero(opx.tempo_padrao) / 60 : numero(mo && mo.sam_min);
        const minutosPadrao = numero(po.pecas) * minutosPadraoUnit;
        const minutos = numero(po.minutos);
        return {
          id: po.id, apontamentoId: po.apontamento_id, data: a.data,
          mes: a.data ? a.data.slice(0, 7) : '',
          operadorId: po.operador_id, operador: o.nome, matricula: o.matricula, funcao: o.funcao,
          equipeId: o.equipe_id, equipe: (e && e.nome) || 'Sem equipe', equipeSetor: (e && e.setor) || '',
          maquinaId: a.maquina_id, maquina: m && m.nome, turno: t && t.nome,
          modeloCodigo: mo && mo.codigo, modeloNome: mo && mo.nome,
          operacaoId: po.operacao_id, operacaoDescricao: opx && opx.descricao,
          minutos, pecas: numero(po.pecas), defeitos: numero(po.defeitos),
          minutosPadrao, minutosPadraoUnit,
          pecasHora: minutos > 0 ? numero(po.pecas) / (minutos / 60) : 0,
          eficiencia: minutos > 0 && minutosPadrao > 0 ? minutosPadrao / minutos : 0,
          eficienciaPct: minutos > 0 && minutosPadrao > 0 ? (minutosPadrao / minutos) * 100 : 0,
          taxaDefeitosPct: numero(po.pecas) > 0 ? (numero(po.defeitos) / numero(po.pecas)) * 100 : 0,
          semPadrao: minutosPadraoUnit <= 0,
          basePadrao: temPosto ? 'POSTO' : usaOperacao ? 'OPERACAO' : 'SAM_DO_MODELO',
        };
      });
  }

  function agregar(registros) {
    const a = { pecas: 0, defeitos: 0, minutos: 0, minutosPadrao: 0, semPadrao: 0, registros: 0 };
    for (const r of registros) {
      a.registros += 1; a.pecas += r.pecas; a.defeitos += r.defeitos;
      a.minutos += r.minutos; a.minutosPadrao += r.minutosPadrao;
      if (r.semPadrao) a.semPadrao += 1;
    }
    a.pecasHora = a.minutos > 0 ? a.pecas / (a.minutos / 60) : 0;
    a.eficiencia = a.minutos > 0 && a.minutosPadrao > 0 ? a.minutosPadrao / a.minutos : 0;
    a.eficienciaPct = a.eficiencia * 100;
    a.taxaDefeitosPct = a.pecas > 0 ? (a.defeitos / a.pecas) * 100 : 0;
    a.horas = a.minutos / 60;
    return a;
  }

  function agruparPor(registros, chave) {
    const mapa = new Map();
    for (const r of registros) {
      const k = r[chave] ?? '—';
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(r);
    }
    return mapa;
  }

  const unicos = (regs, campo) => new Set(regs.map((r) => r[campo])).size;

  function acompanhamento(f = {}) {
    const metas = getConfig();
    const registros = listarProducaoIndividual(f);
    const resumo = agregar(registros);

    const porDia = [...agruparPor(registros, 'data').entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([data, regs]) => ({
        data,
        diaSemana: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(data + 'T12:00:00').getDay()],
        ...agregar(regs), operadores: unicos(regs, 'operadorId'),
      }));

    const porMes = [...agruparPor(registros, 'mes').entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([mes, regs]) => ({
        mes, rotulo: mes, ...agregar(regs),
        operadores: unicos(regs, 'operadorId'), dias: unicos(regs, 'data'),
      }));

    const porOperador = [...agruparPor(registros, 'operadorId').entries()]
      .map(([operadorId, regs]) => ({
        operadorId, operador: regs[0].operador, matricula: regs[0].matricula, funcao: regs[0].funcao,
        equipeId: regs[0].equipeId, equipe: regs[0].equipe,
        basePadrao: new Set(regs.map((r) => r.basePadrao)).size > 1 ? 'MISTA' : regs[0].basePadrao,
        diasTrabalhados: unicos(regs, 'data'), ...agregar(regs),
      }))
      .sort((a, b) => b.eficienciaPct - a.eficienciaPct);

    const porEquipe = [...agruparPor(registros, 'equipe').entries()]
      .map(([equipe, regs]) => {
        const g = agregar(regs);
        return {
          equipe, equipeId: regs[0].equipeId, setor: regs[0].equipeSetor, lider: null,
          operadores: unicos(regs, 'operadorId'), dias: unicos(regs, 'data'), ...g,
          pecasPorOperadorHora: g.minutos > 0 ? g.pecas / (g.minutos / 60) : 0,
        };
      })
      .sort((a, b) => b.pecas - a.pecas);

    const porLinha = [...agruparPor(registros, 'maquina').entries()]
      .map(([maquina, regs]) => ({ maquina, maquinaId: regs[0].maquinaId, ...agregar(regs) }))
      .sort((a, b) => b.pecas - a.pecas);

    const porModelo = [...agruparPor(registros, 'modeloNome').entries()]
      .map(([modeloNome, regs]) => ({ modeloNome: modeloNome || '—', modeloCodigo: regs[0].modeloCodigo, ...agregar(regs) }))
      .sort((a, b) => b.pecas - a.pecas);

    const dias = unicos(registros, 'data');
    return {
      metas, filtros: f,
      resumo: {
        ...resumo,
        operadores: unicos(registros, 'operadorId'),
        equipes: unicos(registros, 'equipe'),
        dias,
        pecasPorDia: dias > 0 ? resumo.pecas / dias : 0,
      },
      porDia, porMes, porOperador, porEquipe, porLinha, porModelo,
      registros: registros.length,
    };
  }

  /* ------------------------------------------------------------ CSV ------- */

  const csvEscape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  function csvApontamentos(f = {}) {
    const lista = listarApontamentos(f);
    const cab = ['Data', 'Linha/Célula', 'Setor', 'Turno', 'Modelo', 'SAM (min)', 'Operadores',
      'Peças produzidas', 'Peças defeito', 'Taxa defeito (%)', 'Disponibilidade (%)', 'Desempenho (%)',
      'Qualidade (%)', 'OEE (%)', 'Peças/hora', 'Paradas não planejadas (min)', 'Custo da perda (R$)'];
    const linhas = lista.map((a) => {
      const i = a.indicadores;
      return [a.data, a.maquina, a.setor, a.turno, a.modeloNome || '', a.samMin ?? '', a.operadores,
        a.pecasProduzidas, a.pecasDefeito, i.taxaDefeitosPct.toFixed(2), i.disponibilidadePct.toFixed(2),
        i.desempenhoPct.toFixed(2), i.qualidadePct.toFixed(2), i.oeePct.toFixed(2), i.producaoHora.toFixed(2),
        i.paradasNaoPlanejadas, i.custoPerdaTotal.toFixed(2)]
        .map((v) => (typeof v === 'number' ? String(v).replace('.', ',') : csvEscape(v)))
        .join(';');
    });
    return '\uFEFF' + [cab.join(';'), ...linhas].join('\r\n');
  }

  window.BancoLocal = {
    TABELAS, HttpErro, carregar, persistir, importar, exportar, getConfig, setConfig,
    tab, porId, inserir, proximoId,
    listarApontamentos, obterApontamento, detalharApontamento, dashboard, resolverPeriodo,
    acompanhamento, listarProducaoIndividual, agregar,
    listarSequencia, recalcularSam, listarCronometragens, cronometragemVigente,
    detalharCronometragem, leiturasDe, operacoesParaBalanceamento,
    csvApontamentos, exigir,
  };
})();
