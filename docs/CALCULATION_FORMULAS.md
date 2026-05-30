# Формулы расчёта и классы материалов

Руководство по справочнику **классов материалов**, вкладке админки **«Расчеты»**, модели **формул**, API и поведению публичного калькулятора.

## Концепция

1. **`MaterialClass`** — справочник меток (например «Профиль», «Фасад», «Фурнитура»). У записи есть `name`, опционально `code` (slug), поля **`external_id` / `last_synced_at`** для задела под 1С.
2. У **`Material`** связь многие-ко-многим **`material_classes`**: у одной позиции каталога может быть несколько классов. Выбор — в карточке материала (админка → **Материалы** → чекбоксы в блоке **«Классы материала»**).
3. **`CalculationFormula`** — сохранённые правила сборки суммы как **выражение из токенов**:
   - ссылка на класс (**`class_id`**);
   - арифметические знаки и скобки;
   - литералы (**числа**).

Клиент калькулятора выбирает **конкретные материалы** (цвет профиля, наполнение). Для них подгружаются полные данные включая **`material_class_ids`**, **`pricing_calc_mode`** и сопутствующие строки (`related_items`), у сопутствующих также приходят **`material_class_ids`** и **`pricing_calc_mode`** вложенного материала. Формула **не содержит** ручной ввод кода класса в виде строки — только **`id`** из справочника, чтобы ошибки набора символов невозможны в конструкторе.

## Режим расчёта материала (`pricing_calc_mode`)

Задаётся в карточке материала (админка → **Материалы** → флажки **Погонаж / Лист / Штуки** в блоке **«Расчёт»**). Хранится в БД (**миграция `0045_material_pricing_calc_mode`**), choices: **`linear`**, **`sheet`**, **`piece`** (пусто — fallback).

| Флажок | `pricing_calc_mode` | Объём на 1 фасад (H, W в мм) | Итого |
|--------|---------------------|------------------------------|-------|
| Погонаж | `linear` | периметр `2×(H+W)/1000` м.п. | × \(N\) фасадов |
| Лист | `sheet` | площадь `H×W/1_000_000` м² | × \(N\) |
| Штуки | `piece` | 1 шт. | × \(N\) |

Реализация — **`frontend/src/calculator/framePriceEstimate.ts`**:

- **`resolveMaterialPricingUomCode(material)`** — если **`pricing_calc_mode`** задан, возвращает **`m`** / **`m2`** / **`pc`**; иначе **`resolvePricingUomCode(material.uom)`** (код и подпись ед. изм.).
- **`unitsPerFacade(H, W, code)`** — перевод кода в число единиц цены.
- **`pricedUnitsForMaterial`**, **`materialLineCost`**, **`computeFramePriceBreakdown`** — используют **`resolveMaterialPricingUomCode`**.
- Сопутствующие с **`quantity_scale = use_related_uom`** — объём по **`pricing_calc_mode`** (или fallback) **сопутствующего** материала; для этого **`pricing_calc_mode`** включён в **`MaterialSummarySerializer`**.

Активная **формула по классам** (**`calculationFormula.ts`**) опирается на те же **`materialLineCost`** / **`pricedUnitsForMaterial`**, поэтому режим расчёта и коэффициент избытка влияют и на альтернативный итог.

## Коэффициент избытка (`excess_coefficient`)

Задаётся в карточке материала (админка → **Материалы** → поле **«Коэффициент избытка»** под блоком округления, **`mat-form-excess-field`**). Хранится в БД (**миграция `0046_material_excess_coefficient`**, default **`1`**).

| Значение | Смысл |
|----------|--------|
| **`1`** (default) | Без запаса — в расчёт идёт точное геометрическое количество |
| **`1.1`** | +10% к количеству (1 м.п. → 1.1 м.п. × цена) |
| **`≤ 0`** или пусто в UI | При сохранении/расчёте трактуется как **`1`** |

Формула в **`frontend/src/calculator/framePriceEstimate.ts`**:

- **`unitsPerFacade(H, W, code)`** × **`N`** фасадов → «сырое» количество;
- × **`parseExcessCoefficient(material)`** → количество для умножения на **`base_price`**.

Применяется в **`pricedUnitsForMaterial`**, **`materialLineCost`**, **`computeFramePriceBreakdown`** и при **`use_related_uom`** у сопутствующих (коэффициент **сопутствующего** материала). Поле включено в **`MaterialSummarySerializer`** для summary в **`related_items`**.

