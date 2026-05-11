"""Кодирует пароль Postgres для вставки в DATABASE_URL (между `user:` и `@host`).

Пример URI после кодирования:
  postgresql://postgres.xxx:ЗАКОДИРОВАННЫЙ_ПАРОЛЬ@aws-0-....supabase.com:5432/postgres
"""
import sys
from urllib.parse import quote

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print('Usage: py scripts/quote_pg_password_for_url.py "YOUR_DB_PASSWORD"', file=sys.stderr)
        sys.exit(1)
    print(quote(sys.argv[1], safe=""))
