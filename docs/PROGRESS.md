# Furnitech — прогресс (обновляйте в конце сессии)

**Последнее обновление:** 2026-04-26

## Краткая сводка

Проект: **Django + DRF (JWT)** + **Vite + React 19 (TS)** — веб‑админка справочника материалов + задел под калькулятор. Реализовано: дерево **папок**, список материалов, карточка с вкладками (**«Общие параметры»**, **«Доп. параметры»**, **«Параметры текстуры»**), сопутствующие/операции, **уникальный непустой артикул**. Разделы вынесены в URL: `/materials`, `/calculator`, `/orders`. В калькуляторе шаги в URL: `/calculator` (шаг 1), `/calculator/frame|mdf|pvc` (шаг 2 по фасаду), **`/calculator/frame/size` (шаг 3: габариты рамочного фасада)**. **UI калькулятора:** вкладки «Шаг 1 / 2 / 3» в едином стиле; шаг 3 доступен только для рамочного фасада и после выбора типа профиля и цвета на шаге 2; склейка шагов через `localStorage` + событие `calc-frame-session` и `useSyncExternalStore` (`frameCalcSession.ts`); эскиз шагов 2–3 с общим стилем рамки (`sketchFrame.ts`), без внешней обводки у `.frame2-sketch`; на шаге 3 размеры в виде **чертежа** (выносные пунктирные линии, размерная линия со стрелками); левая панель формы — класс **`.calc-side-panel`**: фиксированная высота от `100dvh`, **прокрутка** при переполнении; шаг 1 — `max-width` карточки как у первой колонки сетки рамочного шага. Подробная архитектура: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Бэкенд (`backend/`, приложение `materials`)

| Область | Состояние |
|---------|-----------|
| **Проект Django** | `config/` (urls, settings, wsgi/asgi), SQLite `db.sqlite3` по умолчанию. |
| **API** | DRF `DefaultRouter`: `material-classes`, `uom`, `categories`, `materials`, `calculator-profiles`, **`calculator-profile-types`**. |
| **Аутентификация** | `djangorestframework-simplejwt`: `POST /api/auth/token/`, `POST /api/auth/token/refresh/`, `GET /api/auth/me/`. |
| **Права** | `IsAuthenticated` + `DjangoModelPermissions`; группа **«Редактор материалов»** (`is_staff=False` — без Django admin). Суперпользователь — веб + `/admin/django/`. |
| **Пагинация** | `PageNumberPagination`, `PAGE_SIZE=100` (`config/settings.py`). |
| **Категории (папки)** | `GET /api/categories/?tree=1` — дерево; `POST` — создать; `PATCH/PUT/DELETE` — по `/api/categories/{id}/`. **Удаление** запрещено с ответом `400`, если есть **вложенные папки** или **материалы** в папке (`MaterialCategoryViewSet.destroy`). |
| **Материалы** | `GET/POST/PUT/PATCH/DELETE` на `/api/materials/`, `?category=`, `?search=` (имя, артикул, ФНП). |
| **Миграции** | В т.ч. `0010_companion_and_operations` (сопутствующие/операции, права группы), **`0011_material_article_unique_nonempty`** — частичный **unique** на `article` при непустом значении; `0012` — доп. параметры; `0013` — параметры текстуры; `0014` — увеличение `max_length` у `texture_image`; **`0015_calculator_profiles`** — профили калькулятора и их «цвета»; **`0016`–`0017`** — типы профилей и картинка; **`0018`** — минимальные размеры материала. |

### Модели (сущности)

- `MaterialCategory` — дерево (`parent`, `on_delete` у детей: CASCADE), `unique_together (parent, name)`, `path` в API.
- `UnitOfMeasure`, `MaterialClass` — справочники; M2M классов к `Material`.
- `Material` — `category`, `name`, **`article`** (у непустых — уникальность в БД; пустой артикул у нескольких записей **разрешён**), `fnp_name`, M2M классов, `uom`, `unit_mass` (3 знака, default 0), **`base_currency` = KZT**, `base_price`, `note`, округления, **`is_active`** (см. глоссарий ниже), `external_id` / `last_synced_at`.
- `Material` (продолжение) — **«Доп. параметры»**: `thickness`, `min_length`, `max_length`, `min_width`, `max_width`, `designation`, `cut_coeff`, `calc_type`.
- `Material` (продолжение) — **«Параметры текстуры»**: `texture_mode`, `texture_color`, `texture_image`, `tex_offset_x/y`, `tex_step_x/y`, `tex_opacity`, `tex_mirror`, `tex_specular_sharpness`, `tex_specular_brightness`, `tex_rotation_deg`.
- `MaterialAlternativePrice` — `alt_prices` в API, полная замена при сохранении.
- `MaterialRelatedItem` / `MaterialOperationLine` — см. [ARCHITECTURE.md](ARCHITECTURE.md).
- `CalculatorProfile` — профиль калькулятора: **один материал** из базы, который выступает «профилем» (OneToOne к `Material`).
- `CalculatorProfileColor` — «цвет профиля»: привязка профиля к другому материалу (многие‑ко‑многим через таблицу, с порядком и уникальностью).
- `CalculatorProfileType` — тип профиля (калькулятор): имя + картинка (`card_image` или `image_url`), порядок, активность; **не привязан к материалу профиля**.
- `CalculatorProfileTypeColor` — «цвет типа профиля»: ссылка на материал + флаги `is_new/is_hit/is_sale`.

