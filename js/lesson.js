/* lesson.js — прохождение урока: строит последовательность шагов,
   двигает прогресс, считает результат. */
const Lesson = (function () {
  let state = null;

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // Из урока (words + phrases) строим шаги по принципу «снимаем подсказки постепенно».
  function buildSteps(lesson) {
    const words = lesson.words || [];
    const phrases = lesson.phrases || [];
    const all = words.concat(phrases);
    const steps = [];

    // 1. Знакомство
    steps.push({ type: 'intro', items: all });

    // 2. choice — узнавание (по каждому пункту)
    Exercises.shuffle(all).forEach(function (item) {
      steps.push({ type: 'choice', item: item, pool: all });
    });

    // 3. match — сопоставление, группами по 4–5
    chunk(Exercises.shuffle(all), 5).forEach(function (group) {
      if (group.length >= 2) {
        // добиваем дистракторами, если совсем мало — но тут просто группа
        steps.push({ type: 'match', items: group.length > 5 ? group.slice(0, 5) : group });
      }
    });

    // 4. assemble — сборка фраз (если есть фразы из 2+ слов)
    phrases.forEach(function (item) {
      if (item.hy.split(/\s+/).length > 1) {
        steps.push({ type: 'assemble', item: item });
      }
    });

    return steps;
  }

  function start(lesson, callbacks) {
    const steps = buildSteps(lesson);
    state = {
      lesson: lesson,
      steps: steps,
      index: 0,
      correct: 0,
      scored: 0,
      callbacks: callbacks
    };
    Storage.setLastLesson(lesson.id);
    renderStep();
  }

  function progressPct() {
    return Math.round((state.index / state.steps.length) * 100);
  }

  function renderStep() {
    const body = document.getElementById('lesson-body');
    document.getElementById('lesson-progress-fill').style.width = progressPct() + '%';

    if (state.index >= state.steps.length) {
      finish();
      return;
    }
    const step = state.steps[state.index];
    Exercises.render(step, body, function (correct) {
      if (step.type !== 'intro') {
        state.scored++;
        if (correct) state.correct++;
      }
      state.index++;
      window.scrollTo(0, 0);
      renderStep();
    });
  }

  function finish() {
    document.getElementById('lesson-progress-fill').style.width = '100%';
    const items = (state.lesson.words || []).concat(state.lesson.phrases || []);
    Storage.markLessonComplete(state.lesson.id, items);
    Storage.touchStreak();
    state.callbacks.onComplete({
      lessonId: state.lesson.id,
      correct: state.correct,
      total: state.scored,
      newWords: items.length
    });
  }

  function exit() {
    if (state && state.callbacks && state.callbacks.onExit) state.callbacks.onExit();
    state = null;
  }

  return { start: start, exit: exit };
})();
