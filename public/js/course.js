// ============================================================
// ACADEMIA ERP - frontend do módulo Curso
// Consome /api/course (conteúdo, quiz, progresso e certificado)
// ============================================================

let courseData = null;
let courseCurrentLesson = null;
let courseOpenModule = null;

function escCourse(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCourseDate(date) {
  if (!date) return '-';
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
}

async function loadCourse() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Curso</h1>
        <p class="page-subtitle">Academia ERP - Gestão Financeira na Prática</p>
      </div>
    </div>
    <div class="card"><div class="loading"><div class="spinner"></div>Carregando o curso...</div></div>
  `;

  try {
    courseData = await api('/api/course');
    courseCurrentLesson = null;
    renderCourseHome();
  } catch (err) {
    container.innerHTML = `<div class="card"><p>Erro ao carregar o curso: ${escCourse(err.message)}</p></div>`;
  }
}

function renderCourseHome() {
  const container = document.getElementById('pageContent');
  const c = courseData.course;
  const p = courseData.progress;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🎓 ${escCourse(c.title)}</h1>
        <p class="page-subtitle">${escCourse(c.subtitle)}</p>
      </div>
      <button class="btn btn-secondary" onclick="showCourseInfo()">Sobre o curso</button>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card info">
        <div class="kpi-header"><div class="kpi-label">Aulas concluídas</div></div>
        <div class="kpi-value">${p.completedLessons}/${p.totalLessons}</div>
        <div class="kpi-change">${p.completionPct}% da trilha</div>
      </div>
      <div class="kpi-card success">
        <div class="kpi-header"><div class="kpi-label">Média nos quizzes</div></div>
        <div class="kpi-value">${p.averageScore}%</div>
        <div class="kpi-change">${p.gradedQuizzes} quizzes corrigidos</div>
      </div>
      <div class="kpi-card warning">
        <div class="kpi-header"><div class="kpi-label">Módulos</div></div>
        <div class="kpi-value">${p.totalModules}</div>
        <div class="kpi-change">${p.totalHours}h de conteúdo · ${p.totalQuestions} questões</div>
      </div>
      <div class="kpi-card ${p.certificateEligible ? 'success' : 'danger'}">
        <div class="kpi-header"><div class="kpi-label">Certificado</div></div>
        <div class="kpi-value" style="font-size:20px">${p.certificateEligible ? 'Liberado' : 'Em andamento'}</div>
        <div class="kpi-change">100% das aulas e média ≥ ${c.certification.minAverage}%</div>
      </div>
    </div>

    <div class="course-progress-card card">
      <div class="course-progress-label">
        <span>Progresso da trilha</span>
        <strong>${p.completionPct}%</strong>
      </div>
      <div class="course-progress-track">
        <div class="course-progress-fill" style="width:${p.completionPct}%"></div>
      </div>
    </div>

    ${p.certificateEligible ? '<div id="courseCertificate"></div>' : ''}

    <div class="course-modules">
      ${courseData.modules.map(renderCourseModule).join('')}
    </div>
  `;

  if (p.certificateEligible) loadCourseCertificate();
  if (courseOpenModule) toggleCourseModule(courseOpenModule, true);
}

