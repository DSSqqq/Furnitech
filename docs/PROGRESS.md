# Furnitech — прогресс (обновляйте в конце сессии)

**Последнее обновление:** 2026-05-03

## Краткая сводка

Проект: **Django + DRF (JWT)** + **Vite + React 19 (TS)** — веб‑админка справочника материалов + **калькулятор** (админский и **публичный**).

**Публичная часть (без входа):** маршрут **`/`** — тот же сценарий шагов, что и в админке, но URL **без** префикса `/calculator`: `/` (шаг 1), `/frame`, `/frame/size`, `/frame/filling`, `/frame/summary`, `/frame/hinge-layout`, `/frame/handle-holes`, **`/frame/result`** (итог), `/mdf`, `/pvc`. Режим **только чтение**: нет кнопок добавления/удаления/редактирования типов профилей и наполнения, типов **петель**, нет добавления материалов в тип наполнения из модалки. Шапка **`PublicShell`**: бренд, ссылка «Вход для сотрудников» или «Админка» (если сессия уже есть).

**Админка (после `/login`):** `/materials`, `/calculator`, `/orders` — полный калькулятор с префиксом **`/calculator/...`**, счётчиком профилей (`fetchCalculatorProfiles`), всеми админ‑действиями на шагах 2, 4 и в каталоге петель на шаге 5.

Реализовано: дерево **папок**, список материалов, карточка с вкладками, сопутствующие/операции, **уникальный непустой артикул**. Калькулятор (рамочный): **шаг 2** — тип профиля и цвет; **шаг 3** — габариты (`/…/frame/size`); **шаг 4** — наполнение (`/…/frame/filling`), типы **`CalculatorFillingType`**, `localStorage` `calc_filling_type_id` / `calc_filling_material_id`; **шаг 5** — присадка и итоговый эскиз (`/…/frame/summary`): выбор «не требуется» / «присадки под петли», источник петель (заказчик / производство), каталог **`CalculatorHingeType`** (как типы наполнения; API **`/api/calculator-hinge-types/`**); **шаг 6** — расстояния петель (`/…/frame/hinge-layout`): сторона, **до 10** отверстий, ввод **парами** (№1↔№n, №2↔№n−1… от начала/конца кромки по правилам `hingeMeasuresFromEdgeStart`), в **`calc_hinge_layout`** хранятся **абсолютные мм** `positionsMm` от начала выбранной кромки (пересчёт **`hingeUserInputsToAbsoluteMm`** / **`hingeAbsoluteToUserInputStrings`**), дефолты: **`defaultHingeAbsPositionsMm`** — **равномерно** вдоль кромки длины **L**: **n+1** равных промежутков, петля **i** на **(i+1)·L/(n+1)** мм от начала кромки, при **смене стороны** — сброс полей и **`writeHingeLayout(null)`**; валидация **`validateHingePositions`** по длине стороны; эскиз с маркерами и цепочкой выносных размеров (габарит основной линии с **противоположной** стороны от петель, узкие сегменты **`hinge-chain-dim--narrow`**, ориентация подписей цепочек); **шаг 7** — отверстия под ручку (`/…/frame/handle-holes`): число, диаметр (справочник **`CalculatorHandleHoleDiameter`**, API **`/api/calculator-handle-hole-diameters/`**; в админ-калькуляторе **`HandleHoleDiameterAdminSelect`** — видимость для клиента, добавление/удаление размера с подтверждением), втулки, ориентация вертикальная/горизонтальная, сторона (**вертикаль** — слева/справа, **горизонталь** — сверху/снизу), межосевые и смещение первого центра; **`calc_handle_holes`**, запрет стороны при совпадении с петлями (**`isHandleSideBlockedByHinges`**), эскиз с маркерами **`sketch-handle-pin`**; **шаг 8 «Итог»** (`/…/frame/result`) — сводка конфигурации, контакты, таблица ориентировочной стоимости (**`Step8FrameResult`**), выгрузка **PDF** для клиента (**`frameClientPdf.ts`**). Склейка шагов через `localStorage` + **`calc-frame-session`** (`frameCalcSession.ts`). **Ориентировочная цена** — панель справа (`CalcPriceTotals`), расчёт в **`calculator/framePriceEstimate.ts`**: геометрия по ед. изм. материала (м² / **периметр в м.п.** `2(H+W)` / шт), сопутствующие и операции (в т.ч. флаг `price_per_facade`). Шаг 1: только текст-подсказка; при выборе фасада — **`clearFrameCalculatorStorage()`**. Шаг 3: **`calc_frame_qty`**, гидратация габаритов из `localStorage` при открытии. Удаление материала: **модалка** в `MaterialForm`; каскад калькулятора — миграция **`0020`**. Контекст маршрутов: **`calculator/calcPathsContext.tsx`** (`step()`, `readOnly`, `home`).

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

