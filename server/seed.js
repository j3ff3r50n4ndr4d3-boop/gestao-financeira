'use strict';

/**
 * Carga de dados de exemplo: uma confecção fictícia com 6 células de produção,
 * 10 modelos e ~45 dias de histórico de apontamentos.
 *
 * O gerador usa um PRNG com semente fixa, então `npm run seed` sempre produz o
 * mesmo cenário — o histórico mostra melhoria gradual de OEE nas últimas semanas,
 * exatamente como aparece num gráfico de tendência real.
 */

const { abrir, getDb, all, run, getConfig } = require('./db');
const { MOTIVOS_PARADA } = require('./lib/oee');
const { resumirCronometragem } = require('./lib/tempos');
const { recalcularSam } = require('./lib/sequencia');
const { balancearLinha } = require('./lib/balanceamento');

/** PRNG determinístico (mulberry32). */
function criarRng(semente = 20260824) {
  let a = semente >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TURNOS = [
  { nome: '1º Turno', hora_inicio: '07:00', hora_fim: '16:00', minutos_totais: 480, pausas_planejadas: 60 },
  { nome: '2º Turno', hora_inicio: '16:00', hora_fim: '00:00', minutos_totais: 480, pausas_planejadas: 60 },
];

const SETORES = ['Corte', 'Costura', 'Acabamento', 'Passadoria'];

const MAQUINAS = [
  { nome: 'Corte Automático', setor: 'Corte', tipo: 'Balancim e corte automático', operadores: 3, custo_hora: 180, meta_oee: 0.85, observacao: 'Alimenta todas as linhas de costura', turnos: [0] },
  { nome: 'Linha 1 — Malha Leve', setor: 'Costura', tipo: 'Reta + Overloque + Galoneira', operadores: 14, custo_hora: 260, meta_oee: 0.88, observacao: 'Camisetas e polos', turnos: [0, 1] },
  { nome: 'Linha 2 — Malha Pesada', setor: 'Costura', tipo: 'Reta + Interloque + Galoneira', operadores: 12, custo_hora: 240, meta_oee: 0.85, observacao: 'Moletons e bodies', turnos: [0, 1] },
  { nome: 'Linha 3 — Jeans', setor: 'Costura', tipo: 'Reta + Overloque + Travete', operadores: 10, custo_hora: 220, meta_oee: 0.82, observacao: 'Calças e shorts', turnos: [0, 1] },
  { nome: 'Acabamento e Revisão', setor: 'Acabamento', tipo: 'Revisão, limpeza de fio e etiquetagem', operadores: 6, custo_hora: 120, meta_oee: 0.9, observacao: 'Inspeção final 100%', turnos: [0] },
  { nome: 'Passadoria e Embalagem', setor: 'Passadoria', tipo: 'Vapor, dobra e embalagem', operadores: 5, custo_hora: 110, meta_oee: 0.88, observacao: 'Expedição', turnos: [0] },
];

const MODELOS = [
  { codigo: 'CAM-100', nome: 'Camiseta Básica Gola C', categoria: 'Camiseta', sam_min: 8.5, preco_venda: 34.9 },
  { codigo: 'CAM-210', nome: 'Camiseta Polo Piquet', categoria: 'Camiseta', sam_min: 14.2, preco_venda: 59.9 },
  { codigo: 'CAM-330', nome: 'Camisa Social Manga Longa', categoria: 'Camisa', sam_min: 26.5, preco_venda: 129.9 },
  { codigo: 'CAL-420', nome: 'Calça Jeans 5 Bolsos', categoria: 'Calça', sam_min: 31.0, preco_venda: 149.9 },
  { codigo: 'CAL-455', nome: 'Calça Moletom Flanelada', categoria: 'Calça', sam_min: 16.0, preco_venda: 79.9 },
  { codigo: 'VES-520', nome: 'Vestido Tubinho', categoria: 'Vestido', sam_min: 28.4, preco_venda: 139.9 },
  { codigo: 'MOL-610', nome: 'Moletom Canguru', categoria: 'Blusão', sam_min: 34.6, preco_venda: 159.9 },
  { codigo: 'SHT-700', nome: 'Short Sarja', categoria: 'Short', sam_min: 13.8, preco_venda: 69.9 },
  { codigo: 'UNI-810', nome: 'Uniforme Polo Bordado', categoria: 'Uniforme', sam_min: 17.5, preco_venda: 64.9 },
  { codigo: 'BAB-905', nome: 'Body Bebê Interloque', categoria: 'Infantil', sam_min: 11.2, preco_venda: 39.9 },
];

/**
 * Afinidade célula ↔ modelo. O índice é a posição em MODELOS.
 * Para as linhas de costura o nº de operações da sequência é igual ao nº de
 * operadores da linha, o que mantém coerentes o tempo ciclo ideal do OEE e a
 * eficiência individual medida por operação.
 */
const MODELOS_POR_SETOR = {
  Corte: MODELOS.map((_, i) => i),
  Costura: MODELOS.map((_, i) => i),
  Acabamento: MODELOS.map((_, i) => i),
  Passadoria: MODELOS.map((_, i) => i),
};

/** Modelos produzidos por cada linha de costura (índice em MODELOS). */
const MODELOS_POR_LINHA_COSTURA = {
  'Linha 1 — Malha Leve': [0, 1, 8],    // CAM-100, CAM-210, UNI-810 → 14 operações
  'Linha 2 — Malha Pesada': [2, 3, 5, 6], // CAM-330, CAL-420, VES-520, MOL-610 → 12 operações
  'Linha 3 — Jeans': [4, 7, 9],          // CAL-455, SHT-700, BAB-905 → 10 operações
};

const EQUIPES = [
  { nome: 'Equipe Alfa', setor: 'Costura', lider: 'Mariana Alves', linha: 'Linha 1 — Malha Leve' },
  { nome: 'Equipe Beta', setor: 'Costura', lider: 'José Ferreira', linha: 'Linha 2 — Malha Pesada' },
  { nome: 'Equipe Gama', setor: 'Costura', lider: 'Ana Beatriz Lima', linha: 'Linha 3 — Jeans' },
];

/** Perfis de sequência operacional, com pesos relativos normalizados pelo SAM. */
const PERFIS_OPERACIONAIS = {
  14: [
    ['Fechar ombro', 'Overloque', 6], ['Reforçar ombro', 'Reta', 4],
    ['Preparar gola/ribana', 'Reta', 6], ['Pregar gola', 'Reta', 10],
    ['Pespontar gola', 'Galoneira', 5], ['Preparar manga', 'Overloque', 6],
    ['Pregar manga direita', 'Reta', 11], ['Pregar manga esquerda', 'Reta', 11],
    ['Fechar lateral direita', 'Overloque', 8], ['Fechar lateral esquerda', 'Overloque', 8],
    ['Barra do corpo', 'Galoneira', 10], ['Barra da manga direita', 'Galoneira', 7],
    ['Barra da manga esquerda', 'Galoneira', 7], ['Arremates e limpeza', 'Reta', 6],
  ],
  12: [
    ['Fechar ombro', 'Overloque', 6], ['Reforçar ombro', 'Reta', 4],
    ['Preparar gola', 'Reta', 7], ['Pregar gola', 'Reta', 11],
    ['Pespontar gola', 'Galoneira', 6], ['Preparar e pregar manga', 'Reta', 14],
    ['Fechar lateral', 'Overloque', 11], ['Barra do corpo', 'Galoneira', 12],
    ['Barra da manga', 'Galoneira', 9], ['Pregar etiqueta', 'Reta', 4],
    ['Arremates', 'Reta', 7], ['Revisão final', 'Reta', 5],
  ],
  10: [
    ['Fechar gancho dianteiro', 'Reta', 10], ['Fechar gancho traseiro', 'Reta', 11],
    ['Preparar bolso', 'Reta', 9], ['Pregar bolso', 'Reta', 12],
    ['Braguilha e zíper', 'Reta', 15], ['Fechar lateral', 'Overloque', 12],
    ['Preparar cós', 'Reta', 8], ['Pregar cós', 'Reta', 12],
    ['Barra', 'Reta', 9], ['Arremates e limpeza', 'Reta', 7],
  ],
};

const NOMES_OPERADORES = [
  'Maria Silva', 'João Santos', 'Ana Oliveira', 'Pedro Costa', 'Julia Pereira',
  'Lucas Rodrigues', 'Beatriz Almeida', 'Gabriel Nascimento', 'Larissa Lima', 'Rafael Souza',
  'Camila Ferreira', 'Thiago Alves', 'Amanda Rocha', 'Bruno Carvalho', 'Fernanda Dias',
  'Diego Martins', 'Patrícia Gomes', 'Felipe Barbosa', 'Vanessa Ribeiro', 'Gustavo Pinto',
  'Renata Cardoso', 'Marcos Teixeira', 'Simone Araújo', 'Eduardo Moreira',
  'Cristiane Nunes', 'Alexandre Melo', 'Débora Castro', 'Rodrigo Freitas',
  'Tatiane Lopes', 'Fábio Ramos', 'Elaine Barbosa', 'Sérgio Vieira',
  'Mônica Sales', 'Adriano Correia',
];

const LIDERES = [
  'Mariana Alves', 'José Ferreira', 'Ana Beatriz Lima', 'Carlos Eduardo Souza',
  'Fernanda Rocha', 'Rafael Nogueira', 'Patrícia Gomes', 'Wesley Barbosa',
];

/** Motivos de parada com peso relativo por setor. */
const PESOS_PARADA = {
  Costura: [
    ['FALTA_MATERIAL', 22], ['SETUP', 18], ['QUEBRA', 14], ['AGUARDANDO_SERVICO', 12],
    ['FALTA_OPERADOR', 10], ['AGULHA', 9], ['AJUSTE_QUALIDADE', 8], ['MANUTENCAO', 4], ['ENERGIA', 3],
  ],
  Corte: [
    ['QUEBRA', 20], ['SETUP', 20], ['FALTA_MATERIAL', 18], ['MANUTENCAO', 12],
    ['AGUARDANDO_SERVICO', 12], ['AJUSTE_QUALIDADE', 10], ['ENERGIA', 5], ['FALTA_OPERADOR', 3],
  ],
  Acabamento: [
    ['FALTA_OPERADOR', 24], ['AGUARDANDO_SERVICO', 22], ['AJUSTE_QUALIDADE', 18],
    ['FALTA_MATERIAL', 14], ['SETUP', 10], ['QUEBRA', 6], ['ENERGIA', 6],
  ],
  Passadoria: [
    ['FALTA_OPERADOR', 26], ['AGUARDANDO_SERVICO', 22], ['QUEBRA', 16],
    ['FALTA_MATERIAL', 12], ['SETUP', 10], ['ENERGIA', 8], ['MANUTENCAO', 6],
  ],
};

const OBSERVACOES = [
  '', '', '',
  'Falta de fio na abertura do turno.',
  'Troca de modelo no meio do turno elevou o setup.',
  'Operadora em atestado, realocação demorada.',
  'Máquina com manutenção corretiva no meio da manhã.',
  'Alta incidência de puxado de fio na revisão.',
  'Corte atrasado, linha aguardou serviço.',
  'Turno com treinamento de operador novo.',
];

function escolher(pesos, rng) {
  const total = pesos.reduce((s, [, p]) => s + p, 0);
  let r = rng() * total;
  for (const [codigo, p] of pesos) {
    r -= p;
    if (r <= 0) return codigo;
  }
  return pesos[pesos.length - 1][0];
}

function diasUteisAteHoje(dias, rng) {
  const lista = [];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const cursor = new Date(hoje);
  while (lista.length < dias) {
    const dow = cursor.getDay();
    if (dow !== 0) lista.push(cursor.toISOString().slice(0, 10)); // pula domingo
    cursor.setDate(cursor.getDate() - 1);
  }
  return lista.reverse();
}

/** Cria equipes e distribui os operadores entre elas, respeitando a linha de cada equipe. */
function criarEquipesEOperadores(db, rng, maquinas) {
  const equipes = EQUIPES.map((eq) => {
    const r = run(db, 'INSERT INTO equipes (nome, setor, lider) VALUES (?, ?, ?)', eq.nome, eq.setor, eq.lider);
    const linha = maquinas.find((m) => m.nome === eq.linha);
    return { ...eq, id: Number(r.lastInsertRowid), operadoresLinha: linha ? linha.operadores : 0 };
  });

  let cursor = 0;
  const porLinha = {};
  const stmt = db.prepare(
    `INSERT INTO operadores (nome, matricula, equipe_id, funcao, maquina, custo_hora)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const eq of equipes) {
    porLinha[eq.linha] = [];
    for (let i = 0; i < eq.operadoresLinha; i++) {
      const nome = NOMES_OPERADORES[cursor % NOMES_OPERADORES.length];
      cursor++;
      const r = stmt.run(
        nome,
        `OP-${String(cursor).padStart(3, '0')}`,
        eq.id,
        'Costureira(o)',
        ['Reta', 'Overloque', 'Galoneira', 'Interloque'][Math.floor(rng() * 4)],
        Math.round((16 + rng() * 8) * 100) / 100
      );
      // Fator pessoal de ritmo, estável no período: é o que diferencia um
      // operador do outro no ranking individual.
      const fator = 0.86 + rng() * 0.24;
      porLinha[eq.linha].push({ id: Number(r.lastInsertRowid), nome, equipeId: eq.id, fator });
    }
  }
  return { equipes, operadoresPorLinha: porLinha };
}

/**
 * Monta a sequência operacional de cada modelo e uma cronometragem por operação.
 * O nº de operações de cada perfil é igual ao nº de operadores da linha que
 * produz o modelo, e o Σ dos tempos padrão é o SAM do modelo.
 */
function criarSequenciasECronometragens(db, rng, modelos) {
  const operacoesPorModelo = {};
  const stmtOp = db.prepare(
    `INSERT INTO operacoes (modelo_id, sequencia, codigo, descricao, maquina, secao, tempo_padrao, dificuldade)
     VALUES (?, ?, ?, ?, ?, 'Costura', ?, ?)`
  );
  const stmtCron = db.prepare(
    `INSERT INTO cronometragens (operacao_id, operador_id, data, fator_ritmo, tolerancia_pct, observacao)
     VALUES (?, NULL, '2026-07-01', ?, ?, 'Estudo de tempo inicial')`
  );
  const stmtLeitura = db.prepare('INSERT INTO leituras_cronometro (cronometragem_id, segundos) VALUES (?, ?)');

  let totalOperacoes = 0;
  let totalCronometragens = 0;

  for (const modelo of modelos) {
    // Descobre em qual linha o modelo é produzido para usar o perfil certo.
    let perfil = 12;
    for (const [linha, indices] of Object.entries(MODELOS_POR_LINHA_COSTURA)) {
      const maquina = MAQUINAS.find((m) => m.nome === linha);
      // Comparação por código: `modelo` é uma cópia com id, não a referência de MODELOS.
      const idxOriginal = MODELOS.findIndex((m) => m.codigo === modelo.codigo);
      if (maquina && idxOriginal >= 0 && indices.includes(idxOriginal)) { perfil = maquina.operadores; break; }
    }
    const operacoes = PERFIS_OPERACIONAIS[perfil] || PERFIS_OPERACIONAIS[12];
    const somaPesos = operacoes.reduce((s2, o) => s2 + o[2], 0);

    const criadas = [];
    for (let i = 0; i < operacoes.length; i++) {
      const [descricao, maquina, peso] = operacoes[i];
      const tempoPadraoSeg = (modelo.sam_min * 60 * peso) / somaPesos;
      const dificuldade = Math.min(5, Math.max(1, 1 + Math.round((peso / somaPesos) * 20)));
      const r = stmtOp.run(
        modelo.id, i + 1, `${modelo.codigo}-OP${String(i + 1).padStart(2, '0')}`,
        descricao, maquina, tempoPadraoSeg, dificuldade
      );
      const operacaoId = Number(r.lastInsertRowid);
      totalOperacoes++;

      // Cronometragem: fator de ritmo e tolerância variam; as leituras são geradas
      // para que o tempo padrão resultante reproduza o alvo da sequência.
      const fatorRitmo = Math.round((0.95 + rng() * 0.2) * 100) / 100;
      const tolerancia = [10, 12, 12, 15][Math.floor(rng() * 4)];
      const tempoObservadoAlvo = tempoPadraoSeg / (fatorRitmo * (1 + tolerancia / 100));

      const rc = stmtCron.run(operacaoId, fatorRitmo, tolerancia);
      const cronId = Number(rc.lastInsertRowid);
      for (let l = 0; l < 6; l++) {
        stmtLeitura.run(cronId, Math.round(tempoObservadoAlvo * (0.98 + rng() * 0.04) * 100) / 100);
      }
      totalCronometragens++;

      const resumo = resumirCronometragem({
        leituras: all(db, 'SELECT segundos FROM leituras_cronometro WHERE cronometragem_id = ?', cronId).map((x) => x.segundos),
        fatorRitmo,
        toleranciaPct: tolerancia,
      });
      run(db, 'UPDATE operacoes SET tempo_padrao = ? WHERE id = ?', resumo.tempoPadrao, operacaoId);
      criadas.push({ id: operacaoId, sequencia: i + 1, descricao, maquina, tempoPadraoMin: resumo.tempoPadrao / 60 });
    }
    operacoesPorModelo[modelo.id] = criadas;
  }

  // O SAM cadastrado passa a refletir a sequência cronometrada. O gerador de
  // apontamentos usa esses mesmos valores, para que o desempenho calculado pelo
  // OEE corresponda ao que foi simulado.
  const samRecalculado = {};
  for (const modelo of modelos) {
    const res = recalcularSam(db, modelo.id);
    samRecalculado[modelo.id] = res ? res.samCalculadoMin : modelo.sam_min;
  }

  return { operacoesPorModelo, samRecalculado, totalOperacoes, totalCronometragens };
}

/**
 * Distribui a produção do apontamento entre os operadores da equipe da linha.
 *
 * Cada operador responde por um **posto de trabalho** obtido pelo balanceamento
 * da sequência — não por uma operação isolada. Isso é o que torna a eficiência
 * individual comparável entre operadores: em uma linha balanceada os postos têm
 * cargas parecidas, então a diferença de eficiência reflete o ritmo de cada um,
 * e não o peso da operação em que a pessoa calhou de trabalhar.
 */
function registrarProducaoIndividual(db, rng, { apontamentoId, linhaNome, modeloId, pecas, defeitos, tempoOperacao, operadoresPorLinha, operacoesPorModelo }) {
  const operadores = operadoresPorLinha[linhaNome] || [];
  const operacoes = operacoesPorModelo[modeloId] || [];
  if (operadores.length === 0 || operacoes.length === 0 || tempoOperacao <= 0) return 0;

  const sam = operacoes.reduce((s2, o) => s2 + o.tempoPadraoMin, 0);
  if (sam <= 0) return 0;

  // Pitch time de uma linha perfeitamente balanceada com este efetivo.
  const pitchTime = sam / operadores.length;
  const balance = balancearLinha({
    operacoes,
    metaPecasHora: 60 / pitchTime,
    minutosDisponiveis: tempoOperacao,
    maxEstacoes: operadores.length,
  });

  const stmt = db.prepare(
    `INSERT INTO producao_operador (apontamento_id, operador_id, operacao_id, tempo_padrao_min, minutos, pecas, defeitos)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  // Rodízio: os operadores trocam de posto a cada turno, como na prática.
  // Sem isso cada pessoa ficaria presa ao mesmo posto o período inteiro e o
  // ranking individual passaria a medir o peso do posto, não o ritmo da pessoa.
  const ordem = operadores.map((_, i) => i);
  for (let i = ordem.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }

  let n = 0;
  const qtd = Math.min(ordem.length, balance.estacoes.length);
  for (let k = 0; k < qtd; k++) {
    const operador = operadores[ordem[k]];
    const posto = balance.estacoes[k];
    // Fator pessoal de ritmo com pequena variação diária.
    const pecasOp = Math.max(0, Math.round(pecas * operador.fator * (0.97 + rng() * 0.06)));
    const defeitosOp = rng() < 0.35 ? Math.max(0, Math.round(defeitos * (0.5 + rng()))) : 0;
    stmt.run(
      apontamentoId,
      operador.id,
      posto.operacoes[0] ? posto.operacoes[0].id : null,
      posto.tempo,
      tempoOperacao,
      pecasOp,
      defeitosOp
    );
    n++;
  }
  return n;
}

/**
 * Popula o banco com dados de exemplo.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{dias?:number, limpar?:boolean, semente?:number}} [opts]
 */
function semear(db, opts = {}) {
  const dias = opts.dias || 45;
  const rng = criarRng(opts.semente ?? 20260824);

  if (opts.limpar) {
    db.exec(`
      DELETE FROM leituras_cronometro;
      DELETE FROM cronometragens;
      DELETE FROM producao_operador;
      DELETE FROM balancos;
      DELETE FROM paradas;
      DELETE FROM apontamentos;
      DELETE FROM operacoes;
      DELETE FROM operadores;
      DELETE FROM equipes;
      DELETE FROM modelos;
      DELETE FROM maquinas;
      DELETE FROM turnos;
      DELETE FROM setores;
    `);
    db.exec(`DELETE FROM sqlite_sequence WHERE name IN
      ('leituras_cronometro','cronometragens','producao_operador','balancos','paradas',
       'apontamentos','operacoes','operadores','equipes','modelos','maquinas','turnos','setores')`);
  }

  for (const s of SETORES) run(db, 'INSERT OR IGNORE INTO setores (nome) VALUES (?)', s);

  const turnoIds = TURNOS.map((t) => {
    const r = run(
      db,
      'INSERT INTO turnos (nome, hora_inicio, hora_fim, minutos_totais, pausas_planejadas) VALUES (?, ?, ?, ?, ?)',
      t.nome, t.hora_inicio, t.hora_fim, t.minutos_totais, t.pausas_planejadas
    );
    return r.lastInsertRowid;
  });

  const maquinas = MAQUINAS.map((m) => {
    const r = run(
      db,
      `INSERT INTO maquinas (nome, setor, tipo, operadores, custo_hora, meta_oee, observacao)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      m.nome, m.setor, m.tipo, m.operadores, m.custo_hora, m.meta_oee, m.observacao
    );
    return { ...m, id: r.lastInsertRowid };
  });

  const modeloIds = MODELOS.map((m) => {
    const r = run(
      db,
      'INSERT INTO modelos (codigo, nome, categoria, sam_min, preco_venda) VALUES (?, ?, ?, ?, ?)',
      m.codigo, m.nome, m.categoria, m.sam_min, m.preco_venda
    );
    return { ...m, id: r.lastInsertRowid };
  });

  const { equipes, operadoresPorLinha } = criarEquipesEOperadores(db, rng, maquinas);
  const { operacoesPorModelo, samRecalculado, totalOperacoes, totalCronometragens } =
    criarSequenciasECronometragens(db, rng, modeloIds);

  const datas = diasUteisAteHoje(dias, rng);
  const totalDias = datas.length;

  let apontamentos = 0;
  let paradas = 0;
  let producaoIndividual = 0;

  for (let di = 0; di < datas.length; di++) {
    const data = datas[di];
    const progresso = totalDias > 1 ? di / (totalDias - 1) : 1; // 0 → início, 1 → hoje
    const dow = new Date(data + 'T12:00:00').getDay();

    for (const maquina of maquinas) {
      for (const tIdx of maquina.turnos) {
        // Algumas células não operam todos os dias no 2º turno.
        if (tIdx === 1 && rng() < 0.18) continue;

        const turno = TURNOS[tIdx];
        const tempoPlanejadoBase = turno.minutos_totais - turno.pausas_planejadas;

        let opcoes = MODELOS_POR_SETOR[maquina.setor];
        if (maquina.setor === 'Costura' && MODELOS_POR_LINHA_COSTURA[maquina.nome]) {
          opcoes = MODELOS_POR_LINHA_COSTURA[maquina.nome];
        }
        const modelo = modeloIds[opcoes[Math.floor(rng() * opcoes.length)]];
        const samEfetivo = samRecalculado[modelo.id] || modelo.sam_min;
        const ict = samEfetivo / maquina.operadores; // min/peça

        // Disponibilidade alvo: melhora com o tempo (ações de melhoria contínua).
        const base = maquina.setor === 'Costura' ? 0.80 : maquina.setor === 'Corte' ? 0.84 : 0.87;
        const ganho = progresso * 0.09;
        const penalidadeTurno2 = tIdx === 1 ? 0.035 : 0;
        const ruido = (rng() - 0.5) * 0.12;
        const alvoDisp = Math.min(0.97, Math.max(0.6, base + ganho - penalidadeTurno2 + ruido));

        const minutosPerdidos = Math.round(tempoPlanejadoBase * (1 - alvoDisp));

        // Distribui a perda em 1 a 4 eventos de parada não planejada.
        const pesos = PESOS_PARADA[maquina.setor] || PESOS_PARADA.Costura;
        const qtdEventos = minutosPerdidos <= 0 ? 0 : Math.min(4, 1 + Math.floor(rng() * Math.min(4, Math.max(1, Math.round(minutosPerdidos / 22)))));
        const eventos = [];
        let restante = minutosPerdidos;
        for (let e = 0; e < qtdEventos; e++) {
          const ultimo = e === qtdEventos - 1;
          const minutos = ultimo ? restante : Math.max(3, Math.round((restante / (qtdEventos - e)) * (0.55 + rng() * 0.9)));
          restante -= minutos;
          if (minutos <= 0) break;
          eventos.push({ motivo: escolher(pesos, rng), minutos, descricao: '' });
        }

        // Paradas planejadas extras: DDS na segunda, falta de programação ocasional.
        if (dow === 1 && tIdx === 0 && rng() < 0.7) eventos.push({ motivo: 'DDS', minutos: 15, descricao: 'Diálogo diário de segurança' });
        if (rng() < 0.04) eventos.push({ motivo: 'SEM_PROGRAMACAO', minutos: 20 + Math.round(rng() * 40), descricao: 'Aguardando liberação de OP' });

        // Ritmo (desempenho) também melhora no período.
        const alvoPerf = Math.min(0.99, Math.max(0.72, 0.80 + progresso * 0.10 + (rng() - 0.5) * 0.12 - penalidadeTurno2));
        const tempoOperacao = Math.max(0, tempoPlanejadoBase - minutosPerdidos);
        const pecasProduzidas = Math.max(0, Math.round((tempoOperacao / ict) * alvoPerf));

        // Defeitos: linha jeans/camisa social refuga mais.
        const baseDefeito = maquina.setor === 'Acabamento' ? 0.035 : modelo.sam_min > 25 ? 0.03 : 0.018;
        const taxaDefeito = Math.max(0.002, baseDefeito * (1.25 - progresso * 0.45) * (0.5 + rng()));
        const pecasDefeito = Math.round(pecasProduzidas * taxaDefeito);
        const pecasRetrabalho = Math.round(pecasProduzidas * (0.008 + rng() * 0.03));

        const r = run(
          db,
          `INSERT INTO apontamentos
             (data, maquina_id, turno_id, modelo_id, lider, pecas_produzidas, pecas_defeito, pecas_retrabalho, observacao)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          data, maquina.id, turnoIds[tIdx], modelo.id,
          LIDERES[Math.floor(rng() * LIDERES.length)],
          pecasProduzidas, pecasDefeito, pecasRetrabalho,
          OBSERVACOES[Math.floor(rng() * OBSERVACOES.length)]
        );
        apontamentos++;

        const stmtParada = db.prepare('INSERT INTO paradas (apontamento_id, motivo, minutos, descricao) VALUES (?, ?, ?, ?)');
        for (const ev of eventos) {
          stmtParada.run(r.lastInsertRowid, ev.motivo, ev.minutos, ev.descricao);
          paradas++;
        }

        // Produção individual apenas nas linhas de costura, onde existe tempo
        // padrão por operação para servir de referência à eficiência.
        if (maquina.setor === 'Costura') {
          producaoIndividual += registrarProducaoIndividual(db, rng, {
            apontamentoId: Number(r.lastInsertRowid),
            linhaNome: maquina.nome,
            modeloId: modelo.id,
            pecas: pecasProduzidas,
            defeitos: pecasDefeito,
            tempoOperacao,
            operadoresPorLinha,
            operacoesPorModelo,
          });
        }
      }
    }
  }

  return {
    turnos: turnoIds.length,
    setores: SETORES.length,
    maquinas: maquinas.length,
    modelos: modeloIds.length,
    equipes: equipes.length,
    operadores: Object.values(operadoresPorLinha).reduce((s2, l) => s2 + l.length, 0),
    operacoes: totalOperacoes,
    cronometragens: totalCronometragens,
    apontamentos,
    paradas,
    producaoIndividual,
    periodo: { de: datas[0], ate: datas[datas.length - 1] },
  };
}

function bancoJaPopulado(db) {
  const linha = db.prepare('SELECT COUNT(*) AS n FROM apontamentos').get();
  return Number(linha.n) > 0;
}

/** Semeia apenas se o banco estiver vazio (usado na inicialização do servidor). */
function semearSeVazio(db = getDb()) {
  if (bancoJaPopulado(db)) return null;
  const res = semear(db, {});
  console.log(`[seed] base vazia → dados de exemplo criados: ${res.apontamentos} apontamentos, ${res.paradas} paradas (${res.periodo.de} a ${res.periodo.ate})`);
  return res;
}

if (require.main === module) {
  const forcar = process.argv.includes('--force') || process.argv.includes('-f');
  const argDias = process.argv.find((a) => a.startsWith('--dias='));
  const dias = argDias ? parseInt(argDias.split('=')[1], 10) : 45;

  const db = forcar ? abrir() : getDb();
  if (forcar && bancoJaPopulado(db)) {
    const res = semear(db, { limpar: true, dias });
    console.log('[seed] base recriada com dados de exemplo:', JSON.stringify(res, null, 2));
  } else if (forcar) {
    const res = semear(db, { limpar: true, dias });
    console.log('[seed] dados de exemplo criados:', JSON.stringify(res, null, 2));
  } else {
    const res = semearSeVazio(db);
    console.log(res ? '[seed] dados de exemplo criados.' : '[seed] base já populada — nada a fazer (use --force para recriar).');
  }
  const cfg = getConfig(db);
  console.log('[seed] metas ativas:', cfg);
}

module.exports = { semear, semearSeVazio, bancoJaPopulado, criarRng, TURNOS, MAQUINAS, MODELOS, MOTIVOS_PARADA };
