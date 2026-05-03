# Furnitech — прогресс (обновляйте в конце сессии)

**Последнее обновление:** 2026-05-03

## Краткая сводка

Проект: **Django + DRF (JWT)** + **Vite + React 19 (TS)** — веб‑админка справочника материалов + **калькулятор** (админский и **публичный**).

**Публичная часть (без входа):** маршрут **`/`** — тот же сценарий шагов, что и в админке, но URL **без** префикса `/calculator`: `/` (шаг 1), `/frame`, `/frame/size`, `/frame/filling`, `/frame/summary`, `/frame/hinge-layout`, `/frame/handle-holes`, **`/frame/result`** (итог), `/mdf`, `/pvc`. Дополнительно **`/my-orders`** — **«Мои заказы»**: список заказов клиента из **`/api/facade-orders/`** (номер **`З-000001`**, краткий статус, **`HintButton`** с пояснением, ссылка на PDF); гостю — предложение войти (**`state.from`** → `/my-orders`). Редирект **`/guide`** → **`/`** (зарезервированный URL). Режим **только чтение**: нет кнопок добавления/удаления/редактирования типов профилей и наполнения, типов **петель**, нет добавления материалов в тип наполнения из модалки. Шапка **`PublicShell`**: бренд; полоса вкладок **«Калькулятор»** / **«Мои заказы»** (стили как в админке); «Вход» / «Регистрация»; для вошедшего **сотрудника** — подпись **email или логин** + «Админка»; для **клиента** (без `is_staff`) — подпись + «Выйти» (**`window.location.replace('/')`**). Контент под вкладками в **`public-shell__main`** с **`overflow-y: auto`** (на десктопе `#root` с `overflow: hidden` — иначе длинный шаг 8 обрезался). Регистрация: **`/register`**.

**Админка (после `/login`, только `is_staff` или `is_superuser`):** `/materials`, `/calculator`, `/orders`, **`/users`** — полный калькулятор с префиксом **`/calculator/...`**, счётчиком профилей (`fetchCalculatorProfiles`), всеми админ‑действиями на шагах 2, 4 и в каталоге петель на шаге 5; вкладка **«Пользователи»** — учётные записи и роли для веб-панели заказчика. Шапка **`AdminApp`**: верхняя полоса **`admin-header-top`** (бренд + пользователь + «Выйти»), ниже **`nav.admin-section-tabs`** — пилюли разделов (**`admin-section-tab`**) в том же визуальном стиле, что **`public-shell__section-tabs`**.

