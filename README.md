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

   Откройте URL из вывода Vite; запросы к `/api` проксируются на `http://127.0.0.1:8000`. Сначала откроется **вход в веб‑админку** (база материалов).

  В шапке веб‑админки есть вкладки верхнего уровня: **Материалы**, **Калькулятор** (заготовка), **Заказы** (заглушка).

### Кто куда заходит

| Роль | Интерфейс | Доступ |
|------|-----------|--------|
| Заказчик / контент | **Веб‑приложение** (Vite) | Только справочники материалов по API; без Django |
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
| [docs/PLAN.md](docs/PLAN.md) | План этапов продукта |
| [docs/PROGRESS.md](docs/PROGRESS.md) | **Текущий прогресс** — что сделано, чеклист, типовые сбои (обновляйте в конце сессии) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Стек, каталоги, REST API, модели, фронт, запуск |

Подробные таблицы API, правил удаления папок, **артикула** и **`is_active`**, вёрстки и UI (вкладки, шестерёнка, модалка) — в [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); краткая сводка, глоссарий полей и чеклист — в [docs/PROGRESS.md](docs/PROGRESS.md).

## Handoff для другого агента

Из корня репозитория:

```text
py scripts/furnitech_status.py
```

В Cursor: skill **furnitech-handoff** (`.cursor/skills/furnitech-handoff/`) — напоминание читать `docs/PROGRESS.md` и запускать эту команду.
