# Furnitech — прогресс (обновляйте в конце сессии)

Журнал сессий и чеклист; архитектура — [ARCHITECTURE.md](ARCHITECTURE.md).

**Последнее обновление:** 2026-06-28 — шаг 8: несколько фасадов, переключатель, PDF по странице.

### Изменения 2026-06-28 (frontend — шаг 8: несколько фасадов)

#### Сводка

На **шаге 8** калькулятора рамы: несколько фасадов в одном расчёте — **«Добавить фасад»** сохраняет текущий и начинает новый; переключатель вкладок (**Фасад 1**, **Фасад 2**, …) вместо счётчика; **«Изменить»** для редактирования выбранного фасада; **«Удалить»** с подтверждением (последний фасад удалить нельзя). Клик по вкладке делает фасад **текущим** (не только превью); бейдж **ТЕКУЩИЙ** обновляется через подписку на **calc_frame_current_facade_index**. PDF клиента и заказа — **одна страница на фасад**.

#### Изменения

- **`frameSavedFacades.ts`**, **`Step8FacadePanels.tsx`**: хранение сохранённых фасадов, UI переключателя и панелей.
- **`Step8FrameResult.tsx`**, **`Step8FrameResult.css`**: интеграция переключателя, добавление/удаление/редактирование фасадов.
- **`frameCalcSession.ts`**: сессия расчёта и индекс текущего фасада; реактивная подписка для UI.
- **`frameClientPdf.ts`**, **`orderPdfFromSnapshot.ts`**: многостраничный PDF (страница на фасад).

#### Проверка

- `npm run build` — OK.


### Изменения 2026-06-28 (frontend + backend — форма типов: layout и is_active)

#### Сводка

В **CalculatorTypeFormGrid** и **`AdminApp.css`**: поле названия над сеткой, выравнивание тулбаров «Изображения» / «Материалы», равная высота колонок, исправление растягивания списка при большом числе цветов; на материалах кнопка **«Добавить»** вместо «Поиск». Разделено **удаление** строки цвета и **деактивация** (снятие чекбокса → **`is_active=false`**, скрытие у клиента, строка остаётся в админке). Миграция **`0054_calculator_type_material_is_active`**.

#### Изменения

- **CalculatorTypeFormGrid:** название типа над сеткой; тулбары одной высоты; колонки изображений и материалов — equal height; фикс overflow/растягивания списка цветов; **«Удалить»** убирает строку из списка, снятие чекбокса — **`is_active=false`**.
- **Backend:** **`is_active`** на join-таблицах типа калькулятора — **`models.py`**, **`serializers.py`**, миграция **`0054`**; API — **`frontend/src/api.ts`**, типы — **`frontend/src/types.ts`**.
- **Клиент:** фильтрация неактивных цветов — **`Step2FrameFacade`**, **`Step4FrameFilling`**, **`FrameHingeCatalog`**; стили — **`Step2FrameFacade.css`**.

#### Проверка

- `npm run build` — OK.
- После pull: **`py backend\manage.py migrate`** (миграция **`0054`**).


### Изменения 2026-06-28 (frontend + backend — форма типов калькулятора)

#### Сводка

Доработана **CalculatorTypeFormModal** и связанные сетки: полноширинные секции, выравнивание колонок, чеклисты материалов и карточек профиля (до **6** изображений), флаги **Новинка / Хит / Акция** в popover шестерёнки; на бэкенде — поля **`card_image_5/6`** и **`card_texture_5/6`**.

#### Изменения

- **CalculatorTypeFormModal / CalculatorTypeFormGrid:** секции на всю ширину модалки, равные колонки; исправление ширины модалки через повышенную специфичность CSS (**`AdminApp.css`**, **`calculator-type-form-modal`**).
- **Карточки профиля (изображения):** кнопка **«Добавить»**, чеклист до **6** слотов — **`cardImageFormHelpers.ts`**, **`CardImageChecklist`** (в **`CalculatorTypeFormGrid.tsx`**); компактная кнопка снятия изображения в стиле **`admin-primary`**.
- **Backend:** миграция **`0053_calculatorprofiletype_card_image_5_6`** — **`CalculatorProfileType.card_image_5/6`**, **`card_texture_5/6`**; **`models.py`**, **`serializers.py`**, типы во **`frontend/src/types.ts`**; загрузка ассетов шагов — **`calcStepAssetsLoading.ts`**, плитки — **`calculatorCardTiles.tsx`**.
- **Чеклист материалов:** кнопки **«Удалить»**, обрезка подписи до **10** символов; swatch **после** чекбокса; колонки **артикул / наименование** одинаковой ширины; высота кнопки шестерёнки как у **«Удалить»**.
- **Флаги материала/цвета:** **`materialColorFlagsGear.tsx`** — **Новинка / Хит / Акция** в popover на шестерёнке (сетки типов на шагах калькулятора).
- **Шаги калькулятора:** интеграция модалки — **`Step2FrameFacade`**, **`Step4FrameFilling`**, **`FrameHingeCatalog`**.

#### Проверка

- `npm run build` — OK.
- После pull: **`py backend\manage.py migrate`** (миграция **`0053`**).



### Изменения 2026-06-28 (frontend — унификация UI модалок и контролов)

#### Задача

Привести кнопки, шапки и футеры **всех модальных окон** (админка, проводник папок, выбор материалов/текстур, шаги калькулятора) к эталону **CalculatorTypeFormModal**: одинаковые классы, размеры крестика и компактные действия в футере; выровнять чекбоксы шага 7, кнопку удаления в таблице пользователей и «×» на плитках типов.

#### Исправление

- **Кнопки модалок:** закрытие — dmin-primary admin-modal-head-icon-close; **Отмена** — dmin-secondary; основное действие — dmin-primary; футер — dmin-row mat-form-actions. Удалены устаревшие dmin-modal-confirm, dmin-modal-actions.
- **Файлы модалок:** TexturePickerModal, FolderCreateModal, FolderMoveModal, MaterialClassPickModal, MaterialRelatedPickModal, MaterialSearchModal, панели админки (AdminCalculationsPanel, AdminMaterialClassesPanel, AdminOrdersPanel, AdminTexturesPanel, AdminUomPanel).
- **Крестик 24×24:** dmin-modal-head-row (проводник), rame2-modal-head (шаги калькулятора), TexturePickerModal.
- **Компактный футер (~18px):** глобально для .admin-modal-backdrop в **AdminApp.css**.
- **Чекбокс шага 7 (16×16):** как в **MaterialForm** — rame2-checkrow, rame2-flag (+ правки в **Step3FrameSizes.css**, **Step8FrameResult**).
- **Таблица пользователей:** кнопка удаления — order-radius: 10px как у **dmin-logout** (AdminApp.tsx / **AdminApp.css**).
- **Плитки типов:** 	ile-action-remove — те же классы/SVG, что у admin close; непрозрачный фон на плитках — **Step2FrameFacade**, **Step4FrameFilling**, **FrameHingeCatalog**, стили в **Step2FrameFacade.css**.

См. также блок ниже про модалки создания/редактирования типов калькулятора (CalculatorTypeFormModal, CalculatorTypeFormGrid).

#### Проверка

- `npm run build` — OK.

### Изменения 2026-06-28 (frontend — модалки типов калькулятора)

#### Задача

Формы **«+ Добавить тип …»** и **редактирование типа** (⚙) на шагах калькулятора — не inline в боковой панели, а в **отдельных модальных окнах** в стиле карточки материала (`admin-modal-backdrop`, `admin-material-card-dialog`).

#### Исправление

- **`CalculatorTypeFormModal.tsx`** — общая оболочка (портал, шапка с крестиком, **Escape**, футер **Отмена** / **Создать|Сохранить**).
- **`calculator/CalculatorTypeFormGrid.tsx`** — сетка полей **`ProfileTypeFormGrid`** (шаг 2, цвета + флаги New/Hit/Sale) и **`MaterialTypeFormGrid`** (шаги 4 и каталог петель).
- **`Step2FrameFacade`**, **`Step4FrameFilling`**, **`FrameHingeCatalog`**: inline **`frame2-create`** убран; кнопка «+ Добавить…» открывает модалку; редактирование — та же модалка с предзаполнением.
- **`AdminApp.css`**: **`calculator-type-form-modal`** — скролл чеклиста материалов в модалке.

Доступ: только при **`readOnly === false`** (калькулятор в админке `/calculator`, staff и manager). На публичном калькуляторе кнопки скрыты.

#### Проверка

- `npm run build` — OK.

### Изменения 2026-06-28 (frontend — дублирование материала)

#### Задача

В модалке карточки материала (**`section.admin-material-card-dialog`**) — кнопка **«Дублировать»**: открывает форму **нового** материала с предзаполнением всех полей, кроме **артикула** и **наименования** (обязательны и уникальны). Сохранение — **POST** (создание), исходный материал не меняется.

#### Исправление

- **`frontend/src/AdminApp.tsx`**: состояние **`duplicateFrom`**, хелпер **`buildMaterialFormFields`**, проп **`duplicateFrom`** / **`onDuplicate`** у **`MaterialForm`**; кнопка **«Дублировать»** в **`mat-form-actions`** (вкладки «Общие» и «Текстура»); перед открытием копии — **`fetchMaterial`** для полной карточки (сопутствующие, текстура); категория копии — из исходника.

#### Проверка

- `npm run build` — OK.

### Изменения 2026-06-28 (frontend — оверлей загрузки на всю область под шапкой)

#### Задача

Оверлей в «Заказах» и «Пользователях» покрывает всю рабочую зону под `admin-header-top` и `admin-section-tabs`. То же поведение нужно в справочниках, калькуляторе (админ и публичный) и для роли менеджера.

#### Исправление

- **`AdminPanelLoadingOverlay.css`**: `min-height: calc(100dvh - 108px)` и fallback `min-height: 12rem` для всех `#admin-panel-*` и `#public-panel-calculator`; flex-колонка для калькулятора (как у заказов/пользователей).
- **`AdminApp.css`**: удалён дублирующий блок `min-height` только для orders/users — правила централизованы в overlay CSS.

#### Проверка

- `npm run build` — OK.

### Изменения 2026-06-27 (frontend — ширина и зона панелей заказов/пользователей)

#### Задача

Вкладки **«Заказы»** и **«Пользователи»** должны занимать ту же рабочую зону, что и справочник **«Материалы»**: tabpanel на всю доступную область под шапкой, а внутренняя карточка с таблицей — на всю ширину панели. При этом нельзя ломать отображение строк, селектов ролей/статусов и текущую логику загрузки.

#### Исправление

- **`AdminApp.css`**: для `#admin-panel-orders > .admin-orders-placeholder` и `#admin-panel-users > .admin-orders-placeholder` добавлено растягивание по всем колонкам (`grid-column: 1 / -1`, `justify-self: stretch`, `width: 100%`, `box-sizing: border-box`).
- На десктопе `#admin-panel-orders.admin-body` и `#admin-panel-users.admin-body` получают `min-height: calc(100dvh - 108px)`, чтобы зона панели была сопоставима с `#admin-panel-materials`.
- JSX/DOM таблиц **не менялся**: `AdminOrdersPanel`, строки заказов, таблица пользователей, `FtSelect` и флаги загрузки остаются как в рабочем состоянии.

#### Проверка

- `npm run build` — OK.

### Изменения 2026-06-27 (frontend — оверлей загрузки на всю панель)

#### Задача

Пока на экране не догрузились **все** элементы (дерево папок, списки, карточки/плитки шага калькулятора), показывать **один** индикатор загрузки — как в справочниках: **размытие фона** + **спиннер по центру**. Оверлей должен покрывать **всю область панели** (например `#admin-panel-calculator` целиком, включая вкладки шагов), а не отдельную боковую колонку или строку «Загрузка…».

#### Эволюция (2 коммита на `customer`)

| Коммит | Суть |
|--------|------|
| **`cf22aaf`** | Первый проход: заменены текстовые «Загрузка…» на локальные **`AdminPanelLoadingOverlay`** в заказах, пользователях и шагах калькулятора; стили вынесены в **`AdminPanelLoadingOverlay.css`**. |
| **`68a9c3c`** | Архитектура **панельного** оверлея: **`AdminPanelLoadingHost`** агрегирует флаги загрузки от дочерних блоков; локальные оверлеи на карточках шагов убраны. |

#### Архитектура

```
AdminPanelLoadingHost          ← корень #admin-panel-* (position: relative)
├── AdminPanelLoadingOverlay   ← absolute inset:0, blur + спиннер (пока active)
└── PanelLoadingContext
    └── дочерние компоненты → usePanelLoading(key, bool) / PanelLoadingFlags
```

- **`AdminPanelLoadingOverlay.tsx`** + **`AdminPanelLoadingOverlay.css`** — визуал оверлея (shade с `backdrop-filter: blur(12px)`, карточка, CSS-спиннер, `prefers-reduced-motion`).
- **`adminPanelBodyClass(loading, baseClass)`** — добавляет **`admin-body--panel-loading-host`** (`position: relative`) на корень панели.
- **`AdminPanelLoadingHost.tsx`** — обёртка панели: хранит `Record<key, boolean>`, **`active = any(flags)`**; поддерживает **`forwardRef`** (нужен для **`materialsPanelRef`** в материалах).
- **`usePanelLoading(key, loading)`** — регистрация флага внутри хоста; **вне хоста — no-op** (безопасно для тестов/модалок).
- **`PanelLoadingFlags`** — декларативная регистрация **`tree` / `list` / `items` / `route` / `data`** без дублирования хуков в JSX.

Оверлей **не снимается**, пока **хотя бы один** зарегистрированный флаг `true`.

#### Где используется хост

| Панель | ID / класс | Что ждём (флаги) |
|--------|------------|------------------|
| **Материалы** | `#admin-panel-materials` | **`tree`** — дерево + refs (UoM, классы); **`list`** — список материалов выбранной папки / «Все папки» |
| **Текстуры** | `#admin-panel-textures` | **`tree`**, **`items`** — постраничный список текстур |
| **Классы** | `#admin-panel-classes` | **`tree`**, **`list`** |
| **Ед. изм.** | `#admin-panel-uom` | **`list`** |
| **Формулы** | `#admin-panel-calculations` | **`tree`**, **`list`**, **`data`** — загрузка выбранной формулы в редакторе |
| **Заказы** | `#admin-panel-orders` | **`list`** — таблица заказов |
| **Пользователи** | `#admin-panel-users` | **`list`** |
| **Калькулятор (админ)** | `#admin-panel-calculator` | **`data`** — данные активного шага; **`hinges`** — каталог петель (шаг 5); **`route`** — анимация переключения шага (~280 ms) |
| **Калькулятор (публичный)** | `#public-panel-calculator` | те же флаги шагов через **`CalculatorPage`** |

#### Калькулятор: флаг **`data`** по шагам

| Шаг | Условие снятия оверлея |
|-----|------------------------|
| **2** (рамка) | типы профиля загружены **и** сессия localStorage восстановлена (`calcSessionHydrated`) |
| **3** | `fetchCalculatorProfileTypes` завершён |
| **4** | типы наполнения **и** `hydrated` |
| **5** | цвет/профиль (`useFrameColorMaterial`), материал наполнения, строка присадки/петель |
| **6–7** | `useFrameColorMaterial.loading` |
| **8** | профиль/цвет + метаданные (`fetchMaterialClasses`, `fetchCalculationFormulas`) |

**`useFrameColorMaterial`** — добавлено поле **`loading: boolean`** (раньше эскиз мог мигать до прихода полного материала).

**Не блокирует панель:** пересчёт суммы в **`CalcPriceTotals`** (`loading` расчёта формулы) — это фоновый пересчёт, не первичная загрузка UI.

#### Материалы: отдельный флаг списка

Раньше оверлей ждал только **`reloadTree()` + `loadRefs()`**. Список материалов грузился **параллельно без индикатора** → пользователь видел пустую таблицу под уже снятым оверлеем.

Добавлен **`materialsListLoading`**: отдельный `useEffect` на **`selected`** (`fetchMaterialsFiltered` / `fetchMaterials` с `subtree`).

#### Стили

- Основные классы — **`AdminPanelLoadingOverlay.css`** (подключается из компонента оверлея; работает и в админке, и на публичном калькуляторе без **`AdminApp.css`**).
- **`AdminApp.css`**: дублирующие правила **`.admin-panel-loading*`** удалены; оставлен legacy-блок **`.admin-textures-loading*`** (исторический класс; вкладка текстур использует общий оверлей).
- Селекторы **`#admin-panel-* > .admin-panel-loading { z-index: 50 }`** — оверлей поверх содержимого панели.

#### Доступность

- Оверлей: **`role="status"`**, **`aria-live="polite"`**, **`aria-busy="true"`**, **`aria-label`** (настраивается на хосте, напр. «Загрузка калькулятора»).
- Контент панели остаётся в DOM под blur (как в справочниках) — без layout shift от замены «Загрузка…» на таблицу.

#### Проверка

- `npm run build` — OK.
- Деплой на `customer` (`68a9c3c`): визуально — blur на всю `#admin-panel-calculator` до появления плиток; при смене папки материалов — оверлей до загрузки списка; заказы/пользователи — до строк таблицы.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Ядро UI загрузки | **`frontend/src/AdminPanelLoadingHost.tsx`**, **`AdminPanelLoadingOverlay.tsx`**, **`AdminPanelLoadingOverlay.css`** |
| Админка | **`AdminApp.tsx`**, **`AdminTexturesPanel.tsx`**, **`AdminMaterialClassesPanel.tsx`**, **`AdminUomPanel.tsx`**, **`AdminCalculationsPanel.tsx`**, **`AdminOrdersPanel.tsx`**, **`AdminApp.css`** |
| Калькулятор | **`CalculatorPage.tsx`**, **`Step2FrameFacade.tsx`**, **`Step3FrameSizes.tsx`**, **`Step4FrameFilling.tsx`**, **`Step5FrameSummary.tsx`**, **`Step6FrameHingeLayout.tsx`**, **`Step7FrameHandleHoles.tsx`**, **`Step8FrameResult.tsx`**, **`FrameHingeCatalog.tsx`**, **`useFrameColorMaterial.ts`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

### Изменения 2026-06-24 (frontend — шаг 8 «Итог»: wheel/scroll в Chrome)

#### Симптом

На шаге 8 калькулятора колёсико мыши **не прокручивало страницу** в **Chrome**, если курсор над вкладкой **«Итог»**, блоком **«Контактные данные»** (`.step8-result__contact`) или **«Детализация заказа»** (`.step8-result__scroll-pack`). В других браузерах (в т.ч. встроенном в Cursor) поведение могло казаться нормальным.

#### Корневая причина

На десктопе (≥1025px) шаг 8 держал **внутренние scroll-контейнеры** с `overflow-y: auto` и `overscroll-behavior: contain` (`.step8-result__scroll-pack`, `.calc-side-panel-scroll` в левой колонке) плюс цепочку `overflow: hidden` от `.calc-panel-shell` / `.admin` / `.public-shell`. **Chrome** жёстче перехватывает `wheel` такими контейнерами — событие не доходит до **`html`**, хотя по документации проекта прокрутка документа должна быть единой (см. **`desktop-layout.css`**, [ARCHITECTURE.md](ARCHITECTURE.md)).

#### Исправление

- **`Step8FrameResult.css`:** на десктопе у колонок шага 8 — `overflow: visible`, без `max-height`; левая панель контактов — `height: auto`, без внутреннего scroll в `.calc-side-panel-scroll`.
- **`CalculatorPanelShell.css`:** при **`:has(.calc-routes-wrap--step8)`** сняты `overflow: hidden` и flex-ловушки высоты по цепочке `.calc` → `#calc-step-panel-8`; `.step8-result__scroll-pack` — `overflow: visible`.
- **`desktop-layout.css`:** late-overrides step8 — `overflow: visible` (не `overflow-y: auto`).
- **`AdminApp.css`**, **`App.css`:** для шага 8 — `overflow: visible` у `.admin` / `#admin-panel-calculator` и `.public-shell` (исключение из desktop `overflow: hidden`).

Шаги **1–7** без изменений: внутренний scroll в `.calc-routes-wrap` / `.calc-side-panel-scroll` сохранён.

#### Проверка

- `npm run build` — OK.
- В Chrome на шаге «Итог»: wheel над вкладками, формой и детализацией прокручивает **страницу** (полоса прокрутки `html`).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Шаг 8 / scroll | `frontend/src/calculator/Step8FrameResult.css`, `CalculatorPanelShell.css`, `desktop-layout.css`, `AdminApp.css`, `App.css` |
| Документация | `docs/PROGRESS.md`, `docs/ARCHITECTURE.md` |

### Изменения 2026-06-19 (фикс: загрузка текстуры в базу падала у заказчика, не у владельца)

#### Симптом

На вкладке «Текстуры» кнопка «+ Текстура» успешно загружала изображение у владельца, но у заказчика загрузка не проходила («с его компьютера нельзя добавить текстуру в базу»). Один и тот же прод, разные учётные записи/машины — разный результат.

#### Корневая причина (подтверждена по коду)

- `TextureItemViewSet` использует **`DjangoModelPermissions`**: `POST` требует право **`materials.add_textureitem`**.
- Флаг **`is_staff=True`** сам по себе **не даёт** model permissions. Их имеют только **суперпользователь** (обходит проверки — это владелец, созданный `createsuperuser`) и члены группы **«Редактор материалов»**.
- В SPA роль **«админ»** (`AdminUserStaffView`) ставила только `is_staff=True` и **не добавляла** пользователя в группу «Редактор материалов». Поэтому staff-«админ» заказчика **видел** вкладку и список текстур (GET у `DjangoModelPermissions` без права), но получал **403** на «+ Текстура». GET-каталоги работали, отсюда ощущение «всё открывается, но не сохраняется».
- Вторично: 403/сетевые ошибки во фронте показывались как `String(error)` («Error: You do not have permission…») — невнятно, заказчик мог не понять причину.

#### Исправление

**Backend:**
- `materials/user_admin_views.py`: при роли **admin** пользователь теперь добавляется в группу **«Редактор материалов»** (все права приложения `materials`, вкл. `add/change/delete textureitem`), при **manager/user** — корректно удаляется из неё. Константа `EDITOR_GROUP_NAME`.
- Миграция **`0051_editor_perms_backfill_textures`**: идемпотентно выдаёт группе «Редактор материалов» все права `materials` и **бэкфиллит** членство всем действующим `is_staff=True, is_superuser=False` — чинит уже созданные учётки заказчика без переназначения роли. Откат — безопасный no-op (права/членство не отзываются).
- Безопасность не ослаблена: запись текстур остаётся под JWT + model perms; клиенты/менеджеры по-прежнему не могут.

**Frontend:**
- `api.ts` `parseJsonError`: понятные RU-сообщения по статусу — **401** (сессия/вход), **403** (недостаточно прав, нужна роль «Администратор»), **413** (файл слишком большой); перевод частых англоязычных ошибок поля изображения (нераспознанный формат/HEIC, длинное имя файла); ветка «HTML вместо JSON» больше не сбивает на «перезапустите backend» при 401/403/413.
- `AdminTexturesPanel.tsx`: ошибки формы текстуры показываются через `errorText()` — без префикса «Error:», с подсказкой для сетевых/CORS-сбоев («Failed to fetch»).

#### Проверки

- `npm run build`, `npm test` (vitest, 6/6) — зелёные; `manage.py check` — 0 issues; `makemigrations --check --dry-run` — нет недостающих миграций (0051 присутствует).

#### Действия владельцу / что уточнить у заказчика

- После деплоя на Render выполнится `migrate` → миграция 0051 выдаст права существующим staff-админам. Если заказчик — клиент/менеджер (а не «админ»), назначьте ему роль **«Администратор»** на вкладке «Пользователи» (роль admin доступна только суперпользователю).
- Если после этого всё ещё не грузит — попросить заказчика в DevTools → Network посмотреть статус запроса `POST /api/texture-items/`: **403** (права — см. выше), **413** (большой файл — уменьшить до 2–5 МБ), **400 image** (формат: HEIC/непонятный — пересохранить в JPG/PNG), сетевой/CORS («Failed to fetch» — origin/кэш фронта). Уточнить: под какой учётной записью входит (роль), тип и размер файла, точный текст ошибки на форме, браузер.

### Изменения 2026-06-19 (производительность — пасс 2: cold start Render, сжатие, перцептивная скорость)

#### Проблема (прод)

После первого пасса (кэш/дедуп запросов, ленивый PDF, контекст сериализаторов — см. ниже) загрузка материалов/элементов на шагах калькулятора оставалась медленной — пользователь ждал **~7 с**. Кэш убрал повторные запросы внутри сессии, но первый запрос после простоя всё равно долгий.

#### Корневые причины (по убыванию влияния)

1. **Cold start Render Free (доминанта).** Сервис засыпает после ~15 мин простоя; первый запрос будит контейнер + Django + соединение к Supabase — это и есть основные секунды ожидания. Раньше **`healthCheckPath`** указывал на тяжёлый **`/api/calculator-profile-types/`** (запрос к БД), keep-alive отсутствовал.
2. **Ответы API не сжимались.** Справочники (типы профиля/наполнения/петель с вложенными summary материалов и текстурами) шли несжатым JSON по медленному каналу до Render.
3. **Сериализация очереди запросов.** Gunicorn `--workers 2` без потоков: параллельные GET справочников на шаге стояли в очереди к 2 воркерам, пока каждый ждал ответ Supabase.
4. **Старт TLS/DNS к бэкенду откладывался** до первого `fetch` (фронт на Vercel, бэк на Render — разные origin).
5. **Картинки плиток** грузились без `loading="lazy"`; TTL кэша справочников 60 с — при паузе >60 с между шагами шёл повторный тяжёлый запрос.

#### Исправление (код)

- **GZip:** добавлен **`django.middleware.gzip.GZipMiddleware`** (после CORS, до Common) — JSON-ответы API сжимаются.
- **Health/keep-alive:** новый лёгкий **`/healthz`** (и алиасы `/healthz/`, `/api/ping/`) **без обращения к БД** (`backend/config/urls.py`). **`render.yaml`**: `healthCheckPath` → **`/healthz`**. Добавлен workflow **`.github/workflows/keepalive.yml`** (cron каждые 10 мин, пинг по переменной репозитория **`BACKEND_HEALTHCHECK_URL`**; без переменной шаг пропускается).
- **Gunicorn:** start command → `--workers 2 --threads 4 --timeout 120 --preload` (одновременная обработка параллельных GET; быстрее старт и меньше RAM на Free).
- **Preconnect:** в **`main.tsx`** ранний `preconnect`/`dns-prefetch` к **`VITE_API_ORIGIN`** — DNS+TLS к Render открываются до первого запроса.
- **Ленивые картинки:** `loading="lazy"` + `decoding="async"` на плитках (типы профиля/цвета/наполнения/петли, swatch): `calculatorCardTiles.tsx`, `Step2FrameFacade.tsx`, `Step4FrameFilling.tsx`, `FrameHingeCatalog.tsx`, `MaterialCheckSwatch.tsx`.
- **Кэш справочников:** TTL поднят до **5 мин** (**`CATALOG_TTL_MS`** в `apiCache.ts`) для `fetchCalculatorProfileTypes/FillingTypes/HingeTypes`, `fetchMaterialClasses`, `fetchCalculationFormulas` — запись в админке по-прежнему сбрасывает кэш (`clearApiCache`). На шаге 2 — **прогрев** кэша наполнения (шаг 4) и петель (шаг 6), пока выбирают профиль/цвет.

#### Ожидаемый эффект

- Самый большой выигрыш — от **keep-alive** (`/healthz` + внешний пинг): убирает cold start, т.е. большую часть из ~7 с. Требует **действия владельца** (см. ниже).
- GZip + потоки + preconnect + ленивые картинки + долгий TTL сокращают и «тёплую» загрузку, и перцептивную задержку при навигации по шагам.

#### Требуется владельцу (инфраструктура — без этого cold start останется)

1. **Включить keep-alive пинг `/healthz`** одним из способов:
   - **UptimeRobot** (рекомендуется): HTTP(s)-монитор на `https://<render>/healthz`, интервал **5 мин** — самый надёжный.
   - **GitHub Action** (уже в репозитории): задать переменную репозитория **`BACKEND_HEALTHCHECK_URL`** = `https://<render>/healthz` (Settings → Secrets and variables → Actions → Variables). Учтите, что cron GitHub неточен и отключается после 60 дней без активности.
   - Постоянный keep-alive расходует ~720 ч/мес — в пределах Free для **одного** сервиса.
2. **Платный план Render** (Starter) полностью убирает засыпание — радикальное решение, если бюджет позволяет.
3. **Supabase pooler** (`DATABASE_PGBOUNCER=true`, порт 6543) и регион Render ↔ Supabase рядом (Render `frankfurt` ↔ Supabase EU) — минимизируют RTT соединения к БД. **`CONN_MAX_AGE`** уже 600 (переиспользование соединений).
4. **Медиа через CDN** (Supabase Storage / кэш-заголовки) — ускоряет картинки плиток на тёплом сервере.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Backend: GZip, health | **`backend/config/settings.py`**, **`backend/config/urls.py`** |
| Деплой/инфра | **`render.yaml`**, **`.github/workflows/keepalive.yml`** |
| Frontend: TTL/прогрев/preconnect | **`frontend/src/apiCache.ts`**, **`frontend/src/api.ts`**, **`frontend/src/main.tsx`**, **`frontend/src/calculator/Step2FrameFacade.tsx`** |
| Frontend: ленивые картинки | **`frontend/src/calculator/calculatorCardTiles.tsx`**, **`Step4FrameFilling.tsx`**, **`FrameHingeCatalog.tsx`**, **`MaterialCheckSwatch.tsx`** |
| Документация | **`docs/PROGRESS.md`** |

### Изменения 2026-06-19 (производительность — загрузка справочников и UI калькулятора на проде)

#### Проблема (прод)

На проде (Vercel + Render + Supabase) материалы и «элементы» долго грузились на шагах 1–8. Локально быстро, т.к. нет задержек Render (cold start) и Supabase. Корневые причины (по убыванию влияния):

1. **Дублирующиеся тяжёлые запросы на каждом шаге.** На шаге 3 (и аналогично 4–7): **`useFrameColorMaterial`** дёргал **`fetchCalculatorProfileTypes()`** (полный каталог типов со всеми цветами и вложенными summary материалов) + **`fetchMaterial(colorId)`**; тот же **`fetchCalculatorProfileTypes()`** и **`fetchMaterial(colorId)`** повторялись в собственном эффекте шага; блок **`CalcStepPriceTotals`** дополнительно грузил **`fetchMaterialClasses()`** (все страницы), **`fetchCalculationFormulas({active})`** (все страницы), **`fetchCalculatorFillingTypes()`** и ещё раз **`fetchMaterial(colorId/fillId/hingeId)`**. Итого один шаг = до **2×** профиль-типы и **3×** один и тот же материал + полные каталоги классов/формул — и так на каждом шаге заново.
2. **Единый JS-бандл ~1.09 МБ** (gzip 313 КБ): **jspdf/jspdf-autotable/html2canvas** + шрифт Noto попадали в главный чанк и грузились при первом входе, хотя нужны только на шаге 8.
3. **Вложенные summary материалов сериализовались без `request`** → относительные **`/media/...`** URL вместо абсолютных (на проде картинки могли не грузиться/идти не на тот origin).

