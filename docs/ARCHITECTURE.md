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

- **Backend:** `requirements.txt` — Django, DRF, `djangorestframework-simplejwt`, `cors`, `python-dotenv`, **Pillow** (загрузка текстур), **rapidfuzz** (нечёткий поиск по материалам в `MaterialViewSet`).
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
| `/api/auth/token/`, `token/refresh/`, `me/`, **`register/`**, **`admin-users/`**, **`admin-users/<id>/`** | JWT; **`POST /api/auth/token/`** обслуживает **`FurnitechTokenObtainPairView`** — в поле **`username`** можно передать **email** (поиск пользователя по **`email__iexact`**, см. `materials/jwt_auth.py`); публичная регистрация; для сотрудника SPA: список пользователей, PATCH `is_staff`, DELETE учётной записи (см. `materials/user_admin_views.py`) |
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
| **`/my-orders`** | **«Мои заказы»** — **`ClientMyOrdersPage`** (`PublicClientPages.tsx`): **`GET /api/facade-orders/`**; гостю — предложение войти (**`state.from: '/my-orders'`**); у клиента — карточки заказов (**`order_number`** вида **`З-000001`**, краткий статус, **`HintButton`** с длинным пояснением, ссылка на PDF) |
| **`/guide`** | Редирект на **`/`** (резерв; ранее планировалась видеовкладка) |
| `/login` | Вход; при уже активной сессии — редирект (сотрудник → цель или **`/materials`**, клиент → **`/`**). После успеха: **`LoginRoute`** использует **`safePostLoginTarget(state.from, isStaff)`** — только относительные пути без `//` (open redirect); **клиент** может вернуться на калькулятор или **`/my-orders`**; **сотрудник** — ещё на **`/materials`**, **`/calculator`**, **`/orders`**, **`/users`** и т.д. |
| `/register` | Публичная регистрация (`POST /api/auth/register/`), затем переход на **`/login`** с пробросом **`state.from`** (и в ссылке «Уже есть аккаунт») |

Компонент **`PublicShell`** (`App.tsx` + `App.css`): верхняя шапка (бренд; «Вход» / «Регистрация» или подпись **email/логин** + «Админка» / «Выйти»); полоса **`public-shell__section-tabs`** — **«Калькулятор»**, **«Мои заказы»** (пилюли в стиле админских **`admin-section-tab`**); контент — **`<Outlet />`** внутри **`public-shell__main`** (**`overflow-y: auto`**, **`min-height: 0`**) — на десктопе при **`#root { overflow: hidden }`** прокручивается длинный шаг 8 и прочие страницы.

### Только после входа (`AdminApp`)

| URL | Назначение |
|-----|------------|
| `/materials`, `/materials/…` | Материалы: дерево, список, карточка |
| `/textures`, `/textures/…` | **База текстур:** дерево папок (**`TextureCategory`**), список записей (**`TextureItem`**: имя + файл), карточка справа. Компонент **`AdminTexturesPanel`**. Загрузка изображения — только здесь; в карточке материала — выбор из базы (**`TexturePickerModal`**) |
| `/calculator`, `/calculator/frame`, … | Калькулятор **`variant="admin"`** (префикс `/calculator/…`, полный CRUD на шагах 2 и 4) |
| `/orders`, `/orders/…` | **«Заказы»** — **`AdminOrdersPanel`**: таблица **`/api/facade-orders/`**, смена статуса (**`FtSelect`**), PDF (поле **`snapshot`** в ответе API и в Django admin, в таблице SPA не показывается) |
| `/users`, `/users/…` | **Пользователи:** список (`GET /api/auth/admin-users/`), роль **`FtSelect`** (пользователь / админ → `is_staff`), **`DELETE`** учётной записи (ограничения на бэкенде); не путать с `/admin/django/` |

Детализация шагов калькулятора (одинаковая логика для гостя и админа, различаются **префикс URL** и **readOnly**):