Реализовано: дерево **папок** (удаление папки **каскадом**: вложенные папки и материалы), список материалов, карточка с вкладками, сопутствующие/операции, **уникальный непустой артикул**. Калькулятор (рамочный): **шаг 2** — тип профиля и цвет, эскиз с пропорциями как у шага 3 (**`facadeSketchBoxStyle`**, дефолт габаритов **500×200** мм); **шаг 3** — габариты (`/…/frame/size`); **шаг 4** — наполнение (`/…/frame/filling`), типы **`CalculatorFillingType`**, `localStorage` `calc_filling_type_id` / `calc_filling_material_id`; **шаг 5** — присадка и итоговый эскиз (`/…/frame/summary`): выбор «не требуется» / «присадки под петли», источник петель (заказчик / производство), каталог **`CalculatorHingeType`** (как типы наполнения; API **`/api/calculator-hinge-types/`**); при **«не требуется»** шаг **6** пропускается по маршруту (вкладка видна, но неактивна), переход сразу на **шаг 7**; **шаг 6** — расстояния петель (`/…/frame/hinge-layout`): сторона, **до 10** отверстий, ввод **парами** (№1↔№n, №2↔№n−1… от начала/конца кромки по правилам `hingeMeasuresFromEdgeStart`), в **`calc_hinge_layout`** хранятся **абсолютные мм** `positionsMm` от начала выбранной кромки (пересчёт **`hingeUserInputsToAbsoluteMm`** / **`hingeAbsoluteToUserInputStrings`**), дефолты: **`defaultHingeAbsPositionsMm`** — **равномерно** вдоль кромки длины **L**: **n+1** равных промежутков, петля **i** на **(i+1)·L/(n+1)** мм от начала кромки, при **смене стороны** — сброс полей и **`writeHingeLayout(null)`**; валидация **`validateHingePositions`** по длине стороны; эскиз с маркерами и цепочкой выносных размеров (габарит основной линии с **противоположной** стороны от петель, узкие сегменты **`hinge-chain-dim--narrow`**, ориентация подписей цепочек); **шаг 7** — отверстия под ручку (`/…/frame/handle-holes`): число (**0…10**, по умолчанию **0** — ручка не задана, поле можно очистить при вводе), диаметр (справочник **`CalculatorHandleHoleDiameter`**, API **`/api/calculator-handle-hole-diameters/`**; в админ-калькуляторе **`HandleHoleDiameterAdminSelect`** — видимость для клиента, добавление/удаление размера с подтверждением), втулки, ориентация вертикальная/горизонтальная, сторона (**вертикаль** — слева/справа, **горизонталь** — сверху/снизу), межосевые и смещение первого центра; **`calc_handle_holes`**, запрет стороны при совпадении с петлями (**`isHandleSideBlockedByHinges`**), эскиз с маркерами **`sketch-handle-pin`** (при **0** отверстий — только габариты как на шаге 5); **шаг 8 «Итог»** (`/…/frame/result`) — сводка конфигурации, контакты, таблица ориентировочной стоимости (**`Step8FrameResult`**), **PDF** (**`frameClientPdf.ts`**). **Клиент на публичном сайте:** гость при «Отправить менеджеру» видит **модалку** (`admin-modal-backdrop` / `createPortal`) — войти или зарегистрироваться (**`state.from`** на текущий шаг); **клиент (не staff)** отправляет **multipart** на **`POST /api/facade-orders/`** (PDF + **`snapshot`** JSON + контакты), затем **`nav('/my-orders', { replace: true })`**; на публичном калькуляторе (**`readOnly`**) обязательны **имя, телефон, email** (метка * **`step8-form__req`**, `required`, кнопка неактивна пока не заполнено; **`staffOnSession`** снимает обязательность для сотрудника в почтовом сценарии). **Сотрудник** на шаге 8 по-прежнему **mailto**. **Заказы:** модель **`FacadeOrder`** (миграция **`0029_facade_orders`**), вкладка **«Заказы»** — **`AdminOrdersPanel`** (таблица без колонки «Детали», **`FtSelect`** статуса, PDF); статусы: не подтверждён / подтверждён / в процессе сборки / готов к выдаче / завершён. Склейка шагов через `localStorage` + **`calc-frame-session`** (`frameCalcSession.ts`). **Ориентировочная цена** — панель справа (`CalcPriceTotals`), расчёт в **`calculator/framePriceEstimate.ts`**: геометрия по ед. изм. материала (м² / **периметр в м.п.** `2(H+W)` / шт), сопутствующие и операции (в т.ч. флаг `price_per_facade`). Шаг 1: только текст-подсказка; при выборе фасада — **`clearFrameCalculatorStorage()`**. Шаг 3: **`calc_frame_qty`**, гидратация габаритов из `localStorage` (**дефолт 500×200** при пустых ключах после сброса). Удаление материала: **модалка** в `MaterialForm`; каскад калькулятора — миграция **`0020`**. Контекст маршрутов: **`calculator/calcPathsContext.tsx`** (`step()`, `readOnly`, `home`).

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
  - **`frameCalcSession.ts`**: константы **`FRAME_DEFAULT_HEIGHT_MM = 500`**, **`FRAME_DEFAULT_WIDTH_MM = 200`** — если ключей **`calc_frame_height_mm` / `calc_frame_width_mm`** нет (после **`clearFrameCalculatorStorage`** или первый визит).
  - **`Step3FrameSizes`**, **`Step8FrameResult`**, **`CalcPriceTotals`**: те же значения как fallback при парсинге сессии.
  - **`sketchFrame.ts`**: **`facadeSketchBoxStyle(H, W)`** — общая формула **`aspectRatio`** и **`--sketch-scale-y`** (как раньше только на шаге 3).
  - **`Step3FrameSizes`**: эскиз использует **`facadeSketchBoxStyle`**.
  - **`Step2FrameFacade`**: эскиз **`.sketch`** получает те же пропорции; габариты из **`readFrameDimsMm()`** + подписка **`useSyncExternalStore(subscribeFrameCalcSession, …)`**; снимок — **строка** `"h|w"` (не объект), иначе React считает снимок всегда изменившимся и уходит в **бесконечный ререндер** (пустая страница на `/frame`).

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

