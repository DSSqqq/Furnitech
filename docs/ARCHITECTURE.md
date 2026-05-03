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
- **Frontend:** `package.json` — React 19, Vite, TypeScript, ESLint; для PDF клиента на шаге 8 — **`jspdf`**, **`jspdf-autotable`**, модуль **`calculator/frameClientPdf.ts`** (подключение из **`Step8FrameResult`** обычным `import`); кириллица — встроенный **Noto Sans** из **`public/fonts/NotoSans-Regular.ttf`** (см. код регистрации шрифта на каждом документе).

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

SPA на Vite, **React Router 7**. Часть маршрутов **только для авторизованных** (редирект на `/login` с сохранением `state.from`).

### Публично (без входа)

| URL | Назначение |
|-----|------------|
| `/` | Калькулятор для посетителя: **`CalculatorPage variant="public"`**, шаг 1 (выбор фасада) |
| `/frame`, `/frame/size`, `/frame/filling`, `/frame/summary`, `/frame/hinge-layout`, `/frame/handle-holes`, **`/frame/result`** | Шаги 2–8 для **рамочного** фасада (те же компоненты, что в админке, с `readOnly`) |
| `/mdf`, `/pvc` | Шаг 2 для МДФ / ПВХ (заглушки) |
| `/login` | Вход сотрудника; после успеха — возврат на `state.from` или `/materials` |

Компонент **`PublicShell`** (`App.tsx` + `App.css`): шапка с брендом и ссылкой «Вход для сотрудников» / «Админка».

### Только после входа (`AdminApp`)

| URL | Назначение |
|-----|------------|
| `/materials`, `/materials/…` | Материалы: дерево, список, карточка |
| `/calculator`, `/calculator/frame`, … | Калькулятор **`variant="admin"`** (префикс `/calculator/…`, полный CRUD на шагах 2 и 4) |
| `/orders`, `/orders/…` | Заказы (заглушка) |

Детализация шагов калькулятора (одинаковая логика для гостя и админа, различаются **префикс URL** и **readOnly**):

- **Шаг 1:** выбор фасада (рамочный / МДФ / ПВХ)
- **Шаг 2:** зависит от фасада; для рамочного — тип профиля и цвет (`Step2FrameFacade`)
- **Шаг 3 (только рамочный):** габариты — `…/frame/size` (`Step3FrameSizes`)
- **Шаг 4 (только рамочный):** наполнение — `…/frame/filling` (`Step4FrameFilling`)
- **Шаг 5 (только рамочный):** итоговый эскиз и присадка под петли — `…/frame/summary` (`Step5FrameSummary`, **`FrameHingeMortisePanel`**, **`FrameHingeCatalog`**)
- **Шаг 6 (только рамочный):** раскладка петель (сторона, число отверстий, расстояния в мм) — `…/frame/hinge-layout` (`Step6FrameHingeLayout`)
- **Шаг 7 (только рамочный):** отверстия под ручку (число, диаметр, ориентация, сторона, межосевые) — `…/frame/handle-holes` (`Step7FrameHandleHoles`); при **вертикальной** ручке сторона **слева/справа** не может совпадать со стороной петель из шага 6; при **горизонтальной** — то же для **сверху/снизу**. Данные: **`calc_handle_holes`** (см. `frameCalcSession.ts`).
- **Шаг 8 «Итог» (только рамочный):** сводка конфигурации, контактная форма (mailto), таблица ориентировочной стоимости, **выгрузка PDF для клиента** (первая страница — сводка и таблицы; далее **по одной странице на фасад** с эскизом и размерами) — `…/frame/result` (`Step8FrameResult`, модуль **`frameClientPdf.ts`**).

Префиксы маршрутов внутри калькулятора задаются **`calculator/calcPathsContext.tsx`** (`CalcPathsProvider`, хук **`useCalcPaths()`**: `step('frame/size')`, `step('frame/hinge-layout')`, `home`, `readOnly`).

Примечание: это маршрутизация SPA, не Django URL.

### Калькулятор (UI, соглашения)