#### Исправление

- **`apiCache.ts`** (новый): кэш ответов в рамках сессии + дедупликация параллельных запросов (**`cachedJson(key, loader, ttl=60s)`**, **`clearApiCache()`**). Любая запись (POST/PATCH/PUT/DELETE) в **`apiFetch`** сбрасывает кэш — данные после правок в админке остаются актуальными.
- **`api.ts`**: через кэш проходят **`fetchMaterial`**, **`fetchCalculatorProfileTypes`**, **`fetchCalculatorFillingTypes`**, **`fetchCalculatorHingeTypes`**, **`fetchMaterialClasses`**, **`fetchCalculationFormulas`**. Повторные вызовы на том же и следующих шагах берутся из кэша, параллельные — дедуплицируются (1 сетевой запрос вместо 2–3). Поведение и данные идентичны; выбор цвета/наполнения/петель и цены не меняются.
- **Ленивый PDF**: **`Step8FrameResult.tsx`** и **`orderPdfFromSnapshot.ts`** грузят **`frameClientPdf`** (с jspdf/autotable/шрифтом) через **`import()`** только при формировании PDF. **`vite.config.ts`**: **`manualChunks`** для **react-vendor**. Главный чанк упал с ~1.09 МБ (313 КБ gzip) до **597 КБ (151 КБ gzip)**; PDF-стек (~145 КБ gzip) грузится отложенно.
- **Backend**: вложенные **`MaterialSummarySerializer`** в **`CalculatorProfileType/Filling/HingeType`**, **`CalculatorProfile`** и **`_serialize_related_items`** теперь получают **`context`** (request) → абсолютные **`texture_image`** URL на проде. Убран лишний **`.select_related()`** на уже prefetch'нутых связях (**`colors`/`materials`/`companion_items`**) — раньше он сбрасывал prefetch и давал N+1 в списках.

#### Ожидаемый эффект

- Шаги 3–7: число сетевых запросов на навигацию между шагами падает кратно (профиль-типы/классы/формулы/материалы — из кэша). На проде с задержкой Render+Supabase это убирает основные «зависания» при загрузке элементов.
- Первый вход в SPA: initial JS ~ в 2 раза меньше (PDF подгружается только на шаге 8).

#### Остаётся на усмотрение владельца (инфраструктура)

- **Render Free усыпляет сервис** — первый запрос после простоя долгий (cold start). Платный план/health-ping убрал бы холодный старт.
- **Supabase**: использовать pooler (**`DATABASE_PGBOUNCER=true`**) и держать **`CONN_MAX_AGE`** > 0 для переиспользования соединений; проверить регион Render ↔ Supabase (минимизировать RTT).
- **Медиа**: раздавать **`card_image*`/`texture_image`** через CDN (Supabase Storage) и добавить размеры/`loading="lazy"`/кэш-заголовки для плиток.
- **Gzip/Brotli** на ответах API Render (DRF JSON хорошо сжимается).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Кэш/дедуп запросов | **`frontend/src/apiCache.ts`** (новый), **`frontend/src/api.ts`** |
| Ленивый PDF / бандл | **`frontend/src/calculator/Step8FrameResult.tsx`**, **`frontend/src/calculator/orderPdfFromSnapshot.ts`**, **`frontend/vite.config.ts`** |
| Backend сериализаторы | **`backend/materials/serializers.py`** |
| Документация | **`docs/PROGRESS.md`** |

### Изменения 2026-06-19 (frontend — цвет рамки на эскизе, шаги 3–8)

#### Проблема (прод)

На **шаге 2** цвет/текстура рамки фасада на эскизе брались из вложенного **`color_material`** в ответе **`/api/calculator-profile-types/`** (с подгрузкой **`fetchMaterial`** при необходимости). На **шагах 3–7** использовался **только** **`GET /api/materials/{id}/`**; при сбое или пустых **`texture_*`** в детальном ответе рамка оставалась серой (**`#c9c2b8`**), хотя на шаге 2 выбранный цвет был виден.

Дополнительно **`materialTextureLayerStyle`** применял **`tex_opacity`** ко всему слою (включая **`backgroundColor`**); у summary в типе профиля **`tex_opacity`** нет (непрозрачность 1), у полного материала — есть.

#### Исправление

- **`useFrameColorMaterial.ts`**: хук **`useFrameColorMaterial()`** и **`mergeFrameColorMaterial(summary, full)`** — как на шаге 2: summary из типа профиля + полный материал, приоритет непустых **`texture_color`** / **`texture_image`**.
- **`sketchFrame.ts`**: **`profileFrameTextureLayerStyle`** — рамка профиля на эскизе всегда с opacity **1** (опция **`profileFrame`** у **`materialTextureLayerStyle`**).
- Шаги **2–7**: единый источник цвета рамки; шаги **3–7** переведены на хук вместо дублирующих **`useEffect`** с одним **`fetchMaterial`**.
- **Дополнение:** на **шаге 2** выбор **тип профиля + цвет** записывается в **`localStorage`** синхронно при клике по цвету и перед переходом на шаг 3 (**`persistFrameSelection`**), чтобы production-build не уходил на следующий маршрут до записи **`calc_frame_color_id`**.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Эскиз / цвет рамки | **`useFrameColorMaterial.ts`**, **`sketchFrame.ts`**, **`Step2FrameFacade.tsx`**, **`Step3FrameSizes.tsx`**, **`Step4FrameFilling.tsx`**, **`Step5FrameSummary.tsx`**, **`Step6FrameHingeLayout.tsx`**, **`Step7FrameHandleHoles.tsx`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

### Изменения 2026-06-03 (калькулятор шаг 3, админка, PDF, UI)

#### Калькулятор — шаг 3 (габариты рамки)

- Блок **«Ограничение по размерам»**: если у материала не заданы min/max (`0` или пусто в БД), в подписи показывается **«—»**, а не дефолт **99999×99999** и не нули.
- Парсинг лимитов: **`parsePositiveMaterialDim`** (экспорт из **`frameCalcSession.ts`**); отображение: **`formatFrameMaterialDimLimitDisplay`**.
- Ввод и валидация по-прежнему используют **`effectiveFrameDimMax`** (внутренний fallback 99999 мм без изменений).

#### Терминология «сопутствующие материалы»

- Расшифровка цены (**`CalcPriceBreakdownView`**), PDF бланка (**`frameClientPdf.ts`**), панель сопутствующих в карточке материала (**`MaterialExtrasPanel`**).
- Админка: подсказки строки материала в списке (**`AdminApp.tsx`**).

#### Админка — закрытие карточек после сохранения

- **Материал:** после успешного сохранения карточка закрывается (**`onClose`** в **`MaterialForm`**); список обновляется без повторного открытия редактора.
- **Текстуры:** после create/update карточка закрывается (**`TextureCardForm`**); аналогично убран **`setEditing`** после сохранения в списке (**`AdminTexturesPanel`**).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Шаг 3 | **`Step3FrameSizes.tsx`**, **`frameCalcSession.ts`** |
| Расчёт / PDF | **`CalcPriceBreakdownView.tsx`**, **`frameClientPdf.ts`**, **`MaterialExtrasPanel.tsx`** |
| Админка | **`AdminApp.tsx`**, **`AdminTexturesPanel.tsx`** |
| Документация | **`docs/PROGRESS.md`** |

### Изменения 2026-06-01 (безопасность, API, админка, PDF, UI)

#### Безопасность и API

- **Open redirect:** после входа/регистрации — только безопасные относительные пути (`postLogin.ts`: `safePostLoginTarget`, `safePreLoginReturnPath`; `RegisterPage`, `App.tsx`).
- **Пользователи:** назначение роли **admin** и **DELETE** учётной записи — только **superuser** (`user_admin_views.py`, вкладка «Пользователи» в `AdminApp.tsx`).
- **Классы материалов:** анонимный **GET** `/api/material-classes/` — коды классов для расчёта по формулам у гостя на `/` (`MaterialClassViewSet`, `ARCHITECTURE.md`).
- **Production:** при `DEBUG=False` без своего `DJANGO_SECRET_KEY` — ошибка конфигурации при старте (`settings.py`).
- **Импорт XML:** разбор загрузки через **`defusedxml`** (`material_import_export.py`, `requirements.txt`).
- **Экспорт:** текст исключения в ответе 500 — только при `DEBUG`.
- Ручной аудит Django/React: критичных уязвимостей (SQLi, CSRF, XSS, XXE, privilege escalation) не выявлено; Vitest проходит.

#### Админка (UI)

- **Загрузка панелей:** **`AdminPanelLoadingHost`** + **`AdminPanelLoadingOverlay`** — один оверлей на **всю** область `#admin-panel-*` (blur + спиннер), пока **любой** дочерний блок сообщает загрузку через **`usePanelLoading`** / **`PanelLoadingFlags`**. Стили — **`AdminPanelLoadingOverlay.css`**. Панели: материалы (дерево + список), текстуры, классы, ЕИ, формулы, заказы, пользователи, калькулятор (админ и публичный `#public-panel-calculator`). Подробнее — [PROGRESS.md](PROGRESS.md) (2026-06-27).
- **Подсказки «i» убраны** там, где дублировали очевидный UI или заглушки: «Папки текстур» (`AdminTexturesPanel`), шаг 2 МДФ/ПВХ (`Step2MdfFacade`, `Step2PvcFacade`). На вкладке «Настройки калькулятора» и в карточках клиента подсказки сохранены.

#### PDF и эскиз

- **`sketchFrame.ts`:** константы и хелперы CSS-эскиза (`SKETCH_*`, `facadeSketchPxToMm`, `facadeSketchPaperInsetMm`) — единый источник для экрана и PDF.
- **`frameClientPdf.ts`:** эскиз на бланке ближе к калькулятору (inset листа/бумаги, уголки, зеркало текстуры `tex_mirror`); дублирующая логика aspect/inset вынесена в `sketchFrame`.

#### Документация

- `ARCHITECTURE.md`, `DEPLOY.md`, `PLAN.md`, `README.md` — согласованы с правами API и `defusedxml`.
- Лаконичные шапки в `settings.py`, `views.py`, `api.ts`, `auth.ts`.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Безопасность / API | `postLogin.ts`, `RegisterPage.tsx`, `App.tsx`, `settings.py`, `views.py`, `user_admin_views.py`, `material_import_export.py`, `requirements.txt` |
| Админка | `AdminPanelLoadingOverlay.tsx`, `AdminApp.tsx`, `AdminTexturesPanel.tsx`, `AdminCalculationsPanel.tsx`, `AdminMaterialClassesPanel.tsx`, `AdminUomPanel.tsx`, `AdminApp.css` |
| Калькулятор | `Step2MdfFacade.tsx`, `Step2PvcFacade.tsx` |
| PDF / эскиз | `sketchFrame.ts`, `frameClientPdf.ts` |
| Документация | `docs/PROGRESS.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOY.md`, `docs/PLAN.md`, `README.md` |

**Ранее:** 2026-05-30 — PDF заказа из snapshot (как шаг 8).

### Изменения 2026-05-30 (frontend — PDF заказов = генератор шага 8)

#### Поведение

- **`orderPdfFromSnapshot.ts`**: по **`snapshot`** заказа заново собирается **`buildFrameClientPdfBlob`** (текстуры материалов подгружаются по `id`, эскиз с цепочками, таблица цен).
- **Админка «Заказы»** и **«Мои заказы»**: кнопка **«Открыть PDF»** вызывает тот же PDF, что на шаге 8; файл с сервера (`pdf_url`) — только запасной вариант **«PDF (архив)»** без snapshot.
- В бланке для заказа в поле **«Заказ №»** подставляется **`order_number`** (`З-000001`), а не случайный номер предпросмотра.

#### Файлы

- **`orderPdfFromSnapshot.ts`**, **`AdminOrdersPanel.tsx`**, **`PublicClientPages.tsx`**, **`frameClientPdf.ts`**

### Изменения 2026-05-30 (frontend — система расчёта: формулы + классы + избыток + петли)

#### Поведение

- Модуль **`priceBreakdown.ts`**: строки **`MaterialLineBreakdown`** (геометрия на фасад → × N → × **коэффициент избытка** → округление → × цена); **`buildHingeMaterialLine`** (шт/фас × число фасадов).
- **`computeFramePriceBreakdown`**: профиль, наполнение, сопутствующие, **`hinges`**; формулы — тот же движок + **`hingeSubtotalOutsideFormula`** (петли вне токенов формулы прибавляются к итогу).
- **`evaluateCalculationFormulaWithBreakdown`**: итог формулы + **`classSteps`**; в сумму класса попадают **только выбранные** материалы калькулятора и их **`related_items`**, не весь справочник класса.
- Калькулятор: **`fetchCalculationFormulas({ active: true })`**; UI **`CalcPriceBreakdownView`**.
- **Шаг 3:** наполнение **не** в расчёте (**`includeFillingInPrice: false`**); подсказка «после шага 4». При **смене цвета** на шаге 2 сброс **`calc_filling_*`**.
- **Шаги 5–8:** **петли производства** в расчёте (**`includeHingesInPrice`**): выбранный материал + сопутствующие; количество — **`readHingeLayout().count`** (шаг 6), до раскладки — минимум **2** на фасад. «Петли заказчика» — без цены.
- PDF и **`snapshot`**: расшифровка; колонка **«Петли»** в таблице стоимости при **`hinges > 0`**.
- Админка «Расчёты»: чекбокс **«Активна»**, предупреждение при нескольких активных формулах; в поле формулы — **код класса** (`mc13`), не «Класс: …».
- Карточка материала: подсказки у **режима расчёта** и **коэффициента избытка**.
- Тесты: **`priceBreakdown.test.ts`** (Vitest, **`npm test`**).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Движок | **`priceBreakdown.ts`**, **`calculationFormula.ts`**, **`framePriceEstimate.ts`**, **`frameCalcSession.ts`** |
| UI | **`CalcPriceBreakdownView.tsx`**, **`CalcPriceTotals.tsx`**, **`CalculatorPage.tsx`**, **`Step2FrameFacade.tsx`**, **`Step8FrameResult.tsx`**, **`CalculatorPage.css`**, **`Step8FrameResult.css`** |
| PDF / заказ | **`frameClientPdf.ts`** |
| Админка | **`AdminCalculationsPanel.tsx`**, **`AdminApp.tsx`** |
| Сборка | **`package.json`**, **`vite.config.ts`** |
| Документация | **`docs/CALCULATION_FORMULAS.md`**, **`docs/ARCHITECTURE.md`**, **`docs/PROGRESS.md`** |

**Последнее обновление (ранее):** 2026-05-28 — PDF бланка: габарит ширины, выноска высоты, без заголовка «Эскиз».

### Изменения 2026-05-28 (frontend — PDF: ширина ближе к эскизу, правки выносок)

#### Поведение

- Убрана надпись **«Эскиз (примерный)»** над эскизом на бланке (**`buildBlankPage`**).
- **Высота (H):** горизонтальные пунктирные выноски только **до вертикального отрезка** (`vCenterX`), без лишнего продления за линию.
- **Ширина (W):** размерная линия и подпись **вдвое ближе** к эскизу (**`MAIN_WIDTH_DIM_GAP_FRAC`**, **`pdfMainWidthLabelPadMm`**); пунктир укорачивается вместе с отрезком.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| PDF | **`frameClientPdf.ts`**, **`pdfSketchDimsDraw.ts`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

**Последнее обновление (ранее):** 2026-05-28 — PDF: подгонка зазоров подписей и дорожек цепочек.

### Изменения 2026-05-28 (frontend — PDF: зазоры подписей и цепочек на бланке)

#### Поведение

- **Цепочки петель/ручек** на **50%** ближе к эскизу (**`CHAIN_DIM_OFFSET_FRAC`**): пунктирная выноска и размерная линия на одной оси (без разрыва).
- **Подписи цепочек:** общий зазор для ручек (верх/низ); для **петель слева/справа** — отдельный минимальный зазор (**`pdfChainVertHingeLabelPadMm`**); параметр **`chainKind`** у **`pdfDrawHingeChainDims`** (`hinge` / `handle`).
- **Габариты H×W:** увеличен зазор цифр от сплошной линии (**`pdfMainLabelPadMm`**, **8px** как в UI).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| PDF | **`pdfSketchDimsDraw.ts`**, **`frameClientPdf.ts`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

**Последнее обновление (ранее):** 2026-05-28 — PDF шага 8: размеры и текстуры эскиза как в калькуляторе.

### Изменения 2026-05-28 (frontend — PDF: размерные цепочки и текстуры эскиза)

#### Поведение

- На бланке (**`dimsOutsideSketch: true`**) эскиз **не уменьшается** под размеры: рамка фасада занимает ту же область справа; цепочки и габариты рисуются **снаружи** рамки (**`pdfSketchDimsDraw.ts`** — пунктир выносных, стрелки, зазоры как в UI по **`sketchHeightMm`**).
- Включены **цепочки размеров** петель и ручки + главные **H×W** (та же логика, что шаги 6–7: **`computeHingeChainDims`**, **`layoutHingeChainDimsWithNudge`**, **`sketchMainDimPlacement`**, **`formatSketchDimMm`**).
- **Текстуры** в PDF совпадают с калькулятором: **`pdfDrawMaterialTextureLayer`** — **`texture_color`** + **`texture_image`** через **`resolveMediaUrl`** / **`loadImageDataUrl`**; рамка профиля на весь периметр, наполнение — белое поле + текстура с **`SKETCH_FILLING_TEXTURE_OPACITY` (0.18)**; непрозрачность — **`sketchMaterialOpacity`** в **`sketchFrame.ts`**.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| PDF | **`frameClientPdf.ts`**, **`pdfSketchDimsDraw.ts`** |
| Эскиз (общая логика) | **`sketchFrame.ts`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

**Последнее обновление (ранее):** 2026-05-28 — PDF шага 8: один альбомный лист, эскиз справа на бланке.

### Изменения 2026-05-28 (frontend — PDF шага 8: один лист, компактный бланк)

#### Поведение

- **`buildFrameClientPdfBlob`** формирует **одну страницу** A4 **альбомной** ориентации (`orientation: 'landscape'` в **`PDF_DOC_OPTS`**).
- **Отдельные листы «Фасад № N — эскиз»** убраны: эскиз перенесён в **правую колонку** первой страницы (**`drawFacadeSketchInArea`**), слева — компактные таблицы бланка.
- Таблицы бланка: узкие колонки (**46 + 68 мм**), шрифт **8 pt**; блок стоимости и **подписи** («Оплату принял», «Товар получен…») **на том же листе** — подписи закреплены у нижнего края, без **`addPage`** / переноса.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| PDF | **`frontend/src/calculator/frameClientPdf.ts`** |

**Последнее обновление (ранее):** 2026-05-27 — светлая тема по умолчанию (публичный сайт и админка).

### Изменения 2026-05-27 (frontend — тема по умолчанию: light)

#### Поведение

- Без записи в **`localStorage`** (`furnitech-theme`) приложение стартует в **светлой** теме (раньше — тёмной).
- **`readStoredTheme()`** в **`theme.ts`** возвращает **`'light'`**, если в storage нет **`light`** / **`dark`**.
- **`index.html`**: на **`<html>`** — **`data-theme="light"`**; inline-скрипт до React: **`dark`** только при явном **`furnitech-theme=dark`**; **`theme-color`** / **`color-scheme`** — для светлого UI.
- Переключатель **`ThemeToggle`** по-прежнему сохраняет выбор пользователя.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Тема | **`frontend/src/theme.ts`**, **`frontend/index.html`** |
| Документация | **`docs/PROGRESS.md`** |

**Последнее обновление (ранее):** 2026-05-27 — админка «Заказы» и «Пользователи»: вёрстка таблицы, светлая тема статусов.

### Изменения 2026-05-27 (frontend — админка: заказы и пользователи, UI)

#### Таблица «Заказы»

- Селекты статуса и оплаты: фиксированная высота триггера **36px** (`min-height` на **`.ft-select-trigger`**).
- Кнопка **«Удалить»** — та же высота **36px**, **`inline-flex`** по центру.
- Ссылка **«Открыть PDF»** — ячейка **`admin-orders-pdf-cell`**, **`vertical-align: middle`** вместе с колонками статусов.

#### Светлая тема

- Для **`[data-theme='light']`** у **`admin-orders-status-ft--*`** — тёмный текст на светлом фоне (красный / жёлто-коричневый / синий / зелёный / серый); базовые пастельные цвета оставлены для тёмной темы.

#### Пользователи

- Убрана подсказка **`HintButton`** у заголовка **«Пользователи»** (роли уже видны в **`FtSelect`**).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Стили / разметка | **`AdminApp.css`**, **`AdminOrdersPanel.tsx`**, **`AdminApp.tsx`** |
| Документация | **`docs/PROGRESS.md`** |

**Последнее обновление (ранее):** 2026-05-27 — роль «Менеджер», статус оплаты заказов, текстуры карточек калькулятора, чёрная нумерация отверстий ручки на эскизе.

### Изменения 2026-05-27 (backend + frontend — менеджеры, оплата заказов, текстуры карточек)

#### Роль «Менеджер»

- Миграция **`0049_managers_group`**: группа Django **`Менеджеры`** с правами **`view_facadeorder`**, **`change_facadeorder`**.
- **`GET /api/auth/me/`** и список пользователей админки: поле **`is_manager`** (членство в группе).
- **`PATCH /api/admin/users/{id}/staff/`** (совместимо со старым телом): вместо только **`is_staff`** — роль **`role`**: **`user`** | **`manager`** | **`admin`**. Менеджер: **`is_staff=false`**, в группе «Менеджеры»; админ: **`is_staff=true`**, без группы.
- **`FacadeOrderViewSet`**: менеджер может **PATCH** **`status`** и **`payment_status`**; **DELETE** — только staff/superuser. Список всех заказов в админке — **`GET /api/facade-orders/?scope=admin`** (staff, superuser или менеджер); без **`scope=admin`** клиент и менеджер вне админ-списка видят только свои заказы.
- **SPA:** **`AdminRoute`** пускает менеджера; после логина редирект на **`/orders`**; вкладки справочников и «Пользователи» скрыты; доступны **«Заказы»** и **«Калькулятор»**; удаление заказов отключено (**`AdminOrdersPanel canDelete={false}`**). В публичной шапке — ссылка «Войти как менеджер» и выход.

#### Статус оплаты заказа

- Миграция **`0048_facadeorder_payment_status`**: **`FacadeOrder.payment_status`** — **`unpaid`** | **`partial`** | **`paid`** (по умолчанию не оплачен).
- API: в ответе **`payment_status`**, **`payment_status_display`**; staff/manager PATCH — вместе со **`status`** (**`FacadeOrderStaffUpdateSerializer`**).
- Админка **«Заказы»**: колонка «Статус оплаты», цветные **`FtSelect`** (классы **`admin-orders-status-ft--pay-*`** в **`AdminApp.css`**).

#### Картинки карточек калькулятора из базы текстур

- Миграция **`0050_calculator_card_textures`**: у **`CalculatorProfileType`**, **`CalculatorFillingType`**, **`CalculatorHingeType`** — поля **`card_texture` … `card_texture_4`** (FK **`TextureItem`**), параллельно файлам **`card_image` … `card_image_4`**.
- Сериализаторы: **`card_texture_image` … `card_texture_4_image`** (абсолютный URL); при сохранении загруженного файла текстура слота сбрасывается (**`apply_calculator_card_image_texture_exclusivity`**).
- ViewSet’ы типов: **`select_related`** на текстуры карточек.
- Фронт: **`calculatorCardTiles.tsx`** — приоритет превью текстуры над файлом; **`appendCalcCardTexturesToFormData`**; шаги **2 / 4 / 5** и формы типов в **`AdminApp`** — выбор из базы текстур на каждый из 4 слотов.

#### Эскиз (шаг 7)

- **`.sketch-handle-pin-label`**: цвет подписей **№1…№n** — **`--ft-canvas-hinge-label`** (чёрный, как у петель), вместо **`--ft-btn-primary-text`**.

#### Проверка после деплоя

- **`python manage.py migrate`** (миграции **0048–0050**).
- Войти менеджером → только заказы + калькулятор; PATCH статуса и оплаты; без удаления.
- В админке типов профиля/наполнения/петель — привязка текстуры к слоту карточки, отображение в плитках калькулятора.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Backend | **`models.py`**, **`serializers.py`**, **`views.py`**, **`auth_views.py`**, **`user_admin_views.py`**, **`admin.py`**, **`migrations/0048_*`**, **`0049_*`**, **`0050_*`** |
| API / auth SPA | **`api.ts`**, **`auth.ts`**, **`types.ts`** |
| Админка | **`AdminApp.tsx`**, **`AdminApp.css`**, **`AdminOrdersPanel.tsx`**, **`App.tsx`** |
| Калькулятор | **`calculatorCardTiles.tsx`**, **`Step2FrameFacade.tsx`**, **`Step4FrameFilling.tsx`**, **`FrameHingeCatalog.tsx`**, **`Step3FrameSizes.css`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

**Последнее обновление (ранее):** 2026-05-27 — PDF шага 8: бланк заказа как производственная форма + эскиз Step7 с размерами.

### Изменения 2026-05-27 (frontend — PDF шага 8: бланк заказа и эскиз с размерами)

#### Что изменено

- **`frameClientPdf.ts`** переработан под «Бланк на изготовление алюминиевых фасадов»: первая страница теперь похожа на производственный бланк со строками **Заказ №**, **Заказчик**, **Телефон**, **Email**, **Дата приёма**, профиль/цвет/наполнение, габариты, количество, петли, ручка, комментарий, стоимость и подписи.
- Поля заказа и заказчика заполняются автоматически из данных, которые клиент вводит на шаге 8, и из состояния калькулятора: выбранный профиль, цвет профиля, наполнение, **В × Ш**, количество фасадов, присадка/петли, раскладка петель и отверстия под ручку.
- *(Устарело с 2026-05-28:)* ранее добавлялись отдельные листы «Фасад № N» с полным эскизом; сейчас эскиз только **справа на бланке** (см. блок **2026-05-28** выше).
- Размерные цепочки в PDF оставлены на той же логике, что и UI: **`computeHingeChainDims`**, **`layoutHingeChainDimsWithNudge`**, **`sketchMainDimPlacement`**; главные габариты используют отдельный зазор **`PDF_MAIN_DIM_GAP_MM`**, а цепочки петель/ручек — **`PDF_CHAIN_SKETCH_GAP_MM`**.
- Добавлена поддержка жирного Noto Sans в PDF при наличии **`public/fonts/NotoSans-Bold.ttf`** или CDN; если bold не загрузился, PDF остаётся на обычном Noto Sans без поломки кириллицы.
- Кнопка **«Отправить»** на шаге 8 сохраняет заказ через **`POST /api/facade-orders/`** (multipart: `pdf_file`, `snapshot`, `contact_*`). После успеха показывается центрированное сообщение **«Заказ отправлен»** (без навигации).
- Заказ появляется у клиента во вкладке **`/my-orders`** (требуется вход клиентом) и у сотрудников в админке во вкладке **«Заказы»**.

#### Проверка

- **`npx tsc -b`** в **`frontend/`** — успешно.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| PDF клиента | **`frontend/src/calculator/frameClientPdf.ts`** |
| Документация | **`docs/PROGRESS.md`** |

**Последнее обновление (ранее):** 2026-05-27 — шаг 8 «Итог»: детализация справа от формы контактов (публичный и админский калькулятор).

### Изменения 2026-05-27 (frontend — шаг 8: две колонки «Итог» | детализация)

#### Проблема

- На шаге 8 панель **«Детализация заказа (фасады)»** (**`.step8-result__details`**, **`.step8-panel`**) отображалась **под** блоком **«Итог»** (**`.step8-result__contact`**), хотя в **`Step8FrameResult.css`** задана grid-раскладка из двух колонок.
- Причина: в **`CalculatorPanelShell.css`** (≥1025px, **`.calc-panel-shell #calc-step-panel-8`**) у **`.frame2.step8-result`** стояло **`display: flex; flex-direction: column`**, что перекрывало grid и складывало секции вертикально (и в **`#public-panel-calculator`**, и в админке).

#### Решение

- **`CalculatorPanelShell.css`:** **`display: grid`**, **`grid-template-columns: minmax(0, var(--calc-steps-tabs-width, 400px)) minmax(0, 1fr)`**, **`gap: 1.25rem 1.75rem`** — как в **`Step8FrameResult.css`**.
- Явное размещение: **`step8-result__contact`** — **`grid-column: 1`**, **`step8-result__details`** — **`grid-column: 2`**; прокрутка правой колонки (**`step8-result__scroll-pack`**) сохранена.
- На ≤1024px по-прежнему одна колонка (**`Step8FrameResult.css`** **`@media (max-width: 1024px)`**).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Вёрстка шага 8 | **`CalculatorPanelShell.css`** |
| Компонент | **`Step8FrameResult.tsx`** (без изменений разметки) |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

**Последнее обновление (ранее):** 2026-05-27 — главные габариты (Ш/В) эскиза прижаты к чертежу на 50%; цепочки петель/ручек не тронуты.

### Изменения 2026-05-27 (frontend — главные габариты эскиза ближе к нему на 50%)

#### Что и где

- **`.frame3-dim-drawing--top/--bottom/--left/--right`** — общий габарит ширины и высоты на эскизе (шаги 3, 5, 6, 7) — теперь стоит **вдвое ближе** к рамке фасада.
- **Цепочки петель/ручек** (**`.hinge-chain-dim`**, слой **`.frame3-hinge-dim-layer`**) — зазор сохранён как был (требование заказчика).

#### Реализация

- Прежняя «мостовая» связка **`--hinge-chain-sketch-gap: var(--frame3-dim-sketch-gap-y)`** ломала независимость зазоров — изменение габаритов утаскивало за собой и цепочки.
- Введён отдельный токен **`--frame3-chain-sketch-gap`** на **`.frame3-drawing`**: хранит **исходные** значения (30/26/22 по breakpoints), цепочки читают его через **`--hinge-chain-sketch-gap: var(--frame3-chain-sketch-gap)`**.
- Значения **`--frame3-dim-sketch-gap-y/x`** уменьшены вдвое:
  - десктоп (**`Step3FrameSizes.css`** базовый, **`desktop-layout.css`**): **30 → 15**, **28 → 14**;
  - **`@media (max-width: 1024px)`** (**`Step3FrameSizes.css`**): **26 → 13**, **22 → 11**;
  - **`@media (max-width: 640px)`** (**`mobile.css`**): **22 → 11**, **18 → 9**.
