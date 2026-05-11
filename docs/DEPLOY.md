# Деплой: Vercel (фронт) + Render (Django) + Supabase (PostgreSQL)

Целевая схема:

| Сервис | Роль |
|--------|------|
| **Vercel** | Сборка и хостинг React (Vite): публичный калькулятор и админ-SPA |
| **Render** | Gunicorn + Django REST API, миграции, (опционально) раздача загруженных файлов |
| **Supabase** | Управляемый **PostgreSQL** для всех таблиц Django (материалы, пользователи, заказы и т.д.) |

## Репозиторий заказчика на GitHub + бесплатные тарифы

Ниже — целевой сценарий: **код в организации/аккаунте заказчика**, деплой с **Free** планов.

### Код на GitHub заказчика

1. Актуальный `main` должен быть в репозитории заказчика (например `furnitechdev-maker/Furnitech_Calc`). Локально: `git push customer main` (см. [README.md](../README.md), remote **`customer`**).
2. **Render** и **Vercel** при первом подключении просят установить **GitHub App** и выбрать репозиторий. Если репозиторий в **организации**, владелец org должен **разрешить** доступ приложению Render/Vercel к этой org (**Settings → Third-party access** или запрос в интерфейсе GitHub).
3. Ветка по умолчанию для автодеплоя обычно **`main`**.

### Бесплатные ограничения (кратко)