- **Шаг 1:** выбор фасада (рамочный / МДФ / ПВХ)
- **Шаг 2:** зависит от фасада; для рамочного — тип профиля и цвет (`Step2FrameFacade`)
- **Шаг 3 (только рамочный):** габариты — `…/frame/size` (`Step3FrameSizes`)
- **Шаг 4 (только рамочный):** наполнение — `…/frame/filling` (`Step4FrameFilling`)
- **Шаг 5 (только рамочный):** итоговый эскиз и присадка под петли — `…/frame/summary` (`Step5FrameSummary`, **`FrameHingeMortisePanel`**, **`FrameHingeCatalog`**)
- **Шаг 6 (только рамочный):** раскладка петель (сторона, число отверстий, расстояния в мм) — `…/frame/hinge-layout` (`Step6FrameHingeLayout`). Доступен, только если на шаге 5 выбраны **«Присадки под петли»** (`**isFrameMortiseHingeSelected()`**); иначе вкладка **неактивна**, маршрут с шага 5 ведёт на шаг 7, прямой заход на URL шага 6 — редирект на ручку.
- **Шаг 7 (только рамочный):** отверстия под ручку (число **0…10**, по умолчанию **0** — ручка не задана; поле можно очистить при вводе, **blur** восстанавливает **0**), диаметр, ориентация, сторона, межосевые — `…/frame/handle-holes` (`Step7FrameHandleHoles`); при **вертикальной** ручке сторона **слева/справа** не может совпадать со стороной петель из шага 6; при **горизонтальной** — то же для **сверху/снизу**. Данные: **`calc_handle_holes`** (см. `frameCalcSession.ts`). При **0** отверстий эскиз показывает только общие габариты (**как шаг 5**: размеры сверху и слева, без цепочек и маркеров петель/ручки).
- **Шаг 8 «Итог» (только рамочный):** сводка, контакты, таблица ориентировочной стоимости, **PDF** — `…/frame/result` (`Step8FrameResult`, **`frameClientPdf.ts`**). **Гость** при «Отправить менеджеру» — модалка (**`admin-modal-*`**, **`createPortal`**) «Войти / Зарегистрироваться» с **`state.from`** на текущий шаг. **Клиент (JWT, не staff):** обязательные имя/телефон/email на публичном калькуляторе (**`readOnly`**, **`step8-form__req`**); **`POST /api/facade-orders/`** (multipart: **`pdf_file`**, **`snapshot`** JSON, контакты), затем **`/my-orders`** (`replace`). **Сотрудник** — по-прежнему **mailto** с текстом заявки.

Префиксы маршрутов внутри калькулятора задаются **`calculator/calcPathsContext.tsx`** (`CalcPathsProvider`, хук **`useCalcPaths()`**: `step('frame/size')`, `step('frame/hinge-layout')`, `home`, `readOnly`).

Примечание: это маршрутизация SPA, не Django URL.

### Калькулятор (UI, соглашения)

