# Furnitech — прогресс (обновляйте в конце сессии)

**Последнее обновление:** 2026-05-16 (опциональный **Supabase Storage** для медиафайлов; текстуры на проде; **`MaterialForm`**; мобильная вёрстка — см. блоки ниже).

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
- **Корень дерева** «База текстур»: **`folder-explorer-tree-item--materials-root`** + кнопка раскрытия **`▾/▸`** (**`texturesRootTreeExpanded`**); **`selected == null`** ⇒ список текстур пуст (по контракту API нужен **`?category=`**), заголовок справа — **«Текстуры: база текстур»**. Выбор папки: **`GET /api/texture-items/?category={id}`**, заголовок — **«Текстуры в папке: {имя}»**.
- **Дерево:** **`TextureTreeRow`** переписан на **`folder-explorer-tree-*`** классы (вместо устаревших **`tree-line` / `tree-link` / `tree-gear-menu`**). Меню **⚙** на строке убрано — действия с папкой только через тулбар (как в «Материалах»). Inline-переименование сохранено через **`folderRenameRequest`** + **`useLayoutEffect`** в **`TextureTreeRow`**.
- **Список текстур:** **`mat-list-table mat-list-table--textures`** с легендой (**`Превью` / `Наименование`**); каждая строка — **`mat-list-row mat-list-row--texture`** + **`button.mat-list-gear-btn`** (та же иконка **cog-6-tooth**, что у материалов). Клик по строке/Enter/Space или клик по шестерёнке — открывают **карточку текстуры** в модалке. Миниатюра в строке уменьшена до **28×28** (правило **`#admin-panel-textures .mat-list-tex-thumb`**), сетка строки — **`32px minmax(0, 1fr)`** (перебивает дефолт 52px у **`.mat-list-table--textures`** через **`!important`**).
- **Карточка текстуры:** теперь в портале — **`createPortal`** + **`admin-modal admin-modal--explorer admin-modal--material-card`**, секция **`admin-panel admin-panel--in-material-modal`**; форма **`TextureCardForm`** прежняя (имя + файл + предпросмотр + удаление с подтверждением через **`admin-modal-backdrop--stack-top`** / **`admin-modal--elevated`**). При сохранении **`onSaved`** учитывает смену **`category`** (текстура исчезает из текущего списка, если переехала).
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