- **`FacadeOrder.Status`:** добавлено **`completed`** / подпись **«Завершён»**; **`FacadeOrderStatus`** и опции **`FtSelect`** в **`AdminOrdersPanel`**, подписи и **`HintButton`** в **`ClientMyOrdersPage`** (**`PublicClientPages.tsx`**).
- **`AdminOrdersPanel`:** убрана колонка **«Детали»** с раскрывающимся просмотром **`snapshot`**; удалены стили **`admin-orders-details-*`** / **`admin-orders-snapshot`** из **`AdminApp.css`**.

**Бэкенд:** для **`MaterialViewSet`**, **`CalculatorProfileTypeViewSet`**, **`CalculatorFillingTypeViewSet`**, **`CalculatorHingeTypeViewSet`**, **`CalculatorHandleHoleDiameterViewSet`** — класс **`AllowAnyReadAuthenticatedModelPermsWrite`** (GET без JWT; POST/PATCH/DELETE — только авторизованные пользователи с правами Django). **`CalculatorProfileViewSet`** — по‑прежнему только с JWT (`AuthReadModelPermsWrite`).

**Расчёт цены:** сопутствующие считаются **поштучно** по **`quantity_scale`** (`follow_parent` / `per_facade` / `use_related_uom`); операции — с опциональным **`price_per_facade`** (× число фасадов). Наполнение: основной материал и его сопутствующие по той же логике; стекло — ед. изм. м² у материала заполнения.

Подробная архитектура и таблицы API: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Бэкенд (`backend/`, приложение `materials`)

