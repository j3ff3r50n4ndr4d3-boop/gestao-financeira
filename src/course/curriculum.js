// ============================================================
// ACADEMIA ERP - Montagem do currículo
// "Gestão Financeira na Prática com ERP"
// Fonte única de verdade: src/course/modules/*.js
// Este arquivo alimenta a API /api/course e gera o documento CURSO.md
// (npm run course:doc)
// ============================================================

const modules = [
  ...require('./modules/01-base'),
  ...require('./modules/02-operacao'),
  ...require('./modules/03-financeiro'),
  ...require('./modules/04-analise-negocio'),
  ...require('./modules/05-tecnologia')
];

const course = {
  slug: 'gestao-financeira-na-pratica',
  title: 'Gestão Financeira na Prática com ERP',
  subtitle: 'Do caixa diário ao plano de negócios: domine todos os módulos do ERP Gestão Financeira',
  description: 'Curso completo em 23 módulos que cobre todos os temas do sistema: fundamentos financeiros, cadastros, precificação, estoque, vendas, compras, despesas, contas a receber e a pagar, fluxo de caixa, DRE, ponto de equilíbrio, indicadores, rotina de dashboard, plano de negócios SaaS, assinaturas, segurança, LGPD, deploy e integrações via API. Cada aula tem objetivo, conteúdo aplicado, exercício prático no sistema e quiz com correção automática.',
  audience: [
    'Donos de micro e pequenas empresas (MEI, ME, EPP) que querem organizar as finanças',
    'Gestores financeiros, analistas e assistentes administrativos',
    'Contadores e consultores que atendem PMEs',
    'Quem pretende revender o ERP como SaaS e precisa dominar o produto e o negócio'
  ],
  prerequisites: [
    'Noções básicas de uso de computador e navegador',
    'Acesso ao ERP (login demo: admin@erp.com / admin123)',
    'Não é necessário conhecimento prévio de contabilidade ou de programação'
  ],
  methodology: [
    'Aula curta (6 a 15 minutos) com objetivo de aprendizagem claro',
    'Conceito + fórmula + passo a passo dentro do próprio sistema',
    'Exercício prático com os dados demo já carregados no banco',
    'Quiz de fixação com correção automática e explicação por questão',
    'Progresso salvo por usuário e certificado ao final da trilha'
  ],
  certification: {
    minCompletion: 100, // % de aulas concluídas
    minAverage: 70, // média mínima nos quizzes
    // Carga horária total: soma das aulas (stats().totalHours) mais exercícios
    // práticos no sistema e projeto final de diagnóstico
    workloadHours: 18,
    name: 'Especialista em Gestão Financeira com ERP'
  },
  version: '1.0.0',
  modules
};

// ====== Helpers de consulta ======

const lessonIndex = new Map();
modules.forEach((mod) => {
  mod.lessons.forEach((lesson) => lessonIndex.set(lesson.id, { module: mod, lesson }));
});

function findLesson(lessonId) {
  const entry = lessonIndex.get(lessonId);
  return entry ? entry.lesson : null;
}

function findModule(moduleId) {
  return modules.find((m) => m.id === moduleId) || null;
}

function allLessons() {
  return modules.reduce((acc, mod) => acc.concat(mod.lessons), []);
}

function stats() {
  const lessons = allLessons();
  const minutes = lessons.reduce((sum, l) => sum + (l.duration || 0), 0);
  const questions = lessons.reduce((sum, l) => sum + (l.quiz ? l.quiz.length : 0), 0);
  return {
    totalModules: modules.length,
    totalLessons: lessons.length,
    totalMinutes: minutes,
    totalHours: Math.round((minutes / 60) * 10) / 10,
    totalQuestions: questions
  };
}

// Corrige o quiz de uma aula. answers = array de índices escolhidos.
function gradeQuiz(lessonId, answers) {
  const lesson = findLesson(lessonId);
  if (!lesson || !lesson.quiz) return null;

  const list = Array.isArray(answers) ? answers : [];
  const detail = lesson.quiz.map((question, index) => {
    const chosen = Number(list[index]);
    const correct = Number.isInteger(chosen) && chosen === question.r;
    return {
      index,
      correct,
      correctAnswer: question.r,
      chosen: Number.isInteger(chosen) ? chosen : null,
      explain: question.e
    };
  });

  const correctCount = detail.filter((d) => d.correct).length;
  const score = Math.round((correctCount / lesson.quiz.length) * 100);

  return {
    lessonId,
    total: lesson.quiz.length,
    correct: correctCount,
    score,
    passed: score >= course.certification.minAverage,
    detail
  };
}

module.exports = {
  course,
  modules,
  findLesson,
  findModule,
  allLessons,
  stats,
  gradeQuiz
};
