'use strict';

/**
 * Implementa a superfície REST do servidor dentro do navegador.
 *
 * `aplicacao.js` chama `api(caminho, opcoes)`, que delega para `window.API_LOCAL`
 * quando este arquivo está carregado. Os caminhos, os nomes dos campos e as
 * mensagens de erro são os mesmos do servidor — de propósito, para que o
 * front-end seja literalmente o mesmo nos dois modos.
 */

(function () {
  const B = window.BancoLocal;
  const { exigir, HttpErro } = B;

  const num = (v, padrao = 0) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : padrao;
  };
  const int = (v, padrao = 0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : padrao;
  };
  // Igual à do servidor: o formato não basta — 2026-13-45 casa com a regex
  // mas não é uma data. O Date.parse é o que pega esses casos.
  const dataValida = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
    && !Number.isNaN(Date.parse(s + 'T00:00:00'));
  const MOTIVOS = window.OEE.MOTIVOS_PARADA;

  /* ------------------------------------------------- validação de apont. -- */

  function validarApontamento(c, parcial = false) {
    const dados = {};
    if (!parcial || c.data !== undefined) {
      exigir(dataValida(c.data), 'Data inválida (use AAAA-MM-DD)');
      dados.data = c.data;
    }
    if (!parcial || c.maquina_id !== undefined) {
      const m = B.porId('maquinas', int(c.maquina_id));
      exigir(m, 'Linha/célula não encontrada');
      dados.maquina_id = m.id; dados._maquina = m;
    }
    if (!parcial || c.turno_id !== undefined) {
      const t = B.porId('turnos', int(c.turno_id));
      exigir(t, 'Turno não encontrado');
      dados.turno_id = t.id; dados._turno = t;
    }
    if (c.modelo_id !== undefined && c.modelo_id !== null && c.modelo_id !== '') {
      const mo = B.porId('modelos', int(c.modelo_id));
      exigir(mo, 'Modelo não encontrado');
      dados.modelo_id = mo.id;
    } else if (!parcial) dados.modelo_id = null;

    if (c.lider !== undefined) dados.lider = String(c.lider).slice(0, 80);
    if (c.observacao !== undefined) dados.observacao = String(c.observacao).slice(0, 500);
    if (!parcial || c.pecas_produzidas !== undefined) dados.pecas_produzidas = Math.max(0, int(c.pecas_produzidas));
    if (!parcial || c.pecas_defeito !== undefined) dados.pecas_defeito = Math.max(0, int(c.pecas_defeito));
    if (!parcial || c.pecas_retrabalho !== undefined) dados.pecas_retrabalho = Math.max(0, int(c.pecas_retrabalho));

    if (c.paradas !== undefined) {
      exigir(Array.isArray(c.paradas), 'paradas deve ser uma lista');
      dados.paradas = c.paradas
        .map((p) => ({
          motivo: String(p.motivo || '').toUpperCase(),
          minutos: Math.max(0, num(p.minutos)),
          descricao: String(p.descricao || '').slice(0, 300),
        }))
        .filter((p) => p.minutos > 0);
      const validos = new Set(MOTIVOS.map((m) => m.codigo));
      for (const p of dados.paradas) exigir(validos.has(p.motivo), `Motivo de parada inválido: ${p.motivo}`);
    }
    return dados;
  }

  function validarTotalParadas(dados) {
    const turno = dados._turno;
    if (!turno) return;
    const total = (dados.paradas || []).reduce((s, p) => s + p.minutos, 0);
    exigir(total <= turno.minutos_totais,
      `Soma das paradas (${total} min) excede a duração do turno (${turno.minutos_totais} min)`);
  }

  /* ------------------------------------------------------------- rotas ---- */

  /** Marca uma resposta com status diferente do padrão do método. */
  const comStatus = (status, corpo) => ({ __status: status, __corpo: corpo });

  const ROTAS = [];
  function rota(metodo, padrao, fn) {
    const chaves = [];
    const regex = new RegExp('^' + padrao.replace(/:[a-zA-Z]+/g, (m) => {
      chaves.push(m.slice(1));
      return '([^/]+)';
    }) + '/?$');
    ROTAS.push({ metodo, regex, chaves, fn });
  }

  /**
   * Ordena como o SQLite faz com a collation BINARY padrão: comparação byte a
   * byte, sem consciência de idioma. Usar localeCompare aqui faria "Débora"
   * vir antes de "Diego", divergindo do servidor.
   */
  function ordenarPor(arr, ...campos) {
    return [...arr].sort((a, b) => {
      for (const campo of campos) {
        const x = String(a[campo] ?? '');
        const y = String(b[campo] ?? '');
        if (x < y) return -1;
        if (x > y) return 1;
      }
      return 0;
    });
  }

  /* ---- catálogos e metas ---- */
  rota('GET', '/api/health', () => ({ status: 'ok', servico: 'eficiencia-producao-estatico', quando: new Date().toISOString() }));

  rota('GET', '/api/catalogos', () => ({
    motivosParada: MOTIVOS,
    seisPerdas: window.OEE.SEIS_GRANDES_PERDAS,
    setores: ordenarPor(B.tab('setores'), 'nome').map((s) => s.nome),
    metas: B.getConfig(),
  }));

  rota('GET', '/api/metas', () => B.getConfig());

  rota('PUT', '/api/metas', (_p, c) => {
    const pares = {};
    if (c.metaOee !== undefined) {
      const v = num(c.metaOee);
      exigir(v > 0 && v <= 1, 'metaOee deve estar entre 0 e 1');
      pares.meta_oee = v;
    }
    if (c.metaDisponibilidade !== undefined) pares.meta_disponibilidade = num(c.metaDisponibilidade);
    if (c.metaDesempenho !== undefined) pares.meta_desempenho = num(c.metaDesempenho);
    if (c.metaQualidade !== undefined) pares.meta_qualidade = num(c.metaQualidade);
    if (c.metaDefeitosPct !== undefined) pares.meta_defeitos_pct = num(c.metaDefeitosPct);
    if (c.nomeFabrica !== undefined) pares.nome_fabrica = String(c.nomeFabrica).slice(0, 120);
    B.setConfig(pares); B.persistir();
    return B.getConfig();
  });

  /* ---- CRUD simples ---- */
  function crudSimples(recurso, singular, preparar, aoExcluir) {
    const ordem = recurso === 'turnos' ? ['hora_inicio']
      : recurso === 'maquinas' ? ['setor', 'nome'] : ['nome'];
    rota('GET', `/api/${recurso}`, () => ordenarPor(B.tab(recurso), ...ordem));
    rota('POST', `/api/${recurso}`, (_p, c) => {
      const linha = B.inserir(recurso, { ...preparar(c), criado_em: new Date().toISOString().slice(0, 19).replace('T', ' ') });
      B.persistir();
      return linha;
    });
    rota('PUT', `/api/${recurso}/:id`, (p, c) => {
      const atual = B.porId(recurso, int(p.id));
      exigir(atual, `${singular} não encontrad${recurso === 'maquinas' ? 'a' : 'o'}`, 404);
      Object.assign(atual, preparar(c, atual));
      B.persistir();
      return atual;
    });
    rota('DELETE', `/api/${recurso}/:id`, (p) => {
      const atual = B.porId(recurso, int(p.id));
      exigir(atual, `${singular} não encontrad${recurso === 'maquinas' ? 'a' : 'o'}`, 404);
      if (aoExcluir) aoExcluir(atual);
      const lista = B.tab(recurso);
      lista.splice(lista.indexOf(atual), 1);
      B.persistir();
      return { excluido: 1 };
    });
  }

  const emUsoPorApontamentos = (campo, id) =>
    B.tab('apontamentos').some((a) => String(a[campo]) === String(id));

  crudSimples('turnos', 'Turno', (c) => {
    exigir(c.nome && String(c.nome).trim(), 'Informe o nome do turno');
    const ini = String(c.hora_inicio || '06:00');
    const fim = String(c.hora_fim || '14:00');
    const minutos = int(c.minutos_totais, 480);
    exigir(minutos > 0, 'minutos_totais deve ser maior que zero');
    return {
      nome: String(c.nome).trim(), hora_inicio: ini, hora_fim: fim,
      minutos_totais: minutos, pausas_planejadas: Math.max(0, int(c.pausas_planejadas)),
      ativo: c.ativo === undefined ? 1 : (c.ativo ? 1 : 0),
    };
  }, (t) => exigir(!emUsoPorApontamentos('turno_id', t.id),
    'Turno em uso por apontamentos — não pode ser excluído', 409));

  crudSimples('maquinas', 'Linha', (c) => {
    exigir(c.nome && String(c.nome).trim(), 'Informe o nome da linha/célula');
    return {
      nome: String(c.nome).trim(), setor: String(c.setor || '').trim(), tipo: String(c.tipo || '').trim(),
      operadores: Math.max(1, int(c.operadores, 1)), custo_hora: Math.max(0, num(c.custo_hora)),
      meta_oee: num(c.meta_oee, 0.85), ativo: c.ativo === undefined ? 1 : (c.ativo ? 1 : 0),
      observacao: String(c.observacao || '').slice(0, 300),
    };
  }, (m) => exigir(!emUsoPorApontamentos('maquina_id', m.id),
    'Linha em uso por apontamentos — não pode ser excluída', 409));

  rota('GET', '/api/modelos', () => ordenarPor(B.tab('modelos'), 'codigo'));
  rota('POST', '/api/modelos', (_p, c) => {
    exigir(c.codigo && String(c.codigo).trim(), 'Informe o código do modelo');
    exigir(c.nome && String(c.nome).trim(), 'Informe o nome do modelo');
    // Ordem igual à do servidor: o SAM é validado antes da unicidade do código.
    const sam = num(c.sam_min);
    exigir(sam > 0, 'SAM deve ser maior que zero');
    const codigo = String(c.codigo).trim().toUpperCase();
    exigir(!B.tab('modelos').some((m) => m.codigo === codigo), 'Já existe um modelo com este código', 409);
    const linha = B.inserir('modelos', {
      codigo, nome: String(c.nome).trim(), categoria: String(c.categoria || ''),
      sam_min: sam, preco_venda: Math.max(0, num(c.preco_venda)),
      ativo: 1,
      criado_em: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    B.persistir();
    return linha;
  });
  rota('PUT', '/api/modelos/:id', (p, c) => {
    const m = B.porId('modelos', int(p.id));
    exigir(m, 'Modelo não encontrado', 404);
    const sam = c.sam_min !== undefined ? num(c.sam_min) : m.sam_min;
    exigir(sam > 0, 'SAM deve ser maior que zero');
    if (c.codigo !== undefined) {
      const codigo = String(c.codigo).trim().toUpperCase();
      exigir(!B.tab('modelos').some((x) => x.codigo === codigo && x.id !== m.id),
        'Já existe um modelo com este código', 409);
      m.codigo = codigo;
    }
    if (c.nome !== undefined) m.nome = String(c.nome).trim();
    if (c.categoria !== undefined) m.categoria = String(c.categoria);
    m.sam_min = sam;
    if (c.preco_venda !== undefined) m.preco_venda = Math.max(0, num(c.preco_venda));
    if (c.ativo !== undefined) m.ativo = c.ativo ? 1 : 0;
    B.persistir();
    return m;
  });
  rota('DELETE', '/api/modelos/:id', (p) => {
    const m = B.porId('modelos', int(p.id));
    exigir(m, 'Modelo não encontrado', 404);
    exigir(!emUsoPorApontamentos('modelo_id', m.id), 'Modelo em uso por apontamentos — não pode ser excluído', 409);
    B.tab('modelos').splice(B.tab('modelos').indexOf(m), 1);
    B.persistir();
    return { excluido: 1 };
  });

  /* ---- equipes e operadores ---- */
  const contarOperadores = (equipeId) =>
    B.tab('operadores').filter((o) => String(o.equipe_id) === String(equipeId)).length;

  rota('GET', '/api/equipes', () =>
    ordenarPor(B.tab('equipes'), 'nome').map((e) => ({ ...e, operadores: contarOperadores(e.id) })));
  rota('POST', '/api/equipes', (_p, c) => {
    exigir(c.nome && String(c.nome).trim(), 'Informe o nome da equipe');
    const nome = String(c.nome).trim();
    exigir(!B.tab('equipes').some((e) => e.nome === nome), 'Já existe uma equipe com este nome', 409);
    const linha = B.inserir('equipes', {
      nome, setor: String(c.setor || '').trim(), lider: String(c.lider || '').trim(), ativo: 1,
      criado_em: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    B.persistir();
    return linha;
  });
  rota('PUT', '/api/equipes/:id', (p, c) => {
    const e = B.porId('equipes', int(p.id));
    exigir(e, 'Equipe não encontrada', 404);
    if (c.nome !== undefined) {
      const nome = String(c.nome).trim();
      exigir(nome, 'Informe o nome da equipe');
      exigir(!B.tab('equipes').some((x) => x.nome === nome && x.id !== e.id), 'Já existe uma equipe com este nome', 409);
      e.nome = nome;
    }
    if (c.setor !== undefined) e.setor = String(c.setor).trim();
    if (c.lider !== undefined) e.lider = String(c.lider).trim();
    B.persistir();
    return e;
  });
  rota('DELETE', '/api/equipes/:id', (p) => {
    const e = B.porId('equipes', int(p.id));
    exigir(e, 'Equipe não encontrada', 404);
    exigir(contarOperadores(e.id) === 0, 'Equipe possui operadores vinculados — não pode ser excluída', 409);
    B.tab('equipes').splice(B.tab('equipes').indexOf(e), 1);
    B.persistir();
    return { excluido: 1 };
  });

  const linhaOperador = (o) => {
    const eq = B.porId('equipes', o.equipe_id);
    return { ...o, equipe_nome: eq ? eq.nome : null };
  };
  rota('GET', '/api/operadores', () => ordenarPor(B.tab('operadores'), 'nome').map(linhaOperador));
  rota('POST', '/api/operadores', (_p, c) => {
    exigir(c.nome && String(c.nome).trim(), 'Informe o nome do operador');
    if (c.equipe_id) exigir(B.porId('equipes', int(c.equipe_id)), 'Equipe não encontrada');
    const matricula = c.matricula ? String(c.matricula).trim() : null;
    exigir(!matricula || !B.tab('operadores').some((o) => o.matricula === matricula),
      'Já existe um operador com esta matrícula', 409);
    const linha = B.inserir('operadores', {
      nome: String(c.nome).trim(), matricula,
      equipe_id: c.equipe_id ? int(c.equipe_id) : null,
      funcao: String(c.funcao || '').trim(), maquina: String(c.maquina || '').trim(),
      custo_hora: Math.max(0, num(c.custo_hora)), ativo: 1,
      criado_em: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    B.persistir();
    return linha;
  });
  rota('PUT', '/api/operadores/:id', (p, c) => {
    const o = B.porId('operadores', int(p.id));
    exigir(o, 'Operador não encontrado', 404);
    if (c.nome !== undefined) o.nome = String(c.nome).trim();
    if (c.matricula !== undefined) {
      const matricula = c.matricula ? String(c.matricula).trim() : null;
      exigir(!matricula || !B.tab('operadores').some((x) => x.matricula === matricula && x.id !== o.id),
        'Já existe um operador com esta matrícula', 409);
      o.matricula = matricula;
    }
    if (c.equipe_id !== undefined) {
      if (c.equipe_id) exigir(B.porId('equipes', int(c.equipe_id)), 'Equipe não encontrada');
      o.equipe_id = c.equipe_id ? int(c.equipe_id) : null;
    }
    if (c.funcao !== undefined) o.funcao = String(c.funcao).trim();
    if (c.maquina !== undefined) o.maquina = String(c.maquina).trim();
    if (c.custo_hora !== undefined) o.custo_hora = Math.max(0, num(c.custo_hora));
    B.persistir();
    return o;
  });
  rota('DELETE', '/api/operadores/:id', (p) => {
    const o = B.porId('operadores', int(p.id));
    exigir(o, 'Operador não encontrado', 404);
    exigir(!B.tab('producao_operador').some((r) => String(r.operador_id) === String(o.id)),
      'Operador possui produção apontada — não pode ser excluído', 409);
    B.tab('operadores').splice(B.tab('operadores').indexOf(o), 1);
    B.persistir();
    return { excluido: 1 };
  });

  /* ---- apontamentos ---- */
  const filtrosDe = (q) => ({
    de: q.get('de') || undefined,
    ate: q.get('ate') || undefined,
    maquinaId: q.get('maquinaId') ? int(q.get('maquinaId')) : undefined,
    setor: q.get('setor') || undefined,
    limite: q.get('limite') ? int(q.get('limite')) : undefined,
  });

  rota('GET', '/api/apontamentos', (_p, _c, q) => {
    const lista = B.listarApontamentos(filtrosDe(q));
    return { total: lista.length, itens: lista };
  });

  rota('POST', '/api/apontamentos', (_p, c) => {
    const dados = validarApontamento(c);
    if (dados.paradas === undefined) dados.paradas = [];
    validarTotalParadas(dados);
    exigir(dados.pecas_defeito <= dados.pecas_produzidas, 'Peças com defeito não podem superar as peças produzidas');
    const linha = B.inserir('apontamentos', {
      data: dados.data, maquina_id: dados.maquina_id, turno_id: dados.turno_id,
      modelo_id: dados.modelo_id ?? null, lider: dados.lider || '',
      pecas_produzidas: dados.pecas_produzidas, pecas_defeito: dados.pecas_defeito,
      pecas_retrabalho: dados.pecas_retrabalho, observacao: dados.observacao || '',
      criado_em: new Date().toISOString().slice(0, 19).replace('T', ' '), atualizado_em: null,
    });
    for (const p of dados.paradas) {
      B.inserir('paradas', { apontamento_id: linha.id, motivo: p.motivo, minutos: p.minutos, descricao: p.descricao });
    }
    B.persistir();
    return B.obterApontamento(linha.id);
  });

  rota('GET', '/api/apontamentos/:id', (p) => {
    const item = B.obterApontamento(int(p.id));
    exigir(item, 'Apontamento não encontrado', 404);
    return item;
  });

  rota('PUT', '/api/apontamentos/:id', (p, c) => {
    const id = int(p.id);
    const atual = B.porId('apontamentos', id);
    exigir(atual, 'Apontamento não encontrado', 404);
    const dados = validarApontamento(c, true);
    validarTotalParadas(dados);
    if (dados.pecas_defeito !== undefined) {
      const produzidas = dados.pecas_produzidas !== undefined ? dados.pecas_produzidas : atual.pecas_produzidas;
      exigir(dados.pecas_defeito <= produzidas, 'Peças com defeito não podem superar as peças produzidas');
    }
    for (const k of ['data', 'maquina_id', 'turno_id', 'lider', 'pecas_produzidas',
      'pecas_defeito', 'pecas_retrabalho', 'observacao']) {
      if (dados[k] !== undefined) atual[k] = dados[k];
    }
    if (dados.modelo_id !== undefined) atual.modelo_id = dados.modelo_id;
    if (dados.paradas !== undefined) {
      validarTotalParadas({ ...dados, _turno: dados._turno || B.porId('turnos', atual.turno_id) });
      B.tab('paradas').filter((x) => String(x.apontamento_id) === String(id))
        .forEach((x) => { const l = B.tab('paradas'); l.splice(l.indexOf(x), 1); });
      for (const ev of dados.paradas) {
        B.inserir('paradas', { apontamento_id: id, motivo: ev.motivo, minutos: ev.minutos, descricao: ev.descricao });
      }
    }
    atual.atualizado_em = new Date().toISOString().slice(0, 19).replace('T', ' ');
    B.persistir();
    return B.obterApontamento(id);
  });

  rota('DELETE', '/api/apontamentos/:id', (p) => {
    const id = int(p.id);
    const atual = B.porId('apontamentos', id);
    exigir(atual, 'Apontamento não encontrado', 404);
    for (const t of ['paradas', 'producao_operador']) {
      B.tab(t).filter((x) => String(x.apontamento_id) === String(id)).forEach((x) => {
        const l = B.tab(t); l.splice(l.indexOf(x), 1);
      });
    }
    B.tab('apontamentos').splice(B.tab('apontamentos').indexOf(atual), 1);
    B.persistir();
    return { excluido: 1 };
  });

  /* ---- sequência e cronometragem ---- */
  rota('GET', '/api/modelos/:id/sequencia', (p) => {
    const seq = B.listarSequencia(int(p.id));
    exigir(seq, 'Modelo não encontrado', 404);
    return seq;
  });

  rota('POST', '/api/modelos/:id/recalcular-sam', (p) => {
    const res = B.recalcularSam(int(p.id));
    exigir(res, 'Modelo não encontrado', 404);
    return comStatus(200, res);
  });

  rota('POST', '/api/operacoes', (_p, c) => {
    exigir(int(c.modelo_id), 'Informe o modelo');
    exigir(B.porId('modelos', int(c.modelo_id)), 'Modelo não encontrado');
    exigir(c.descricao && String(c.descricao).trim(), 'Informe a descrição da operação');
    const sequencia = Math.max(1, int(c.sequencia, 1));
    exigir(!B.tab('operacoes').some((o) => String(o.modelo_id) === String(int(c.modelo_id)) && numeroSeq(o) === sequencia),
      'Já existe uma operação com esta sequência no modelo', 409);
    const tempoPadrao = Math.max(0, num(c.tempo_padrao));
    const linha = B.inserir('operacoes', {
      modelo_id: int(c.modelo_id), sequencia, codigo: String(c.codigo || '').trim(),
      descricao: String(c.descricao).trim(), maquina: String(c.maquina || '').trim(),
      secao: String(c.secao || '').trim(), tempo_padrao: tempoPadrao,
      dificuldade: Math.min(5, Math.max(1, int(c.dificuldade, 2))),
      criado_em: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    B.persistir();
    return { ...linha, tempoPadraoMin: tempoPadrao / 60 };
  });
  const numeroSeq = (o) => num(o.sequencia);

  rota('PUT', '/api/operacoes/:id', (p, c) => {
    const o = B.porId('operacoes', int(p.id));
    exigir(o, 'Operação não encontrada', 404);
    if (c.sequencia !== undefined) {
      const sequencia = Math.max(1, int(c.sequencia, 1));
      exigir(!B.tab('operacoes').some((x) => x.id !== o.id && String(x.modelo_id) === String(o.modelo_id) && numeroSeq(x) === sequencia),
        'Já existe uma operação com esta sequência no modelo', 409);
      o.sequencia = sequencia;
    }
    if (c.codigo !== undefined) o.codigo = String(c.codigo).trim();
    if (c.descricao !== undefined) o.descricao = String(c.descricao).trim();
    if (c.maquina !== undefined) o.maquina = String(c.maquina).trim();
    if (c.secao !== undefined) o.secao = String(c.secao).trim();
    if (c.tempo_padrao !== undefined) o.tempo_padrao = Math.max(0, num(c.tempo_padrao));
    if (c.dificuldade !== undefined) o.dificuldade = Math.min(5, Math.max(1, int(c.dificuldade, 2)));
    B.persistir();
    return { ...o, tempoPadraoMin: o.tempo_padrao / 60 };
  });

  rota('DELETE', '/api/operacoes/:id', (p) => {
    const o = B.porId('operacoes', int(p.id));
    exigir(o, 'Operação não encontrada', 404);
    B.tab('cronometragens').filter((c) => String(c.operacao_id) === String(o.id)).forEach((c) => {
      B.tab('leituras_cronometro').filter((l) => String(l.cronometragem_id) === String(c.id))
        .forEach((l) => { const t = B.tab('leituras_cronometro'); t.splice(t.indexOf(l), 1); });
      const t = B.tab('cronometragens'); t.splice(t.indexOf(c), 1);
    });
    B.tab('operacoes').splice(B.tab('operacoes').indexOf(o), 1);
    B.persistir();
    return { excluido: 1 };
  });

  rota('GET', '/api/cronometragens', (_p, _c, q) => B.listarCronometragens({
    operacaoId: q.get('operacaoId') ? int(q.get('operacaoId')) : undefined,
    modeloId: q.get('modeloId') ? int(q.get('modeloId')) : undefined,
    de: q.get('de') || undefined,
    ate: q.get('ate') || undefined,
  }));

  rota('POST', '/api/cronometragens', (_p, c) => {
    exigir(int(c.operacao_id), 'Informe a operação');
    const operacao = B.porId('operacoes', int(c.operacao_id));
    exigir(operacao, 'Operação não encontrada');
    exigir(dataValida(c.data), 'Data inválida (use AAAA-MM-DD)');
    const leituras = (Array.isArray(c.leituras) ? c.leituras : []).map((v) => num(v)).filter((v) => v > 0);
    exigir(leituras.length > 0, 'Informe pelo menos uma leitura válida do cronômetro');
    const fatorRitmo = num(c.fator_ritmo, 1);
    exigir(fatorRitmo > 0.3 && fatorRitmo <= 2, 'Fator de ritmo deve ficar entre 0,3 e 2');
    const tolerancia = Math.max(0, Math.min(100, num(c.tolerancia_pct, 12)));
    if (c.operador_id) exigir(B.porId('operadores', int(c.operador_id)), 'Operador não encontrado');

    const linha = B.inserir('cronometragens', {
      operacao_id: int(c.operacao_id), operador_id: c.operador_id ? int(c.operador_id) : null,
      data: c.data, fator_ritmo: fatorRitmo, tolerancia_pct: tolerancia,
      observacao: String(c.observacao || '').slice(0, 300),
      criado_em: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    for (const s of leituras) B.inserir('leituras_cronometro', { cronometragem_id: linha.id, segundos: s });

    const resumo = window.Tempos.resumirCronometragem({ leituras, fatorRitmo, toleranciaPct: tolerancia });
    operacao.tempo_padrao = resumo.tempoPadrao;
    B.persistir();
    return { ...B.detalharCronometragem(linha), tempoPadraoOperacaoSeg: resumo.tempoPadrao };
  });

  rota('DELETE', '/api/cronometragens/:id', (p) => {
    const c = B.porId('cronometragens', int(p.id));
    exigir(c, 'Cronometragem não encontrada', 404);
    const operacaoId = c.operacao_id;
    B.tab('leituras_cronometro').filter((l) => String(l.cronometragem_id) === String(c.id))
      .forEach((l) => { const t = B.tab('leituras_cronometro'); t.splice(t.indexOf(l), 1); });
    B.tab('cronometragens').splice(B.tab('cronometragens').indexOf(c), 1);

    // Volta ao tempo do estudo que restou, se houver.
    const restante = B.cronometragemVigente(operacaoId);
    const op = B.porId('operacoes', operacaoId);
    if (op) op.tempo_padrao = restante ? restante.resumo.tempoPadrao : op.tempo_padrao;
    B.persistir();
    return { excluido: 1 };
  });

  /* ---- balanceamento ---- */
  function simular(c) {
    exigir(int(c.modelo_id), 'Informe o modelo');
    exigir(B.porId('modelos', int(c.modelo_id)), 'Modelo não encontrado');
    const meta = num(c.meta_pecas_hora);
    exigir(meta > 0, 'Meta de peças/hora deve ser maior que zero');
    const operacoes = B.operacoesParaBalanceamento(int(c.modelo_id));
    exigir(operacoes.length > 0, 'O modelo não possui sequência operacional cadastrada');
    const m = B.porId('modelos', int(c.modelo_id));
    return {
      modelo: { codigo: m.codigo, nome: m.nome, sam_min: m.sam_min },
      resultado: window.Balanceamento.balancearLinha({
        operacoes, metaPecasHora: meta,
        minutosDisponiveis: num(c.minutos_disponiveis, 420),
        maxEstacoes: int(c.max_postos),
      }),
    };
  }
  rota('POST', '/api/balanceamento/simular', (_p, c) => comStatus(200, simular(c)));

  rota('GET', '/api/balancos', () =>
    [...B.tab('balancos')]
      .sort((a, b) => (String(a.criado_em) < String(b.criado_em) ? 1 : String(a.criado_em) > String(b.criado_em) ? -1 : 0))
      .map((b) => {
        const mo = B.porId('modelos', b.modelo_id);
        return {
          ...b,
          modelo_codigo: mo ? mo.codigo : null,
          modelo_nome: mo ? mo.nome : null,
          alocacao: typeof b.alocacao === 'string' ? JSON.parse(b.alocacao || '[]') : (b.alocacao || []),
          resultado: typeof b.resultado === 'string' ? JSON.parse(b.resultado || '{}') : (b.resultado || {}),
        };
      }));

  rota('POST', '/api/balancos', (_p, c) => {
    exigir(c.nome && String(c.nome).trim(), 'Informe um nome para o balanceamento');
    const r = simular(c);
    const linha = B.inserir('balancos', {
      nome: String(c.nome).trim(), modelo_id: int(c.modelo_id),
      meta_pecas_hora: num(c.meta_pecas_hora), minutos_disponiveis: num(c.minutos_disponiveis, 420),
      max_postos: int(c.max_postos),
      alocacao: JSON.stringify(r.resultado.estacoes), resultado: JSON.stringify(r.resultado),
      criado_em: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    B.persistir();
    return { id: linha.id, resultado: r.resultado };
  });

  rota('DELETE', '/api/balancos/:id', (p) => {
    const b = B.porId('balancos', int(p.id));
    exigir(b, 'Balanceamento não encontrado', 404);
    B.tab('balancos').splice(B.tab('balancos').indexOf(b), 1);
    B.persistir();
    return { excluido: 1 };
  });

  /* ---- produção e acompanhamento ---- */
  const filtrosProducao = (q) => ({
    de: q.get('de') || undefined,
    ate: q.get('ate') || undefined,
    equipeId: q.get('equipeId') ? int(q.get('equipeId')) : undefined,
    operadorId: q.get('operadorId') ? int(q.get('operadorId')) : undefined,
    maquinaId: q.get('maquinaId') ? int(q.get('maquinaId')) : undefined,
    modeloId: q.get('modeloId') ? int(q.get('modeloId')) : undefined,
    apontamentoId: q.get('apontamentoId') ? int(q.get('apontamentoId')) : undefined,
  });

  rota('GET', '/api/producao', (_p, _c, q) => B.listarProducaoIndividual(filtrosProducao(q)));
  rota('GET', '/api/acompanhamento', (_p, _c, q) => B.acompanhamento(filtrosProducao(q)));

  rota('GET', '/api/apontamentos/:id/producao', (p) => {
    exigir(B.porId('apontamentos', int(p.id)), 'Apontamento não encontrado', 404);
    return B.listarProducaoIndividual({ apontamentoId: int(p.id) });
  });

  rota('PUT', '/api/apontamentos/:id/producao', (p, c) => {
    const id = int(p.id);
    exigir(B.porId('apontamentos', id), 'Apontamento não encontrado', 404);
    exigir(Array.isArray(c.itens), 'itens deve ser uma lista');
    const itens = c.itens.map((item) => {
      exigir(int(item.operador_id), 'Cada item precisa de um operador');
      exigir(B.porId('operadores', int(item.operador_id)), 'Operador não encontrado');
      if (item.operacao_id) exigir(B.porId('operacoes', int(item.operacao_id)), 'Operação não encontrada');
      if (item.tempo_padrao_min !== undefined && item.tempo_padrao_min !== null) {
        exigir(num(item.tempo_padrao_min) > 0, 'tempo_padrao_min deve ser maior que zero');
      }
      return {
        operador_id: int(item.operador_id),
        operacao_id: item.operacao_id ? int(item.operacao_id) : null,
        tempo_padrao_min: item.tempo_padrao_min ? num(item.tempo_padrao_min) : null,
        minutos: Math.max(0, num(item.minutos)),
        pecas: Math.max(0, num(item.pecas)),
        defeitos: Math.max(0, num(item.defeitos)),
      };
    });
    const ids = itens.map((i) => i.operador_id);
    exigir(ids.filter((v, i2) => ids.indexOf(v) !== i2).length === 0, 'Há operadores repetidos no apontamento');

    B.tab('producao_operador').filter((r) => String(r.apontamento_id) === String(id))
      .forEach((r) => { const t = B.tab('producao_operador'); t.splice(t.indexOf(r), 1); });
    for (const item of itens) B.inserir('producao_operador', { apontamento_id: id, ...item });
    B.persistir();
    return B.listarProducaoIndividual({ apontamentoId: id });
  });

  /* ---- simulação, painel, exportação, backup ---- */
  rota('POST', '/api/simular', (_p, c) => {
    exigir(dataValida(c.data), 'Data inválida (use AAAA-MM-DD)');
    const m = B.porId('maquinas', int(c.maquina_id));
    exigir(m, 'Linha/célula não encontrada');
    const t = B.porId('turnos', int(c.turno_id));
    exigir(t, 'Turno não encontrado');
    const mo = c.modelo_id ? B.porId('modelos', int(c.modelo_id)) : null;
    const paradas = (Array.isArray(c.paradas) ? c.paradas : []).map((p) => ({
      motivo: String(p.motivo || '').toUpperCase(),
      minutos: Math.max(0, num(p.minutos)),
      descricao: String(p.descricao || ''),
    }));
    return comStatus(200, {
      linha: m.nome, turno: t.nome, modelo: mo ? mo.nome : null,
      indicadores: window.OEE.calcularOEE({
        minutosTurno: t.minutos_totais, pausasPlanejadasTurno: t.pausas_planejadas, paradas,
        pecasProduzidas: int(c.pecas_produzidas), pecasDefeito: int(c.pecas_defeito),
        pecasRetrabalho: int(c.pecas_retrabalho), samMin: mo ? mo.sam_min : 0,
        operadores: m.operadores, custoHoraCelula: m.custo_hora,
      }),
    });
  });

  rota('GET', '/api/dashboard', (_p, _c, q) => B.dashboard({
    de: q.get('de') || undefined,
    ate: q.get('ate') || undefined,
    maquinaId: q.get('maquinaId') ? int(q.get('maquinaId')) : undefined,
    setor: q.get('setor') || undefined,
  }));

  rota('GET', '/api/backup', () => B.exportar());

  rota('POST', '/api/restore', (_p, c) => {
    exigir(c && typeof c === 'object', 'Envie o JSON de um backup');
    const r = B.importar(c);
    return comStatus(200, { restaurado: true, tabelas: r.tabelas });
  });

  /* ------------------------------------------------------ despachante ----- */

  /** CSV é o único endpoint que não devolve JSON: devolve o texto direto. */
  function exportarCsv(query) {
    return B.csvApontamentos({
      de: query.get('de') || undefined,
      ate: query.get('ate') || undefined,
      maquinaId: query.get('maquinaId') ? int(query.get('maquinaId')) : undefined,
      setor: query.get('setor') || undefined,
    });
  }

  window.API_LOCAL = async function (caminho, opcoes = {}) {
    const url = new URL(String(caminho), 'http://local');
    const pathname = url.pathname;
    const metodo = (opcoes.method || 'GET').toUpperCase();
    const corpo = opcoes.body
      ? (typeof opcoes.body === 'string' ? JSON.parse(opcoes.body) : opcoes.body)
      : {};

    // micro-atraso para preservar a natureza assíncrona que o front-end espera
    await Promise.resolve();

    if (metodo === 'GET' && pathname === '/api/export/apontamentos.csv') {
      return { __status: 200, __corpo: { __csv: exportarCsv(url.searchParams) } };
    }

    for (const r of ROTAS) {
      if (r.metodo !== metodo) continue;
      const m = r.regex.exec(pathname);
      if (!m) continue;
      const params = {};
      r.chaves.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      try {
        // O round-trip por JSON reproduz o que o servidor faz na rede: chaves com
        // `undefined` somem. Sem isto, `filtros` voltaria com campos a mais.
        let resultado = r.fn(params, corpo, url.searchParams);
        let status = metodo === 'POST' ? 201 : 200;
        if (resultado && resultado.__status !== undefined) {
          status = resultado.__status;
          resultado = resultado.__corpo;
        }
        // O round-trip por JSON reproduz o que o servidor faz na rede: chaves com
        // `undefined` somem. Sem isto, `filtros` voltaria com campos a mais.
        const serializado = resultado === undefined ? resultado : JSON.parse(JSON.stringify(resultado));
        return { __status: status, __corpo: serializado };
      } catch (e) {
        const erro = new Error(e.message);
        erro.status = e instanceof HttpErro ? e.status : 500;
        throw erro;
      }
    }
    const erro = new Error(`Rota não encontrada: ${metodo} ${pathname}`);
    erro.status = 404;
    throw erro;
  };

  window.API_LOCAL.csv = exportarCsv;

  // Sem servidor não há URL de download: o backup é gerado no navegador.
  // O botão só existe na build estática; o `typeof` evita quebrar no Node.
  if (typeof document !== 'undefined') {
    const botao = document.querySelector('#btn-backup-estatico');
    if (botao) {
      botao.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(B.exportar(), null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `eficiencia-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      });
    }
  }
})();