| Область | Состояние |
|---------|-----------|
| **Проект Django** | `config/` (urls, settings, wsgi/asgi), SQLite `db.sqlite3` по умолчанию. |
| **API** | DRF `DefaultRouter`: `material-classes`, `uom`, `categories`, `materials`, `calculator-profiles`, `calculator-profile-types`, `calculator-filling-types`, **`calculator-hinge-types`**, **`calculator-handle-hole-diameters`**, **`facade-orders`**. |
| **Аутентификация** | `djangorestframework-simplejwt`: `POST /api/auth/token/`, `POST /api/auth/token/refresh/`, `GET /api/auth/me/` (в т.ч. **`id`**, **`is_staff`**, **`is_superuser`**). Публично: **`POST /api/auth/register/`** — только обычный пользователь (**`is_staff=False`**; попытка передать привилегии в JSON → 400; см. `RegisterView` в `user_admin_views.py`). Для сотрудников SPA: **`GET/PATCH/DELETE /api/auth/admin-users/`** и **`/api/auth/admin-users/<id>/`** (список, **`is_staff`**, удаление). |
| **Права** | По умолчанию справочники — **JWT + DjangoModelPermissions**. **Исключение для публичного калькулятора:** `GET/HEAD/OPTIONS` на **`/api/materials/`**, **`/api/calculator-profile-types/`**, **`/api/calculator-filling-types/`**, **`/api/calculator-hinge-types/`**, **`/api/calculator-handle-hole-diameters/`** — **без** JWT (`AllowAnyReadAuthenticatedModelPermsWrite`; для диаметров в list только строки с **`client_visible=true`**). Запись на эти ресурсы — только авторизованным с model permissions. **`/api/calculator-profiles/`** — только с JWT. **`/api/facade-orders/`** — **JWT**: list/retrieve/create — **`IsAuthenticated`** (клиент видит только свои заказы); **PATCH** статуса — **`IsAdminUser`**. Группа **«Редактор материалов»** (`is_staff=False`). |
| **Пагинация** | `PageNumberPagination`, `PAGE_SIZE=100` (`config/settings.py`). |
| **Категории (папки)** | `GET /api/categories/?tree=1` — дерево; `POST` — создать; `PATCH/PUT/DELETE` — по `/api/categories/{id}/`. **DELETE** — **каскад**: удаляются все материалы в выбранной папке и подпапках, затем поддерево категорий (в транзакции, см. `MaterialCategoryViewSet.destroy`). |
| **Материалы** | `GET` (в т.ч. **без JWT** для каталога в калькуляторе) / `POST/PUT/PATCH/DELETE` (только с JWT и правами) на `/api/materials/`, `?category=`, `?search=`. |
| **Миграции** | В т.ч. `0010`–`0017` (сопутствующие, артикул, текстуры, профили и типы профилей); **`0018`** — min/max размеры материала; **`0019_calculator_filling_types`** — типы наполнения и связь с материалами (шаг 4); **`0020_calculator_material_fk_cascade`** — при удалении материала каскадно убираются строки калькулятора: цвет в профиле (`CalculatorProfileColor`), цвет в типе профиля (`CalculatorProfileTypeColor`), материал в типе наполнения (`CalculatorFillingTypeMaterial`); **`0021_related_quantity_scale_op_per_facade`** — у сопутствующих **`quantity_scale`** (масштаб в калькуляторе), у операций **`price_per_facade`**; **`0026_calculator_hinge_types`** — типы петель и материалы в типе (шаг 5); **`0027_calculator_handle_hole_diameters`** — диаметры отверстий под ручку (шаг 7); **`0028_editor_perms_handle_hole_diameter`** — обновление прав группы «Редактор материалов» для новой модели; **`0029_facade_orders`** — заказы калькулятора (**`FacadeOrder`**). |

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
- `CalculatorFillingType` — тип наполнения (имя, картинка, порядок); **`CalculatorFillingTypeMaterial`** — материалы внутри типа (M2M через промежуточную таблицу).
- **`CalculatorHingeType`** — тип петель для калькулятора (шаг 5, петли производства); **`CalculatorHingeTypeMaterial`** — материалы (конкретные петли) внутри типа.
- **`CalculatorHandleHoleDiameter`** — справочник диаметров отверстий под ручку (шаг 7): **`diameter_mm`** (уникально), **`client_visible`**, **`sort_order`**.
- **`FacadeOrder`** — заказ из шага 8 публичного калькулятора: **`user`**, **`status`**, контакты, **`snapshot`**, **`pdf_file`**, **`created_at` / `updated_at`**.

### Сериализация материала

- `related_items` / `operation_lines` — чтение и полная замена при записи, если ключ в теле.
- Валидация дубликата артикула в сериализаторе; при гонке — `IntegrityError` → 400 с полем `article`.
- **Multipart для загрузки текстуры:** при `texture_image` запрос уходит как `multipart/form-data`, и списки (`material_class_ids`, `alt_prices`, `related_items`, `operation_lines`) могут приходить JSON‑строкой. Сериализатор поддерживает JSON‑строки.
- **Multipart edge-case:** некоторые клиенты/сервер могут дать `["[]"]` вместо `"[]"` — обработано в сериализаторе.

### Django admin

