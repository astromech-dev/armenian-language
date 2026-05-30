/* exercises.js — генерация и проверка упражнений из пар «hy — ru».
   Каждый тип = функция render(step, container, onDone).
   onDone(correct:boolean) вызывается, когда шаг завершён. */
const Exercises = (function () {

  // ---------- утилиты ----------
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // n случайных элементов пула, исключая item (по hy), с уникальным значением поля.
  function distractors(pool, item, field, n) {
    const seen = {};
    seen[item[field]] = true;
    const out = [];
    shuffle(pool).forEach(function (p) {
      if (out.length >= n) return;
      if (p.hy === item.hy) return;
      if (seen[p[field]]) return;
      seen[p[field]] = true;
      out.push(p);
    });
    return out;
  }

  // нормализация для сравнения ввода
  function norm(s) {
    return (s || '')
      .replace(/[՞՜՛՝՚«»…]/g, '') // армянские интонационные знаки и кавычки
      .replace(/[.,!?]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function clear(container) { container.innerHTML = ''; }

  // ---------- общий подвал с кнопкой ----------
  function footer(container, label, onClick, disabled) {
    const btn = el('button', { class: 'btn btn-primary btn-big', text: label });
    if (disabled) btn.disabled = true;
    btn.addEventListener('click', onClick);
    const wrap = el('div', { class: 'ex-footer' }, [btn]);
    container.appendChild(wrap);
    return btn;
  }

  // ---------- intro: пролистать все слова ----------
  function intro(step, container, onDone) {
    clear(container);
    container.appendChild(el('div', { class: 'ex-prompt', text: 'Запомни слова' }));
    const list = el('div', { class: 'intro-list' });
    step.items.forEach(function (it) {
      list.appendChild(el('div', { class: 'intro-row' }, [
        el('span', { class: 'hy', text: it.hy }),
        el('span', { class: 'ru', text: it.ru })
      ]));
    });
    container.appendChild(list);
    footer(container, 'Начать →', function () { onDone(true); });
  }

  // ---------- choice: выбор перевода из 4 ----------
  function choice(step, container, onDone) {
    clear(container);
    const item = step.item;
    const pool = step.pool;
    const hyToRu = Math.random() < 0.5;
    const qField = hyToRu ? 'hy' : 'ru';
    const aField = hyToRu ? 'ru' : 'hy';

    const opts = shuffle([item].concat(distractors(pool, item, aField, 3)));

    container.appendChild(el('div', { class: 'ex-prompt', text: 'Выбери перевод' }));
    container.appendChild(el('div', { class: 'ex-question' + (hyToRu ? '' : '') }, [
      el('span', { class: hyToRu ? 'hy hy-big' : '', text: item[qField] })
    ]));

    const optWrap = el('div', { class: 'ex-options' });
    const buttons = [];
    opts.forEach(function (o) {
      const b = el('button', { class: 'option' + (aField === 'hy' ? ' hy' : ''), text: o[aField] });
      b.addEventListener('click', function () { answer(o, b); });
      buttons.push(b);
      optWrap.appendChild(b);
    });
    container.appendChild(optWrap);

    // кнопка «Далее» видна сразу, но неактивна, пока не выбран ответ
    let answered = false;
    let isCorrect = false;
    const nextBtn = footer(container, 'Далее', function () {
      if (answered) onDone(isCorrect);
    }, true);

    function answer(chosen, btn) {
      if (answered) return;
      answered = true;
      isCorrect = chosen.hy === item.hy;
      buttons.forEach(function (b) { b.disabled = true; });
      btn.classList.add(isCorrect ? 'correct' : 'wrong');
      if (!isCorrect) {
        // подсветить правильный
        buttons.forEach(function (b, i) {
          if (opts[i].hy === item.hy) b.classList.add('correct');
        });
      }
      nextBtn.disabled = false;
    }
  }

  // ---------- match: соединить пары ----------
  function match(step, container, onDone) {
    clear(container);
    container.appendChild(el('div', { class: 'ex-prompt', text: 'Соедини пары' }));

    const items = step.items;
    const left = shuffle(items);
    const right = shuffle(items);
    let selected = null; // {item, node}
    let matched = 0;
    let mistakes = 0;

    const grid = el('div', { class: 'match-grid' });
    const colL = el('div', { class: 'match-col' });
    const colR = el('div', { class: 'match-col' });

    function makeNode(it, field) {
      const n = el('div', { class: 'match-item' + (field === 'hy' ? ' hy' : ''), text: it[field] });
      n.dataset.hy = it.hy;
      n.dataset.side = field;
      n.addEventListener('click', function () { pick(it, n); });
      return n;
    }

    left.forEach(function (it) { colL.appendChild(makeNode(it, 'hy')); });
    right.forEach(function (it) { colR.appendChild(makeNode(it, 'ru')); });
    grid.appendChild(colL);
    grid.appendChild(colR);
    container.appendChild(grid);

    // кнопка «Далее» закреплена снизу, активируется после соединения всех пар
    const nextBtn = footer(container, 'Далее', function () { onDone(mistakes === 0); }, true);

    function pick(it, node) {
      if (node.classList.contains('matched')) return;
      if (!selected) {
        selected = { item: it, node: node };
        node.classList.add('selected');
        return;
      }
      if (selected.node === node) { // снять выбор
        node.classList.remove('selected');
        selected = null;
        return;
      }
      // нужно по одному с каждой стороны
      if (selected.node.dataset.side === node.dataset.side) {
        selected.node.classList.remove('selected');
        selected = { item: it, node: node };
        node.classList.add('selected');
        return;
      }
      // проверка пары
      if (selected.item.hy === it.hy) {
        selected.node.classList.remove('selected');
        selected.node.classList.add('matched');
        node.classList.add('matched');
        selected = null;
        matched++;
        if (matched === items.length) {
          nextBtn.disabled = false;
        }
      } else {
        mistakes++;
        const a = selected.node, b = node;
        a.classList.remove('selected');
        a.classList.add('flash-bad'); b.classList.add('flash-bad');
        selected = null;
        setTimeout(function () {
          a.classList.remove('flash-bad'); b.classList.remove('flash-bad');
        }, 450);
      }
    }
  }

  // ---------- ввод (с подсказкой и без) ----------
  function buildHint(word) {
    // показываем первую букву и примерно каждую вторую, остальное «•»
    const chars = Array.from(word);
    return chars.map(function (ch, i) {
      if (ch === ' ') return ' ';
      if (i === 0 || i % 2 === 0) return ch;
      return '•';
    }).join('');
  }

  function inputExercise(step, container, onDone, withHint) {
    clear(container);
    const item = step.item;
    container.appendChild(el('div', { class: 'ex-prompt', text: withHint ? 'Впиши на армянском (есть подсказка)' : 'Впиши на армянском' }));
    container.appendChild(el('div', { class: 'ex-question', text: item.ru }));

    if (withHint) {
      container.appendChild(el('div', { class: 'hint-letters hy', text: buildHint(item.hy) }));
    }

    const input = el('input', { class: 'ex-input hy', type: 'text', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: '...' });
    container.appendChild(input);
    setTimeout(function () { input.focus(); }, 50);

    const fb = el('div', { class: 'ex-feedback' });
    const msg = el('div', { class: 'feedback-msg' });
    fb.appendChild(msg);
    const btn = el('button', { class: 'btn btn-primary btn-big', text: 'Проверить' });
    fb.appendChild(btn);
    container.appendChild(fb);

    let checked = false;
    function check() {
      if (checked) { onDone(window.__lastInputCorrect); return; }
      const correct = norm(input.value) === norm(item.hy);
      window.__lastInputCorrect = correct;
      input.disabled = true;
      input.classList.add(correct ? 'correct' : 'wrong');
      msg.classList.add(correct ? 'good' : 'bad');
      msg.innerHTML = correct
        ? 'Верно!'
        : 'Правильно: <span class="feedback-answer hy">' + item.hy + '</span>';
      btn.textContent = 'Далее';
      checked = true;
    }
    btn.addEventListener('click', check);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
  }

  function inputHint(step, container, onDone) { inputExercise(step, container, onDone, true); }
  function inputFree(step, container, onDone) { inputExercise(step, container, onDone, false); }

  // ---------- assemble: собрать фразу ----------
  function assemble(step, container, onDone) {
    clear(container);
    const item = step.item;
    const correctWords = item.hy.split(/\s+/);

    container.appendChild(el('div', { class: 'ex-prompt', text: 'Собери фразу' }));
    container.appendChild(el('div', { class: 'ex-question', text: item.ru }));

    const target = el('div', { class: 'assemble-target' });
    const bank = el('div', { class: 'assemble-bank' });
    container.appendChild(target);
    container.appendChild(bank);

    let order = shuffle(correctWords.map(function (w, i) { return { w: w, i: i }; }));
    if (correctWords.length > 1 && order.map(function (o) { return o.i; }).join() === correctWords.map(function (_, i) { return i; }).join()) {
      order = order.reverse();
    }

    const placed = []; // tokens in target

    order.forEach(function (o) {
      const t = el('button', { class: 'token hy', text: o.w });
      t.addEventListener('click', function () {
        if (t.classList.contains('used')) return;
        t.classList.add('used');
        const chip = el('button', { class: 'token hy', text: o.w });
        chip.addEventListener('click', function () {
          chip.remove();
          t.classList.remove('used');
          const idx = placed.indexOf(chip);
          if (idx >= 0) placed.splice(idx, 1);
        });
        target.appendChild(chip);
        placed.push(chip);
      });
      bank.appendChild(t);
    });

    const fb = el('div', { class: 'ex-feedback' });
    const msg = el('div', { class: 'feedback-msg' });
    const btn = el('button', { class: 'btn btn-primary btn-big', text: 'Проверить' });
    fb.appendChild(msg);
    fb.appendChild(btn);
    container.appendChild(fb);

    let checked = false;
    let lastCorrect = false;
    btn.addEventListener('click', function () {
      if (checked) { onDone(lastCorrect); return; }
      const built = placed.map(function (c) { return c.textContent; }).join(' ');
      lastCorrect = norm(built) === norm(item.hy);
      target.classList.add(lastCorrect ? 'correct' : 'wrong');
      msg.classList.add(lastCorrect ? 'good' : 'bad');
      msg.innerHTML = lastCorrect
        ? 'Верно!'
        : 'Правильно: <span class="feedback-answer hy">' + item.hy + '</span>';
      btn.textContent = 'Далее';
      checked = true;
      // запретить дальнейшее изменение
      bank.querySelectorAll('.token').forEach(function (t) { t.style.pointerEvents = 'none'; });
      target.querySelectorAll('.token').forEach(function (t) { t.style.pointerEvents = 'none'; });
    });
  }

  // ---------- диспетчер ----------
  function render(step, container, onDone) {
    switch (step.type) {
      case 'intro': return intro(step, container, onDone);
      case 'choice': return choice(step, container, onDone);
      case 'match': return match(step, container, onDone);
      case 'input-hint': return inputHint(step, container, onDone);
      case 'input': return inputFree(step, container, onDone);
      case 'assemble': return assemble(step, container, onDone);
      default:
        container.appendChild(el('div', { text: 'Неизвестный тип: ' + step.type }));
        footer(container, 'Далее', function () { onDone(true); });
    }
  }

  return { render: render, shuffle: shuffle, el: el, norm: norm };
})();