| Элемент | Описание |
|---------|----------|
| Вкладки шагов | **Шаг 1** — `NavLink` на **`home`** из контекста (`/` или `/calculator`), с **`end`**. **Шаг 2** — кнопка на текущий фасад (`step(facade)`). **Шаг 3** и **Шаг 4** — только при `facade === 'frame'` и **`isFrameStep2Ready()`**; переходы на `step('frame/size')` и `step('frame/filling')`. **Шаг 5** — при `facade === 'frame'` и **`isFrameStep4Ready()`**. **Шаг 6** — в разметке всегда для рамочного фасада после шага 4; **активен** только если ещё **`isFrameMortiseHingeSelected()`** (присадка под петли на шаге 5). **Шаг 7** и **«Итог» (шаг 8)** — при `facade === 'frame'` и **`isFrameStep4Ready()`**. Подсказки `title` при отключённых вкладках. |
| Сессия рамочного шага 2→3 | `localStorage`: `calc_frame_type_id`, `calc_frame_color_id`. Запись после гидрации и при валидной паре «тип профиля + цвет» в ответе API; очистка при сбросе выбора. Событие **`calc-frame-session`** (`frameCalcSession.ts`) + подписка для `useSyncExternalStore` в `CalculatorPage` — обновление вкладки «Шаг 3» без перезагрузки. Готовность: **`isFrameStep2Ready()`**. Шаг 3 дополнительно: **`calc_frame_height_mm`**, **`calc_frame_width_mm`** (если пусто после сброса — дефолт **500×200** мм, константы **`FRAME_DEFAULT_HEIGHT_MM`** / **`FRAME_DEFAULT_WIDTH_MM`**), **`calc_frame_qty`**; при изменении — `notifyFrameCalcSession()`. Шаг 2: эскиз **`.sketch`** использует **`facadeSketchBoxStyle`** по **`readFrameDimsMm()`** и тем же дефолтам; подписка через **`useSyncExternalStore`**, снимок — строка **`"h|w"`** (не объект), иначе бесконечный ререндер. Шаг 4 при записи выбора наполнения — тоже **`notifyFrameCalcSession()`**. |
| Отверстия под ручку (шаг 7) | **`calc_handle_holes`**: JSON **`HandleHolesPersisted`** — число отверстий (в хранилище только **≥ 1**; **0** в UI означает «ручка не задана», **`writeHandleHoles(null)`**), **`diameterMm`**, **`bushings`**, **`orientation`** (`vertical` \| `horizontal`), **`side`**, **`offsetStartMm`**, **`spanMm`** (межосевые). Валидация **`validateHandleHoles`**; конфликт с петлями: **`isHandleSideBlockedByHinges`** (вертикаль ↔ лево/право, горизонталь ↔ верх/низ). Сброс в **`clearFrameCalculatorStorage()`**; участие в **`readCalculatorPriceConfigKey`**. Гидрация формы из `localStorage` — **`useLayoutEffect`** в **`Step7FrameHandleHoles`**. |
| Присадка и петли (шаг 5–6) | Ключи: **`calc_frame_mortise`**, **`calc_hinge_source`**, **`calc_hinge_type_id`**, **`calc_hinge_material_id`**; раскладка: **`calc_hinge_layout`** — JSON **`HingeLayoutPersisted`**: `side` (`left`/`right`/`top`/`bottom`), `count` (1…10), **`positionsMm`** — **абсолютные** мм от **начала** выбранной кромки (верх/низ: от левого края; лево/право: от верхнего). В UI шага 6 расстояния вводятся **парами** (зеркально от начала и конца); пересчёт в абсолюты — **`hingeUserInputsToAbsoluteMm`**, обратно — **`hingeAbsoluteToUserInputStrings`**; стартовые позиции по длине кромки **L** — **`defaultHingeAbsPositionsMm(L, count)`** (**n+1** равных отрезка, петля **i** на **(i+1)·L/(n+1)** мм от начала кромки). Участвуют в **`readCalculatorPriceConfigKey`**; сброс в **`clearFrameCalculatorStorage()`**. При **смене стороны** петель раскладка в хранилище сбрасывается (**`writeHingeLayout(null)`**). При выборе на шаге 5 **«Присадка не требуется»** — тоже **`writeHingeLayout(null)`** (**`FrameHingeMortisePanel`**). Валидация: **`validateHingePositions`**, длина кромки **`hingeEdgeLengthMm`**, габариты **`readFrameDimsMm`**. |
| Шаг 5 доступность | Шаг 5 доступен **только** если выбран материал наполнения на шаге 4: `localStorage.calc_filling_material_id` валиден. Проверка: **`isFrameStep4Ready()`** в `frameCalcSession.ts`. При прямом открытии URL шага 5 — редирект на шаг 4. |
| Шаг 6 без готовности шага 4 | `Step6FrameHingeLayout`: редирект на шаг 4 при **`!isFrameStep4Ready()`** (аналогично шагу 5). |
| Шаг 6 без присадки под петли | `Step6FrameHingeLayout`: редирект на шаг 7 при **`!isFrameMortiseHingeSelected()`**. |
| Шаг 3 / 4 без сессии шага 2 | `Step3FrameSizes` / `Step4FrameFilling`: редирект на **`step('frame')`** (`replace`), если **`isFrameStep2Ready()`** ложно. |
| Эскиз | Общий вид `.sketch`: отрисовка текстуры через **`materialTextureLayerStyle`** (`sketchFrame.ts`) на внутренних слоях `.sketch-frame-texture` и `.sketch-paper-texture`. Это позволяет применять **`tex_opacity`** и `tex_mirror`, не ломая “чертёжные” псевдоэлементы `.sketch-paper::before/::after`. Пропорции и вертикальный масштаб блока ( **`aspectRatio`**, CSS‑переменная **`--sketch-scale-y`**) задаются **`facadeSketchBoxStyle(H_mm, W_mm)`** — одинаково на **шаге 2** и **шаге 3** (по габаритам из сессии или дефолту 500×200). Для применения `tex_*` на шаге 2 и 4 догружается полный материал через `fetchMaterial(id)` (т.к. summary-ответы калькулятора не содержат `tex_*`). Текстура изображения в эскизе растягивается на всю область (`background-size: 100% 100%`); `tex_rotation_deg` в режиме эскиза сейчас игнорируется. |
| Чертёжные размеры (шаг 3) | Блок **`frame3-drawing`** обнимает `.sketch`; **`frame3-dim-drawing`**: выносные пунктирные линии, размерная линия со стрелками, подписи мм; `z-index` выше листа эскиза. Модификаторы **`--right`** / **`--bottom`** задают расположение основного габарита **напротив** стороны с петлями, чтобы линии не накладывались. |
| Петли на эскизе (шаг 5–6) | Маркеры у **внешнего** края: класс **`sketch--hinge-markers`**, `overflow: visible` для слоя маркеров. Цепочка выносных размеров вдоль стороны петель: **`.hinge-chain-dim`** (вариант **`--narrow`** для коротких сегментов — сплошная линия без стрелок по краям сегмента), слой **`frame3-hinge-dim-layer`**, ядро **`frame3-drawing-core`** (**`Step3FrameSizes.css`**). Подписи сегментов цепочки: поворот **−90°** слева от стороны петель и **+90°** справа; смещается **только текст** подписи. Вертикальный габарит справа: стрелки на всю высоту, подпись по центру. |
| Левая панель формы | Класс **`.calc-side-panel`** (`CalculatorPage.css`): фиксированная высота от `100dvh`, вертикальная прокрутка при переполнении. Используется на шаге 1 (обёртка сетки фасадов), **`frame2-card`**, **`frame3-left`**, заглушках МДФ/ПВХ. Шаг 1: ограничение ширины **`#calc-step-panel-1 .calc-card`** под первую колонку сетки рамочного шага. На шаге 8 у блока контактов **`calc-side-panel` не используется**, чтобы не фиксировать высоту колонки. |
| Шаг 8 «Итог» (вёрстка) | В админке контент вкладки калькулятора ограничен **`#admin-panel-calculator`** (**`AdminApp.css`**): без выхода за область заказов. Обёртка маршрутов с **`calc-routes-wrap--step8`**; внутри **`Step8FrameResult`** блок **`step8-result__scroll-pack`** объединяет прокрутку двух правых панелей и нижних действий (**`Step8FrameResult.css`**). На **публичном** сайте дополнительно вся колонка калькулятора может прокручиваться в **`public-shell__main`** (см. **`App.css`**). |
| Ориентировочная цена | Панель **`CalcPriceTotals`** справа (`CalculatorPage.tsx` + **`CalculatorPage.css`**: `.calc-body-with-totals`, `.calc-totals-*`). На **шагах 1–2** только подсказка, суммы нет (цена появляется с шага 3 после ввода габаритов). Подписка на **`calc-frame-session`** и `storage`, снимок ключей через **`readCalculatorPriceConfigKey`** (`frameCalcSession.ts`). Данные: `fetchMaterial` по `calc_frame_color_id` и при необходимости `calc_filling_material_id`. При выборе типа фасада на шаге 1 вызывается **`clearFrameCalculatorStorage()`**, чтобы не подтягивать прошлую конфигурацию. |
| Расчёт суммы | Модуль **`calculator/framePriceEstimate.ts`**. Ед. изм. по `uom.code` (`m2`, `m`/`mp`, `pc`), при пустом `code` — эвристика (**`resolvePricingUomCode`**). **Объём на все фасады** \(N\) — как раньше: м², м.п. периметра, шт. **Профиль:** `base_price × geomColor`. **Сопутствующие** (и у цвета профиля, и у наполнения): **поштучно** по полю **`quantity_scale`** строки (`follow_parent` — × тот же множитель, что у «родителя» строки: у профиля это `geomColor`, у наполнения — `geomFill`; `per_facade` — только × \(N\); `use_related_uom` — × объём по ед. изм. **сопутствующего** материала и габаритам). См. **`relatedItemsCalculatorCost`**. **Наполнение:** `base_price × geomFill` + сопутствующие наполнения той же поштучной логикой. **Стекло:** у материала наполнения должна быть ед. изм. м² (код или подпись), иначе площадь шага 3 не войдёт в цену. |

