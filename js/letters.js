/* letters.js — тренажёр алфавита: буква→звук и звук→буква.
   Данные приходят из alphabet.json. */
const Letters = (function () {
  const QUESTIONS = 10;
  let letters = [];
  let state = null;

  function init(data) { letters = (data && data.letters) || []; }

  function el() { return Exercises.el.apply(null, arguments); }

  // меню режимов
  function menu() {
    const body = document.getElementById('letters-body');
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'ex-prompt', text: 'Тренажёр армянского алфавита (' + letters.length + ' букв)' }));
    const m = el('div', { class: 'letters-menu' });

    const b1 = el('button', { class: 'btn btn-primary btn-big', text: 'Буква → звук' });
    b1.addEventListener('click', function () { startQuiz('letterToSound'); });
    const b2 = el('button', { class: 'btn btn-primary btn-big', text: 'Звук → буква' });
    b2.addEventListener('click', function () { startQuiz('soundToLetter'); });
    const b3 = el('button', { class: 'btn btn-secondary btn-big', text: 'Посмотреть все буквы' });
    b3.addEventListener('click', browse);

    m.appendChild(b1);
    m.appendChild(b2);
    m.appendChild(b3);
    body.appendChild(m);
  }

  function browse() {
    const body = document.getElementById('letters-body');
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'ex-prompt', text: 'Все буквы' }));
    const list = el('div', { class: 'intro-list' });
    letters.forEach(function (L) {
      list.appendChild(el('div', { class: 'intro-row' }, [
        el('span', { class: 'hy', text: L.char + ' ' + L.lower }),
        el('span', { class: 'ru', text: L.sound + ' · ' + L.name })
      ]));
    });
    body.appendChild(list);
    const f = el('div', { class: 'ex-footer' }, [
      (function () {
        const b = el('button', { class: 'btn btn-primary btn-big', text: '← Назад' });
        b.addEventListener('click', menu);
        return b;
      })()
    ]);
    body.appendChild(f);
  }

  function startQuiz(mode) {
    state = {
      mode: mode,
      queue: Exercises.shuffle(letters).slice(0, Math.min(QUESTIONS, letters.length)),
      index: 0,
      correct: 0
    };
    renderQuestion();
  }

  function renderQuestion() {
    const body = document.getElementById('letters-body');
    if (state.index >= state.queue.length) { finish(); return; }

    body.innerHTML = '';
    const L = state.queue[state.index];
    const letterToSound = state.mode === 'letterToSound';

    body.appendChild(el('div', { class: 'ex-prompt', text: (state.index + 1) + ' / ' + state.queue.length }));

    if (letterToSound) {
      body.appendChild(el('div', { class: 'letter-card-big hy', text: L.char + ' ' + L.lower }));
      body.appendChild(el('div', { class: 'letter-sub', text: 'Какой звук?' }));
    } else {
      body.appendChild(el('div', { class: 'letter-card-big', text: L.sound }));
      body.appendChild(el('div', { class: 'letter-sub', text: 'Какая буква?' }));
    }

    // варианты
    const seen = {};
    const optionField = letterToSound ? 'sound' : 'char';
    seen[L[optionField]] = true;
    const opts = [L];
    Exercises.shuffle(letters).forEach(function (o) {
      if (opts.length >= 4) return;
      if (seen[o[optionField]]) return;
      seen[o[optionField]] = true;
      opts.push(o);
    });

    // кнопка «Далее» закреплена снизу, активна после ответа
    const nextBtn = el('button', { class: 'btn btn-primary btn-big', text: 'Далее' });
    nextBtn.disabled = true;
    nextBtn.addEventListener('click', function () { state.index++; renderQuestion(); });

    const optWrap = el('div', { class: 'ex-options' });
    const buttons = [];
    Exercises.shuffle(opts).forEach(function (o) {
      const b = el('button', {
        class: 'option' + (letterToSound ? '' : ' hy'),
        text: letterToSound ? o.sound : (o.char + ' ' + o.lower)
      });
      b.addEventListener('click', function () { answer(o, b, buttons, opts, L, optionField, nextBtn); });
      buttons.push(b);
      optWrap.appendChild(b);
    });
    body.appendChild(optWrap);
    body.appendChild(el('div', { class: 'ex-footer' }, [nextBtn]));
  }

  function answer(chosen, btn, buttons, opts, L, field, nextBtn) {
    const correct = chosen[field] === L[field];
    buttons.forEach(function (b) { b.disabled = true; });
    btn.classList.add(correct ? 'correct' : 'wrong');
    if (!correct) {
      buttons.forEach(function (b, i) {
        if (opts[i] && opts[i][field] === L[field]) b.classList.add('correct');
      });
    }
    if (correct) state.correct++;
    nextBtn.disabled = false;
  }

  function finish() {
    const body = document.getElementById('letters-body');
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'empty-state' }, [
      el('div', { class: 'big', text: '🔤' }),
      el('div', { text: 'Результат: ' + state.correct + ' / ' + state.queue.length })
    ]));
    const f = el('div', { class: 'ex-footer' }, [
      (function () {
        const b = el('button', { class: 'btn btn-primary btn-big', text: 'Ещё раз' });
        b.addEventListener('click', menu);
        return b;
      })()
    ]);
    body.appendChild(f);
  }

  return { init: init, menu: menu };
})();
