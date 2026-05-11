# Деплой: Vercel (фронт) + Render (Django) + Supabase (PostgreSQL)

Целевая схема:

| Сервис | Роль |
|--------|------|
| **Vercel** | Сборка и хостинг React (Vite): публичный калькулятор и админ-SPA |
| **Render** | Gunicorn + Django REST API, миграции, (опционально) раздача загруженных файлов |
| **Supabase** | Управляемый **PostgreSQL** для всех таблиц Django (материалы, пользователи, заказы и т.д.) |

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