**Округление** (`rounding_mode` / `rounding_multiple`) применяется после избытка в **`applyQuantityRounding`** (**`priceBreakdown.ts`**, **`pricedUnitsForMaterial`**).

## Альтернативный режим суммы против «старого» брейкдауна

- **Без активной формулы** или при **ошибке вычисления** итог — **`computeFramePriceBreakdown`**: профиль + сопутствующие к профилю + наполнение (+ к наполнению) + **петли производства** (если выбраны).
- **С активной формулой** итог = выражение по **классам** + **`hingeSubtotalOutsideFormula`** (петли, чей класс **не** в токенах формулы).
- В UI (**`CalcPriceBreakdownView`**) — классы из формулы и/или секции «Профиль / Наполнение / Петли» с детализацией количества и запаса.

### Когда что попадает в расчёт (шаги калькулятора)

| Шаг | Профиль | Наполнение | Петли производства |
|-----|---------|------------|-------------------|
| 3 (габариты) | да | **нет** (`includeFillingInPrice: false`) | нет |
| 4+ | да | да (если выбрано) | нет |
| 5–8 | да | да | да, если присадка + производство + материал; кол-во с шага 6 (**`hingesPerFacadeForPrice`**) |

Смена **цвета профиля** на шаге 2 сбрасывает сохранённое наполнение в `localStorage`.

## Выбор активной формулы

Фронтенд вызывает **`GET /api/calculation-formulas/?active=1`** и использует **первый** элемент массива **`results`**.

На бэкенде список сортируется по **`sort_order`**, затем по **`name`**. Рекомендация эксплуатации: держите **ровно одну** запись с **`is_active = true`**; поле **`sort_order`** задаёт порядок, если активных несколько (первый побеждает).

## Порядок расчёта количества (на материал)

1. **Геометрия на 1 фасад** — `unitsPerFacade(H, W, режим)`; режим из **`pricing_calc_mode`** (Погонаж / Лист / Штуки) в карточке материала, не в формуле.
2. **× N** фасадов → `quantityRaw`.
3. **× `excess_coefficient`** (коэффициент избытка, default 1) → `quantityWithExcess`. Пример: 5 м.п. × 1,1 = 5,5 м.п.
4. **Округление** (`rounding_mode` / `rounding_multiple`) → `quantityBilled`.
5. **× `base_price`** (и `quantity` у сопутствующей строки) → `subtotal`.

Реализация: **`frontend/src/calculator/priceBreakdown.ts`**, **`pricedUnitsForMaterial`** в **`framePriceEstimate.ts`**.

## Как считаются «значения» для каждого `class_id`

Логика в **`frontend/src/calculator/calculationFormula.ts`** через **`collectFrameMaterialLines`**:

1. Собираются строки **выбранных** в калькуляторе материалов: профиль, наполнение, петли производства (с шага 5) и их **`related_items`** — не все материалы справочника с этим классом.
2. **`classSubtotalFromLines(classId)`** = сумма **`subtotal`** строк с этим **`class_id`** в **`material_class_ids`**.
3. Токены **`class`** в формуле подставляют эту сумму; **`evaluateCalculationFormulaWithBreakdown`** возвращает **`classSteps`** для UI.

Затем токены формулы — два стека: приоритет **`*`** и **`/`** выше **`+`** и **`-`**, скобки **`(` `)`**.

**Петли:** материал петли и сопутствующие участвуют в классах, если у них есть нужный **`material_class_ids`**; иначе сумма петель добавляется к итогу формулы отдельно. **Ручка** в расчёт стоимости **не** входит.

## Конструктор в админке

| Элемент | Описание |
|--------|-----------|
| URL | **`/calculations`** (только вошёл **staff**, см. **`AdminRoute`**) |
| Компонент | **`AdminCalculationsPanel.tsx`** |
| Основная страница | Слева дерево папок формул (**`CalculationFormulaCategory`**), справа список формул и кнопка **«+ Формула»** |
| Модалка редактора | Три колонки: **дерево классов** | **список классов** | **keypad**; поле **«Наименование»** в шапке; **`input`** «Поле формулы»; **«Сохранить»** / **«Удалить»** |

При сохранении в API уходит **`tokens`** и вычисляемая строка **`expression`** (удобство отображения; расчёт и публичный калькулятор идут по **`tokens`**).

### Имя формулы (`name`)

