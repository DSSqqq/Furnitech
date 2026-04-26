# Архитектура Furnitech

## Стек

| Слой | Технология |
|------|------------|
| API | Python 3.12+, **Django 5.x–6.x** (`Django>=5.0,<7`), **Django REST framework** |
| Аутентификация | `djangorestframework-simplejwt` (Bearer JWT) |
| Админ/клиент (SPA) | **React 19**, **TypeScript ~5.7**, **Vite ~6** |
| БД (dev) | SQLite (`backend/db.sqlite3`) |
| CORS | `django-cors-headers` — `CORS_ALLOWED_ORIGINS` в `backend/.env` |

## Зависимости

- **Backend:** `requirements.txt` — Django, DRF, `djangorestframework-simplejwt`, `cors`, `python-dotenv`, **Pillow** (загрузка текстур).
- **Frontend:** `package.json` — React 19, Vite, TypeScript, ESLint.

## Каталоги

```
Furnitech/
  backend/          # проект `config/`, приложение `materials/`, `manage.py`
  frontend/         # Vite SPA, `src/` — см. [PROGRESS](PROGRESS.md)
  docs/             # PLAN, PROGRESS, ARCHITECTURE
  scripts/          # furnitech_status.py
  .venv/            # venv (локально, не в git)
```

## URL-маршрутизация (бэкенд)

| Префикс | Назначение |
|---------|------------|
| `/admin/django/` | Django admin (staff) |
| `/api/auth/token/`, `token/refresh/`, `me/` | JWT |
| `/api/` | DRF router — см. ниже |
| `/media/` | Файлы (dev): текстуры материалов (`DEBUG=1`) |

## URL-маршрутизация (фронтенд, SPA)

Веб‑админка — SPA на Vite. Разделы верхнего меню теперь находятся на разных URL:

- `/materials` — материалы (дерево папок, список, карточка)
- `/calculator` — калькулятор (шаг 1: выбор фасада)
- `/calculator/frame` — калькулятор (шаг 2 для рамочного фасада)
- `/calculator/frame/size` — калькулятор (шаг 3 для рамочного фасада: габариты)
- `/calculator/mdf` — калькулятор (шаг 2 для МДФ фасада, заглушка)
- `/calculator/pvc` — калькулятор (шаг 2 для ПВХ фасада, заглушка)
- `/orders` — заказы (заглушка)

Примечание: это именно маршрутизация SPA (React Router), не Django URL.

### Калькулятор (UI, соглашения)

| Элемент | Описание |
|---------|----------|
| Вкладки шагов | В шапке блока калькулятора: **Шаг 1** (`NavLink` на `/calculator`, с **`end`**), **Шаг 2** (кнопка на текущий фасад), **Шаг 3** (только `facade === 'frame'` и готовая сессия шага 2). Подсказки `title` при отключённых вкладках. |
| Сессия рамочного шага 2→3 | `localStorage`: `calc_frame_type_id`, `calc_frame_color_id`. Запись после гидрации и при валидной паре «тип профиля + цвет» в ответе API; очистка при сбросе выбора. Событие **`calc-frame-session`** (`frameCalcSession.ts`) + подписка для `useSyncExternalStore` в `CalculatorPage` — обновление вкладки «Шаг 3» без перезагрузки. Готовность: **`isFrameStep2Ready()`**. |
| Шаг 3 без сессии | `Step3FrameSizes`: редирект на `/calculator/frame` (`replace`), если сессия не готова. |
| Эскиз | Общий вид `.sketch`: периметр **`sketchFrameInlineStyle`** (`sketchFrame.ts`: `texture_color`, `texture_image`, dev-URL для `/media/`). Внешняя обводка колонки эскиза снята (`.frame2-sketch`: `border: 0`, `overflow: visible`). Выравнивание между шагами: одна сетка `frame2` / `frame3`, **`frame2-sketch-inner`** на контейнере эскиза шага 3 + `flex: 1` для центрирования. |
| Чертёжные размеры (шаг 3) | Блок **`frame3-drawing`** обнимает `.sketch`; **`frame3-dim-drawing`**: выносные пунктирные линии, размерная линия со стрелками, подписи мм; `z-index` выше листа эскиза. |
| Левая панель формы | Класс **`.calc-side-panel`** (`CalculatorPage.css`): фиксированная высота от `100dvh`, вертикальная прокрутка при переполнении. Используется на шаге 1 (обёртка сетки фасадов), **`frame2-card`**, **`frame3-left`**, заглушках МДФ/ПВХ. Шаг 1: ограничение ширины **`#calc-step-panel-1 .calc-card`** под первую колонку сетки рамочного шага. |