| Элемент | Описание |
|---------|----------|
| Вкладки шагов | **Шаг 1** — `NavLink` на **`home`** из контекста (`/` или `/calculator`), с **`end`**. **Шаг 2** — кнопка на текущий фасад (`step(facade)`). **Шаг 3** и **Шаг 4** — только при `facade === 'frame'` и **`isFrameStep2Ready()`**; переходы на `step('frame/size')` и `step('frame/filling')`. **Шаг 5** — при `facade === 'frame'` и **`isFrameStep4Ready()`**. **Шаг 6**, **7** и **вкладка «Итог» (шаг 8)** — при `facade === 'frame'` и **`isFrameStep4Ready()`** (гейт совпадает с шагом 5). Подсказки `title` при отключённых вкладках. |
| Сессия рамочного шага 2→3 | `localStorage`: `calc_frame_type_id`, `calc_frame_color_id`. Запись после гидрации и при валидной паре «тип профиля + цвет» в ответе API; очистка при сбросе выбора. Событие **`calc-frame-session`** (`frameCalcSession.ts`) + подписка для `useSyncExternalStore` в `CalculatorPage` — обновление вкладки «Шаг 3» без перезагрузки. Готовность: **`isFrameStep2Ready()`**. Шаг 3 дополнительно: **`calc_frame_height_mm`**, **`calc_frame_width_mm`**, **`calc_frame_qty`**; при изменении — `notifyFrameCalcSession()`. Шаг 4 при записи выбора наполнения — тоже **`notifyFrameCalcSession()`**. |
| Отверстия под ручку (шаг 7) | **`calc_handle_holes`**: JSON **`HandleHolesPersisted`** — число отверстий, **`diameterMm`**, **`bushings`**, **`orientation`** (`vertical` \| `horizontal`), **`side`**, **`offsetStartMm`**, **`spanMm`** (межосевые). Валидация **`validateHandleHoles`**; конфликт с петлями: **`isHandleSideBlockedByHinges`** (вертикаль ↔ лево/право, горизонталь ↔ верх/низ). Сброс в **`clearFrameCalculatorStorage()`**; участие в **`readCalculatorPriceConfigKey`**. |
| Присадка и петли (шаг 5–6) | Ключи: **`calc_frame_mortise`**, **`calc_hinge_source`**, **`calc_hinge_type_id`**, **`calc_hinge_material_id`**; раскладка: **`calc_hinge_layout`** — JSON **`HingeLayoutPersisted`**: `side` (`left`/`right`/`top`/`bottom`), `count` (1…10), **`positionsMm`** — **абсолютные** мм от **начала** выбранной кромки (верх/низ: от левого края; лево/право: от верхнего). В UI шага 6 расстояния вводятся **парами** (зеркально от начала и конца); пересчёт в абсолюты — **`hingeUserInputsToAbsoluteMm`**, обратно — **`hingeAbsoluteToUserInputStrings`**; стартовые позиции по длине кромки **L** — **`defaultHingeAbsPositionsMm(L, count)`** (**n+1** равных отрезка, петля **i** на **(i+1)·L/(n+1)** мм от начала кромки). Участвуют в **`readCalculatorPriceConfigKey`**; сброс в **`clearFrameCalculatorStorage()`**. При **смене стороны** петель раскладка в хранилище сбрасывается (**`writeHingeLayout(null)`**). Валидация: **`validateHingePositions`**, длина кромки **`hingeEdgeLengthMm`**, габариты **`readFrameDimsMm`**. |
| Шаг 5 доступность | Шаг 5 доступен **только** если выбран материал наполнения на шаге 4: `localStorage.calc_filling_material_id` валиден. Проверка: **`isFrameStep4Ready()`** в `frameCalcSession.ts`. При прямом открытии URL шага 5 — редирект на шаг 4. |
| Шаг 6 без готовности шага 4 | `Step6FrameHingeLayout`: редирект на шаг 4 при **`!isFrameStep4Ready()`** (аналогично шагу 5). |
| Шаг 3 / 4 без сессии шага 2 | `Step3FrameSizes` / `Step4FrameFilling`: редирект на **`step('frame')`** (`replace`), если **`isFrameStep2Ready()`** ложно. |
| Эскиз | Общий вид `.sketch`: отрисовка текстуры через **`materialTextureLayerStyle`** (`sketchFrame.ts`) на внутренних слоях `.sketch-frame-texture` и `.sketch-paper-texture`. Это позволяет применять **`tex_opacity`** и `tex_mirror`, не ломая “чертёжные” псевдоэлементы `.sketch-paper::before/::after`. Для применения `tex_*` на шаге 2 и 4 догружается полный материал через `fetchMaterial(id)` (т.к. summary-ответы калькулятора не содержат `tex_*`). Текстура изображения в эскизе растягивается на всю область (`background-size: 100% 100%`); `tex_rotation_deg` в режиме эскиза сейчас игнорируется. |
| Чертёжные размеры (шаг 3) | Блок **`frame3-drawing`** обнимает `.sketch`; **`frame3-dim-drawing`**: выносные пунктирные линии, размерная линия со стрелками, подписи мм; `z-index` выше листа эскиза. Модификаторы **`--right`** / **`--bottom`** задают расположение основного габарита **напротив** стороны с петлями, чтобы линии не накладывались. |
| Петли на эскизе (шаг 5–6) | Маркеры у **внешнего** края: класс **`sketch--hinge-markers`**, `overflow: visible` для слоя маркеров. Цепочка выносных размеров вдоль стороны петель: **`.hinge-chain-dim`** (вариант **`--narrow`** для коротких сегментов — сплошная линия без стрелок по краям сегмента), слой **`frame3-hinge-dim-layer`**, ядро **`frame3-drawing-core`** (**`Step3FrameSizes.css`**). Подписи сегментов цепочки: поворот **−90°** слева от стороны петель и **+90°** справа; смещается **только текст** подписи. Вертикальный габарит справа: стрелки на всю высоту, подпись по центру. |
| Левая панель формы | Класс **`.calc-side-panel`** (`CalculatorPage.css`): фиксированная высота от `100dvh`, вертикальная прокрутка при переполнении. Используется на шаге 1 (обёртка сетки фасадов), **`frame2-card`**, **`frame3-left`**, заглушках МДФ/ПВХ. Шаг 1: ограничение ширины **`#calc-step-panel-1 .calc-card`** под первую колонку сетки рамочного шага. На шаге 8 у блока контактов **`calc-side-panel` не используется**, чтобы не фиксировать высоту колонки. |
| Шаг 8 «Итог» (вёрстка) | В админке контент вкладки калькулятора ограничен **`#admin-panel-calculator`** (**`AdminApp.css`**): без выхода за область заказов. Обёртка маршрутов с **`calc-routes-wrap--step8`**; внутри **`Step8FrameResult`** блок **`step8-result__scroll-pack`** объединяет прокрутку двух правых панелей и нижних действий (**`Step8FrameResult.css`**). |
| Ориентировочная цена | Панель **`CalcPriceTotals`** справа (`CalculatorPage.tsx` + **`CalculatorPage.css`**: `.calc-body-with-totals`, `.calc-totals-*`). На **шагах 1–2** только подсказка, суммы нет (цена появляется с шага 3 после ввода габаритов). Подписка на **`calc-frame-session`** и `storage`, снимок ключей через **`readCalculatorPriceConfigKey`** (`frameCalcSession.ts`). Данные: `fetchMaterial` по `calc_frame_color_id` и при необходимости `calc_filling_material_id`. При выборе типа фасада на шаге 1 вызывается **`clearFrameCalculatorStorage()`**, чтобы не подтягивать прошлую конфигурацию. |
| Расчёт суммы | Модуль **`calculator/framePriceEstimate.ts`**. Ед. изм. по `uom.code` (`m2`, `m`/`mp`, `pc`), при пустом `code` — эвристика (**`resolvePricingUomCode`**). **Объём на все фасады** \(N\) — как раньше: м², м.п. периметра, шт. **Профиль:** `base_price × geomColor`. **Сопутствующие** (и у цвета профиля, и у наполнения): **поштучно** по полю **`quantity_scale`** строки (`follow_parent` — × тот же множитель, что у «родителя» строки: у профиля это `geomColor`, у наполнения — `geomFill`; `per_facade` — только × \(N\); `use_related_uom` — × объём по ед. изм. **сопутствующего** материала и габаритам). См. **`relatedItemsCalculatorCost`**. **Операции:** сумма `price`; если у строки **`price_per_facade`** — умножить на \(N\), иначе один раз на конфигурацию. **Наполнение:** `base_price × geomFill` + сопутствующие наполнения той же поштучной логикой. **Стекло:** у материала наполнения должна быть ед. изм. м² (код или подпись), иначе площадь шага 3 не войдёт в цену. |

