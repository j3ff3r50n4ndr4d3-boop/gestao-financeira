const express = require('express');
const { getDb, saveDatabase } = require('../../database');
const { course, modules, findLesson, stats, gradeQuiz } = require('../course/curriculum');

const router = express.Router();

function resultToObjects(result) {
  if (!result || result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// Lê todo o progresso do usuário logado indexado por lesson_id
function loadProgress(userId) {
  const db = getDb();
  const result = db.exec(
    'SELECT lesson_id, completed, quiz_score, quiz_attempts, updated_at FROM course_progress WHERE user_id = ?',
    [userId]
  );
  const rows = resultToObjects(result);
  const map = {};
  rows.forEach((row) => { map[row.lesson_id] = row; });
  return map;
}

function upsertProgress(userId, lessonId, fields) {
  const db = getDb();
  const existing = db.exec(
    'SELECT id, completed, quiz_score, quiz_attempts FROM course_progress WHERE user_id = ? AND lesson_id = ?',
    [userId, lessonId]
  );
  const rows = resultToObjects(existing);

  if (rows.length === 0) {
    db.run(
      `INSERT INTO course_progress (user_id, lesson_id, completed, quiz_score, quiz_attempts)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        lessonId,
        fields.completed ? 1 : 0,
        typeof fields.quizScore === 'number' ? fields.quizScore : 0,
        fields.quizScore !== undefined ? 1 : 0
      ]
    );
  } else {
    const current = rows[0];
    const completed = fields.completed === undefined ? current.completed : (fields.completed ? 1 : 0);
    // guarda sempre a melhor nota já obtida
    const quizScore = typeof fields.quizScore === 'number'
      ? Math.max(Number(current.quiz_score) || 0, fields.quizScore)
      : current.quiz_score;
    const attempts = fields.quizScore !== undefined
      ? (Number(current.quiz_attempts) || 0) + 1
      : current.quiz_attempts;

    db.run(
      'UPDATE course_progress SET completed = ?, quiz_score = ?, quiz_attempts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [completed, quizScore, attempts, current.id]
    );
  }
  saveDatabase();
}

function summarize(progress) {
  const s = stats();
  const entries = Object.keys(progress).map((id) => progress[id]);
  const completed = entries.filter((e) => Number(e.completed) === 1).length;
  const graded = entries.filter((e) => Number(e.quiz_attempts) > 0);
  const averageScore = graded.length
    ? Math.round(graded.reduce((sum, e) => sum + (Number(e.quiz_score) || 0), 0) / graded.length)
    : 0;

  const completionPct = s.totalLessons ? Math.round((completed / s.totalLessons) * 100) : 0;
  const eligible = completionPct >= course.certification.minCompletion && averageScore >= course.certification.minAverage;

  return {
    totalModules: s.totalModules,
    totalLessons: s.totalLessons,
    totalMinutes: s.totalMinutes,
    totalHours: s.totalHours,
    totalQuestions: s.totalQuestions,
    completedLessons: completed,
    gradedQuizzes: graded.length,
    averageScore,
    completionPct,
    certificateEligible: eligible
  };
}

// GET /api/course - ementa + progresso (conteúdo das aulas vem em /api/course/lesson/:id)
router.get('/', (req, res) => {
  try {
    const progress = loadProgress(req.user.id);

    const payload = {
      course: {
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        audience: course.audience,
        prerequisites: course.prerequisites,
        methodology: course.methodology,
        certification: course.certification,
        version: course.version
      },
      modules: modules.map((mod) => ({
        id: mod.id,
        title: mod.title,
        icon: mod.icon,
        theme: mod.theme,
        level: mod.level,
        summary: mod.summary,
        minutes: mod.lessons.reduce((sum, l) => sum + (l.duration || 0), 0),
        lessons: mod.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          duration: lesson.duration,
          goal: lesson.goal,
          questions: lesson.quiz ? lesson.quiz.length : 0,
          completed: progress[lesson.id] ? Number(progress[lesson.id].completed) === 1 : false,
          quizScore: progress[lesson.id] ? Number(progress[lesson.id].quiz_score) || 0 : 0,
          attempts: progress[lesson.id] ? Number(progress[lesson.id].quiz_attempts) || 0 : 0
        }))
      })),
      progress: summarize(progress)
    };

    res.json(payload);
  } catch (error) {
    console.error('Course list error:', error);
    res.status(500).json({ error: 'Erro ao carregar o curso' });
  }
});

// GET /api/course/lesson/:id - conteúdo completo de uma aula
router.get('/lesson/:id', (req, res) => {
  try {
    const lesson = findLesson(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Aula não encontrada' });

    const progress = loadProgress(req.user.id);
    const record = progress[lesson.id];

    res.json({
      id: lesson.id,
      title: lesson.title,
      duration: lesson.duration,
      goal: lesson.goal,
      blocks: lesson.blocks,
      quiz: (lesson.quiz || []).map((q) => ({
        q: q.q,
        options: q.a
        // resposta correta e explicação ficam no servidor e só voltam na correção
      })),
      progress: {
        completed: record ? Number(record.completed) === 1 : false,
        quizScore: record ? Number(record.quiz_score) || 0 : 0,
        attempts: record ? Number(record.quiz_attempts) || 0 : 0
      }
    });
  } catch (error) {
    console.error('Lesson error:', error);
    res.status(500).json({ error: 'Erro ao carregar a aula' });
  }
});

// POST /api/course/quiz/:id - corrige o quiz no servidor e salva a melhor nota
router.post('/quiz/:id', (req, res) => {
  try {
    const result = gradeQuiz(req.params.id, req.body.answers);
    if (!result) return res.status(404).json({ error: 'Quiz não encontrado' });

    upsertProgress(req.user.id, result.lessonId, { quizScore: result.score });

    const progress = loadProgress(req.user.id);
    res.json({ ...result, progress: summarize(progress) });
  } catch (error) {
    console.error('Quiz error:', error);
    res.status(500).json({ error: 'Erro ao corrigir o quiz' });
  }
});

// POST /api/course/progress - marca (ou desmarca) conclusão de aula
router.post('/progress', (req, res) => {
  try {
    const { lesson_id, completed } = req.body;
    if (!lesson_id) return res.status(400).json({ error: 'lesson_id é obrigatório' });
    if (!findLesson(lesson_id)) return res.status(404).json({ error: 'Aula não encontrada' });

    upsertProgress(req.user.id, lesson_id, { completed: completed !== false });

    const progress = loadProgress(req.user.id);
    res.json({ message: 'Progresso atualizado', lesson_id, progress: summarize(progress) });
  } catch (error) {
    console.error('Progress error:', error);
    res.status(500).json({ error: 'Erro ao atualizar o progresso' });
  }
});

// GET /api/course/certificate - elegibilidade e dados do certificado
router.get('/certificate', (req, res) => {
  try {
    const progress = loadProgress(req.user.id);
    const summary = summarize(progress);
    const s = stats();

    const code = `ERP-${course.slug.toUpperCase().replace(/-/g, '')}-${req.user.id}-${s.totalLessons}`;

    res.json({
      eligible: summary.certificateEligible,
      requirements: {
        completionPct: summary.completionPct,
        minCompletion: course.certification.minCompletion,
        averageScore: summary.averageScore,
        minAverage: course.certification.minAverage
      },
      certificate: {
        title: course.certification.name,
        course: course.title,
        holder: req.user.name || 'Aluno',
        company: req.user.company_name || null,
        workloadHours: course.certification.workloadHours,
        contentHours: s.totalHours,
        totalLessons: s.totalLessons,
        totalModules: s.totalModules,
        averageScore: summary.averageScore,
        issuedAt: new Date().toISOString().slice(0, 10),
        code
      }
    });
  } catch (error) {
    console.error('Certificate error:', error);
    res.status(500).json({ error: 'Erro ao verificar o certificado' });
  }
});

module.exports = router;
