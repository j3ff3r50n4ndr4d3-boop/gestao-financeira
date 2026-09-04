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

/** Afinidade entre célula e modelos — evita combinação sem sentido. */
const MODELOS_POR_SETOR = {
  Corte: MODELOS.map((_, i) => i),
  Costura: MODELOS.map((_, i) => i),
  Acabamento: MODELOS.map((_, i) => i),
  Passadoria: MODELOS.map((_, i) => i),
};

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
      DELETE FROM paradas;
      DELETE FROM apontamentos;
      DELETE FROM modelos;
      DELETE FROM maquinas;
      DELETE FROM turnos;
      DELETE FROM setores;
    `);
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('paradas','apontamentos','modelos','maquinas','turnos','setores')");
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

  const datas = diasUteisAteHoje(dias, rng);
  const totalDias = datas.length;

  let apontamentos = 0;
  let paradas = 0;

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

        const opcoes = MODELOS_POR_SETOR[maquina.setor];
        const modelo = modeloIds[opcoes[Math.floor(rng() * opcoes.length)]];
        const ict = modelo.sam_min / maquina.operadores; // min/peça

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
      }
    }
  }

  return {
    turnos: turnoIds.length,
    setores: SETORES.length,
    maquinas: maquinas.length,
    modelos: modeloIds.length,
    apontamentos,
    paradas,
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
