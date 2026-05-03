# Generated manually for Furnitech

from django.db import migrations, models


def seed_handle_diameters(apps, schema_editor):
    CalculatorHandleHoleDiameter = apps.get_model("materials", "CalculatorHandleHoleDiameter")
    for i, mm in enumerate([4, 5, 6, 7, 8, 9, 10, 12, 16, 20]):
        CalculatorHandleHoleDiameter.objects.get_or_create(
            diameter_mm=mm,
            defaults={"client_visible": True, "sort_order": i},
        )


def noop_reverse(apps, schema_editor):
    CalculatorHandleHoleDiameter = apps.get_model("materials", "CalculatorHandleHoleDiameter")
    CalculatorHandleHoleDiameter.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("materials", "0026_calculator_hinge_types"),
    ]

    operations = [
        migrations.CreateModel(
            name="CalculatorHandleHoleDiameter",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("diameter_mm", models.PositiveSmallIntegerField(unique=True, verbose_name="Диаметр, мм")),
                (
                    "client_visible",
                    models.BooleanField(
                        default=True,
                        help_text="Если снято — в публичном калькуляторе этот диаметр в списке не отображается.",
                        verbose_name="Показывать клиенту",
                    ),
                ),
                ("sort_order", models.PositiveIntegerField(default=0, verbose_name="Порядок")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Диаметр отверстия под ручку",
                "verbose_name_plural": "Диаметры отверстий под ручку",
                "ordering": ["sort_order", "diameter_mm"],
            },
        ),
        migrations.RunPython(seed_handle_diameters, noop_reverse),
    ]
