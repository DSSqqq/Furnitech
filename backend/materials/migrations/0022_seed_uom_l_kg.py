from django.db import migrations


def seed_uom_l_kg(apps, schema_editor):
    Uom = apps.get_model("materials", "UnitOfMeasure")
    for name, short, code in [
        ("Литр", "л", "l"),
        ("Килограмм", "кг", "kg"),
    ]:
        Uom.objects.get_or_create(
            code=code,
            defaults={"name": name, "short_name": short},
        )


def unseed_uom_l_kg(apps, schema_editor):
    Uom = apps.get_model("materials", "UnitOfMeasure")
    Uom.objects.filter(code__in=["l", "kg"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0021_related_quantity_scale_op_per_facade"),
    ]

    operations = [
        migrations.RunPython(seed_uom_l_kg, unseed_uom_l_kg),
    ]