| Сервис | На что обратить внимание |
|--------|---------------------------|
| **Render (Free)** | Web Service **засыпает** после простоя; первый запрос после сна — **долгий** (десятки секунд). Лимит часов в месяц — по [тарифам Render](https://render.com/pricing). Файлы на диске **не постоянные** без Persistent Disk. |
| **Vercel (Hobby)** | Обычно достаточно для статики/Vite SPA; лимиты по сборкам и bandwidth — в документации Vercel. |
| **Supabase (Free)** | Лимиты по размеру БД, трафику, количеству проектов — в [pricing Supabase](https://supabase.com/pricing). Для Django нужен только **Postgres** (строка `DATABASE_URL`). |

### MCP (Cursor) и чей это аккаунт

Подключённые **MCP-серверы** Render / Vercel / Supabase ходят в API **того аккаунта**, для которого вы сохранили **токены или OAuth** в настройках Cursor. Они **не привязаны** к репозиторию автоматически.

- Если токены **ваши**, а прод — на **аккаунте заказчика**: агент через MCP увидит **ваши** проекты, не их (если только заказчик не выдал вам доступ в ту же команду).
- Чтобы MCP отражал **инфраструктуру заказчика**, в Cursor нужно использовать **их** API keys / подключение **их** аккаунта (по согласованию и политике безопасности). Иначе проще: **шаги в браузере** под логином заказчика по этому документу, MCP — для подсказок.

### Рекомендуемый порядок (заказчик или вы под его учёткой)

1. **GitHub:** на ветке `main` в репо заказчика лежит нужный коммит.  
2. **Supabase** (аккаунт заказчика): новый проект → `DATABASE_URL` (Direct `5432` или pooler + `DATABASE_PGBOUNCER`).  
3. **Render** (аккаунт заказчика): Blueprint из `render.yaml` **или** Web Service; в Environment — секреты из таблиц ниже; после деплоя — `createsuperuser`.  
4. **Vercel** (аккаунт заказчика): проект, **Root Directory** `frontend`, `VITE_API_ORIGIN` = URL Render без `/` в конце.  
5. **Render:** обновить `CORS_ALLOWED_ORIGINS` и `DJANGO_CSRF_TRUSTED_ORIGINS` на URL Vercel → перезапуск.

## Порядок, если аккаунты уже созданы

Делайте **строго по шагам** — от этого зависит, пройдёт ли сборка на Render.

### Шаг 1 — Supabase (только база)

1. **New project** → дождитесь статуса «Healthy».
2. **Project Settings → Database**:
   - Скопируйте **URI** (режим **Direct**, порт **5432**) для долгоживущего бэкенда на Render.  
   - Если URI с **pooler** и порт **6543** — на Render добавьте **`DATABASE_PGBOUNCER=true`**.
3. Пароль в URI должен быть **URL-кодирован**, если в нём есть `@`, `#`, `%` и т.п. (иначе миграции упадут). В Python:  
   `from urllib.parse import quote; quote("ваш_пароль", safe="")`
4. Нигде в git не сохраняйте полную строку — только в **Environment** на Render.

#### Ошибка на Render: `dj_database_url.ParseError` / «not a valid url»

Supabase копирует пароль в URI как есть. Если в пароле есть **`@` `#` `%` `:` `+`** и другие спецсимволы, **`dj-database-url`** не сможет разобрать строку.

**Что сделать:** закодируйте **только пароль** (не весь URI):

```text
py scripts/quote_pg_password_for_url.py "ваш_сырой_пароль_из_Supabase"
```

Подставьте **вывод команды** в `DATABASE_URL` на место пароля (между последним `:` перед хостом и символом `@`).

Пример: было `postgresql://postgres.abc:pa@ss#word@host...` → пароль заменить на результат `quote`, например `pa%40ss%23word`.

**Проще на Render:** не используйте `DATABASE_URL`, а задайте **отдельные** переменные (пароль копируется из Supabase **без** ручного кодирования):

| Переменная | Пример |
|------------|--------|
| `DATABASE_HOST` | `db.xxxxx.supabase.co` (из Supabase, вкладка Database) |
| `DATABASE_PORT` | `5432` (direct) или `6543` (pooler — тогда ещё `DATABASE_PGBOUNCER=true`) |
| `DATABASE_USER` | часто `postgres` или `postgres.xxxxx` |
| `DATABASE_PASSWORD` | пароль проекта |
| `DATABASE_NAME` | обычно `postgres` |

При хосте с `supabase` в имени к строке автоматически добавляется `sslmode=require`. Переменную **`DATABASE_URL`** в этом случае **удалите** или оставьте пустой, чтобы не мешала.

### Шаг 2 — Render (бэкенд)

1. **New → Blueprint** (укажите репозиторий с файлом `render.yaml`) **или** **Web Service** вручную с командами из раздела ниже.
2. **До первого успешного деплоя** в **Environment** добавьте минимум:

| Переменная | Значение |
|------------|----------|
| `DATABASE_URL` | URI из Supabase |
| `DJANGO_SECRET_KEY` | Случайная строка 50+ символов: `py scripts/generate_django_secret.py` |
| `DJANGO_DEBUG` | `False` |
| `DJANGO_ALLOWED_HOSTS` | Имя хоста сервиса, например `furnitech-backend.onrender.com` (без `https://`) |
| `CORS_ALLOWED_ORIGINS` | Временно `http://127.0.0.1:5173` **или** сразу URL Vercel, когда будет |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Те же origin, что и CORS, через запятую, **со схемой** `https://...` |

3. Дождитесь **успешного build** (в логах: `migrate` без ошибок, gunicorn слушает порт).
4. Откройте в браузере:  
   `https://ВАШ-СЕРВИС.onrender.com/api/calculator-profile-types/`  
   Должен вернуться **JSON** (список типов), без HTML-ошибки.
5. **Shell** на Render (или локально с тем же `DATABASE_URL`):  
   `python backend/manage.py createsuperuser`

### Шаг 3 — Vercel (фронт)

1. **Add New… → Project** → репозиторий.
2. **Root Directory:** `frontend`
3. **Environment Variables:**  
   `VITE_API_ORIGIN` = `https://ВАШ-СЕРВИС.onrender.com` (**без** слэша в конце).
4. Deploy. Скопируйте выданный URL, например `https://furnitech-xxx.vercel.app`.

### Шаг 4 — связать фронт и бэк

1. В **Render → Environment** обновите:
   - `CORS_ALLOWED_ORIGINS` = `https://ваш-проект.vercel.app` (несколько — через запятую).
   - `DJANGO_CSRF_TRUSTED_ORIGINS` = то же.
2. **Manual Deploy** (или сохранение env само перезапустит сервис).
3. На Vercel откройте сайт, войдите в админку — в консоли браузера не должно быть **CORS errors**.

### Файлы в репозитории

- `render.yaml` — чертёж сервиса (регион `frankfurt`, health check на публичный API).
- `runtime.txt` — версия Python для Render.
- `frontend/vercel.json` — SPA fallback.

## Авторизация (текущая версия кода)

- Вход и API по-прежнему **Django + SimpleJWT** (`/api/auth/token/`, пользователи в таблицах `auth_user` и связанных).
- **Supabase Auth** (magic link, соцсети) в код **ещё не встроен** — база Supabase используется как **хостинг Postgres**. Переезд логина на Supabase Auth — отдельный этап (другой формат токенов, синхронизация пользователей с Django).

## 1. Supabase: база данных

1. Создайте проект на [supabase.com](https://supabase.com).
2. **Settings → Database** возьмите строку подключения:
   - **Direct connection** (порт `5432`) — удобно для Render (долгоживущий процесс).
   - Либо **Transaction pooler** (порт `6543`, host `…pooler.supabase.com`) — для PgBouncer в режиме transaction задайте в Render переменную **`DATABASE_PGBOUNCER=true`** (в коде включается `DISABLE_SERVER_SIDE_CURSORS`).
3. Пароль — тот, что задавали для пользователя БД; в строке URL экранируйте спецсимволы в пароле.

Строка вида:

```text
postgresql://postgres.xxxx:ВАШ_ПАРОЛЬ@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

Сохраните как секрет **`DATABASE_URL`** на Render (и не коммитьте в git).

## 2. Render: бэкенд Django

1. **New → Web Service**, подключите репозиторий.
2. Либо используйте [Blueprint](https://render.com/docs/blueprint-spec) из корня (`render.yaml`), либо задайте вручную:
   - **Build command:**  
     `pip install -r requirements.txt && python backend/manage.py collectstatic --noinput && python backend/manage.py migrate`
   - **Start command:**  
     `cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
3. **Environment** (минимум):

| Переменная | Пример / заметка |
|------------|------------------|
| `DJANGO_DEBUG` | `False` |
| `DJANGO_SECRET_KEY` | Длинная случайная строка |
| `DJANGO_ALLOWED_HOSTS` | `your-service.onrender.com` (без `https://`) |
| `DATABASE_URL` | Строка из Supabase |
| `DATABASE_PGBOUNCER` | `true` только если используете pooler :6543 |
| `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app` (через запятую, если несколько) |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Те же полные origin, что и для CORS |
| `DJANGO_SERVE_MEDIA` | `true` только если осознанно раздаёте `/media/` с диска сервиса (см. ниже) |

4. После деплоя создайте суперпользователя (Render **Shell** или одноразовая команда):  
   `python backend/manage.py createsuperuser`

### Загрузки (картинки материалов, текстуры)

На бесплатном Render файловая система **эфемерная**: после перезапуска загрузки пропадут, если не подключён **Persistent Disk** или внешнее хранилище (S3, Supabase Storage и т.д.). Сейчас в коде:

- при **`DJANGO_DEBUG=False`** раздача `/media/` включается только если **`DJANGO_SERVE_MEDIA=true`**;
- для production с постоянными файлами лучше спланировать **Supabase Storage** или аналог и отдельный PR.

## 3. Vercel: фронтенд

1. **New Project** → тот же (или форк) репозиторий.
2. **Root Directory:** `frontend`
3. **Framework Preset:** Vite (или «Other», если нужно вручную: Build `npm run build`, Output `dist`).
4. **Environment Variables:**

| Имя | Значение |
|-----|----------|
| `VITE_API_ORIGIN` | Публичный URL Render **без** завершающего `/`, например `https://furnitech-backend.onrender.com` |

5. Деплой. Домен Vercel добавьте в **`CORS_ALLOWED_ORIGINS`** и **`DJANGO_CSRF_TRUSTED_ORIGINS`** на Render (полный origin, `https://…`).

Файл `frontend/vercel.json` задаёт SPA-fallback (все пути → `index.html`).

## 4. Локальная проверка «как в проде»

- Бэкенд: в `backend/.env` временно укажите `DATABASE_URL` на Supabase, `DJANGO_DEBUG=False`, `CORS`/`ALLOWED_HOSTS` под ваши origin.
- Фронт: `frontend/.env` с `VITE_API_ORIGIN=http://127.0.0.1:8000` или URL Render.

## 5. Чеклист после первого запуска

- [ ] Миграции на Render прошли без ошибок.
- [ ] `GET https://…onrender.com/api/calculator-profile-types/` отдаёт JSON без авторизации (как в dev).
- [ ] С фронта Vercel логин и запросы к API работают (нет CORS в консоли).
- [ ] Созданы пользователи / суперпользователь.

## См. также

- [README.md](../README.md) — быстрый старт в dev.
- [ARCHITECTURE.md](ARCHITECTURE.md) — API и модели.