**Бэкенд:** для **`MaterialViewSet`**, **`CalculatorProfileTypeViewSet`**, **`CalculatorFillingTypeViewSet`**, **`CalculatorHingeTypeViewSet`**, **`CalculatorHandleHoleDiameterViewSet`** — класс **`AllowAnyReadAuthenticatedModelPermsWrite`** (GET без JWT; POST/PATCH/DELETE — только авторизованные пользователи с правами Django). **`CalculatorProfileViewSet`** — по‑прежнему только с JWT (`AuthReadModelPermsWrite`).

**Расчёт цены:** сопутствующие считаются **поштучно** по **`quantity_scale`** (`follow_parent` / `per_facade` / `use_related_uom`); операции — с опциональным **`price_per_facade`** (× число фасадов). Наполнение: основной материал и его сопутствующие по той же логике; стекло — ед. изм. м² у материала заполнения.

Подробная архитектура и таблицы API: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Бэкенд (`backend/`, приложение `materials`)

| Область | Состояние |
|---------|-----------|
| **Проект Django** | `config/` (urls, settings, wsgi/asgi), SQLite `db.sqlite3` по умолчанию. |
| **API** | DRF `DefaultRouter`: `material-classes`, `uom`, `categories`, `materials`, `calculator-profiles`, `calculator-profile-types`, `calculator-filling-types`, **`calculator-hinge-types`**, **`calculator-handle-hole-diameters`**. |
| **Аутентификация** | `djangorestframework-simplejwt`: `POST /api/auth/token/`, `POST /api/auth/token/refresh/`, `GET /api/auth/me/`. |
| **Права** | По умолчанию справочники — **JWT + DjangoModelPermissions**. **Исключение для публичного калькулятора:** `GET/HEAD/OPTIONS` на **`/api/materials/`**, **`/api/calculator-profile-types/`**, **`/api/calculator-filling-types/`**, **`/api/calculator-hinge-types/`**, **`/api/calculator-handle-hole-diameters/`** — **без** JWT (`AllowAnyReadAuthenticatedModelPermsWrite`; для диаметров в list только строки с **`client_visible=true`**). Запись на эти ресурсы — только авторизованным с model permissions. **`/api/calculator-profiles/`** — только с JWT. Группа **«Редактор материалов»** (`is_staff=False`). |
| **Пагинация** | `PageNumberPagination`, `PAGE_SIZE=100` (`config/settings.py`). |
| **Категории (папки)** | `GET /api/categories/?tree=1` — дерево; `POST` — создать; `PATCH/PUT/DELETE` — по `/api/categories/{id}/`. **Удаление** запрещено с ответом `400`, если есть **вложенные папки** или **материалы** в папке (`MaterialCategoryViewSet.destroy`). |
| **Материалы** | `GET` (в т.ч. **без JWT** для каталога в калькуляторе) / `POST/PUT/PATCH/DELETE` (только с JWT и правами) на `/api/materials/`, `?category=`, `?search=`. |
| **Миграции** | В т.ч. `0010`–`0017` (сопутствующие, артикул, текстуры, профили и типы профилей); **`0018`** — min/max размеры материала; **`0019_calculator_filling_types`** — типы наполнения и связь с материалами (шаг 4); **`0020_calculator_material_fk_cascade`** — при удалении материала каскадно убираются строки калькулятора: цвет в профиле (`CalculatorProfileColor`), цвет в типе профиля (`CalculatorProfileTypeColor`), материал в типе наполнения (`CalculatorFillingTypeMaterial`); **`0021_related_quantity_scale_op_per_facade`** — у сопутствующих **`quantity_scale`** (масштаб в калькуляторе), у операций **`price_per_facade`**; **`0026_calculator_hinge_types`** — типы петель и материалы в типе (шаг 5); **`0027_calculator_handle_hole_diameters`** — диаметры отверстий под ручку (шаг 7); **`0028_editor_perms_handle_hole_diameter`** — обновление прав группы «Редактор материалов» для новой модели. |

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
| **Вкладки карточки** | **«Общие параметры»**, **«Доп. параметры»**, **«Параметры текстуры»** — реализованы; план продукта: [PLAN.md](PLAN.md). |
| **Сопутствующие / Операции** | К расчёту будущей цены; панель внизу **средней** колонки, предпросчёт в UI. |

---

## Фронтенд (`frontend/`, Vite 6 + React 19 + TS)