В шапке модалки — редактируемый **`input`** (**`mat-form-title-input`**, **`id="formula-card-dialog-title"`**). При **«Сохранить»** имя берётся как **`draft.name.trim()`**; если пусто — **`expression.trim()`**, иначе строка **`Формула`**.

### Строка `expression` и отображение

Функция **`formulaDisplayExpression`** в **`frontend/src/calculator/calculationFormula.ts`** склеивает подписи токенов **без пробелов** (например `365+3(5`, а не `3 6 5 + 3 ( 5`). Число в токенах может быть многозначным (**`type: "number"`**, поле **`value`**); знаки и классы — отдельные токены. Поле **`expression`** в БД дублирует эту строку для списка и подписи.

### Редактирование формулы (модель токенов + позиция в строке)

Внутреннее состояние редактора — массив **`tokens`** и позиция курсора в **строке** (**`formulaStringCursorRef`**, синхронизация с **`selectionStart`** поля ввода).

| Способ ввода | Поведение |
|--------------|-----------|
| **Класс** | Щелчок по строке в **`MaterialClassPickerBody`** — вставка токена **`class`** в позицию курсора |
| **Цифры и знаки** | Keypad справа **или** клавиатура в поле формулы: **`0–9`**, **`.`**, **`+ − * / ( ) =`** (другие символы и вставка из буфера заблокированы) |
| **Backspace** (клавиатура в поле) | Удаляет **один символ** слева от курсора; внутри числа — одну цифру; знак или класс — целиком один токен |
| **«Назад»** на keypad | Всегда удаляет **с конца** формулы (последняя цифра числа или последний токен) — **`formulaBackspaceEnd`** |
| **«Очистить»** на keypad | Сброс всех **`tokens`** и курсора |
| **Курсор** | Клик и стрелки в **`input`**; после вставки с keypad курсор следует за изменением строки |

Логика посимвольного редактирования — функции в **`AdminCalculationsPanel.tsx`**: **`formulaBackspaceAtStringPos`**, **`formulaInsertDigitAtStringPos`**, **`formulaInsertOpAtStringPos`**, **`formulaInsertClassAtStringPos`**, **`formulaDeleteStringRange`**, **`formulaPrepareInsertAtStringPos`**. Общий путь изменений — **`applyFormulaStringEdit`**.

Знак **`=`** допускается в **`tokens`** (валидация API: **`valid_ops`** включает **`=`**); при **оценке** формулы в **`evaluateCalculationFormula`** токены **`op`** со значением **`=`** пропускаются (не участвуют в расчёте).

### Выбор классов (`MaterialClassPickModal.tsx`)

- **`MaterialClassPickerBody`** — общее тело выбора классов: дерево папок **`MaterialClassCategory`**, список классов в таблице **`material-class-pick-mat-list`** — компонент **`ClassPickListTable`** в **`MaterialClassPickModal.tsx`**.
- В **модалке редактора формулы** пикер встроен в **`AdminCalculationsPanel`** с **`hidePickChrome`**: без строки поиска и без хлебных крошек над деревом (компактный блок внутри **`admin-calculations-formula-dialog`**).
- Дерево папок классов в пикере использует ту же разметку корня, что **«Папки формул»**: **`ul.folder-explorer-tree-root.admin-materials-tree-root`**, **`li.folder-explorer-tree-item--materials-root`**, раскрыватель ▾/▸ и корневая ссылка «База классов» (**`mccRootExpanded`**).
- Строка **«Показано: …»** передаётся в **`ClassPickListTable`** как **`shownScopeLabel`** и рендерится **внутри** того же **`div.mat-list-table.material-class-pick-mat-list`** первой строкой (**`material-class-pick-scope-row`** в **`AdminApp.css`**), без отдельного **`p.folder-explorer-target`**.
- Отдельная модалка **`MaterialClassPickModal`** (портал) по-прежнему используется в карточке материала (**`AdminApp.tsx`**): полный интерфейс с поиском и крошками.

Добавление нового класса в справочник из вкладки «Расчеты» как отдельная форма в этом документе не описано — классы создаются на вкладке **«Классы»** (**`POST /api/material-classes/`**).

Где живёт сумма на шагах калькулятора:

- **`CalcPriceTotals.tsx`** — боковая панель с шага 3;
- **`Step8FrameResult.tsx`** — итог, PDF, **`snapshot`** заказа (если включаются поля брейкдауна).

## Backend

### Модели

Файл **`backend/materials/models.py`**:

