#!/usr/bin/env node
// Gera o documento CURSO.md a partir da fonte única de verdade
// (src/course/modules/*.js). Uso: npm run course:doc
const fs = require('fs');
const path = require('path');
const { course, modules, stats } = require('../src/course/curriculum');

const s = stats();
const horas = String(s.totalHours).replace('.', ','); // formato pt-BR
const out = [];
const line = (text = '') => out.push(text);

line(`# 🎓 ${course.title}`);
line();
line(`> ${course.subtitle}`);
line();
line(`**Carga horária:** ${course.certification.workloadHours} horas (${horas} horas de aulas + exercícios práticos no sistema e projeto final) · **Módulos:** ${s.totalModules} · **Aulas:** ${s.totalLessons} · **Questões de quiz:** ${s.totalQuestions} · **Versão do currículo:** ${course.version}`);
line();
line('## Sobre o curso');
line();
line(course.description);
line();
line('### Para quem é');
line();
course.audience.forEach((item) => line(`- ${item}`));
line();
line('### Pré-requisitos');
line();
course.prerequisites.forEach((item) => line(`- ${item}`));
line();
line('### Metodologia');
line();
course.methodology.forEach((item) => line(`- ${item}`));
line();
line('### Certificação');
line();
line(`**${course.certification.name}** (${course.certification.workloadHours} horas, sendo ${horas} horas de conteúdo) - concedido ao concluir ${course.certification.minCompletion}% das aulas com média mínima de ${course.certification.minAverage}% nos quizzes. No sistema, o progresso é salvo por usuário e o certificado com código de verificação aparece no módulo **Curso** da barra lateral.`);
line();
line('## Ementa completa');
line();
line('| Módulo | Tema | Nível | Aulas | Minutos |');
line('| --- | --- | --- | --- | --- |');
modules.forEach((mod) => {
  const minutes = mod.lessons.reduce((sum, l) => sum + (l.duration || 0), 0);
  line(`| ${mod.icon} ${mod.title} | ${mod.theme} | ${mod.level} | ${mod.lessons.length} | ${minutes} |`);
});
line();

function renderBlock(block) {
  switch (block.t) {
    case 'h':
      line(`#### ${block.text}`);
      line();
      break;
    case 'p':
      line(block.text);
      line();
      break;
    case 'list':
      block.items.forEach((item) => line(`- ${item}`));
      line();
      break;
    case 'steps':
      block.items.forEach((item, index) => line(`${index + 1}. ${item}`));
      line();
      break;
    case 'checklist':
      block.items.forEach((item) => line(`- [ ] ${item}`));
      line();
      break;
    case 'formula':
      line('```');
      line(block.text);
      line('```');
      line();
      break;
    case 'tip':
      line(`> 💡 **Dica:** ${block.text}`);
      line();
      break;
    case 'warn':
      line(`> ⚠️ **Atenção:** ${block.text}`);
      line();
      break;
    case 'table':
      line(`| ${block.head.join(' | ')} |`);
      line(`| ${block.head.map(() => '---').join(' | ')} |`);
      block.rows.forEach((row) => line(`| ${row.join(' | ')} |`));
      line();
      break;
    default:
      line(String(block.text || ''));
      line();
  }
}

modules.forEach((mod, modIndex) => {
  line('---');
  line();
  line(`## ${mod.icon} Módulo ${modIndex} - ${mod.title}`);
  line();
  line(`**Tema:** ${mod.theme} · **Nível:** ${mod.level}`);
  line();
  line(mod.summary);
  line();

  mod.lessons.forEach((lesson, lessonIndex) => {
    line(`### Aula ${modIndex}.${lessonIndex + 1} - ${lesson.title}`);
    line();
    line(`*Duração estimada: ${lesson.duration} min · Quiz: ${lesson.quiz.length} questões*`);
    line();
    line(`**Objetivo:** ${lesson.goal}`);
    line();
    lesson.blocks.forEach(renderBlock);

    line('#### Quiz de fixação');
    line();
    lesson.quiz.forEach((question, qIndex) => {
      line(`**${qIndex + 1}.** ${question.q}`);
      line();
      question.a.forEach((option, oIndex) => {
        line(`- ${String.fromCharCode(65 + oIndex)}) ${option}`);
      });
      line();
    });

    line('**Gabarito:** ' + lesson.quiz
      .map((question, qIndex) => `${qIndex + 1}-${String.fromCharCode(65 + question.r)}`)
      .join(' · '));
    line();
    lesson.quiz.forEach((question, qIndex) => {
      line(`> ${qIndex + 1}. ${question.e}`);
    });
    line();
  });
});

line('---');
line();
line('## Projeto final e certificação');
line();
line('O projeto final (Módulo 22) pede um diagnóstico financeiro completo da empresa e um plano de ação de 90 dias, ambos construídos com os dados do próprio ERP. Concluídas todas as aulas e atingida a média mínima nos quizzes, o certificado é liberado automaticamente no módulo **Curso** do sistema, com código de verificação e opção de impressão em PDF.');
line();
line('## Como usar este material');
line();
line('- **No sistema:** acesse o módulo **Curso** na barra lateral (seção Aprendizado) para estudar com progresso salvo, quiz corrigido automaticamente e certificado.');
line('- **Fora do sistema:** este arquivo é a versão impressa do mesmo currículo e é gerada automaticamente pelo comando `npm run course:doc` a partir de `src/course/modules/`.');
line();

const target = path.join(__dirname, '..', 'CURSO.md');
fs.writeFileSync(target, out.join('\n'), 'utf8');
console.log(`✅ CURSO.md gerado: ${s.totalModules} módulos, ${s.totalLessons} aulas, ${s.totalQuestions} questões (${out.length} linhas)`);
