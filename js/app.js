/* app.js — навигация между экранами, загрузка данных, главный экран. */
(function () {
  let lessonsIndex = null; // содержимое lessons.json
  const lessonCache = {};  // id -> данные урока

  // ---------- навигация ----------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.toggle('active', s.id === id);
    });
    window.scrollTo(0, 0);
  }

  // ---------- загрузка данных ----------
  function fetchJSON(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' для ' + path);
      return r.json();
    });
  }

  function getLesson(id) {
    if (lessonCache[id]) return Promise.resolve(lessonCache[id]);
    const meta = lessonsIndex.lessons.find(function (l) { return l.id === id; });
    if (!meta) return Promise.reject(new Error('Нет урока ' + id));
    return fetchJSON('data/lessons/' + meta.file).then(function (data) {
      lessonCache[id] = data;
      return data;
    });
  }

  // ---------- главная ----------
  function lessonMeta(id) {
    return lessonsIndex.lessons.find(function (l) { return l.id === id; });
  }

  function nextLessonId(progress) {
    const all = lessonsIndex.lessons.map(function (l) { return l.id; });
    const next = all.find(function (id) { return progress.completedLessons.indexOf(id) === -1; });
    return next || progress.lastLesson || all[0];
  }

  function renderHome() {
    const p = Storage.loadProgress();

    // streak
    const streakEl = document.getElementById('home-streak');
    streakEl.textContent = p.streak > 0 ? '🔥 ' + p.streak : '';

    // прогресс по урокам
    const total = lessonsIndex.lessons.length;
    const done = p.completedLessons.length;
    document.getElementById('home-progress-fill').style.width =
      (total ? Math.round((done / total) * 100) : 0) + '%';
    document.getElementById('home-progress-label').textContent =
      'Пройдено уроков: ' + done + ' из ' + total;

    // продолжить
    const contId = nextLessonId(p);
    const contMeta = lessonMeta(contId);
    const contBtn = document.getElementById('btn-continue');
    const isFresh = p.completedLessons.indexOf(contId) === -1 && done === 0;
    contBtn.textContent = (isFresh ? 'Начать: ' : 'Продолжить: ') +
      'урок ' + contId + ' · ' + (contMeta ? contMeta.title : '');
    contBtn.onclick = function () { openLesson(contId); };

    // повторить
    const due = Storage.getDueWords().length;
    const revBtn = document.getElementById('btn-review');
    revBtn.textContent = 'Повторить: ' + due;
    revBtn.onclick = function () { openReview(); };

    // буквы
    document.getElementById('btn-letters').onclick = openLetters;

    // список блоков/уроков
    const listEl = document.getElementById('home-lessons');
    listEl.innerHTML = '';
    lessonsIndex.blocks.forEach(function (block) {
      const section = Exercises.el('div', { class: 'block' });
      section.appendChild(Exercises.el('div', { class: 'block-title', text: block.title }));
      block.lessons.forEach(function (id) {
        const meta = lessonMeta(id);
        if (!meta) return;
        const isDone = p.completedLessons.indexOf(id) !== -1;
        const card = Exercises.el('button', { class: 'lesson-card' + (isDone ? ' done' : '') }, [
          Exercises.el('span', { class: 'mark', text: isDone ? '✓' : String(id) }),
          Exercises.el('span', { class: 'ttl' }, [
            document.createTextNode(meta.title)
          ])
        ]);
        card.addEventListener('click', function () { openLesson(id); });
        section.appendChild(card);
      });
      listEl.appendChild(section);
    });
  }

  // ---------- запуск экранов ----------
  function openLesson(id) {
    getLesson(id).then(function (lesson) {
      showScreen('screen-lesson');
      Lesson.start(lesson, {
        onComplete: showResult,
        onExit: goHome
      });
    }).catch(showError);
  }

  function showResult(result) {
    showScreen('screen-result');
    const meta = lessonMeta(result.lessonId);
    document.getElementById('result-title').textContent =
      'Урок пройден: ' + (meta ? meta.title : '');
    document.getElementById('result-score').textContent =
      'Верно ' + result.correct + ' из ' + result.total;
    document.getElementById('result-note').textContent =
      result.newWords + ' слов добавлено в повторение.';
    document.getElementById('result-back').onclick = goHome;
  }

  function openReview() {
    showScreen('screen-review');
    SRS.start({ onExit: goHome });
  }

  function openLetters() {
    showScreen('screen-letters');
    Letters.menu();
  }

  function goHome() {
    renderHome();
    showScreen('screen-home');
  }

  function showError(err) {
    console.error(err);
    const body = document.getElementById('home-lessons');
    if (body) {
      body.innerHTML = '<div class="empty-state"><div class="big">⚠️</div>' +
        'Не удалось загрузить данные.<br>Запусти сайт через локальный сервер ' +
        '(например, <code>python3 -m http.server</code>), а не открытием файла.<br><br>' +
        '<small>' + (err && err.message ? err.message : err) + '</small></div>';
    }
  }

  // ---------- кнопки выхода ----------
  document.getElementById('lesson-exit').addEventListener('click', function () { Lesson.exit(); });
  document.getElementById('review-exit').addEventListener('click', function () { SRS.exit(); });
  document.getElementById('letters-exit').addEventListener('click', goHome);

  // ---------- старт ----------
  Promise.all([
    fetchJSON('data/lessons.json'),
    fetchJSON('data/alphabet.json')
  ]).then(function (res) {
    lessonsIndex = res[0];
    Letters.init(res[1]);
    goHome();
  }).catch(function (err) {
    showScreen('screen-home');
    showError(err);
  });
})();