URL: `/admin/django/`. Сущности `Material*`, `MaterialCategory`, `MaterialClass`, `UoM`, альт. цены, сопутствующие, операции, **`FacadeOrder`**.

### Management

- `create_materials_editor` — пользователь веб-админки без staff: [README.md](../README.md).

---

## Смысл отдельных полей (коротко)

| Поле / элемент UI | Смысл |
|-------------------|--------|
| **Артикул** | Код/номер для сопоставления с учётом, справочниками, 1С. Непустой артикул **не дублируется**; после ввода обрезка **пробелов** (`strip`). |
| **Активен** (`is_active`) | «Мягкое» отключение карточки без удаления: задел для скрытия в калькуляторе, отчётах, фильтрах. Сохраняется в БД; **фильтрация списка в веб-админке по флагу может быть ещё не сделана** — при необходимости доработать. |
| **Коэф** (колонка списка) | Зарезервировано под будущий коэффициент, пока `—`. |
| **Вкладки карточки** | **«Общие параметры»**, **«Доп. параметры»**, **«Параметры текстуры»** — реализованы; план продукта: [PLAN.md](PLAN.md). |
| **Сопутствующие / Операции** | К расчёту будущей цены; панель внизу **средней** колонки, предпросчёт в UI. |

---

## Фронтенд (`frontend/`, Vite 6 + React 19 + TS)

