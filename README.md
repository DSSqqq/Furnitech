# Furnitech

Калькулятор для магазина: админка (база материалов, заказы — в плане) и клиентский конфигуратор (позже). Стек: **Django + DRF** + **React (Vite)**.

## Быстрый старт

1. **Python** (в корне, рекомендуется venv):

   ```text
   py -m venv .venv
   .\.venv\Scripts\pip install -r requirements.txt
   .\.venv\Scripts\python backend\manage.py migrate
   .\.venv\Scripts\python backend\manage.py runserver
   ```

2. **Фронт** (другой терминал):

   ```text
   cd frontend
   npm install
   npm run dev
   ```

   Откройте URL из вывода Vite; запросы к `/api` проксируются на `http://127.0.0.1:8000`.

   **Главная страница (`/`)** — публичный **калькулятор** (подбор фасада без входа: только выбор вариантов, без создания/редактирования справочников). **Вход для сотрудников** — `/login`; после входа открываются **`/materials`**, **`/calculator`**, **`/orders`** (веб‑админка в `AdminApp`).

   В шапке веб‑админки (после входа) есть вкладки: **Материалы**, **Калькулятор**, **Заказы** (заглушка).

### Кто куда заходит

| Роль | Интерфейс | Доступ |
|------|-----------|--------|
| Посетитель / клиент | **Веб‑приложение**, маршрут **`/`** | Публичный калькулятор: чтение типов профилей, материалов, наполнения через API (GET без JWT). |
| Заказчик / контент | **Веб‑приложение** (Vite), **`/login` → `/materials`** | Справочники материалов и полный калькулятор в админке; без Django admin, если не staff. |
| Разработчик / владелец | **Django admin** | Суперпользователь: всё, включая пользователей по URL `/admin/django/` |

Пользователь **без** `is_staff` в группе **«Редактор материалов»** может работать с материалами в веб‑приложении, но **не** зайдёт в Django admin (там нужен staff).

Создать такого пользователя:

```text
.\.venv\Scripts\python backend\manage.py create_materials_editor email@site.com "" "ПарольСложный"
```

(второй аргумент — email, можно оставить пустым; тогда подставится логин.)

3. **Django admin** (пользователи, полный контроль БД): <http://127.0.0.1:8000/admin/django/> — только для суперпользователя / staff. Создание: `py backend\manage.py createsuperuser`

## Документация

| Файл | Содержание |
|------|------------|
| [docs/PLAN.md](docs/PLAN.md) | План этапов продукта (админка / клиент / 1С) |
| [docs/PROGRESS.md](docs/PROGRESS.md) | **Текущий прогресс** — что сделано, чеклист, типовые сбои (обновляйте в конце сессии) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Стек, каталоги, REST API (в т.ч. **анонимное чтение** для калькулятора), модели, маршруты SPA, UI |

Подробные таблицы API, правил удаления папок, **артикула** и **`is_active`**, вёрстки и UI — в [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); **текущий прогресс и чеклист** — в [docs/PROGRESS.md](docs/PROGRESS.md).

## UI / дизайн (тёмная тема + дерево)

Во фронтенде внедрена единая дизайн‑система в стиле «тёмный премиум» (чёрный фон + золотой акцент) + текстура дерева на заднем плане.

### Где настраивать

- **Токены темы, шрифты, скроллбар:** `frontend/src/index.css`
  - CSS переменные `--ft-*`
  - `--ft-wood-texture` → `frontend/src/assets/wood.png`
  - глобальный стиль полосы прокрутки (`::-webkit-scrollbar*`, `scrollbar-color`)
- **Глобальный фон (дерево “за всеми секциями”):** `frontend/src/App.css`
  - `#root::before` рисует текстуру под всем приложением
  - `#root::after` — затемнение градиентом к низу (если включено)
- **Админка (контейнеры, формы, кнопки, select):** `frontend/src/AdminApp.css`
- **Калькулятор (карточки/итоги/шаги):** `frontend/src/CalculatorPage.css`
  - локальные стили шагов: `frontend/src/calculator/Step2FrameFacade.css`, `Step3FrameSizes.css`

### Админка: сопутствующие и операции (MaterialExtrasPanel)

В разделе **Материалы** блок **`MaterialExtrasPanel`** (сопутствующие/операции/предв. оценка) выводится в отдельной панели в центральной колонке (не перекрывает список/форму на узких экранах).

- Компонент: `frontend/src/MaterialExtrasPanel.tsx` (+ стили `MaterialExtrasPanel.css`)
- Хост-панель в админке: `frontend/src/AdminApp.tsx` + `frontend/src/AdminApp.css`
- Внутри панели есть вкладки: **Сопутствующие** / **Операции**

### Формат чисел (без .000)

Для отображения и значений в полях ввода используется формат:
- если дробная часть нулевая → показываем без неё (`200.000` → `200`)
- иначе до 3 знаков после запятой, без хвостовых нулей

Реализация: `frontend/src/floatInput.ts` (`formatNumberForUi`, `formatDecimalStringForUi`, `normalizeDecimalForInput`).

## Handoff для другого агента

Из корня репозитория:

```text
py scripts/furnitech_status.py
```

В Cursor: skill **furnitech-handoff** (`.cursor/skills/furnitech-handoff/`) — напоминание читать `docs/PROGRESS.md` и запускать эту команду.
