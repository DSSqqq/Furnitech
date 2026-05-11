"""Случайный DJANGO_SECRET_KEY для Render / production (не коммитьте вывод)."""
import secrets

print(secrets.token_urlsafe(48))
