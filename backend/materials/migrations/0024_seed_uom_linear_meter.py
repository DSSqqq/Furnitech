from django.db import migrations


def seed_linear_meter(apps, schema_editor):
    Uom = apps.get_model("materials", "UnitOfMeasure")
    Uom.objects.get_or_create(
        code="mp",
        defaults={
            "name": "Погонный метр",
            "short_name": "м.п.",
        },
    )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0023_uom_catalog"),
    ]

    operations = [
        migrations.RunPython(seed_linear_meter, noop_reverse),
    ]
