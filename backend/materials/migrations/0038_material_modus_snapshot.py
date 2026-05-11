from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0037_calculatorhingetype_card_image_2_3"),
    ]

    operations = [
        migrations.AddField(
            model_name="material",
            name="modus_snapshot",
            field=models.JSONField(
                blank=True,
                default=dict,
                verbose_name="Снимок строки Modus (импорт/экспорт)",
            ),
        ),
    ]
