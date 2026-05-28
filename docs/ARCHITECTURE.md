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

- **Backend:** `requirements.txt` — Django, DRF, `djangorestframework-simplejwt`, `cors`, `python-dotenv`, **`django-storages[s3]`** + **boto3** (опционально **Supabase Storage** при `SUPABASE_MEDIA_ENABLED`; см. [SUPABASE_STORAGE.md](SUPABASE_STORAGE.md)), **Pillow** (загрузка текстур), **rapidfuzz** (нечёткий поиск по материалам в `MaterialViewSet`).
- **Frontend:** `package.json` — React 19, Vite, TypeScript, ESLint; для PDF клиента на шаге 8 — **`jspdf`**, **`jspdf-autotable`**, модуль **`calculator/frameClientPdf.ts`** (подключение из **`Step8FrameResult`** обычным `import`); кириллица — встроенный **Noto Sans** из **`public/fonts/NotoSans-Regular.ttf`** (см. код регистрации шрифта на каждом документе).

## Каталоги

```
Furnitech/
  backend/          # проект `config/`, приложение `materials/`, `manage.py`
  frontend/         # Vite SPA, `src/` — см. [PROGRESS](PROGRESS.md)
  docs/             # PLAN, PROGRESS, ARCHITECTURE, MATERIALS_IMPORT_EXPORT, DEPLOY
  scripts/          # furnitech_status.py
  .venv/            # venv (локально, не в git)
```

## URL-маршрутизация (бэкенд)

| Префикс | Назначение |
|---------|------------|
| `/admin/django/` | Django admin (staff) |
| `/api/auth/token/`, `token/refresh/`, `me/`, **`register/`**, **`admin-users/`**, **`admin-users/<id>/`** | JWT; **`POST /api/auth/token/`** обслуживает **`FurnitechTokenObtainPairView`** — в поле **`username`** можно передать **email** (поиск пользователя по **`email__iexact`**, см. `materials/jwt_auth.py`); публичная регистрация; для сотрудника SPA: список пользователей, PATCH `is_staff`, DELETE учётной записи (см. `materials/user_admin_views.py`) |
| **`/api/materials-export/`**, **`/api/materials-import/`** | Импорт и экспорт каталога материалов (таблица **XLSX** / **XML**). Маршруты в **`config/urls.py`** **выше** **`path("api/", include("materials.urls"))`**, чтобы не пересекаться с **`/api/materials/<pk>/`**. Подробно: **[MATERIALS_IMPORT_EXPORT.md](MATERIALS_IMPORT_EXPORT.md)**. |
| `/api/` | DRF router — см. ниже |
| `/media/` | Локально и при **`DJANGO_SERVE_MEDIA=true`** на Render: раздача с диска. При **`SUPABASE_MEDIA_ENABLED`** — файлы на **Supabase Storage**, в API приходят **absolute URL**, см. [SUPABASE_STORAGE.md](SUPABASE_STORAGE.md). |

## URL-маршрутизация (фронтенд, SPA)

SPA на Vite, **React Router 7**. Часть маршрутов **только для авторизованных** (редирект на `/login` с сохранением `state.from`).

### Публично (без входа)

| URL | Назначение |
|-----|------------|
| `/` | Калькулятор для посетителя: **`CalculatorPage variant="public"`**, шаг 1 (выбор фасада) |
| `/frame`, `/frame/size`, `/frame/filling`, `/frame/summary`, `/frame/hinge-layout`, `/frame/handle-holes`, **`/frame/result`** | Шаги 2–8 для **рамочного** фасада (те же компоненты, что в админке, с `readOnly`) |
| `/mdf`, `/pvc` | Шаг 2 для МДФ / ПВХ (заглушки) |
| **`/my-orders`** | **«Мои заказы»** — **`ClientMyOrdersPage`** (`PublicClientPages.tsx`): **`GET /api/facade-orders/`**; гостю — предложение войти (**`state.from: '/my-orders'`**); у клиента — карточки заказов (**`order_number`** вида **`З-000001`**, краткий статус, **`HintButton`** с длинным пояснением, ссылка на PDF) |
| **`/guide`** | Редирект на **`/`** (резерв; ранее планировалась видеовкладка) |
| `/login` | Вход; при уже активной сессии — редирект (сотрудник → цель или **`/materials`**, клиент → **`/`**). После успеха: **`LoginRoute`** использует **`safePostLoginTarget(state.from, isStaff)`** — только относительные пути без `//` (open redirect); **клиент** может вернуться на калькулятор или **`/my-orders`**; **сотрудник** — ещё на **`/materials`**, **`/textures`**, **`/calculator`**, **`/calculations`**, **`/orders`**, **`/users`** и т.д. |
| `/register` | Публичная регистрация (`POST /api/auth/register/`), затем переход на **`/login`** с пробросом **`state.from`** (и в ссылке «Уже есть аккаунт») |

Компонент **`PublicShell`** (`App.tsx` + `App.css`): верхняя шапка (бренд; **`ThemeToggle`**; «Вход» / «Регистрация» или подпись **email/логин** + «Админка» / «Выйти»); полоса **`public-shell__section-tabs`** — **«Калькулятор»**, **«Мои заказы»** (пилюли в стиле админских **`admin-section-tab`**); контент — **`<Outlet />`** внутри **`public-shell__main`** (**`overflow-y: auto`**, **`min-height: 0`**) — на десктопе при **`#root { overflow: hidden }`** прокручивается длинный шаг 8 и прочие страницы.

### Только после входа (`AdminApp`)

