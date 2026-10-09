#!/usr/bin/env node
// ============================================================
// Demonstração do Agente IA pelo terminal
//
//   node scripts/agent-demo.js                 -> diagnóstico das 6 áreas
//   node scripts/agent-demo.js "minha pergunta" -> resposta do agente
//   node scripts/agent-demo.js --report        -> relatório markdown na tela
//   node scripts/agent-demo.js --area estoque  -> aprofunda uma área
//
// Útil para validar o motor sem subir a interface web.
// ============================================================

const path = require('path');
const { initDatabase, getDb } = require('../database');
const agent = require('../src/agent');

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['area']);
const flags = [];
const positional = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.replace(/^--/, '').split('=')[0];
    flags.push(key);
    if (!arg.includes('=') && VALUE_FLAGS.has(key)) i += 1; // pula o valor do flag
    continue;
  }
  positional.push(arg);
}

function getFlag(name) {
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.split('=').slice(1).join('=');
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : null;
}

async function main() {
  await initDatabase();
  const db = getDb();
  const userRow = db.exec("SELECT id, company_name FROM users WHERE email = 'admin@erp.com'");
  if (!userRow.length) {
    console.error('Usuário admin não encontrado. Rode "npm run seed" primeiro.');
    process.exit(1);
  }
  const userId = userRow[0].values[0][0];
  const user = { id: userId, company_name: userRow[0].values[0][1] || 'Empresa Demo' };

  const area = getFlag('area');
  const question = positional[0];

  if (question) {
    const result = await agent.chat({ db, userId, user, message: question, useLlm: false });
    console.log(`\n🧠 intenção: ${result.parsed.intentLabel} | área: ${result.parsed.domainName || 'visão geral'} | fonte: ${result.source}\n`);
    console.log(result.reply.text);
    console.log('');
    return;
  }

  if (flags.includes('report')) {
    const report = agent.reportMarkdown(db, userId, user, { domain: area });
    console.log(report.content);
    return;
  }

  if (area) {
    const detail = agent.domainReport(db, userId, area);
    console.log(detail.markdown);
    return;
  }

  const diagnostic = agent.diagnostic(db, userId, user);
  const { score, level, summary } = diagnostic.company;

  console.log('\n🤖 AGENTE IA DE GESTÃO — ERP Gestão Financeira');
  console.log('='.repeat(64));
  console.log(`Empresa: ${user.company_name}`);
  console.log(`Índice de saúde do negócio: ${score === null ? 'sem dados' : `${score}/100`} (${level.label})`);
  console.log(`Alertas: ${diagnostic.company.criticalAlerts} crítico(s), ${diagnostic.company.highAlerts} alto(s), ${diagnostic.company.totalAlerts} no total`);
  console.log(`Recomendações: ${diagnostic.company.totalRecommendations}\n`);
  console.log(summary);
  console.log('\n' + '-'.repeat(64));
  console.log('NOTA POR ÁREA');
  diagnostic.domains.forEach((d) => {
    const bar = d.score === null ? '—' : '█'.repeat(Math.round(d.score / 5)) + '░'.repeat(20 - Math.round(d.score / 5));
    console.log(`${d.icon} ${d.name.padEnd(36)} ${String(d.score ?? '—').padStart(5)} ${bar} ${d.level.label}`);
  });

  console.log('\n' + '-'.repeat(64));
  console.log('ALERTAS PRIORITÁRIOS');
  diagnostic.alerts.slice(0, 10).forEach((a) => {
    const icon = { critica: '🔴', alta: '🟠', media: '🟡', baixa: '🔵' }[a.severity] || '⚪';
    console.log(`${icon} [${a.domain}] ${a.title}${a.impact ? ` — impacto ${a.impact}` : ''}`);
  });

  console.log('\n' + '-'.repeat(64));
  console.log('PLANO DE AÇÃO');
  [['🔥 7 dias', diagnostic.plan.now], ['📅 30 dias', diagnostic.plan.next], ['🎯 90 dias', diagnostic.plan.later]].forEach(([label, block]) => {
    console.log(`\n${label}:`);
    if (!block.focus.length) console.log('  (nenhuma ação)');
    block.focus.forEach((f, i) => console.log(`  ${i + 1}. ${f.title}${f.impact ? ` — ${f.impact}` : ''}`));
  });

  console.log('\n' + '='.repeat(64));
  console.log('Para perguntar algo:  node scripts/agent-demo.js "quais produtos estão em ruptura?"');
  console.log('Relatório completo:   node scripts/agent-demo.js --report\n');
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