Дополнительно (UI):

- Глобальный фон: текстура дерева задаётся CSS‑переменной `--ft-wood-texture` (сейчас `frontend/src/assets/wood-premium.png`) и рисуется на уровне `#root::before` как `background-size: cover` (без тайлинга/швов).
- На шагах **3–4** эскиз мягко меняет пропорции по \(H×W\): `aspectRatio` смешивается с дефолтным (≈ 0.714) и ограничивается, чтобы не ломать подписи/кнопки. Высота эскиза слегка масштабируется через CSS‑переменную `--sketch-scale-y` (ограничено диапазоном).
- На шаге **4** размеры не теряются: габариты читаются из `localStorage` через `subscribeFrameCalcSession`/`readCalculatorPriceConfigKey` и показываются на чертеже.
- На шаге **3** поля размеров/кол-ва фильтруют ввод (только цифры) и автоматически поджимают значение в допустимый диапазон по min/max выбранного материала (кол-во фасадов — минимум 1).
- Выпадающие списки: для консистентного «премиум» UI вместо нативного `<select>` используется кастомный **`FtSelect`** (портал в `document.body`), т.к. системный список в Windows/Chrome плохо стилизуется.

## REST API (сводно)

**По умолчанию** к защищённым ресурсам нужен **JWT**: `Authorization: Bearer <access>`.