- **`--frame3-dim-vtrack`** не менялся: это длина пунктирной выноски (визуальная), а не сам зазор.
- В **`@media (max-width: 1024px)`** и mobile-блоке `--frame3-chain-sketch-gap` дублирует исходное значение габаритов (26/22), чтобы цепочки на разных размерах экрана остались как раньше.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Стили эскиза | **`Step3FrameSizes.css`** |
| Десктоп-лейаут | **`desktop-layout.css`** |
| Мобильный лейаут | **`mobile.css`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

**Последнее обновление (ранее в сессии):** 2026-05-27 — эскиз: плотный зазор подпись ↔ линия у ручек и габарита высоты (как у петель); общий модуль цепочек размеров.

### Изменения 2026-05-27 (frontend — зазор подписи ↔ отрезок, шаги 6–7)

#### Проблема (шаг 7: ручки и габарит «3000 мм»)

- **Горизонтальные цепочки** (ручки сверху/снизу, **`.hinge-chain-dim__val--h`**): подпись цеплялась за **`top: 0`** / **`bottom: 0`** контейнера (**`height: 1.65rem`**), а отрезок **`.hinge-chain-dim__h`** проходит по **центру** — к **`--hinge-chain-label-gap` (8px)** добавлялась половина высоты контейнера (~13px), визуально ~21px.
- **Боковой габарит высоты** (**`.frame3-dim-drawing__value--side`**): grid **`1fr + auto`** в **`__left-col`** резервировал ~54px под повёрнутую цифру при визуальной ширине ~14px — до v-линии оставалось ~27px пустоты (в отличие от петель слева/справа).

#### Решение (`Step3FrameSizes.css`)

- **`__val--h`**: **`top: 50%`** + **`translate(-50%, calc(-50% ∓ var(--hinge-chain-label-gap)))`** — опора на центр отрезка (симметрично вертикальным **`.hinge-chain-dim--v .hinge-chain-dim__val`**).
- **`__value--side`**: **`__left-col`** без grid; **`__v`** и подпись — **`position: absolute`**; подпись **`right/left: calc(2px + 4px + var(--frame3-dim-label-gap))`** + **`translate(±50%, -50%) rotate(±90deg)`** — тот же приём, что у петель (**6px** = центр v-линии в колонке **8px**).

#### Рефакторинг (шаги 6–7)

- Вынесены **`hingeChainSketchDims.tsx`**: **`computeHingeChainDims`**, **`layoutHingeChainDimsWithNudge`**, **`useHingeChainSketchDims`**, **`HingeChainDimLayer`**, **`sketchMainDimPlacement`**, **`formatSketchDimMm`**.
- **`Step6FrameHingeLayout.tsx`** и **`Step7FrameHandleHoles.tsx`** используют общий слой вместо дублирования разметки цепочек.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Стили эскиза | **`Step3FrameSizes.css`** |
| Цепочки размеров | **`hingeChainSketchDims.tsx`** |
| Шаги 6–7 | **`Step6FrameHingeLayout.tsx`**, **`Step7FrameHandleHoles.tsx`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

### Изменения 2026-05-27 (frontend — подписи размеров на эскизе, ранее в сессии)

#### Исправление подписей петель (шаг 6, стороны лево / право)

- **Проблема:** подписи **`.hinge-chain-dim__val`** позиционировались через **`right/left: calc(100% + 2px)`** — уходили за пределы узкого контейнера (**`width: 1.35rem`**) и после **`rotate(±90deg)`** оказывались столбиком **слева от всех** размерных линий, а не над своими отрезками. Для **`.hinge-chain-dim--tracked`** override (**`12px + 2px/10`**) тоже не центрировал текст по линии.
- **Решение:** центр подписи выравнивается с центром **`.hinge-chain-dim__v`** (**`width: 12px`**, центр на **6px** от кромки контейнера): **`right/left: calc(6px + var(--hinge-chain-label-gap))`** + **`translate(±50%, -50%)`** + **`rotate(±90deg)`** — тот же приём, что у горизонтальных меток **`.hinge-chain-dim__val--h`** (**`left: 50%` + `translateX(-50%)`**).
- Отдельные CSS-override для **`.hinge-chain-dim--tracked .hinge-chain-dim__val`** сняты: при **`trackOffsetPx > 0`** сдвигается весь контейнер и выноски (**`--hinge-chain-track-offset`**), размерная линия в контейнере на месте.

#### Единый зазор «подпись ↔ размерная линия» (шаги 3–7)

- На **`.frame3-drawing`** — токен **`--frame3-dim-label-gap: 8px`** (наружу от эскиза).
- **Габариты H×W** (**`.frame3-dim-drawing--top/bottom`**, **`__left-col`**) — **`gap`** вместо **10px / 5px**.
- **Цепочки петелей** — **`--hinge-chain-label-gap: var(--frame3-dim-label-gap)`**; горизонтальные подписи (**`__val--h`**, top/bottom) — **`3px`** заменены на тот же токен.
- Маркеры петель/ручки (**`.sketch-hinge-pin-stack`**, **`.sketch-handle-pin-stack`**) не менялись — там зазор «тело ↔ №n», не чертёжная подпись.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Стили эскиза (шаги 3–7) | **`Step3FrameSizes.css`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

**Последнее обновление (ранее):** 2026-05-25 — шаг 6: дорожки размеров (№1 и №n на одном отступе), позиционирование треков `trackTopPct`/`trackSpanPct`, подписи №2+ у линии.

### Изменения 2026-05-25 (frontend — шаг 6: дорожки размеров и треки на эскизе)

#### Позиционирование размерных треков

- **`Step6FrameHingeLayout.tsx`:** сегменты **`hingeChainDims`** — поля **`trackTopPct`** / **`trackSpanPct`** вместо неявных `t0`/`t1`:
  - **№1** (от начала кромки): `trackTopPct = 0`, `trackSpanPct = hingePct`;
  - **№2…№n** (от противоположного края): `trackTopPct = hingePct`, `trackSpanPct = 100 − hingePct`.
- В JSX **всегда** `top` + `height` (доля %), **без** `bottom: 0` для разных петель — горизонтальная выноска на петлю (**`.hinge-chain-dim__wit--start`**, `top: 0` внутри трека) совпадает с координатой петли.
- **Верх/низ:** `left: trackTopPct`, `width: trackSpanPct`; **лево/право:** `top: trackTopPct`, `height: trackSpanPct`.

#### Дорожки (`trackOffsetPx`) — все стороны

- Петли **№2…№n** (от противоположного края) сортируются по **`positionsMm`** по возрастанию; rank **`endCount − 1 − i`**:
  - **№1** и **последняя петля (№n)** — **`trackOffsetPx = 0`** (одинаковый отступ от эскиза);
  - **№2…№n−1** — ступени **`1…n−2`** × **26px** дальше от эскиза (лево/право — `translateX`, верх/низ — `translateY`).
- Шаг дорожки: **26px**; CSS-переменная **`--hinge-chain-track-offset`** на выносках **`.hinge-chain-dim__wit`**.

#### Подписи размеров (лево / право)

- Класс **`.hinge-chain-dim--tracked`** при **`trackOffsetPx > 0`**: подпись **`.hinge-chain-dim__val`** у вертикальной линии (**`12px + 2px/10`**), не у внешнего края дорожки.

#### Не используется (откат)

- Отдельные блоки **`.hinge-chain-dim--from-end-pin`**, якорь **`bottom: 0`**, **`translateY(-50%)`** на выносках — сняты как ломавшие выравнивание.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Шаг 6 | **`Step6FrameHingeLayout.tsx`** |
| Стили эскиза | **`Step3FrameSizes.css`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

### Изменения 2026-05-25 (frontend — шаг 6: расстояния петель и эскиз)

#### Семантика расчёта (поля ввода и `localStorage`)

- **`frameCalcSession.ts`:** вместо «пар» (№1/№n от краёв, №2/№n−1 …) — **№1 только от начала** стороны, **№2…№n — от противоположного края**:
  - сторона **лево / право** → №1 **сверху**, остальные **снизу**;
  - сторона **верх / низ** → №1 **слева**, остальные **справа**.
- **`hingeMeasuresFromEdgeStart(i, count)`** — `true` только для **`i === 0`** (при `count > 1`).
- **`hingeUserInputsToAbsoluteMm`** / **`hingeAbsoluteToUserInputStrings`** — без изменения формата хранения: в **`calc_hinge_layout`** по-прежнему **`positionsMm`** (абсолютные мм от начала кромки); шаг 7 и PDF читают те же координаты.

#### Шаг 6 — форма

- **`Step6FrameHingeLayout.tsx`:** поле **«Количество отверстий под петли»** — **`countStr`** + **`inputMode="numeric"`** (можно очистить и набрать **2…10**); нормализация на **`blur`**; подсказка под полями обновлена под новую схему.

#### Шаг 6 — размерные линии на эскизе

- Каждая петля — **один** размер **от края эскиза до позиции петли**, а не цепочка «между соседними петлями».
- **`hingeChainDims`** в **`Step6FrameHingeLayout.tsx`:** каждая петля — один размер **от края до петли**; значение в подписи — **`pos`** (№1) или **`L − pos`** (№2+). См. также блок **«дорожки размеров и треки»** выше — **`trackTopPct`**, **`trackOffsetPx`**.
- Выноски (**`.hinge-chain-dim__wit`**) удлиняются на **`--hinge-chain-track-offset`** — пунктир доходит до кромки/петли.
- **`Step3FrameSizes.css`:** подписи **`.hinge-chain-dim__val`** — absolute у размерной линии; **верх/низ** — горизонтальный текст над/под линией; **лево/право** — поворот **−90° / +90°**, по центру отрезка. Смещение подписи — CSS-переменные **`--hinge-label-nudge-x/y`**.

#### Эскиз: номера петель

- **`index.css`:** **`--ft-canvas-hinge-label`** / **`--ft-canvas-hinge-label-shadow`** — подписи **№1…№n** у маркеров **`.sketch-hinge-pin-label`** **чёрные** (обе темы).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Сессия / формулы | **`frameCalcSession.ts`** |
| Шаг 6 | **`Step6FrameHingeLayout.tsx`** |
| Стили эскиза | **`Step3FrameSizes.css`**, **`index.css`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

### Изменения 2026-05-24 (frontend — тема клиента и эскиз наполнения)

#### Публичная шапка

- **`App.tsx` / `App.css`:** **`ThemeToggle`** в **`public-shell__header`** (гость — перед «Вход»/«Регистрация»; авторизованный — рядом с «Выйти» / «Админка»). Тема общая с админкой (**`localStorage`** `furnitech-theme`).
- Ссылки **`public-shell__link`** и **`public-shell__logout`**: **`border-radius: 10px`** (как вкладки **`calc-step-tab`**).

#### Эскиз: наполнение

- **`sketchFrame.ts`:** **`materialFillingTextureLayerStyle()`**, константа **`SKETCH_FILLING_TEXTURE_OPACITY = 0.18`** — фиксированная низкая непрозрачность текстуры наполнения в эскизе (не зависит от **`tex_opacity`** материала); клиент и админка.
- Шаги **4–7**: слой **`.sketch-paper-texture`** через **`materialFillingTextureLayerStyle`**; цвет на **`.sketch-paper`** не дублируется (только белый фон + полупрозрачный слой).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Клиент | **`App.tsx`**, **`App.css`** |
| Эскиз | **`sketchFrame.ts`**, **`Step4FrameFilling.tsx`**, **`Step5FrameSummary.tsx`**, **`Step6FrameHingeLayout.tsx`**, **`Step7FrameHandleHoles.tsx`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

### Изменения 2026-05-24 (frontend — светлая и тёмная тема)

#### Система тем

- **`theme.ts`**, **`ThemeProvider.tsx`**, **`ThemeToggle.tsx`**: темы **`dark`** (по умолчанию) и **`light`**; сохранение в **`localStorage`** (`furnitech-theme`); атрибут **`data-theme`** на **`<html>`**.
- **`index.html`:** inline-скрипт до загрузки React — без мигания при старте; **`meta theme-color`** / **`color-scheme`** обновляются из **`applyTheme()`**.
- **`index.css`:** палитра через CSS-переменные **`--ft-*`** (фон, текст, акцент, модалки, калькулятор, эскиз); блок **`[data-theme='light']`** — светлый фон **`#f4f1eb`**, тёмный текст, контрастные акценты.
- **`main.tsx`:** обёртка **`ThemeProvider`**.

#### UI

- Переключатель в **`admin-header-top`** (иконка солнце/луна, **`border-radius: 10px`**, без подписи) — слева от **«Выйти»**; у **`.admin-logout`** то же скругление **10px**. Аналогичный **`ThemeToggle`** в **`public-shell__header`** (**`App.tsx`**).
- Светлая тема: читаемые панели калькулятора (**`.frame2-card`**, **`.frame3-left`**, плитки фасадов, кнопки **`.admin-primary` / `.admin-secondary`**), тёмные размерные линии эскиза (**`--ft-canvas-dim-*`**), приглушённый текст (**`--ft-muted`**, **`--ft-faint`**) — чёрный/тёмный.
- Захардкоженные цвета в основных CSS заменены на **`var(--ft-…)`** (админка, калькулятор, вход/регистрация, **`CalculatorConfigPage`**).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Тема | **`theme.ts`**, **`ThemeProvider.tsx`**, **`ThemeToggle.tsx`**, **`ThemeToggle.css`**, **`index.css`**, **`index.html`**, **`main.tsx`** |
| Шапка админки | **`AdminApp.tsx`**, **`AdminApp.css`** |
| Калькулятор / клиент | **`CalculatorPage.css`**, **`Step2FrameFacade.css`**, **`Step3FrameSizes.css`**, **`Step8FrameResult.css`**, **`CalculatorConfigPage.css`**, **`CalculatorPanelShell.css`**, прочие **`*.css`** с **`--ft-*`** |
| Документация | **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

### Изменения 2026-05-24 (frontend — ширина панели админ-калькулятора)