## REST API (сводно)

Справочникам (кроме пары эндпоинтов `token/`) требуется **JWT** в заголовке `Authorization: Bearer <access>`.

| Ресурс | Методы | Примечания |
|--------|--------|------------|
| `/api/categories/` | GET, POST | `GET ?tree=1` — вложенное дерево; обычный `GET` — плоский list с пагинацией. |
| `/api/categories/{id}/` | GET, PUT, PATCH, DELETE | `PATCH` — переименование и т.д.; **DELETE** — см. [правила удаления папок](#категории-материалы-папки). |
| `/api/uom/`, `/api/uom/{id}/` | CRUD | |
| `/api/material-classes/`, `/{id}/` | CRUD, DELETE | `DELETE` — удаление **записи** класса из справочника (см. UI). |
| `/api/materials/`, `/{id}/` | CRUD, list | `?category=`, `?search=`; пагинация 100. |
| `/api/calculator-profiles/`, `/{id}/` | CRUD | Профили калькулятора (профиль = материал) + список «цветов» (материалы). |
| `/api/calculator-profile-types/`, `/{id}/` | CRUD | Типы профилей (не материал) + список цветов (материалы) с флагами `is_new/is_hit/is_sale` + картинка `card_image`. |

**Пагинация list:** `count`, `next`, `previous`, `results`.

### Поля тела/ответа: материал (дополнительно к полям модели)

- `material_class_ids` — список id.
- `alt_prices` — `[{ currency, price }]`; при сохранении — **полная замена**, если передан.
- `related_items` / `operation_lines` — то же, при передаче ключа.
- `article` — строка, при записи **обрезка**; **уникальность** у непустого значения (БД + валидация в сериализаторе), см. [материал](#категории-материалы-папки).
- `thickness`, `min_length`, `max_length`, `min_width`, `max_width`, `designation`, `cut_coeff`, `calc_type` — **«Доп. параметры»** (задел для калькулятора и ограничений габаритов).
- `texture_mode`, `texture_color`, `texture_image`, `tex_*` — **«Параметры текстуры»** (цвет/текстура + параметры наложения).

**JWT (настройки):** `SIMPLE_JWT` в `config/settings.py` — сроки access/refresh.

---

## Категории, материалы, папки

### Категории (`MaterialCategory`)

- Дерево: `parent` → `self`, у детей `on_delete=CASCADE` при удалении **родителя** (на уровне ссылок; фактическое удаление **контролируется** в `MaterialCategoryViewSet.destroy` до вызова `super().destroy` — см. ниже).
- `unique_together` **(parent, name)** — уникальное имя среди **соседей** (одинаковое имя в **другой** ветке разрешено).
- **Удаление через API** (`DELETE /api/categories/{id}/`):
  - если есть **дочерние** категории → **400** и сообщение: удалить/перенести **вложенные папки**;
  - если в категории есть **хотя бы один** `Material` → **400** (FK `PROTECT` на `Material.category` не допустит в обход, но сначала явная проверка в view).
- **Патч/пут** — смена `name`, `parent`, `code`, `sort_order` (как в сериализаторе).

### Материал (`Material`)

- **Артикул (`article`):** хранение с `strip` в `save`/`clean`; **ограничение БД:** `UniqueConstraint` на `article` с условием `article != ""` (несколько **пустых** артикулов **могут** существовать). Дублирование **непустого** — ошибка 400.
- **Активен (`is_active`, default `True`):** булево «карточка действующая / выключенная» для **будущих** сценариев (клиент, фильтры, отчёты). В веб-админке **список материалов** пока **не** фильтрует по `is_active` — при смене бизнес-правил добавить запрос/фильтр.

### Взаимосвязи

- `Material.category` — `PROTECT` на `MaterialCategory`.
- Сопутствующие/операции — см. миграцию `0010` и [PROGRESS](PROGRESS.md).

---

## Представления (бэкенд, кратко)

- `MaterialViewSet` — `select_related`/`prefetch_related` (в т.ч. сопутствующие/операции); поиск `SearchFilter` по `name`, `article`, `fnp_name`.
- `MaterialCategoryViewSet` — кастомный `list` для `?tree=1` и **`destroy`** с проверками.
- `MaterialSerializer` — `validate_article`, замена `related_items`/`operation_lines` в `create`/`update`, обработка `IntegrityError` по артикулу.
- `CalculatorProfileViewSet` — профили калькулятора (профиль = `Material`) + «цвета профиля» (материалы).
- `CalculatorProfileTypeViewSet` — типы профилей + «цвета типа профиля» (материалы) + флаги и картинка; принимает JSON и multipart/form-data.

---

## Фронтенд: модули и поведение

| Модуль | Роль |
|--------|------|
| `App.tsx` | Вход / `AdminApp` по сессии. |
| `AdminApp.tsx` | Сетка: папки — список+портал — карточка; `TreeRow`, `MaterialForm`, модалка удаления папки, `createPortal` для панели снизу. |
| `MaterialExtrasPanel.tsx` | Сопутствующие, операции, предпросчёт. |
| `api.ts` | `apiFetch` + `parseJsonError` (в т.ч. поля `name`, `article` и **detail**). |
| `CalculatorPage.tsx` | Калькулятор: маршруты шагов 1–3, вкладки, `useSyncExternalStore` + `frameCalcSession` для доступности шага 3. |
| `CalculatorPage.css` | Вкладки `.calc-step-tab`; **`.calc-side-panel`**; ширина карточки шага 1. |
| `calculator/frameCalcSession.ts` | `isFrameStep2Ready`, событие сессии, подписка для внешнего стора. |
| `calculator/sketchFrame.ts` | `resolveMediaUrl`, `sketchFrameInlineStyle` для `.sketch-frame`. |
| `calculator/Step2FrameFacade.tsx` | Шаг 2 (рамочный): типы профилей, модалка цвета, эскиз; `localStorage` + эффекты гидрации/валидации; **`calc-side-panel`** на карточке. |
| `calculator/Step2FrameFacade.css` | Сетка `frame2`, `.sketch*`, `.frame2-sketch` (без внешней рамки), модалки, плитки. Подключается также шагом 3 для эскиза. |
| `calculator/Step3FrameSizes.tsx` | Шаг 3: поля габаритов, чертёжные размеры, таблица в листе (как шаг 2 + «Размеры»). |
| `calculator/Step3FrameSizes.css` | Сетка `frame3`, чертёж `.frame3-dim-drawing`, `overflow: visible` для правой колонки. |
| `calculator/Step2MdfFacade.tsx` / `Step2PvcFacade.tsx` | Заглушки шага 2 для МДФ/ПВХ. |
| `index.css` / `App.css` / `AdminApp.css` | На **десктопе** (широкий экран) у `html/body` при админке — **без** вертикального скролла документа, скролл **внутри** колонок; центральная колонка — `flex` + скролл списка, низ с панелью **сопутствующих** у нижнего края. |

### Папки (левая колонка)

- Выбор: клик по **названию** на боковике.
- **Шестерёнка (⚙):** по **наведению** на строку появляется; меню: **Переименовать** (inline-редактирование), **Удалить…** — далее **модальное окно** (портал в `body`, не нативный `confirm` — надёжнее в WebView/встраиваемых браузерах), только после **«Удалить»** в модалке уходит `DELETE` на API.

### Карточка материала (правая колонка)

- Вкладки: **«Общие параметры»**, **«Доп. параметры»**, **«Параметры текстуры»**.
- Чекбокс **«Активен»** — бинд на `is_active` (см. смысл в разделе [материал](#категории-материалы-папки)).

#### Вкладка «Доп. параметры»

- `thickness` (толщина, float)
- `max_length` (макс. длина, float)
- `max_width` (макс. ширина, float)
- `designation` (обозначение, text)
- `cut_coeff` (коэф. с учётом раскроя, float)
- `calc_type` (тип; пока значение `tape`/«Лента»)

#### Вкладка «Параметры текстуры»

- Режим: **цвет** или **текстура**
- Цвет: `texture_color` (HEX) + выбор через color input (RGB)
- Файл: `texture_image` (загрузка изображения; отдаётся через `/media/` в dev)
- Параметры наложения:
  - `tex_offset_x`, `tex_offset_y`
  - `tex_step_x`, `tex_step_y`
  - `tex_opacity`
  - `tex_mirror`
  - `tex_specular_sharpness`, `tex_specular_brightness`
  - `tex_rotation_deg`
- Слева — превью‑сфера, на которую влияют параметры

#### Multipart нюанс (важно)

При загрузке `texture_image` запрос идёт как `multipart/form-data`, и списочные поля (`material_class_ids`, `alt_prices`, `related_items`, `operation_lines`) приходят строкой. Сериализатор поддерживает JSON‑строки вида `"[1,2]"` и `"[]"`.

#### Удаление текстуры (важно)

Чтобы **удалить** уже сохранённую текстуру, одной очистки UI недостаточно — нужен явный PATCH:

- `PATCH /api/materials/{id}/` с телом `{"texture_image": null}`

Во фронтенде кнопка **«Убрать текстуру»** делает именно это: очищает локальное превью и при сохранении отправляет `texture_image: null`.

#### Ограничение длины имени файла

В dev/прототипе текстуры могут приходить с длинными именами файлов. Для этого у `texture_image` увеличен `max_length` (миграция `0014`), иначе загрузка может падать с 400.

### Панель внизу (центр)

- `MaterialExtrasPanel` порталится в `div.admin-main-extras-host` **под** прокручиваемым списком материалов.

Vite: прокси `/api` → `http://127.0.0.1:8000`.

---

## Стили (основные CSS-файлы)

- `AdminApp.css` — сетка админки, дерево, `tree-gear-*`, `admin-modal-*`, список материалов, форма.
- `CalculatorPage.css` — калькулятор: шаги-вкладки, **`.calc-side-panel`**, ширина шага 1.
- `calculator/Step2FrameFacade.css` — шаг 2 (рамочный): `frame2`, эскиз `.sketch*`, модалка.
- `calculator/Step3FrameSizes.css` — шаг 3: `frame3`, чертёжные размеры.
- `MaterialExtrasPanel.css`, `HintButton.css` — панель и подсказки.
- `LoginPage.css` — экран входа.

---

## Запуск (локально)

**Бэкенд** (venv):

```bash
py manage.py migrate
py manage.py runserver
```

**Фронт:**

```bash
cd frontend
npm install
npm run dev
```

`backend/.env` — CORS, `DEBUG`, `SECRET_KEY` и т.д.

## Handoff

`py scripts/furnitech_status.py` — шапки документов. Актуальное состояние и чеклист: [PROGRESS.md](PROGRESS.md). План продукта: [PLAN.md](PLAN.md).
