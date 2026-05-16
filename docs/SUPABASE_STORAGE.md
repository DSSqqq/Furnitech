# Supabase Storage в Furnitech (файлы текстур и материалов)

Стек проекта:

- **Vercel** — только фронт (React). Обращение к **`VITE_API_ORIGIN`** на Render для API и к **публичным URL** объектов из Supabase (обычно `https://xxxx.supabase.co/storage/...`).
- **Render** — Django загружает файлы **сервера через S3-совместимый API** (ключи генерируются в Supabase, хранятся только в секретах Render).
- **Supabase Postgres** — метаданные и строки моделей Django; байты файлов живут отдельно в **Supabase Storage** (bucket).

Код включается флагом **`SUPABASE_MEDIA_ENABLED=true`** на Render (локально можно так же включить для проверки). Реализован класс **`config.supabase_s3_media.SupabasePublicMediaStorage`**: аплоад через S3 API, а в ответах API метод `.url()` отдаёт публичный адрес **`{SUPABASE_URL}/storage/v1/object/public/{bucket}/…`** (удобно для `<img>` на любом домене, в т.ч. Vercel).

## 1. Bucket в Supabase

1. [Dashboard](https://supabase.com/dashboard) → ваш проект → **Storage** → **Create bucket**.
2. Имя, например: `furnitech-media` — его потом задаёте как **`SUPABASE_MEDIA_BUCKET`**.
3. Для превью в админке и калькуляторе нужен **анонимный чтение** объектов или подписанные URL. Проще всего на старте: отметить bucket **Public** при создании (или выдать политику `SELECT` для `authenticated`/`anon`, если не public — тогда понадобятся другие паттерны, не описанные в этом файле).

Путь объекта совпадает с Django `upload_to`: например `texture_library/photo.jpg`.

## 2. Ключи S3 (server-side только)

1. Dashboard → **Project Settings → Storage → S3 connection**.
2. Создайте **S3 Access Keys** (пара логина/пароля). Эти ключи дают доступ к операциям совместимым с S3 и **игнорируют RLS** Storage — использовать **только на Render**, не во фронте.
3. Скопируйте также:
   - **Endpoint** вида  
     `https://<PROJECT_REF>.storage.supabase.co/storage/v1/s3`  
     (использовать именно **`…storage.supabase.co`**, не основной домен проекта — [документ Supabase «S3 Authentication»](https://supabase.com/docs/guides/storage/s3/authentication)).
   - **Region** проекта — строка вида `eu-central-1` (или что покажет интерфейс).

4. Строку **`SUPABASE_URL`** возьмите из **Project Settings → API → Project URL** (например `https://abcdxyzcompany.supabase.co` без завершающего `/`). Она нужна для сборки публичного URL ответов API (**`/storage/v1/object/public/`**).

## 3. Переменные на Render

В Environment Web Service добавьте (названия уже читает Django в `backend/config/settings.py`):

| Переменная | Пример |
|------------|--------|
| `SUPABASE_MEDIA_ENABLED` | `true` |
| `SUPABASE_URL` | `https://YOUR_REF.supabase.co` |
| `SUPABASE_MEDIA_BUCKET` | `furnitech-media` |
| `SUPABASE_S3_ENDPOINT` | `https://YOUR_REF.storage.supabase.co/storage/v1/s3` |
| `SUPABASE_S3_REGION` | как в интерфейсе S3 для проекта |
| `SUPABASE_S3_ACCESS_KEY` | из секции S3 keys |
| `SUPABASE_S3_SECRET_KEY` | из секции S3 keys |

Опционально после перехода на Storage:

| Переменная | Зачем |
|------------|------|
| `DJANGO_SERVE_MEDIA` | Можно **убрать** или оставить `false`: раздача с диска Render для `/media/` не нужна, картинки отдаются с Supabase. |

Перезапустите сервис.

Зависимости: в репозитории уже есть **`django-storages[s3]`** (ставит boto3 для S3-бэкенда).

## 4. Локальная разработка

По умолчанию локально (**`DJANGO_DEBUG=True`**) файлы как раньше пишутся в **`backend/media/`**, пока **`SUPABASE_MEDIA_ENABLED`** не задан или `false`.

Если нужно тестировать тот же bucket с ноутбука — пропишите те же секреты в **`backend/.env`**, включите **`SUPABASE_MEDIA_ENABLED=true`** и временно добавьте в **`STORAGES`** ветку или используйте `DJANGO_DEBUG=False` только для этого эксперимента (или оставляйте нашу ветку `elif SUPABASE_MEDIA_ENABLED` в `settings.py` при `DEBUG`).

Не коммитьте `.env` с ключами.

## 5. Миграция старых файлов с Render

Объекты уже лежали на эфемерном диске Render без Storage:

1. Если копии нет — данные утрачены для старых путей; в БД останутся пути вида `/media/...` — нужно переимпортировать или очистить.
2. Если архив сохранился — синхронизируйте в bucket с сохранением структуры каталогов (`texture_library/...`). Для множества файлов удобен **AWS CLI**, нацеленный на тот же endpoint и ключи (`aws configure` с endpoint и ключами или `docker run` без коммита секретов).

## 6. Как это согласовано с API

После сохранения Django отдаёт в JSON для полей типа **`TextureItem.image`** и эффективного **`texture_image`** у материала **полный HTTPS-URL**. Фронты на Vercel не должны использовать относительный `/media/` к Render без Storage.

В коде добавлен помощник **`absolute_media_url`** (`backend/materials/media_urls.py`): если URL уже абсолютный (Supabase), **не** добавляется лишний origin Render.

## 7. Альтернативы (если не хотите ключи на Render)

- Загрузка **напрямую из браузера** в bucket по **Signed URL**, а Django сохраняет только путь в БД — меньше трафика через Render, сложнее права и валидация.
- Приватный bucket + только **presigned URLs** в ответах — безопаснее, но нужны доработки сериализаторов и срок действия ссылок.

Текущий вариант (публичное чтение + серверная запись ключами S3) — минимально инвазивный для уже существующего DRF multipart API.
