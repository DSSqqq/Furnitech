from django.db import migrations


def seed_uom(apps, schema_editor):
    Uom = apps.get_model("materials", "UnitOfMeasure")
    for name, short, code in [
        ("Метр погонный", "м.п.", "m"),
        ("Штука", "шт", "pc"),
        ("Квадратный метр", "м²", "m2"),
    ]:
        Uom.objects.get_or_create(
            code=code,
            defaults={"name": name, "short_name": short},
        )


def unseed(apps, schema_editor):
    Uom = apps.get_model("materials", "UnitOfMeasure")
    Uom.objects.filter(code__in=["m", "pc", "m2"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_uom, unseed),
    ]