| Файл / папка | Назначение |
|--------------|------------|
| `AdminApp.tsx` | Шапка: **`admin-header-top`**, **`admin-section-tabs`** / **`admin-section-tab`**. Дерево `TreeRow`, папки (шестерёнка, модалки, каскад **DELETE**); `MaterialForm`; портал **`MaterialExtrasPanel`**. Вкладка **«Заказы»** рендерит **`AdminOrdersPanel`**. |
| `AdminOrdersPanel.tsx` | Список **`/api/facade-orders/`**, смена статуса (**в т.ч. «Завершён»**), PDF. |
| `MaterialExtrasPanel.tsx` + **`MaterialExtrasPanel.css`** | Сопутствующие, операции, предпросчёт; легенда операций (**«Описание»**); сетка строк операций (колонки, одна строка легенды). |
| `App.tsx` | Маршруты: **`/login`** (**`LoginRoute`** + **`safePostLoginTarget`** для **`state.from`**); защищённые **`/materials/*`**, **`/calculator/*`**, **`/orders/*`**, **`/users/*`**; **`/`** — **`PublicShell`** с **`Outlet`**: индекс + **`my-orders`** + **`guide`** → **`/`** + **`*`** → калькулятор. **`refreshAuth`**, **`AdminRoute`**. |
| `App.css` | **`public-shell*`**, **`public-shell__main`** (скролл контента при `overflow:hidden` у `#root` на десктопе), **`public-shell__section-tabs`**, **`public-shell__user`**, **`public-shell__logout`**. |
| `PublicClientPages.tsx` + **`PublicClientPages.css`** | **`ClientMyOrdersPage`** (список заказов, **`HintButton`** у статуса), **`isPublicCalculatorRoute`**, **`PublicShellOutletContext`**. |
| `CalculatorPage.tsx` | Проп **`variant`**: **`admin`** — префикс `/calculator`, полный UI; **`public`** — URL с корня (`/`, `/frame/...`), заголовок «Подбор фасада», без запроса профилей. Обёртка **`CalcPathsProvider`**. Шаги 1–8 для рамочного фасада; `NavLink` шага 1 с **`end`**. Шаг **6**: вкладка всегда в разметке; **`canOpenFrameStep6`** = шаг 4 готов и **`isFrameMortiseHingeSelected()`**. На шаге 8 класс **`calc-routes-wrap--step8`**. |
| `calculator/calcPathsContext.tsx` | `step(rel)`, `home`, `readOnly`, `normalizedCalcPath`, `facadeFromNormalized`. |
| `calculator/Step4FrameFilling.tsx` | Шаг 4 (рамочный): типы наполнения, модалка материалов; в **`readOnly`** скрыты CRUD и блок «Добавить материалы». |
| `CalculatorPage.css` | **`.calc-side-panel`** — единая высота левой панели (шаги 1–3, `frame2-card`, `frame3-left`, заглушки МДФ/ПВХ), `overflow-y: auto`. **`#calc-step-panel-1 .calc-card`** — `max-width` 640px / 700px (≥1280px), как первая колонка сетки рамочного шага. |
| `calculator/Step2FrameFacade.tsx` | Шаг 2 (рамочный): плитки типов профилей, выбор цвета в модалке, эскиз. Пропорции эскиза — **`facadeSketchBoxStyle`** по **`readFrameDimsMm()`** и дефолтам **`FRAME_DEFAULT_*`**; подписка **`useSyncExternalStore`**, снимок **`"${h}|${w}"`**. `localStorage` + **`notifyFrameCalcSession`**; навигация через **`useCalcPaths()`**. В **`readOnly`** скрыты создание/редактирование/удаление типов и шестерёнки. **`calc-side-panel`** на `frame2-card`. |
| `calculator/Step2MdfFacade.tsx` / `Step2PvcFacade.tsx` | Заглушки; контент в **`calc-side-panel`**. |
| `calculator/Step3FrameSizes.tsx` | Шаг 3: габариты и кол-во (**дефолт 500×200 мм** при пустом `localStorage`); min/max из материала цвета; редирект на **`step('frame')`**, если сессия шага 2 не готова. Чертёж **`frame3-dim-drawing`**; эскиз — **`facadeSketchBoxStyle`**. |
| `calculator/Step3FrameSizes.css` | Сетка `frame3` как у `frame2`; **`frame3-right.frame2-sketch`**: `overflow: visible`; стили чертёжных размеров; **`z-index`** у размеров выше эскиза; модификаторы **`frame3-dim-drawing--right` / `--bottom`**, цепочки **`.hinge-chain-dim`** (в т.ч. **`--narrow`**), слой **`frame3-hinge-dim-layer`**. |
| `calculator/Step5FrameSummary.tsx` | Шаг 5: эскиз, **`FrameHingeMortisePanel`**; «Следующий шаг» на шаг **6** или **7** в зависимости от присадки под петли. |
| `calculator/Step6FrameHingeLayout.tsx` | Шаг 6: сторона, count 1…10, ввод расстояний парами, дефолты равномерно по длине кромки, сброс при смене стороны; превью с **`frame3-drawing-core`** и цепочками петель; редирект на шаг 7, если **`!isFrameMortiseHingeSelected()`**. |
| `calculator/Step7FrameHandleHoles.tsx` | Шаг 7: количество **`countStr`** (0…10, default 0, blur восстанавливает 0), **`calc_handle_holes`**, запрет стороны с петлями; эскиз петель + ручки; при **0** отверстий — эскиз габаритов как шаг 5; гидрация **`useLayoutEffect`**; в админке при полном каталоге — **`HandleHoleDiameterAdminSelect`**. |
| `calculator/HandleHoleDiameterAdminSelect.tsx` | Админ: выпадающий список диаметров с видимостью для клиента, добавлением и удалением строк (API). |
| `calculator/Step8FrameResult.tsx` | Шаг 8 «Итог»: сводка, контакты, таблица цены; клиент — **`createFacadeOrder`**, модалка входа для гостя, обязательные контакты при **`readOnly`**, редирект на **`/my-orders`**; staff — **mailto**; **«Открыть PDF…»** — **`buildFrameClientPdfBlob`**; **`preloadFramePdfFont`**. |
| `calculator/Step8FrameResult.css` | Вёрстка шага «Итог» (**`step8-result__scroll-pack`** и др.), стили печати (`@media print`). |
| `calculator/frameClientPdf.ts` | PDF (**jspdf**, **jspdf-autotable**): сводка + листы фасадов; строка «Раскладка петель» на первой странице только при **`includeHingeLayoutRow`**; Noto Sans (**`public/fonts/`** + CDN), регистрация шрифта на каждый **`jsPDF`**. |
| `calculator/sketchFrame.ts` | `resolveMediaUrl`, **`facadeSketchBoxStyle`** (пропорции и **`--sketch-scale-y`** для `.sketch`), **`materialTextureLayerStyle`** / `sketchFrameInlineStyle`. |
| `calculator/frameCalcSession.ts` | **`FRAME_DEFAULT_HEIGHT_MM`**, **`FRAME_DEFAULT_WIDTH_MM`** (500 / 200); `isFrameStep2Ready`, **`isFrameStep4Ready`**, **`isFrameMortiseHingeSelected`**, `FRAME_CALC_SESSION_EVENT`, `subscribeFrameCalcSession`, `notifyFrameCalcSession`, **`clearFrameCalculatorStorage`**, **`readCalculatorPriceConfigKey`**; присадка/петли: **`CALC_LS_*`**, типы **`HingeMountSide`**, **`HingeLayoutPersisted`**; шаг 6: **`hingeEdgeLengthMm`**, **`hingePairPartnerIndex`**, **`hingeMeasuresFromEdgeStart`**, **`defaultHingeAbsPositionsMm`**, **`hingeUserInputsToAbsoluteMm`**, **`hingeAbsoluteToUserInputStrings`**, **`readFrameDimsMm`**, **`readHingeLayout`**, **`writeHingeLayout`**, **`validateHingePositions`**; шаг 7: **`CALC_LS_HANDLE_HOLES`**, **`HandleHolesPersisted`**, **`isHandleSideBlockedByHinges`**, **`readHandleHoles`**, **`writeHandleHoles`**, **`handleHoleCentersMm`**, **`validateHandleHoles`**. |
| `calculator/framePriceEstimate.ts` | Разбор ед. изм., **`relatedItemsCalculatorCost`** (масштаб строк), **`operationLinesCost(..., facadeCount)`**, `computeFramePriceBreakdown` (профиль, наполнение). |
| `calculator/CalcPriceTotals.tsx` | Панель «Расчёт / Итого»; шаг 1 без сумм; `useSyncExternalStore` + `fetchMaterial` по id из `localStorage`; fallback габаритов — **`FRAME_DEFAULT_*`**. |
| `api.ts` | `apiFetch` + методы калькулятора и **`facade-orders`** (`createFacadeOrder`, `fetchFacadeOrders`, `patchFacadeOrderStatus`). Для гостя GET уходит **без** Bearer (если нет токена) — см. права бэкенда. |
| `index.css` / `App.css` / `AdminApp.css` | На десктопе **`html`/`body`/`#root`**: **`max-height: 100dvh`**, **`overflow: hidden`** — скролл **внутри** колонок админки или в **`public-shell__main`** на публичном сайте. Для **`#admin-panel-calculator`** — цепочка flex и шаг 8. |