**Исключение (публичный калькулятор):** методы **GET / HEAD / OPTIONS** для **`/api/materials/`**, **`/api/calculator-profile-types/`**, **`/api/calculator-filling-types/`**, **`/api/calculator-hinge-types/`**, **`/api/calculator-handle-hole-diameters/`** (включая детализацию по `/{id}/` там, где применимо) разрешены **без аутентификации**. Для **`calculator-handle-hole-diameters`** анонимный list возвращает только строки с **`client_visible=true`**; полный каталог — см. строку таблицы ниже. Методы **POST, PUT, PATCH, DELETE** на этих же ресурсах — только для **авторизованных** пользователей с соответствующими **Django model permissions** (класс **`AllowAnyReadAuthenticatedModelPermsWrite`** в `materials/views.py`).

**`/api/calculator-profiles/`** — по-прежнему только с JWT для всех методов (**`AuthReadModelPermsWrite`**: чтение только авторизованным).

| Ресурс | Методы | Примечания |
|--------|--------|------------|
| `/api/categories/` | GET, POST | `GET ?tree=1` — вложенное дерево; обычный `GET` — плоский list с пагинацией. **JWT.** |
| `/api/categories/{id}/` | GET, PUT, PATCH, DELETE | **JWT.** `PATCH` — переименование и т.д.; **DELETE** — см. [правила удаления папок](#категории-материалы-папки). |
| `/api/uom/`, `/api/uom/{id}/` | CRUD | **JWT.** |
| `/api/material-classes/`, `/{id}/` | CRUD, DELETE | **JWT.** |
| `/api/materials/`, `/{id}/` | CRUD, list | `?category=`, `?search=`; пагинация 100. **GET — анонимно; запись — JWT + model perms.** |
| `/api/calculator-profiles/`, `/{id}/` | CRUD | Профили калькулятора (профиль = материал) + «цвета». **Только JWT.** |
| `/api/calculator-profile-types/`, `/{id}/` | CRUD | Типы профилей + цвета (материалы) + флаги + `card_image`. **GET — анонимно; запись — JWT + model perms.** |
| `/api/calculator-filling-types/`, `/{id}/` | CRUD | Типы наполнения + материалы внутри типа (шаг 4 калькулятора). **GET — анонимно; запись — JWT + model perms.** |
| `/api/calculator-hinge-types/`, `/{id}/` | CRUD | Типы петель + материалы внутри типа (каталог петель на шагах 5–6). **GET — анонимно; запись — JWT + model perms.** |
| `/api/calculator-handle-hole-diameters/`, `/{id}/` | CRUD | Диаметры отверстий под ручку (шаг 7): **`client_visible`**, сортировка. **GET — анонимно**, в ответе только строки с **`client_visible=true`**; полный список и **`catalog_scope":"full"`** — при JWT и праве **`change_calculatorhandleholediameter`** (у группы **«Редактор материалов»** права на всё приложение `materials` обновляются миграциями вроде **`0028_editor_perms_handle_hole_diameter`**). **PATCH** — JWT + model perms. |

**Пагинация list:** `count`, `next`, `previous`, `results`. Для **`calculator-handle-hole-diameters`** в теле ответа также может быть **`catalog_scope`**: `full` \| `client`.

### Поля тела/ответа: материал (дополнительно к полям модели)

- `material_class_ids` — список id.
- `alt_prices` — `[{ currency, price }]`; при сохранении — **полная замена**, если передан.
- `related_items` / `operation_lines` — то же, при передаче ключа. В каждой строке `related_items`: **`quantity_scale`**: `follow_parent` \| `per_facade` \| `use_related_uom` (по умолчанию `follow_parent`). В каждой строке `operation_lines`: **`price_per_facade`** (bool, по умолчанию `false`).
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
- Сопутствующие/операции — см. миграции `0010`, **`0021`** и [PROGRESS](PROGRESS.md).

#### Сопутствующие и операции (семантика расчёта)

| Поле | Где | Смысл в калькуляторе |
|------|-----|----------------------|
| `quantity_scale` | `MaterialRelatedItem` | `follow_parent` — \(q \times p\) × тот же геометрический множитель, что у карточки родителя (профиль или наполнение). `per_facade` — \(q \times p \times N\) без периметра/площади родителя (крепёж, комплект на изделие). `use_related_uom` — \(q \times p\) × объём по ед. изм. сопутствующего и \(H,W,N\). |
| `price_per_facade` | `MaterialOperationLine` | Если `true`: цена строки × \(N\); если `false`: один раз на выбранную конфигурацию (например, услуга на весь заказ). |

Предпросмотр суммы в **`MaterialExtrasPanel`** остаётся «плоским» (кол×цена по строкам + основной материал); итог **в калькуляторе** зависит от масштаба и габаритов — подсказки в UI панели.

Примечание по ед. изм. сопутствующих: в `MaterialExtrasPanel` доступен выбор `uom` сопутствующего материала (с сохранением в БД через `PATCH /api/materials/{id}/`), чтобы строка могла корректно масштабироваться в режиме `use_related_uom`.

---

## Представления (бэкенд, кратко)

- `AllowAnyReadAuthenticatedModelPermsWrite` — разрешения для **материалов**, **типов профилей**, **типов наполнения**, **типов петель**, **диаметров отверстий под ручку**: анонимные **безопасные** методы; запись — только аутентификация + `DjangoModelPermissions`.
- `AuthReadModelPermsWrite` — **только авторизованным** на чтение; запись по model permissions — используется для **`CalculatorProfileViewSet`**.
- `MaterialViewSet` — `select_related`/`prefetch_related`; поиск `SearchFilter` по `name`, `article`, `fnp_name`.
- `MaterialCategoryViewSet` — кастомный `list` для `?tree=1` и **`destroy`** с проверками.
- `MaterialSerializer` — `validate_article`, замена `related_items`/`operation_lines` в `create`/`update`, обработка `IntegrityError` по артикулу.
- `CalculatorProfileViewSet` — профили калькулятора (профиль = `Material`) + «цвета профиля» (материалы).
- `CalculatorProfileTypeViewSet` — типы профилей + цвета (материалы) + флаги и картинка; JSON и multipart/form-data.
- `CalculatorFillingTypeViewSet` — типы наполнения + связанные материалы (шаг 4).
- `CalculatorHingeTypeViewSet` — типы петель + связанные материалы (шаги 5–6); модели **`CalculatorHingeType`** / **`CalculatorHingeTypeMaterial`** (миграция **`0026_calculator_hinge_types`**, см. [PROGRESS](PROGRESS.md)).
- `CalculatorHandleHoleDiameterViewSet` — справочник диаметров для шага 7; модель **`CalculatorHandleHoleDiameter`** (миграции **`0027_calculator_handle_hole_diameters`**, **`0028_editor_perms_handle_hole_diameter`**); в сериализаторе **`diameter_mm`** задаётся только при **создании**.

---

## Фронтенд: модули и поведение

| Модуль | Роль |
|--------|------|
| `App.tsx` | Маршруты: `/login`; защищённые `AdminApp` на `/materials/*`, `/calculator/*`, `/orders/*`; публичный **`/*`** → `PublicShell` + **`CalculatorPage variant="public"`**. |
| `AdminApp.tsx` | Сетка материалов; калькулятор: **`CalculatorPage variant="admin"`**; вкладки по `useLocation`. |
| `MaterialExtrasPanel.tsx` | Сопутствующие (колонка **«Масштаб»**: `quantity_scale`), операции (чекбокс **«× фасад»** = `price_per_facade`); предпросмотр без габаритов + текстовые подсказки к калькулятору. |
| `api.ts` | `apiFetch` (Bearer при наличии токена) + методы API, в т.ч. CRUD helper’ы для **`calculator-handle-hole-diameters`**. |
| `CalculatorPage.tsx` | Калькулятор: **`variant`**, **`CalcPathsProvider`**, маршруты шагов 1–8 (рамочный), вкладки, `frameCalcSession`; сетка **`calc-body-with-totals`** + **`CalcPriceTotals`**; при выборе фасада на шаге 1 — **`clearFrameCalculatorStorage`**. На шаге 8 — класс **`calc-routes-wrap--step8`** на обёртке маршрутов. |
| `calculator/calcPathsContext.tsx` | `step`, `home`, `readOnly`; нормализация пути для вкладок. |
| `CalculatorPage.css` | Вкладки `.calc-step-tab`; **`.calc-side-panel`**; ширина карточки шага 1; **`.calc-body-with-totals`**, **`.calc-totals-*`** (панель итога). |
| `calculator/frameCalcSession.ts` | `isFrameStep2Ready`, **`isFrameStep4Ready`**, **`FRAME_CALC_SESSION_EVENT`**, `subscribeFrameCalcSession`, `notifyFrameCalcSession`, **`clearFrameCalculatorStorage`**, **`readCalculatorPriceConfigKey`**, ключи присадки/петель/**`calc_hinge_layout`** и **`calc_handle_holes`**; типы **`HingeMountSide`**, **`HingeLayoutPersisted`**, **`HandleHolesPersisted`**, **`HandleOrientation`**; петли: **`hingeEdgeLengthMm`**, **`hingePairPartnerIndex`**, **`hingeMeasuresFromEdgeStart`**, **`defaultHingeAbsPositionsMm`**, **`hingeUserInputsToAbsoluteMm`**, **`hingeAbsoluteToUserInputStrings`**, **`readHingeLayout`** / **`writeHingeLayout`**, **`validateHingePositions`**; ручка: **`isHandleSideBlockedByHinges`**, **`readHandleHoles`** / **`writeHandleHoles`**, **`handleHoleCentersMm`**, **`validateHandleHoles`**. |
| `calculator/framePriceEstimate.ts` | Ориентировочная стоимость: **`relatedItemsCalculatorCost`**, **`operationLinesCost(..., facadeCount)`**, `computeFramePriceBreakdown`. |
| `calculator/CalcPriceTotals.tsx` | UI итога; шаг 1 без цифр. |
| `calculator/sketchFrame.ts` | `resolveMediaUrl`, `sketchFrameInlineStyle` для `.sketch-frame`. |
| `calculator/Step2FrameFacade.tsx` | Шаг 2 (рамочный): плитки, модалка цвета, эскиз; при **`readOnly`** скрыт CRUD типов и шестерёнки. |
| `calculator/Step2FrameFacade.css` | Сетка `frame2`, эскиз, модалки, плитки; подключается шагами 3–4 при необходимости. |
| `calculator/Step3FrameSizes.tsx` | Шаг 3: габариты, чертёжные размеры. |
| `calculator/Step3FrameSizes.css` | Сетка `frame3`, `.frame3-dim-drawing` (**`--right`**, **`--bottom`**), цепочки **`.hinge-chain-dim`** (**`--narrow`** и др.) для выносных размеров петель, слой **`frame3-hinge-dim-layer`**. |
| `calculator/Step4FrameFilling.tsx` | Шаг 4: наполнение; при **`readOnly`** без CRUD и без добавления материалов в тип из модалки. |
| `calculator/Step5FrameSummary.tsx` | Шаг 5: итоговый эскиз, блок присадки (**`FrameHingeMortisePanel`**). |
| `calculator/FrameHingeMortisePanel.tsx` | Выбор «не требуется» / присадка, источник петель (заказчик / производство), каталог или текст про уточнение у сотрудника. |
| `calculator/FrameHingeCatalog.tsx` | Каталог типов петель с API **`calculator-hinge-types`** (как наполнение на шаге 4). |
| `calculator/Step6FrameHingeLayout.tsx` | Шаг 6: сторона, **до 10** отверстий, ввод расстояний **парами** (зеркально), дефолты **`defaultHingeAbsPositionsMm`** (равномерно по **L**), сброс **`writeHingeLayout(null)`** при смене стороны; превью с маркерами и цепочками **`.hinge-chain-dim`**. |
| `calculator/Step7FrameHandleHoles.tsx` | Шаг 7: отверстия под ручку; в админке при **`catalog_scope === 'full'`** — **`HandleHoleDiameterAdminSelect`**, иначе **`FtSelect`**; ориентация и сторона, межосевые; эскиз петель + **`.sketch-handle-pin`**. |
| `calculator/HandleHoleDiameterAdminSelect.tsx` | Админ: справочник диаметров (API **`calculator-handle-hole-diameters`**) — видимость для клиента, добавление/удаление размера. |
| `calculator/Step8FrameResult.tsx` | Шаг 8 «Итог»: сводка, контакты (mailto), цена; **«Открыть PDF…»** — **`buildFrameClientPdfBlob`**, открытие во вкладке через **`window.open('about:blank')`** и **`URL.createObjectURL`**; **`preloadFramePdfFont`** при монтировании. |
| `calculator/frameClientPdf.ts` | Многостраничный PDF (**jspdf**, **jspdf-autotable**); Noto Sans TTF — кэш base64 + **`addFileToVFS`** / **`addFont`** на каждый **`jsPDF`**; загрузка с **`/fonts/NotoSans-Regular.ttf`** или CDN. |
| `calculator/Step2MdfFacade.tsx` / `Step2PvcFacade.tsx` | Заглушки шага 2 для МДФ/ПВХ. |
| `index.css` / `App.css` / `AdminApp.css` | На **десктопе** (широкий экран) у `html/body` при админке — **без** вертикального скролла документа, скролл **внутри** колонок; центральная колонка — `flex` + скролл списка, низ с панелью **сопутствующих** у нижнего края. Для **`#admin-panel-calculator`** — высота/overflow вкладки калькулятора; на шаге 8 — прокрутка **`step8-result__scroll-pack`** в **`Step8FrameResult`**. |

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
- `CalculatorPage.css` — калькулятор: шаги-вкладки, **`.calc-side-panel`**, ширина шага 1, панель **`.calc-totals-*`**, модификатор **`calc-routes-wrap--step8`**.
- `calculator/Step8FrameResult.css` — шаг 8: **`step8-result__scroll-pack`**, печать (`@media print`).
- `calculator/Step2FrameFacade.css` — шаг 2 (рамочный): `frame2`, эскиз `.sketch*`, модалка.
- `calculator/Step3FrameSizes.css` — шаг 3: `frame3`, чертёжные размеры.
- `MaterialExtrasPanel.css`, `HintButton.css` — панель и подсказки.
- `LoginPage.css` — экран входа.
- `App.css` — в т.ч. **`public-shell*`** (шапка публичной страницы).

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
