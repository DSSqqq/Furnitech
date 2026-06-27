# Generated manually for required unique article and unique name per folder.
#
# Идемпотентно и устойчиво к боевым данным: перед добавлением UNIQUE-ограничений
# заполняет пустые артикулы и авто-переименовывает дубликаты (артикул и имя в папке),
# чтобы миграция не падала на проде при существующих дублях.

from django.db import migrations, models


def _normalize_articles(Material):
    """Каждый материал получает непустой и уникальный артикул."""
    rows = list(Material.objects.order_by("pk").values_list("pk", "article"))
    # Владелец непустого артикула — материал с минимальным pk среди одинаковых.
    keepers: dict[str, int] = {}
    for pk, article in rows:
        art = (article or "").strip()
        if art and art not in keepers:
            keepers[art] = pk
    used: set[str] = set(keepers.keys())
    # Все, кто пуст или не владелец, получают новый уникальный артикул.
    for pk, article in rows:
        art = (article or "").strip()
        if art and keepers.get(art) == pk:
            continue
        base = f"AUTO-{pk:06d}"
        candidate = base
        i = 2
        while candidate in used:
            candidate = f"{base}-{i}"
            i += 1
        used.add(candidate)
        Material.objects.filter(pk=pk).update(article=candidate)


def _normalize_names(Material):
    """Имя уникально в пределах папки (category). Дубли получают суффикс ' (N)'."""
    used: set[tuple[int, str]] = set()
    rows = list(Material.objects.order_by("pk").values_list("pk", "category_id", "name"))
    for pk, category_id, name in rows:
        nm = (name or "").strip() or "Без названия"
        key = (category_id, nm)
        if key in used:
            base = nm
            i = 2
            while (category_id, nm) in used:
                nm = f"{base} ({i})"
                i += 1
            key = (category_id, nm)
        used.add(key)
        if nm != (name or ""):
            Material.objects.filter(pk=pk).update(name=nm)


def backfill_and_dedup(apps, schema_editor):
    Material = apps.get_model("materials", "Material")
    _normalize_articles(Material)
    _normalize_names(Material)


class Migration(migrations.Migration):

    dependencies = [
        ("materials", "0051_editor_perms_backfill_textures"),
    ]

    operations = [
        migrations.RunPython(backfill_and_dedup, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="material",
            name="materials_material_article_nonempty_uniq",
        ),
        migrations.AlterField(
            model_name="material",
            name="article",
            field=models.CharField(
                db_index=True,
                help_text="Артикул / внутренний код (для сопоставления с учётом, в т.ч. 1С). Уникален в каталоге.",
                max_length=128,
                verbose_name="Артикул",
            ),
        ),
        migrations.AddConstraint(
            model_name="material",
            constraint=models.UniqueConstraint(
                fields=("article",),
                name="materials_material_article_uniq",
            ),
        ),
        migrations.AddConstraint(
            model_name="material",
            constraint=models.UniqueConstraint(
                fields=("category", "name"),
                name="materials_material_category_name_uniq",
            ),
        ),
    ]