### Поведение UI

- **Папки:** клик по **названию** — выбор; **▸/▾** — свернуть/развернуть вложенные; **⚙** (по наведению на строку) — меню; переименование — **inline-поле**; удаление — **модалка** (предупреждение о **каскадном** удалении вложенных папок и материалов) + **DELETE** API.
- **Список материалов:** легенда колонок, колонка «Коэф» — плейсхолдер.
- **Карточка:** вкладки **«Общие параметры»**, **«Доп. параметры»**, **«Параметры текстуры»**.
- **Сопутствующие/операции** — под списком папок (портал), только при открытой карточке (редактирование).
- **Калькулятор:** `localStorage`: `calc_frame_type_id`, `calc_frame_color_id`; **`calc_frame_height_mm`**, **`calc_frame_width_mm`** (после сброса подставляются **500×200** по **`FRAME_DEFAULT_*`**), **`calc_frame_qty`** (шаг 3); **`calc_filling_type_id`**, **`calc_filling_material_id`** (шаг 4); **`calc_frame_mortise`**, **`calc_hinge_source`**, **`calc_hinge_type_id`**, **`calc_hinge_material_id`** (шаг 5, присадка/петли); **`calc_hinge_layout`** (шаг 6); **`calc_handle_holes`** (шаг 7). Сброс при новом выборе фасада на шаге 1. **`frame2-sketch`:** без внешней рамки; пропорции `.sketch` на шаге 2 синхронизированы с габаритами (см. **`facadeSketchBoxStyle`**); стили в **`Step2FrameFacade.css`** (шаги 3–7 подключают при необходимости).