- **`MaterialClass`** — справочник.
- **`CalculationFormula`** — `name`, `expression`, `tokens` (JSON-массив), `is_active`, `sort_order`, метки времени.

Миграция: **`backend/materials/migrations/0041_calculation_formula.py`**.

После обновления кода на сервере обязательно:

```bash
python backend/manage.py migrate
```

(Удобнее из корня репозитория с активированным **`requirements.txt`** / venv.)

### API

REST: **`/api/calculation-formulas/`** и **`/api/calculation-formulas/{id}/`**.

Регистрация: **`backend/materials/urls.py`** → **`CalculationFormulaViewSet`**.

Разрешения (**`backend/materials/views.py`**):

- класс **`AllowAnyReadStaffWrite`** — **GET/HEAD/OPTIONS** без авторизации (нужно публичному калькулятору без JWT),
- запись (**POST**, **PATCH**, **PUT**, **DELETE**) — только авторизованный пользователь с **`request.user.is_staff`**.

Изменять формулы из «редактор материалов» без **`is_staff`** нельзя; чтение — для любого клиента браузера.

Query-параметр: **`active=1`** (или **`true`** / **`yes`**) фильтрует **`is_active=True`**.

Валидация токенов — **`CalculationFormulaSerializer`** в **`backend/materials/serializers.py`**:

- объект с **`type`** = **`class`** и положительным **`class_id`**, существующим в **`MaterialClass`**;
- **`op`** и множество **`+ - * / ( ) =`**;
- **`number`** — парсится как **`Decimal`**;
- каждый элемент — объект; список токенов — массив.

### Классы материалов в API материала

Эндпоинт **`/api/material-classes/`** — CRUD как раньше, права через **`DjangoModelPermissions`** (JWT + права модели).

У **`Material`** в ответах полное тело включает **`material_class_ids`**.

Для **краткой** выписки материала (**`MaterialSummarySerializer`**) добавлено поле **`material_class_ids`** (через **`SerializerMethodField` + prefetch**), чтобы вложенный **`related_material`** в **`related_items`** калькулятора тоже нёс классы — иначе формула по сопутствующим была бы недоступна.

### Django admin

**`/admin/django/`** зарегистрирована **`CalculationFormula`** с списком: имя, активность, порядок, дата изменения (**`CalculationFormulaAdmin`** в **`backend/materials/admin.py`**).

---

## Frontend: типы и API-клиент

- Типы: **`CalculationFormula`**, **`CalculationFormulaToken`** в **`frontend/src/types.ts`**.
- Вызовы: **`fetchCalculationFormulas`**, **`createCalculationFormula`**, **`updateCalculationFormula`**, **`deleteCalculationFormula`** — **`frontend/src/api.ts`**.
- Создание записей **`MaterialClass`**: вкладка **«Классы»** или **`POST /api/material-classes/`** из **`api.ts`** (вызов **`createMaterialClass`** при необходимости из других экранов).

## UI модалки конструктора формулы (админка)

Компоненты: **`frontend/src/AdminCalculationsPanel.tsx`**, **`frontend/src/MaterialClassPickModal.tsx`** (**`MaterialClassPickerBody`**, **`ClassPickListTable`**). Стили: **`frontend/src/AdminApp.css`** (в т.ч. **`admin-calculations-*`**, **`material-class-pick-*`**, **`mat-form-title-input`**).

### Структура диалога

- Редактирование открывается через **`createPortal(..., document.body)`**.
- Фон: **`admin-modal-backdrop`** — закрытие только если **и нажатие, и отпускание** указателя были на подложке (**`onPointerDown` / `onPointerUp`**), чтобы выделение текста в поле формулы не закрывало модалку при **`mouseup`** на фоне.
- Корневой элемент — **`<section>`**: классы **`admin-panel`**, **`admin-panel--in-material-modal`**, **`admin-calculations-modal-surface`**, **`admin-calculations-formula-dialog`**; **`role="dialog"`**, **`aria-modal`**, **`onClick`** с **`stopPropagation`** на секции.
- Шапка **`mat-form-head`**: **`input.mat-form-title-input`** (наименование), крестик **`admin-modal-head-icon-close`**.
- Тело **`admin-calculations-formula-modal-body`**: блок **«Классы для формулы»** (три колонки), затем **«Поле формулы»** (**`input.admin-calculations-output--text`**), футер **`mat-form-actions`**.

### Раскладка «классы + keypad»

