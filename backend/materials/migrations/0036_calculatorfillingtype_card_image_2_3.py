from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0035_calculatorprofiletype_card_image_2_3"),
    ]

    operations = [
        migrations.AddField(
            model_name="calculatorfillingtype",
            name="card_image_2",
            field=models.ImageField(
                blank=True,
                max_length=300,
                null=True,
                upload_to="filling_types/",
                verbose_name="Картинка 2 (файл)",
            ),
        ),
        migrations.AddField(
            model_name="calculatorfillingtype",
            name="card_image_3",
            field=models.ImageField(
                blank=True,
                max_length=300,
                null=True,
                upload_to="filling_types/",
                verbose_name="Картинка 3 (файл)",
            ),
        ),
    ]