---

## Операция и типовые сбои

- **500 на `/api/materials/`**, во фронте «HTML вместо JSON» — чаще всего **схема БД не совпадает с кодом**: выполнить `py backend\manage.py migrate` (в т.ч. **`0021`** — `quantity_scale`, `price_per_facade`), остановить все старые `runserver`, поднять заново. Для очень старых баз также нужны `0010`–`0011`.
- **404 на `/api/calculator-profiles/`** — обычно запущен **старый/другой** `runserver` или конфликтует несколько процессов. Решение: оставить **один** backend на `:8000`, применить миграции и перезапустить.
- **401 на `/api/*`** — для **категорий, профилей калькулятора (`calculator-profiles`), auth/me** и т.п. без JWT — ожидаемо; войти через **`/login`**. Для **`GET /api/materials/`**, **`GET /api/calculator-profile-types/`**, **`GET /api/calculator-filling-types/`**, **`GET /api/calculator-hinge-types/`** при актуальном бэкенде **401 быть не должно** (анонимное чтение). Если 401 — проверить, что поднят актуальный `views.py` и нет лишнего `IsAuthenticated` на list/retrieve.
- **CORS (dev):** `http://127.0.0.1:5173` / `localhost:5173` в `backend/.env`.
- **Текстуры (dev):** раздача файлов включена только в `DEBUG=1` через `/media/`. Для работы загрузки нужен `Pillow`.
- **Длинные имена файлов текстур:** у `ImageField` увеличен `max_length` (миграция `0014`), иначе возможен 400 при загрузке.
- **Удаление текстуры:** кнопка «Убрать текстуру» очищает поле и сохраняет удаление через `PATCH texture_image=null`.
- **Миграция `0021`:** после обновления кода выполнить `py backend\manage.py migrate` (поля сопутствующих/операций).

### Ручная проверка расчёта (после `0021`)

1. Материал цвета профиля с ед. изм. м.п., сопутствующее **«Как у основного»** — сумма сопутствующих растёт с периметром и с \(N\) фасадов.
2. То же + строка **«На фасад»** — эта строка не растёт с периметром, только с \(N\).
3. Наполнение м² + шаг 3 — цена наполнения меняется с площадью; сопутствующие наполнения с **«По ед. изм. строки»** — по правилам ед. изм. сопутствующего.
4. Операция с **«× фасад»** — при \(N=2\) цена строки удваивается; без флага — не зависит от \(N\).

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
- [x] Папки: переименование, удаление (**каскад** материалов и подпапок); UI шестерёнка + модалка.
- [x] Уникальность непустого артикула; миграция `0011`.
- [x] База KZT, альт. валюты, сопутствующие/операции, миграция `0010`, вкладка «Общие параметры».
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
- [ ] Клиентский калькулятор: доработка до уровня реф. Modusline (ценники, корзина, оформление).
- [ ] 1С: sync; `article` + `external_id` как якоря.

## Как продолжить (агент / разработчик)

1. `py scripts/furnitech_status.py` (из корня).
2. [ARCHITECTURE.md](ARCHITECTURE.md), [PLAN.md](PLAN.md).
3. В конце сессии — обновить **этот файл** (дата, факты).
