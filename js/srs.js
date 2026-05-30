/* srs.js — интервальное повторение.
   level 0–5, интервалы в днях. Верно → level+1, неверно → level 0. */
const SRS = (function () {
  // интервалы по уровням (дни): 0→1, 1→2, 2→4, 3→7, 4→14, 5→30
  const INTERVALS = [1, 2, 4, 7, 14, 30];

  let state = null;

  // пул для дистракторов: все слова из прогресса, у которых есть перевод
  function buildPool() {
    const p = Storage.loadProgress();
    const pool = [];
    Object.keys(p.wordProgress).forEach(function (hy) {
      const w = p.wordProgress[hy];
      if (w.ru) pool.push({ hy: hy, ru: w.ru });
    });
    return pool;
  }

  function start(callbacks) {
    const due = Storage.getDueWords().filter(function (w) { return w.ru; });
    const pool = buildPool();
    state = {
      queue: Exercises.shuffle(due),
      pool: pool.length >= 4 ? pool : due.concat(pool),
      index: 0,
      correct: 0,
      total: 0,
      callbacks: callbacks
    };
    renderStep();
  }

  function renderStep() {
    const body = document.getElementById('review-body');
    const fill = document.getElementById('review-progress-fill');

    if (state.queue.length === 0) {
      body.innerHTML = '';
      body.appendChild(Exercises.el('div', { class: 'empty-state' }, [
        Exercises.el('div', { class: 'big', text: '✅' }),
        Exercises.el('div', { text: 'На сегодня всё повторено!' }),
        Exercises.el('div', { class: 'ex-footer' }, [
          (function () {
            const b = Exercises.el('button', { class: 'btn btn-primary btn-big', text: 'На главную' });
            b.addEventListener('click', function () { state.callbacks.onExit(); });
            return b;
          })()
        ])
      ]));
      fill.style.width = '100%';
      return;
    }

    fill.style.width = Math.round((state.index / state.queue.length) * 100) + '%';

    if (state.index >= state.queue.length) {
      finish();
      return;
    }

    const word = state.queue[state.index];
    const step = { type: 'choice', item: word, pool: state.pool };
    Exercises.render(step, body, function (correct) {
      Storage.updateWord(word.hy, correct);
      state.total++;
      if (correct) state.correct++;
      state.index++;
      window.scrollTo(0, 0);
      renderStep();
    });
  }

  function finish() {
    Storage.touchStreak();
    const body = document.getElementById('review-body');
    document.getElementById('review-progress-fill').style.width = '100%';
    body.innerHTML = '';
    body.appendChild(Exercises.el('div', { class: 'empty-state' }, [
      Exercises.el('div', { class: 'big', text: '🎯' }),
      Exercises.el('div', { text: 'Повторение завершено: ' + state.correct + ' / ' + state.total }),
      Exercises.el('div', { class: 'ex-footer' }, [
        (function () {
          const b = Exercises.el('button', { class: 'btn btn-primary btn-big', text: 'На главную' });
          b.addEventListener('click', function () { state.callbacks.onExit(); });
          return b;
        })()
      ])
    ]));
  }

  function exit() {
    if (state && state.callbacks && state.callbacks.onExit) state.callbacks.onExit();
    state = null;
  }

  return { INTERVALS: INTERVALS, start: start, exit: exit };
})();
