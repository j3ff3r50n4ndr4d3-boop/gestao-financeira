/**
 * FLUXO DE CAIXA EMPRESARIAL – Google Apps Script
 * ------------------------------------------------------------------
 * Cria automaticamente a planilha de fluxo de caixa (mesma estrutura
 * da versão Excel): Instruções, Premissas, Resumo, Fluxo Previsto,
 * Fluxo Realizado, Lançamentos e Listas.
 *
 * COMO USAR
 *  1. Abra uma planilha em branco no Google Sheets (sheets.new).
 *  2. Menu Extensões > Apps Script.
 *  3. Apague o conteúdo padrão, cole este código e salve.
 *  4. Selecione a função "criarFluxoDeCaixa" e clique em Executar.
 *  5. Autorize o script na primeira execução.
 *  6. Volte à planilha: o menu "Fluxo de Caixa" também permite recriá-la.
 *
 * ATENÇÃO: a execução recria todas as abas do fluxo (os dados existentes
 * nessas abas serão apagados). Faça uma cópia antes se já tiver dados.
 */

// ---------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------
const CFG = {
  empresa: 'Empresa Exemplo Ltda.',
  inicio: new Date(2026, 10, 1),   // 01/11/2026 (mês é 0-based)
  saldoInicial: 50000,
  reservaMinima: 20000,
  meses: 12,
  ultimaLinhaLanc: 1000,           // Lançamentos: linhas 5 a 1000
};

const NOMES = {
  instr: 'Instruções',
  prem: 'Premissas',
  resumo: 'Resumo',
  prev: 'Fluxo Previsto',
  real: 'Fluxo Realizado',
  lanc: 'Lançamentos',
  listas: 'Listas',
};

const ENTRADAS = [
  'Vendas de produtos',
  'Prestação de serviços',
  'Outras receitas operacionais',
  'Aportes de sócios / empréstimos recebidos',
];
const SAIDAS_OP = [
  'Matéria-prima / mercadorias (CMV)',
  'Fornecedores e compras',
  'Folha de pagamento (salários)',
  'Encargos trabalhistas (INSS, FGTS)',
  'Pró-labore',
  'Aluguel e condomínio',
  'Energia elétrica e água',
  'Internet e telefonia',
  'Marketing e publicidade',
  'Contabilidade e jurídico',
  'Impostos e taxas',
  'Transporte e logística',
  'Manutenção e reparos',
  'Outras despesas operacionais',
];
const SAIDAS_FIN = [
  'Juros e tarifas bancárias',
  'Pagamento de empréstimos e financiamentos',
  'Investimentos e equipamentos',
  'Distribuição de lucros / retiradas',
];
const TODAS_SAIDAS = SAIDAS_OP.concat(SAIDAS_FIN);

// Valores de exemplo (previsão mensal em R$) – editáveis na aba Fluxo Previsto
const EX_ENT = [
  [42000, 45000, 47000, 52000, 50000, 55000, 58000, 54000, 56000, 60000, 62000, 65000],
  [18000, 19000, 19500, 21000, 20500, 22000, 23000, 22500, 23500, 24000, 25000, 26000],
  [1500, 1200, 1800, 1000, 1400, 1600, 1300, 1500, 1700, 1200, 1400, 1600],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];