function renderCourseModule(mod) {
  const done = mod.lessons.filter((l) => l.completed).length;
  const total = mod.lessons.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return `
    <div class="course-module card">
      <div class="course-module-head" onclick="toggleCourseModule('${mod.id}')">
        <div class="course-module-icon">${escCourse(mod.icon)}</div>
        <div class="course-module-info">
          <div class="course-module-title">
            ${escCourse(mod.title)}
            <span class="badge badge-info">${escCourse(mod.level)}</span>
            ${done === total ? '<span class="badge badge-success">Concluído</span>' : ''}
          </div>
          <div class="course-module-summary">${escCourse(mod.summary)}</div>
          <div class="course-module-meta">${total} aulas · ${mod.minutes} min · ${escCourse(mod.theme)} · ${done}/${total} concluídas</div>
          <div class="course-progress-track small"><div class="course-progress-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="course-module-toggle">▾</div>
      </div>
      <div class="course-module-body" id="module-body-${mod.id}" style="display:none">
        ${mod.lessons.map((lesson) => `
          <div class="course-lesson-row ${lesson.completed ? 'done' : ''}">
            <div class="course-lesson-check">${lesson.completed ? '✔' : '○'}</div>
            <div class="course-lesson-info">
              <div class="course-lesson-title">${escCourse(lesson.title)}</div>
              <div class="course-lesson-goal">${escCourse(lesson.goal)}</div>
              <div class="course-lesson-meta">
                ${lesson.duration} min · ${lesson.questions} questões
                ${lesson.attempts ? ` · melhor nota ${lesson.quizScore}%` : ''}
              </div>
            </div>
            <button class="btn btn-primary" onclick="openCourseLesson('${lesson.id}')">
              ${lesson.completed ? 'Revisar' : 'Abrir aula'}
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function toggleCourseModule(moduleId, keepOpen) {
  const body = document.getElementById('module-body-' + moduleId);
  if (!body) return;
  const willShow = keepOpen === true || body.style.display === 'none';
  body.style.display = willShow ? 'block' : 'none';
  courseOpenModule = willShow ? moduleId : null;
}

function showCourseInfo() {
  const c = courseData.course;
  openModal('Sobre o curso', `
    <p style="margin-bottom:14px">${escCourse(c.description)}</p>
    <h4 style="margin:14px 0 8px">Para quem é</h4>
    <ul style="padding-left:18px;margin-bottom:14px">${c.audience.map((a) => `<li>${escCourse(a)}</li>`).join('')}</ul>
    <h4 style="margin:14px 0 8px">Pré-requisitos</h4>
    <ul style="padding-left:18px;margin-bottom:14px">${c.prerequisites.map((a) => `<li>${escCourse(a)}</li>`).join('')}</ul>
    <h4 style="margin:14px 0 8px">Metodologia</h4>
    <ul style="padding-left:18px;margin-bottom:14px">${c.methodology.map((a) => `<li>${escCourse(a)}</li>`).join('')}</ul>
    <h4 style="margin:14px 0 8px">Certificação</h4>
    <p>${escCourse(c.certification.name)} - ${c.certification.workloadHours} horas, mediante ${c.certification.minCompletion}% das aulas concluídas e média mínima de ${c.certification.minAverage}% nos quizzes.</p>
  `);
}

// ====== AULA ======
async function openCourseLesson(lessonId) {
  const container = document.getElementById('pageContent');
  container.innerHTML = `<div class="card"><div class="loading"><div class="spinner"></div>Carregando aula...</div></div>`;
  try {
    courseCurrentLesson = await api('/api/course/lesson/' + lessonId);
    renderCourseLesson();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    container.innerHTML = `<div class="card"><p>Erro: ${escCourse(err.message)}</p></div>`;
  }
}

function renderCourseLesson() {
  const container = document.getElementById('pageContent');
  const lesson = courseCurrentLesson;
  const mod = courseData.modules.find((m) => m.lessons.some((l) => l.id === lesson.id));

  container.innerHTML = `
    <div class="course-lesson-view">
      <button class="btn btn-secondary" onclick="loadCourse()">← Voltar para a trilha</button>

      <div class="card course-lesson-card">
        <div class="course-lesson-head">
          <div class="badge badge-info">${escCourse(mod ? mod.title : 'Aula')}</div>
          <h1 class="page-title" style="margin:10px 0 6px">${escCourse(lesson.title)}</h1>
          <p class="course-lesson-objective"><strong>Objetivo:</strong> ${escCourse(lesson.goal)}</p>
          <div class="course-lesson-meta">${lesson.duration} min · ${lesson.quiz.length} questões no quiz
            ${lesson.progress.attempts ? ` · sua melhor nota: ${lesson.progress.quizScore}%` : ''}</div>
        </div>

        <div class="course-blocks">
          ${lesson.blocks.map(renderCourseBlock).join('')}
        </div>
      </div>

      <div class="card course-quiz-card" id="courseQuizCard">
        <h3 class="card-title">📝 Quiz de fixação</h3>
        <p class="course-quiz-hint">Responda sem consultar o texto. Cada resposta errada vem com explicação.</p>
        ${lesson.quiz.map((q, qi) => `
          <div class="quiz-question" id="quiz-q-${qi}">
            <div class="quiz-question-title">${qi + 1}. ${escCourse(q.q)}</div>
            ${q.options.map((opt, oi) => `
              <label class="quiz-option" for="q${qi}-o${oi}">
                <input type="radio" name="quiz-${qi}" id="q${qi}-o${oi}" value="${oi}">
                <span>${escCourse(opt)}</span>
              </label>
            `).join('')}
            <div class="quiz-feedback" id="quiz-feedback-${qi}"></div>
          </div>
        `).join('')}
        <div class="course-lesson-actions">
          <button class="btn btn-primary" id="quizSubmitBtn" onclick="submitCourseQuiz()">Corrigir quiz</button>
          <button class="btn btn-success" onclick="completeCourseLesson(${lesson.progress.completed})">
            ${lesson.progress.completed ? '✔ Aula concluída' : 'Marcar como concluída'}
          </button>
        </div>
        <div id="quizResult"></div>
      </div>
    </div>
  `;
}

function renderCourseBlock(block) {
  switch (block.t) {
    case 'h':
      return `<h3 class="course-block-h">${escCourse(block.text)}</h3>`;
    case 'p':
      return `<p class="course-block-p">${escCourse(block.text)}</p>`;
    case 'list':
      return `<ul class="course-block-list">${block.items.map((i) => `<li>${escCourse(i)}</li>`).join('')}</ul>`;
    case 'steps':
      return `<ol class="course-block-steps">${block.items.map((i) => `<li>${escCourse(i)}</li>`).join('')}</ol>`;
    case 'checklist':
      return `<ul class="course-block-checklist">${block.items.map((i) => `<li>☐ ${escCourse(i)}</li>`).join('')}</ul>`;
    case 'formula':
      return `<div class="course-block-formula">${escCourse(block.text)}</div>`;
    case 'tip':
      return `<div class="course-block-tip"><strong>💡 Dica:</strong> ${escCourse(block.text)}</div>`;
    case 'warn':
      return `<div class="course-block-warn"><strong>⚠️ Atenção:</strong> ${escCourse(block.text)}</div>`;
    case 'table':
      return `
        <div class="table-container course-block-table">
          <table>
            <thead><tr>${block.head.map((h) => `<th>${escCourse(h)}</th>`).join('')}</tr></thead>
            <tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escCourse(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>`;
    default:
      return `<p class="course-block-p">${escCourse(block.text || '')}</p>`;
  }
}

async function submitCourseQuiz() {
  const lesson = courseCurrentLesson;
  const answers = lesson.quiz.map((q, qi) => {
    const checked = document.querySelector(`input[name="quiz-${qi}"]:checked`);
    return checked ? Number(checked.value) : -1;
  });

  if (answers.some((a) => a === -1)) {
    alert('Responda todas as questões antes de corrigir.');
    return;
  }

  const btn = document.getElementById('quizSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Corrigindo...';

  try {
    const result = await api('/api/course/quiz/' + lesson.id, { method: 'POST', body: { answers } });

    result.detail.forEach((item) => {
      const box = document.getElementById('quiz-feedback-' + item.index);
      box.className = 'quiz-feedback ' + (item.correct ? 'correct' : 'wrong');
      box.innerHTML = `
        <strong>${item.correct ? '✅ Correto.' : '❌ Incorreto. Resposta certa: ' + String.fromCharCode(65 + item.correctAnswer) + '.'}</strong>
        <div>${escCourse(item.explain)}</div>
      `;
      document.getElementById('quiz-q-' + item.index).classList.add(item.correct ? 'is-correct' : 'is-wrong');
    });

    document.getElementById('quizResult').innerHTML = `
      <div class="quiz-result ${result.passed ? 'pass' : 'fail'}">
        <strong>${result.correct} de ${result.total} corretas - nota ${result.score}%</strong>
        <div>${result.passed
          ? 'Quiz aprovado. A melhor nota fica salva no seu histórico.'
          : 'Nota abaixo de ' + courseData.course.certification.minAverage + '%. Reveja a aula e tente novamente: o sistema guarda a melhor nota.'}</div>
      </div>
    `;

    lesson.progress.attempts += 1;
    lesson.progress.quizScore = Math.max(lesson.progress.quizScore, result.score);
  } catch (err) {
    alert('Erro ao corrigir: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Refazer quiz';
  }
}

async function completeCourseLesson(currentlyCompleted) {
  try {
    await api('/api/course/progress', {
      method: 'POST',
      body: { lesson_id: courseCurrentLesson.id, completed: !currentlyCompleted }
    });
    courseData = await api('/api/course');
    courseCurrentLesson.progress.completed = !currentlyCompleted;
    renderCourseLesson();
  } catch (err) {
    alert('Erro ao salvar progresso: ' + err.message);
  }
}

async function loadCourseCertificate() {
  const box = document.getElementById('courseCertificate');
  if (!box) return;
  try {
    const data = await api('/api/course/certificate');
    if (!data.eligible) return;
    const cert = data.certificate;
    box.innerHTML = `
      <div class="course-certificate" id="printableCertificate">
        <div class="course-certificate-inner">
          <div class="course-certificate-badge">🏆</div>
          <h2>Certificado de Conclusão</h2>
          <h3>${escCourse(cert.title)}</h3>
          <p class="course-certificate-holder">Conferido a <strong>${escCourse(cert.holder)}</strong>${cert.company ? ' - ' + escCourse(cert.company) : ''}</p>
          <p>Por concluir o curso <strong>${escCourse(cert.course)}</strong> com
            ${cert.totalLessons} aulas em ${cert.totalModules} módulos,
            carga horária de ${cert.workloadHours} horas (${String(cert.contentHours).replace('.', ',')} horas de aulas mais exercícios práticos e projeto final) e média de ${cert.averageScore}% nos quizzes.</p>
          <div class="course-certificate-footer">
            <div>Emitido em ${formatCourseDate(cert.issuedAt)}</div>
            <div>Código de verificação: <strong>${escCourse(cert.code)}</strong></div>
          </div>
        </div>
        <button class="btn btn-primary no-print" onclick="window.print()">🖨️ Imprimir / salvar PDF</button>
      </div>
    `;
  } catch (err) {
    console.error('Erro ao carregar o certificado:', err);
    box.innerHTML = `<div class="card"><p>Não foi possível carregar o certificado: ${escCourse(err.message)}</p></div>`;
  }
}
