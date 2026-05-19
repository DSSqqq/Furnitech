from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0044_materialclass_code_unique"),
    ]

    operations = [
        migrations.AddField(
            model_name="material",
            name="pricing_calc_mode",
            field=models.CharField(
                blank=True,
                choices=[
                    ("linear", "Погонаж"),
                    ("sheet", "Лист"),
                    ("piece", "Штуки"),
                ],
                default="",
                help_text="Погонаж — периметр; лист — площадь; штуки — количество.",
                max_length=16,
                verbose_name="Режим расчёта количества",
            ),
        ),
    ]
