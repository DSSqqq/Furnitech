# Generated manually — уникальный код класса материала.

from django.db import migrations, models


def dedupe_material_class_codes(apps, schema_editor) -> None:
    MaterialClass = apps.get_model("materials", "MaterialClass")

    def assign_unique(pk: int) -> str:
        salt = 0
        while True:
            part = f"mc{pk}" + (f"x{salt}" if salt else "")
            code = part[:64]
            if not MaterialClass.objects.filter(code=code).exclude(pk=pk).exists():
                return code
            salt += 1

    for mc in MaterialClass.objects.all().order_by("pk"):
        if not (mc.code or "").strip():
            MaterialClass.objects.filter(pk=mc.pk).update(code=assign_unique(mc.pk))

    from collections import defaultdict

    buckets: dict[str, list[int]] = defaultdict(list)
    for mc in MaterialClass.objects.all().order_by("pk"):
        buckets[mc.code.lower()].append(mc.pk)

    for pks in buckets.values():
        if len(pks) <= 1:
            continue
        for pk in pks[1:]:
            MaterialClass.objects.filter(pk=pk).update(code=assign_unique(pk))


class Migration(migrations.Migration):

    dependencies = [
        ("materials", "0043_calculation_formula_categories"),
    ]

    operations = [
        migrations.RunPython(dedupe_material_class_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="materialclass",
            name="code",
            field=models.SlugField(max_length=64, unique=True, verbose_name="Код"),
        ),
    ]