| Файл / папка | Назначение |
|--------------|------------|
| `AdminApp.tsx` | Дерево `TreeRow`, папки: **шестерёнка** → меню «Переименовать» / **«Удалить…»**; удаление папки — **модальное окно** (`createPortal` в `document.body`, не `window.confirm`). `MaterialForm`: удаление материала — **модалка** с предупреждением (не `window.confirm`). Портал `MaterialExtrasPanel`. |
| `MaterialExtrasPanel.tsx` | Сопутствующие, операции, предпросчёт. |
| `App.tsx` | Маршруты: **`/login`**; защищённые **`/materials/*`**, **`/calculator/*`**, **`/orders/*`** (редирект на логин с `state.from`); **`/*`** — публичный **`PublicShell`** + **`CalculatorPage variant="public"`**. Состояние сессии: `guest` / `authed` / `loading`; `refreshAuth` после входа. |
| `App.css` | Классы **`public-shell*`** — шапка гостевой страницы. |
| `CalculatorPage.tsx` | Проп **`variant`**: **`admin`** — префикс `/calculator`, полный UI; **`public`** — URL с корня (`/`, `/frame/...`), заголовок «Подбор фасада», без запроса профилей. Обёртка **`CalcPathsProvider`**. Шаги 1–8 для рамочного фасада; `NavLink` шага 1 с **`end`**. На шаге 8 класс **`calc-routes-wrap--step8`**. |
| `calculator/calcPathsContext.tsx` | `step(rel)`, `home`, `readOnly`, `normalizedCalcPath`, `facadeFromNormalized`. |
| `calculator/Step4FrameFilling.tsx` | Шаг 4 (рамочный): типы наполнения, модалка материалов; в **`readOnly`** скрыты CRUD и блок «Добавить материалы». |
| `CalculatorPage.css` | **`.calc-side-panel`** — единая высота левой панели (шаги 1–3, `frame2-card`, `frame3-left`, заглушки МДФ/ПВХ), `overflow-y: auto`. **`#calc-step-panel-1 .calc-card`** — `max-width` 640px / 700px (≥1280px), как первая колонка сетки рамочного шага. |
| `calculator/Step2FrameFacade.tsx` | Шаг 2 (рамочный): плитки типов профилей, выбор цвета в модалке, эскиз. `localStorage` + **`notifyFrameCalcSession`**; навигация через **`useCalcPaths()`**. В **`readOnly`** скрыты создание/редактирование/удаление типов и шестерёнки. **`calc-side-panel`** на `frame2-card`. |
| `calculator/Step2MdfFacade.tsx` / `Step2PvcFacade.tsx` | Заглушки; контент в **`calc-side-panel`**. |
| `calculator/Step3FrameSizes.tsx` | Шаг 3: габариты и кол-во; min/max из материала цвета; редирект на **`step('frame')`**, если сессия шага 2 не готова. Чертёж **`frame3-dim-drawing`**. |
| `calculator/Step3FrameSizes.css` | Сетка `frame3` как у `frame2`; **`frame3-right.frame2-sketch`**: `overflow: visible`; стили чертёжных размеров; **`z-index`** у размеров выше эскиза; модификаторы **`frame3-dim-drawing--right` / `--bottom`**, цепочки **`.hinge-chain-dim`** (в т.ч. **`--narrow`**), слой **`frame3-hinge-dim-layer`**. |
| `calculator/Step6FrameHingeLayout.tsx` | Шаг 6: сторона, count 1…10, ввод расстояний парами, дефолты равномерно по длине кромки, сброс при смене стороны; превью с **`frame3-drawing-core`** и цепочками петель. |
| `calculator/Step7FrameHandleHoles.tsx` | Шаг 7: отверстия под ручку, **`calc_handle_holes`**, запрет стороны с петлями; эскиз петель + ручки; в админке при полном каталоге — **`HandleHoleDiameterAdminSelect`**. |
| `calculator/HandleHoleDiameterAdminSelect.tsx` | Админ: выпадающий список диаметров с видимостью для клиента, добавлением и удалением строк (API). |
| `calculator/Step8FrameResult.tsx` | Шаг 8 «Итог»: сводка, контакты, таблица цены; **«Открыть PDF…»** — **`buildFrameClientPdfBlob`**, вкладка **`about:blank`** + **`blob:`**; **`preloadFramePdfFont`**. |
| `calculator/Step8FrameResult.css` | Вёрстка шага «Итог» (**`step8-result__scroll-pack`** и др.), стили печати (`@media print`). |
| `calculator/frameClientPdf.ts` | PDF (**jspdf**, **jspdf-autotable**): сводка + листы фасадов; Noto Sans (**`public/fonts/`** + CDN), регистрация шрифта на каждый **`jsPDF`**. |
| `calculator/sketchFrame.ts` | `resolveMediaUrl`, `sketchFrameInlineStyle` для периметра `.sketch-frame`. |
| `calculator/frameCalcSession.ts` | `isFrameStep2Ready`, **`isFrameStep4Ready`**, `FRAME_CALC_SESSION_EVENT`, `subscribeFrameCalcSession`, `notifyFrameCalcSession`, **`clearFrameCalculatorStorage`**, **`readCalculatorPriceConfigKey`**; присадка/петли: **`CALC_LS_*`**, типы **`HingeMountSide`**, **`HingeLayoutPersisted`**; шаг 6: **`hingeEdgeLengthMm`**, **`hingePairPartnerIndex`**, **`hingeMeasuresFromEdgeStart`**, **`defaultHingeAbsPositionsMm`**, **`hingeUserInputsToAbsoluteMm`**, **`hingeAbsoluteToUserInputStrings`**, **`readFrameDimsMm`**, **`readHingeLayout`**, **`writeHingeLayout`**, **`validateHingePositions`**; шаг 7: **`CALC_LS_HANDLE_HOLES`**, **`HandleHolesPersisted`**, **`isHandleSideBlockedByHinges`**, **`readHandleHoles`**, **`writeHandleHoles`**, **`handleHoleCentersMm`**, **`validateHandleHoles`**. |
| `calculator/framePriceEstimate.ts` | Разбор ед. изм., **`relatedItemsCalculatorCost`** (масштаб строк), **`operationLinesCost(..., facadeCount)`**, `computeFramePriceBreakdown` (профиль, наполнение). |
| `calculator/CalcPriceTotals.tsx` | Панель «Расчёт / Итого»; шаг 1 без сумм; `useSyncExternalStore` + `fetchMaterial` по id из `localStorage`. |
| `api.ts` | `apiFetch` + методы калькулятора (`calculator-profiles`, `calculator-profile-types`, `calculator-filling-types`, **`calculator-hinge-types`**, **`calculator-handle-hole-diameters`** CRUD helper’ы, материалы). Для гостя GET уходит **без** Bearer (если нет токена) — см. права бэкенда. |
| `index.css` / `App.css` / `AdminApp.css` | Без **прокрутки `document`** на десктопе: окно сетки 3 колонок укладывается в `100dvh`, скролл **внутри** колонок; панель сопутствующих **привязана** к низу центральной колонки. Для **`#admin-panel-calculator`** — дополнительные правила высоты/прокрутки вкладки калькулятора и шага 8. |