Строка **`admin-calculations-picker-keypad-row`** — CSS Grid **`repeat(3, 1fr)`** на всю ширину поля формулы:

| Колонка | Содержимое | Стили |
|---------|------------|--------|
| 1 | **`folder-explorer-tree`** (папки классов) | Тёмная подложка как у explorer |
| 2 | **`folder-explorer-content`** (таблица классов) | То же |
| 3 | **`admin-calculations-keypad-grid`** | Та же подложка; сетка **`4×5`**: `789/`, `456*`, `123-`, `0()+`, затем `.` · **Назад** · **Очистить** · **`=`** |

Обёртки **`admin-calculations-embedded-class-picker`** и **`folder-explorer`** в этой строке — **`display: contents`**, чтобы три панели стали прямыми колонками сетки. На узком экране (**`max-width: 720px`**) — вертикальный стек.

Цвета клавиш keypad (**`AdminApp.css`**): цифры и **`(` `)`** — нейтральные; **`+ − * /`**, **`.`**, **Назад**, **Очистить**, **`=`** — акцент «золото» (**`admin-calculations-keypad-key--op`**).

### Поле формулы

- Настоящий **`<input type="text">`**, значение — **`formulaDisplayExpression(draft.tokens)`** (controlled).
- Визуально совпадает с полем наименования: компактная высота, рамка **`var(--ft-border-2)`**, **`border-radius: 4px`**.
- Длинная строка прокручивается горизонтально (**`white-space: nowrap`**).

### Поведение

- После **успешного сохранения** — **`closeFormulaEditor()`**.
- **Удаление** сохранённой формулы: **`admin-modal-backdrop--stack-top`** + **`admin-modal`**; **`window.confirm`** не используется.

### Визуальная плотность

- На **`admin-calculations-modal-surface`** — **`--mat-scroll-fs` / `--mat-scroll-lh` / `--mat-scroll-ls`**, как у **`#admin-panel-calculations`**.

### Элементы интерфейса (актуально)

| Область | Классы / заметки |
|--------|-------------------|
| Наименование | **`input.mat-form-title-input`** в **`mat-form-title-line`** |
| Классы для формулы | **`MaterialClassPickerBody`** с **`hidePickChrome`**; подсветка выбранных **`selectedClassIds`** |
| Keypad | **`admin-calculations-keypad-grid`**; **Назад** / **Очистить** — **`admin-calculations-keypad-action-btn`** |
| Поле формулы | **`input.admin-calculations-output.admin-calculations-output--text`** |
| Действия внизу | **«Удалить»** — **`admin-secondary admin-danger`**; **«Сохранить»** — **`admin-primary`** |

Устаревшие элементы (удалены из UI): отдельные «теги»/чипы токенов, буфер числа, кнопка **«Вставить число»**, **«Назад»**/**«Очистить»** в заголовке поля формулы (перенесены на keypad).

### Связанные правила в `AdminApp.css`

- **`admin-calculations-formula-dialog.admin-panel--in-material-modal`** — габариты окна.
- **`admin-calculations-formula-dialog .admin-calculations-picker-keypad-row`** — трёхколоночная сетка и высота **`--formula-panel-h`**.
- **`admin-calculations-formula-dialog.admin-calculations-modal-surface .admin-calculations-output--text`** — компактное поле формулы.
- **`material-class-pick-mat-list`** / **`material-class-pick-scope-row`** — таблица классов и «Показано: …».

## Ограничения и возможные улучшения

- Несколько одновременно активных формул дают недетерминистичный первый элемент без явного выбора в UI — см. раздел про **`sort_order`**.
- Одна позиция с двумя классами добавляет два независимых вклада в сумму класса только если они реально связаны через две строки **`selectedClassValues`** или один материал с двумя id — см. код; при одном материале с двумя классами каждый из двух классов получает одну и ту же **полную** стоимость материала (дубликат экономического смысла возможен при неосторожной разметке).
- Расширение: привязка формулы к типу фасада, единственная активная на уровне БД (**`UniqueConstraint`**, когда `is_active`), учёт материала петель в разбиении.

## Связанные документы

- [ARCHITECTURE.md](ARCHITECTURE.md) — маршруты SPA, таблица API, упоминание **`framePriceEstimate`** и **`calculationFormula.ts`**.
- [PROGRESS.md](PROGRESS.md) — когда и что добавлено (чеклист датой).
- [PLAN.md](PLAN.md) — этап продукта «формулы / классы».