Дополнительно (UI):

- Глобальный фон: текстура дерева задаётся CSS‑переменной `--ft-wood-texture` (сейчас `frontend/src/assets/wood-premium.png`) и рисуется на уровне `#root::before` как `background-size: cover` (без тайлинга/швов).
- На **шаге 2** и шагах **3–4** эскиз мягко меняет пропорции по \(H×W\) через **`facadeSketchBoxStyle`**: `aspectRatio` смешивается с дефолтным (≈ 0.714) и ограничивается, чтобы не ломать подписи/кнопки. Высота эскиза слегка масштабируется через **`--sketch-scale-y`** (ограничено диапазоном).
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
| `/api/categories/{id}/` | GET, PUT, PATCH, DELETE | **JWT.** `PATCH` — переименование и т.д.; **DELETE** — **каскадное** удаление поддерева и всех материалов в нём (см. [категории](#категории-материалы-папки)). |
| `/api/texture-categories/` | GET, POST | База текстур: папки. `GET ?tree=1` — дерево. **JWT + DjangoModelPermissions** (без анонимного доступа). |
| `/api/texture-categories/{id}/` | GET, PUT, PATCH, DELETE | **JWT.** Каскадное удаление поддерева и **`TextureItem`**; у материалов **`texture_item`** → **`SET_NULL`**. |
| `/api/texture-items/`, `/api/texture-items/{id}/` | CRUD | Пагинация 100. **JWT + model perms.** List: **`?category=`**. Тело: JSON или multipart (**`image`**). Каталог файлов: **`texture_library/`**. |
| `/api/uom/`, `/api/uom/{id}/` | CRUD | **JWT.** |
| `/api/material-classes/`, `/{id}/` | CRUD, DELETE | **JWT.** |
| `/api/materials/`, `/{id}/` | CRUD, list | Пагинация 100. **GET — анонимно; запись — JWT + model perms.** Параметры list (см. **`MaterialViewSet.get_queryset`**): **`category`** (id папки; при задании **`folder_name`** игнорируется), **`search`** (одна строка — **имя или артикул**, гибкий поиск), **`folder_name`** (по имени **`MaterialCategory`**), **`article`**, **`name`**, **`price`** (точное **`base_price`**, запятая нормализуется), **`material_class_ids`** (id через запятую — **хотя бы один** из классов у материала). Логика «гибкого» текста — **`materials/flexible_search.py`** (токены, **`icontains`**, при необходимости **rapidfuzz** на подмножестве pk). |
| `/api/calculator-profiles/`, `/{id}/` | CRUD | Профили калькулятора (профиль = материал) + «цвета». **Только JWT.** |
| `/api/calculator-profile-types/`, `/{id}/` | CRUD | Типы профилей + цвета (материалы) + флаги + `card_image`. **GET — анонимно; запись — JWT + model perms.** |
| `/api/calculator-filling-types/`, `/{id}/` | CRUD | Типы наполнения + материалы внутри типа (шаг 4 калькулятора). **GET — анонимно; запись — JWT + model perms.** |
| `/api/calculator-hinge-types/`, `/{id}/` | CRUD | Типы петель + материалы внутри типа (каталог петель на шагах 5–6). **GET — анонимно; запись — JWT + model perms.** |
| `/api/calculator-handle-hole-diameters/`, `/{id}/` | CRUD | Диаметры отверстий под ручку (шаг 7): **`client_visible`**, сортировка. **GET — анонимно**, в ответе только строки с **`client_visible=true`**; полный список и **`catalog_scope":"full"`** — при JWT и праве **`change_calculatorhandleholediameter`** (у группы **«Редактор материалов»** права на всё приложение `materials` обновляются миграциями вроде **`0028_editor_perms_handle_hole_diameter`**). **PATCH** — JWT + model perms. |
| `/api/facade-orders/`, `/{id}/` | GET, POST, PATCH | Заказы калькулятора (**`FacadeOrder`**, миграция **`0029_facade_orders`**). **POST** — **JWT**, multipart (**`pdf_file`**, **`snapshot`** строка JSON, контакты); создавать могут только **не staff / не superuser** (валидация в **`FacadeOrderCreateSerializer`**). **GET** list/retrieve — **JWT**; queryset: **свои** заказы у клиента, **все** у staff. **PATCH** — только **`IsAdminUser`**, поле **`status`** (`not_confirmed`, `confirmed`, `in_production`, `ready`, **`completed`**). В ответе: **`order_number`**, **`pdf_url`**, **`status_display`**, **`snapshot`**, **`client_username` / `client_email`** (для админки). |

**Пагинация list:** `count`, `next`, `previous`, `results`. Для **`calculator-handle-hole-diameters`** в теле ответа также может быть **`catalog_scope`**: `full` \| `client`.

### Поля тела/ответа: материал (дополнительно к полям модели)

- `material_class_ids` — список id.
- `related_items` — при передаче ключа в теле запроса: полная замена списка. В каждой строке: **`quantity_scale`**: `follow_parent` \| `per_facade` \| `use_related_uom` (по умолчанию `follow_parent`).
- `article` — строка, при записи **обрезка**; **уникальность** у непустого значения (БД + валидация в сериализаторе), см. [материал](#категории-материалы-папки).
- `thickness`, `min_length`, `max_length`, `min_width`, `max_width`, `designation`, `cut_coeff`, `calc_type` — **«Доп. параметры»** (задел для калькулятора и ограничений габаритов).
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
- **Активен (`is_active`, default `True`):** булево «карточка действующая / выключенная» для **будущих** сценариев (клиент, фильтры, отчёты). В веб-админке **список материалов** пока **не** фильтрует по `is_active` — при смене бизнес-правил добавить запрос/фильтр.

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
- **`TextureCategoryViewSet`**, **`TextureItemViewSet`** — только **JWT + `DjangoModelPermissions`**; дерево папок `?tree=1`; у материалов в queryset добавлено **`select_related` / `prefetch_related`** на **`texture_item`** для корректного **`texture_image`** в summary.
- **`RegisterView`** (`user_admin_views.py`) — публичная регистрация: **`create_user(..., is_staff=False, is_superuser=False)`**; попытка передать **`is_staff`** или **`is_superuser`** как **`true`** в теле запроса → **400**; после создания при необходимости принудительный сброс флагов.
- `MaterialSerializer` — `validate_article`, замена `related_items` в `create`/`update`, обработка `IntegrityError` по артикулу.
- `CalculatorProfileViewSet` — профили калькулятора (профиль = `Material`) + «цвета профиля» (материалы).
- `CalculatorProfileTypeViewSet` — типы профилей + цвета (материалы) + флаги и картинка; JSON и multipart/form-data.
- `CalculatorFillingTypeViewSet` — типы наполнения + связанные материалы (шаг 4).
- `CalculatorHingeTypeViewSet` — типы петель + связанные материалы (шаги 5–6); модели **`CalculatorHingeType`** / **`CalculatorHingeTypeMaterial`** (миграция **`0026_calculator_hinge_types`**, см. [PROGRESS](PROGRESS.md)).
- `CalculatorHandleHoleDiameterViewSet` — справочник диаметров для шага 7; модель **`CalculatorHandleHoleDiameter`** (миграции **`0027_calculator_handle_hole_diameters`**, **`0028_editor_perms_handle_hole_diameter`**); в сериализаторе **`diameter_mm`** задаётся только при **создании**.
- **`FacadeOrderViewSet`** — заказы шага 8: **`IsAuthenticated`** на list/create/retrieve; **`get_queryset`** фильтрует по **`user`** для не‑staff; **`partial_update`** — **`IsAdminUser`** + **`FacadeOrderStaffUpdateSerializer`** (**`status`**); **`create`** — **`FacadeOrderCreateSerializer`** (статус по умолчанию не подтверждён). Парсеры: multipart + JSON.

### Модель `FacadeOrder` (кратко)

- Поля: **`user`**, **`status`** (`TextChoices`: не подтверждён / подтверждён / в процессе сборки / готов к выдаче / **завершён**), контакты формы (**`contact_*`**), **`snapshot`** (JSONField), **`pdf_file`** (`FileField`, `facade_orders/pdf/%Y/%m/`), **`created_at` / `updated_at`**. Зарегистрирована в **`/admin/django/`**.

---

## Фронтенд: модули и поведение

| Модуль | Роль |
|--------|------|
| `App.tsx` | `/login` (**`LoginRoute`**, **`safePostLoginTarget`**); **`AdminApp`** на `/materials/*`, `/calculator/*`, `/orders/*`, `/users/*` (**`AdminRoute`**); родитель **`/`** — **`PublicShell`** с вложенными маршрутами: индекс и **`*`** — **`CalculatorPage variant="public"`**, **`my-orders`**, **`guide`** → **`/`**. |
| `PublicClientPages.tsx` | **`ClientMyOrdersPage`** (**`fetchFacadeOrders`**, статусы + **`HintButton`**), **`isPublicCalculatorRoute`**, **`PublicShellOutletContext`**. |
| `AdminApp.tsx` | Шапка: **`admin-header-top`** + **`admin-section-tabs`**. Сетка материалов; калькулятор **`variant="admin"`**; вкладка **«Заказы»** — **`AdminOrdersPanel`**. Папки: **`FolderCreateModal`**, **`FolderMoveModal`** (DnD перенос, **`updateCategory`**); **«Поиск»** — **`MaterialSearchModal`**. |
| `AdminOrdersPanel.tsx` | Таблица заказов и **`FtSelect`** статусов (**в т.ч. «Завершён»**), PDF; без колонки просмотра **`snapshot`**. |
| `FolderCreateModal.tsx` | Окно «Создать папку» в стиле Windows-Explorer: левая колонка — дерево с раскрытием, правая — сетка плиток (📁 папки, 📄 материалы из **`fetchMaterials`** с кешем), хлебные крошки, поле имени, кнопки «Отмена» / «Создать»; портал в **`document.body`**, классы **`admin-modal--explorer`** + **`folder-explorer-*`**. |
| `FolderMoveModal.tsx` | «Переместить папку»: то же дерево; **перетаскивание строки** источника на цель или корень; **`PATCH`** категории с **`parent`**. |
| `MaterialSearchModal.tsx` | Поиск материалов: фильтры, дерево (**`category`**), таблица с **чекбоксами** в последней колонке; **«Добавить (N)»** / **«Закрыть»**; **`onPick(materials: Material[])`** по **«Добавить»**; **`fetchMaterialsFiltered`**; стили таблицы — **`AdminApp.css`** (**`material-search-result-line`**, **`material-search-result-check`**). |
| `MaterialExtrasPanel.tsx` + **`MaterialExtrasPanel.css`** | Сопутствующие (колонка **«Масштаб»**: `quantity_scale`); предпросмотр без габаритов + текстовые подсказки к калькулятору. |
| `api.ts` | `apiFetch` (Bearer при наличии токена) + калькулятор и **`facade-orders`**: **`createFacadeOrder`**, **`fetchFacadeOrders`**, **`patchFacadeOrderStatus`**; **`fetchMaterialsFiltered`**, **`searchMaterials`** (параметр **`search`**). |
| `CalculatorPage.tsx` | Калькулятор: **`variant`**, **`CalcPathsProvider`**, маршруты шагов 1–8 (рамочный), вкладки, `frameCalcSession`; шаг **6** активен при **`isFrameStep4Ready()`** и **`isFrameMortiseHingeSelected()`**; сетка **`calc-body-with-totals`** + **`CalcPriceTotals`**; при выборе фасада на шаге 1 — **`clearFrameCalculatorStorage`**. На шаге 8 — класс **`calc-routes-wrap--step8`** на обёртке маршрутов. |
| `calculator/calcPathsContext.tsx` | `step`, `home`, `readOnly`; нормализация пути для вкладок. |
| `CalculatorPage.css` | Вкладки `.calc-step-tab`; **`.calc-side-panel`**; ширина карточки шага 1; **`.calc-body-with-totals`**, **`.calc-totals-*`** (панель итога). |
| `calculator/frameCalcSession.ts` | **`FRAME_DEFAULT_HEIGHT_MM`**, **`FRAME_DEFAULT_WIDTH_MM`** (дефолт габаритов шага 3: 500 / 200); `isFrameStep2Ready`, **`isFrameStep4Ready`**, **`isFrameMortiseHingeSelected`**, **`FRAME_CALC_SESSION_EVENT`**, `subscribeFrameCalcSession`, `notifyFrameCalcSession`, **`clearFrameCalculatorStorage`**, **`readCalculatorPriceConfigKey`**, **`readFrameDimsMm`**, ключи присадки/петель/**`calc_hinge_layout`** и **`calc_handle_holes`**; типы **`HingeMountSide`**, **`HingeLayoutPersisted`**, **`HandleHolesPersisted`**, **`HandleOrientation`**; петли: **`hingeEdgeLengthMm`**, **`hingePairPartnerIndex`**, **`hingeMeasuresFromEdgeStart`**, **`defaultHingeAbsPositionsMm`**, **`hingeUserInputsToAbsoluteMm`**, **`hingeAbsoluteToUserInputStrings`**, **`readHingeLayout`** / **`writeHingeLayout`**, **`validateHingePositions`**; ручка: **`isHandleSideBlockedByHinges`**, **`readHandleHoles`** / **`writeHandleHoles`**, **`handleHoleCentersMm`**, **`validateHandleHoles`**. |
| `calculator/framePriceEstimate.ts` | Ориентировочная стоимость: **`relatedItemsCalculatorCost`**, `computeFramePriceBreakdown`. |
| `calculator/CalcPriceTotals.tsx` | UI итога; шаг 1 без цифр; fallback габаритов — **`FRAME_DEFAULT_*`**. |
| `calculator/sketchFrame.ts` | `resolveMediaUrl`, **`facadeSketchBoxStyle`**, **`materialTextureLayerStyle`**, `sketchFrameInlineStyle`. |
| `calculator/Step2FrameFacade.tsx` | Шаг 2 (рамочный): плитки типов; **⚙** на плитке — **`tree-gear-menu`**: редактирование типа, удаление с модалкой **`admin-modal`** (**`createPortal`**). Формы создания/редактирования типа: **`frame2-create-grid--file-status-pair`** (кнопка файла + поле **`frame2-file-name`** в одной строке с колонкой «Поиск»). **«Поиск»** → **`MaterialSearchModal`** (пакетно), эскиз **`facadeSketchBoxStyle`**, **`useSyncExternalStore`** (**`"h|w"`**); при **`readOnly`** скрыт CRUD. |
| `calculator/Step2FrameFacade.css` | Сетка `frame2`, эскиз, модалки, плитки, **`frame2-create-grid--file-status-pair`**, **`tile-gear-wrap`**, кнопки **`frame2-file-btn`** / **`frame2-material-tree-search-btn`**, поле **`frame2-file-name`**; **`tile-gear`** (чёрный / белая иконка). Подключается шагами 3–4. |
| `calculator/Step3FrameSizes.tsx` | Шаг 3: габариты (**дефолт 500×200** при пустом хранилище), чертёжные размеры, эскиз через **`facadeSketchBoxStyle`**. |
| `calculator/Step3FrameSizes.css` | Сетка `frame3`, `.frame3-dim-drawing` (**`--right`**, **`--bottom`**), цепочки **`.hinge-chain-dim`** (**`--narrow`** и др.) для выносных размеров петель, слой **`frame3-hinge-dim-layer`**. |
| `calculator/Step4FrameFilling.tsx` | Шаг 4: типы наполнения; **«Поиск»** → **`MaterialSearchModal`** для материалов типа (пакетно); формы создать/редактировать тип — **`frame2-create-grid--file-status-pair`** (тот же **`Step2FrameFacade.css`**); при редактировании — **`fetchMaterial`** по составу типа; при **`readOnly`** без CRUD. |
| `calculator/Step5FrameSummary.tsx` | Шаг 5: итоговый эскиз, блок присадки (**`FrameHingeMortisePanel`**); «Следующий шаг» на шаг 6 или 7 в зависимости от **`isFrameMortiseHingeSelected()`**. |
| `calculator/FrameHingeMortisePanel.tsx` | Выбор «не требуется» / присадка, источник петель (заказчик / производство), каталог или текст про уточнение у сотрудника; при «Не требуется» — **`writeHingeLayout(null)`**. |
| `calculator/FrameHingeCatalog.tsx` | Каталог типов петель с API **`calculator-hinge-types`** (как наполнение на шаге 4); формы создать/редактировать тип — **`frame2-create-grid--file-status-pair`** + стили **`Step2FrameFacade.css`**. |
| `calculator/Step6FrameHingeLayout.tsx` | Шаг 6: сторона, **до 10** отверстий, ввод расстояний **парами** (зеркально), дефолты **`defaultHingeAbsPositionsMm`** (равномерно по **L**), сброс **`writeHingeLayout(null)`** при смене стороны; превью с маркерами и цепочками **`.hinge-chain-dim`**; редирект на шаг 7, если **`!isFrameMortiseHingeSelected()`**. |
| `calculator/Step7FrameHandleHoles.tsx` | Шаг 7: количество **0…10** (строка **`countStr`**, default **0**, blur на пустом → **0**); в админке при **`catalog_scope === 'full'`** — **`HandleHoleDiameterAdminSelect`**, иначе **`FtSelect`**; ориентация и сторона, межосевые; эскиз петель + **`.sketch-handle-pin`**; при **0** отверстий — габариты на эскизе как шаг 5 (**`useLayoutEffect`** для гидрации). |
| `calculator/HandleHoleDiameterAdminSelect.tsx` | Админ: справочник диаметров (API **`calculator-handle-hole-diameters`**) — видимость для клиента, добавление/удаление размера. |
| `calculator/Step8FrameResult.tsx` | Шаг 8: сводка, контакты, цена; **клиент** — **`createFacadeOrder`**, модалка для гостя, редирект **`/my-orders`**; **staff** — mailto; PDF — **`buildFrameClientPdfBlob`**; **`preloadFramePdfFont`**. |
| `calculator/frameClientPdf.ts` | Многостраничный PDF (**jspdf**, **jspdf-autotable**); первая страница: строка «Раскладка петель» только если **`includeHingeLayoutRow`**; Noto Sans TTF — кэш base64 + **`addFileToVFS`** / **`addFont`** на каждый **`jsPDF`**; загрузка с **`/fonts/NotoSans-Regular.ttf`** или CDN. |
| `calculator/Step2MdfFacade.tsx` / `Step2PvcFacade.tsx` | Заглушки шага 2 для МДФ/ПВХ. |
| `index.css` / `App.css` / `AdminApp.css` | На **десктопе** (≥1025px) у `html`/`body`/`#root` — **`overflow: hidden`**, **`max-height: 100dvh`**: скролл **внутри** колонок админки или в **`public-shell__main`** на клиентском сайте. Для **`#admin-panel-calculator`** — высота/overflow вкладки калькулятора; на шаге 8 в админке — **`step8-result__scroll-pack`**. |

### Папки (левая колонка)

- Выбор: клик по **названию** на боковике.
- **Шестерёнка (⚙):** по **наведению** на строку появляется; кнопка **`.tree-gear-btn`** — **чёрный** фон, **белая** иконка (см. **`AdminApp.css`**). Меню: **Переименовать** (inline-редактирование), **Переместить…** (**`FolderMoveModal`**: DnD **со строки** перемещаемой папки на цель или **«Все папки (корень)»**; `PATCH` **`parent`**), **Удалить…** — далее **модальное окно** (портал в `body`) с предупреждением о **каскадном** удалении; только после **«Удалить»** — `DELETE` на API.
- **Создание (`FolderCreateModal`)**: кнопка **«+ Создать папку»** (`admin-folder-create-btn`). Открывает **`admin-modal--explorer`**: хлебные крошки, слева дерево, справа сетка плиток (**`fetchMaterials`** с кешем), поле имени, **«Отмена» / «Создать»**. После успеха — перезагрузка дерева, раскрытие родителя, выбор новой папки.
- **Поиск материалов:** кнопка **«Поиск»** (`admin-folder-search-btn`) — **`MaterialSearchModal`**: фильтры, дерево слева (**`category`**), таблица с **чекбоксами**; **«Добавить»** передаёт массив в **`onPick`** — открывается карточка **первого** материала.

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

При загрузке `texture_image` запрос идёт как `multipart/form-data`, и списочные поля (`material_class_ids`, `related_items`) приходят строкой. Сериализатор поддерживает JSON‑строки вида `"[1,2]"` и `"[]"`.

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

- `AdminApp.css` — сетка админки, **`admin-header-top`**, **`admin-section-tabs`**, дерево, **`tree-gear-btn`** (чёрная кнопка, белая ⚙), **`tree-gear-menu`**, `admin-modal-*`, **`folder-explorer-*`**, стили DnD переноса (**`folder-explorer-tree-line--drag-source`** и т.д.), **`material-search-*`** (модалка поиска), список материалов, форма, **`admin-orders-*`** (панель заказов).
- `App.css` — **`public-shell__main`**, **`public-shell__section-tabs`**, шапка публичного сайта.
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

`backend/.env` — CORS, `DEBUG`, `SECRET_KEY`, **`DJANGO_ALLOWED_HOSTS`** и т.д.

## Handoff

`py scripts/furnitech_status.py` — шапки документов. Актуальное состояние и чеклист: [PROGRESS.md](PROGRESS.md). План продукта: [PLAN.md](PLAN.md).
