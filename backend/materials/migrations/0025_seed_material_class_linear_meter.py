from django.db import migrations


def seed_material_class_linear_meter(apps, schema_editor):
    MaterialClass = apps.get_model("materials", "MaterialClass")
    MaterialClass.objects.get_or_create(
        code="linear_m",
        defaults={"name": "Метр погонный"},
    )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0024_seed_uom_linear_meter"),
    ]

    operations = [
        migrations.RunPython(seed_material_class_linear_meter, noop_reverse),
    ]