### Поведение UI

- **Папки:** клик по **названию** — выбор; **▸/▾** — свернуть/развернуть вложенные; **⚙** (по наведению на строку) — меню; переименование — **inline-поле**; удаление — **модалка** + API; пустая папка без детей и материалов.
- **Список материалов:** легенда колонок, колонка «Коэф» — плейсхолдер.
- **Карточка:** вкладки **«Общие параметры»**, **«Доп. параметры»**, **«Параметры текстуры»**.
- **Сопутствующие/операции** — под списком папок (портал), только при открытой карточке (редактирование).
- **Калькулятор:** `localStorage`: `calc_frame_type_id`, `calc_frame_color_id`; **`calc_frame_height_mm`**, **`calc_frame_width_mm`**, **`calc_frame_qty`** (шаг 3); **`calc_filling_type_id`**, **`calc_filling_material_id`** (шаг 4); **`calc_frame_mortise`**, **`calc_hinge_source`**, **`calc_hinge_type_id`**, **`calc_hinge_material_id`** (шаг 5, присадка/петли); **`calc_hinge_layout`** (шаг 6); **`calc_handle_holes`** (шаг 7). Сброс при новом выборе фасада на шаге 1. **`frame2-sketch`:** без внешней рамки; стили эскиза в **`Step2FrameFacade.css`** (шаги 3–7 подключают при необходимости).

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
- [x] Калькулятор: шаг 4 — наполнение (`CalculatorFillingType`, API, UI).
- [x] Публичная главная **`/`**: калькулятор без входа, read-only UI; анонимное **GET** для материалов и типов калькулятора на бэкенде.
- [x] Калькулятор (рамочный): ориентировочная **цена справа**; сопутствующие с **`quantity_scale`**, операции с **`price_per_facade`** (миграция **`0021`**).
- [x] Калькулятор (рамочный): шаг 5 — **присадка / петли** (`CalculatorHingeType`, UI, `localStorage`); шаг 6 — **расстояния петель**, эскиз с выносными размерами (миграция **`0026`**); шаг 8 — **итог** (`/frame/result`, сводка и ориентировочная цена).
- [x] Калькулятор: **PDF для клиента** (шаг 8, **`frameClientPdf.ts`**, многостраничный файл).
- [ ] Модель заказа, экран «Заказы».
- [ ] Клиентский калькулятор: доработка до уровня реф. Modusline (ценники, корзина, оформление).
- [ ] 1С: sync; `article` + `external_id` как якоря.

## Как продолжить (агент / разработчик)

1. `py scripts/furnitech_status.py` (из корня).
2. [ARCHITECTURE.md](ARCHITECTURE.md), [PLAN.md](PLAN.md).
3. В конце сессии — обновить **этот файл** (дата, факты).