- **`CalculatorPage.tsx`:** **`syncCalcStepsTabsWidth`** дополнительно задаёт **`--calc-steps-panel-width`** — расстояние от левого края полосы вкладок до **правого края кнопки «Шаг 6»** (индекс **5**). Пересчёт при загрузке, **`resize`**, **`ResizeObserver`**, смене шага.
- **`CalculatorPanelShell.css`:** для **`#admin-panel-calculator`** панели шагов 1–8 (**.calc-side-panel`**, **`.frame2-card`**, **`.frame3-left`**) и сетки **`frame2` / `frame3` / step8** используют **`--calc-steps-panel-width`** (fallback **420px**); контейнер калькулятора — на всю ширину вкладки, эскиз справа.
- Публичный калькулятор не затронут — по-прежнему **`--calc-steps-tabs-width`** до «Итог».

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Админ-калькулятор | **`CalculatorPage.tsx`**, **`CalculatorPanelShell.css`**, **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

### Изменения 2026-05-24 (frontend — mobile fit-zoom при входе)

- **`frontend/index.html`:** inline-скрипт **`fitViewport()`** — если **`innerWidth < 1280`**, **`initial-scale`** = **`innerWidth / 1280`** (clamp **0.25…5**); на десктопе — **`initial-scale=1`**. Пересчёт при **`orientationchange`** и **`resize`**. Цель: на телефоне сразу видна **вся ширина** страницы (максимально отдалённый zoom), pinch-zoom сохранён.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Viewport | **`frontend/index.html`**, **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |

### Изменения 2026-05-24 (frontend — доработка desktop-layout и справочники)

#### Desktop-layout: zoom, scroll, админка

- **`desktop-layout.css`:** late overrides desktop-сеток (калькулятор шаги 2–8, модалки, справочники) — при browser zoom **`max-width`** брейкпоинты не переключают UI в mobile; вместо сжатия — scroll по X/Y.
- **Фиксированные высоты без `dvh`:** панель калькулятора **`--calc-side-h: 520px`**, эскиз **`520px × scale`**, шаг 8 — **`max-height: 920px`**; элементы не сжимаются при zoom.
- **Один scroll документа:** прокрутка только на **`html`**; у **`body`** — **`overflow: visible`** (убран дублированный scrollbar справа).
- **Справочники (материалы, текстуры, классы, формулы):** **`admin-body`** и **`admin-main`** растягиваются по содержимому (**`grid-template-rows: auto`**, **`height: auto`**); список не «выпадает» из **`main.admin-main`**.

#### Sticky-панель «Папки» в справочниках

- **`#admin-panel-materials|textures|classes|calculations .admin-aside`** (+ **`#material-search-modal`**): **`position: sticky`**, **`top: 1rem`**, **`align-self: start`**, **`max-height: calc(100vh - 2rem)`**, внутренний scroll дерева — удобный DnD материалов в папки при прокрутке длинного списка.
- **«Расчёты»:** снят **`overflow: hidden`** у **`#admin-panel-calculations`** и внутренних колонок — иначе sticky не работал; сетка как у материалов: **`grid-template-columns: aside + main`** (ранее ошибочно была одна колонка **`1fr`**).

#### Прочее

- **`Step4–7`:** удалены неиспользуемые **`blendScale`** (ошибка **`tsc`**).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Layout / справочники | **`desktop-layout.css`**, **`docs/PROGRESS.md`**, **`docs/ARCHITECTURE.md`** |
| Калькулятор (cleanup) | **`Step4FrameFilling.tsx`**, **`Step5FrameSummary.tsx`**, **`Step6FrameHingeLayout.tsx`**, **`Step7FrameHandleHoles.tsx`** |

### Изменения 2026-05-24 (frontend — только десктоп + эскиз при нулевых габаритах)

#### Режим «только десктоп» (временно без mobile)

- **`frontend/index.html`:** **`meta viewport`** — **`width=1280`**, **`user-scalable=yes`**, **`minimum-scale=0.25`**, **`maximum-scale=5`**. Брейкпоинты **`@media (max-width: 1024px)`** не срабатывают; на телефоне — полноразмерная версия с **pinch-zoom**. Inline-скрипт в **`index.html`** на узком экране (**`innerWidth < 1280`**) выставляет **`initial-scale = innerWidth / 1280`** — при входе с телефона видна **вся ширина** desktop-макета (максимально отдалённый zoom).
- **`desktop-layout.css`** (новый, подключается последним в **`main.tsx`**): **`--ft-layout-min-width: 1280px`**, прокрутка документа **по X и Y**; сняты **`overflow: hidden`** у **`.admin`**, калькулятора и внутренних колонок (на **`min-width: 1025px`**).
- **`desktop-layout.css`:** добавлены late overrides desktop-сеток для публичной оболочки, админки, справочников, модалок, калькулятора и шагов 2–8. Это удерживает десктопную геометрию даже когда при увеличении страницы CSS viewport попадает в старые **`max-width`** брейкпоинты; вместо перестройки появляются скроллы по X/Y. Высоты desktop-холста, панелей калькулятора и эскиза зафиксированы без зависимости от **`dvh`**, чтобы при zoom элементы не сжимались.
- **`mobile.css`** — **отключён** в **`main.tsx`** (файл сохранён; в шапке — как вернуть адаптив).
- **`index.css`:** убрана блокировка прокрутки **`html/body/#root`** на десктопе.

#### Шаг 3: эскиз при 0 или пустом поле

- **`frameCalcSession.ts`:** **`frameSketchDisplayDims(height, width)`** — для эскиза: значение **≤ 0** или **пусто** → **`FRAME_DEFAULT_*`** (**500×200** мм) по оси.
- **`Step3FrameSizes.tsx`:** подписи и пропорции чертежа через **`frameSketchDisplayDims`**, а не min материала.

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Layout | **`index.html`**, **`desktop-layout.css`**, **`main.tsx`**, **`index.css`**, **`mobile.css`** (комментарий) |
| Эскиз шаг 3 | **`frameCalcSession.ts`**, **`Step3FrameSizes.tsx`** |

#### Как вернуть мобильную вёрстку

1. В **`main.tsx`:** раскомментировать **`import './mobile.css'`**, убрать **`desktop-layout.css`**.
2. В **`index.html`:** **`width=device-width, initial-scale=1.0, viewport-fit=cover`**.

### Изменения 2026-05-24 (калькулятор — UI форм и потолок высоты эскиза)

#### Эскиз: вертикальный масштаб не выше 1700 мм

- **`sketchFrame.ts`:** константа **`SKETCH_SCALE_HEIGHT_CAP_MM = 1700`**; хелперы **`facadeSketchScaleY(heightMm)`**, **`facadeSketchAspectRatio(widthMm, heightMm)`**; **`facadeSketchBoxStyle`** использует их для **`--sketch-scale-y`** и **`aspectRatio`**.
- Для расчёта **`--sketch-scale-y`** берётся **`min(высота фасада, 1700)`** — при очень высоких фасадах (напр. 3000×500) эскиз **не растёт по вертикали** выше уровня 1700×500; пропорции (узость) по-прежнему от реальных H×W.
- Шаги **3–7:** шаг 3 через **`facadeSketchBoxStyle`**; шаги **4–7** — **`facadeSketchScaleY`** вместо дублированной формулы.

#### Формы типов (шаги 2, 4, 5)

- **Флаги New / Hit / Sale** (**.frame2-flags**): выравнивание по **левому краю** строки чеклиста (**`Step2FrameFacade.css`**).
- Подпись создания типа: **«Изображения для карточки»** без «(до 4)» (**`Step2FrameFacade`**, **`Step4FrameFilling`**, **`FrameHingeCatalog`**); в редактировании по-прежнему **«Карточка: до 4 фото»**.
- **`HintButton`** убран из форм создания/редактирования типов на шагах **2**, **4** и в **`FrameHingeCatalog`** (шаг 5).
- **Шаг 4:** кнопка **«+ Добавить тип наполнения»** перенесена в **`admin-heading-row calc-card-title-row`** (как на шаге 2), отдельный **`frame2-card-head`** убран.

#### Не вошло (откатано, та же сессия)

- Резерв **`padding-top`** у **`.frame3-drawing`** для верхней подписи ширины — **отменён** (ломал вёрстку чертёжных размеров).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Эскиз | **`sketchFrame.ts`**, **`Step4FrameFilling.tsx`**, **`Step5FrameSummary.tsx`**, **`Step6FrameHingeLayout.tsx`**, **`Step7FrameHandleHoles.tsx`** |
| Формы / UI | **`Step2FrameFacade.css`**, **`Step2FrameFacade.tsx`**, **`Step4FrameFilling.tsx`**, **`FrameHingeCatalog.tsx`** |

### Изменения 2026-05-24 (калькулятор — фото карточек и поиск материалов)

#### До 4 фото на карточке типа (шаги 2, 4, 5)

- **Backend:** поле **`card_image_4`** у **`CalculatorProfileType`**, **`CalculatorFillingType`**, **`CalculatorHingeType`**; миграция **`0047_calculator_card_image_4`**; сериализаторы — **`ImageField(required=False, allow_null=True)`** для **`card_image_4`**.
- **Frontend:** **`calculatorCardTiles.tsx`** — **`CALC_CARD_IMAGE_SLOT_COUNT = 4`**, **`ProfileCardImageTileRow`** (4 плитки), **`CalculatorCardTileStriped`** (**`slot3`**), хелперы **`appendCalcCardImagesToFormData`**, **`calcCardImageGridSlots`**.
- **Формы:** **`Step2FrameFacade`**, **`Step4FrameFilling`**, **`FrameHingeCatalog`** — 4 file input, **`FormData`** с **`card_image` … `card_image_4`**; подписи «до 4» / «до четырёх».
- **`types.ts`:** опциональное **`card_image_4?`** у трёх типов калькулятора.

#### `MaterialSearchModal` — как вкладка «Материалы»

- **Убраны** текстовые фильтры (артикул, наименование, цена, классы, имя папки). Остаётся **дерево папок** + **список материалов**.
- **Layout:** **`admin-body`** внутри модалки — **`admin-aside`** («Папки материалов», корень **«База материалов»** с expander) + **`admin-main`** со списком **`mat-list-table`** (колонки как в **`#admin-panel-materials`**: артикул, наименование, ед. изм., цена); в режиме **`multiPick`** — колонка чекбоксов.
- **Загрузка списка:** **`selectedTreeId == null`** → **`fetchMaterialsFiltered({})`** (вся база); выбрана папка → **`fetchMaterials(id, { subtree: true })`** — материалы **в папке и во всех вложенных**, как на вкладке «Материалы» админки.
- **Стили:** **`material-search-modal`**, **`#material-search-modal`**, **`material-search-mat-list`** в **`AdminApp.css`**; мобильная вёрстка строк — как **`#admin-panel-materials .mat-list-row`** (**`mobile.css`**).
- **Шаги калькулятора:** 2 (цвета профиля), 4 (материалы наполнения), 5 (**`FrameHingeCatalog`**) — один общий компонент.

#### Прочее (калькулятор, та же сессия)

- **Количество фасадов (шаг 3):** максимум **99999** (**`FRAME_FACADE_COUNT_MAX`** в **`frameCalcSession.ts`**, clamp в **`Step3FrameSizes.tsx`**).
- **Кнопка «Поиск»** (шаги 2, 4, 5): компактная как «Отмена», **на всю ширину** колонки (**`.frame2-material-tree-search-btn`**, **`CalculatorPanelShell.css`**).

#### Затронутые файлы

| Область | Файлы |
|---------|--------|
| Backend | **`models.py`**, **`serializers.py`**, **`0047_calculator_card_image_4.py`** |
| Поиск | **`MaterialSearchModal.tsx`**, **`AdminApp.css`**, **`mobile.css`** |
| 4 фото | **`calculatorCardTiles.tsx`**, **`Step2FrameFacade.tsx`**, **`Step4FrameFilling.tsx`**, **`FrameHingeCatalog.tsx`**, **`types.ts`** |
| Габариты / UI | **`frameCalcSession.ts`**, **`Step3FrameSizes.tsx`**, **`Step2FrameFacade.css`**, **`CalculatorPanelShell.css`** |

### Изменения 2026-05-24 (калькулятор — габариты и лист эскиза)

#### Дефолтные габариты эскиза из материала

- **`frameCalcSession.ts`**: добавлены **`frameDimDefaultsFromMaterial`**, **`hasSavedFrameDims`**, **`seedFrameDimsFromMaterial`**, тип **`FrameDimMaterialLimits`**.
- **Логика дефолта:** если в `localStorage` ещё нет **`calc_frame_height_mm` / `calc_frame_width_mm`**, при загрузке материала цвета профиля записываются минимальные габариты материала (**`min_length`**, **`min_width`**, округление вверх). Если минимумы не заданы — fallback **`FRAME_DEFAULT_HEIGHT_MM = 500`**, **`FRAME_DEFAULT_WIDTH_MM = 200`**.
- **Шаг 2 (`Step2FrameFacade.tsx`):** после **`fetchMaterial(selectedColorId)`** вызывается **`seedFrameDimsFromMaterial(m)`**; эскиз без сохранённых габаритов использует **`frameDimDefaultsFromMaterial(selectedColorMaterialFull)`** как fallback для **`facadeSketchBoxStyle`**.
- **Шаг 3 (`Step3FrameSizes.tsx`):** при загрузке материала — **`seedFrameDimsFromMaterial`** + синхронизация полей; эскиз и размерные подписи показывают **`sketchHeightN` / `sketchWidthN`** (ввод пользователя или дефолт материала). В **`localStorage`** размеры пишутся только когда оба поля непустые (не затирают сессию пустыми строками до загрузки материала).
- **Сохранённые пользователем размеры** (уже есть в `localStorage`) **не перезаписываются** при смене цвета или повторном заходе на шаг 3.

#### Ограничения ввода габаритов (шаг 3)

- **`FRAME_DIM_FALLBACK_MAX_MM = 99999`** — верхняя граница, если у материала **`max_length` / `max_width`** не заданы (≤ 0).
- **`effectiveFrameDimMax(materialMax)`** — фактический максимум: `floor(max)` из материала или **99999**.
- **`clampFrameDimDigits(raw, materialMax)`** — при **`onChange`**: только цифры, длина строки не больше числа знаков в максимуме, значение не выше максимума.
- Поля **«Высота»** и **«Ширина»**: атрибут **`maxLength`**, **`onBlur`** — clamp к **[min, max]** (min из материала или 0). Блок «Ограничение по размерам» показывает **99999** вместо «—», если max в карточке материала не задан.
- Валидация **`heightOk` / `widthOk`** и кнопка «Следующий шаг» учитывают **`effectiveMaxH` / `effectiveMaxW`**.

#### Типографика и таблица на листе эскиза (`.sketch-sheet`)

- **`Step2FrameFacade.css`** (общий стиль для эскизов шагов 2–7):
  - текст **чёрный** (`#000`);
  - уменьшенный кегль: заголовок **0.82rem**, подзаголовок **0.68rem**, ключи **0.7rem**, значения **0.72rem**;
  - таблица параметров: колонка названия **5rem**, зазор между ключом и значением **0.25rem** (было **6.2rem** / **0.65rem**).

#### Затронутые файлы (frontend)

| Файл | Суть |
|------|------|
| **`calculator/frameCalcSession.ts`** | **`FRAME_DIM_FALLBACK_MAX_MM`**, дефолты/seed габаритов, **`effectiveFrameDimMax`**, **`clampFrameDimDigits`** |
| **`calculator/Step2FrameFacade.tsx`** | **`seedFrameDimsFromMaterial`**, fallback эскиза из min материала |
| **`calculator/Step2FrameFacade.css`** | **`.sketch-sheet`**, **`.sketch-title/sub/key/val`**, **`.sketch-row`** |
| **`calculator/Step3FrameSizes.tsx`** | seed дефолтов, ограничение ввода, **`sketchHeightN` / `sketchWidthN`** |

#### Документация

- **`docs/ARCHITECTURE.md`** — обновлены строки про сессию габаритов, шаг 3 и **`frameCalcSession.ts`**.

#### Не вошло (откатано)

- Попытки показать размер ширины на очень высоких фасадах через **`frame3-drawing--dim-inset-top`** / **`--width-outside`** / overlay — **отменены** (ломали вёрстку размерных линий).
- Защита переполнения текста в **`.sketch-sheet`** через **`overflow: hidden`** и **`ellipsis`** на **`frame3-dim-drawing__value`** — **отменена** по той же причине.

### Изменения 2026-05-20 (админка «Калькулятор» — вёрстка и UX)

#### Общая структура макета

- **`CalculatorPage.tsx`:** убрана внешняя обёртка **`section.calc-card`** на всех шагах — контент шага живёт напрямую в **`#calc-step-panel-N`** внутри **`.calc-routes-step`**.
- **Одна колонка вместо «контент + боковая панель итога»:** на обёртке **`calc-body-with-totals calc-body-with-totals--wide`** — **`grid-template-columns: 1fr`** (**`CalculatorPage.css`**); правая колонка **`.calc-totals-aside`** больше не используется в разметке страницы.
- **Ширина панели шага = ширина полосы вкладок:** **`syncCalcStepsTabsWidth(calcEl, tabsEl)`** в **`CalculatorPage.tsx`** измеряет **`.calc-steps-tabs`** (от левого края до правого края последней вкладки «Итог») и пишет CSS-переменную **`--calc-steps-tabs-width`** на **`.calc`**. **`ResizeObserver`**, **`resize`**, **`document.fonts.ready`** — пересчёт при смене шага и ресайзе.
- Переменная применяется к **`frame2-card`**, **`frame3-left`**, **`calc-side-panel`**, сеткам **`frame2` / `frame3` / step8** (**`CalculatorPage.css`**, **`Step2FrameFacade.css`**, **`Step3FrameSizes.css`**, **`Step8FrameResult.css`**).

#### Блок «Расчёт» внутри шага

- **`CalcPriceTotals.tsx`:** экспорт **`CalcStepPriceTotals`** — встроенный блок с **`placement="inline"`** (обёртка **`.calc-totals-inline`**).
- **`CalcPriceTotalsSlotProvider`** + контекст: **`hideTotals`** (шаги 1–2 — только подсказка без сумм), **`blankAside`** (шаг 8 — свой итог).
- **`CalcStepPriceTotals`** подключён в **`calc-side-panel-scroll`** на шагах **1–7** (в т.ч. заглушки МДФ/ПВХ — **`Step2MdfFacade`**, **`Step2PvcFacade`**).
- В админке (**`#admin-panel-calculator`**): **`margin-top: auto`** у **`.calc-side-panel-scroll > .calc-totals-inline`** — блок «Расчёт» прижат к низу прокручиваемой области (**`AdminApp.css`**).

#### Паттерн **`.calc-side-panel`**

- **`CalculatorPage.css`:** колонка flex с фиксированной высотой **`--calc-side-h`**, **`overflow: hidden`**; прокрутка только в **`.calc-side-panel-scroll`**; шапка (**`admin-heading-row`**) и **`frame2-card-nav`** остаются видимыми.
- Шаги **2–8** (рамочный): **`frame2-card calc-side-panel`** или **`frame3-left calc-side-panel`**; шаг **1** — **`frame2-card calc-side-panel`** с той же высотой.

#### Шаг 1 — выбор фасада

- Разметка в **`CalculatorPage.tsx`:** **`frame3-title`** «Выберите тип фасада», сетка **`calc-facade-grid`** с radio, **`CalcStepPriceTotals`**, навигация **`frame2-card-nav frame2-card-nav--step1`**.
- Локальное состояние **`step1Facade`** — выбор **не** переводит сразу на шаг 2; переход по кнопке **«Следующий шаг →»** (**`admin-primary`**, disabled без выбора).
- Стили radio в админке: **`calc-facade-radio`** 16×16px, **`accent-color: var(--ft-accent-2)`**, активная строка **`calc-facade--active`**.

#### Шаг 2 — тип профиля

- Заголовок и **«+ Добавить тип профиля»** в одной строке **`admin-heading-row calc-card-title-row`** (**`Step2FrameFacade.tsx`**); убран отдельный **`frame2-card-head`** только с кнопкой.
- Админ-плитки: компактная сетка (**`#admin-panel-calculator .tiles`**) — **`--tile-h: auto`**, **`grid-template-rows: auto auto auto`**, уменьшенные **`gap`** и **`padding`**.

#### Меню ⚙ на плитках (шаги 2 и 4) — portal

- **Новый файл `calculator/TileGearMenu.tsx`:** пункты **«Редактировать»** / **«Удалить»** рендерятся через **`createPortal(..., document.body)`** с **`position: fixed`** и классом **`tree-gear-menu--portal`** (**`z-index: 10000`**).
- Позиция от **`getBoundingClientRect()`** кнопки шестерёнки; сдвиг от краёв viewport; закрытие — клик снаружи, **Escape**, scroll/resize.
- Подключено в **`Step2FrameFacade.tsx`** (типы профиля) и **`Step4FrameFilling.tsx`** (типы наполнения); удалены **`gearMenuWrapRef`** / **`fillingGearMenuWrapRef`** и document-level **`mousedown`** для закрытия.
- CSS: **`.tree-gear-menu--portal`** в **`AdminApp.css`**; убраны хаки **`left/right`** у inline-меню в **`Step2FrameFacade.css`** (меню больше не обрезается **`overflow`** у **`.calc-side-panel-scroll`**).

#### Админка — типографика и вкладки

- **`#admin-panel-calculator`:** отступы **`admin-orders-placeholder`** и **`calc`** согласованы с вкладкой **«Заказы»**; кегль через **`--mat-scroll-fs`** / **`--admin-refs-scale`**.
- Вкладки шагов **`.calc-step-tab`** и разделов **`.admin-section-tab`** — один стиль: квадратные углы **`--admin-refs-control-radius`**, одинаковый **`font-size`** (**`calc(0.88rem * var(--admin-refs-scale))`**).
- Полоса **`calc-steps-tabs`** в админке — без «пилюльного» фона (прозрачный фон, как **`admin-section-tabs`**).

#### Десктоп: прокрутка внутри вкладки «Калькулятор»

- **`@media (min-width: 1025px)`** в **`AdminApp.css`:** цепочка **`flex` + `min-height: 0` + `overflow: hidden`** от **`admin-orders-placeholder`** до **`calc-routes-wrap`** — шаг не «вылезает» за панель админки; вертикальный скролл в **`calc-routes-wrap`** (кроме шага 8 — **`calc-routes-wrap--step8`**, скролл внутри **`Step8FrameResult`**).

#### Мобильная вёрстка

- **`mobile.css`:** адаптация под **`calc-totals-inline`**, **`calc-side-panel`** без фиксированной высоты на **`≤1024px`**, панели на **`width: 100%`**.

#### Затронутые файлы (frontend)

| Файл | Суть |
|------|------|
| **`CalculatorPage.tsx`** | **`syncCalcStepsTabsWidth`**, шаг 1, **`CalcPriceTotalsSlotProvider`**, одноколоночный **`calc-body-with-totals--wide`** |
| **`CalculatorPage.css`** | **`calc-side-panel`**, **`--calc-steps-tabs-width`**, **`calc-totals-inline`**, **`calc-body-with-totals--wide`** |
| **`AdminApp.css`** | Блок **`#admin-panel-calculator`** (~300 строк), **`tree-gear-menu--portal`**, flex-скролл десктопа |
| **`CalcPriceTotals.tsx`** | **`CalcStepPriceTotals`**, **`CalcPriceTotalsSlotProvider`**, **`placement: inline \| aside`** |
| **`TileGearMenu.tsx`** | **новый** — portal-меню плитки |
| **`Step2FrameFacade.tsx` / `.css`** | Заголовок+кнопка в одной строке, **`TileGearMenu`** |
| **`Step4FrameFilling.tsx`** | **`TileGearMenu`** |
| **`Step2MdfFacade.tsx`**, **`Step2PvcFacade.tsx`**, **`Step3FrameSizes.tsx`**, **`Step5FrameSummary.tsx`**, **`Step6FrameHingeLayout.tsx`**, **`Step7FrameHandleHoles.tsx`** | **`CalcStepPriceTotals`** в scroll |
| **`Step3FrameSizes.css`**, **`Step8FrameResult.css`** | Колонки с **`var(--calc-steps-tabs-width)`** |
| **`mobile.css`** | Панели и inline-итог на узких экранах |

#### Документация

- **`docs/ARCHITECTURE.md`** — обновлены строки про **`CalcPriceTotals`**, **`TileGearMenu`**, ширину панели.

### Изменения 2026-05-20 (коэффициент избытка материала)

#### Backend

- **`Material.excess_coefficient`** — **`DecimalField`**, default **`1`**, миграция **`0046_material_excess_coefficient`**; валидация **`> 0`** в **`clean`** и **`MaterialSerializer.validate`**.
- **`MaterialSerializer`**, **`MaterialSummarySerializer`** — поле **`excess_coefficient`** (read/write и в summary для сопутствующих с **`use_related_uom`**).

#### Карточка материала (`MaterialForm`, `AdminApp.tsx`, `AdminApp.css`)

- Под блоком **«Округление…»** — поле **«Коэффициент избытка»** (**`mat-form-rounding-stack`**, **`mat-form-excess-field`**); default **`1`**, при blur пусто или **`≤ 0`** → **`1`**.

#### Калькулятор (`frontend/src/calculator/framePriceEstimate.ts`)

- **`parseExcessCoefficient`**, **`pricedUnitsForMaterial`**: итоговое количество = геометрический объём × **`excess_coefficient`** (пусто/`≤ 0` → **`1`**). Затронуты **`materialLineCost`**, **`computeFramePriceBreakdown`**, **`calculationFormula.ts`**.

#### Типы

- **`frontend/src/types.ts`:** **`excess_coefficient`** в **`Material`** и вложенном **`related_material`**.

#### Документация

- **`docs/ARCHITECTURE.md`**, **`docs/CALCULATION_FORMULAS.md`** — описание поля и формулы.

### Изменения 2026-05-19 (калькулятор — режим расчёта материала)

#### Логика (`frontend/src/calculator/framePriceEstimate.ts`)

- **`pricingCalcModeToUomCode`**, **`resolveMaterialPricingUomCode`**: при заданном **`pricing_calc_mode`** объём считается по флажку карточки материала, иначе — прежняя эвристика **`resolvePricingUomCode(uom)`**.
- **`linear` (Погонаж):** периметр `2×(H+W)/1000` м.п. на фасад × \(N\) фасадов.
- **`sheet` (Лист):** площадь `H×W/1_000_000` м² на фасад × \(N\).
- **`piece` (Штуки):** 1 шт. на фасад × \(N\).
- Затронуты **`pricedUnitsForMaterial`**, **`materialLineCost`**, **`computeFramePriceBreakdown`**, **`relatedItemCalculatorCost`** (режим **`use_related_uom`** у сопутствующих), **`calculationFormula.ts`** (активная формула по классам).

#### UI итога (`CalcPriceTotals.tsx`)

- Подпись «в расчёте как …» использует **`resolveMaterialPricingUomCode`**, а не только код ед. изм.

#### Backend / типы

- **`MaterialSummarySerializer`:** поле **`pricing_calc_mode`** — для сопутствующих материалов в **`related_items`** (режим **`use_related_uom`**).
- **`frontend/src/types.ts`:** **`pricing_calc_mode`** в типе вложенного **`related_material`**.

#### Документация

- **`docs/ARCHITECTURE.md`**, **`docs/CALCULATION_FORMULAS.md`** — описание **`resolveMaterialPricingUomCode`** и приоритета над **`uom.code`**.

### Изменения 2026-05-19 (карточка материала — «Примечание» и «Расчёт»)

- **`mat-form-note-calc-row`:** поле **«Примечание»** — **`textarea`** с **`flex: 1`**, высота по колонке флажков **Погонаж / Лист / Штуки** (верх textarea = верх первого флажка, низ = низ последнего); **`AdminApp.css`** — правила для **`.mat-form-note-col`**, переопределение **`min-height`** у textarea в **`admin-material-card-dialog`**.

### Изменения 2026-05-19 (админка «Справочники» — UI и карточка материала)

#### Масштаб и CSS-переменные (`frontend/src/index.css`, `AdminApp.css`, `mobile.css`)

- На **`:root`** и в блоках **`#admin-panel-*`**: **`--admin-refs-scale: 1.3`**, производные **`--admin-refs-fs`**, **`--admin-refs-btn-min-w`**, **`--admin-refs-control-radius`** (≈ **3px × scale** — как у **`mat-list-row`**, не «таблетки»).
- **Боковая колонка папок** (`admin-aside`): ширина через **`--admin-refs-aside-factor`** (текущее значение **0.716625** ≈ −28% от исходных 220–280px с учётом scale); применяется к **Материалы**, **Текстуры**, **Классы**, **Формулы**.
- Плотность списков, кнопок **«+ …»**, вкладки выпадающего **«Справочники»** — через **`calc(… * var(--admin-refs-scale))`**.
- **Модалки справочников** (портал на **`document.body`**, класс **`admin-calculations-modal-surface`**): те же **`--mat-scroll-*`** и **`--admin-refs-control-radius`** дублируются локально, чтобы поля/кнопки не оставались квадратными вне **`.admin`**.

#### Списки справочников (`AdminApp.css`)

- **Текстуры** и **Ед. изм.:** строки **`mat-list-row`** на всю ширину, как кнопка **«+ …»** — у **`#admin-panel-textures`** / **`#admin-panel-uom`** сетка **`mat-list-item-inner`** одноколоночная (убран резерв под скрытую **`mat-list-gear-btn`**).
- **Материалы** — то же правило для **`mat-list-item-inner`** (ранее).

#### Карточка материала — `MaterialForm` (`AdminApp.tsx`, `AdminApp.css`)

- **Компактнее по вертикали:** уменьшены **`row-gap`** вкладки «Общие параметры», отступы блока «Класс материала»; исправлен сброс **`margin-top`** у **`.mat-list-table.mat-class-pick-preview`** (селектор `.mat-class-pick-preview .mat-list-table` не срабатывал — классы на одном элементе).
- Убраны **`HintButton`** в шапке карточки и у поля «Цена за ед., тенге».
- **Ед. измерения:** **`FtSelect`** из справочника **`/api/uom/`**; при открытии карточки **`fetchUom()`** обходит **все страницы** DRF (см. **`api.ts`**).
- **Режим расчёта:** три взаимоисключающих флажка **Погонаж / Лист / Штуки** — поле **`pricing_calc_mode`** (`linear` \| `sheet` \| `piece` \| пусто). Строка **`mat-form-note-calc-row`**: слева **«Примечание»** (`textarea`), справа колонка **«Расчёт»** (см. отдельный блок ниже — подключение к калькулятору).

#### Backend

- **Миграция `materials.0045_material_pricing_calc_mode`:** поле **`Material.pricing_calc_mode`**, choices **`PricingCalcMode`** в **`models.py`**; в **`MaterialSerializer`** — read/write.
- **`frontend/src/types.ts`:** тип **`PricingCalcMode`**.

### Изменения 2026-05-19 (справочник единиц измерения)

- **`frontend/src/AdminUomPanel.tsx`:** новая вкладка **«Ед. изм.»** в выпадающем **«Справочники»** (`/uom`). Список на всю ширину **без `admin-aside`** — колонки **Код**, **Сокращение**, **Наименование**; компактная кнопка **«+ Ед. изм.»** (как **«+ Формула»**); щелчок по строке — модалка создания/редактирования (**`admin-material-card-dialog`**); удаление с подтверждением (на backend — **`PROTECT`**, если единица привязана к материалам).
- **`frontend/src/api.ts`:** **`createUom`**, **`updateUom`**, **`deleteUom`**; чтение — **`fetchUom`** + **`sortUomForSelect`** для порядка строк.
- **`frontend/src/AdminApp.tsx`**, **`App.tsx`:** маршрут **`/uom/*`**, пункт меню между **«Классы»** и **«Формулы»**.
- **`frontend/src/AdminApp.css`:** **`#admin-panel-uom`** — одноколоночный layout, плотный **`mat-list-table`**, кнопка **«+ Ед. изм.»** в общем блоке компактных **`admin-primary`** (как материалы/классы/формулы).

### Изменения 2026-05-19 (справочники — производительность)

- **`frontend/src/api.ts`:** добавлены **`fetchTextureItemsPage`** и **`fetchMaterialClassesPage`** — один DRF page-response (`results`, `next`, `previous`, `count`) без последовательного обхода всех страниц. Полные **`fetchTextureItems`** / **`fetchMaterialClasses`** сохранены для калькулятора, поиска и pickers.
- **`frontend/src/AdminTexturesPanel.tsx`:** список текстур при выборе **«База текстур»** или папки загружает только первую страницу; если есть **`next`**, появляется **«Загрузить ещё»**. После drag/drop и удаления папки refresh снова начинается с первой страницы текущей области.
- **`frontend/src/AdminMaterialClassesPanel.tsx`:** список классов при открытии вкладки/выборе папки загружает первую страницу; следующие страницы добавляются кнопкой **«Загрузить ещё»**, отображаемые записи сортируются по имени.

### Изменения 2026-05-18 (пикер классов — производительность)

- **`frontend/src/MaterialClassPickModal.tsx`:** при монтировании один раз загружается полный каталог в **`allClasses`** (поиск по названию/коду/ФНП). Список в области **«База классов»** (`selectedId == null`) — из **`allClasses`**, без второго обхода пагинации API. Запрос **`fetchMaterialClasses({ category, subtree })`** только при выборе папки. Возврат к корню — мгновенно из кэша.

### Изменения 2026-05-18 (модалка формулы — редактор)

#### UI и вёрстка (`AdminCalculationsPanel.tsx`, `AdminApp.css`)

- **Шапка:** поле **наименования** — **`input.mat-form-title-input`** (вместо статичного заголовка).
- **Три колонки** на ширину поля формулы: **`folder-explorer-tree`** | **`folder-explorer-content`** | **`admin-calculations-keypad-grid`** (**`display: contents`** на обёртках пикера).
- **Keypad:** калькуляторная раскладка `789/` … `0()+`, ряд **`.` · Назад · Очистить · `=`**; подложка keypad как у списка классов.
- **Поле формулы:** **`input.admin-calculations-output--text`** (compact, как наименование); **`expression`** без пробелов между токенами.

#### Логика редактирования (`AdminCalculationsPanel.tsx`, `calculationFormula.ts`)

- Курсор в **позиции символа** строки (**`formulaStringCursorRef`**), не только индекс токена — исправлен «прыжок» Backspace по многозначным числам.
- **Клавиатура в поле:** `0–9 . + - * / ( ) =`; **Backspace** — один символ слева от курсора; вставка из буфера заблокирована.
- **Keypad «Назад»:** удаление **с конца** (**`formulaBackspaceEnd`**); **Backspace** в поле — от курсора (**`formulaBackspaceAtStringPos`**).
- **Классы** — только из пикера; цифры/знаки — keypad или клавиатура (**`applyFormulaStringEdit`**).
- Закрытие по клику на фон: **`onPointerDown` / `onPointerUp`** на backdrop (не **`onClick`**) — выделение текста в поле не закрывает модалку.
- **`formulaDisplayExpression`:** **`join('')`** без пробелов; API **`valid_ops`** включает **`=`** (в **`evaluateCalculationFormula`** **`=`** игнорируется).

#### Документация

- **`docs/CALCULATION_FORMULAS.md`:** разделы «Конструктор», «Редактирование формулы», «UI модалки» переписаны под текущий интерфейс.
- **`docs/ARCHITECTURE.md`:** строка **`AdminCalculationsPanel`** в таблице модулей.

### Изменения 2026-05-18 (документация: формулы расчёта UI)

- **`docs/CALCULATION_FORMULAS.md`**: раздел «Конструктор в админке» приведён к текущему UI (нет отдельного поля названия в модалке; **`MaterialClassPickerBody`** с **`hidePickChrome`**; дерево **`admin-materials-tree-root`**; **`shownScopeLabel`** / **`material-class-pick-scope-row`**; удалены устаревшие «теги классов» и кнопка «+ Класс»).
- **`docs/ARCHITECTURE.md`**: таблица модулей — **`AdminCalculationsPanel`**, добавлен **`MaterialClassPickModal.tsx`**.

### Изменения 2026-05-18 (модалки папок и поле «Класс»)

#### Модалки создания папки (`FolderCreateModal.tsx`, `AdminMaterialClassesPanel.tsx`, `AdminCalculationsPanel.tsx`, `AdminApp.css`)

- **Материалы и текстуры:** портал **`FolderCreateModal`** — подложка **`admin-modal-backdrop`** с **`role="presentation"`**; вместо **`div.admin-modal.admin-modal--explorer`** — **`section`** с классами **`admin-panel admin-panel--in-material-modal admin-calculations-modal-surface admin-modal--material-card admin-material-card-dialog`**, модификатор **`folder-create-material-dialog`**. Внутри — **`mat-form`**, **`mat-form-head`** (**`admin-h2`** + **`MODAL_CLOSE_X_SVG`** в **`admin-modal-head-icon-close`**), ошибка, **`mat-form-tab-panel folder-create-explorer-panel`** (хлебные крошки, explorer, имя папки), футер **`admin-row mat-form-actions`**.
- **Классы и формулы:** порталы **«Новая папка классов / формул»** — тот же **`section` + `mat-form` + шапка с крестиком**; контент в **`mat-form-tab-panel`** с **`mat-form-field-span-2`** для текста родителя и поля имени; **`role="presentation"`** на подложке.
- **Стили:** блок **`.admin-material-card-dialog.folder-create-material-dialog`** и **`.folder-create-explorer-panel`** — вертикальный flex, скролл в дереве/контенте, футер не сжимается; переопределение **`min-height`** у **`.folder-explorer`**, чтобы высота модалки не ломалась.

#### Карточка материала — класс (`AdminApp.tsx`, `AdminApp.css`)

- Блок **«Класс материала»:** после легенды (**Код / Наименование класса**) строка превью и контейнер **`mat-class-ctrls`** (`+`, `−`) обёрнуты в **`mat-class-preview-ctrl-row`** (flex, **`align-items: center`**), чтобы кнопки были на одной линии со **`mat-class-pick-preview-row`, а не по центру всего столбца «легенда + строка». У **`mat-class-input-row`** убран горизонтальный split **`field-half` + контролы**.
- Логика **`ResizeObserver`** и **`--mat-class-btn-size`** по высоте строки превью **сохранена** (**`matClassInputRef`**, **`matClassRowRef`**).

### Изменения 2026-05-18 (админка: UX списков, модалки, навигация)

#### Материалы (`AdminApp.tsx`, `AdminApp.css`, `mobile.css`)

- Убрана кнопка **`mat-list-gear-btn`** и слот **`mat-list-legend-gear-slot`** в шапке списка. **Один щелчок** по строке (с задержкой **280 ms**) — панель **«Сопутствующие»**; **двойной щелчок** — карточка материала; **Alt+Enter** — карточка с клавиатуры. Реф **`materialListClickTimerRef`**, очистка таймера при размонтировании.
- Сетка **`#admin-panel-materials .mat-list-item-inner`** и **`--legend`** — одна колонка. Страховка в CSS: **`#admin-panel-materials .mat-list-gear-btn { display: none !important }`** на случай старого бандла.

#### Текстуры (`AdminTexturesPanel.tsx`, `AdminApp.css`, `mobile.css`)

- Убрана **`mat-list-gear-btn`** у строк списка; открытие карточки — **щелчок** по строке.
- Модалка карточки: прямой **`section`** с классами **`admin-panel … admin-calculations-modal-surface admin-modal--material-card admin-material-card-dialog`** (без **`div.admin-modal--explorer`**); шапка — крестик **`MODAL_CLOSE_X_SVG`**, **`mat-form-tab-panel`**, поля с **`mat-form-field-span-2`**; **`HintButton`** в форме текстуры убран.

#### Классы материалов (`AdminMaterialClassesPanel.tsx`, `AdminApp.css`)

- Строка списка: **Enter** / **пробел** / щелчок — модалка **редактирования** (**`updateMaterialClass`**, наименование и код). Оболочка — **`section`** как у карточки текстуры; **`MODAL_CLOSE_X_SVG`**; **`HintButton`** в модалках создания/редактирования убран.
- В **редактировании**: **«Удалить»**, подтверждение **`admin-modal-backdrop--stack-top`**, **`deleteMaterialClass`**, флаги **`savingEditClass`** / **`deletingEditClass`**.
- Убрана строка **«Папка: …»** в модалках; удалено правило **`.admin-mclass-modal-folder`**.

#### Навигация админки (`AdminApp.tsx`, `AdminApp.css`)

- Первый пункт полосы — выпадающее **«Справочники»** с SVG «три полоски» (**`ADMIN_REFS_HAMBURGER_SVG`**): **Материалы**, **Текстуры**, **Классы**, **Формулы**. Далее **Заказы**, **Пользователи**, **Калькулятор**. **`admin-section-tab-dropdown`**, **`admin-section-tab-dropdown-panel`**, закрытие по клику снаружи, **Escape**, смене **`section`**. У контейнера **`role="navigation"`**.

### Изменения 2026-05-17 (модалка материала, удаление формулы, поле «Артикул»)

- **`frontend/src/AdminApp.tsx`:** у портальной **`section`** карточки материала добавлен класс **`admin-calculations-modal-surface`** (на секции уже действуют **`--mat-scroll-fs/lh/ls`** из **`AdminApp.css`**, как у модалки формулы). Закрытие карточки — не текст **«Закрыть»**, а иконка **`MODAL_CLOSE_X_SVG`** в кнопке **`admin-primary admin-modal-head-icon-close`** (как **`AdminCalculationsPanel`**); при **`saving`** или **`classSyncPending`** кнопка **`disabled`**. **`FtSelect`** единиц измерения — проп **`compact`**. В **`mat-form-actions`** на обеих вкладках порядок: сначала **«Удалить»** (**`admin-secondary admin-danger`**, только для сохранённого материала), затем **«Сохранить»** — совпадает с футером модалки формулы (**`justify-content: flex-end`** уже задано для **`admin-calculations-modal-surface.admin-panel--in-material-modal .mat-form-actions`**). Поле **«Артикул»** — без **`field-label-row`** и без **`HintButton`**, только **`<span>Артикул</span>`**.

- **`frontend/src/AdminApp.css`:** новый блок **`.admin-calculations-modal-surface.admin-material-card-dialog`** — для **`mat-form-tab-panel`** выставлены **`row-gap` / плотность полей** в духе **`admin-calculations-formula-modal-body`**: **`label.field` / `.field`** (**`gap`**, без лишнего **`margin-bottom`**), подписи (**`var(--mat-scroll-fs)`**, **`var(--ft-muted)`**), **`admin-input`** (малый **`padding`**, **`border-radius: 4px`**), **`textarea`**, вкладки **`mat-form-tab`**, **`ft-select--compact`** (триггер и меню), чипы **`chip`**, кнопки **`mat-class-ctrl`**, подписи текстуры и статуса, вторичные кнопки в **`tex-layout`**, **`tex-mode-row`**, текст в блоке округления.

- **`frontend/src/AdminCalculationsPanel.tsx`:** в футере редактора формулы кнопка **«Удалить»** — **`admin-secondary admin-danger`**. Вместо **`window.confirm`** — отдельный портал **`admin-modal-backdrop admin-modal-backdrop--stack-top`** + **`admin-modal`**: заголовок **«Удалить формулу расчёта?»**, текст с **«Формула «…» будет удалена…»** (калькулятор и связанные записи), **«Отмена»** / **«Удалить»** (**`admin-modal-confirm`**). Состояние **`formulaDeleteOpen`**, логика **`confirmRemoveFormula`** / **`cancelFormulaDelete`**; по **Escape** модалка закрывается, если нет **`busy`**.

### Изменения 2026-05-17 (админка «Расчёты» — UX модалки формулы)

- **`frontend/src/AdminCalculationsPanel.tsx`:** портал без внешнего **`div.admin-modal`** — **`section.admin-calculations-formula-dialog`** с ролью диалога; **`admin-calculations-formula-modal-body`** без вложенного скролла; закрытие по **«Сохранить»** после успеха; крестик в шапке (**`MODAL_CLOSE_X_SVG`**); кнопки **Убрать** (класс), **Назад**, **Очистить** — иконки + **`admin-primary admin-calculations-icon-btn`**; знаки и **«Вставить число»** в том же стиле; SVG для шага назад и очистки поля.
- **`frontend/src/AdminApp.css`:** **`admin-calculations-formula-dialog`** (окно по контенту, **`max-height`**); поверхность **`admin-calculations-modal-surface`** (типографика, дублирование правил списка классов формулы, компактные кнопки, **`mat-form-actions`** вправо); единый блок **`.admin-primary.admin-calculations-icon-btn`**; поле числа **`admin-calculations-number`** — форма как у **«Вставить число»**, цвета как у **`admin-input`**; отступ над **`admin-calculations-output`**.
- Документация: **`docs/CALCULATION_FORMULAS.md`** — новый раздел про UI; этот файл — краткий чеклист.

### Изменения 2026-05-17 (админка «Классы» — модалка создания класса)

- **`frontend/src/AdminMaterialClassesPanel.tsx`:** убрана строка в основном потоке (поле «Наименование нового класса» + **«Добавить»**). Создание класса — по кнопке **«+ Класс»** в модалке в стиле карточки текстуры (**`admin-modal--explorer`**, **`admin-modal--material-card`**, **`admin-panel--in-material-modal`**): наименование, опционально код, строка с выбранной папкой, **Escape** закрывает (кроме сохранения), клик по фону не закрывает во время **`saving`**.
- **`frontend/src/AdminApp.css`:** удалены правила **`.admin-mclass-add-row*`**; добавлен **`.admin-mclass-modal-folder`** (отступ под строку папки в модалке).
- **`useRef`** остаётся в импорте из **`react`** (переименование папок в дереве **`MccTreeRow`**).

### Изменения 2026-05-17 (админка «Текстуры» — список по корню и поддереву, API)

- **Поведение (как материалы и классы):** **`selected == null`** (**«База текстур»**) — справа **все** записи **`TextureItem`**; выбрана конкретная папка — текстуры **в этой папке и во всех вложенных** (**`subtree`**), аналогично **`fetchMaterials(..., { subtree: true })`** и **`fetchMaterialClasses({ category, subtree: true })`**.
- **Backend (`materials/views.py`):** функция **`texture_category_subtree_ids`**, в **`TextureItemViewSet.get_queryset`** — параметры list **`category`** + **`subtree`** (`1` / `true` / `yes`); при **`subtree`** фильтр по **`category_id__in`** и сортировка **`category_id`, `name`**.
- **Frontend (`api.ts`):** **`fetchTextureItems(params?)`** — без **`category`** обходит **все страницы** пагинации DRF (как **`fetchMaterialClasses`**); с **`{ category, subtree: true }`** — то же для выбранного дерева папок.
- **`AdminTexturesPanel.tsx`:** **`reloadItems`**, **`selectedTextureScopeIds`** для корректного **`onSaved`** при смене папки текстуры; **`confirmDeleteFolder`** — перезагрузка списка с учётом сброса выбора на корень; подсказки и **`aria-label`** обновлены.
- **`TexturePickerModal.tsx`:** **`fetchTextureItems({ category: selectedFolderId })`** — по-прежнему только **одна** выбранная папка (без **`subtree`**), для узкого выбора в модалке.

### Изменения 2026-05-17 (документирование `CALCULATION_FORMULAS`)

- Новый файл **[CALCULATION_FORMULAS.md](CALCULATION_FORMULAS.md)**: модели **`MaterialClass`**, **`CalculationFormula`**, права API, токены, семантика **`selectedClassValues`**, выбор активной формулы, UI **`/calculations`**, миграция **`0041`**, ограничения MVP.
- **README.md**, **ARCHITECTURE.md** (таблица цен и handoff), **PLAN.md** (этап 10): ссылки на руководство; в списке маршрутов после входа — **`/calculations`**.
- Полоса разделов в **README**: добавлен пункт **«Расчеты»**.

### Изменения 2026-05-17 (конструктор формул расчёта по классам)

- **Backend:** добавлена модель **`CalculationFormula`** и миграция **`0041_calculation_formula`**; API **`/api/calculation-formulas/`** отдаёт формулы публичным **GET** для калькулятора, запись доступна staff-админке. Токены формулы валидируются как JSON: классы материалов, знаки **`+ - * / ( )`**, числа.
- **Материалы и классы:** **`MaterialSummarySerializer`** теперь отдаёт **`material_class_ids`** и для сопутствующих материалов, чтобы формула могла находить выбранные клиентом материалы по классам, а не по ручным кодам.
- **Frontend:** новая вкладка админки **«Расчеты»** (`/calculations`, **`AdminCalculationsPanel.tsx`**) — список формул, кликабельные теги классов, панель знаков, ввод числа, поле собранного выражения, сохранение/удаление.
- **Калькулятор:** **`CalcPriceTotals`** и шаг **8** подгружают первую активную формулу (**`active=1`**) и считают итог через **`calculator/calculationFormula.ts`**. Если активной/валидной формулы нет — сохраняется старый расчёт профиля, наполнения и сопутствующих.
- **Проверки:** **`npm run build`**, **`.venv\Scripts\python.exe backend\manage.py check`**, **`.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run`** — зелёные.

### Изменения 2026-05-16 (импорт/экспорт материалов — связь с базой текстур)

- **`backend/materials/material_import_export.py`:** сопоставление с **`TextureItem`** по **имени файла последнего сегмента без расширения** (полный путь не используется: `Modus\инокс.jpg` → ключ **`инокс`**, **`__iexact`**).
- **Режим карточки:** **`texture_mode=texture`** только если запись в базе текстур **найдена**; иначе **`color`** и действует **`texture_color`** из HEX/RGB строки (путь в файле без совпадения не переводит материал в «текстуру» без **`texture_item`**).
- **Колонка «Текстура» пуста:** в части выгрузок (например **Modus**) путь задаётся только в **`Comment` / Примечание** строкой **`Текстура (импорт): …`** — функция **`texture_path_hint_from_material_note`**, префикс сравнивается через **`casefold`**. Приоритет по-прежнему у явной колонки **`Texture`**.
- **Экспорт:** при связанном **`texture_item`** в колонку **`Texture`** пишется **имя из базы**; **`select_related("texture_item")`** в выборке.
- **`docs/MATERIALS_IMPORT_EXPORT.md`:** правила колонки **`Texture`**, примечание, цвет vs текстура.

### Изменения 2026-05-16 (Supabase Storage — опционально)

- Полная инструкция: **`docs/SUPABASE_STORAGE.md`** (bucket, S3-ключи, переменные на Render).
- **`requirements.txt`:** **`django-storages[s3]`**; приложение **`storages`** в **`INSTALLED_APPS`** (`backend/config/settings.py`).
- **`SUPABASE_MEDIA_ENABLED`:** включает **`config.supabase_s3_media.SupabasePublicMediaStorage`**, загрузки идут в bucket через endpoint **`….storage.supabase.co/storage/v1/s3`**; **`MaterialSerializer`** / **`TextureItemSerializer`** не дублируют origin Django для уже абсолютных URL (**`backend/materials/media_urls.py`**).
- **`DEPLOY.md`**, **`backend/.env.example`**, **`docs/ARCHITECTURE.md`** — перекрёстные ссылки и комментарии.

### Изменения 2026-05-16 (текстуры на проде — сохранение и раздача файлов)

- **Проблема:** при **`DJANGO_DEBUG=False`** маршрут **`/media/`** не включался без **`DJANGO_SERVE_MEDIA`**, поэтому запись в **`TextureItem`** могла происходить (файл на диске сервиса), а превью и скачивание по URL не работали; на **Render Free** без диска файлы дополнительно теряются после рестарта.
- **`render.yaml`:** в Blueprint добавлено **`DJANGO_SERVE_MEDIA=true`**, чтобы **`/media/`** монтировался для новых деплоев.
- **`TextureItemSerializer`:** в ответе API поле **`image`** — абсолютный URL (как у **`MaterialSerializer.texture_image`**); при **создании** без файла — ошибка валидации (не создаём «пустые» записи).
- **`AdminTexturesPanel.tsx`:** после сохранения сравнение папки через **`Number(t.category)`**, чтобы новая текстура не терялась в списке при несовпадении типов.
- **`backend/.env.example`:** уточнён комментарий про **`DJANGO_SERVE_MEDIA`**.

### Изменения 2026-05-16 (админка «Текстуры» — UX начальной загрузки)

- **`AdminTexturesPanel.tsx`:** пока выполняется первый **`fetchTextureCategoryTree`** (**`loading`**), вместо одной строки «Загрузка…» в потоке — **полупрозрачный оверлей** на всю панель **`#admin-panel-textures`** с **`backdrop-filter: blur`**, по центру карточка с текстом **«Загрузка»** и **CSS-спиннером** (зацикленное вращение кольца, без GIF — меньший вес и чётче на retina). Корневому контейнеру при загрузке задаётся **`admin-body--textures-loading-host`** (**`position: relative`**). Доступность: **`role="status"`**, **`aria-busy`**, **`aria-live="polite"`**, **`aria-label`**.
- **`AdminApp.css`:** классы **`.admin-textures-loading*`**; для **`prefers-reduced-motion: reduce`** — анимация спиннера отключена, фон без blur но плотнее.

### Изменения 2026-05-16 (карточка материала — `MaterialForm`, админка)

- **Вкладки:** только **«Общие параметры»** и **«Параметры текстуры»**. Отдельная вкладка **«Доп. параметры»** убрана: макс./мин. длина и ширина вписаны в общую двухколоночную сетку формы (**`AdminApp.tsx`**), без карточки **`mat-form-params-card`**.
- **Ед. измерения и текстура:** контейнер **`mat-form-field-span-2 mat-form-uom-texture-row`** — CSS Grid **2 строки × 2 колонки**: (1) подпись «Ед. измерения» | пустая ячейка; (2) **`FtSelect`** | строка **«Текстура …»** в **`mat-form-texture-cell`** (**`flex` + `align-items: center`**), чтобы статус был по вертикали напротив **`ft-select-trigger`**, а не всего столбца «подпись + селект». Подпись связана с селектом через **`htmlFor` / `id`** (**`useId()`** в **`MaterialForm`**).
- **`FtSelect.tsx`:** у кнопки-триггера задан **`id={baseId}`** (доступность и клик по **`label`**).
- **Цена и округление:** **`mat-form-price-round-row`** — слева цена, справа чекбокс **«Округление в большую сторону до кратного числа»** и поле кратности; без галочки — **`rounding_mode: none`**; с галочкой — ввод положительной кратности (**до 8** знаков дробной части), **`1`** сохраняется как **`ceil_unit`**, иначе **`ceil_multiple`**; при сохранении пустая кратность при включённом округлении приводится к **`ceil_unit`**. Отключённое поле кратности остаётся визуально читаемым (рамка/фон, без «пропадающего» инпута).
- **Текстура на общей вкладке:** только текстовая сводка (**«Не выбрана»**, цвет, имя из базы и т.д.); настройка — на вкладке **«Параметры текстуры»**.
- **UI снят:** поле **«Толщина»** ( **`thickness`** по-прежнему в состоянии формы и уходит в API** ); placeholder у **«Артикул»`** убран.
- **Сопутствующие / модалка выбора:** **`MaterialRelatedPickModal`** — список материалов строками **`mat-list`**, без плиток папок в правой колонке.
- **Стили:** **`AdminApp.css`** — **`mat-form-uom-texture-row`**, **`mat-form-price-round-row`**, **`mat-form-rounding-*`**, **`mat-form-texture-*`**; удалены стили **`mat-form-params-*`** / **`mat-form-section-title`** для карточки параметров.
- **Мобильная вёрстка:** см. отдельный блок ниже (**`mobile.css`**, стек **`mat-form-price-round-row`** и **`mat-form-uom-texture-row`** на **`≤520px`**).

### Изменения 2026-05-16 (мобильная вёрстка для всех страниц)

- **Единый файл переопределений:** **`frontend/src/mobile.css`** подключается в **`frontend/src/main.tsx`** **после** **`./index.css`** — за счёт каскада перебивает базовые стили и десктоп-правила без `!important` (исключение — пара мест, где встроенный десктоп-стиль использовал `!important` или inline-приоритеты). Внутри три брейкпоинта: **`≤1024px`** (планшет/узкий ноутбук), **`≤768px`** (широкий телефон/маленький планшет), **`≤560px`** (телефон). Дополнительно — **`@media (hover: none)`** для тач-устройств (шестерёнки **`tree-line-actions` / `tile-gear`** всегда видимы, без `hover`).
- **`frontend/index.html`:** `lang="ru"`, **`viewport-fit=cover`** в `meta[name="viewport"]`, **`theme-color="#070708"`**, **`color-scheme=dark`**, **`format-detection=telephone=no`**, осмысленный **`title`** «Фурнитех — калькулятор фасадов» (вместо дефолтного Vite).
- **Глобально (≤1024px):** **`html` / `body` / `#root`** разлочены (`overflow: visible; height: auto; max-height: none; min-height: 100dvh`) — десктопное правило `min-width: 1025px` в **`index.css`** запирает их обратно. На мобильном скроллится документ, не отдельные колонки админки/публичной шапки. Поля ввода **`.admin-input` / `.login-input` / `.ft-select-trigger` / `textarea`** на **`≤768px`** получают **`font-size: 16px`** — иначе iOS Safari зумит страницу при тапе на input. Для устройств с вырезом — **`padding-left/right: env(safe-area-inset-*)`** на `body`.
- **Шапки (`PublicShell`, `AdminApp`):** меньше горизонтальный padding, бренд уменьшен; имя пользователя ограничено **`max-width: min(160–180px, 38–42vw)`** + ellipsis; полоса разделов **`.public-shell__section-tabs` / `.admin-section-tabs`** на узком экране — **горизонтальный скролл с инерцией** (`flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch`), без видимой полосы прокрутки (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`). На **`≤560px`** — кнопки **«Вход»/«Регистрация»/«Выйти»** и плашка пользователя оборачиваются на свою строку.
- **Калькулятор:** **`.calc-steps-tabs`** на мобиле — также горизонтальный скролл (иначе 8 пилюль не помещались). **`.calc-side-panel`** на **`≤1024px`** перестаёт держать фиксированную высоту (`height: auto; max-height: none; overflow: visible`) — шаги 1–7 и левая колонка шага 8 растягиваются по контенту, а не сжимаются в скролл-окошко. Кнопки нижней навигации **`.frame2-card-nav button`** теряют `min-width: 12rem` (иначе одна выпрыгивала во вторую строку с пустотой), на **`≤560px`** колонка кнопок реверсится (`flex-direction: column-reverse`), кнопки full-width. **`#calc-step-panel-1 .calc-card`** снимает `max-width: 700px`. Правая панель «Расчёт» (**`.calc-body-with-totals`**) сетка 1fr, без `sticky`. Эскиз **`.sketch`** — `width: 100%; max-width: 420px; margin: 0 auto`; цепочки **`.frame3-drawing`** уменьшают токены **`--frame3-dim-sketch-gap-*`** и **`--frame3-dim-vtrack`** (`22px / 18px / 22px`), боковые габариты **`.frame3-dim-drawing--left/--right`** — `width: 46px`; **`.hinge-chain-dim`** — `font-size: 0.62rem`. Плитки **`.tiles` / `.tiles--colors`** уменьшаются: `minmax(8.5rem → 7.5rem → 6.8rem, 1fr)`, `--tile-h: 230 → 210 → 200 → 180px`.
- **Шаг 8 «Итог»:** **`.step8-kv__row`** на **`≤768px`** становится одной колонкой (метка над значением); навигационная цепочка **`.step8-result__nav.frame2-card-nav` / `.step8-result__nav-end`** теряет `flex-wrap: nowrap`, кнопки «Отправить»/«Открыть PDF»/«← Назад» переносятся; на **`≤560px`** идут стеком в обратном порядке (action — первой). Таблица **`.step8-table`** уже имеет горизонтальный скролл (`.step8-table-wrap`), на телефоне ужимаем padding до `0.35rem 0.45rem`.
- **Админка «Материалы» / «Текстуры»:** на **`≤1024px`** переменные эксель-плотности **`--mat-scroll-fs` / `--mat-scroll-lh` / `--mat-scroll-ls`** поднимаются до **`0.86rem / 1.35 / 0.01em`** (вместо `0.625rem / 1.05` на десктопе) — иначе 10px-кегль на телефоне нечитаем. Тулбар папок и шестерёнки строк/папок укрупняются (`2.1rem` / `1.7rem` / `2.3rem` под палец). Список **`.mat-list-row`** в **«Материалах»** превращается из 4-колоночной сетки в карточку **`grid-template-columns: 1.6fr 1fr`**, легенда **`.mat-list-legend`** скрыта (`display: none`); имя сверху-слева, артикул — снизу-слева, ед. изм. — сверху-справа, цена — снизу-справа (цвет акцента). В **«Текстурах»** миниатюра возвращается к **40×40 px** (на десктопе была 28×28). Док **«Сопутствующие»** (**`.admin-extras-dock .mat-extras-row`**) тоже превращается в карточку из двух колонок (`1fr 1fr`), кнопка `×` — справа во второй строке.
- **Админка «Заказы» / «Пользователи»:** таблицы **`.admin-orders-table` / `.admin-users-table`** на **`≤1024px`** перерисованы в **карточный вид** (`display: block`, `thead` скрыт, `tr` — карточка с рамкой). На каждом `<td>` добавлен атрибут **`data-label`** (см. **`AdminOrdersPanel.tsx`** и блок **«Пользователи»** в **`AdminApp.tsx`**), CSS подставляет подпись через **`td::before { content: attr(data-label) }`** слева от значения (`justify-content: space-between`). На **`≤560px`** ячейки превращаются в `column` (метка сверху, значение снизу). **`FtSelect`** для статуса заказа / роли пользователя растягивается на ширину карточки.
- **Модалки:** **`.admin-modal--explorer`** (создание/перенос папки, выбор материалов) и **`.admin-modal--material-card.admin-modal--explorer`** (карточка материала/текстуры) на **`≤1024px`** идут **на весь экран** (`width: 100%; max-height: 100dvh; height: 100dvh; border-radius: 0`); внутри **`.folder-explorer`** уже было правило 1fr на `≤720px`, добавлены `max-height: 38dvh` для дерева и сетки; плитки **`.folder-explorer-tile`** компактнее. **`MaterialSearchModal`** — легенда `display: none`, строки **`.material-search-result-line`** превращаются в карточку с именем и подзаголовком (артикул / цена / классы / папка склеены через `· `, селектор **`.material-search-result-cell:not(--name) ~ :not(--name)::before { content: ' · ' }`**); чекбокс уезжает в левую колонку, span 2 ряда. **`TexturePickerModal`** **`.texture-picker-split`** — 1fr, плитки **`minmax(96px, 1fr)`**, миниатюра **64px**. Маленькие модалки **`.admin-modal`** (подтверждения) — кнопки **`.admin-modal-actions`** на **`≤560px`** идут стеком (`column-reverse`), full-width. **`frame2-modal`** (модалки шагов 2/4) — fullscreen на **`≤560px`**.
- **`LoginPage` / `RegisterPage` / `ClientMyOrdersPage`:** **`.login-wrap`** на **`≤560px`** — `align-items: stretch` + padding, **`.login-card`** растягивается на ширину окна (`max-width: 100%`), уменьшены отступы и кегль заголовка. **`.register-page__actions`** — стек full-width. **`.public-page`** — компактные отступы; **`.public-orders-card__row`** на **`≤560px`** превращается в стек (номер + статус-слева вместо `space-between`).
- **Касание/тач:** **`@media (hover: none)`** держит **`.tree-line-actions` / `.tile-gear`** видимыми всегда — на десктопе они появляются по `hover`, на телефоне без этого правила недоступны.
- **Без правок логики/роутинга:** изменения чисто визуальные. Десктоп (≥1025px) ведёт себя как раньше — за счёт того, что `mobile.css` оборачивает все правила в `@media`. Сборка `tsc -b && vite build` зелёная; объём CSS-бандла увеличился со ~115 KB до ~130 KB (gzip ~21.5 KB).

### Изменения 2026-05-16 (админка «Текстуры» — вёрстка зеркалит «Материалы»)

- **Сетка и кегль:** **`#admin-panel-textures.admin-body`** — две колонки **`minmax(220px, 280px) minmax(0, 1fr)`** + переменные **`--mat-scroll-fs/lh/ls`** (как **`#admin-panel-materials`**); правая колонка — карточки нет, форма уходит в модалку.
- **Левая колонка:** заголовок «Папки текстур» с **`HintButton`**; **`admin-folder-toolbar`** с тремя иконками (**«Создать папку»** → **`FolderCreateModal`**, **«Переименовать выбранную папку»** через **`folderRenameRequest`**, **«Удалить выбранную папку»** — модалка подтверждения, **`deleteTextureCategory`** каскадом). Импорта/экспорта на этой вкладке нет (специфично для каталога материалов).
- **Корень дерева** «База текстур»: **`folder-explorer-tree-item--materials-root`** + кнопка раскрытия **`▾/▸`** (**`texturesRootTreeExpanded`**); заголовок справа — **«Текстуры: база текстур»**. *Исторически список при **`selected == null`** был пуст; с 2026-05-17:* **`selected == null`** ⇒ **`fetchTextureItems()`** (вся база, все страницы list); выбрана папка ⇒ **`fetchTextureItems({ category: id, subtree: true })`** (см. блок **«Изменения 2026-05-17 (админка „Текстуры“…)»** выше).
- **Дерево:** **`TextureTreeRow`** переписан на **`folder-explorer-tree-*`** классы (вместо устаревших **`tree-line` / `tree-link` / `tree-gear-menu`**). Меню **⚙** на строке убрано — действия с папкой только через тулбар (как в «Материалах»). Inline-переименование сохранено через **`folderRenameRequest`** + **`useLayoutEffect`** в **`TextureTreeRow`**.
- **Список текстур:** **`mat-list-table mat-list-table--textures`** с легендой (**`Превью` / `Наименование`**); каждая строка — **`mat-list-row mat-list-row--texture`** + **`button.mat-list-gear-btn`** (та же иконка **cog-6-tooth**, что у материалов). Клик по строке/Enter/Space или клик по шестерёнке — открывают **карточку текстуры** в модалке. Миниатюра в строке уменьшена до **28×28** (правило **`#admin-panel-textures .mat-list-tex-thumb`**), сетка строки — **`32px minmax(0, 1fr)`** (перебивает дефолт 52px у **`.mat-list-table--textures`** через **`!important`**).
- **Карточка текстуры:** теперь в портале — **`createPortal`** + **`admin-modal admin-modal--explorer admin-modal--material-card`**, секция **`admin-panel admin-panel--in-material-modal`**; форма **`TextureCardForm`** прежняя (имя + файл + предпросмотр + удаление с подтверждением через **`admin-modal-backdrop--stack-top`** / **`admin-modal--elevated`**). При сохранении **`onSaved`** учитывает смену **`category`** и **область списка** (корень vs поддерево выбранной папки — см. **`selectedTextureScopeIds`** в актуальной версии **`AdminTexturesPanel`**).
- **DnD:** новый MIME **`DND_TEXTURE_ITEM = application/x-furnitech-texture-item-move`** в **`folderMoveDnD.ts`** + хелпер **`isTextureItemDrag`**; общие **`DND_FOLDER` / `isFolderDrag`** переиспользуются.
  - **Папки:** строка **`TextureTreeRow`** — **`draggable`**, drop на другую строку папки, на «База текстур» (в корень — **`parent: null`**) или в область **`admin-main-scroll`** при открытой папке (**`onMainTexturesDragOver` / `onMainTexturesDrop`**); проверки **`isAllowedFolderTarget`** и **`collectSubtreeCategoryIds`** как в «Материалах», PATCH **`/api/texture-categories/{id}/`**.
  - **Текстуры:** **`mat-list-row--texture`** — **`draggable`**, **`onDragStart`** ставит **`DND_TEXTURE_ITEM`**; drop на строку папки в дереве (**`onDropTextureOnFolder`**) или в **`admin-main-scroll`** выбранной папки → **`updateTextureItem(id, { category })`**, перезагрузка списка. На «База текстур» текстуру бросить нельзя (категория обязательна) — текст ошибки и **`dropEffect: 'none'`**.
- **CSS:** **`#admin-panel-textures`** правила в **`AdminApp.css`** мирят кегль/плотность тулбара, дерева, заголовка списка, кнопки **«+ Текстура»**, легенды, строк и шестерёнки с материалами; mobile-фолбэк (`@media (max-width: 1024px)`) — `grid-template-columns: 1fr` для **`#admin-panel-textures.admin-body`**.

### Изменения 2026-05-14 (админка «Материалы» — иконка карточки; Git и Vercel Hobby)

- **Кнопка карточки в списке материалов** (**`button.mat-list-gear-btn`**, **`AdminApp.tsx`**): вместо иконки «круг + лучи» — **шестерёнка** (outline **cog-6-tooth**, два **`path`** в **`svg`**, как в Heroicons), **`stroke`** **`currentColor`**. Подсказка **`title`**: **«Открыть карточку материала»**.
- **Vercel (Hobby), статус «Blocked»:** деплой блокируется, если **автор коммита** (email в объекте коммита Git) **не имеет** contributing access к проекту Vercel; на Hobby **нет полноценной коллаборации** по чужим email. Триггеры: trailer **`Co-authored-by: Cursor &lt;cursoragent@cursor.com&gt;`** (агент Cursor); коммиты с личным email, не привязанным к участнику команды Vercel. Решение: коммиты от GitHub-пользователя репо заказчика (**например** **`furnitechdev-maker`** с **`…@users.noreply.github.com`**, точный no-reply см. **GitHub → Settings → Email**); убрать **`Co-authored-by`** из сообщения; проект Vercel должен быть подключён к **тому же** репозиторию, куда пушите (**`furnitechdev-maker/Furnitech_Calc`**).
- **Локальный клон (в этом репо):** в **`.git/config`** заданы **`user.name` / `user.email`** только для этого репозитория (**`furnitechdev-maker`** + **`users.noreply.github.com`**) и **`remote.pushDefault = customer`**, чтобы **`git push`** без аргумента remote уходил в **`customer`**; ветка **`main`** по-прежнему отслеживает **`origin/main`** для **`git pull`**. Синхронизация с **`origin`**: алиас **`git push-mine`** (см. [README.md](../README.md)).
- **Перепись вершины `main` без trailer / с нужным автором:** при необходимости обхода хуков, добавляющих **`Co-authored-by`**, можно собрать объект коммита через **`"C:\Program Files\Git\bin\git.exe" commit-tree …`** (обёртка **`Git\cmd\git.exe`** в среде агента могла вести себя иначе).

### Изменения 2026-05-12 (админка «Материалы» — DnD, «Все папки», без отдельного поиска)

- **Убрано с панели иконок:** кнопка **«Поиск материалов»** и открытие **`MaterialSearchModal`** в режиме **`navigate`** с этой вкладки (**`MaterialSearchModal`** по-прежнему используется в **калькуляторе** — шаги 2, 4, каталог петель и т.д.). Кнопка **«Переместить выбранную папку»** и привязка **`FolderMoveModal`** к вкладке материалов (**`FolderMoveModal`** остаётся для **текстур** — **`AdminTexturesPanel`**).
- **Корень дерева на странице:** кнопка **«Все папки»** (**`folder-explorer-root`**, иконка 🗂️) **над** **`ul.folder-explorer-tree-root.admin-materials-tree-root`**, как корень в Explorer-модалках. При выборе **`selected == null`**: **`GET /api/materials/`** без фильтра категории через **`fetchMaterialsFiltered({})`** — полный список материалов в правой колонке; заголовок: **«Материалы: все папки»**.
- **Общий модуль DnD:** **`frontend/src/folderMoveDnD.ts`** — константы **`DND_FOLDER`**, **`DND_MATERIAL`**, функции **`isFolderDrag`**, **`isMaterialDrag`**; подключение в **`FolderMoveModal.tsx`** (вместо локальных копий) и **`AdminApp.tsx`**.
- **DnD папок на странице:** строка **`TreeRow`** перетаскивается на другую папку в дереве, на **«Все папки»** (в корень, **`parent: null`**) или на область **`admin-main-scroll`** при открытой конкретной папке — целевой родитель = **`selected`**. Проверки как в **`FolderMoveModal`**: нельзя опустить папку в себя или в потомка, нельзя без изменения родителя; сообщения об ошибках через **`setErr`**.
- **DnD материалов:** у строки списка (**`mat-list-row`**) **`draggable`**, **`onDragStart`** задаёт **`DND_MATERIAL`**. Сброс на строку папки в дереве (**`TreeRow`**, обработчики **`onDrop` / `onDragOver`**) или на **`admin-main-scroll`** при **`selected != null`** — **`PATCH /api/materials/{id}/`** с **`category`**, обновление списка (**`fetchMaterials(..., { subtree: true })`** или **`fetchMaterialsFiltered({})`**). На **«Все папки»** материал **не** принимается (у материала обязательна категория в БД) — **`dropEffect: 'none'`** и текст ошибки, как в модалке перемещения.
- **Карточка материала:** портал **`MaterialForm`** открывается при **`editing && (editing !== 'new' || selected != null)`** — редактирование существующего материала доступно и из режима **«Все папки»**; **`categoryId={editing === 'new' ? selected! : (editing as Material).category}`**. Кнопка **«+ Материал»** при **`selected == null`** **disabled** с **`title`** про необходимость выбрать папку.
- **Удаление папки / импорт:** после операций список материалов перезагружается с учётом режима (ветка vs все) — см. **`confirmDeleteFolder`** и **`onMaterialsImportFile`** в **`AdminApp.tsx`**.
- **Стили:** **`#admin-panel-materials .admin-aside > .folder-explorer-root`** — ширина, отступы, кегль в линию с **`--mat-scroll-*`** (**`AdminApp.css`**).
- **`HintButton`** у блока «Папки материалов» обновлён: сценарий перетаскивания вместо отдельного поиска и модалки «Переместить».

### Изменения 2026-05-12 (админка «Материалы» — типографика и заголовок)

- **Заголовок списка:** **`Материалы в папке: {имя}`** — имя из **`findCategoryNode(tree, selected)`** (**`AdminApp.tsx`**); **`HintButton`** у этой строки **удалён** (подсказка у дерева папок слева сохранена).
- **Единый шрифт и кегль** в обеих колонках вкладки (**`#admin-panel-materials.admin-body`** в **`AdminApp.css`**): CSS‑переменные **`--mat-scroll-fs`** (**0.625rem**), **`--mat-scroll-lh`** (**1.05**), **`--mat-scroll-ls`** (**0.02em**) — в **`admin-aside`** (заголовок «Папки материалов», **`HintButton`**, тулбар папок, дерево **`folder-explorer-tree-line`**) и в **`admin-main-scroll`** (заголовок списка, **«+ Материал»**, легенда, строки **`mat-list-row`**, **`mat-list-cell*`**).
- **Плотная вёрстка:** уменьшены **`gap`**, отступы у легенды/кнопки/строк, **`margin-top`** у **`mat-list-table`** (в т.ч. отрицательный подтяг к кнопке); компактная **шестерёнка** в строке.
- **Исправление CSS:** восстановлен селектор **`.mat-list-cell`** (раньше свойства висели без селектора).

### Изменения 2026-05-11 (админка «Материалы» — карточка и сопутствующие)

- **Сетка:** у **`#admin-panel-materials`** две колонки (**`aside`** + **`admin-main-col`**), без правой колонки карточки — список шире (**`AdminApp.css`**: **`#admin-panel-materials.admin-body`**).
- **Список материалов:** строка — **`div.mat-list-row`** (клик / Enter / Space): открывает **модалку сопутствующих** (**`createPortal`** → **`admin-modal-backdrop`** + **`admin-modal--explorer admin-modal--extras`** с **`MaterialExtrasPanel`**). Справа — **`button.mat-list-gear-btn`** (иконка **шестерёнки** cog-6-tooth в **`svg`**): **модалка полной карточки** (**`admin-modal--material-card`** + **`MaterialForm`**). Перед открытием карточки **`setExtrasTarget(null)`**; **Escape** / клик по backdrop / смена вкладки **`section`** закрывают модалку сопутствующих (при сохранении не мешают).
- **Сопутствующие:** **`saveExtras`** — **`PATCH`** только **`related_items`**; кнопки **«Сохранить»** / **«Закрыть»** в футере модалки.
- **`MaterialForm`:** без **`extraHost`**; сопутствующие в модалке карточки не дублируются. Заголовок карточки: **`#material-card-dialog-title`**.
- **Модалка карточки:** **`admin-modal--material-card`**; вложенные диалоги — **`admin-modal-backdrop--stack-top`** / **`--elevated`**.

### Изменения 2026-05-11 (миграции, CORS, фронт dev/prod)

- **Миграция `materials.0040`:** **`AlterField`** **`import_export_snapshot`** (согласование **`verbose_name`** / **`help_text`** с моделью после **`0039`**). Без неё **`manage.py migrate`** на чистой БД / Render может предупреждать о расхождении моделей и миграций.
- **Backend `settings.py`:** опционально **`CORS_ALLOW_VERCEL=true`** — regex **`*.vercel.app`** для preview; свой домен на Vercel по-прежнему в **`CORS_ALLOWED_ORIGINS`** явно.
- **`backend/.env.example`:** расшифровка **`CORS_ALLOWED_ORIGINS`** / **`DJANGO_CSRF_TRUSTED_ORIGINS`** для Vercel; комментарий про **`CORS_ALLOW_VERCEL`**.
- **`frontend/.env.development`:** пустой **`VITE_API_ORIGIN`**, чтобы **`npm run dev`** ходил через proxy Vite на **`localhost:8000`** (не на прод Render). **`frontend/.env.example`** — предупреждение не копировать прод-URL в **`frontend/.env`** без правки.
- **`frontend/src/auth.ts`:** при сетевой ошибке входа — понятное сообщение (CORS / «сон» Render).

### Изменения 2026-05-10 (импорт/экспорт — переименование)

- Документация: **[docs/MATERIALS_IMPORT_EXPORT.md](MATERIALS_IMPORT_EXPORT.md)**.
- API: **`GET /api/materials-export/`**, **`POST /api/materials-import/`**; права **`MaterialExportPermission`**, **`MaterialImportPermission`**; методы вью **`export_materials_table`**, **`import_materials_table`**.
- Модуль **`material_import_export.py`**; поле модели **`import_export_snapshot`** (миграция **`0039`** — переименование поля снимка строки таблицы).
- Фронт: **`importMaterialsTable`**, **`downloadMaterialsExport`**, **`MaterialsImportResult`**, **`MaterialsExportFormat`**; файлы скачивания **`materials-catalog.*`**.

### Изменения 2026-05-10 (часть 2 — калькулятор UI и копирайт)

- **`CalculatorPage.css` — `.calc-side-panel`:** колонка **flex** с **`overflow: hidden`**; прокрутка только **`.calc-side-panel-scroll`** — шапка (**`admin-heading-row`**, **`frame2-card-head`**) и **`frame2-card-nav`** остаются на экране. Обернуты шаги 1–7, МДФ/ПВХ, левая колонка шага 8.
- **Шаг 1:** **`frame3-title`** «Выберите тип фасада»; импорт **`Step3FrameSizes.css`** в **`CalculatorPage.tsx`**.
- **Шаг 3:** заголовок **«Укажите габаритные размеры»** (**`frame3-title`**, **`role="heading"`**).
- **Шаг 4:** **`frame3-title`** «Выберите тип наполнения»; убраны **`frame2-lead`**, **`h4`** «Типы наполнения»; **`frame2-card-head`** только при **`!readOnly`**.
- **Шаг 5:** убран заголовок **«Итоговый эскиз»**; **`FrameHingeMortisePanel`**: **«Присадки»** (**`frame3-title`**), селекты — **`FtSelect`** (**`menuStrategy="inline"`**), **`FrameHingeMortisePanel.css`**.
- **Шаг 6:** заголовок **«Расстояния»**; убран длинный **`frame3-sub`**; **`hingeAbsoluteToUserInputStrings`** — **целые мм, округление вверх** (**`Math.ceil`**).
- **Шаг 7:** убраны кикер **«Шаг 7»**, **`frame3-sub`**, **«Пропустить шаг»**, подсказка про петли; заголовок **«Отверстия под ручку»** (**`frame3-title`**).
- **Шаг 8:** убран кикер **«Шаг 8»**; форма **`id="step8-contact-form"`**; кнопки **«Отправить»**, **«Открыть PDF»**, **«← Назад»** в **`frame2-card-nav`** (submit через **`form=`**); одна строка — **`Step8FrameResult.css`** (**`flex-wrap: nowrap`**, **`min-width`** кнопок); **«Добавить фасад»**; модалка и **`AdminOrdersPanel`** — текст **«Отправить»** вместо «Отправить менеджеру».
- **`Step2FrameFacade.css`:** удалён неиспользуемый **`.frame2-lead`** (после правок шага 4).

### Изменения 2026-05-10 (сводка для документации)

- **`CalculatorPage.tsx`:** убраны подзаголовки **`h3.calc-h3`** в **`calc-card`** на всех шагах («Рамочный фасад», «— наполнение» и т.д.); убрана строка «Доступно профилей» в **`calc-head`** и запрос **`fetchCalculatorProfiles`** для неё; **`CalculatorPageInner`** без пропсов.
- **Шаг 2 (`Step2FrameFacade`):** заголовок панели в стиле **`frame3-title`** («Выберите тип профиля и цвет»), подключён **`Step3FrameSizes.css`**; удалён **`h4`** «Типы профилей», остаётся блок с **«+ Добавить тип профиля»** (не **`readOnly`**).
- **Шаг 3 (`Step3FrameSizes`):** удалён **`frame3-sub`**; заголовок **«Укажите габаритные размеры»** (**`frame3-title`**, **`aria-level={3}`**).
- **Шаг 4:** три фото карточки типа наполнения (модель/миграция **`0036`**, **`Step4FrameFilling`** — тот же паттерн, что шаг 2: **`calculatorCardTiles`**, **`MaterialSearchModal`**, **`--profile-type-slim`**, «Материалы для карточки»).
- **Шаг 5 (`FrameHingeCatalog`):** три фото карточки типа петель (модель/миграция **`0037`**), выбор материалов через **`MaterialSearchModal`** вместо текстового поиска; заголовок секции «Тип петель»; UI как шаги 2 и 4.
- **`calculatorCardTiles.tsx` — `CalculatorCardTileStriped`:** после наведения на полоску кадр **сохраняется** при уходе мыши со стека (**`activeIdx`**), сброс при смене **`versionKey`**.
- **Шаг 6:** минимум **2** петли — **`HINGE_LAYOUT_COUNT_MIN`**, **`readHingeLayout`** отклоняет **`count < 2`**; поле числа **`min={2}`**.

### Справочник: тип профиля калькулятора — до 3 фото карточки (шаг 2)

Ниже зафиксировано текущее поведение **без привязки к одной дате** (удобно искать в репозитории по именам символов).

**Бэкенд (`materials`)**

- Модель **`CalculatorProfileType`**: помимо **`image_url`** (строка URL, опционально) и **`card_image`** — поля **`card_image_2`**, **`card_image_3`** (`ImageField`, **`upload_to="profile_types/"`**, `null`/`blank`). Порядок слотов на фронте: **1** = `card_image` или, если файла нет, **`image_url`**; **2** = `card_image_2`; **3** = `card_image_3`.
- Миграция **`0035_calculatorprofiletype_card_image_2_3`**.
- **`CalculatorProfileTypeSerializer`**: в **`Meta.fields`** все три файла; **`ImageField(required=False, allow_null=True)`** для каждого. Создание/обновление с цветами: **`colors`** в multipart как JSON-строка (как раньше). **PATCH** без файлов не затирает картинки; в **FormData** передаются только те ключи **`card_image` / `card_image_2` / `card_image_3`**, которые нужно заменить.

**Фронтенд**

- **`types.ts`**: у **`CalculatorProfileType`** опциональные **`card_image_2?`**, **`card_image_3?`** (в ответе API — URL в **`/media/...`**).
- **`Step2FrameFacade.tsx`** (и общий модуль **`calculatorCardTiles.tsx`**):
  - В сетке типов превью — **`CalculatorCardTileStriped`**: **`.tile-thumb-stack`**, **`.tile-card-stripes`**, сегменты **`.tile-card-stripe`**; наведение задаёт активный кадр, **последний выбранный кадр сохраняется** при уходе мыши (**`activeIdx`**), при смене плитки (**`versionKey`**) — снова первый кадр. Высота полосок **6px**; **`--active`** / **`:hover`** без смены высоты.
  - Формы **создать / редактировать тип** (не **`readOnly`**): три скрытых **`input type="file"`**; **`ProfileCardImageTileRow`** — ряд **`.frame2-card-image-tile`**. Сетка: **`frame2-create-grid--file-status-pair`** + **`frame2-create-grid--profile-type-slim`**: слева тип и фото, справа **«Поиск»**, **«Цвета для карточки»** и чеклист.
  - Тот же паттерн плиток и форм — **шаг 4** (**`Step4FrameFilling`**, наполнение, миграция **`0036`**) и **`FrameHingeCatalog`** (типы петель, миграция **`0037`**); у наполнения/петель подпись **«Материалы для карточки»**.
- **`Step2FrameFacade.css`**: стили полосок (**`.tile-card-stripes`**, **`.tile-card-stripe`**, **`--active`**, **`:hover`**), плиток выбора файла (**`.frame2-card-image-tile-row`**, **`.frame2-card-image-tile*`**), модификатор **`--profile-type-slim`** (в т.ч. в **`@media`**).

**API-клиент (`api.ts`)**

- **`createCalculatorProfileType` / `updateCalculatorProfileType`**: тело **`FormData`** или JSON; файлы добавляются полями **`card_image`**, **`card_image_2`**, **`card_image_3`**. Для **`apiFetch`** при **`FormData`** заголовок **`Content-Type`** не задаётся вручную (граница multipart задаётся браузером).

### Изменения 2026-05-09 (факт)

- **База текстур (админка заказчика)**  
  - Backend: модели **`TextureCategory`**, **`TextureItem`**, поле **`Material.texture_item`** (`SET_NULL`), миграция **`0033_texture_library`**; API **`/api/texture-categories/`** (в т.ч. `?tree=1`), **`/api/texture-items/`** (`?category=`), права для группы «Редактор материалов».  
  - SPA: маршрут **`/textures`**, вкладка **«Текстуры»** в **`AdminApp`**, модуль **`AdminTexturesPanel`** (дерево папок, список, карточка с загрузкой **`image`**).  
  - В карточке материала вкладка «Параметры текстуры»: выбор картинки через **`TexturePickerModal`** (дерево базы), поля **`texture_library_item`** / **`texture_library_item_name`**; превью и публичный калькулятор получают **эффективный** URL из **`MaterialSerializer`**.  
  - Вспомогательно: **`FolderMoveModal`** поддерживает подгрузку элементов папки не только материалов (**`fetchItemsInFolder`** — для текстур).
- **Удалены «Операции» у материала** (миграция **`0032_remove_material_operation_line`**): модель, админка, сериализатор, фронт панели и расчёты/PDF без строк операций (см. более ранние коммиты в этой ветке).

### Изменения 2026-05-09 (часть 6 — поиск материалов, шаги 2/4, карточка)

- **`MaterialSearchModal`** (`frontend/src/MaterialSearchModal.tsx`):
  - **`mode="multiPick"`** (по умолчанию, калькулятор шаги **2** и **4**): чекбоксы у строк; отмеченные материалы **не сбрасываются** при смене папки или фильтров — хранение в **`Map<id, Material>`**; в шапке таблицы — чекбокс **«выбрать все»** для текущей выдачи (состояние **`indeterminate`** при частичном выборе); кнопка **«Добавить (N)»**; **`onPick(materials[])`**.
  - **`mode="navigate"`** (вкладка **«Материалы»** в SPA): без чекбоксов и колонки выбора; клик по строке **подсвечивает** её; **«Перейти»** — **`setSelected(category)`** + **`fetchMaterial`** → открытие карточки; классы **`.material-search-results-table--navigate`**, **`.material-search-result-line--selected`** (**`AdminApp.css`**); клавиатура: второй **Enter** на выделенной строке — переход.
  - Удалён блок подсказки **`material-search-filters-hint`** (и связанные стили).
  - Экспорт типов: **`MaterialSearchModalProps`**, **`MultiPickMaterialSearchProps`**, **`NavigateMaterialSearchProps`**.
- **Админка (до 2026-05-12):** кнопка **«Поиск»** у дерева папок открывала **`MaterialSearchModal`** в **`mode="navigate"`**. С **2026-05-12** отдельный поиск с вкладки материалов **снят** — навигация к карточке через дерево + список и DnD; см. блок **«Изменения 2026-05-12 — DnD, „Все папки“»** выше.
- **Деревья папок:** в меню **⚙** пункты **«Переместить»** и **«Удалить»** без символа **«…»** (`AdminApp` **`TreeRow`**, **`AdminTexturesPanel`** **`TextureTreeRow`**).
- **Калькулятор, шаги 2 и 4** (`Step2FrameFacade`, `Step4FrameFilling`, общий **`Step2FrameFacade.css`**):
  - Строки **`.frame2-checkrow`** / чеклист **`.frame2-checklist`** ограничены шириной **`.frame2-create`** (`min-width: 0`, **`width: 100%`**, однострочный ellipsis для длинного **`materialTextureLabel`**).
  - Плитки в модалках цвета/наполнения: подпись текстуры берёт **`texture_library_item_name`** из вложенного материала, иначе имя файла / **`name`** (**`materialTextureLabel.ts`**). Backend: в **`MaterialSummarySerializer`** добавлено **`texture_library_item_name`** (как у полного **`MaterialSerializer`**), чтобы в **`/api/calculator-profile-types/`** и **`/api/calculator-filling-types/`** приходило имя записи из базы текстур; на фронте типы вложенных материалов расширены опциональными полями библиотеки; при отображении плиток данные **склеиваются** с **`texByMaterialId`** после **`fetchMaterial`**.
- **Шаг 4:** на плитках типов наполнения — то же меню **⚙**, что на шаге 2 (**`tree-gear-menu`**: «Редактировать», «Удалить»), подтверждение удаления типа через **`createPortal`** (**`fillingTypeDeleteModal`**); кнопка **«Удалить тип»** в шапке списка типов убрана. Закрытие меню по клику вне и **Escape** (**`gearMenuFillingTypeId`**).
- **`MaterialForm` (карточка материала в SPA):** элемент управления **`is_active`** («Активен») **удалён**; при **POST/PATCH** в тело по-прежнему передаётся **`is_active: material?.is_active ?? true`** (новый материал активен; у существующего флаг не меняется из этой формы). Изменение **`is_active`** — через **Django admin** (`/admin/django/`).

### Изменения 2026-05-10 (дерево материалов, FolderMoveModal, Explorer)

- **Колонка «Папки материалов» (`AdminApp`):** строки дерева используют те же классы, что дерево в Explorer (**`folder-explorer-tree-line`**, **`folder-explorer-tree-link`**, иконка 📁), без вложенной тёмной панели **`folder-explorer-tree`** — список **`ul.folder-explorer-tree-root.admin-materials-tree-root`** сразу в **`aside.admin-aside`**; разделитель над деревом (**`admin-materials-tree-root`** в **`AdminApp.css`**). Показ шестерёнки при **`hover`** на **`folder-explorer-tree-line`**.
- **`MaterialSearchModal` / `FolderCreateModal` / `FolderMoveModal`:** подпись корня дерева **`ROOT_LABEL`** — **«Все папки»** (без «(корень)»); тексты подсказок в **`FolderMoveModal`** обновлены.
- **`FolderMoveModal` (материалы и текстуры):**
  - **Папки:** перетаскивание **любой** папки (не только открытой из меню ⚙): в **`dataTransfer`** тип **`application/x-furnitech-folder-move`**, id источника в payload; цель — строка дерева, **«Все папки»**, плитка 📁 **справа**; проверка **`isAllowedTarget(newParent, movingId)`** (нельзя в себя/потомков, нельзя оставить того же родителя). После успешного **`PATCH`** модалка **не закрывается**; сбрасывается кэш **`materialsByFolder`**, чтобы справа подгрузились свежие списки.
  - **Футер:** одна кнопка **«Закрыть»** (нет «Отмена» / «Переместить сюда»); фон и **Escape** не закрывают окно во время **`submitting`** или активного DnD.
  - **Материалы (только вкладка материалов):** опциональный **`onMoveMaterial`** — DnD плитки 📄 на папку (дерево или 📁), MIME **`application/x-furnitech-material-move`**; **`PATCH /api/materials/{id}/`** с **`category`**; в **`AdminApp`** — **`applyMaterialMove`**. В корень («Все папки») материал бросить нельзя (нет категории).
  - Плитки папок справа: **`draggable`**, те же обработчики, что у дерева; класс **`folder-explorer-tile--drag-source`** при переносе.
  - **Стили (`AdminApp.css`):** **`cursor: grab`** для плиток папок; подсветка **`:hover`** у **`.folder-explorer-tile--material.folder-explorer-tile--draggable`** как у **`button.folder-explorer-tile:hover`**.
- **`AdminApp.tsx` (исторически):** в **`FolderMoveModal`** передавались **`onMove`**, **`onMoveMaterial`**. С **2026-05-12** на вкладке **«Материалы»** модалка перемещения **не** монтируется — перенос папок и материалов **на странице** (см. блок DnD выше); **`FolderMoveModal`** остаётся для **текстур**.
- **Материал — удалены поля** **`designation`**, **`cut_coeff`**, **`calc_type`**: миграция **`0034_remove_material_designation_cut_coeff_calc_type`**; **`MaterialSerializer`**; вкладка «Доп. параметры» в **`MaterialForm`**; тип **`Material`** в **`types.ts`**. Ориентировочная цена в **`framePriceEstimate.ts`** опирается только на **ед. изм.** материала (ветка «лента» по **`calc_type`** убрана — для периметра нужна корректная UoM, напр. **м.п.**).
- **Калькулятор, шаг 2 — тип профиля: до 3 фото карточки:** см. блок **«Справочник: тип профиля калькулятора — до 3 фото карточки»** выше (миграция **`0035`**, плитки **`ProfileCardImageTileRow`**, превью в сетке — **`CalculatorCardTileStriped`**, сетка **`--profile-type-slim`**).

## Краткая сводка

Проект: **Django + DRF (JWT)** + **Vite + React 19 (TS)** — веб‑админка справочника материалов + **калькулятор** (админский и **публичный**).

**Публичная часть (без входа):** маршрут **`/`** — тот же сценарий шагов, что и в админке, но URL **без** префикса `/calculator`: `/` (шаг 1), `/frame`, `/frame/size`, `/frame/filling`, `/frame/summary`, `/frame/hinge-layout`, `/frame/handle-holes`, **`/frame/result`** (итог), `/mdf`, `/pvc`. Дополнительно **`/my-orders`** — **«Мои заказы»**: список заказов клиента из **`/api/facade-orders/`** (номер **`З-000001`**, краткий статус, **`HintButton`** с пояснением, ссылка на PDF); гостю — предложение войти (**`state.from`** → `/my-orders`). Редирект **`/guide`** → **`/`** (зарезервированный URL). Режим **только чтение**: нет кнопок добавления/удаления/редактирования типов профилей и наполнения, типов **петель**, нет добавления материалов в тип наполнения из модалки. Шапка **`PublicShell`**: бренд; полоса вкладок **«Калькулятор»** / **«Мои заказы»** (стили как в админке); «Вход» / «Регистрация»; для вошедшего **сотрудника** — подпись **email или логин** + «Админка»; для **клиента** (без `is_staff`) — подпись + «Выйти» (**`window.location.replace('/')`**). Контент под вкладками в **`public-shell__main`** с **`overflow-y: auto`** (на десктопе `#root` с `overflow: hidden` — иначе длинный шаг 8 обрезался). Регистрация: **`/register`**.

**Админка (после `/login`, только `is_staff` или `is_superuser`):** `/materials`, **`/textures`** (база именованных текстур), `/calculator`, `/orders`, **`/users`** — полный калькулятор с префиксом **`/calculator/...`**, всеми админ‑действиями на шагах 2, 4 и в каталоге петель на шаге 5; вкладка **«Пользователи»** — учётные записи и роли для веб-панели заказчика. Шапка **`AdminApp`**: верхняя полоса **`admin-header-top`** (бренд + пользователь + «Выйти»), ниже **`nav.admin-section-tabs`** — пилюли разделов (**`admin-section-tab`**) в том же визуальном стиле, что **`public-shell__section-tabs`**.

Реализовано: дерево **папок** (создание в модалке Explorer; **перенос** на вкладке **«Материалы»** — **DnD** на странице; в **текстурах** — по-прежнему **`FolderMoveModal`** с DnD внутри модалки; удаление папок **каскадом**: вложенные папки и материалы). **Поиск материалов** — **`MaterialSearchModal`** в **калькуляторе** (шаги 2/4 и др., **мультивыбор**); на вкладке **«Материалы»** отдельная кнопка поиска **снята** (2026-05-12). На бэкенде — гибкий поиск **`rapidfuzz`**. Список материалов, карточка с вкладками, **сопутствующие**, **уникальный непустой артикул**. Калькулятор (рамочный): **шаг 2** — тип профиля и цвет (**«Поиск»** открывает ту же модалку для выбора цветов-материалов пакетно), эскиз с пропорциями как у шага 3 (**`facadeSketchBoxStyle`**, дефолт габаритов **500×200** мм); **шаг 3** — габариты (`/…/frame/size`); **шаг 4** — наполнение (`/…/frame/filling`), типы **`CalculatorFillingType`**, добавление материалов в тип через **«Поиск»** / **`MaterialSearchModal`** (как на шаге 2), `localStorage` `calc_filling_type_id` / `calc_filling_material_id`; **шаг 5** — присадка и итоговый эскиз (`/…/frame/summary`): выбор «не требуется» / «присадки под петли», источник петель (заказчик / производство), каталог **`CalculatorHingeType`** (как типы наполнения; API **`/api/calculator-hinge-types/`**); при **«не требуется»** шаг **6** пропускается по маршруту (вкладка видна, но неактивна), переход сразу на **шаг 7**; **шаг 6** — расстояния петель (`/…/frame/hinge-layout`): сторона, **2…10** отверстий, ввод **парами** (№1↔№n, №2↔№n−1… от начала/конца кромки по правилам `hingeMeasuresFromEdgeStart`), в **`calc_hinge_layout`** хранятся **абсолютные мм** `positionsMm` от начала выбранной кромки (пересчёт **`hingeUserInputsToAbsoluteMm`** / **`hingeAbsoluteToUserInputStrings`**), дефолты: **`defaultHingeAbsPositionsMm`** — **равномерно** вдоль кромки длины **L**: **n+1** равных промежутков, петля **i** на **(i+1)·L/(n+1)** мм от начала кромки, при **смене стороны** — сброс полей и **`writeHingeLayout(null)`**; валидация **`validateHingePositions`** по длине стороны; эскиз с маркерами и цепочкой выносных размеров (габарит основной линии с **противоположной** стороны от петель, узкие сегменты **`hinge-chain-dim--narrow`**, ориентация подписей цепочек); **шаг 7** — отверстия под ручку (`/…/frame/handle-holes`): число (**0…10**, по умолчанию **0** — ручка не задана, поле можно очистить при вводе), диаметр (справочник **`CalculatorHandleHoleDiameter`**, API **`/api/calculator-handle-hole-diameters/`**; в админ-калькуляторе **`HandleHoleDiameterAdminSelect`** — видимость для клиента, добавление/удаление размера с подтверждением), втулки, ориентация вертикальная/горизонтальная, сторона (**вертикаль** — слева/справа, **горизонталь** — сверху/снизу), межосевые и смещение первого центра; **`calc_handle_holes`**, запрет стороны при совпадении с петлями (**`isHandleSideBlockedByHinges`**), эскиз с маркерами **`sketch-handle-pin`** (при **0** отверстий — только габариты как на шаге 5); **шаг 8 «Итог»** (`/…/frame/result`) — сводка конфигурации, контакты, таблица ориентировочной стоимости (**`Step8FrameResult`**), **PDF** (**`frameClientPdf.ts`**). **Клиент на публичном сайте:** гость при **«Отправить»** видит **модалку** (`admin-modal-backdrop` / `createPortal`) — войти или зарегистрироваться (**`state.from`** на текущий шаг); **клиент (не staff)** отправляет **multipart** на **`POST /api/facade-orders/`** (PDF + **`snapshot`** JSON + контакты), затем **`nav('/my-orders', { replace: true })`**; на публичном калькуляторе (**`readOnly`**) обязательны **имя, телефон, email** (метка * **`step8-form__req`**, `required`, кнопка неактивна пока не заполнено; **`staffOnSession`** снимает обязательность для сотрудника в почтовом сценарии). **Сотрудник** на шаге 8 по-прежнему **mailto**. **Заказы:** модель **`FacadeOrder`** (миграция **`0029_facade_orders`**), вкладка **«Заказы»** — **`AdminOrdersPanel`** (таблица без колонки «Детали», **`FtSelect`** статуса, PDF); статусы: не подтверждён / подтверждён / в процессе сборки / готов к выдаче / завершён. Склейка шагов через `localStorage` + **`calc-frame-session`** (`frameCalcSession.ts`). **Ориентировочная цена** — панель справа (`CalcPriceTotals`), расчёт в **`calculator/framePriceEstimate.ts`**: геометрия по ед. изм. материала (м² / **периметр в м.п.** `2(H+W)` / шт), сопутствующие (масштаб **`quantity_scale`**). Шаг 1: только текст-подсказка; при выборе фасада — **`clearFrameCalculatorStorage()`**. Шаг 3: **`calc_frame_qty`**, гидратация габаритов из `localStorage` (**дефолт 500×200** при пустых ключах после сброса). Удаление материала: **модалка** в `MaterialForm`; каскад калькулятора — миграция **`0020`**. Контекст маршрутов: **`calculator/calcPathsContext.tsx`** (`step()`, `readOnly`, `home`).

### Изменения 2026-04-28 (факт)

- **Калькулятор: панель «Расчёт»**
  - Скрыта на шагах **1–2**, появляется с шага **3** (после ввода размеров).
  - Исправлено: операции учитываются не только у профиля, но и у **наполнения**.
  - Улучшено пояснение по ед. изм. (показывается площадь/периметр на 1 фасад и ед. изм. профиля/наполнения отдельно).
- **UI: тёмная тема + единый стиль**
  - Добавлены токены темы (`--ft-*`), подключены шрифты (DM Sans + condensed‑display аналог).
  - Приведены к единому стилю: кнопки/инпуты/select/подсказки/модалки, в т.ч. калькулятор шаги 2–4 (плитки, навигация, модалки, выносные размеры).
  - Глобальный фон с текстурой дерева “за всеми секциями”: `#root::before` (см. `frontend/src/App.css`, текстура `frontend/src/assets/wood.png`).
  - Стилизован скроллбар глобально (`frontend/src/index.css`).
  - Формат чисел в отображении/полях ввода: без `.000`, иначе до 3 знаков (см. `frontend/src/floatInput.ts`).
- **Шаг 2 (рамочный): выбор цвета**
  - Исправлено: эскиз обновляет цвет/текстуру корректно (зависимости `selectedColorMaterial` учитывают `texByMaterialId`).
- **Шаг 4 (рамочный): наполнение**
  - Размеры с шага 3 **не пропадают**: шаг 4 читает габариты через `subscribeFrameCalcSession`/`readCalculatorPriceConfigKey`.
  - Добавлен чертёж с размерами (как на шаге 3).
- **Эскиз фасада на шагах 3–4**
  - Эскиз мягко реагирует на \(H×W\): меняется `aspectRatio` (по \(W/H\) с «ослаблением») и слегка меняется высота через CSS‑переменную `--sketch-scale-y` (ограничено, чтобы не ломать подписи/кнопки).
- **Шаг 3: ввод габаритов**
  - Поля высоты/ширины/количества принимают только цифры.
  - При уходе из поля значение автоматически поджимается к min/max (по лимитам материала); количество фасадов — минимум 1.
- **Материалы: список**
  - Выбранный материал в списке подсвечивается (`.mat-list-row--active`).
- **Панель сопутствующих/операций**
  - Внешний вид упорядочен (строки как карточки, hover, выравнивание чисел, компактные кнопки).
  - Убрана подсказка‑summary про масштаб.
  - В сопутствующих добавлен выбор **ед. изм.** выпадающим списком (м²/м.п./шт/л/кг) с сохранением в БД.
- **Backend: UoM**
  - Добавлена миграция **`materials.0022_seed_uom_l_kg`** — сидирование ед. изм. `l` (л) и `kg` (кг).

### Изменения 2026-04-29 (факт)

- **Backend: единицы измерения (UoM)**
  - Миграция **`materials.0023_uom_catalog`**: расширен/нормализован справочник UoM (в т.ч. `pc`, `m2`, `m`, `m3`, `kg`, `l`, `sheet`, `mm`, `roll`, `pack`, `tg`, `pair`).
  - Миграция **`materials.0024_seed_uom_linear_meter`**: UoM **`mp`** («Погонный метр», `м.п.`) — для расчёта по периметру.
  - Миграция **`materials.0025_seed_material_class_linear_meter`**: `MaterialClass` **«Метр погонный»** (`code=linear_m`).

- **Калькулятор: шаг 5 (итог)**
  - Добавлен маршрут **`/frame/summary`** (и в админке `/calculator/frame/summary`, и в публичном режиме `/frame/summary`).
  - Переход на шаг 5 доступен **только после выбора наполнения на шаге 4** (гейт по `calc_filling_material_id` + `isFrameStep4Ready()`).
  - На шаге 4 кнопка «Следующий шаг →» ведёт на шаг 5 после выбора материала наполнения.

- **Эскиз: параметры текстуры из базы**
  - В эскизе теперь учитывается **`tex_opacity`** (и `tex_mirror`) для рамки и для наполнения.
  - Причина: списки калькулятора возвращают “summary” материалов без `tex_*`, поэтому для эскиза догружается **полный материал** через `fetchMaterial(id)` (шаг 2 и шаг 4).
  - Рендер переведён на “texture layer” внутри `.sketch-frame` / `.sketch-paper`, чтобы прозрачность не ломала пунктир/уголки листа.
  - Текстура изображения в эскизе **растягивается на всю область** (`100% 100%`); `tex_rotation_deg` в режиме эскиза сейчас **игнорируется** (по требованию, чтобы не появлялись пустоты).

- **Frontend: UoM — порядок и селекты**
  - Единый порядок UoM в выпадающих списках: `frontend/src/uomSelectOrder.ts` (`sortUomForSelect`).
  - В `MaterialExtrasPanel` и форме материала селекты UoM используют этот порядок.

- **Frontend: выпадающие списки в едином стиле**
  - Внедрён кастомный **`FtSelect`** (`frontend/src/FtSelect.tsx`) с порталом в `document.body`, чтобы стилизация выпадающих списков работала одинаково в Windows/Chrome (без системной синей подсветки нативного `<select>`).

- **Калькулятор: шаг 2 / шаг 4 (админ) — UI и модалки**
  - Строки чеклистов (`.frame2-checkrow`) приведены к общей тёмной теме; добавлено состояние `--checked`.
  - В чеклистах (шаги 2 и 4) добавлен **квадратик текстуры/цвета** слева от названия (`MaterialCheckSwatch`), с подгрузкой недостающих данных через `fetchMaterial`.
  - В модалке шага 4 убран блок «Добавить материалы…» — состав типа редактируется в форме «Редактировать тип» (⚙), как и на шаге 2.
  - В модалке шага 4 устранена «двойная рамка» карточек материалов (обёртка `tile-cell` + `button.tile`).
  - В модалке шага 2 добавлено удаление цвета из типа (`×`) с подтверждением через **кастомное модальное окно** (вместо `window.confirm`).

- **UI: фон и отступы**
  - Обновлена текстура дерева: `frontend/src/assets/wood-premium.png`, фон рисуется как `cover` (без тайлинга/швов).
  - Админка: `.admin` сделан `background: transparent`, чтобы глобальная текстура была видна.
  - Калькулятор: добавлен общий горизонтальный `padding` у `.calc`, чтобы контент не прилипал к левому краю.

### Изменения 2026-05-01 (факт)

- **Backend: типы петель калькулятора**
  - Модели **`CalculatorHingeType`** / **`CalculatorHingeTypeMaterial`** (аналог типов наполнения), файлы карточек в `hinge_types/`.
  - Миграция **`materials.0026_calculator_hinge_types`**; обновление прав группы «Редактор материалов» в миграции.
  - API **`/api/calculator-hinge-types/`** — те же правила, что у **`calculator-filling-types`**: **`AllowAnyReadAuthenticatedModelPermsWrite`**.
  - Django admin: типы петель с inline материалов.

- **Калькулятор: шаг 5 (присадка)**
  - Заголовок вкладки: **«Рамочный фасад — присадка»**; убрана служебная подсказка про левое меню.
  - Блок присадки: «Не требуется» / «Присадки под петли»; петли заказчика / производства (**`FrameHingeMortisePanel`**, **`FrameHingeCatalog`**).
  - `localStorage`: `calc_frame_mortise`, `calc_hinge_source`, `calc_hinge_type_id`, `calc_hinge_material_id`; сброс в **`clearFrameCalculatorStorage()`**; участие в **`readCalculatorPriceConfigKey`**.
  - UI: отступы у каталога петелей (`.frame2-actions`, `.frame-hinge-catalog-wrap`).

- **Калькулятор: шаг 6 (расстояния петель)**
  - Маршрут **`/frame/hinge-layout`**; вкладка **Шаг 6**; гейт **`isFrameStep4Ready()`**; переход с шага 5.
  - **`Step6FrameHingeLayout`**: сторона, число отверстий (**1…10**, `MAX_HINGES`), ввод расстояний **парами** (зеркально от начала и конца кромки), дефолты через **`defaultHingeAbsPositionsMm(L, n)`** — равномерная раскладка по **L**; при смене **стороны** — очистка UI и **`writeHingeLayout(null)`** (смена `count` отдельно, без этого сброса); в **`localStorage`** пишется только **валидная** раскладка.
  - **`calc_hinge_layout`**: JSON **`HingeLayoutPersisted`** — `side`, `count`, **`positionsMm`** (абсолютные мм от **начала** кромки: верх/низ — от левого, лево/право — от верхнего). Пересчёт полей ↔ абсолютов: **`hingeUserInputsToAbsoluteMm`**, **`hingeAbsoluteToUserInputStrings`**; вспомогательно **`hingePairPartnerIndex`**, **`hingeMeasuresFromEdgeStart`**, **`defaultHingeAbsPositionsMm`** (`frameCalcSession.ts`). Валидация: **`validateHingePositions`**, длина кромки **`hingeEdgeLengthMm`**, габариты **`readFrameDimsMm`**.
  - Эскиз: маркеры (**`sketch--hinge-markers`**), **`frame3-drawing-core`**, цепочки **`.hinge-chain-dim`** (**`Step3FrameSizes.css`**): общий габарит с противоположной стороны от петель; узкие сегменты **`--narrow`**; подписи цепочек с поворотом **−90°** / **+90°** (смещение подписи, не всего блока).

- **Калькулятор: шаг 8 «Итог»**
  - Маршрут **`/frame/result`** (админка: `/calculator/frame/result`); вкладка **«Итог»**; гейт **`isFrameStep4Ready()`**; переход с шага 7 (**`Step7FrameHandleHoles`**: «Итог →» / «Пропустить шаг»).
  - **`Step8FrameResult`**: слева контактная форма (отправка через **mailto** с текстом заявки и сводкой), справа детализация заказа и таблица ориентировочной стоимости (**`computeFramePriceBreakdown`**); кнопки «Новый расчёт» (**`clearFrameCalculatorStorage`**) и возврат к настройке профиля.
  - Колонка **`CalcPriceTotals`** на шаге 8 скрыта (**`blankAside`**), сетка **`calc-body-with-totals--wide`**.
  - **`clearFrameCalculatorStorage`**: также очищается **`calc_handle_holes`**.
  - Вложенный `<Routes>` внутри админского `/calculator/*` давал сбой сопоставления для **`/frame/result`** (редирект на шаг 1); шаги калькулятора переключаются по **`normalizedCalcPath`** без внутреннего `Routes` (**`CalculatorPage.tsx`**).

### Изменения 2026-05-03 (факт)

- **Шаг 7 (админ-калькулятор): справочник диаметров под ручку**
  - **`HandleHoleDiameterAdminSelect`** (`frontend/src/calculator/HandleHoleDiameterAdminSelect.tsx` + `.css`): один выпадающий список — выбор мм, кнопки **«Видимость»** (видимость строки в публичном калькуляторе) и **«Удалить»** (с подтверждением), внизу — **«Добавить размер»** (POST на API).
  - **`frontend/src/api.ts`**: **`createCalculatorHandleHoleDiameter`**, **`deleteCalculatorHandleHoleDiameter`**.
  - **Backend** (`backend/materials/serializers.py`): у **`CalculatorHandleHoleDiameter`** поле **`diameter_mm`** можно передать только при **создании**; после сохранения диаметр не меняется (в **`update`** поле отбрасывается).

- **Вкладка «Калькулятор» в админке (десктоп, ≥1025px)**
  - **`AdminApp.css`**: для **`#admin-panel-calculator`** задана цепочка flex/`overflow`/`min-height: 0`, чтобы контент вкладки помещался в область без выхода за **`admin-orders-placeholder`**.
  - Шаг 8: класс **`calc-routes-wrap--step8`** на **`CalculatorPage.tsx`** — у маршрута без отдельной прокрутки всей карточки; для **`#calc-step-panel-8`** дополнительная цепочка flex до **`Step8FrameResult`**.

- **Шаг 8 «Итог» — вёрстка и PDF**
  - **`step8-result__scroll-pack`**: одна прокручиваемая колонка для двух блоков **`step8-panel`** и нижних действий; у контактов снят **`calc-side-panel`** (раньше давал фиксированную высоту ~520px).
  - **PDF для клиента** (`**jspdf**`, **`jspdf-autotable`**, **`frontend/src/calculator/frameClientPdf.ts`**): первая страница — сводка (номер просчёта, контакты, таблицы / присадка / наполнение / суммы); далее **по странице на фасад** (`**calc_frame_qty**`) с чертежом (мм, рама и заполнение, цвет и **`texture_image`** через **`resolveMediaUrl`**). Кнопка **«Открыть PDF…»** (`**Step8FrameResult**`): при клике **синхронно** открывается **`about:blank`**, после сборки PDF во вкладку подставляется **`blob:`** — просмотр и скачивание через стандартный UI браузера.
  - **Кириллица в PDF:** шрифт **Noto Sans** (TTF): в памяти кэшируется только **base64** файла; на **каждый новый** экземпляр **`jsPDF`** обязательно вызываются **`addFileToVFS`** / **`addFont`** (иначе после предзагрузки кириллица превращалась в «кракозябры»). Источники: **`frontend/public/fonts/NotoSans-Regular.ttf`** (основной), запасной URL jsDelivr. **`preloadFramePdfFont()`** при монтировании шага 8 прогревает загрузку TTF.

- **Админка: панель операций материала (`MaterialExtrasPanel` + `MaterialExtrasPanel.css`)**
  - Легенда: колонка **«Описание»** (вместо «Параметр с модели») для поля `model_parameter`.
  - Таблица операций: сетка колонок с **минимальными ширинами** для «Цена» и **«× фасад»** (раньше колонка 2rem ломала подпись), **`white-space: nowrap`** у подписей легенды, у блока операций **`overflow-x: auto`** на узких экранах.

- **Админка: удаление папок категорий (каскад)**
  - **Backend** (`**materials/views.py**`): **`MaterialCategoryViewSet.destroy`** в **`transaction.atomic`**: собираются id папки и всех потомков, удаляются **`Material`** в этих категориях (каскад модели на операции, сопутствующие, строки калькулятора и т.д.), затем удаляется сама категория (дочерние категории — по **`parent` CASCADE**).
  - **Frontend** (`**AdminApp.tsx**`): модалка удаления предупреждает про **все вложенные папки и материалы**; снят запрет «сначала удалите вложенные»; после успеха сбрасывается выбор, если **`selected`** попал в удалённое поддерево (**`collectSubtreeCategoryIds`**). Подсказка у дерева обновлена.

- **Калькулятор (рамочный): габариты по умолчанию и эскиз шага 2**
  - **`frameCalcSession.ts`**: **`FRAME_DEFAULT_HEIGHT_MM = 500`**, **`FRAME_DEFAULT_WIDTH_MM = 200`**; с **2026-05-24** — **`FRAME_DIM_FALLBACK_MAX_MM`**, **`frameDimDefaultsFromMaterial`**, **`seedFrameDimsFromMaterial`** (подробнее в блоке **2026-05-24** в начале файла).
  - **`Step3FrameSizes`**, **`Step8FrameResult`**, **`CalcPriceTotals`**: fallback 500×200 при пустой сессии.
  - **`sketchFrame.ts`**: **`facadeSketchBoxStyle(H, W)`** — **`aspectRatio`** и **`--sketch-scale-y`**.
  - **`Step2FrameFacade`**: габариты из **`readFrameDimsMm()`** или дефолта материала; **`useSyncExternalStore`**, снимок **`"h|w"`** (не объект — иначе бесконечный ререндер).

- **Калькулятор: шаг 5 → 6 → 7 при «Присадка не требуется»**
  - Если на шаге 5 не выбраны **«Присадки под петли»** (в `localStorage` нет `calc_frame_mortise=hinge`): вкладка **«Шаг 6»** остаётся в DOM, но **неактивна** (`disabled`); «Следующий шаг» с шага 5 ведёт на **`/frame/handle-holes`**; при прямом открытии **`/frame/hinge-layout`** — редирект на шаг 7. В **`FrameHingeMortisePanel`** при выборе «Не требуется» дополнительно **`writeHingeLayout(null)`**. Хелпер **`isFrameMortiseHingeSelected()`** в **`frameCalcSession.ts`**; на шаге 7 кнопка «Назад» ведёт на шаг 5 или 6 в зависимости от присадки.
  - **Итог и PDF:** строка «Петли (сторона, число отверстий)» в **`Step8FrameResult`**, строка в mailto и флаг **`includeHingeLayoutRow`** в **`frameClientPdf.ts`** — только если присадка под петли выбрана; иначе в расчёт эскиза/PDF **`hingeLayout`** не подмешивается.

- **Калькулятор: шаг 7 — ноль отверстий и эскиз**
  - Поле количества: строка **`countStr`**, по умолчанию **`0`**, **можно очистить** при вводе; при **blur** пустое значение становится **`0`**. **`holeCount === 0`**: **`calc_handle_holes`** очищается (**`writeHandleHoles(null)`**), «Итог →» доступен (ручка не задана). Гидрация из `localStorage` — **`useLayoutEffect`**, чтобы не затереть сохранённые отверстия эффектом очистки до чтения.
  - При **0** отверстий эскиз как **шаг 5**: только общие габариты **сверху и слева** (`frame3-dim-drawing--top` / `--left`); **без** маркеров петель и ручки и **без** слоя **`frame3-hinge-dim-layer`**.

- **Веб-админка для заказчика (SPA): пользователи и вход (не путать с `/admin/django/`)**
  - **Backend** (`**materials/user_admin_views.py**`, маршруты в **`config/urls.py`**): **`POST /api/auth/register/`** (AllowAny) — регистрация клиента, **`is_staff=False`**. **`GET /api/auth/admin-users/`**, **`PATCH /api/auth/admin-users/<id>/`** (`is_staff` bool, не для superuser), **`DELETE .../<id>/`** — удаление учётки (не себя, не superuser). Доступ к списку/PATCH/DELETE: **`IsAdminUser`** (сотрудник с JWT). **`GET /api/auth/me/`** — в JSON добавлено **`id`**.
  - **Frontend — маршруты и защита** (`**frontend/src/App.tsx**`, **`auth.ts`**): в **`Me`** есть **`id`**. **`AdminRoute`** пускает только **`is_staff` или `is_superuser`**; иначе редирект на **`/`**. После логина: сотрудник → **`state.from`** или **`/materials`**, клиент без staff → **`/`**. Выход из админки: **`clearTokens`** + **`window.location.replace('/')`**. **`PublicShell`**: подпись пользователя (**email** или **логин**) рядом с действиями; «Админка» только у staff; у клиента без staff — «Выйти» (**`clearTokens`** + **`window.location.replace('/')`** для согласованности с **`App`** **`auth`**).
  - **Публичная регистрация:** **`/register`**, **`RegisterPage`** — форма и вызов **`registerAccount`**; шапка сайта: «Вход», «Регистрация» (короткие подписи).
  - **Вкладка «Пользователи»:** маршрут **`/users`**, четвёртая вкладка в **`AdminApp`** после «Заказы». Таблица: логин, email, **роль** через **`FtSelect`** — «Пользователь» / «Админ» (маппинг на **`is_staff`**); у superuser — неактивный селект «Суперпользователь». Выпадающий список роли с **`menuStrategy` по умолчанию (portal)** — меню в `document.body`, поверх панели. Колонка **«Действия»** — **`deleteAdminUser`**, подтверждение модалкой; нет кнопки у себя и у superuser.
  - **Стили:** **`AdminApp.css`** — колонки таблицы пользователей, **`admin-users-role-ft`**, **`admin-users-actions-*`**.

### Изменения 2026-05-03 (продолжение — регистрация, клиент, навигация, прокрутка)

- **Регистрация (`RegisterView` в `user_admin_views.py`):** явно **`is_staff=False`**, **`is_superuser=False`**; при **`is_staff` / `is_superuser` = true в теле запроса** — **400** (нельзя назначить админа при регистрации); после **`create_user`** страховочный сброс флагов, если они неожиданно true.
- **Вход и роли (`App.tsx`):** **`LoginRoute`** при уже открытой сессии: сотрудник → **`state.from`** или **`/materials`**, клиент без staff → **`/`**; гость не видит форму входа повторно. Клиент без **`is_staff`** после логина только публичный калькулятор (**`AdminRoute`** → **`/`**).
- **Публичный сайт:** вложенные маршруты под **`path="/"`** + **`Outlet`**: индекс и **`path="*"`** — **`CalculatorPage variant="public"`**; **`my-orders`** — **`ClientMyOrdersPage`** (`**PublicClientPages.tsx**`, контекст **`PublicShellOutletContext`**, хелпер **`isPublicCalculatorRoute`**); **`guide`** — **`Navigate`** на **`/`**.
- **`PublicShell`:** вкладки **`public-shell__section-tabs`**; **`public-shell__main`** — прокрутка контента на десктопе; стили подписи и «Выйти» как у админки (**`public-shell__user-name`**, **`public-shell__logout`**).
- **Админка:** разделение шапки на **`admin-header-top`** и **`admin-section-tabs`** / **`admin-section-tab`** (вместо прежней «коробки» **`admin-tabs`**).
- **Документация:** синхронизированы **`ARCHITECTURE.md`** и этот файл.

### Изменения 2026-05-03 (часть 3 — заказы FacadeOrder, шаг 8 для клиента)

- **Backend — `FacadeOrder`:** модель заказа из калькулятора рамочного фасада (`materials/models.py`): пользователь (**`user`**), **статус** (`not_confirmed` / `confirmed` / `in_production` / `ready` / **`completed` («Завершён»)** — в `TextChoices`; доп. значения без новой миграции, `CharField`), контакты из формы (**`contact_*`**), **`snapshot`** (JSON снимок расчёта), **`pdf_file`** (`FileField`, `upload_to=facade_orders/pdf/%Y/%m/`). Миграция **`materials.0029_facade_orders`**. Зарегистрировано в **`/admin/django/`**.
- **API `FacadeOrderViewSet`** (`materials/views.py`, router **`/api/facade-orders/`**): **`POST`** — multipart (**`pdf_file`**, **`snapshot`** строка JSON, контакты); создавать может только **не staff / не superuser** (см. **`FacadeOrderCreateSerializer.validate`**). **`GET` list/retrieve** — JWT; клиент видит **только свои** заказы, **staff** — все. **`PATCH`** — только **`IsAdminUser`**, поле **`status`** (**`FacadeOrderStaffUpdateSerializer`**). Ответы: **`order_number`** (`З-{id:06d}`), **`pdf_url`**, **`status_display`**, клиент **`client_username` / `client_email`**.
- **Frontend — API:** в **`api.ts`** — **`createFacadeOrder`**, **`fetchFacadeOrders`**, **`patchFacadeOrderStatus`**, типы **`FacadeOrder`**, **`FacadeOrderStatus`**.
- **Шаг 8 `Step8FrameResult`:** для **клиента** после успешного **`createFacadeOrder`** — переход на **`/my-orders`** (`replace: true`). Модалка «Войти или зарегистрироваться» при госте (**`hasValidSession`** + **`createPortal`**, классы **`admin-modal-*`**). Валидация контактов на **`readOnly`** (см. сводку выше).
- **`App.tsx` — `LoginRoute`:** функция **`safePostLoginTarget(rawFrom, isStaff)`** — после входа **клиент** может вернуться на безопасный публичный URL из **`state.from`** (калькулятор, **`/my-orders`**); **staff** — также админские префиксы. Защита от open redirect (только относительные пути, без `//`).
- **`RegisterPage`:** проброс **`state.from`** на **`/login`** после регистрации и в ссылке «Уже есть аккаунт».
- **`AdminOrdersPanel.tsx`:** вкладка **«Заказы»** вместо заглушки; таблица (номер, дата, клиент, контакты в заявке, статус, PDF), смена статуса **`FtSelect`**, ссылка на PDF (**JSON `snapshot` только в API и в `/admin/django/`**, в SPA-таблице не выводится). Стили в **`AdminApp.css`** (**`admin-orders-*`**).
- **`ClientMyOrdersPage`:** загрузка **`fetchFacadeOrders`**, карточки заказа; **краткий статус** в строке, пояснение — **`HintButton`** (как в админке); убран lead-текст под заголовком.
- **Документация:** обновлены этот файл и **`ARCHITECTURE.md`**.

### Изменения 2026-05-03 (часть 4 — статус «Завершён», таблица заказов)

- **`FacadeOrder.Status`:** добавлено **`completed`** / подпись **«Завершён»**; миграция **`0031_alter_facadeorder_status`**; **`FacadeOrderStatus`** и опции **`FtSelect`** в **`AdminOrdersPanel`**, подписи и **`HintButton`** в **`ClientMyOrdersPage`** (**`PublicClientPages.tsx`**).
- **`AdminOrdersPanel`:** убрана колонка **«Детали»** с раскрывающимся просмотром **`snapshot`**; удалены стили **`admin-orders-details-*`** / **`admin-orders-snapshot`** из **`AdminApp.css`**.
- **Удаление заказа из админки:** колонка **«Действия»** + кнопка **«Удалить»** в **`AdminOrdersPanel`** (модалка через **`createPortal`** + **`admin-modal-*`**); фронт-API **`deleteFacadeOrder`**; бэкенд — **`DELETE /api/facade-orders/{id}/`** (только **`IsAdminUser`**, **`perform_destroy`** удаляет привязанный **`pdf_file`** перед удалением строки). У клиента заказ исчезает из **«Мои заказы»** при следующем `GET`.

### Изменения 2026-05-09 (часть 1 — удаление полей материала)

- **Полностью удалены из проекта:** поле **`fnp_name`** («Наименование ФНП»), поле **`unit_mass`** («Масса на ед. изм.») у **`Material`** и модель **`MaterialAlternativePrice`** («Альтернативные валюты», ключ `alt_prices` в API). Уход без обратной совместимости — данных, на которые опирается калькулятор, в этих полях не было.
- **Backend:** удалены поля и модель в **`materials/models.py`**; убраны импорт/admin-регистрация **`MaterialAlternativePrice`** в **`materials/admin.py`**; в **`MaterialAdmin.list_display` / `search_fields`** больше нет **`fnp_name`**; в **`MaterialViewSet`** убрано **`prefetch_related("alternative_prices")`** и **`fnp_name`** из **`search_fields`**; в **`MaterialSerializer`** удалены поля и весь блок про **`alt_prices`** (методы **`_replace_alternative_prices`**, **`_get_alt_prices_from_request`**, ветки в `create`/`update`, проверка `unit_mass` в `validate`, инъекция в `to_representation`). Миграция **`materials.0030_drop_fnp_unit_mass_alt_prices`** удаляет поля, модель и связанные **content type / Permission**.
- **Frontend:** в **`types.ts`** убраны `fnp_name`, `unit_mass`, `alt_prices`; в **`currencies.ts`** убран список **`ALTERNATIVE_CURRENCIES`** (остался только **`BASE_CURRENCY = 'KZT'`**); в **`AdminApp.tsx`** удалены инпуты «Наименование ФНП», «Масса на ед. изм.», блок «Альтернативные валюты» / «Валюта для ввода» / «Цена за ед. в …», поля стейта, helpers **`mapFromAltPriceRows`** / **`buildAltPricesPayload`**, ключи в `baseBody` при сохранении.

### Изменения 2026-05-09 (часть 2 — модалка «Создать папку» в стиле Explorer)

- **Боковая панель «Папки материалов»:** убраны инпут **«Название папки»** и кнопки **«+ В корень» / «+ В текущую»**. Теперь одна крупная кнопка **«+ Создать папку»** (`admin-folder-create-btn`), открывающая модалку.
- **Новый компонент `frontend/src/FolderCreateModal.tsx`:** окно «Создать папку» через **`createPortal`** в `document.body`, оверлей **`admin-modal-backdrop`** + новый модификатор **`admin-modal--explorer`** (широкое окно ≤ 960×720, две колонки).
  - **Хлебные крошки** сверху: «🗂️ Все папки (корень)» → … → выбранная папка; клик по сегменту возвращает к нужному уровню.
  - **Левая колонка** — полное **дерево папок** (`FolderTreeRow`, **`▸/▾`** раскрытие), пункт «🗂️ Все папки (корень)» в качестве target = `parent: null`.
  - **Правая колонка** — содержимое выбранной папки в виде **сетки плиток**: 📁 вложенные папки и 📄 материалы (название + артикул). Материалы грузятся **`fetchMaterials(id)`** с кэшем по id (**`materialsByFolder`** + **`loadingFolderIds`**); двойной клик по плитке-папке открывает её и раскрывает в дереве.
  - **Форма** снизу: «Имя новой папки» (Enter создаёт), подсказка **«Будет создана в: <путь | Все папки (корень)>»**, кнопки **«Отмена» / «Создать»** и блок ошибок (**`admin-error--compact`**).
  - **Esc** и клик по бэкдропу — закрытие (если не идёт `submitting`).
- **`AdminApp.tsx`:** удалены state **`newFolderName`** и функция `addFolder`; добавлены state **`folderCreateOpen`** и универсальная **`submitNewFolder(parent, name)`** — вызывает **`createCategory`**, перезагружает дерево, **раскрывает родителя** в боковом дереве и **выбирает** созданную папку (`setSelected(created.id)`).
- **`AdminApp.css`:** новые стили **`.admin-modal--explorer`**, **`.folder-explorer`** / **`-tree`** / **`-content`** / **`-grid`** / **`-tile`** / **`-tile--folder` / `--material` / `--info`** / **`-breadcrumb` / `-crumb*`** / **`-name-field`** / **`-target`** и **`.admin-folder-create-btn`**.

### Изменения 2026-05-09 (часть 3 — перенос папок, поиск материалов, гибкий поиск, вход JWT)

- **Перенос папок (`frontend/src/FolderMoveModal.tsx`):** см. блок **«Изменения 2026-05-10»**: DnD **любой** папки (дерево + плитки 📁), корень **«Все папки»**, **`PATCH /api/categories/{id}/`** (`parent`); опционально перенос материалов (**`onMoveMaterial`**); футер **«Закрыть»**; после успеха окно не закрывается. Исторически: пункт **«Переместить»** в меню ⚙ открывает модалку; стили **`folder-explorer-tree-line--drag-source`**, **`--move-blocked`**, плитки **`folder-explorer-tile--drag-source`**.
- **Поиск материалов:** под кнопкой **«+ Создать папку»** — **«Поиск»** (`admin-folder-search-btn`), открывает **`MaterialSearchModal`** с **`mode="navigate"`**: слева дерево (**`category`**), справа таблица без чекбоксов; фильтры как раньше; **«Перейти»** открывает выбранную строку в карточке. В калькуляторе (шаги 2/4) — **`mode="multiPick"`**: чекбоксы, накопление выбора между папками, **«выбрать все»** в шапке, **«Добавить (N)»**.
- **Гибкий поиск в API материалов (`backend/materials/flexible_search.py` + `MaterialViewSet.get_queryset`):** у **`MaterialViewSet`** снят **`SearchFilter`**; фильтрация в **`get_queryset`** по параметрам **`search`**, **`folder_name`**, **`article`**, **`name`**. Логика: нормализация текста (**`normalize_text`**), для нескольких слов — все токены должны «попасть» в поле (сначала строгий **`icontains` по каждому токену**, при пустом результате — **rapidfuzz** `partial_ratio` / `token_set_ratio` на урезанном наборе id); **`folder_name`** — по имени связанной **`MaterialCategory`**. Вспомогательная **`_materials_pk_subset`** — отдельный queryset по pk без **`select_related`**, чтобы совмещать **`.only()` / `.iterator()`** с тяжёлым базовым queryset и не ловить **`FieldError`** (deferred + select_related).
- **Зависимость:** в **`requirements.txt`** добавлен **`rapidfuzz>=3.9.0`**.
- **Вход JWT:** **`backend/materials/jwt_auth.py`** — **`FurnitechTokenObtainPairSerializer`**: если в поле **`username`** передан **email** (есть **`@`**), выполняется поиск **`User`** по **`email__iexact`**; при нескольких учётках с одним email перебор кандидатов с **`super().validate`** до успеха (как и при входе по логину). Подключено в **`backend/config/urls.py`** через **`FurnitechTokenObtainPairView`** для **`POST /api/auth/token/`**.
- **Надёжность dev (SQLite / хост):** в **`config/settings.py`** для SQLite добавлено **`OPTIONS: {"timeout": 30}`** (снижает **`database is locked`** при **`UPDATE_LAST_LOGIN`** и параллельных обращениях); расширен дефолт **`DJANGO_ALLOWED_HOSTS`** (**`127.0.0.1,localhost,0.0.0.0,[::1]`**). **`backend/.env.example`** синхронизирован.

### Изменения 2026-05-09 (часть 4 — `MaterialSearchModal`: мультивыбор; калькулятор шаги 2 и 4)

- **`MaterialSearchModal` (историческое описание; см. часть 6):** в режиме калькулятора клик по строке **не** добавляет материал; **чекбокс** у строки; **«Добавить (N)»** / **`onPick`**. Позже: отметки **сохраняются** при смене папки; **«выбрать все»** в шапке; для админки — отдельный режим **навигации** без чекбоксов.
- **Админка материалов (`AdminApp`):** поиск открывает модалку в режиме **`navigate`** (**`onNavigate`**: папка + полная карточка).
- **Калькулятор, шаг 2 (`Step2FrameFacade`):** в формах создания/редактирования **типа профиля** убран текстовый **`searchMaterials`**; одна кнопка **«Поиск»** открывает **`MaterialSearchModal`**; **`handleMaterialPickedFromTree`** добавляет **все** выбранные материалы в цвета типа за раз. При открытии **редактирования** типа для существующих цветов вызывается **`fetchMaterial`** по каждому id — чеклист заполняется без текстового поиска. Кэш **`fetchCategoryTree`** / **`fetchMaterialClasses`**, стили **`frame2-material-search-row`** (**`Step2FrameFacade.css`**).
- **Калькулятор, шаг 4 (`Step4FrameFilling`):** та же схема для блока **«Материалы»** при создании/редактировании **типа наполнения** — **«Поиск»** → **`MaterialSearchModal`**, пакетное добавление в **`createMatIds`** / **`editFillingMatIds`** (и в списки **`createMatHit`** / **`editFillingMatHit`**). При **`openEditFilling`** — **`fetchMaterial`** по каждому материалу типа для отображения чеклиста.

**Бэкенд:** для **`MaterialViewSet`**, **`CalculatorProfileTypeViewSet`**, **`CalculatorFillingTypeViewSet`**, **`CalculatorHingeTypeViewSet`**, **`CalculatorHandleHoleDiameterViewSet`** — класс **`AllowAnyReadAuthenticatedModelPermsWrite`** (GET без JWT; POST/PATCH/DELETE — только авторизованные пользователи с правами Django). **`CalculatorProfileViewSet`** — по‑прежнему только с JWT (`AuthReadModelPermsWrite`).

**Расчёт цены:** сопутствующие считаются **поштучно** по **`quantity_scale`** (`follow_parent` / `per_facade` / `use_related_uom`); операции — с опциональным **`price_per_facade`** (× число фасадов). Наполнение: основной материал и его сопутствующие по той же логике; стекло — ед. изм. м² у материала заполнения.

### Изменения 2026-05-09 (часть 5 — UI форм «создать/редактировать тип», шестерёнки)

**Формы с картинкой карточки (шаг 2 тип профиля, шаг 4 наполнение, каталог петель `FrameHingeCatalog`):**

- Кнопки **«Поиск»**, **«Выбрать файл…»** / **«Изменить файл…»** в админских формах: высота как у **`admin-input`** (скругление **12px**), цвета как у **`admin-secondary`**; **«Поиск»** на всю ширину колонки; кнопка файла фиксированной ширины **14.75rem** (~как колонка «Поиск»).
- Сетка **`frame2-create-grid--file-status-pair`** (`grid-template-areas`: верх — метаданные + «Поиск», средняя строка — кнопка файла слева и **поле статуса** справа на **100%** ширины правой колонки, низ — превью слева и чеклист материалов/цветов справа) — устраняет сжатие блока имени файла в flex; поле **`.frame2-file-name`** оформлено как read-only аналог **`admin-input`**, класс **`.frame2-file-name--empty`** для подписи «Файл не выбран».
- Стили: **`Step2FrameFacade.css`** (общие для шага 4 через импорт того же файла).

**Шаг 2 — плитки типов профилей:**

- Кнопка **«Удалить тип»** из **`frame2-card-head`** убрана.
- На плитке: **`tree-gear-btn`** + выпадающее **`tree-gear-menu`** (как у папок в материалах): пункты **«Редактировать»** и **«Удалить»** (без многоточий в подписи).
- Подтверждение удаления типа — модалка **`admin-modal`** через **`createPortal(..., document.body)`**, текст в духе удаления папки (безвозвратно, в т.ч. привязанные цвета в калькуляторе); **Escape** и клик по фону закрывают; **`confirmDeleteProfileType`** / **`cancelDeleteProfileType`** / state **`profileTypeDeleteModal`**.
- Закрытие меню по клику вне и **Escape**: state **`gearMenuTypeId`**, ref **`gearMenuWrapRef`**; обёртка **`tile-gear-wrap`** + **`tile-gear-menu-anchor`**.

**Шестерёнки (единый вид по проекту):**

- **`AdminApp.css` — `.tree-gear-btn`:** фон **чёрный** (`#000`), иконка **белая**; hover / открытое меню — **`#141414`**, светлая обводка. Используется в дереве папок (**`TreeRow`**) и на плитках шага 2.
- **`Step2FrameFacade.css` — `.tile-gear`:** те же принципы (чёрный квадрат, белая ⚙) для плиток шагов **4** и **петель** (`Step4FrameFilling`, `FrameHingeCatalog`).

Подробная архитектура и таблицы API: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Бэкенд (`backend/`, приложение `materials`)

| Область | Состояние |
|---------|-----------|
| **Проект Django** | `config/` (urls, settings, wsgi/asgi), SQLite `db.sqlite3` по умолчанию. |
| **API** | DRF `DefaultRouter`: `material-classes`, `uom`, `categories`, `materials`, `calculator-profiles`, `calculator-profile-types`, `calculator-filling-types`, **`calculator-hinge-types`**, **`calculator-handle-hole-diameters`**, **`facade-orders`**. |
| **Аутентификация** | `djangorestframework-simplejwt`: `POST /api/auth/token/` (**кастомный** **`FurnitechTokenObtainPairView`**: в **`username`** допускается **email** — см. **`materials/jwt_auth.py`**), `POST /api/auth/token/refresh/`, `GET /api/auth/me/` (в т.ч. **`id`**, **`is_staff`**, **`is_superuser`**). Публично: **`POST /api/auth/register/`** — только обычный пользователь (**`is_staff=False`**; попытка передать привилегии в JSON → 400; см. `RegisterView` в `user_admin_views.py`). Для сотрудников SPA: **`GET/PATCH/DELETE /api/auth/admin-users/`** и **`/api/auth/admin-users/<id>/`** (список, **`is_staff`**, удаление). |
| **Права** | По умолчанию справочники — **JWT + DjangoModelPermissions**. **Исключение для публичного калькулятора:** `GET/HEAD/OPTIONS` на **`/api/materials/`**, **`/api/calculator-profile-types/`**, **`/api/calculator-filling-types/`**, **`/api/calculator-hinge-types/`**, **`/api/calculator-handle-hole-diameters/`** — **без** JWT (`AllowAnyReadAuthenticatedModelPermsWrite`; для диаметров в list только строки с **`client_visible=true`**). Запись на эти ресурсы — только авторизованным с model permissions. **`/api/calculator-profiles/`** — только с JWT. **`/api/facade-orders/`** — **JWT**: list/retrieve/create — **`IsAuthenticated`** (клиент видит только свои заказы); **PATCH** статуса — **`IsAdminUser`**. Группа **«Редактор материалов»** (`is_staff=False`). |
| **Пагинация** | `PageNumberPagination`, `PAGE_SIZE=100` (`config/settings.py`). |
| **Категории (папки)** | `GET /api/categories/?tree=1` — дерево; `POST` — создать; `PATCH/PUT/DELETE` — по `/api/categories/{id}/`. **DELETE** — **каскад**: удаляются все материалы в выбранной папке и подпапках, затем поддерево категорий (в транзакции, см. `MaterialCategoryViewSet.destroy`). |
| **Материалы** | `GET` (в т.ч. **без JWT** для каталога в калькуляторе) / `POST/PUT/PATCH/DELETE` (только с JWT и правами) на `/api/materials/`. Фильтры list: **`category`**, **`search`** (имя или артикул, гибкий поиск), **`folder_name`**, **`article`**, **`name`**, **`price`** (точное **`base_price`**), **`material_class_ids`** (id через запятую — материал должен иметь **хотя бы один** из указанных классов). См. **`MaterialViewSet.get_queryset`** и **`flexible_search.py`**. |
| **Миграции** | В т.ч. `0010`–`0017` (сопутствующие, артикул, текстуры, профили и типы профилей); **`0018`** — min/max размеры материала; **`0019_calculator_filling_types`** — типы наполнения и связь с материалами (шаг 4); **`0020_calculator_material_fk_cascade`** — при удалении материала каскадно убираются строки калькулятора: цвет в профиле (`CalculatorProfileColor`), цвет в типе профиля (`CalculatorProfileTypeColor`), материал в типе наполнения (`CalculatorFillingTypeMaterial`); **`0021_related_quantity_scale_op_per_facade`** — у сопутствующих **`quantity_scale`** (масштаб в калькуляторе), у операций **`price_per_facade`**; **`0026_calculator_hinge_types`** — типы петель и материалы в типе (шаг 5); **`0027_calculator_handle_hole_diameters`** — диаметры отверстий под ручку (шаг 7); **`0028_editor_perms_handle_hole_diameter`** — обновление прав группы «Редактор материалов» для новой модели; **`0029_facade_orders`** — заказы калькулятора (**`FacadeOrder`**); **`0030_drop_fnp_unit_mass_alt_prices`** — удаление полей **`fnp_name`** / **`unit_mass`** у `Material` и модели **`MaterialAlternativePrice`** вместе с её content type/permissions; **`0031_alter_facadeorder_status`** — статус **`completed`** («Завершён»); **`0032_remove_material_operation_line`** — удаление операций у материала; **`0033_texture_library`** — база текстур и связь с материалом; **`0034_remove_material_designation_cut_coeff_calc_type`** — удаление **`designation`**, **`cut_coeff`**, **`calc_type`** у **`Material`**; **`0035_calculatorprofiletype_card_image_2_3`** — **`card_image_2`**, **`card_image_3`** у **`CalculatorProfileType`**. |

### Модели (сущности)

- `MaterialCategory` — дерево (`parent`, `on_delete` у детей: CASCADE), `unique_together (parent, name)`, `path` в API.
- `UnitOfMeasure`, `MaterialClass` — справочники; M2M классов к `Material`.
- `Material` — `category`, `name`, **`article`** (у непустых — уникальность в БД; пустой артикул у нескольких записей **разрешён**), M2M классов, `uom`, **`base_currency` = KZT**, `base_price`, `note`, округления, **`is_active`** (см. глоссарий ниже), `external_id` / `last_synced_at`. Поля **`fnp_name`** («Наименование ФНП») и **`unit_mass`** («Масса на ед. изм.»), а также таблица **`MaterialAlternativePrice`** были удалены миграцией **`0030_drop_fnp_unit_mass_alt_prices`**.
- `Material` (продолжение) — **«Доп. параметры»**: `thickness`, `min_length`, `max_length`, `min_width`, `max_width`.
- `Material` (продолжение) — **«Параметры текстуры»**: `texture_mode`, `texture_color`, `texture_image`, `tex_offset_x/y`, `tex_step_x/y`, `tex_opacity`, `tex_mirror`, `tex_specular_sharpness`, `tex_specular_brightness`, `tex_rotation_deg`.
- `MaterialRelatedItem` — сопутствующие материалы; см. [ARCHITECTURE.md](ARCHITECTURE.md). Модель **`MaterialOperationLine`** удалена миграцией **`0032_remove_material_operation_line`**.
- `CalculatorProfile` — профиль калькулятора: **один материал** из базы, который выступает «профилем» (OneToOne к `Material`).
- `CalculatorProfileColor` — «цвет профиля»: привязка профиля к другому материалу (многие‑ко‑многим через таблицу, с порядком и уникальностью).
- `CalculatorProfileType` — тип профиля (калькулятор): имя; до **трёх** файлов карточки **`card_image`**, **`card_image_2`**, **`card_image_3`** (плюс опционально **`image_url`** для первого слота, если файла нет); порядок, активность; **не привязан к материалу профиля**. Подробнее — блок **«Справочник: тип профиля…»** в начале файла.
- `CalculatorProfileTypeColor` — «цвет типа профиля»: ссылка на материал + флаги `is_new/is_hit/is_sale`.
- `CalculatorFillingType` — тип наполнения (имя, картинка, порядок); **`CalculatorFillingTypeMaterial`** — материалы внутри типа (M2M через промежуточную таблицу).
- **`CalculatorHingeType`** — тип петель для калькулятора (шаг 5, петли производства); **`CalculatorHingeTypeMaterial`** — материалы (конкретные петли) внутри типа.
- **`CalculatorHandleHoleDiameter`** — справочник диаметров отверстий под ручку (шаг 7): **`diameter_mm`** (уникально), **`client_visible`**, **`sort_order`**.
- **`FacadeOrder`** — заказ из шага 8 публичного калькулятора: **`user`**, **`status`**, контакты, **`snapshot`**, **`pdf_file`**, **`created_at` / `updated_at`**.

### Сериализация материала

- `related_items` — чтение и полная замена при записи, если ключ в теле.
- Валидация дубликата артикула в сериализаторе; при гонке — `IntegrityError` → 400 с полем `article`.
- **Multipart для загрузки текстуры:** при `texture_image` запрос уходит как `multipart/form-data`, и списки (`material_class_ids`, `related_items`) могут приходить JSON‑строкой. Сериализатор поддерживает JSON‑строки.
- **Multipart edge-case:** некоторые клиенты/сервер могут дать `["[]"]` вместо `"[]"` — обработано в сериализаторе.

### Django admin

URL: `/admin/django/`. Сущности `Material*`, `MaterialCategory`, `MaterialClass`, `UoM`, сопутствующие, **`FacadeOrder`**.

### Management

- `create_materials_editor` — пользователь веб-админки без staff: [README.md](../README.md).

---

## Смысл отдельных полей (коротко)

| Поле / элемент UI | Смысл |
|-------------------|--------|
| **Артикул** | Код/номер для сопоставления с учётом, справочниками, 1С. Непустой артикул **не дублируется**; после ввода обрезка **пробелов** (`strip`). |
| **Активен** (`is_active`) | Поле в БД у **`Material`**; в **веб-SPA карточки материала переключателя нет** — при сохранении из SPA уходит **`material?.is_active ?? true`** (новый — активен, существующий — без смены флага из формы). Изменение вручную — **Django admin** (`/admin/django/`). Фильтрация каталога калькулятора по **`is_active`** — см. чеклист. |
| **Коэф** (колонка списка) | Зарезервировано под будущий коэффициент, пока `—`. |
| **Вкладки карточки** | **«Общие параметры»** (имя, артикул, классы, ед. изм. + текстура-статус, цена + округление, размеры мин/макс, примечание) и **«Параметры текстуры»** (режим цвет/текстура, база, превью-сфера; часть **`tex_*`** в форме/API сохранена). Отдельной вкладки **«Доп. параметры»** нет — см. блок «Изменения 2026-05-16 (карточка материала)». План: [PLAN.md](PLAN.md). |
| **Сопутствующие** | К расчёту цены в калькуляторе; в SPA — **модалка** (**`admin-modal--extras`**) по клику на строку списка; **`PATCH`** только **`related_items`** (**«Сохранить»** в модалке); предпросчёт в UI. Полная карточка — отдельная модалка (**шестерёнка**). |

---

## Фронтенд (`frontend/`, Vite 6 + React 19 + TS)

| Файл / папка | Назначение |
|--------------|------------|
| `AdminApp.tsx` | Шапка **`admin-header-top`**, **`admin-section-tabs`**. **`/materials`**: **`TreeRow`** (опционально **`treeDnD`** — DnD папок и приём материалов), **`FolderCreateModal`**, **`applyFolderMove`** / **`applyMaterialMove`**, **`fetchMaterialsFiltered`**, **`folderMoveDnD.ts`**; кнопка **«Все папки»**; без **`MaterialSearchModal`** и без **`FolderMoveModal`** на этой вкладке. Заголовок списка: **«Материалы в папке:»** или **«Материалы: все папки»**; список **`mat-list-row`** (**`draggable`**) / **`mat-list-gear-btn`** (иконка **cog-6-tooth** в **`svg`**); сопутствующие — **`createPortal`** (**`admin-modal--extras`**); карточка — **`MaterialForm`**. **«Заказы»** — **`AdminOrdersPanel`**. |
| `AdminOrdersPanel.tsx` | Список **`/api/facade-orders/`**, смена статуса (**в т.ч. «Завершён»**), PDF. |
| `FolderCreateModal.tsx` | Окно создания папки в стиле Explorer: дерево + сетка содержимого (📁/📄), хлебные крошки, поле имени, **`createCategory`** через **`onCreate(parent, name)`**. |
| `FolderMoveModal.tsx` | Explorer: DnD **любой** папки (дерево, **«Все папки»**, плитка 📁); опционально DnD материала 📄; кнопка **«Закрыть»**. Импорт MIME из **`folderMoveDnD.ts`**. На вкладке **«Материалы»** не используется (2026-05-12). |
| `folderMoveDnD.ts` | Общие **`DND_FOLDER`**, **`DND_MATERIAL`**, **`isFolderDrag`**, **`isMaterialDrag`** для **`AdminApp`** и **`FolderMoveModal`**. |
| `MaterialSearchModal.tsx` | Модалка поиска: фильтры, дерево, таблица. Режимы: **`multiPick`** — калькулятор; **`navigate`** — по коду остаётся для возможных сценариев, **на вкладке материалов SPA не монтируется** (2026-05-12). **`fetchMaterialsFiltered`**, debounce. |
| `MaterialExtrasPanel.tsx` + **`MaterialExtrasPanel.css`** | Сопутствующие, предпросчёт; вызывается из модалки **`admin-modal--extras`** в **`AdminApp`**. |
| `App.tsx` | Маршруты: **`/login`** (**`LoginRoute`** + **`safePostLoginTarget`** для **`state.from`**); защищённые **`/materials/*`**, **`/calculator/*`**, **`/orders/*`**, **`/users/*`**; **`/`** — **`PublicShell`** с **`Outlet`**: индекс + **`my-orders`** + **`guide`** → **`/`** + **`*`** → калькулятор. **`refreshAuth`**, **`AdminRoute`**. |
| `App.css` | **`public-shell*`**, **`public-shell__main`** (скролл контента при `overflow:hidden` у `#root` на десктопе), **`public-shell__section-tabs`**, **`public-shell__user`**, **`public-shell__logout`**. |
| `PublicClientPages.tsx` + **`PublicClientPages.css`** | **`ClientMyOrdersPage`** (список заказов, **`HintButton`** у статуса), **`isPublicCalculatorRoute`**, **`PublicShellOutletContext`**. |
| `CalculatorPage.tsx` | Проп **`variant`**: **`admin`** — префикс `/calculator`, полный UI; **`public`** — URL с корня (`/`, `/frame/...`), заголовок «Подбор фасада», без запроса профилей. Обёртка **`CalcPathsProvider`**. Шаги 1–8 для рамочного фасада; `NavLink` шага 1 с **`end`**. Шаг **6**: вкладка всегда в разметке; **`canOpenFrameStep6`** = шаг 4 готов и **`isFrameMortiseHingeSelected()`**. На шаге 8 класс **`calc-routes-wrap--step8`**. |
| `calculator/calcPathsContext.tsx` | `step(rel)`, `home`, `readOnly`, `normalizedCalcPath`, `facadeFromNormalized`. |
| `calculator/Step4FrameFilling.tsx` | Шаг 4 (рамочный): типы наполнения; меню **⚙** на плитке как на шаге 2; **«Поиск»** → **`MaterialSearchModal`** (мультивыбор); формы — **`frame2-create-grid--file-status-pair`**; при **`readOnly`** скрыты CRUD. |
| `CalculatorPage.css` | **`.calc-side-panel`** — единая высота левой панели (шаги 1–3, `frame2-card`, `frame3-left`, заглушки МДФ/ПВХ), `overflow-y: auto`. **`#calc-step-panel-1 .calc-card`** — `max-width` 640px / 700px (≥1280px), как первая колонка сетки рамочного шага. |
| `calculator/Step2FrameFacade.tsx` | Шаг 2 (рамочный): плитки типов профилей; на плитке меню **⚙** (**`tree-gear-btn`** / **`tree-gear-menu`**: «Редактировать», «Удалить») и модалка удаления типа (**`createPortal`**, **`profileTypeDeleteModal`**). **«Поиск»** → **`MaterialSearchModal`** для цветов (пакетно). Формы создать/редактировать тип: сетка **`frame2-create-grid--file-status-pair`**. Эскиз: **`facadeSketchBoxStyle`**, **`useSyncExternalStore`**, снимок **`"${h}|${w}"`**, `localStorage`, **`useCalcPaths()`**. В **`readOnly`** скрыт CRUD. |
| `calculator/Step2MdfFacade.tsx` / `Step2PvcFacade.tsx` | Заглушки; контент в **`calc-side-panel`**. |
| `calculator/Step3FrameSizes.tsx` | Шаг 3: габариты и кол-во (**дефолт 500×200 мм** при пустом `localStorage`); min/max из материала цвета; редирект на **`step('frame')`**, если сессия шага 2 не готова. Чертёж **`frame3-dim-drawing`**; эскиз — **`facadeSketchBoxStyle`**. |
| `calculator/Step3FrameSizes.css` | Сетка `frame3` как у `frame2`; **`frame3-right.frame2-sketch`**: `overflow: visible`; стили чертёжных размеров; **`z-index`** у размеров выше эскиза; модификаторы **`frame3-dim-drawing--right` / `--bottom`**, цепочки **`.hinge-chain-dim`** (в т.ч. **`--narrow`**), слой **`frame3-hinge-dim-layer`**. |
| `calculator/Step5FrameSummary.tsx` | Шаг 5: эскиз, **`FrameHingeMortisePanel`**; «Следующий шаг» на шаг **6** или **7** в зависимости от присадки под петли. |
| `calculator/Step6FrameHingeLayout.tsx` | Шаг 6: сторона, count 1…10, ввод расстояний парами, дефолты равномерно по длине кромки, сброс при смене стороны; превью с **`frame3-drawing-core`** и цепочками петель; редирект на шаг 7, если **`!isFrameMortiseHingeSelected()`**. |
| `calculator/Step7FrameHandleHoles.tsx` | Шаг 7: количество **`countStr`** (0…10, default 0, blur восстанавливает 0), **`calc_handle_holes`**, запрет стороны с петлями; эскиз петель + ручки; при **0** отверстий — эскиз габаритов как шаг 5; гидрация **`useLayoutEffect`**; в админке при полном каталоге — **`HandleHoleDiameterAdminSelect`**. |
| `calculator/HandleHoleDiameterAdminSelect.tsx` | Админ: выпадающий список диаметров с видимостью для клиента, добавлением и удалением строк (API). |
| `calculator/Step8FrameResult.tsx` | Шаг 8 «Итог»: сводка, контакты, таблица цены; клиент — **`createFacadeOrder`**, модалка входа для гостя, обязательные контакты при **`readOnly`**, редирект на **`/my-orders`**; staff — **mailto**; **«Открыть PDF»** — **`buildFrameClientPdfBlob`**; **`preloadFramePdfFont`**. |
| `calculator/Step8FrameResult.css` | Вёрстка шага «Итог» (**`step8-result__scroll-pack`** и др.), стили печати (`@media print`). |
| `calculator/frameClientPdf.ts` | PDF (**jspdf**, **jspdf-autotable**): сводка + листы фасадов; строка «Раскладка петель» на первой странице только при **`includeHingeLayoutRow`**; Noto Sans (**`public/fonts/`** + CDN), регистрация шрифта на каждый **`jsPDF`**. |
| `calculator/sketchFrame.ts` | `resolveMediaUrl`, **`facadeSketchBoxStyle`** (пропорции и **`--sketch-scale-y`** для `.sketch`), **`materialTextureLayerStyle`** / `sketchFrameInlineStyle`. |
| `calculator/frameCalcSession.ts` | **`FRAME_DEFAULT_HEIGHT_MM`**, **`FRAME_DEFAULT_WIDTH_MM`** (500 / 200); `isFrameStep2Ready`, **`isFrameStep4Ready`**, **`isFrameMortiseHingeSelected`**, `FRAME_CALC_SESSION_EVENT`, `subscribeFrameCalcSession`, `notifyFrameCalcSession`, **`clearFrameCalculatorStorage`**, **`readCalculatorPriceConfigKey`**; присадка/петли: **`CALC_LS_*`**, типы **`HingeMountSide`**, **`HingeLayoutPersisted`**; шаг 6: **`hingeEdgeLengthMm`**, **`hingePairPartnerIndex`**, **`hingeMeasuresFromEdgeStart`**, **`defaultHingeAbsPositionsMm`**, **`hingeUserInputsToAbsoluteMm`**, **`hingeAbsoluteToUserInputStrings`**, **`readFrameDimsMm`**, **`readHingeLayout`**, **`writeHingeLayout`**, **`validateHingePositions`**; шаг 7: **`CALC_LS_HANDLE_HOLES`**, **`HandleHolesPersisted`**, **`isHandleSideBlockedByHinges`**, **`readHandleHoles`**, **`writeHandleHoles`**, **`handleHoleCentersMm`**, **`validateHandleHoles`**. |
| `calculator/framePriceEstimate.ts` | Разбор ед. изм., **`relatedItemsCalculatorCost`** (масштаб строк), `computeFramePriceBreakdown` (профиль, наполнение). |
| `calculator/CalcPriceTotals.tsx` | Панель «Расчёт / Итого»; шаг 1 без сумм; `useSyncExternalStore` + `fetchMaterial` по id из `localStorage`; fallback габаритов — **`FRAME_DEFAULT_*`**. |
| `api.ts` | `apiFetch` + методы калькулятора и **`facade-orders`** (`createFacadeOrder`, `fetchFacadeOrders`, `patchFacadeOrderStatus`); **`fetchMaterialsFiltered`** / **`MaterialsListFilterParams`**; **`searchMaterials`** (тот же гибкий **`search`** на бэкенде). Для гостя GET уходит **без** Bearer (если нет токена) — см. права бэкенда. |
| `index.css` / `App.css` / `AdminApp.css` | На десктопе **`html`/`body`/`#root`**: **`max-height: 100dvh`**, **`overflow: hidden`** — скролл **внутри** колонок админки или в **`public-shell__main`** на публичном сайте. Для **`#admin-panel-calculator`** — цепочка flex и шаг 8. |

### Поведение UI

- **Папки:** клик по **названию** — выбор; **«Все папки»** — полный список материалов справа; **▸/▾** — свернуть/развернуть; **⚙** — переименовать, **переместить** (перетаскивание строки папки на цель **на странице**; в разделе **текстур** — ещё **`FolderMoveModal`**), удалить (модалка + **DELETE**). **Создание** — **`FolderCreateModal`**. **Поиск по каталогу из боковой панели материалов** — снят (2026-05-12); в калькуляторе **`MaterialSearchModal`** без изменений по роли.
- **Список материалов:** легенда колонок, колонка «Коэф» — плейсхолдер.
- **Карточка (модалка):** вкладки **«Общие параметры»** и **«Параметры текстуры»** — открытие по **шестерёнке** в строке списка (ранее также **«Перейти»** из **`MaterialSearchModal`** на вкладке материалов — кнопка поиска снята в 2026-05-12). Размеры заготовки — в «Общих параметрах» (см. блок «карточка материала» выше).
- **Сопутствующие** — **модалка** по клику на строку списка (не по шестерёнке); **`PATCH`** только **`related_items`**, кнопка **«Сохранить»** в модалке. Закрытие: **«Закрыть»**, **Escape**, клик по backdrop (не во время сохранения). При открытии **модалки карточки** шестерёнкой **`extrasTarget`** сбрасывается.
- **Калькулятор:** `localStorage`: `calc_frame_type_id`, `calc_frame_color_id`; **`calc_frame_height_mm`**, **`calc_frame_width_mm`** (после сброса подставляются **500×200** по **`FRAME_DEFAULT_*`**), **`calc_frame_qty`** (шаг 3); **`calc_filling_type_id`**, **`calc_filling_material_id`** (шаг 4); **`calc_frame_mortise`**, **`calc_hinge_source`**, **`calc_hinge_type_id`**, **`calc_hinge_material_id`** (шаг 5, присадка/петли); **`calc_hinge_layout`** (шаг 6); **`calc_handle_holes`** (шаг 7). Сброс при новом выборе фасада на шаге 1. **`frame2-sketch`:** без внешней рамки; пропорции `.sketch` на шаге 2 синхронизированы с габаритами (см. **`facadeSketchBoxStyle`**); стили в **`Step2FrameFacade.css`** (шаги 3–7 подключают при необходимости).

---

## Операция и типовые сбои

- **500 на `/api/materials/`**, во фронте «HTML вместо JSON» — чаще всего **схема БД не совпадает с кодом**: из корня выполнить **`py backend\manage.py migrate`** (подтянутся все неприменённые миграции, в т.ч. **`0021`** — сопутствующие; **`0039`** — поле **`import_export_snapshot`**; **`0040`** — метаданные **`import_export_snapshot`**), **остановить все процессы** на **`:8000`**, затем снова **`py backend\manage.py runserver`**. Для очень старых баз также нужны `0010`–`0011`. После добавления **rapidfuzz**: `py -m pip install -r requirements.txt` (или только **`rapidfuzz`**). Подробности обмена с файлами: **[MATERIALS_IMPORT_EXPORT.md](MATERIALS_IMPORT_EXPORT.md)**.
- **`database is locked` (SQLite)** при входе или записи: убедиться, что в **`settings.py`** включён **`timeout`** для SQLite; не держать открытыми несколько конкурирующих процессов на одной **`db.sqlite3`** без необходимости.
- **`DisallowedHost`:** проверить **`DJANGO_ALLOWED_HOSTS`** / хост в адресной строке (в dev по умолчанию добавлены **`0.0.0.0`** и **`[::1]`**).
- **404 на `/api/calculator-profiles/`** — обычно запущен **старый/другой** `runserver` или конфликтует несколько процессов. Решение: оставить **один** backend на `:8000`, применить миграции и перезапустить.
- **401 на `/api/*`** — для **категорий, профилей калькулятора (`calculator-profiles`), auth/me** и т.п. без JWT — ожидаемо; войти через **`/login`**. Для **`GET /api/materials/`**, **`GET /api/calculator-profile-types/`**, **`GET /api/calculator-filling-types/`**, **`GET /api/calculator-hinge-types/`** при актуальном бэкенде **401 быть не должно** (анонимное чтение). Если 401 — проверить, что поднят актуальный `views.py` и нет лишнего `IsAuthenticated` на list/retrieve.
- **CORS (dev):** `http://127.0.0.1:5173` / `localhost:5173` в `backend/.env`.
- **Текстуры (dev):** раздача файлов включена только в `DEBUG=1` через `/media/`. Для работы загрузки нужен `Pillow`.
- **Длинные имена файлов текстур:** у `ImageField` увеличен `max_length` (миграция `0014`), иначе возможен 400 при загрузке.
- **Удаление текстуры:** кнопка «Убрать текстуру» очищает поле и сохраняет удаление через `PATCH texture_image=null`.
- **Миграция `0021`:** после обновления кода выполнить `py backend\manage.py migrate` (поля сопутствующих).
- **Миграции `0038`–`0039`:** снимок строки таблицы импорта/экспорта на карточке материала — **`modus_snapshot`** → **`import_export_snapshot`**; без **`migrate`** возможны 500 при обращении к **`Material`**. См. **[MATERIALS_IMPORT_EXPORT.md](MATERIALS_IMPORT_EXPORT.md)**.
- **Миграция `0032`:** удаление модели операций у материала — выполнить `migrate`.
- **Два remote (`origin` + `customer`):** основной репозиторий и копия для заказчика — пуши **отдельно** (`git push origin main`, `git push customer main` или **`git push-mine`** / **`git push-customer`**). SSH для заказчика: псевдоним **`github.com-furnitech`** в `~/.ssh/config`. Если **`git push -u customer`** сбил отслеживание **`main`**, выполнить **`git branch --set-upstream-to=origin/main main`**. Сводка в [README.md](../README.md) и [ARCHITECTURE.md](ARCHITECTURE.md).

### Ручная проверка расчёта (сопутствующие)

1. Материал цвета профиля с ед. изм. м.п., сопутствующее **«Как у основного»** — сумма сопутствующих растёт с периметром и с \(N\) фасадов.
2. То же + строка **«На фасад»** — эта строка не растёт с периметром, только с \(N\).
3. Наполнение м² + шаг 3 — цена наполнения меняется с площадью; сопутствующие наполнения с **«По ед. изм. строки»** — по правилам ед. изм. сопутствующего.

---

## Документация в репо

| Файл | Содержание |
|------|------------|
| [PLAN.md](PLAN.md) | План этапов продукта. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Стек, API, модели, UI, соглашения. |
| [MATERIALS_IMPORT_EXPORT.md](MATERIALS_IMPORT_EXPORT.md) | Импорт/экспорт каталога (XLSX/XML), API, колонки, снимок строки. |
| [DEPLOY.md](DEPLOY.md) | Production: Vercel, Render, Supabase, env. |
| [../README.md](../README.md) | Быстрый старт, роли, пользователи. |
| `scripts/furnitech_status.py` | Handoff, шапки `docs/*`. |
| `.cursor/skills/furnitech-handoff/` | Напоминание агенту. |

## Чеклист дальше

- [x] Аутентификация (JWT) и права на `/api/*`.
- [x] Папки: переименование, **перенос** (PATCH `parent`), удаление (**каскад** материалов и подпапок); UI шестерёнка + модалки (**создание**, **перенос**).
- [x] Поиск материалов: в **калькуляторе** — **`MaterialSearchModal`** (**`multiPick`**); гибкий поиск на бэкенде (**rapidfuzz**). На вкладке **«Материалы»** отдельный поиск через модалку **снят** (2026-05-12); навигация — дерево, **«Все папки»**, DnD.
- [x] Уникальность непустого артикула; миграция `0011`.
- [x] База KZT, сопутствующие/операции, миграция `0010`, вкладка «Общие параметры» (альтернативные валюты и поля **`fnp_name`** / **`unit_mass`** сняты миграцией **`0030`**).
- [ ] Фильтр/скрытие неактивных материалов в веб-админке и в клиенте (по `is_active`) — по необходимости.
- [x] Вкладка «Доп. параметры» (поля лимитов/параметров для калькулятора).
- [x] Вкладка «Параметры текстуры» (цвет/текстура, загрузка файла, превью-сфера, настройки).
- [x] Удаление текстуры кнопкой «Убрать текстуру» (серверное сохранение удаления).
- [x] Профили калькулятора (материалы) и цвета (материалы) через `/api/calculator-profiles/`.
- [x] Типы профилей (не материал) + цвета с флагами + загрузка картинки: `/api/calculator-profile-types/`.
- [x] Калькулятор (рамочный): шаг 2 — выбор типа профиля и цвета + эскиз; шаг 3 — габариты с ограничениями из материалов.
- [x] Калькулятор: шаг 4 — наполнение (`CalculatorFillingType`, API, UI).
- [x] Публичная главная **`/`**: калькулятор без входа, read-only UI; анонимное **GET** для материалов и типов калькулятора на бэкенде; вкладки **Калькулятор** / **Мои заказы**; прокрутка длинных страниц (**`public-shell__main`**).
- [x] Калькулятор (рамочный): ориентировочная **цена справа**; сопутствующие с **`quantity_scale`**, операции с **`price_per_facade`** (миграция **`0021`**).
- [x] Калькулятор (рамочный): шаг 5 — **присадка / петли** (`CalculatorHingeType`, UI, `localStorage`); шаг 6 — **расстояния петель**, эскиз с выносными размерами (миграция **`0026`**); шаг 8 — **итог** (`/frame/result`, сводка и ориентировочная цена).
- [x] Калькулятор: **PDF для клиента** (шаг 8, **`frameClientPdf.ts`**, многостраничный файл).
- [x] Модель заказа (**`FacadeOrder`**), экран **«Заказы»** в админке и **«Мои заказы»** у клиента; отправка с шага 8 (**`POST /api/facade-orders/`**).
- [x] **Импорт и экспорт** каталога материалов (**`GET /api/materials-export/`**, **`POST /api/materials-import/`**), модуль **`material_import_export.py`**, поле **`import_export_snapshot`**, кнопки в админке; документация **[MATERIALS_IMPORT_EXPORT.md](MATERIALS_IMPORT_EXPORT.md)**.
- [ ] Клиентский калькулятор: доработка до уровня типичного публичного конфигуратора (ценники, корзина, оформление).
- [ ] 1С: sync; `article` + `external_id` как якоря.

## Как продолжить (агент / разработчик)

1. `py scripts/furnitech_status.py` (из корня).
2. [ARCHITECTURE.md](ARCHITECTURE.md), [PLAN.md](PLAN.md).
3. В конце сессии — обновить **этот файл** (дата, факты).
