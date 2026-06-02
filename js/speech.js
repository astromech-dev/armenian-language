/* speech.js — озвучка слов через браузерный синтезатор речи (Web Speech API).
   Без файлов и сети: голос берётся из системы пользователя.
   На устройствах без армянского голоса available() вернёт false —
   тогда в упражнении сразу показываем написание слова. */
const Speech = (function () {
  const synth = window.speechSynthesis || null;
  let armenianVoice = null;
  let triedPick = false;

  // Голоса в браузере подгружаются асинхронно. Пытаемся выбрать армянский.
  function pickVoice() {
    if (!synth) return null;
    const voices = synth.getVoices() || [];
    // Точное совпадение по армянскому языку (hy, hy-AM).
    let v = voices.find(function (vo) {
      return /^hy(\b|-)/i.test(vo.lang || '');
    });
    // Запасной вариант — по названию голоса.
    if (!v) {
      v = voices.find(function (vo) {
        return /armenian|հայ/i.test(vo.name || '');
      });
    }
    armenianVoice = v || null;
    triedPick = true;
    return armenianVoice;
  }

  if (synth) {
    pickVoice();
    // Список голосов может прийти позже — переспрашиваем по событию.
    if (typeof synth.onvoiceschanged !== 'undefined') {
      synth.addEventListener('voiceschanged', pickVoice);
    }
  }

  // Поддерживается ли в принципе синтез речи.
  function supported() {
    return !!synth;
  }

  // Есть ли армянский голос (если нет — звук всё равно попробуем, но качество не гарантируется).
  function available() {
    if (!synth) return false;
    if (!triedPick) pickVoice();
    return !!armenianVoice;
  }

  // Произнести армянский текст.
  function speak(text) {
    if (!synth || !text) return;
    try {
      synth.cancel(); // прервать предыдущее, если ещё говорит
      const u = new SpeechSynthesisUtterance(text);
      if (!armenianVoice && !triedPick) pickVoice();
      if (armenianVoice) u.voice = armenianVoice;
      u.lang = (armenianVoice && armenianVoice.lang) || 'hy-AM';
      u.rate = 0.9; // чуть медленнее для обучения
      synth.speak(u);
    } catch (e) {
      console.warn('Не удалось озвучить слово', e);
    }
  }

  return {
    supported: supported,
    available: available,
    speak: speak
  };
})();