### Сериализация материала

- `related_items` / `operation_lines` — чтение и полная замена при записи, если ключ в теле.
- Валидация дубликата артикула в сериализаторе; при гонке — `IntegrityError` → 400 с полем `article`.
- **Multipart для загрузки текстуры:** при `texture_image` запрос уходит как `multipart/form-data`, и списки (`material_class_ids`, `alt_prices`, `related_items`, `operation_lines`) могут приходить JSON‑строкой. Сериализатор поддерживает JSON‑строки.
- **Multipart edge-case:** некоторые клиенты/сервер могут дать `["[]"]` вместо `"[]"` — обработано в сериализаторе.

### Django admin

URL: `/admin/django/`. Сущности `Material*`, `MaterialCategory`, `MaterialClass`, `UoM`, альт. цены, сопутствующие, операции.

### Management

- `create_materials_editor` — пользователь веб-админки без staff: [README.md](../README.md).

---

## Смысл отдельных полей (коротко)

| Поле / элемент UI | Смысл |
|-------------------|--------|
| **Артикул** | Код/номер для сопоставления с учётом, справочниками, 1С. Непустой артикул **не дублируется**; после ввода обрезка **пробелов** (`strip`). |
| **Активен** (`is_active`) | «Мягкое» отключение карточки без удаления: задел для скрытия в калькуляторе, отчётах, фильтрах. Сохраняется в БД; **фильтрация списка в веб-админке по флагу может быть ещё не сделана** — при необходимости доработать. |
| **Коэф** (колонка списка) | Зарезервировано под будущий коэффициент, пока `—`. |
| **Вкладки карточки** | **«Общие параметры»** — вся текущая форма; **«Доп. параметры»** / **«Параметры текстуры»** — заглушки «скоро» ([PLAN.md](PLAN.md)). |
| **Сопутствующие / Операции** | К расчёту будущей цены; панель внизу **средней** колонки, предпросчёт в UI. |

---

## Фронтенд (`frontend/`, Vite 6 + React 19 + TS)

| Файл / папка | Назначение |
|--------------|------------|
| `AdminApp.tsx` | Дерево `TreeRow`, папки: **шестерёнка** → меню «Переименовать» / **«Удалить…»**; удаление папки — **модальное окно** (`createPortal` в `document.body`, не `window.confirm`). `MaterialForm`, портал `MaterialExtrasPanel`, модалка удаления папки. |
| `MaterialExtrasPanel.tsx` | Сопутствующие, операции, предпросчёт. |
| `CalculatorPage.tsx` | Калькулятор: шаг 1 `/calculator`; шаг 2 (`/calculator/frame`, `/calculator/mdf`, `/calculator/pvc`); **шаг 3 для рамочного**: `/calculator/frame/size`. Вкладки шагов 1–3; `NavLink` шага 1 с **`end`** (без ложной активности на вложенных путях). Шаг 3: `isFrameStep2Ready()` + `canOpenFrameStep3`. |
| `CalculatorPage.css` | **`.calc-side-panel`** — единая высота левой панели (шаги 1–3, `frame2-card`, `frame3-left`, заглушки МДФ/ПВХ), `overflow-y: auto`. **`#calc-step-panel-1 .calc-card`** — `max-width` 640px / 700px (≥1280px), как первая колонка сетки рамочного шага. |
| `calculator/Step2FrameFacade.tsx` | Шаг 2 (рамочный): плитки типов профилей, выбор цвета в модалке, справа эскиз. Заголовок «Тип профиля и цвет» **внутри** `frame2-card` (сетка и эскиз начинаются на одной высоте с шагом 3). Синхронизация `localStorage` (`calc_frame_type_id`, `calc_frame_color_id`) после гидрации и при валидной паре тип+цвет; **`notifyFrameCalcSession`**; эффекты не сбрасывают выбор, пока **`loading`** / до гидрации (возврат с шага 3). Класс **`calc-side-panel`** на `frame2-card`. |
| `calculator/Step2MdfFacade.tsx` / `Step2PvcFacade.tsx` | Заглушки; контент в **`calc-side-panel`**. |
| `calculator/Step3FrameSizes.tsx` | Шаг 3: габариты и кол-во; min/max из материала цвета; редирект на `/calculator/frame`, если сессия шага 2 не готова. Эскиз в **`frame3-drawing`** (обёртка = контур `.sketch`); размеры — **`.frame3-dim-drawing`** (чертёж); внутри листа таблица как на шаге 2 + строка **«Размеры»** (выс×шир мм). **`frame2-sketch-inner`** на контейнере эскиза + **`line-height: normal`** у `.sketch` (не наследовать `line-height: 0` от обёртки). |
| `calculator/Step3FrameSizes.css` | Сетка `frame3` как у `frame2`; **`frame3-right.frame2-sketch`**: `overflow: visible`; стили чертёжных размеров; **`z-index`** у размеров выше эскиза. |
| `calculator/sketchFrame.ts` | `resolveMediaUrl`, `sketchFrameInlineStyle` для периметра `.sketch-frame`. |
| `calculator/frameCalcSession.ts` | `isFrameStep2Ready`, `FRAME_CALC_SESSION_EVENT`, `subscribeFrameCalcSession`, `notifyFrameCalcSession` — вкладка шаг 3 и согласованность с `localStorage`. |
| `api.ts` | `apiFetch` + разбор ошибок DRF + методы `calculator-profiles`. |
| `index.css` / `App.css` / `AdminApp.css` | Без **прокрутки `document`** на десктопе: окно сетки 3 колонок укладывается в `100dvh`, скролл **внутри** колонок; панель сопутствующих **привязана** к низу центральной колонки. |