| URL | Назначение |
|-----|------------|
| `/materials`, `/materials/…` | **Материалы:** дерево папок + список (**`#admin-panel-materials`**). Кнопка **«Все папки»** над деревом — **`selected == null`**, справа **`fetchMaterialsFiltered({})`** (все материалы). **DnD** папок и материалов **на странице** (MIME из **`folderMoveDnD.ts`**); отдельные **`MaterialSearchModal`** и **`FolderMoveModal`** на этой вкладке **не** монтируются (**`FolderMoveModal`** используется в **текстурах**). Заголовок списка: **«Материалы в папке:»** / **«Материалы: все папки»**. **Сопутствующие** — модалка (**`admin-modal--extras`**) по клику на строку. **Карточка** — модалка по кнопке **`mat-list-gear-btn`** (**иконка шестерёнки** cog-6-tooth в **`svg`**, **`MaterialForm`**). Подробнее — [«Вкладка „Материалы“»](#вкладка-материалы-сетка-и-сценарии). |
| `/textures`, `/textures/…` | **База текстур:** **`AdminTexturesPanel`**, дерево **`TextureCategory`**, список **`TextureItem`**, карточка в модалке. Корень **«База текстур»** (**`selected == null`**) — **все** текстуры (**`fetchTextureItems()`**, все страницы list). Выбрана папка — текстуры в папке **и вложенных** (**`fetchTextureItems({ category, subtree: true })`**), по смыслу как материалы с **`subtree`**. **`TexturePickerModal`** при выборе папки запрашивает только **одну** категорию без **`subtree`**. Загрузка файла текстуры — на вкладке «Текстуры»; в карточке материала — выбор из базы. |
| `/classes`, `/classes/…` | **Классы материалов:** дерево папок **`MaterialClassCategory`** + список **`MaterialClass`** (**`AdminMaterialClassesPanel`**, **`#admin-panel-classes`**). Корень дерева (виртуальный) — все классы (**`fetchMaterialClasses()`**); выбранная папка — классы в ней и вложенных (**`fetchMaterialClasses({ category, subtree: true })`**). Создание класса — модалка по **«+ Класс»** (как карточка текстуры по внешнему виду). |
| `/calculator`, `/calculator/frame`, … | Калькулятор **`variant="admin"`** (префикс `/calculator/…`, полный CRUD на шагах 2 и 4) |
| `/calculations`, `/calculations/…` | **«Расчеты»** — конструктор формул по классам материалов (**`AdminCalculationsPanel`**, API **`/api/calculation-formulas/`**). |
| `/orders`, `/orders/…` | **«Заказы»** — **`AdminOrdersPanel`**: таблица **`/api/facade-orders/`**, смена статуса (**`FtSelect`**), PDF (поле **`snapshot`** в ответе API и в Django admin, в таблице SPA не показывается) |
| `/users`, `/users/…` | **Пользователи:** список (`GET /api/auth/admin-users/`), роль **`FtSelect`** (пользователь / админ → `is_staff`), **`DELETE`** учётной записи (ограничения на бэкенде); не путать с `/admin/django/` |

Детализация шагов калькулятора (одинаковая логика для гостя и админа, различаются **префикс URL** и **readOnly**):

- **Обёртка маршрутов (`CalculatorPage.tsx`):** у панелей шагов **нет** внешней **`calc-card`** и дублирующих **`h3.calc-h3`** «Рамочный фасад — …»; основной заголовок — **внутри** компонента шага (**`frame3-title`**). Строка «Доступно профилей: N» в **`calc-head`** **удалена**.
- **Шаг 1:** выбор фасада (рамочный / МДФ / ПВХ); заголовок **`frame3-title`** — **«Выберите тип фасада»**; выбор сохраняется в **`step1Facade`**, переход на шаг 2 — кнопкой **«Следующий шаг →»** в **`frame2-card-nav`** (не по **`onChange`** radio). Панель — **`frame2-card calc-side-panel`** с **`CalcStepPriceTotals`** в scroll.
- **Шаг 2:** зависит от фасада; для рамочного — **тип профиля** (`CalculatorProfileType`, до **четырёх** изображений карточки + цвета-материалы) и **цвет** (`Step2FrameFacade`). Заголовок **`frame3-title`** — **«Выберите тип профиля и цвет»**; **«+ Добавить тип профиля»** — в той же строке **`admin-heading-row calc-card-title-row`**, не в отдельном **`frame2-card-head`**. Меню ⚙ на плитке — **`TileGearMenu`** (portal на **`document.body`**, **`tree-gear-menu--portal`**). См. таблицу «Калькулятор (UI)» — строки **«Карточка типа профиля (фото)»**, **«Меню плитки (⚙)»**.
- **Шаг 3 (только рамочный):** габариты — `…/frame/size` (`Step3FrameSizes`); **`frame3-title`** — **«Укажите габаритные размеры»** (`role="heading"`, **`aria-level={3}`**); подзаголовок **`frame3-sub`** убран.
- **Шаг 4 (только рамочный):** наполнение — `…/frame/filling` (`Step4FrameFilling`); **`frame3-title`** — **«Выберите тип наполнения»**; **«+ Добавить тип наполнения»** — в **`admin-heading-row calc-card-title-row`** (как шаг 2). Меню ⚙ — **`TileGearMenu`**. У **`CalculatorFillingType`** до **четырёх** файлов карточки (**`0036`**, **`0047`**) — тот же UI-паттерн, что шаг 2.
- **Шаг 5 (только рамочный):** эскиз и присадка — `…/frame/summary` (`Step5FrameSummary`, **`FrameHingeMortisePanel`**, **`FrameHingeCatalog`**). Отдельный заголовок **«Итоговый эскиз»** в **`Step5FrameSummary`** убран. **`FrameHingeMortisePanel`**: заголовок **`frame3-title`** **«Присадки»**; выбор вида работ и источника петель — **`FtSelect`** с **`menuStrategy="inline"`** (как диаметр на шаге 7), стили панели — **`FrameHingeMortisePanel.css`**, **`Step3FrameSizes.css`**. Каталог **`FrameHingeCatalog`**: до **четырёх** фото (**`0037`**, **`0047`**), **`MaterialSearchModal`**, **«Материалы для карточки»**.
- **Шаг 6 (только рамочный):** раскладка петель — `…/frame/hinge-layout` (`Step6FrameHingeLayout`). **`frame3-title`** — **«Расстояния»**; длинный **`frame3-sub`** убран. Поля расстояний: **№1** — от **начала** стороны (лево/право: сверху; верх/низ: слева), **№2…№n** — от **противоположного** края; подписи полей через **`hingeDistanceFieldLabel`** + **`hingeMeasuresFromEdgeStart`**. Ввод — **целые мм, округление вверх** (**`hingeAbsoluteToUserInputStrings`**). Количество петель **2…10** — поле с **`countStr`** (очистка и набор числа, clamp на **`blur`**). Эскиз: размер **от края до каждой петли** (не цепочка между петлями), см. таблицу «Петли на эскизе». Доступ только при **`isFrameMortiseHingeSelected()`**.
- **Шаг 7 (только рамочный):** `…/frame/handle-holes` (`Step7FrameHandleHoles`); **`frame3-title`** **«Отверстия под ручку»**; убраны **`frame3-step-kicker`**, **`frame3-sub`**, кнопка **«Пропустить шаг»**, подсказка про конфликт стороны с петлями. Логика **0…10** отверстий, **`calc_handle_holes`**, **`isHandleSideBlockedByHinges`**, эскиз — без изменений по смыслу.
- **Шаг 8 «Итог» (только рамочный):** `…/frame/result` (`Step8FrameResult`, **`frameClientPdf.ts`**). Убран кикер **«Шаг 8»**; форма контактов **`id="step8-contact-form"`**; кнопки **«Отправить»**, **«Открыть PDF»** (без многоточия в подписи) и **«← Назад»** в одном ряду **`frame2-card-nav step8-result__nav`** (отправка через **`type="submit"`** + **`form="step8-contact-form"`**); узкая колонка: **`Step8FrameResult.css`** — **`flex-wrap: nowrap`**, снят **`min-width: 12rem`** у кнопок этой полосы. Вторичная кнопка справа в детализации — **«Добавить фасад»**. **Гость** при **«Отправить»** — модалка входа/регистрации (текст с **«Отправить»**). **Клиент:** **`POST /api/facade-orders/`**, **`/my-orders`**; **сотрудник** — **mailto**.

Префиксы маршрутов внутри калькулятора задаются **`calculator/calcPathsContext.tsx`** (`CalcPathsProvider`, хук **`useCalcPaths()`**: `step('frame/size')`, `step('frame/hinge-layout')`, `home`, `readOnly`).

Примечание: это маршрутизация SPA, не Django URL.

### Калькулятор (UI, соглашения)

| Элемент | Описание |
|---------|----------|
| Вкладки шагов | **Шаг 1** — `NavLink` на **`home`** из контекста (`/` или `/calculator`), с **`end`**. **Шаг 2** — кнопка на текущий фасад (`step(facade)`). **Шаг 3** и **Шаг 4** — только при `facade === 'frame'` и **`isFrameStep2Ready()`**; переходы на `step('frame/size')` и `step('frame/filling')`. **Шаг 5** — при `facade === 'frame'` и **`isFrameStep4Ready()`**. **Шаг 6** — в разметке всегда для рамочного фасада после шага 4; **активен** только если ещё **`isFrameMortiseHingeSelected()`** (присадка под петли на шаге 5). **Шаг 7** и **«Итог» (шаг 8)** — при `facade === 'frame'` и **`isFrameStep4Ready()`**. Подсказки `title` при отключённых вкладках. |
| Сессия рамочного шага 2→3 | `localStorage`: `calc_frame_type_id`, `calc_frame_color_id`. Запись после гидрации и при валидной паре «тип профиля + цвет» в ответе API; очистка при сбросе выбора. Событие **`calc-frame-session`** (`frameCalcSession.ts`) + подписка для `useSyncExternalStore` в `CalculatorPage` — обновление вкладки «Шаг 3» без перезагрузки. Готовность: **`isFrameStep2Ready()`**. Шаг 3: **`calc_frame_height_mm`**, **`calc_frame_width_mm`**, **`calc_frame_qty`**. **Дефолт габаритов:** если ключей размеров ещё нет — **`seedFrameDimsFromMaterial`** при загрузке материала цвета (**`min_length` / `min_width`**, иначе **`FRAME_DEFAULT_HEIGHT_MM` / `FRAME_DEFAULT_WIDTH_MM`** = 500×200); уже сохранённые размеры не перезаписываются (**`hasSavedFrameDims`**). **Максимум ввода:** **`max_length` / `max_width`** материала или **`FRAME_DIM_FALLBACK_MAX_MM`** (99999); clamp в **`clampFrameDimDigits`** и на **`onBlur`**. Запись в `localStorage` — **`notifyFrameCalcSession()`**. Шаг 2: эскиз **`facadeSketchBoxStyle`** по **`readFrameDimsMm()`** или дефолту материала; после **`fetchMaterial`** — **`seedFrameDimsFromMaterial`**; подписка **`useSyncExternalStore`**, снимок — строка **`"h|w"`**. Шаг 4 при записи наполнения — тоже **`notifyFrameCalcSession()`**. |
| Карточка типа профиля / наполнения / петель (фото) | Общий вид плитки в сетке: **`CalculatorCardTileStriped`** (`calculator/calculatorCardTiles.tsx`) — превью + **`.tile-card-stripes`** при нескольких кадрах; **последний выбранный** сегмент остаётся активным после ухода мыши со стека (**`activeIdx`** в состоянии; сброс на первый кадр при смене плитки **`versionKey`**). Высота полосок **6px**; **`--active`** / **`:hover`** без смены высоты. До **четырёх** слотов: **`card_image`**, **`card_image_2`**, **`card_image_3`**, **`card_image_4`** (+ **`image_url`** для первого слота при отсутствии файла). Миграции **`0035`–`0037`**, **`0047_calculator_card_image_4`**. Формы: **`ProfileCardImageTileRow`**, **`appendCalcCardImagesToFormData`**; сетка **`frame2-create-grid--profile-type-slim`**. Шаги **2**, **4**, **`FrameHingeCatalog`**. |
| Отверстия под ручку (шаг 7) | **`calc_handle_holes`**: JSON **`HandleHolesPersisted`** — число отверстий (в хранилище только **≥ 1**; **0** в UI означает «ручка не задана», **`writeHandleHoles(null)`**), **`diameterMm`**, **`bushings`**, **`orientation`** (`vertical` \| `horizontal`), **`side`**, **`offsetStartMm`**, **`spanMm`** (межосевые). Валидация **`validateHandleHoles`**; конфликт с петлями: **`isHandleSideBlockedByHinges`** (вертикаль ↔ лево/право, горизонталь ↔ верх/низ). Сброс в **`clearFrameCalculatorStorage()`**; участие в **`readCalculatorPriceConfigKey`**. Гидрация формы из `localStorage` — **`useLayoutEffect`** в **`Step7FrameHandleHoles`**. |
| Присадка и петли (шаг 5–6) | Ключи **`calc_frame_mortise`**, **`calc_hinge_source`**, **`calc_hinge_type_id`**, **`calc_hinge_material_id`**; **`calc_hinge_layout`**: **`HingeLayoutPersisted`** (`side`, `count` **2…10**, **`positionsMm`**). **Ввод на шаге 6:** **`hingeMeasuresFromEdgeStart`** — только **№1** «от начала» кромки (лево/право: сверху; верх/низ: слева); **№2…№n** — «от конца» (лево/право: снизу; верх/низ: справа). **`hingeUserInputsToAbsoluteMm`** / **`hingeAbsoluteToUserInputStrings`** — в полях **целые мм, округление вверх** (**`Math.ceil`**); в **`positionsMm`** — абсолютные координаты вдоль кромки. **`defaultHingeAbsPositionsMm`**, сброс **`writeHingeLayout(null)`** при смене стороны и «не требуется». **`validateHingePositions`**, **`hingeEdgeLengthMm`**, **`readFrameDimsMm`**. |
| Шаг 5 доступность | Шаг 5 доступен **только** если выбран материал наполнения на шаге 4: `localStorage.calc_filling_material_id` валиден. Проверка: **`isFrameStep4Ready()`** в `frameCalcSession.ts`. При прямом открытии URL шага 5 — редирект на шаг 4. |
| Шаг 6 без готовности шага 4 | `Step6FrameHingeLayout`: редирект на шаг 4 при **`!isFrameStep4Ready()`** (аналогично шагу 5). |
| Шаг 6 без присадки под петли | `Step6FrameHingeLayout`: редирект на шаг 7 при **`!isFrameMortiseHingeSelected()`**. |
| Шаг 3 / 4 без сессии шага 2 | `Step3FrameSizes` / `Step4FrameFilling`: редирект на **`step('frame')`** (`replace`), если **`isFrameStep2Ready()`** ложно. |
| Эскиз | Общий вид `.sketch`: отрисовка текстуры через **`materialTextureLayerStyle`** (`sketchFrame.ts`) на внутренних слоях `.sketch-frame-texture` и `.sketch-paper-texture`. **Наполнение:** **`materialFillingTextureLayerStyle`** — фиксированная непрозрачность **`SKETCH_FILLING_TEXTURE_OPACITY` (0.18)**, не **`tex_opacity`** материала. Пропорции — **`facadeSketchAspectRatio`**, вертикальный масштаб — **`facadeSketchScaleY`** / **`facadeSketchBoxStyle(H_mm, W_mm)`** (шаги 2–7). **`--sketch-scale-y`** не растёт выше **`SKETCH_SCALE_HEIGHT_CAP_MM` (1700)**. **Шаг 3:** для чертежа **`frameSketchDisplayDims`** — пустое поле или **0** → **500×200** мм по оси; иначе введённые габариты. Лист **`.sketch-sheet`**: чёрный текст, уменьшенный кегль (**`Step2FrameFacade.css`**). |
| Чертёжные размеры (шаг 3) | Блок **`frame3-drawing`** обнимает `.sketch`; **`frame3-dim-drawing`**: выносные пунктирные линии, размерная линия со стрелками, подписи мм; `z-index` выше листа эскиза. Зазор подпись ↔ линия — **`--frame3-dim-label-gap`** (8px) на **`.frame3-drawing`**. **Зазор габарита ↔ эскиз** — **`--frame3-dim-sketch-gap-y/x`**: десктоп **15/14px**, ≤1024px **13/11px**, ≤640px **11/9px** (вдвое меньше, чем у цепочек петель/ручек — те хранят прежние 30/26/22 в **`--frame3-chain-sketch-gap`**). **Ширина (top/bottom):** **`gap`** между подписью и **`__h`**. **Высота (left/right):** **`__left-col`** — absolute: **`__v`** у внутреннего края (**`right/left: 2px`**, ширина 8px), **`__value--side`** — **`translate(±50%, -50%) rotate(±90deg)`** от точки **`2px + 4px + label-gap`** (центр v-линии + 8px), не grid-колонка. Модификаторы **`--right`** / **`--bottom`** — габарит **напротив** стороны с петлями/ручкой. |
| Петли / ручки на эскизе (шаги 5–7) | Маркеры: **`sketch--hinge-markers`**, **`.sketch-hinge-pin`**, **`.sketch-handle-pin`**. **Цепочки размеров:** модуль **`hingeChainSketchDims.tsx`** (**`HingeChainDimLayer`**, **`useHingeChainSketchDims`**, **`sketchMainDimPlacement`**); шаги **6** (петли) и **7** (ручки) — один слой **`frame3-hinge-dim-layer`**, блоки **`.hinge-chain-dim`**. Каждая точка — размер **от края до позиции** (№1 от начала, №2…№n от противоположного края). **`trackTopPct`** / **`trackSpanPct`**, **`trackOffsetPx`** (№1 и №n — 0; №2…№n−1 — ступени × **26px**). **Зазор цепочки ↔ эскиз** — **`--hinge-chain-sketch-gap`** ← **`--frame3-chain-sketch-gap`** (десктоп **30px**, ≤1024px **26px**, ≤640px **22px**), не зависит от `--frame3-dim-sketch-gap-*` главных габаритов. Подписи: **`--hinge-chain-label-gap`** ← **`--frame3-dim-label-gap`**. **Верх/низ:** **`__val--h`** — **`top: 50%`**, **`translate`** от **центра** отрезка **`__h`**. **Лево/право:** **`translate(±50%, -50%) rotate(±90deg)`** по центру **`__v`**. **`--narrow`** — без стрелок на коротком сегменте. |
| Левая панель формы | **`.calc-side-panel`** (`CalculatorPage.css`): колонка **flex** фиксированной высоты (**`--calc-side-h`**), **`overflow: hidden`**; прокрутка только в **`.calc-side-panel-scroll`** (шапка и **`frame2-card-nav`** остаются видимыми). Шаги 1–8 используют этот паттерн. **Ширина** на десктопе: **`min(var(--calc-steps-tabs-width), 100%)`** — **`--calc-steps-tabs-width`** задаёт JS (**`syncCalcStepsTabsWidth`**) по полосе вкладок до «Итог». **Админка (`#admin-panel-calculator`):** отдельно **`--calc-steps-panel-width`** — до **правого края вкладки «Шаг 6»**; overrides в **`CalculatorPanelShell.css`**, одинаково на шагах 1–8. |
| Шаг 8 «Итог» (вёрстка) | **`calc-routes-wrap--step8`** (публичный **`#public-panel-calculator`** и админ **`#admin-panel-calculator`**). Десктоп: **`.frame2.step8-result`** — **grid** две колонки (контакты | детали); **`Step8FrameResult.css`** задаёт шаблон, **`CalculatorPanelShell.css`** (≥1025px) не должен переключать контейнер на **`flex-direction: column`** (иначе детализация уезжает под форму). Слева **`step8-result__contact`**, справа **`step8-result__scroll-pack`** (детализация, таблица цен, **«Добавить фасад»**). ≤1024px — одна колонка. |
| Ориентировочная цена | Блок **`CalcPriceTotals`** / **`CalcStepPriceTotals`** **внутри** **`.calc-side-panel-scroll`** на шагах **1–7** (**`placement="inline"`**, обёртка **`.calc-totals-inline`**). Контекст **`CalcPriceTotalsSlotProvider`**: на **шагах 1–2** только подсказка (**`hideTotals`**), на **шаге 8** блок скрыт (**`blankAside`**). В админке блок прижат к низу scroll (**`margin-top: auto`**). На **шагах 1–2** суммы нет (цена с шага 3). Подписка на **`calc-frame-session`**, **`readCalculatorPriceConfigKey`**, **`fetchMaterial`**, **`resolveMaterialPricingUomCode`**. При переходе с шага 1 — **`clearFrameCalculatorStorage()`**. Отдельная правая колонка **`.calc-totals-aside`** в **`calc-body-with-totals--wide`** **не используется**. |
| Меню плитки (⚙) | **`calculator/TileGearMenu.tsx`**: кнопка шестерёнки в **`tile-gear-wrap`**, выпадающий список — **`createPortal`** на **`document.body`**, **`position: fixed`**, класс **`tree-gear-menu--portal`**. Позиция от **`getBoundingClientRect`**, flip у краёв viewport. Шаги **2** (тип профиля) и **4** (тип наполнения). Стили пунктов — **`AdminApp.css`** (**.tree-gear-menu-item**). |
| Альтернативный расчёт «по классам» | Если есть **активная** запись **`CalculationFormula`** (**`GET /api/calculation-formulas/?active=1`**, первая в списке), и **`evaluateCalculationFormula`** в **`calculator/calculationFormula.ts`** вернула число — **итого** переводится в эту сумму вместо простого суммирования профиль+наполнение+related (строчки профиля могут быть свёрнуты в одну «Формула» в UI). Подробно: **[CALCULATION_FORMULAS.md](CALCULATION_FORMULAS.md)**. |
| Расчёт суммы (базовый режим) | Модуль **`calculator/framePriceEstimate.ts`**. Объём: **`resolveMaterialPricingUomCode`** — при **`pricing_calc_mode`** (`linear` → периметр м.п., `sheet` → м², `piece` → шт); иначе **`uom.code`** / эвристика **`resolvePricingUomCode`**. **Объём на все фасады** \(N\): м², м.п. периметра, шт; затем × **`excess_coefficient`** (**`parseExcessCoefficient`**, default **1**). **Профиль:** `base_price × geomColor`. **Сопутствующие** (и у цвета профиля, и у наполнения): **поштучно** по полю **`quantity_scale`** строки (`follow_parent` — × тот же множитель, что у «родителя» строки: у профиля это `geomColor`, у наполнения — `geomFill`; `per_facade` — только × \(N\); `use_related_uom` — × объём по ед. изм. **сопутствующего** материала и габаритам, с его **`excess_coefficient`**). См. **`relatedItemsCalculatorCost`**. **Наполнение:** `base_price × geomFill` + сопутствующие наполнения той же поштучной логикой. |

Дополнительно (UI):

- **Временно (2026-05-24):** адаптив **`mobile.css`** **отключён**; вместо него **`desktop-layout.css`** + **`viewport width=1280`** в **`index.html`** — макет всегда десктопный, прокрутка документа по X/Y (только **`html`**, без дубля на **`body`**); на телефоне pinch-zoom. Inline-скрипт **`fitViewport()`** в **`index.html`**: при **`innerWidth < 1280`** стартовый **`initial-scale = innerWidth / 1280`** — при входе видна вся ширина макета. Late overrides в **`desktop-layout.css`** фиксируют desktop-сетки при browser zoom (без **`dvh`** у эскиза/панелей). В справочниках (**материалы**, **текстуры**, **классы**, **расчёты**, **`MaterialSearchModal`**) левая колонка **`.admin-aside`** — **`position: sticky`** для DnD в папки при scroll списка; вкладка **«Расчёты»** — двухколоночная сетка как у материалов. См. [PROGRESS.md](PROGRESS.md).
- Глобальный фон: текстура дерева задаётся CSS‑переменной `--ft-wood-texture` (сейчас `frontend/src/assets/wood-premium.png`) и рисуется на уровне `#root::before` как `background-size: cover` (без тайлинга/швов).
- **Тема оформления:** **`light`** (по умолчанию) и **`dark`** — CSS-переменные **`--ft-*`** в **`index.css`**, атрибут **`data-theme`** на **`<html>`** (старт **`data-theme="light"`** в **`index.html`**), переключатель **`ThemeToggle`** (сохранение **`furnitech-theme`** в **`localStorage`**). См. **`theme.ts`**, **`ThemeProvider.tsx`**.
- На **шаге 2** и шагах **3–7** эскиз мягко меняет пропорции по \(H×W\) через **`facadeSketchBoxStyle`** / **`facadeSketchAspectRatio`**: `aspectRatio` смешивается с дефолтным (≈ 0.714) и ограничивается. Высота через **`--sketch-scale-y`** (**`facadeSketchScaleY`**) — с потолком **`SKETCH_SCALE_HEIGHT_CAP_MM = 1700`** (выше 1700 мм по H масштаб не растёт).
- На шаге **4** размеры не теряются: габариты читаются из `localStorage` через `subscribeFrameCalcSession`/`readCalculatorPriceConfigKey` и показываются на чертеже.
- На шаге **3** поля размеров/кол-ва фильтруют ввод (только цифры) и автоматически поджимают значение в допустимый диапазон по min/max выбранного материала (кол-во фасадов — минимум 1).
- Выпадающие списки: **`FtSelect`** (по умолчанию портал в `document.body`; на шагах калькулятора с **`overflow`** у предков — **`menuStrategy="inline"`**). На шаге 5 присадка — **`FrameHingeMortisePanel`** (**`FtSelect`**, не нативный `<select>`).

## REST API (сводно)

**По умолчанию** к защищённым ресурсам нужен **JWT**: `Authorization: Bearer <access>`.

**Исключение (публичный калькулятор):** методы **GET / HEAD / OPTIONS** для **`/api/materials/`**, **`/api/calculator-profile-types/`**, **`/api/calculator-filling-types/`**, **`/api/calculator-hinge-types/`**, **`/api/calculator-handle-hole-diameters/`** (включая детализацию по `/{id}/` там, где применимо) разрешены **без аутентификации**. Для **`calculator-handle-hole-diameters`** анонимный list возвращает только строки с **`client_visible=true`**; полный каталог — см. строку таблицы ниже. Методы **POST, PUT, PATCH, DELETE** на этих же ресурсах — только для **авторизованных** пользователей с соответствующими **Django model permissions** (класс **`AllowAnyReadAuthenticatedModelPermsWrite`** в `materials/views.py`).

**`/api/calculator-profiles/`** — по-прежнему только с JWT для всех методов (**`AuthReadModelPermsWrite`**: чтение только авторизованным).

| Ресурс | Методы | Примечания |
|--------|--------|------------|
| `/api/categories/` | GET, POST | `GET ?tree=1` — вложенное дерево; обычный `GET` — плоский list с пагинацией. **JWT.** |
| `/api/categories/{id}/` | GET, PUT, PATCH, DELETE | **JWT.** `PATCH` — переименование и т.д.; **DELETE** — **каскадное** удаление поддерева и всех материалов в нём (см. [категории](#категории-материалы-папки)). |
| `/api/texture-categories/` | GET, POST | База текстур: папки. `GET ?tree=1` — дерево. **JWT + DjangoModelPermissions** (без анонимного доступа). |
| `/api/texture-categories/{id}/` | GET, PUT, PATCH, DELETE | **JWT.** Каскадное удаление поддерева и **`TextureItem`**; у материалов **`texture_item`** → **`SET_NULL`**. |
| `/api/texture-items/`, `/api/texture-items/{id}/` | CRUD | Пагинация 100. **JWT + model perms.** List: без query-параметров — все записи; **`?category=<id>`** — только эта папка; **`?category=<id>&subtree=1`** (и варианты `true`/`yes`) — папка и все вложенные (**`texture_category_subtree_ids`** в **`TextureItemViewSet`**). На фронте для полного списка и поддерева используется **`fetchTextureItems`** с обходом **`next`**. Тело POST/PATCH: JSON или multipart (**`image`**). Каталог файлов: **`texture_library/`**. |
| `/api/uom/`, `/api/uom/{id}/` | CRUD | **JWT.** |
| `/api/material-classes/`, `/{id}/` | CRUD, DELETE | **JWT.** |
| `/api/calculation-formulas/`, `/{id}/` | CRUD | Формулы расчёта по классам материалов. **GET — анонимно** (для публичного калькулятора), запись — staff-админка. Query: **`?active=1`** — только активные формулы. |
| `/api/materials/`, `/{id}/` | CRUD, list | Пагинация 100. **GET — анонимно; запись — JWT + model perms.** Параметры list (см. **`MaterialViewSet.get_queryset`**): **`category`** (id папки; при задании **`folder_name`** игнорируется), **`search`** (одна строка — **имя или артикул**, гибкий поиск), **`folder_name`** (по имени **`MaterialCategory`**), **`article`**, **`name`**, **`price`** (точное **`base_price`**, запятая нормализуется), **`material_class_ids`** (id через запятую — **хотя бы один** из классов у материала). Логика «гибкого» текста — **`materials/flexible_search.py`** (токены, **`icontains`**, при необходимости **rapidfuzz** на подмножестве pk). |
| **`/api/materials-export/`** | **GET** | Экспорт **XLSX** или **XML**. Query: **`export_format`** = `xlsx` \| `xml` (**не** `format` — конфликт с DRF), опционально **`category`**. **JWT** + **`MaterialExportPermission`**. См. **[MATERIALS_IMPORT_EXPORT.md](MATERIALS_IMPORT_EXPORT.md)**. |
| **`/api/materials-import/`** | **POST** | Импорт `.xlsx` / `.xml`, поле **`file`**. **JWT** + **`MaterialImportPermission`**. JSON: `created`, `updated`, `skipped`, `errors`. |
| `/api/calculator-profiles/`, `/{id}/` | CRUD | Профили калькулятора (профиль = материал) + «цвета». **Только JWT.** |
| `/api/calculator-profile-types/`, `/{id}/` | CRUD | Типы профилей + цвета (материалы) + флаги + `card_image` … `card_image_4` и/или **`card_texture` … `card_texture_4`** (FK **`TextureItem`**, миграция **`0050`**). В ответе: **`card_texture_*_image`** (URL из базы текстур). При записи файла в слот текстура слота сбрасывается. **GET — анонимно; запись — JWT + model perms.** |
| `/api/calculator-filling-types/`, `/{id}/` | CRUD | Типы наполнения + материалы + файлы/текстуры карточки (**шаг 4**), контракт как у типов профиля. **GET — анонимно; запись — JWT + model perms.** |
| `/api/calculator-hinge-types/`, `/{id}/` | CRUD | Типы петель + материалы + файлы/текстуры карточки (**шаг 5**). **GET — анонимно; запись — JWT + model perms.** |
| `/api/calculator-handle-hole-diameters/`, `/{id}/` | CRUD | Диаметры отверстий под ручку (шаг 7): **`client_visible`**, сортировка. **GET — анонимно**, в ответе только строки с **`client_visible=true`**; полный список и **`catalog_scope":"full"`** — при JWT и праве **`change_calculatorhandleholediameter`** (у группы **«Редактор материалов»** права на всё приложение `materials` обновляются миграциями вроде **`0028_editor_perms_handle_hole_diameter`**). **PATCH** — JWT + model perms. |
| `/api/facade-orders/`, `/{id}/` | GET, POST, PATCH, DELETE | Заказы калькулятора (**`FacadeOrder`**). **POST** — **JWT**, multipart; только **не staff / не superuser**. **GET** — **JWT**: по умолчанию **свои** заказы; **все** — у staff/superuser/группы **«Менеджеры»** при **`?scope=admin`** (список в админке). **PATCH** — **staff**, **superuser** или **менеджер** (группа + **`change_facadeorder`**): **`status`**, **`payment_status`** (`unpaid`, `partial`, `paid`, миграция **`0048`**). **DELETE** — только **staff/superuser** (`IsAdminUser`). Ответ: **`order_number`**, **`pdf_url`**, **`status_display`**, **`payment_status_display`**, **`snapshot`**, **`client_username` / `client_email`**. |

**Пагинация list:** `count`, `next`, `previous`, `results`. Для **`calculator-handle-hole-diameters`** в теле ответа также может быть **`catalog_scope`**: `full` \| `client`.

### Поля тела/ответа: материал (дополнительно к полям модели)

- `material_class_ids` — список id.
- `related_items` — при передаче ключа в теле запроса: полная замена списка. В каждой строке: **`quantity_scale`**: `follow_parent` \| `per_facade` \| `use_related_uom` (по умолчанию `follow_parent`).
- `article` — строка, при записи **обрезка**; **уникальность** у непустого значения (БД + валидация в сериализаторе), см. [материал](#категории-материалы-папки).
- `thickness`, `min_length`, `max_length`, `min_width`, `max_width` — лимиты габаритов / задел калькулятора; в SPA **`MaterialForm`** поля размеров и **`PATCH`** этих ключей — на вкладке **«Общие параметры»**, **`thickness`** в UI карточки не редактируется, но значение участвует в теле запроса из состояния формы.
- `texture_mode`, `texture_color`, `texture_image`, **`texture_library_item`** (id записи **`TextureItem`** или `null`), **`texture_library_item_name`** (только чтение), `tex_*` — **«Параметры текстуры»**. Картинка для эскиза: либо **`texture_image`** на карточке (устаревший прямой файл снят с формы SPA), либо файл выбранной **`TextureItem`**; в ответе API поле **`texture_image`** содержит **эффективный** абсолютный URL (**`MaterialSerializer.effective_texture_image_url`**). Свой загружаемый файл и ссылка на базу **взаимоисключающи** при записи.

**JWT (настройки):** `SIMPLE_JWT` в `config/settings.py` — сроки access/refresh. Токен выдаётся через **`FurnitechTokenObtainPairSerializer`**: поддержка входа по **email** в поле **`username`** (и перебор кандидатов при дублях email).

**БД (dev, SQLite):** в `DATABASES['default']['OPTIONS']` задан **`timeout`** (секунды ожидания при блокировке). **`ALLOWED_HOSTS`** по умолчанию включает **`127.0.0.1`**, **`localhost`**, **`0.0.0.0`**, **`[::1]`** (переопределяется **`DJANGO_ALLOWED_HOSTS`** в `.env`).

---

## Категории, материалы, папки

### Категории (`MaterialCategory`)

- Дерево: `parent` → `self`, у детей `on_delete=CASCADE` при удалении **родителя** (на уровне модели).
- `unique_together` **(parent, name)** — уникальное имя среди **соседей** (одинаковое имя в **другой** ветке разрешено).
- **Удаление через API** (`DELETE /api/categories/{id}/`): в **`transaction.atomic`** собираются id **выбранной папки и всех потомков**; удаляются все **`Material`** с `category_id` из этого списка (каскад модели на связанные сущности); затем удаляется сама выбранная категория — дочерние категории уходят по CASCADE от `parent`. Ответ **204**. Во фронте — модалка с предупреждением о полном удалении содержимого.
- **Патч/пут** — смена `name`, `parent`, `code`, `sort_order` (как в сериализаторе).

### Материал (`Material`)

- **Артикул (`article`):** хранение с `strip` в `save`/`clean`; **ограничение БД:** `UniqueConstraint` на `article` с условием `article != ""` (несколько **пустых** артикулов **могут** существовать). Дублирование **непустого** — ошибка 400.
- **Активен (`is_active`, default `True`):** булево «карточка действующая / выключенная». В **SPA карточки материала** переключателя нет: при **POST/PATCH** из формы уходит **`material?.is_active ?? true`** (новый — активен; существующий — флаг не меняется из этой формы). Редактирование **`is_active`** вручную — **Django admin** (`/admin/django/`). Фильтрация каталога калькулятора по **`is_active`** — см. [PROGRESS](PROGRESS.md).
- **Классы материала (`material_classes` → `MaterialClass`):** M2M-справочник меток; выбор во фронте в **`MaterialForm`**. Поле **`material_class_ids`** участвует в альтернативном расчёте суммы через **активную формулу** калькулятора — см. **[CALCULATION_FORMULAS.md](CALCULATION_FORMULAS.md)**.
- **`pricing_calc_mode`** (миграция **`0045_material_pricing_calc_mode`**, choices **`linear`** / **`sheet`** / **`piece`**, blank): режим расчёта количества в калькуляторе — **погонаж** (периметр м.п.), **лист** (площадь м²), **штуки** (1 на фасад); задаётся флажками в **`MaterialForm`**. При пустом значении — **`resolvePricingUomCode(uom)`**. Функция **`resolveMaterialPricingUomCode`** в **`framePriceEstimate.ts`**.
- **`excess_coefficient`** (миграция **`0046_material_excess_coefficient`**, default **`1`**): множитель запаса к рассчитанному количеству (напр. **`1.1`** → +10%); поле **«Коэффициент избытка»** под блоком округления в **`MaterialForm`**. В калькуляторе применяется в **`pricedUnitsForMaterial`** (**`parseExcessCoefficient`**).
- **`rounding_mode`** / **`rounding_multiple`**: способ округления количества вверх (см. карточку материала); в **`framePriceEstimate.ts`** пока **не подключено** — только хранение и импорт/экспорт.
- **`uom` → `UnitOfMeasure`:** обязательная связь; в карточке — **`FtSelect`** по справочнику **`/api/uom/`** (**`uom_id`** в **`PATCH`**).
- **`import_export_snapshot`:** JSON-объект с полями строки таблицы импорта/экспорта (тег → строка), чтобы не терять колонки без отдельных полей в БД. См. **[MATERIALS_IMPORT_EXPORT.md](MATERIALS_IMPORT_EXPORT.md)**.

### Взаимосвязи

- `Material.category` — `PROTECT` на `MaterialCategory`.
- Сопутствующие — см. миграцию `0010` и [PROGRESS](PROGRESS.md). Отдельные строки «операций» у материала удалены (миграция **`0032_remove_material_operation_line`**).
- **База текстур** (миграция **`0033_texture_library`**): модели **`TextureCategory`** (дерево папок, контракт как у **`MaterialCategory`**) и **`TextureItem`** (`category`, `name`, `image`). У **`Material`** поле **`texture_item`** — `ForeignKey(..., SET_NULL)`. Группа **«Редактор материалов»** получает права на новые модели в той же миграции (**`RunPython`**).

#### Сопутствующие (семантика расчёта)

| Поле | Где | Смысл в калькуляторе |
|------|-----|----------------------|
| `quantity_scale` | `MaterialRelatedItem` | `follow_parent` — \(q \times p\) × тот же геометрический множитель, что у карточки родителя (профиль или наполнение). `per_facade` — \(q \times p \times N\) без периметра/площади родителя (крепёж, комплект на изделие). `use_related_uom` — \(q \times p\) × объём по ед. изм. сопутствующего и \(H,W,N\). |

Предпросмотр суммы в **`MaterialExtrasPanel`** остаётся «плоским» (кол×цена по строкам + основной материал); итог **в калькуляторе** зависит от масштаба и габаритов — подсказки в UI панели.

Примечание по ед. изм. сопутствующих: в `MaterialExtrasPanel` доступен выбор `uom` сопутствующего материала (с сохранением в БД через `PATCH /api/materials/{id}/`), чтобы строка могла корректно масштабироваться в режиме `use_related_uom`.

---

## Представления (бэкенд, кратко)

- `AllowAnyReadAuthenticatedModelPermsWrite` — разрешения для **материалов**, **типов профилей**, **типов наполнения**, **типов петель**, **диаметров отверстий под ручку**: анонимные **безопасные** методы; запись — только аутентификация + `DjangoModelPermissions`.
- `AuthReadModelPermsWrite` — **только авторизованным** на чтение; запись по model permissions — используется для **`CalculatorProfileViewSet`**.
- `MaterialViewSet` — `select_related`/`prefetch_related`; **`filter_backends = []`**; фильтрация в **`get_queryset`** (параметры query string) + модули **`flexible_search`**; вспомогательная **`_materials_pk_subset`** — «чистый» queryset по pk для сканирования без конфликта deferred/`select_related`.
- `MaterialCategoryViewSet` — кастомный `list` для `?tree=1` и **`destroy`** с **каскадным** удалением материалов и поддерева категорий.
- **`TextureCategoryViewSet`**, **`TextureItemViewSet`** — только **JWT + `DjangoModelPermissions`**; дерево папок `?tree=1`; у **`TextureItemViewSet`** list поддерживает **`category`** и **`subtree`** (фильтрация через **`texture_category_subtree_ids`**, см. таблицу API). У **материалов** в queryset добавлено **`select_related` / `prefetch_related`** на **`texture_item`** для корректного **`texture_image`** в summary.
- **`RegisterView`** (`user_admin_views.py`) — публичная регистрация: **`create_user(..., is_staff=False, is_superuser=False)`**; попытка передать **`is_staff`** или **`is_superuser`** как **`true`** в теле запроса → **400**; после создания при необходимости принудительный сброс флагов.
- `MaterialSerializer` — `validate_article`, замена `related_items` в `create`/`update`, обработка `IntegrityError` по артикулу.
- **`MaterialSummarySerializer`** — краткое представление материала (в т.ч. вложенное в **`related_items`** и типы калькулятора); поля **`texture_library_item_name`**, **`pricing_calc_mode`** (чтение) — для подписей плиток и расчёта сопутствующих с **`quantity_scale = use_related_uom`**.
- `CalculatorProfileViewSet` — профили калькулятора (профиль = `Material`) + «цвета профиля» (материалы).
- `CalculatorProfileTypeViewSet` — типы профилей + цвета (материалы) + флаги и до **четырёх** файлов карточки (**`card_image` … `card_image_4`**); JSON и **multipart/form-data** (ключи файлов совпадают с именами полей).
- `CalculatorFillingTypeViewSet` — типы наполнения + связанные материалы + до четырёх файлов карточки (**`0036`**, **`0047`**).
- `CalculatorHingeTypeViewSet` — типы петель + связанные материалы + до четырёх файлов карточки (**`0037`**, **`0047`**); модели **`CalculatorHingeType`** / **`CalculatorHingeTypeMaterial`** (базовая миграция **`0026_calculator_hinge_types`**, см. [PROGRESS](PROGRESS.md)).
- `CalculatorHandleHoleDiameterViewSet` — справочник диаметров для шага 7; модель **`CalculatorHandleHoleDiameter`** (миграции **`0027_calculator_handle_hole_diameters`**, **`0028_editor_perms_handle_hole_diameter`**); в сериализаторе **`diameter_mm`** задаётся только при **создании**.
- **`FacadeOrderViewSet`** — заказы шага 8: **`IsAuthenticated`**; **`get_queryset`** — свои заказы, либо все при staff/superuser/менеджере и **`scope=admin`**; **`partial_update`** — staff/superuser/менеджер + **`FacadeOrderStaffUpdateSerializer`** (**`status`**, **`payment_status`**); **`destroy`** — **`IsAdminUser`**. Парсеры: multipart + JSON.
- **`MeView`** / **`AdminUserStaffView`** — в профиле и списке пользователей поле **`is_manager`**; смена роли через **`role`** (`user` | `manager` | `admin`), группа **«Менеджеры`** (миграция **`0049`**).

### Модель `FacadeOrder` (кратко)

- Поля: **`user`**, **`status`**, **`payment_status`** (не оплачен / частично / оплачен), контакты (**`contact_*`**), **`snapshot`**, **`pdf_file`**, **`created_at` / `updated_at`**. Зарегистрирована в **`/admin/django/`** (фильтры по статусу и оплате).

---

## Фронтенд: модули и поведение

| Модуль | Роль |
|--------|------|
| `App.tsx` | `/login` (**`LoginRoute`**, **`safePostLoginTarget`** — admin → `/materials`, manager → `/orders`, клиент → `/`); **`AdminRoute`** — staff, superuser или **`is_manager`**; **`AdminApp`** на `/materials/*` … `/users/*` (менеджеру — только **Заказы** и **Калькулятор**); **`PublicShell`** — калькулятор, **`my-orders`**, для staff/manager ссылка в админку. |
| `PublicClientPages.tsx` | **`ClientMyOrdersPage`** (**`fetchFacadeOrders`**, статусы + **`HintButton`**), **`isPublicCalculatorRoute`**, **`PublicShellOutletContext`**. |
| `AdminApp.tsx` | Шапка **`admin-header-top`** + **`admin-section-tabs`**; **`ThemeToggle`** (светлая/тёмная тема). Выпадающее **«Справочники»**: **Материалы**, **Текстуры**, **Классы**, **Ед. изм.**, **Формулы**. Сетка **`/materials`** (две колонки); **`/uom`** — **`AdminUomPanel`**; калькулятор **`variant="admin"`**; **«Расчеты»** — **`AdminCalculationsPanel`**; **«Заказы»** — **`AdminOrdersPanel`**. **Материалы:** **`TreeRow`** с **`treeDnD`** (DnD папок, drop материала на папку), **`FolderCreateModal`**, **`applyFolderMove`** / **`applyMaterialMove`**, **`fetchMaterialsFiltered`**, корень **«Все папки»**; без **`MaterialSearchModal`** / **`FolderMoveModal`** на этой вкладке. Список: **`mat-list-row`** (**`draggable`**) / **`mat-list-gear-btn`** (SVG **cog-6-tooth** — шестерёнка карточки); сопутствующие — **`createPortal`** (**`admin-modal--extras`**, **`saveExtras`**); карточка — **`MaterialForm`** в **`section`** с **`admin-modal--material-card`**, **`admin-calculations-modal-surface`**, **`admin-material-card-dialog`** (компактная типографика и поля как у модалки формулы: крестик закрытия, **`FtSelect compact`** для ед. изм., в футере сначала **«Удалить»** **`admin-danger`**, затем **«Сохранить»**). **`MaterialForm`**: **`is_active`** не в UI. |
| `AdminCalculationsPanel.tsx` | Вкладка **«Расчеты»**: дерево папок формул + список; модалка редактора — три колонки (дерево классов, таблица, keypad), **`input`** наименования и **`input`** поля формулы (посимвольный курсор, **`formulaDisplayExpression`** без пробелов); **`MaterialClassPickerBody`** (**`hidePickChrome`**). **Удаление** — диалог **`admin-modal`**. |
| **`MaterialClassPickModal.tsx`** | **`MaterialClassPickerBody`** (дерево **`MaterialClassCategory`** + **`ClassPickListTable`**), **`MaterialClassPickModal`** (портал с поиском и крошками — карточка материала). Встроенный режим формулы: **`hidePickChrome`**, **`shownScopeLabel`** в таблице. Загрузка: один **`fetchMaterialClasses()`** → **`allClasses`**; список в корне — из кэша, по папке — **`subtree`**. |
| **`AdminMaterialClassesPanel.tsx`** | Вкладка **«Классы»**: дерево папок **`MaterialClassCategory`**, список **`MaterialClass`**; админский список грузится постранично через **`fetchMaterialClassesPage`** (первая страница сразу, далее **«Загрузить ещё»**), полная **`fetchMaterialClasses`** используется вне этой вкладки для pickers/калькулятора; новый класс — модалка (**«+ Класс»**, разметка как **`admin-modal--material-card`**). |
| **`AdminTexturesPanel.tsx`** | Вкладка **«Текстуры»**: дерево **`TextureCategory`**, список **`TextureItem`**; админский список грузится постранично через **`fetchTextureItemsPage`** для **«База текстур»** и папки с **`subtree`** (следующая страница — **«Загрузить ещё»**); DnD папок и текстур (**`folderMoveDnD`**, **`DND_TEXTURE_ITEM`**). |
| **`AdminUomPanel.tsx`** | Вкладка **«Ед. изм.»** (`/uom`): плоский список **`UnitOfMeasure`** без дерева папок — колонки **код / сокращение / наименование**; **`fetchUom`**, **`createUom`**, **`updateUom`**, **`deleteUom`**; модалка карточки как у классов; порядок строк — **`sortUomForSelect`**. |
| `AdminOrdersPanel.tsx` | Таблица заказов и **`FtSelect`** статусов (**в т.ч. «Завершён»**), PDF; без колонки просмотра **`snapshot`**. |
| `FolderCreateModal.tsx` | Окно «Создать папку» в стиле Windows-Explorer: левая колонка — дерево с раскрытием, правая — сетка плиток (📁 папки, 📄 материалы из **`fetchMaterials`** с кешем), хлебные крошки, поле имени, кнопки «Отмена» / «Создать»; портал в **`document.body`**, классы **`admin-modal--explorer`** + **`folder-explorer-*`**. |
| `FolderMoveModal.tsx` | Explorer: DnD **любой** папки (строка дерева, **«Все папки»**, плитка 📁); MIME **`application/x-furnitech-folder-move`** / **`application/x-furnitech-material-move`** из **`folderMoveDnD.ts`**; **`executeFolderMove`** → **`onMove(newParent, movingId)`**; после успеха **без** **`onClose`**; футер **«Закрыть»**. Опционально **`onMoveMaterial`** (📄 → папка). **Текстуры:** без **`onMoveMaterial`**, только папки. На вкладке **«Материалы»** не используется — перенос там **inline** в **`AdminApp`**. |
| `folderMoveDnD.ts` | **`DND_FOLDER`**, **`DND_MATERIAL`**, **`DND_TEXTURE_ITEM`**, **`isFolderDrag`**, **`isMaterialDrag`**, **`isTextureItemDrag`** — общие для **`AdminApp`**, **`FolderMoveModal`**, **`AdminTexturesPanel`**. |
| `MaterialSearchModal.tsx` | Поиск материалов в **калькуляторе** (шаги **2**, **4**, **5**): layout как **`#admin-panel-materials`** (**`admin-aside`** + **`mat-list-table`**), без текстовых фильтров. **`mode="multiPick"`** (по умолчанию): чекбоксы, **`Map<id, Material>`**, **«Добавить (N)»**. Корень дерева — **«База материалов»**; список: **`fetchMaterialsFiltered({})`** или **`fetchMaterials(category, { subtree: true })`** (папка **и вложенные**). Стили — **`material-search-modal`**, **`#material-search-modal`** в **`AdminApp.css`**. **`mode="navigate"`** в SPA на вкладке материалов **не** используется. |
| `MaterialExtrasPanel.tsx` + **`MaterialExtrasPanel.css`** | Сопутствующие (колонка **«Масштаб»**: `quantity_scale`); предпросмотр без габаритов; в админке материалов — внутри модалки **`admin-modal--extras`**. |
| `api.ts` | `apiFetch` (Bearer при наличии токена) + калькулятор и **`facade-orders`**: **`createFacadeOrder`**, **`fetchFacadeOrders`**, **`patchFacadeOrderStatus`**; **`fetchMaterialsFiltered`**, **`searchMaterials`** (параметр **`search`**); **`fetchUom`** (async, **все страницы** list), **`createUom`**, **`updateUom`**, **`deleteUom`**; **`fetchTextureItems`** / **`fetchMaterialClasses`** — полный обход пагинации для сценариев, где нужен весь справочник; **`fetchTextureItemsPage`** / **`fetchMaterialClassesPage`** — быстрые page-запросы для админских списков. |
| `CalculatorPage.tsx` | Калькулятор: **`variant`**, **`CalcPathsProvider`**, **`CalculatorPageInner`**; шаги 1–8 без внешней **`calc-card`**; **`syncCalcStepsTabsWidth`** → **`--calc-steps-tabs-width`** (до «Итог») и **`--calc-steps-panel-width`** (до «Шаг 6», для админки); **`CalcPriceTotalsSlotProvider`**; **`calc-body-with-totals--wide`** (одна колонка); шаг 1 — **`step1Facade`** + **`frame2-card-nav`**; шаг **6** — **`isFrameMortiseHingeSelected()`**; шаг 8 — **`calc-routes-wrap--step8`**. |
| `calculator/calcPathsContext.tsx` | `step`, `home`, `readOnly`; нормализация пути для вкладок. |
| `CalculatorPage.css` | **`.calc-side-panel`**, **`.calc-side-panel-scroll`**, **`--calc-steps-tabs-width`**, **`.calc-totals-inline`**, **`.calc-body-with-totals--wide`**, вкладки **`.calc-step-tab`**. |
| `calculator/frameCalcSession.ts` | **`FRAME_DEFAULT_HEIGHT_MM`**, **`FRAME_DEFAULT_WIDTH_MM`** (500 / 200); **`frameSketchDisplayDims`** (эскиз при 0/пусто); **`FRAME_DIM_FALLBACK_MAX_MM`** (99999); **`frameDimDefaultsFromMaterial`**, **`hasSavedFrameDims`**, **`seedFrameDimsFromMaterial`**, **`effectiveFrameDimMax`**, **`clampFrameDimDigits`**; `isFrameStep2Ready`, **`isFrameStep4Ready`**, **`isFrameMortiseHingeSelected`**, события сессии, **`readFrameDimsMm`**, ключи присадки/петель/ручки, хелперы петель и ручки. |
| `calculator/calculatorCardTiles.tsx` | **`CalculatorCardTileStriped`** (плитка с полосками смены кадра), **`ProfileCardImageTileRow`** (три слота загрузки в формах). |
| `calculator/framePriceEstimate.ts` | Ориентировочная стоимость: **`resolveMaterialPricingUomCode`**, **`pricingCalcModeToUomCode`**, **`parseExcessCoefficient`**, **`unitsPerFacade`**, **`pricedUnitsForMaterial`**, **`materialLineCost`**, **`relatedItemsCalculatorCost`**, **`relatedItemCalculatorCost`**, **`computeFramePriceBreakdown`**. |
| `calculator/calculationFormula.ts` | Безопасная оценка активной формулы: токены классов превращаются в стоимость выбранных клиентом материалов с этим классом; объём через **`materialLineCost`** / **`pricedUnitsForMaterial`** (учитывает **`pricing_calc_mode`** и **`excess_coefficient`**). |
| `calculator/CalcPriceTotals.tsx` | UI итога; **`CalcStepPriceTotals`** (inline в scroll); **`CalcPriceTotalsSlotProvider`**; шаг 1–2 без цифр; **`resolveMaterialPricingUomCode`**. |
| `calculator/TileGearMenu.tsx` | Меню ⚙ на плитке типа профиля/наполнения: portal, **`position: fixed`**, **Редактировать** / **Удалить**. |
| `calculator/sketchFrame.ts` | `resolveMediaUrl`, **`facadeSketchBoxStyle`**, **`facadeSketchScaleY`**, **`facadeSketchAspectRatio`**, **`SKETCH_SCALE_HEIGHT_CAP_MM`**, **`materialTextureLayerStyle`**, **`materialFillingTextureLayerStyle`**, **`SKETCH_FILLING_TEXTURE_OPACITY`**, `sketchFrameInlineStyle`. |
| `calculator/materialTextureLabel.ts` | Текст подписи для плиток цвета/наполнения: после режима **цвет** — **`texture_library_item_name`**, иначе имя файла **`texture_image`**, иначе **`name`**. |
| `calculator/Step2FrameFacade.tsx` | Шаг 2: тип профиля и цвет; **`seedFrameDimsFromMaterial`** после **`fetchMaterial`**; эскиз с fallback **`frameDimDefaultsFromMaterial`**. |
| `calculator/Step2FrameFacade.css` | Сетка **`frame2`**, эскиз, **`.sketch-sheet`** (типографика листа), модалки, плитки. Подключается шагами 3–7. |
| `calculator/Step3FrameSizes.tsx` | Шаг 3: габариты; дефолт из min материала; ограничение ввода min/max; **`facadeSketchBoxStyle`**, чертёж **`frame3-dim-drawing`**. |
| `calculator/Step3FrameSizes.css` | Сетка `frame3`, `.frame3-dim-drawing` (**`--right`**, **`--bottom`**, **`--frame3-dim-label-gap`**), цепочки **`.hinge-chain-dim`** (**`--tracked`**, **`--narrow`**, **`--hinge-chain-label-gap`**), слой **`frame3-hinge-dim-layer`**. |
| `calculator/Step4FrameFilling.tsx` | Шаг 4: **`frame3-title`** «Выберите тип наполнения»; **`admin-heading-row`** с **«+ Добавить тип наполнения»**; ⚙ — **`TileGearMenu`**; до **3** фото (**`CalculatorCardTileStriped`**, **`ProfileCardImageTileRow`**). **«Поиск»** → **`MaterialSearchModal`** (**`multiPick`**). |
| `calculator/Step5FrameSummary.tsx` | Шаг 5: эскиз, **`FrameHingeMortisePanel`** + **`FrameHingeCatalog`**; отдельный заголовок «Итоговый эскиз» убран. «Следующий шаг» → 6 или 7 по **`isFrameMortiseHingeSelected()`**. |
| `calculator/FrameHingeMortisePanel.tsx` | Заголовок **«Присадки»** (**`frame3-title`**); **`FtSelect`** (**`menuStrategy="inline"`**) для вида работ и петель; **`FrameHingeMortisePanel.css`**; **`writeHingeLayout(null)`** при «не требуется». |
| `calculator/FrameHingeCatalog.tsx` | Каталог типов петель (**`calculator-hinge-types`**): как шаги 2 и 4 — **`ProfileCardImageTileRow`**, **`CalculatorCardTileStriped`**, **`MaterialSearchModal`**, **`--profile-type-slim`**, подпись **«Материалы для карточки»**; заголовок секции **«Тип петель»**. |
| `calculator/hingeChainSketchDims.tsx` | Цепочки размеров на эскизе: **`computeHingeChainDims`**, **`HingeChainDimLayer`**, **`useHingeChainSketchDims`**, **`sketchMainDimPlacement`** (шаги 6–7). |
| `calculator/Step6FrameHingeLayout.tsx` | Шаг 6: **`frame3-title`** «Расстояния»; **2…10** отверстий (**`countStr`**, clamp на blur); ввод **№1 от начала / №2+ от конца**; эскиз через **`hingeChainSketchDims`**; редирект при **`!isFrameMortiseHingeSelected()`**. |
| `calculator/Step7FrameHandleHoles.tsx` | Шаг 7: **`frame3-title`** «Отверстия под ручку»; **0…10** отверстий; **`HandleHoleDiameterAdminSelect`** / **`FtSelect`**; эскиз петель + ручки + **`HingeChainDimLayer`** (петли и ручки); гидратация **`useLayoutEffect`**. |
| `calculator/HandleHoleDiameterAdminSelect.tsx` | Админ: справочник диаметров (API **`calculator-handle-hole-diameters`**) — видимость для клиента, добавление/удаление размера. |
| `calculator/Step8FrameResult.tsx` | Шаг 8: форма **`id="step8-contact-form"`**; кнопки **«Отправить»**, **«Открыть PDF»**, **«← Назад»** в **`frame2-card-nav`**; **`createFacadeOrder`**, модалка гостя, **`/my-orders`**; **staff** — mailto; **`buildFrameClientPdfBlob`**; **«Добавить фасад»** в правой колонке. |
| `calculator/frameClientPdf.ts` | PDF шага 8: **один лист** A4 **альбом** — бланк слева, эскиз справа (**`dimsOutsideSketch`**); без заголовка «Эскиз (примерный)» над эскизом. Текстуры — **`pdfDrawMaterialTextureLayer`**. |
| `calculator/pdfSketchDimsDraw.ts` | Размеры в PDF: цепочки (**`CHAIN_DIM_OFFSET_FRAC`**); габарит **ширины** ближе (**`MAIN_WIDTH_DIM_GAP_FRAC`**); **высота** — выноски до **`vCenterX`**; подписи — **`pdfMainLabelPadMm`** / **`pdfMainWidthLabelPadMm`** / цепочки (**`chainKind`**). |
| `calculator/sketchFrame.ts` | **`resolveMediaUrl`**, **`materialTextureLayerStyle`**, **`sketchMaterialOpacity`**, **`SKETCH_FILLING_TEXTURE_OPACITY`** — общая логика текстур UI и PDF. |
| `calculator/Step2MdfFacade.tsx` / `Step2PvcFacade.tsx` | Заглушки шага 2 для МДФ/ПВХ. |
| `index.css` / `App.css` / `AdminApp.css` / **`desktop-layout.css`** | Десктоп-only режим: **`desktop-layout.css`** (min-width 1280, scroll документа); **`mobile.css`** временно не подключается. **`CalculatorPage.css`**: **`calc-side-panel`**, **`--calc-steps-tabs-width`**, **`calc-totals-inline`**. **`#admin-panel-calculator`**: компактный UI, **`--calc-steps-panel-width`**, **`tree-gear-menu--portal`**, шаг 8 — **`step8-result__scroll-pack`**. |

### Папки (левая колонка)

- Выбор: клик по **названию** на боковике; **«Все папки»** — сброс **`selected`**, справа полный список материалов.
- **DnD папки:** перетаскивание строки дерева на другую папку, на **«Все папки»** или на область списка справа при открытой папке — смена **`parent`** (**`PATCH /api/categories/{id}/`**). Подсветка запрёта — классы **`folder-explorer-tree-line--move-blocked`**, **`--drag-source`** (как в **`FolderMoveModal`**).
- **DnD материала:** строка списка (**`mat-list-row`**, **`draggable`**) — сброс на папку в дереве или на **`admin-main-scroll`** при **`selected != null`** (**`PATCH`** **`category`**). На **«Все папки»** drop материала не принимается.
- **Панель над деревом** (**`admin-folder-toolbar`**): создать папку (**`FolderCreateModal`**), переименовать выбранную, удалить выбранную (модалка + **`DELETE`**), импорт/экспорт. **Перемещение папки** — только **DnD** строки дерева (2026-05-12), не через отдельную модалку на этой вкладке.
- **Переименование в строке:** двойной клик по названию не используется; переименование выбранной папки — через иконку на панели или запрос **`folderRenameRequest`** на **`TreeRow`** (inline-инпут при **`targetId`**).
- **Поиск по каталогу из боковой панели материалов** — снят (2026-05-12); **`MaterialSearchModal`** остаётся в **калькуляторе** (шаги 2, 4, каталог петель и т.д.).

### Вкладка «Материалы»: сетка и сценарии

- **Сетка:** **`#admin-panel-materials.admin-body`** — **`aside`** (кнопка **«Все папки»**, дерево **`TreeRow`** с DnD) + **`admin-main-col`** (список). Отдельной правой колонки с формой нет.
- **Шапка списка:** **`h2.admin-h2`** — **«Материалы в папке:»** + имя папки (**`findCategoryNode`**) или **«Материалы: все папки»** при **`selected == null`**.
- **Типографика** (**`AdminApp.css`**): переменные **`--mat-scroll-fs`**, **`--mat-scroll-lh`**, **`--mat-scroll-ls`** на **`#admin-panel-materials.admin-body`**; стиль корня **`.folder-explorer-root`** в **`aside`**.
- **Список:** строка — **`div.mat-list-row`** (**`draggable`** для переноса **материала** в другую папку, **`onDragStart`** с **`DND_MATERIAL`**): клик / Enter / Space — **модалка сопутствующих**; справа **`button.mat-list-gear-btn`** — **модалка карточки** (**`MaterialForm`**); внутри кнопки **`svg`** с иконкой **шестерёнки** (outline **cog-6-tooth**, два **`path`**). **`title`**: «Открыть карточку материала». **«+ Материал»** неактивен без выбранной папки (**`category`** обязателен в API).
- **Сопутствующие (модалка):** **`PATCH`** только **`related_items`**, кнопка **«Сохранить»** в футере.

### Карточка материала (модальное окно)

- Вкладки: **«Общие параметры»** и **«Параметры текстуры»** (SPA, **`MaterialForm`** в **`AdminApp.tsx`**). Блок **ед. измерения + текстура** — сетка **`mat-form-uom-texture-row`**: текстура статусом в одну строку напротив **`FtSelect`** (**`uom_id`**, список из **`fetchUom`**) во второй строке сетки. **Цена**, **округление** (чекбокс + кратность) и **коэффициент избытка** — **`mat-form-price-round-row`** / **`mat-form-rounding-stack`**. Предельные размеры **`min_length`**, **`max_length`**, **`min_width`**, **`max_width`** — обычные поля на вкладке «Общие параметры», без отдельной вкладки «Доп. параметры».
- Строка **`mat-form-note-calc-row`**: двухколоночная сетка — **«Примечание»** (**`textarea.mat-form-note-input`**, половина ширины, высота по блоку флажков справа) | **«Расчёт»** — три взаимоисключающих флажка **`pricing_calc_mode`** (Погонаж / Лист / Штуки); стиль **`mat-form-rounding-check-wrap`**. Режим сохраняется в API и задаёт объём в калькуляторе (см. **`resolveMaterialPricingUomCode`**).
- Оболочка модалки: **`admin-calculations-modal-surface`**, **`admin-material-card-dialog`** — те же **`--mat-scroll-*`**, **`--admin-refs-scale`**, **`--admin-refs-control-radius`** и плотность полей, что у модалки формулы расчёта (**`AdminApp.css`**); см. [PROGRESS.md](PROGRESS.md). Подсказки **`HintButton`** в шапке и у цены **убраны**.
- Поле **`is_active`** в этой форме **не редактируется** (см. [материал](#категории-материалы-папки)); при сохранении значение пробрасывается в API как описано выше.
- **`thickness`:** в UI карточки поля нет, значение по-прежнему участвует в **`PATCH`** из состояния формы (не затирается случайно при редактировании других полей).

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

При загрузке `texture_image` запрос идёт как `multipart/form-data`, и списочные поля (`material_class_ids`, `related_items`) приходят строкой. Сериализатор поддерживает JSON‑строки вида `"[1,2]"` и `"[]"`.

#### Удаление текстуры (важно)

Чтобы **удалить** уже сохранённую текстуру, одной очистки UI недостаточно — нужен явный PATCH:

- `PATCH /api/materials/{id}/` с телом `{"texture_image": null}`

Во фронтенде кнопка **«Убрать текстуру»** делает именно это: очищает локальное превью и при сохранении отправляет `texture_image: null`.

#### Ограничение длины имени файла

В dev/прототипе текстуры могут приходить с длинными именами файлов. Для этого у `texture_image` увеличен `max_length` (миграция `0014`), иначе загрузка может падать с 400.

### Vite и API в dev

- Прокси **`/api`** и **`/media`** → `http://127.0.0.1:8000` (см. **`frontend/vite.config.ts`**).
- **`frontend/.env.development`:** пустой **`VITE_API_ORIGIN`** — браузер шлёт запросы на origin dev-сервера Vite, прокси пересылает на Django. В **production** (Vercel и т.п.) задайте **`VITE_API_ORIGIN`** на публичный URL бэкенда — см. [DEPLOY.md](DEPLOY.md).

---

## Стили (основные CSS-файлы)

- **`index.css`** — глобальные **`--ft-*`**, темы **`[data-theme='dark'|'light']`**, шрифты, scrollbar.
- **`theme.ts` / `ThemeProvider.tsx` / `ThemeToggle.*`** — переключение темы (не CSS, но часть UI-токенов).
- `AdminApp.css` — сетка админки, **`admin-header-top`**, **`admin-section-tabs`**, дерево (**`admin-materials-tree-root`**, **`folder-explorer-tree-line`** на **`TreeRow`**, корень **`folder-explorer-root`** в **`aside`**), **`tree-gear-btn`**, **`tree-gear-menu`**, `admin-modal-*` (в т.ч. **`admin-modal--material-card`**, **`admin-modal--extras`**, **`admin-modal-backdrop--stack-top`** / **`--elevated`**), **`folder-explorer-*`** (в т.ч. в модалке перемещения **текстур**: **`:hover`** у плиток **`--draggable`**, **`folder-explorer-tile--drag-source`**), DnD (**`--move-blocked`**), **`material-search-*`**, **`#admin-panel-materials`** — **`--mat-scroll-*`** на **`admin-body`**, компактные **`admin-aside`** (тулбар папок) и **`mat-list-row`** / **`mat-list-gear-btn`**, форма, **`admin-orders-*`**.
- `App.css` — **`public-shell__main`**, **`public-shell__section-tabs`**, шапка публичного сайта.
- `CalculatorPage.css` — калькулятор: вкладки **`.calc-step-tab`**, **`.calc-side-panel`**, **`--calc-steps-tabs-width`**, **`.calc-totals-inline`**, **`calc-body-with-totals--wide`**, **`calc-routes-wrap--step8`**.
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

`backend/.env` — CORS, `DEBUG`, `SECRET_KEY`, **`DJANGO_ALLOWED_HOSTS`** и т.д.

## Git: несколько удалённых репозиториев

В типичном клоне два **remote**: **`origin`** (основная разработка, чаще HTTPS) и **`customer`** (копия для заказчика, отдельный GitHub-аккаунт). Пуши выполняются **раздельно**: `git push origin main` и `git push customer main` (или алиасы **`push-mine`** / **`push-customer`** в `.git/config` этого репо). У **`customer`** при двух аккаунтах на одном ПК удобен SSH с псевдонимом хоста в `~/.ssh/config` (например **`github.com-furnitech`**) и отдельным ключом; подробности и предупреждение про **`git branch --set-upstream-to=origin/main main`** — в [README.md](../README.md). Подсказки агенту в Cursor: «запуш в origin» / «запуш в customer».

**Деплой фронта на Vercel (репо заказчика):** чтобы **`git push`** без указания remote шёл в **`customer`**, в клоне может быть задано **`remote.pushDefault = customer`** при сохранении **`branch.main.remote = origin`** (тогда **`git pull`** по-прежнему из **`origin`**). Автор коммитов (**`user.name` / `user.email`** в **`git config --local`**) имеет смысл выровнять под GitHub-пользователя репо **`furnitechdev-maker`**, иначе на **Vercel Hobby** деплои могут оказаться в статусе **Blocked** (см. [DEPLOY.md](DEPLOY.md)).

## Деплой (production)

Краткая схема и переменные окружения: **[DEPLOY.md](DEPLOY.md)** (Vercel + Render + Supabase Postgres). Фронт в production использует **`VITE_API_ORIGIN`** для API; URL к загружаемым картинкам сериализатор отдаёт **абсолютными** (**Render `/media/`** или **Supabase CDN** при Storage — см. [SUPABASE_STORAGE.md](SUPABASE_STORAGE.md)).

## Handoff

`py scripts/furnitech_status.py` — шапки документов. Актуальное состояние и чеклист: [PROGRESS.md](PROGRESS.md). План продукта: [PLAN.md](PLAN.md). Классы и формулы расчёта: [CALCULATION_FORMULAS.md](CALCULATION_FORMULAS.md).
