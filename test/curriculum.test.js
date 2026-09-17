// Testes unitários do currículo e da correção de quizzes
const test = require('node:test');
const assert = require('node:assert');

const { course, modules, findLesson, allLessons, stats, gradeQuiz } = require('../src/course/curriculum');

test('currículo tem a estrutura esperada de módulos e aulas', () => {
  const s = stats();
  assert.strictEqual(s.totalModules, modules.length);
  assert.ok(s.totalModules >= 20, `esperava ao menos 20 módulos, veio ${s.totalModules}`);
  assert.ok(s.totalLessons >= 50, `esperava ao menos 50 aulas, veio ${s.totalLessons}`);
  assert.strictEqual(s.totalLessons, allLessons().length);
  assert.ok(s.totalQuestions === s.totalLessons * 3, `cada aula deve ter 3 questões (total ${s.totalQuestions} para ${s.totalLessons} aulas)`);
});

test('toda aula tem id único, objetivo, conteúdo, duração e quiz válido', () => {
  const ids = new Set();
  allLessons().forEach((lesson) => {
    assert.ok(lesson.id && !ids.has(lesson.id), `id de aula duplicado ou vazio: ${lesson.id}`);
    ids.add(lesson.id);
    assert.ok(lesson.title, `aula ${lesson.id} sem título`);
    assert.ok(lesson.goal, `aula ${lesson.id} sem objetivo`);
    assert.ok(Number.isFinite(lesson.duration) && lesson.duration > 0, `aula ${lesson.id} sem duração`);
    assert.ok(Array.isArray(lesson.blocks) && lesson.blocks.length >= 4, `aula ${lesson.id} com poucos blocos de conteúdo`);

    lesson.blocks.forEach((block, i) => {
      assert.ok(block.t, `bloco ${i} da aula ${lesson.id} sem tipo`);
      if (block.t === 'table') {
        assert.ok(Array.isArray(block.head) && Array.isArray(block.rows), `tabela inválida na aula ${lesson.id}`);
        block.rows.forEach((row) => assert.strictEqual(row.length, block.head.length, `linha fora do padrão na tabela da aula ${lesson.id}`));
      } else if (Array.isArray(block.items)) {
        assert.ok(block.items.length > 0, `lista vazia na aula ${lesson.id}`);
      } else {
        assert.ok(typeof block.text === 'string' && block.text.length > 0, `bloco ${i} da aula ${lesson.id} sem texto`);
      }
    });

    assert.strictEqual(lesson.quiz.length, 3, `aula ${lesson.id} deve ter 3 questões`);
    lesson.quiz.forEach((question, i) => {
      assert.ok(question.q, `questão ${i} da aula ${lesson.id} sem enunciado`);
      assert.strictEqual(question.a.length, 4, `questão ${i} da aula ${lesson.id} deve ter 4 alternativas`);
      assert.ok(Number.isInteger(question.r) && question.r >= 0 && question.r < 4, `resposta fora do intervalo na questão ${i} da aula ${lesson.id}`);
      assert.ok(question.e, `questão ${i} da aula ${lesson.id} sem explicação`);
    });
  });
});

test('todo módulo tem metadados completos', () => {
  modules.forEach((mod) => {
    ['id', 'title', 'icon', 'theme', 'level', 'summary'].forEach((field) => {
      assert.ok(mod[field], `módulo ${mod.id} sem ${field}`);
    });
    assert.ok(mod.lessons.length >= 2, `módulo ${mod.id} com menos de 2 aulas`);
  });
});

test('certificação exige conclusão total e média mínima', () => {
  assert.strictEqual(course.certification.minCompletion, 100);
  assert.strictEqual(course.certification.minAverage, 70);
  assert.ok(course.certification.workloadHours > 0);
  assert.ok(
    course.certification.workloadHours >= stats().totalHours,
    `carga horária do certificado (${course.certification.workloadHours}h) não pode ser menor que o conteúdo (${stats().totalHours}h)`
  );
});

test('gradeQuiz corrige acertos, erros e respostas ausentes', () => {
  const lesson = allLessons()[0];
  const correctAnswers = lesson.quiz.map((q) => q.r);
  const wrongAnswers = lesson.quiz.map((q) => (q.r + 1) % 4);

  const perfect = gradeQuiz(lesson.id, correctAnswers);
  assert.strictEqual(perfect.score, 100);
  assert.strictEqual(perfect.correct, lesson.quiz.length);
  assert.strictEqual(perfect.passed, true);
  assert.ok(perfect.detail.every((d) => d.correct));

  const zero = gradeQuiz(lesson.id, wrongAnswers);
  assert.strictEqual(zero.score, 0);
  assert.strictEqual(zero.passed, false);
  assert.ok(zero.detail.every((d) => !d.correct));

  const partial = gradeQuiz(lesson.id, [correctAnswers[0], (correctAnswers[1] + 1) % 4, (correctAnswers[2] + 1) % 4]);
  assert.strictEqual(partial.correct, 1);
  assert.strictEqual(partial.score, 33);
  assert.strictEqual(partial.passed, false);

  const missing = gradeQuiz(lesson.id, [correctAnswers[0]]);
  assert.strictEqual(missing.correct, 1);
  assert.strictEqual(missing.detail[1].chosen, null);

  assert.strictEqual(gradeQuiz('aula-inexistente', [0]), null);
});

test('gradeQuiz explica cada questão e devolve o gabarito', () => {
  const lesson = findLesson('m1a2');
  assert.ok(lesson, 'aula m1a2 deveria existir');
  const result = gradeQuiz('m1a2', [0, 0, 0]);
  result.detail.forEach((item, index) => {
    assert.strictEqual(item.correctAnswer, lesson.quiz[index].r);
    assert.strictEqual(item.explain, lesson.quiz[index].e);
  });
});

test('os temas do sistema estão cobertos pela trilha', () => {
  const titles = [
    ...modules.map((m) => `${m.title} ${m.summary} ${m.theme}`),
    ...allLessons().map((l) => `${l.title} ${l.goal}`)
  ].join(' ').toLowerCase();
  [
    'cliente', 'fornecedor', 'produto', 'estoque', 'compra', 'venda', 'despesa',
    'receber', 'pagar', 'fluxo de caixa', 'dre', 'indicador', 'dashboard',
    'precifica', 'assinatura', 'saas', 'segurança', 'lgpd', 'deploy', 'api',
    'ponto de equilíbrio', 'plano de negócio'
  ].forEach((theme) => {
    assert.ok(titles.includes(theme), `tema não encontrado na ementa: ${theme}`);
  });
});