### Поведение UI

- **Папки:** клик по **названию** — выбор; **▸/▾** — свернуть/развернуть вложенные; **⚙** (по наведению на строку) — меню; переименование — **inline-поле**; удаление — **модалка** + API; пустая папка без детей и материалов.
- **Список материалов:** легенда колонок, колонка «Коэф» — плейсхолдер.
- **Карточка:** вкладки **«Общие параметры»**, **«Доп. параметры»**, **«Параметры текстуры»**.
- **Сопутствующие/операции** — под списком папок (портал), только при открытой карточке (редактирование).
- **Калькулятор:** ключи `localStorage`: `calc_frame_type_id`, `calc_frame_color_id` (только при валидной паре тип+цвет в данных API). **`frame2-sketch`:** без внешней рамки, `overflow: visible`; эскиз по центру — **`frame2-sketch-inner`** (`flex` + `justify-content: center`). Стили эскиза (`.sketch`, `.sketch-sheet`, …) в **`Step2FrameFacade.css`** (шаг 3 подключает этот файл).

---

## Операция и типовые сбои

- **500 на `/api/materials/`** — часто **не применена миграция** `0010` (и при необходимости `0011`): `.\.venv\Scripts\python.exe backend\manage.py migrate`
- **404 на `/api/calculator-profiles/`** — обычно запущен **старый/другой** `runserver` или конфликтует несколько процессов. Решение: оставить **один** backend на `:8000`, применить миграции и перезапустить.
- **401 на `/api/*`** — ожидаемо без JWT; сперва войти через веб‑админку (Vite) или получить токен через `/api/auth/token/`.
- **CORS (dev):** `http://127.0.0.1:5173` / `localhost:5173` в `backend/.env`.
- **Текстуры (dev):** раздача файлов включена только в `DEBUG=1` через `/media/`. Для работы загрузки нужен `Pillow`.
- **Длинные имена файлов текстур:** у `ImageField` увеличен `max_length` (миграция `0014`), иначе возможен 400 при загрузке.
- **Удаление текстуры:** кнопка «Убрать текстуру» очищает поле и сохраняет удаление через `PATCH texture_image=null`.

---

## Документация в репо

| Файл | Содержание |
|------|------------|
| [PLAN.md](PLAN.md) | План этапов продукта. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Стек, API, модели, UI, соглашения. |
| [../README.md](../README.md) | Быстрый старт, роли, пользователи. |
| `scripts/furnitech_status.py` | Handoff, шапки `docs/*`. |
| `.cursor/skills/furnitech-handoff/` | Напоминание агенту. |

## Чеклист дальше

- [x] Аутентификация (JWT) и права на `/api/*`.
- [x] Папки: переименование, удаление с проверками; UI шестерёнка + модалка.
- [x] Уникальность непустого артикула; миграция `0011`.
- [x] База KZT, альт. валюты, сопутствующие/операции, миграция `0010`, вкладка «Общие параметры».
- [ ] Фильтр/скрытие неактивных материалов в веб-админке и в клиенте (по `is_active`) — по необходимости.
- [x] Вкладка «Доп. параметры» (поля лимитов/параметров для калькулятора).
- [x] Вкладка «Параметры текстуры» (цвет/текстура, загрузка файла, превью-сфера, настройки).
- [x] Удаление текстуры кнопкой «Убрать текстуру» (серверное сохранение удаления).
- [x] Профили калькулятора (материалы) и цвета (материалы) через `/api/calculator-profiles/`.
- [x] Типы профилей (не материал) + цвета с флагами + загрузка картинки: `/api/calculator-profile-types/`.
- [x] Калькулятор (рамочный): шаг 2 — выбор типа профиля и цвета + эскиз; шаг 3 — габариты с ограничениями из материалов.
- [ ] Модель заказа, экран «Заказы».
- [ ] Клиентский калькулятор (реф. Modusline).
- [ ] 1С: sync; `article` + `external_id` как якоря.

## Как продолжить (агент / разработчик)

1. `py scripts/furnitech_status.py` (из корня).
2. [ARCHITECTURE.md](ARCHITECTURE.md), [PLAN.md](PLAN.md).
3. В конце сессии — обновить **этот файл** (дата, факты).
