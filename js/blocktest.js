/* blocktest.js — итоговый тест по разделу (блоку).
   Отдельный режим, не урок: «финальное испытание» из слов и фраз всех уроков блока.
   - выборка ~15–20 вопросов (если материала меньше — берётся сколько есть);
   - типы упражнений только choice и match (движок exercises.js);
   - 3 жизни: каждый проваленный шаг убирает сердце, на 3-й ошибке тест прерывается;
   - дошёл до конца с живыми сердцами — тест сдан.
   Слова, на которых ошиблись, отправляются в SRS-повторение. */
const BlockTest = (function () {
  const MAX_LIVES = 3;
  const TARGET = 18; // целимся в 15–20 вопросов
  let state = null;

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // Из общего пула пар (words + phrases всех уроков блока) собираем шаги.
  // pool — массив { hy, ru } (могут быть дубликаты между уроками).
  function buildSteps(pool) {
    // убираем дубли и пустые пары
    const seen = {};
    const items = [];
    (pool || []).forEach(function (it) {
      if (!it || !it.hy || !it.ru) return;
      if (seen[it.hy]) return;
      seen[it.hy] = true;
      items.push({ hy: it.hy, ru: it.ru });
    });

    const selected = Exercises.shuffle(items).slice(0, Math.min(TARGET, items.length));

    // часть слов уходит в match (группами по 5), остальное — в choice
    let matchCount = 0;
    if (selected.length >= 10) matchCount = 10;
    else if (selected.length >= 6) matchCount = 5;

    const matchPart = selected.slice(0, matchCount);
    const choicePart = selected.slice(matchCount);

    const steps = [];
    chunk(matchPart, 5).forEach(function (group) {
      if (group.length >= 3) {
        steps.push({ type: 'match', items: group });
      } else {
        // слишком маленькую группу для match — вернём в choice
        group.forEach(function (it) { choicePart.push(it); });
      }
    });
    choicePart.forEach(function (it) {
      // pool = весь материал блока, чтобы дистракторы были разнообразными
      steps.push({ type: 'choice', item: it, pool: items });
    });

    return { steps: Exercises.shuffle(steps), items: items };
  }

  function start(block, pool, callbacks) {
    const built = buildSteps(pool);
    state = {
      block: block,
      pool: pool,        // исходный пул — для перепрохождения
      callbacks: callbacks,
      steps: built.steps,
      index: 0,
      correct: 0,
      total: built.steps.length,
      lives: MAX_LIVES,
      wrong: []          // пары, на которых ошиблись → в SRS
    };
    renderLives();
    renderStep();
  }

  function renderLives() {
    const box = document.getElementById('blocktest-lives');
    if (!box) return;
    box.innerHTML = '';
    for (let i = 0; i < MAX_LIVES; i++) {
      const alive = i < state.lives;
      box.appendChild(Exercises.el('span', {
        class: 'life' + (alive ? '' : ' lost'),
        text: alive ? '♥' : '♡'
      }));
    }
  }

  function progressPct() {
    return state.total ? Math.round((state.index / state.total) * 100) : 0;
  }

  // Собрать пары проваленного шага, чтобы вернуть их в повторение.
  function collectWrong(step) {
    if (step.type === 'choice') state.wrong.push(step.item);
    else if (step.type === 'match') (step.items || []).forEach(function (it) { state.wrong.push(it); });
  }

  function renderStep() {
    const body = document.getElementById('blocktest-body');
    document.getElementById('blocktest-progress-fill').style.width = progressPct() + '%';

    if (state.index >= state.steps.length) {
      pass();
      return;
    }

    const step = state.steps[state.index];
    Exercises.render(step, body, function (correct) {
      if (correct) {
        state.correct++;
      } else {
        state.lives--;
        collectWrong(step);
        renderLives();
      }
      // жизни кончились — тест прерывается немедленно
      if (state.lives <= 0) {
        fail();
        return;
      }
      state.index++;
      window.scrollTo(0, 0);
      renderStep();
    });
  }

  // Тест сдан: дошли до конца, не потеряв все жизни.
  function pass() {
    document.getElementById('blocktest-progress-fill').style.width = '100%';
    Storage.markBlockTestPassed(state.block.id);
    Storage.addWordsToReview(state.wrong);
    Storage.touchStreak();

    showEndScreen({
      emoji: '🏆',
      title: 'Тест сдан!',
      score: 'Верно ' + state.correct + ' из ' + state.total,
      note: 'Раздел «' + state.block.title + '» пройден.',
      primaryLabel: 'На главную',
      onPrimary: function () { state.callbacks.onExit(); },
      secondaryLabel: 'Пройти заново',
      onSecondary: restart
    });
  }

  // Тест не сдан: закончились жизни.
  function fail() {
    Storage.addWordsToReview(state.wrong);
    showEndScreen({
      emoji: '💔',
      title: 'Тест не сдан',
      score: 'Закончились жизни',
      note: 'Слова из теста добавлены в повторение. Попробуйте ещё раз!',
      primaryLabel: 'Начать заново',
      onPrimary: restart,
      secondaryLabel: 'На главную',
      onSecondary: function () { state.callbacks.onExit(); }
    });
  }

  function showEndScreen(opts) {
    const body = document.getElementById('blocktest-body');
    body.innerHTML = '';
    const card = Exercises.el('div', { class: 'result-card blocktest-end' }, [
      Exercises.el('div', { class: 'result-emoji', text: opts.emoji }),
      Exercises.el('h2', { text: opts.title }),
      Exercises.el('p', { class: 'result-score', text: opts.score }),
      Exercises.el('p', { class: 'result-note', text: opts.note })
    ]);
    const primary = Exercises.el('button', { class: 'btn btn-primary btn-big', text: opts.primaryLabel });
    primary.addEventListener('click', opts.onPrimary);
    card.appendChild(primary);
    if (opts.secondaryLabel) {
      const secondary = Exercises.el('button', { class: 'btn btn-secondary', text: opts.secondaryLabel });
      secondary.addEventListener('click', opts.onSecondary);
      card.appendChild(secondary);
    }
    body.appendChild(card);
  }

  function restart() {
    // перепроходим тот же блок: новая выборка и перемешивание
    const block = state.block;
    const pool = state.pool;
    const callbacks = state.callbacks;
    start(block, pool, callbacks);
  }

  function exit() {
    if (state && state.callbacks && state.callbacks.onExit) state.callbacks.onExit();
    state = null;
  }

  return { start: start, exit: exit };
})();
