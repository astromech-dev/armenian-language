/* storage.js — единственное место, где живёт localStorage.
   Захочется сервер — переписывается только этот файл. */
const Storage = (function () {
  const KEY = 'armenian_progress';

  function defaultProgress() {
    return {
      completedLessons: [],   // [1, 2, ...]
      wordProgress: {},       // { "Բարև": { level, nextReview } }
      lessonProgress: {},     // { lessonId: { index, total } } — позиция внутри незавершённого урока
      passedBlockTests: [],   // [blockId, ...] — сданные итоговые тесты разделов
      lastLesson: null,       // id последнего открытого урока
      streak: 0,
      lastActiveDate: null    // "YYYY-MM-DD"
    };
  }

  // --- даты как локальные YYYY-MM-DD ---
  function todayStr(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return todayStr(d);
  }
  function daysBetween(aStr, bStr) {
    const a = new Date(aStr + 'T00:00:00');
    const b = new Date(bStr + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultProgress();
      const data = JSON.parse(raw);
      return Object.assign(defaultProgress(), data);
    } catch (e) {
      console.warn('Не удалось прочитать прогресс, сброс к дефолту', e);
      return defaultProgress();
    }
  }

  function saveProgress(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Не удалось сохранить прогресс', e);
    }
  }

  // Отметить день активности и обновить streak.
  function touchStreak() {
    const p = loadProgress();
    const today = todayStr();
    if (p.lastActiveDate === today) return p;
    if (p.lastActiveDate && daysBetween(p.lastActiveDate, today) === 1) {
      p.streak = (p.streak || 0) + 1;
    } else {
      p.streak = 1;
    }
    p.lastActiveDate = today;
    saveProgress(p);
    return p;
  }

  // Урок пройден: отметить + засеять его слова в SRS (level 0, к повторению сегодня).
  function markLessonComplete(lessonId, items) {
    const p = loadProgress();
    if (!p.completedLessons.includes(lessonId)) {
      p.completedLessons.push(lessonId);
    }
    const today = todayStr();
    (items || []).forEach(function (it) {
      if (!p.wordProgress[it.hy]) {
        p.wordProgress[it.hy] = { level: 0, nextReview: today, ru: it.ru };
      } else if (it.ru) {
        p.wordProgress[it.hy].ru = it.ru;
      }
    });
    p.lastLesson = lessonId;
    saveProgress(p);
    return p;
  }

  // Обновить слово после ответа в повторении.
  function updateWord(hy, correct) {
    const p = loadProgress();
    const intervals = SRS.INTERVALS; // дни по уровням
    const w = p.wordProgress[hy] || { level: 0 };
    if (correct) {
      w.level = Math.min(w.level + 1, intervals.length - 1);
    } else {
      w.level = 0;
    }
    w.nextReview = addDays(todayStr(), intervals[w.level]);
    p.wordProgress[hy] = w;
    saveProgress(p);
    return w;
  }

  // Слова, которые пора повторить (nextReview <= сегодня).
  function getDueWords() {
    const p = loadProgress();
    const today = todayStr();
    const due = [];
    Object.keys(p.wordProgress).forEach(function (hy) {
      const w = p.wordProgress[hy];
      if (!w.nextReview || w.nextReview <= today) {
        due.push({ hy: hy, ru: w.ru || '', level: w.level || 0 });
      }
    });
    return due;
  }

  // --- итоговый тест по разделу ---
  // Отметить тест блока сданным. Повторное прохождение отметку не убирает.
  function markBlockTestPassed(blockId) {
    const p = loadProgress();
    if (p.passedBlockTests.indexOf(blockId) === -1) {
      p.passedBlockTests.push(blockId);
      saveProgress(p);
    }
    return p;
  }
  function isBlockTestPassed(blockId) {
    const p = loadProgress();
    return p.passedBlockTests.indexOf(blockId) !== -1;
  }

  // Поставить слова в очередь повторения «на сегодня» (level 0, nextReview = сегодня).
  // Используется, чтобы вернуть в SRS слова, на которых ошиблись в тесте.
  function addWordsToReview(items) {
    const p = loadProgress();
    const today = todayStr();
    (items || []).forEach(function (it) {
      if (!it || !it.hy) return;
      const w = p.wordProgress[it.hy] || {};
      w.level = 0;
      w.nextReview = today;
      if (it.ru) w.ru = it.ru;
      p.wordProgress[it.hy] = w;
    });
    saveProgress(p);
    return p;
  }

  function setLastLesson(lessonId) {
    const p = loadProgress();
    p.lastLesson = lessonId;
    saveProgress(p);
  }

  // --- позиция внутри незавершённого урока ---
  // Сохраняем после каждого шага: на каком шаге пользователь и сколько всего шагов.
  function saveLessonPosition(lessonId, index, total) {
    const p = loadProgress();
    p.lessonProgress[lessonId] = { index: index, total: total };
    saveProgress(p);
  }
  // Вернёт { index, total } или null, если сохранённой позиции нет.
  function getLessonPosition(lessonId) {
    const p = loadProgress();
    return p.lessonProgress[lessonId] || null;
  }
  // Убрать сохранённую позицию (урок завершён или начат заново).
  function clearLessonPosition(lessonId) {
    const p = loadProgress();
    if (p.lessonProgress[lessonId]) {
      delete p.lessonProgress[lessonId];
      saveProgress(p);
    }
  }

  return {
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    markLessonComplete: markLessonComplete,
    updateWord: updateWord,
    getDueWords: getDueWords,
    touchStreak: touchStreak,
    markBlockTestPassed: markBlockTestPassed,
    isBlockTestPassed: isBlockTestPassed,
    addWordsToReview: addWordsToReview,
    setLastLesson: setLastLesson,
    saveLessonPosition: saveLessonPosition,
    getLessonPosition: getLessonPosition,
    clearLessonPosition: clearLessonPosition,
    todayStr: todayStr,
    addDays: addDays
  };
})();
