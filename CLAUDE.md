# CLAUDE.md — приложение для изучения армянского

Подсказка для ИИ-помощника (и владельца проекта). Описывает, как всё устроено,
как запускать и публиковать. Перед работой прочитай этот файл целиком.

## О проекте

Сайт для изучения **восточноармянского** (ереванская норма): слова, фразы,
повторение, тренажёр букв. Для себя и небольшого круга людей. Каждый учится на
своём устройстве, прогресс хранится в браузере (localStorage).

- Репозиторий: https://github.com/astromech-dev/armenian-language
- Живой сайт: https://astromech-dev.github.io/armenian-language/
- Владелец общается по-русски, **нетехнический пользователь** — объясняй простыми
  словами, по шагам, без жаргона.

## Технологии и принципы

- Чистый **HTML/CSS/JS** (vanilla, без фреймворков, **без сборки** — никаких npm/build).
- **Одна страница** (`index.html`); экраны переключаются через JS (показ/скрытие `.screen`).
- **Прогресс — в localStorage**, без сервера и регистрации.
- **Данные — в JSON-файлах** отдельно от кода.

Три архитектурных правила (не нарушать):
1. **Данные отдельно от кода.** Уроки/слова — в `data/*.json`. Движок читает их и
   сам генерирует упражнения. Добавить урок = дописать JSON, код не трогать.
2. **Сохранение изолировано.** Вся работа с localStorage — только в `js/storage.js`.
   Захочется сервер — меняется один файл.
3. **Упражнения генерируются из списка слов**, а не пишутся вручную.

## Структура файлов

```
armenian-app/
├── index.html              # один файл, все экраны внутри
├── CLAUDE.md               # этот файл
├── css/style.css           # стили, mobile-first
├── js/
│   ├── app.js              # навигация, загрузка данных, главный экран
│   ├── storage.js          # ВЕСЬ localStorage (load/save, SRS-данные, streak)
│   ├── lesson.js           # прохождение урока: строит шаги, считает результат
│   ├── exercises.js        # генерация и проверка типов упражнений
│   ├── srs.js              # интервальное повторение + экран повторения
│   └── letters.js          # тренажёр алфавита
└── data/
    ├── lessons.json        # список блоков и уроков (id, title, file)
    ├── alphabet.json       # буквы: char, lower, sound, name
    └── lessons/lesson-1..19.json
```

Порядок подключения скриптов в `index.html` важен (зависимости):
`storage → exercises → srs → letters → lesson → app`.

## Экраны (внутри index.html)

`screen-home`, `screen-lesson`, `screen-result`, `screen-review`, `screen-letters`.
Виден один за раз — `app.js` ставит класс `active`. Точка входа — IIFE в `app.js`,
который грузит `lessons.json` + `alphabet.json` через `fetch`, потом рисует главную.

## Формат данных

`lessons.json`: `blocks[]` (id, title, lessons:[номера]) и `lessons[]` (id, title, file).
Урок `lesson-N.json`: `{ id, title, dialect, words:[{hy,ru}], phrases:[{hy,ru}] }`.
`alphabet.json`: `letters:[{ char, lower, sound, name }]`.

## Типы упражнений (exercises.js)

Все строятся из пар «hy ↔ ru». Диспетчер — `Exercises.render(step, container, onDone)`,
где `onDone(correct)` вызывается по завершении шага.

- `intro` — пролистать все слова с переводом.
- `choice` — выбрать перевод из 4 (направление hy→ru / ru→hy случайно). Кнопка
  «Далее» **закреплена снизу (sticky)**, неактивна до выбора ответа.
- `match` — соединить 4–5 пар; «Далее» активируется после всех пар.
- `assemble` — собрать фразу из перемешанных слов (только для phrases из 2+ слов).
- `input-hint` / `input` — ввод армянского (с подсказкой и без). **РЕАЛИЗОВАНЫ в коде,
  но НЕ используются в уроках** — владелец попросил убрать ввод армянскими буквами
  (см. `Lesson.buildSteps` в `lesson.js`). Не возвращай без явной просьбы.

Порядок шагов в уроке (`lesson.js` → `buildSteps`): intro → choice (все) →
match (группами по 5) → assemble (фразы). Подсказки снимаются постепенно.

## Логика повторения (srs.js / storage.js)

У слова есть `level` (0–5) и `nextReview` (дата). Верно → level+1, неверно → level 0.
Интервалы по уровням (дни): `SRS.INTERVALS = [1,2,4,7,14,30]`.
«Повторить сегодня» = слова с `nextReview <= сегодня` (`Storage.getDueWords`).
При завершении урока его слова засеваются в SRS с level 0 (`markLessonComplete`).

Объект в localStorage (ключ `armenian_progress`):
`{ completedLessons, wordProgress:{hy:{level,nextReview,ru}}, lastLesson, streak, lastActiveDate }`.

## Как запустить локально

Нужен HTTP-сервер (НЕ открывать `index.html` как файл — `fetch` не работает с `file://`).
```
cd "/Users/permeetoysteq/Assets Owner.One/armenian-app"
python3 -m http.server 8123
# открыть http://localhost:8123
```
В Claude Code также есть preview-конфиг `armenian-app` в `.claude/launch.json`.

## Как опубликовать изменения (deploy)

Хостинг — GitHub Pages, ветка `main`, папка `/ (root)`. Публикация = `git push`,
дальше Pages пересобирает сайт сам (~1 минута). Токен сохранён в Keychain, пароль
не спрашивается.
```
cd "/Users/permeetoysteq/Assets Owner.One/armenian-app"
git add .
git commit -m "что изменили"
git push
```
ВАЖНО: правки на компьютере НЕ попадают на сайт сами — только после `push`.
Напоминай об этом владельцу после изменений.

## Как добавить урок

1. Создать `data/lessons/lesson-N.json` по формату выше.
2. В `data/lessons.json` добавить запись в `lessons[]` (id, title, file) и номер N
   в нужный блок `blocks[].lessons`.
3. Код не трогать. Проверить локально, затем `push`.

## ⚠️ Важно про контент

Уроки **1–4, 6, 19** — по ТЗ владельца. Уроки **5, 7–18** заполнены ИИ как черновик.
**Весь армянский текст требует проверки носителем** — особенно расстановка
вопросительного знака (՞) и официальные/юридические термины (урок 19, гражданство).
Не считай текущий контент эталонным.
