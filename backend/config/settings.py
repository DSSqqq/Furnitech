import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import quote

from dotenv import load_dotenv

try:
    import dj_database_url
except ImportError:  # до pip install -r requirements.txt
    dj_database_url = None

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() in ("1", "true", "yes")
ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get(
        "DJANGO_ALLOWED_HOSTS",
        "127.0.0.1,localhost,0.0.0.0,[::1]",
    ).split(",")
    if h.strip()
]

_csrf = os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "")
CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf.split(",") if o.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "materials",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
if not DEBUG:
    MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
        # Снижает OperationalError: database is locked при одновременном входе и запросах
        "OPTIONS": {
            "timeout": 30,
        },
    }
}


def _postgres_url_from_discrete_env() -> str | None:
    """Собрать URI без ручного quote пароля (удобно для Render: отдельные секреты)."""
    host = (os.environ.get("DATABASE_HOST") or os.environ.get("PGHOST") or "").strip()
    if not host:
        return None
    user = (os.environ.get("DATABASE_USER") or os.environ.get("PGUSER") or "postgres").strip()
    password = os.environ.get("DATABASE_PASSWORD") or os.environ.get("PGPASSWORD") or ""
    port = (os.environ.get("DATABASE_PORT") or os.environ.get("PGPORT") or "5432").strip()
    dbname = (os.environ.get("DATABASE_NAME") or os.environ.get("PGDATABASE") or "postgres").strip()
    base = (
        f"postgresql://{quote(user, safe='')}:{quote(password, safe='')}"
        f"@{host}:{port}/{dbname}"
    )
    if "supabase" in host.lower():
        base += "?sslmode=require"
    elif os.environ.get("DATABASE_SSLMODE", "").strip().lower() in ("require", "1", "true", "yes"):
        base += "?sslmode=require"
    return base


# Supabase / Render: DATABASE_URL **или** отдельные переменные (см. DEPLOY.md).
_raw_database_url = os.environ.get("DATABASE_URL", "").strip()
_parts_database_url = _postgres_url_from_discrete_env()
_database_url_candidates: list[str] = []
if _raw_database_url:
    _database_url_candidates.append(_raw_database_url)
if _parts_database_url and _parts_database_url not in _database_url_candidates:
    _database_url_candidates.append(_parts_database_url)

if _database_url_candidates:
    if dj_database_url is None:
        raise ImportError(
            "Задана конфигурация PostgreSQL, но не установлен пакет dj-database-url. "
            "Выполните: pip install -r requirements.txt"
        )
    _last_parse_error: BaseException | None = None
    for _candidate in _database_url_candidates:
        try:
            DATABASES["default"] = dj_database_url.parse(
                _candidate,
                conn_max_age=int(os.environ.get("DATABASE_CONN_MAX_AGE", "600")),
                conn_health_checks=True,
            )
            _last_parse_error = None
            break
        except dj_database_url.ParseError as exc:
            _last_parse_error = exc
    if _last_parse_error is not None:
        raise RuntimeError(
            "Не удалось разобрать строку подключения к Postgres (ParseError). "
            "Варианты: (1) Закодируйте пароль в URI: "
            "py scripts/quote_pg_password_for_url.py \"ПАРОЛЬ\" — см. docs/DEPLOY.md. "
            "(2) Удалите неверный DATABASE_URL и задайте на Render отдельно: "
            "DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_PORT, DATABASE_NAME "
            "(пароль можно вставлять как есть)."
        ) from _last_parse_error
    engine = DATABASES["default"].get("ENGINE", "")
    if "postgresql" in engine:
        if os.environ.get("DATABASE_PGBOUNCER", "").lower() in ("1", "true", "yes"):
            DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "Europe/Moscow"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

if not DEBUG:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
        },
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "UPDATE_LAST_LOGIN": True,
}

_cors = os.environ.get("CORS_ALLOWED_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173")
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors.split(",") if o.strip()]