const EX_OP = [
  [17000, 18000, 18500, 20000, 19500, 21000, 22000, 21500, 22500, 23500, 24000, 25000],
  [4000, 4200, 4100, 4500, 4300, 4600, 4700, 4650, 4800, 5000, 5100, 5200],
  [14500, 14500, 14500, 14500, 14500, 14500, 14500, 14500, 14500, 14500, 14500, 14500],
  [4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200],
  [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000],
  [4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500],
  [1200, 1150, 1300, 1250, 1400, 1500, 1600, 1500, 1450, 1400, 1350, 1300],
  [480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480],
  [2000, 2000, 2500, 2000, 2000, 3000, 2000, 2000, 2500, 2000, 2000, 3000],
  [1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200],
  [3600, 3600, 3900, 3700, 3800, 4000, 4200, 4100, 4300, 4400, 4500, 4700],
  [1500, 1600, 1700, 1500, 1600, 1800, 1900, 1800, 1700, 1800, 1900, 2000],
  [600, 300, 800, 400, 500, 900, 400, 300, 700, 500, 600, 400],
  [800, 700, 900, 800, 750, 850, 800, 900, 700, 800, 850, 900],
];
const EX_FIN = [
  [350, 340, 330, 320, 310, 300, 290, 280, 270, 260, 250, 240],
  [2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500],
  [0, 0, 6000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const EXEMPLOS_LANC = [
  [new Date(2026, 10, 3), 'Entrada', ENTRADAS[0], 'NF 1001 – Cliente Alfa', 15800, 'Realizado'],
  [new Date(2026, 10, 5), 'Saída', SAIDAS_OP[0], 'Fornecedor Beta – compra de insumos', 6200, 'Realizado'],
  [new Date(2026, 10, 5), 'Saída', SAIDAS_OP[5], 'Aluguel novembro', 4500, 'Realizado'],
  [new Date(2026, 10, 7), 'Entrada', ENTRADAS[1], 'Contrato de consultoria – parcela 1', 9000, 'Realizado'],
  [new Date(2026, 10, 10), 'Saída', SAIDAS_OP[2], 'Folha de pagamento – 1ª quinzena', 7250, 'Realizado'],
  [new Date(2026, 10, 15), 'Saída', SAIDAS_FIN[0], 'Tarifa bancária mensal', 340, 'Realizado'],
  [new Date(2026, 10, 20), 'Entrada', ENTRADAS[0], 'NF 1012 – Cliente Gama', 12300, 'Previsto'],
  [new Date(2026, 10, 25), 'Saída', SAIDAS_OP[10], 'DAS / Simples Nacional', 1850, 'Previsto'],
];

// Estilos
const COR = {
  navy: '#1F3864',
  azulClaro: '#DDEBF7',
  cinza: '#F2F2F2',
  amareloIn: '#FFF2CC',
  azulIn: '#0000FF',
  verdeBg: '#C6EFCE',
  vermelhoBg: '#F8CBAD',
  amareloBg: '#FFEB9C',
  branco: '#FFFFFF',
};
const FMT_MOEDA = '"R$" #,##0.00;[Red]-"R$" #,##0.00;"R$" -';
const FMT_NUM = '#,##0.00;[Red]-#,##0.00;"-"';
const FMT_PCT = '0.0%;[Red]-0.0%;"-"';
const FMT_MES = 'mmm/yy';
const FMT_DATA = 'dd/mm/yyyy';

// ---------------------------------------------------------------
// Ponto de entrada
// ---------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Fluxo de Caixa')
    .addItem('Recriar planilha de fluxo de caixa', 'criarFluxoDeCaixa')
    .addToUi();
}

function criarFluxoDeCaixa() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    // Script "independente": cria uma nova planilha
    ss = SpreadsheetApp.create('Fluxo de Caixa Empresarial');
    Logger.log('Nova planilha criada: ' + ss.getUrl());
  }

  // Remove a aba padrão vazia que o Google Sheets cria em planilhas novas
  ['Página1', 'Sheet1', 'Planilha1'].forEach(function (nome) {
    const sh = ss.getSheetByName(nome);
    if (sh && sh.getLastRow() === 0 && sh.getLastColumn() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });

  // Remove abas antigas do fluxo (mantém pelo menos uma aba durante a criação)
  const nomesFluxo = Object.values(NOMES);
  const temporaria = ss.insertSheet('__tmp__');
  ss.getSheets().forEach(function (sh) {
    if (sh.getName() !== '__tmp__' && nomesFluxo.indexOf(sh.getName()) !== -1) {
      ss.deleteSheet(sh);
    }
  });

  const shInstr = ss.insertSheet(NOMES.instr);
  const shPrem = ss.insertSheet(NOMES.prem);
  const shResumo = ss.insertSheet(NOMES.resumo);
  const shPrev = ss.insertSheet(NOMES.prev);
  const shReal = ss.insertSheet(NOMES.real);
  const shLanc = ss.insertSheet(NOMES.lanc);
  const shListas = ss.insertSheet(NOMES.listas);

  // Ordem das abas
  [shInstr, shPrem, shResumo, shPrev, shReal, shLanc, shListas].forEach(function (sh, i) {
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });

  criarListas(shListas);
  criarPremissas(shPrem);
  criarLancamentos(shLanc);
  const infoPrev = criarFluxo(shPrev, 'prev');
  const infoReal = criarFluxo(shReal, 'real');
  criarResumo(shResumo, infoPrev, infoReal);
  criarInstrucoes(shInstr);

  ss.deleteSheet(temporaria);
  ss.setActiveSheet(shInstr);
  ss.toast('Planilha de fluxo de caixa criada com sucesso!', 'Fluxo de Caixa', 5);
}

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------
function colLetra(n) {               // 1 -> A
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function refAba(nome) {              // nomes com espaço/acento precisam de aspas
  return "'" + nome + "'";
}

function estiloCabecalho(range) {
  range.setBackground(COR.navy)
    .setFontColor(COR.branco)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
}

function estiloSecao(range) {
  range.setBackground(COR.azulClaro).setFontColor(COR.navy).setFontWeight('bold');
}

function estiloEntrada(range) {
  range.setFontColor(COR.azulIn).setBackground(COR.amareloIn);
}

function bordas(range) {
  range.setBorder(true, true, true, true, true, true, '#BFBFBF', SpreadsheetApp.BorderStyle.SOLID);
}

function semGrade(sh) {
  sh.setHiddenGridlines(true);
}

// ---------------------------------------------------------------
// Listas
// ---------------------------------------------------------------
function criarListas(sh) {
  sh.getRange('A1:G1').setValues([['Categorias de Entrada', 'Categorias de Saída', '', 'Tipo', 'Status', '', 'Todas as categorias']]);
  estiloCabecalho(sh.getRange('A1:B1'));
  estiloCabecalho(sh.getRange('D1:E1'));
  estiloCabecalho(sh.getRange('G1'));

  sh.getRange(2, 1, ENTRADAS.length, 1).setValues(ENTRADAS.map(function (x) { return [x]; }));
  sh.getRange(2, 2, TODAS_SAIDAS.length, 1).setValues(TODAS_SAIDAS.map(function (x) { return [x]; }));
  sh.getRange(2, 4, 2, 1).setValues([['Entrada'], ['Saída']]);
  sh.getRange(2, 5, 2, 1).setValues([['Realizado'], ['Previsto']]);
  const todas = ENTRADAS.concat(TODAS_SAIDAS);
  sh.getRange(2, 7, todas.length, 1).setValues(todas.map(function (x) { return [x]; }));

  sh.setColumnWidth(1, 300);
  sh.setColumnWidth(2, 330);
  sh.setColumnWidth(3, 20);
  sh.setColumnWidth(4, 90);
  sh.setColumnWidth(5, 100);
  sh.setColumnWidth(6, 20);
  sh.setColumnWidth(7, 330);
}

// ---------------------------------------------------------------
// Premissas
// ---------------------------------------------------------------
function criarPremissas(sh) {
  semGrade(sh);
  sh.getRange('A1').setValue('Premissas do Planejamento').setFontSize(16).setFontWeight('bold').setFontColor(COR.navy);
  sh.getRange('A2').setValue('Preencha os campos em azul. Todas as demais abas usam estas informações.')
    .setFontStyle('italic').setFontColor('#595959');

  sh.getRange('A4:B7').setValues([
    ['Nome da empresa', CFG.empresa],
    ['Primeiro mês do fluxo (1º dia)', CFG.inicio],
    ['Saldo inicial de caixa (R$)', CFG.saldoInicial],
    ['Reserva mínima de caixa (R$)', CFG.reservaMinima],
  ]);
  sh.getRange('A4:A7').setFontWeight('bold');
  estiloEntrada(sh.getRange('B4:B7'));
  bordas(sh.getRange('A4:B7'));
  sh.getRange('B5').setNumberFormat(FMT_DATA);
  sh.getRange('B6:B7').setNumberFormat(FMT_MOEDA);
  sh.getRange('B4:B7').setHorizontalAlignment('left');

  sh.getRange('A9').setValue('Dica: a reserva mínima equivale, em geral, a 1 a 2 meses de saídas operacionais fixas.')
    .setFontStyle('italic').setFontColor('#595959');
  sh.setColumnWidth(1, 260);
  sh.setColumnWidth(2, 260);
}

// ---------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------
function criarLancamentos(sh) {
  semGrade(sh);
  const ult = CFG.ultimaLinhaLanc;
  sh.getRange('A1').setValue('Lançamentos (Movimentações de Caixa)').setFontSize(16).setFontWeight('bold').setFontColor(COR.navy);
  sh.getRange('A2').setValue("Registre cada entrada/saída. Valores sempre positivos – o tipo define o sinal. Somente status 'Realizado' entra no Fluxo Realizado.")
    .setFontStyle('italic').setFontColor('#595959');

  const cab = sh.getRange('A4:F4');
  cab.setValues([['Data', 'Tipo', 'Categoria', 'Descrição / Favorecido', 'Valor (R$)', 'Status']]);
  estiloCabecalho(cab);

  const corpo = sh.getRange(5, 1, ult - 4, 6);
  corpo.setFontColor(COR.azulIn);
  bordas(corpo);
  sh.getRange(5, 1, ult - 4, 1).setNumberFormat(FMT_DATA);
  sh.getRange(5, 5, ult - 4, 1).setNumberFormat(FMT_NUM);

  EXEMPLOS_LANC.forEach(function (ex, i) {
    sh.getRange(5 + i, 1, 1, 6).setValues([ex]);
  });

  // Listas suspensas
  const listas = refAba(NOMES.listas);
  sh.getRange(5, 2, ult - 4, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(sh.getParent().getRange(listas + '!D2:D3'), true).build());
  sh.getRange(5, 3, ult - 4, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(sh.getParent().getRange(listas + '!G2:G' + (1 + ENTRADAS.length + TODAS_SAIDAS.length)), true)
      .setAllowInvalid(false).build());
  sh.getRange(5, 6, ult - 4, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(sh.getParent().getRange(listas + '!E2:E3'), true).build());
  sh.getRange(5, 5, ult - 4, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false)
      .setHelpText('Informe um valor positivo.').build());
  sh.getRange(5, 1, ult - 4, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false)
      .setHelpText('Informe uma data válida.').build());

  // Destaque por tipo
  const regras = sh.getConditionalFormatRules();
  regras.push(
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Entrada')
      .setBackground(COR.verdeBg).setRanges([sh.getRange(5, 2, ult - 4, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Saída')
      .setBackground(COR.vermelhoBg).setRanges([sh.getRange(5, 2, ult - 4, 1)]).build()
  );
  sh.setConditionalFormatRules(regras);

  sh.setColumnWidth(1, 100);
  sh.setColumnWidth(2, 80);
  sh.setColumnWidth(3, 300);
  sh.setColumnWidth(4, 300);
  sh.setColumnWidth(5, 120);
  sh.setColumnWidth(6, 100);
  sh.setFrozenRows(4);
  sh.getRange(4, 1, ult - 3, 6).createFilter();
}

// ---------------------------------------------------------------
// Fluxo Previsto / Realizado
// ---------------------------------------------------------------
/**
 * mode 'prev' -> valores digitados; mode 'real' -> SUMIFS dos lançamentos.
 * Retorna as linhas-chave para o Resumo.
 */
function criarFluxo(sh, mode) {
  semGrade(sh);
  const M = CFG.meses;
  const TOT = 2 + M;               // coluna N
  const HDR = 4;
  const titulo = mode === 'prev' ? 'Fluxo de Caixa Previsto' : 'Fluxo de Caixa Realizado';
  sh.getRange('A1').setFormula('=Premissas!$B$4&" – ' + titulo + '"')
    .setFontSize(16).setFontWeight('bold').setFontColor(COR.navy);
  sh.getRange('A2').setValue(mode === 'prev'
    ? 'Valores em R$. Células em azul com fundo amarelo = dados digitados (editáveis). Demais células são fórmulas.'
    : "Valores em R$ calculados automaticamente a partir da aba 'Lançamentos' (somente status 'Realizado').")
    .setFontStyle('italic').setFontColor('#595959');

  // Cabeçalho de meses
  const cabVals = ['Descrição'];
  const cabForm = [];
  for (let m = 0; m < M; m++) {
    cabForm.push(m === 0 ? '=Premissas!$B$5' : '=EDATE(' + colLetra(2 + m - 1) + HDR + ',1)');
  }
  sh.getRange(HDR, 1).setValue('Descrição');
  sh.getRange(HDR, 2, 1, M).setFormulas([cabForm]);
  sh.getRange(HDR, TOT).setValue('Total 12 meses');
  estiloCabecalho(sh.getRange(HDR, 1, 1, TOT));
  sh.getRange(HDR, 2, 1, M).setNumberFormat(FMT_MES);
  sh.setRowHeight(HDR, 28);

  let r = HDR + 1;
  const rows = {};

  // Helpers --------------------------------------------------------
  const escreverLinhaFormula = function (linha, label, fn) {
    sh.getRange(linha, 1).setValue(label);
    const f = [];
    for (let m = 0; m < M; m++) f.push(fn(m, 2 + m));
    sh.getRange(linha, 2, 1, M).setFormulas([f]);
    sh.getRange(linha, TOT).setFormula('=SUM(B' + linha + ':' + colLetra(TOT - 1) + linha + ')');
    sh.getRange(linha, 2, 1, M + 1).setNumberFormat(FMT_MOEDA);
    bordas(sh.getRange(linha, 1, 1, TOT));
  };

  const escreverLinhaValores = function (linha, label, valores) {
    sh.getRange(linha, 1).setValue(label);
    sh.getRange(linha, 2, 1, M).setValues([valores]);
    estiloEntrada(sh.getRange(linha, 2, 1, M));
    sh.getRange(linha, TOT).setFormula('=SUM(B' + linha + ':' + colLetra(TOT - 1) + linha + ')');
    sh.getRange(linha, 2, 1, M + 1).setNumberFormat(FMT_MOEDA);
    bordas(sh.getRange(linha, 1, 1, TOT));
  };

  const formulaSomif = function (linha) {
    return function (m, col) {
      const mes = colLetra(col) + '$' + HDR;
      const L = refAba(NOMES.lanc);
      return '=SUMIFS(' + L + '!$E$5:$E$' + CFG.ultimaLinhaLanc + ',' +
        L + '!$C$5:$C$' + CFG.ultimaLinhaLanc + ',$A' + linha + ',' +
        L + '!$F$5:$F$' + CFG.ultimaLinhaLanc + ',"Realizado",' +
        L + '!$A$5:$A$' + CFG.ultimaLinhaLanc + ',">="&' + mes + ',' +
        L + '!$A$5:$A$' + CFG.ultimaLinhaLanc + ',"<="&EOMONTH(' + mes + ',0))';
    };
  };

  const secao = function (titulo) {
    sh.getRange(r, 1, 1, TOT).setBackground(COR.azulClaro);
    sh.getRange(r, 1).setValue(titulo);
    estiloSecao(sh.getRange(r, 1, 1, TOT));
    r++;
  };

  const linhaTotal = function (label, fn, key) {
    sh.getRange(r, 1).setValue(label);
    const f = [];
    for (let m = 0; m < M; m++) f.push(fn(m, 2 + m));
    sh.getRange(r, 2, 1, M).setFormulas([f]);
    sh.getRange(r, TOT).setFormula('=SUM(B' + r + ':' + colLetra(TOT - 1) + r + ')');
    const faixa = sh.getRange(r, 1, 1, TOT);
    faixa.setFontWeight('bold').setBackground(COR.cinza)
      .setBorder(true, false, false, false, false, false, '#000000', SpreadsheetApp.BorderStyle.SOLID)
      .setBorder(false, false, true, false, false, false, '#000000', SpreadsheetApp.BorderStyle.DOUBLE);
    sh.getRange(r, 2, 1, M + 1).setNumberFormat(FMT_MOEDA);
    if (key) rows[key] = r;
    r++;
    return r - 1;
  };

  // Saldo inicial (linha 5) – fórmulas definidas após conhecer a linha do saldo final
  const srow = r;
  sh.getRange(r, 1).setValue('Saldo inicial de caixa').setFontWeight('bold');
  r++;

  secao('ENTRADAS');
  const entRows = [];
  ENTRADAS.forEach(function (nome, i) {
    if (mode === 'prev') {
      escreverLinhaValores(r, nome, EX_ENT[i]);
    } else {
      escreverLinhaFormula(r, nome, formulaSomif(r));
    }
    entRows.push(r);
    r++;
  });
  const tEnt = linhaTotal('(=) Total de entradas',
    function (m, c) { return '=SUM(' + colLetra(c) + entRows[0] + ':' + colLetra(c) + entRows[entRows.length - 1] + ')'; }, 'ent');

  secao('SAÍDAS OPERACIONAIS');
  const opRows = [];
  SAIDAS_OP.forEach(function (nome, i) {
    if (mode === 'prev') {
      escreverLinhaValores(r, nome, EX_OP[i]);
    } else {
      escreverLinhaFormula(r, nome, formulaSomif(r));
    }
    opRows.push(r);
    r++;
  });
  const tOp = linhaTotal('(–) Total de saídas operacionais',
    function (m, c) { return '=SUM(' + colLetra(c) + opRows[0] + ':' + colLetra(c) + opRows[opRows.length - 1] + ')'; }, 'op');

  secao('SAÍDAS FINANCEIRAS E INVESTIMENTOS');
  const finRows = [];
  SAIDAS_FIN.forEach(function (nome, i) {
    if (mode === 'prev') {
      escreverLinhaValores(r, nome, EX_FIN[i]);
    } else {
      escreverLinhaFormula(r, nome, formulaSomif(r));
    }
    finRows.push(r);
    r++;
  });
  const tFin = linhaTotal('(–) Total de saídas financeiras',
    function (m, c) { return '=SUM(' + colLetra(c) + finRows[0] + ':' + colLetra(c) + finRows[finRows.length - 1] + ')'; }, 'fin');

  r++;
  const resOp = linhaTotal('Resultado operacional (entradas – saídas operacionais)',
    function (m, c) { return '=' + colLetra(c) + tEnt + '-' + colLetra(c) + tOp; }, 'resop');
  const liq = linhaTotal('FLUXO DE CAIXA LÍQUIDO DO MÊS',
    function (m, c) { return '=' + colLetra(c) + tEnt + '-' + colLetra(c) + tOp + '-' + colLetra(c) + tFin; }, 'liq');
  const saldo = linhaTotal('SALDO FINAL DE CAIXA',
    function (m, c) { return '=' + colLetra(c) + srow + '+' + colLetra(c) + liq; }, 'saldo');
  // Total do saldo final = saldo do último mês
  sh.getRange(saldo, TOT).setFormula('=M' + saldo);

  // Saldo inicial: 1º mês = Premissas; demais = saldo final do mês anterior
  const fSaldo = [];
  for (let m = 0; m < M; m++) {
    fSaldo.push(m === 0 ? '=Premissas!$B$6' : '=' + colLetra(2 + m - 1) + saldo);
  }
  sh.getRange(srow, 2, 1, M).setFormulas([fSaldo]).setNumberFormat(FMT_MOEDA);
  sh.getRange(srow, TOT).setFormula('=B' + srow).setNumberFormat(FMT_MOEDA).setFontWeight('bold');
  bordas(sh.getRange(srow, 1, 1, TOT));

  r++;
  secao('INDICADORES E ALERTAS');
  const reserva = r;
  sh.getRange(r, 1).setValue('Reserva mínima de caixa (Premissas)');
  const fRes = []; for (let m = 0; m < M; m++) fRes.push('=Premissas!$B$7');
  sh.getRange(r, 2, 1, M).setFormulas([fRes]).setNumberFormat(FMT_MOEDA);
  bordas(sh.getRange(r, 1, 1, TOT));
  r++;

  const margem = r;
  sh.getRange(r, 1).setValue('Margem operacional (%)');
  const fMar = []; for (let m = 0; m < M; m++) { const c = colLetra(2 + m); fMar.push('=IFERROR(' + c + resOp + '/' + c + tEnt + ',0)'); }
  sh.getRange(r, 2, 1, M).setFormulas([fMar]).setNumberFormat(FMT_PCT);
  sh.getRange(r, TOT).setFormula('=IFERROR(N' + resOp + '/N' + tEnt + ',0)').setNumberFormat(FMT_PCT);
  bordas(sh.getRange(r, 1, 1, TOT));
  r++;

  const cob = r;
  sh.getRange(r, 1).setValue('Cobertura de saídas pelas entradas (x)');
  const fCob = []; for (let m = 0; m < M; m++) { const c = colLetra(2 + m); fCob.push('=IFERROR(' + c + tEnt + '/(' + c + tOp + '+' + c + tFin + '),0)'); }
  sh.getRange(r, 2, 1, M).setFormulas([fCob]).setNumberFormat('0.00"x"');
  sh.getRange(r, TOT).setFormula('=IFERROR(N' + tEnt + '/(N' + tOp + '+N' + tFin + '),0)').setNumberFormat('0.00"x"');
  bordas(sh.getRange(r, 1, 1, TOT));
  r++;

  const sit = r;
  sh.getRange(r, 1).setValue('Situação do caixa').setFontWeight('bold');
  const fSit = [];
  for (let m = 0; m < M; m++) {
    const c = colLetra(2 + m);
    fSit.push('=IF(' + c + saldo + '<0,"NEGATIVO",IF(' + c + saldo + '<' + c + reserva + ',"ABAIXO RESERVA","OK"))');
  }
  sh.getRange(r, 2, 1, M).setFormulas([fSit]).setHorizontalAlignment('center').setFontWeight('bold');
  sh.getRange(r, TOT).setFormula('=COUNTIF(B' + r + ':M' + r + ',"<>OK")&" mês(es) em alerta"').setFontWeight('bold');
  bordas(sh.getRange(r, 1, 1, TOT));

  // Formatação condicional da situação e do saldo negativo
  const faixaSit = sh.getRange(sit, 2, 1, M);
  const regras = sh.getConditionalFormatRules();
  regras.push(
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('NEGATIVO').setBackground(COR.vermelhoBg).setRanges([faixaSit]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('ABAIXO RESERVA').setBackground(COR.amareloBg).setRanges([faixaSit]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('OK').setBackground(COR.verdeBg).setRanges([faixaSit]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setBackground(COR.vermelhoBg)
      .setRanges([sh.getRange(saldo, 2, 1, M)]).build()
  );
  sh.setConditionalFormatRules(regras);

  // Layout
  sh.setColumnWidth(1, 340);
  sh.setColumnWidths(2, M, 110);
  sh.setColumnWidth(TOT, 125);
  sh.setFrozenRows(HDR);
  sh.setFrozenColumns(1);

  return {
    hdr: HDR, ent: tEnt, op: tOp, fin: tFin, liq: liq, saldo: saldo, sit: sit,
    resop: resOp, srow: srow, margem: margem, cob: cob,
  };
}

// ---------------------------------------------------------------
// Resumo (com gráfico)
// ---------------------------------------------------------------
function criarResumo(sh, ip, ir) {
  semGrade(sh);
  const P = refAba(NOMES.prev);
  const R = refAba(NOMES.real);
  const TOT = 'N';

  sh.getRange('A1').setFormula('=Premissas!$B$4&" – Resumo do Fluxo de Caixa"')
    .setFontSize(16).setFontWeight('bold').setFontColor(COR.navy);
  sh.getRange('A2').setFormula(
    '="Período: "&RIGHT("0"&MONTH(Premissas!$B$5),2)&"/"&YEAR(Premissas!$B$5)&" a "&' +
    'RIGHT("0"&MONTH(EDATE(Premissas!$B$5,11)),2)&"/"&YEAR(EDATE(Premissas!$B$5,11))')
    .setFontStyle('italic').setFontColor('#595959');

  const cab = sh.getRange('A4:E4');
  cab.setValues([['Indicador (12 meses)', 'Previsto', 'Realizado', 'Variação (R$)', 'Variação (%)']]);
  estiloCabecalho(cab);

  const kpis = [
    ['Saldo inicial de caixa', '=' + P + '!B' + ip.srow, '=' + R + '!B' + ir.srow, FMT_MOEDA],
    ['Total de entradas', '=' + P + '!' + TOT + ip.ent, '=' + R + '!' + TOT + ir.ent, FMT_MOEDA],
    ['Total de saídas operacionais', '=' + P + '!' + TOT + ip.op, '=' + R + '!' + TOT + ir.op, FMT_MOEDA],
    ['Total de saídas financeiras e investimentos', '=' + P + '!' + TOT + ip.fin, '=' + R + '!' + TOT + ir.fin, FMT_MOEDA],
    ['Resultado operacional', '=' + P + '!' + TOT + ip.resop, '=' + R + '!' + TOT + ir.resop, FMT_MOEDA],
    ['Fluxo de caixa líquido do período', '=' + P + '!' + TOT + ip.liq, '=' + R + '!' + TOT + ir.liq, FMT_MOEDA],
    ['Saldo final de caixa', '=' + P + '!M' + ip.saldo, '=' + R + '!M' + ir.saldo, FMT_MOEDA],
    ['Menor saldo mensal do período', '=MIN(' + P + '!B' + ip.saldo + ':M' + ip.saldo + ')',
      '=MIN(' + R + '!B' + ir.saldo + ':M' + ir.saldo + ')', FMT_MOEDA],
    ['Margem operacional (%)',
      '=IFERROR(' + P + '!' + TOT + ip.resop + '/' + P + '!' + TOT + ip.ent + ',0)',
      '=IFERROR(' + R + '!' + TOT + ir.resop + '/' + R + '!' + TOT + ir.ent + ',0)', FMT_PCT],
    ['Meses com caixa em alerta',
      '=COUNTIF(' + P + '!B' + ip.sit + ':M' + ip.sit + ',"<>OK")',
      '=COUNTIF(' + R + '!B' + ir.sit + ':M' + ir.sit + ',"<>OK")', '0'],
  ];
  kpis.forEach(function (k, i) {
    const row = 5 + i;
    const isPct = k[3] === FMT_PCT;
    sh.getRange(row, 1).setValue(k[0]).setFontWeight('bold');
    sh.getRange(row, 2).setFormula(k[1]).setNumberFormat(k[3]);
    sh.getRange(row, 3).setFormula(k[2]).setNumberFormat(k[3]);
    sh.getRange(row, 4).setFormula('=C' + row + '-B' + row).setNumberFormat(k[3]);
    if (isPct) {
      sh.getRange(row, 5).setValue('');
    } else {
      sh.getRange(row, 5).setFormula('=IFERROR((C' + row + '-B' + row + ')/ABS(B' + row + '),0)').setNumberFormat(FMT_PCT);
    }
    bordas(sh.getRange(row, 1, 1, 5));
  });
  sh.getRange('A16').setValue('Variação (%) = (Realizado – Previsto) / |Previsto|. Para saídas, variação positiva significa gasto acima do previsto.')
    .setFontStyle('italic').setFontColor('#595959');

  const regras = sh.getConditionalFormatRules();
  regras.push(
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setBackground(COR.vermelhoBg)
      .setRanges([sh.getRange('D5:D14')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground(COR.verdeBg)
      .setRanges([sh.getRange('D5:D14')]).build()
  );
  sh.setConditionalFormatRules(regras);

  // Tabela mensal (base do gráfico)
  const base = 20;
  sh.getRange(base - 1, 1).setValue('Dados para o gráfico (Previsto)').setFontWeight('bold').setFontColor(COR.navy);
  sh.getRange(base, 1, 1, 4).setValues([['Mês', 'Entradas', 'Saídas', 'Saldo final']]);
  estiloCabecalho(sh.getRange(base, 1, 1, 4));
  const linhas = [];
  for (let m = 0; m < CFG.meses; m++) {
    const c = colLetra(2 + m);
    linhas.push([
      '=' + P + '!' + c + ip.hdr,
      '=' + P + '!' + c + ip.ent,
      '=' + P + '!' + c + ip.op + '+' + P + '!' + c + ip.fin,
      '=' + P + '!' + c + ip.saldo,
    ]);
  }
  sh.getRange(base + 1, 1, CFG.meses, 4).setFormulas(linhas);
  sh.getRange(base + 1, 1, CFG.meses, 1).setNumberFormat(FMT_MES).setHorizontalAlignment('left');
  sh.getRange(base + 1, 2, CFG.meses, 3).setNumberFormat(FMT_NUM);
  bordas(sh.getRange(base + 1, 1, CFG.meses, 4));

  // Gráfico combinado: colunas (entradas, saídas) + linha (saldo final)
  const chart = sh.newChart()
    .setChartType(Charts.ChartType.COMBO)
    .addRange(sh.getRange(base, 1, CFG.meses + 1, 4))
    .setPosition(4, 7, 0, 0)
    .setOption('title', 'Entradas x Saídas x Saldo final (Previsto)')
    .setOption('hAxis', { title: 'Mês' })
    .setOption('vAxis', { title: 'R$', format: '#,##0' })
    .setOption('colors', ['#2E75B6', '#C55A11', COR.navy])
    .setOption('seriesType', 'bars')
    .setOption('series', { 2: { type: 'line', lineWidth: 3, pointSize: 6 } })
    .setOption('legend', { position: 'bottom' })
    .setOption('width', 760)
    .setOption('height', 420)
    .build();
  sh.insertChart(chart);

  sh.setColumnWidth(1, 300);
  sh.setColumnWidth(2, 130);
  sh.setColumnWidth(3, 130);
  sh.setColumnWidth(4, 130);
  sh.setColumnWidth(5, 110);
}

// ---------------------------------------------------------------
// Instruções
// ---------------------------------------------------------------
function criarInstrucoes(sh) {
  semGrade(sh);
  sh.setColumnWidth(1, 20);
  sh.setColumnWidth(2, 200);
  sh.setColumnWidth(3, 620);
  sh.getRange('B2').setValue('FLUXO DE CAIXA EMPRESARIAL').setFontSize(20).setFontWeight('bold').setFontColor(COR.navy);
  sh.getRange('B3').setValue('Planejamento (previsto) e acompanhamento (realizado) do caixa mensal')
    .setFontStyle('italic').setFontColor('#595959');

  const itens = [
    ['COMO USAR', null],
    ['1. Premissas', 'Informe nome da empresa, mês inicial, saldo de caixa inicial e a reserva mínima desejada.'],
    ['2. Fluxo Previsto', 'Digite nas células azuis (fundo amarelo) os valores previstos de cada categoria, mês a mês.'],
    ['3. Lançamentos', 'Registre cada movimentação real: data, tipo, categoria, descrição, valor e status. Use as listas suspensas.'],
    ['4. Fluxo Realizado', "Calculado automaticamente a partir dos lançamentos com status 'Realizado'. Não digite aqui."],
    ['5. Resumo', 'Painel com totais de 12 meses, comparativo previsto x realizado, alertas e gráfico.'],
    ['6. Listas', 'Categorias usadas nas listas suspensas. Pode renomear, mas mantenha os nomes iguais nas abas de fluxo.'],
    ['', null],
    ['CONVENÇÕES', null],
    ['Azul / fundo amarelo', 'Dados digitados pelo usuário (editáveis).'],
    ['Preto', 'Fórmulas – não sobrescrever.'],
    ['Vermelho / parênteses', 'Valores negativos.'],
    ['Situação do caixa', 'OK = saldo acima da reserva;  ABAIXO RESERVA = saldo positivo, porém menor que a reserva;  NEGATIVO = saldo menor que zero.'],
    ['', null],
    ['OBSERVAÇÕES', null],
    ['Dados de exemplo', 'A planilha vem com valores fictícios para demonstração. Substitua-os pelos seus dados reais.'],
    ['Regime de caixa', 'O fluxo considera entradas e saídas efetivas de dinheiro (data de recebimento/pagamento), não o regime de competência.'],
    ['Capacidade', 'A aba Lançamentos suporta até 996 registros (linhas 5 a 1000). Para ampliar, ajuste CFG.ultimaLinhaLanc no script.'],
  ];
  let row = 5;
  itens.forEach(function (it) {
    const [k, v] = it;
    if (k && v === null) {
      sh.getRange(row, 2, 1, 2).setBackground(COR.azulClaro);
      sh.getRange(row, 2).setValue(k).setFontWeight('bold').setFontColor(COR.navy);
    } else if (k) {
      sh.getRange(row, 2).setValue(k).setFontWeight('bold').setVerticalAlignment('top');
      sh.getRange(row, 3).setValue(v).setWrap(true).setVerticalAlignment('top');
    }
    row++;
  });
}
