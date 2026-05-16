"""Помощники для абсолютных URL загружаемых файлов (локальный /media, Supabase CDN и т.д.)."""


def absolute_media_url(request, url: str | None) -> str | None:
    if url is None:
        return None
    u = str(url).strip()
    if not u:
        return None
    if u.startswith("http://") or u.startswith("https://"):
        return u
    if request is not None:
        return request.build_absolute_uri(u)
    return u
