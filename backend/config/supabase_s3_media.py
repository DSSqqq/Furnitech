"""
Публичные медиафайлы в Supabase Storage (S3-совместимый API).

Требует django-storages + boto3 и переменные окружения — см. docs/SUPABASE_STORAGE.md.
"""

from __future__ import annotations

import os
from urllib.parse import quote

from storages.backends.s3boto3 import S3Boto3Storage


class SupabasePublicMediaStorage(S3Boto3Storage):
    """Запись объектов через S3 API; `.url()` — публичный URL REST (виден фронту на Vercel)."""

    bucket_name = os.environ["SUPABASE_MEDIA_BUCKET"]
    access_key = os.environ["SUPABASE_S3_ACCESS_KEY"]
    secret_key = os.environ["SUPABASE_S3_SECRET_KEY"]
    endpoint_url = os.environ["SUPABASE_S3_ENDPOINT"]
    region_name = os.environ["SUPABASE_S3_REGION"]
    addressing_style = "path"
    file_overwrite = False
    default_acl = None
    querystring_auth = False
    gzip = False

    def url(self, name: str) -> str:
        base = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
        bn = self.bucket_name
        if base and bn:
            rel = quote(name.lstrip("/"), safe="/")
            return f"{base}/storage/v1/object/public/{bn}/{rel}"
        return super().url(name)
