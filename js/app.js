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
    const hasPos = !!Storage.getLessonPosition(contId);
    const isFresh = p.completedLessons.indexOf(contId) === -1 && done === 0 && !hasPos;
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
        // «В процессе» — есть сохранённая позиция и урок ещё не пройден.
        // Завершённость в приоритете: пройденный урок остаётся с галочкой,
        // даже если его проходят заново (перепрохождение не снимает отметку).
        const pos = Storage.getLessonPosition(id);
        const inProgress = !isDone && pos && pos.index > 0 && pos.total && pos.index < pos.total;
        const pct = inProgress ? Math.round((pos.index / pos.total) * 100) : 0;

        const ttl = Exercises.el('span', { class: 'ttl' }, [
          Exercises.el('span', { class: 'ttl-main', text: meta.title })
        ]);
        if (inProgress) {
          ttl.appendChild(Exercises.el('span', { class: 'sub', text: 'В процессе · ' + pct + '%' }));
        }

        const cls = 'lesson-card' + (isDone ? ' done' : (inProgress ? ' in-progress' : ''));
        const card = Exercises.el('button', { class: cls }, [
          Exercises.el('span', { class: 'mark', text: isDone ? '✓' : String(id) }),
          ttl
        ]);
        card.addEventListener('click', function () { openLesson(id); });
        section.appendChild(card);
      });

      // «Тест по разделу» — в конце блока. Открыт, только когда все уроки пройдены.
      const blockIds = block.lessons.filter(function (id) { return lessonMeta(id); });
      if (blockIds.length) {
        const allDone = blockIds.every(function (id) { return p.completedLessons.indexOf(id) !== -1; });
        const passed = Storage.isBlockTestPassed(block.id);

        const ttl = Exercises.el('span', { class: 'ttl' }, [
          Exercises.el('span', { class: 'ttl-main', text: 'Тест по разделу' })
        ]);
        if (!allDone) {
          ttl.appendChild(Exercises.el('span', { class: 'sub',
            text: 'Пройдите все уроки раздела, чтобы открыть тест' }));
        } else if (passed) {
          ttl.appendChild(Exercises.el('span', { class: 'sub', text: 'Тест пройден' }));
        }

        const cls = 'lesson-card test' + (!allDone ? ' locked' : (passed ? ' done' : ''));
        const mark = !allDone ? '🔒' : (passed ? '✓' : '🎯');
        const testCard = Exercises.el('button', { class: cls }, [
          Exercises.el('span', { class: 'mark', text: mark }),
          ttl
        ]);
        if (allDone) {
          testCard.addEventListener('click', function () { openBlockTest(block); });
        } else {
          testCard.disabled = true;
        }
        section.appendChild(testCard);
      }

      listEl.appendChild(section);
    });
  }

  // ---------- запуск экранов ----------
  function openLesson(id) {
    const pos = Storage.getLessonPosition(id);
    // Есть незавершённый прогресс внутри урока — спрашиваем: продолжить или заново.
    // Для непройденных уроков без прогресса — сразу с начала, без вопроса.
    if (pos && pos.index > 0 && pos.total && pos.index < pos.total) {
      askResume(id, pos,
        function () { startLesson(id, pos); },
        function () { Storage.clearLessonPosition(id); startLesson(id, null); });
    } else {
      startLesson(id, null);
    }
  }

  // resume = { index, total } сохранённой позиции, либо null для старта с начала.
  function startLesson(id, resume) {
    getLesson(id).then(function (lesson) {
      showScreen('screen-lesson');
      Lesson.start(lesson, {
        onComplete: showResult,
        onExit: goHome
      }, resume);
    }).catch(showError);
  }

  // Диалог «Продолжить / Начать заново» для начатого урока.
  function askResume(id, pos, onContinue, onRestart) {
    const meta = lessonMeta(id);
    const pct = pos.total ? Math.round((pos.index / pos.total) * 100) : 0;

    const overlay = Exercises.el('div', { class: 'modal-overlay' });
    const card = Exercises.el('div', { class: 'modal-card' });
    card.appendChild(Exercises.el('h2', { class: 'modal-title',
      text: 'Урок ' + id + ' · ' + (meta ? meta.title : '') }));
    card.appendChild(Exercises.el('p', { class: 'modal-text',
      text: 'Вы остановились на ' + pct + '%. Продолжить с этого места или начать заново?' }));

    const contBtn = Exercises.el('button', { class: 'btn btn-primary btn-big', text: 'Продолжить' });
    const restartBtn = Exercises.el('button', { class: 'btn btn-secondary', text: 'Начать заново' });
    contBtn.addEventListener('click', function () { overlay.remove(); onContinue(); });
    restartBtn.addEventListener('click', function () { overlay.remove(); onRestart(); });
    card.appendChild(contBtn);
    card.appendChild(restartBtn);
    overlay.appendChild(card);
    document.getElementById('app').appendChild(overlay);
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

  // Итоговый тест блока: собираем слова и фразы всех его уроков и запускаем тест.
  function openBlockTest(block) {
    const ids = block.lessons.filter(function (id) { return lessonMeta(id); });
    Promise.all(ids.map(getLesson)).then(function (lessons) {
      const pool = [];
      lessons.forEach(function (ls) {
        (ls.words || []).forEach(function (w) { pool.push(w); });
        (ls.phrases || []).forEach(function (w) { pool.push(w); });
      });
      showScreen('screen-blocktest');
      BlockTest.start(block, pool, { onExit: goHome });
    }).catch(showError);
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
  document.getElementById('blocktest-exit').addEventListener('click', function () { BlockTest.exit(); });
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
