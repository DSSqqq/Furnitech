from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materials", "0040_alter_material_import_export_snapshot"),
    ]

    operations = [
        migrations.CreateModel(
            name="CalculationFormula",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255, verbose_name="Наименование")),
                ("expression", models.CharField(blank=True, max_length=1000, verbose_name="Выражение")),
                ("tokens", models.JSONField(blank=True, default=list, verbose_name="Токены формулы")),
                ("is_active", models.BooleanField(default=False, verbose_name="Активна")),
                ("sort_order", models.PositiveIntegerField(default=0, verbose_name="Порядок")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Формула расчёта",
                "verbose_name_plural": "Формулы расчёта",
                "ordering": ["sort_order", "name"],
            },
        ),
    ]
