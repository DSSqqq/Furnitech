"""Гибкий поиск: нормализация регистра/пробелов, слова (AND), нечёткое совпадение (опечатки)."""

from __future__ import annotations

import re
from django.db.models import Q, QuerySet
from rapidfuzz import fuzz

_WS = re.compile(r"\s+")


def _materials_pk_subset(qs: QuerySet) -> QuerySet:
    """
    Тот же набор материалов по pk, без select_related/prefetch.
    Иначе .only(...).iterator() на queryset с select_related('category') даёт FieldError в Django.
    """
    model = qs.model
    return model._default_manager.filter(pk__in=qs.order_by().values("pk").distinct())


def normalize_text(s: str) -> str:
    s = (s or "").strip().casefold()
    return _WS.sub(" ", s)


def _min_fuzzy_score(needle: str) -> int:
    n = len(needle)
    if n <= 2:
        return 70
    if n <= 4:
        return 76
    return 82


def apply_flexible_charfield_filter(
    qs: QuerySet,
    field: str,
    raw: str,
    *,
    max_scan: int = 4500,
) -> QuerySet:
    """
    Фильтр по одному текстовому полю модели Material.
    Сначала подстроки без учёта регистра (токены через пробел — все должны встретиться).
    Если пусто — нечёткое сравнение rapidfuzz (partial_ratio / token_set_ratio).
    """
    needle = normalize_text(raw)
    if not needle:
        return qs

    qs = _materials_pk_subset(qs)

    tokens = [t for t in needle.split(" ") if t]
    if not tokens:
        return qs

    q = Q()
    for t in tokens:
        q &= Q(**{f"{field}__icontains": t})
    strict = qs.filter(q)
    if strict.exists():
        return strict

    min_score = _min_fuzzy_score(needle)
    base = qs
    prefix = needle[: min(3, len(needle))]
    if prefix:
        cand = base.filter(**{f"{field}__icontains": prefix})
        if cand.exists():
            base = cand

    if base.count() > max_scan:
        base = base.order_by("pk")[:max_scan]

    min_ts = max(55, min_score - 10)
    matched: list[int] = []
    only_fields = ["id", field]
    for m in base.only(*only_fields).iterator(chunk_size=400):
        val = normalize_text(getattr(m, field, None) or "")
        if not val:
            continue
        if (
            fuzz.partial_ratio(needle, val) >= min_score
            or fuzz.token_set_ratio(needle, val) >= min_ts
        ):
            matched.append(m.pk)
    if not matched:
        return qs.none()
    return qs.filter(pk__in=matched)


def apply_folder_name_filter(qs: QuerySet, raw: str) -> QuerySet:
    """Материалы в папках, у которых имя категории гибко совпадает с запросом."""
    from .models import MaterialCategory

    needle = normalize_text(raw)
    if not needle:
        return qs

    tokens = [t for t in needle.split(" ") if t]
    if not tokens:
        return qs

    q = Q()
    for t in tokens:
        q &= Q(name__icontains=t)
    strict_ids = list(MaterialCategory.objects.filter(q).values_list("pk", flat=True))
    if strict_ids:
        return qs.filter(category_id__in=strict_ids)

    min_score = _min_fuzzy_score(needle)
    min_ts = max(55, min_score - 10)
    prefix = needle[: min(3, len(needle))]
    cats = MaterialCategory.objects.only("id", "name").all()
    if prefix:
        cand = MaterialCategory.objects.filter(name__icontains=prefix).only("id", "name")
        if cand.exists():
            cats = cand

    matched_cat: list[int] = []
    for c in cats.iterator(chunk_size=300):
        val = normalize_text(c.name or "")
        if not val:
            continue
        if (
            fuzz.partial_ratio(needle, val) >= min_score
            or fuzz.token_set_ratio(needle, val) >= min_ts
        ):
            matched_cat.append(c.pk)
    if not matched_cat:
        return qs.none()
    return qs.filter(category_id__in=matched_cat)


def apply_flexible_search_name_or_article(qs: QuerySet, raw: str) -> QuerySet:
    """Параметр ?search= — совпадение по наименованию или артикулу (как раньше, но гибче)."""
    needle = normalize_text(raw)
    if not needle:
        return qs

    qs = _materials_pk_subset(qs)

    tokens = [t for t in needle.split(" ") if t]
    if not tokens:
        return qs

    q_name = Q()
    q_art = Q()
    for t in tokens:
        q_name &= Q(name__icontains=t)
        q_art &= Q(article__icontains=t)
    strict = qs.filter(q_name | q_art)
    if strict.exists():
        return strict.distinct()

    min_score = _min_fuzzy_score(needle)
    min_ts = max(55, min_score - 10)
    prefix = needle[: min(3, len(needle))]
    base = qs
    if prefix:
        cand = qs.filter(Q(name__icontains=prefix) | Q(article__icontains=prefix))
        if cand.exists():
            base = cand

    max_scan = 4500
    if base.count() > max_scan:
        base = base.order_by("pk")[:max_scan]

    matched: list[int] = []
    for m in base.only("id", "name", "article").iterator(chunk_size=400):
        n = normalize_text(m.name or "")
        a = normalize_text(getattr(m, "article", None) or "")
        ok = False
        if n and (
            fuzz.partial_ratio(needle, n) >= min_score
            or fuzz.token_set_ratio(needle, n) >= min_ts
        ):
            ok = True
        if not ok and a and (
            fuzz.partial_ratio(needle, a) >= min_score
            or fuzz.token_set_ratio(needle, a) >= min_ts
        ):
            ok = True
        if ok:
            matched.append(m.pk)
    if not matched:
        return qs.none()
    return qs.filter(pk__in=matched)
