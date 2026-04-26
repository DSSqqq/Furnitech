# Generated manually for Furnitech

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0016_calculator_profile_types"),
    ]

    operations = [
        migrations.AddField(
            model_name="calculatorprofiletype",
            name="card_image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="profile_types/",
                max_length=300,
                verbose_name="Картинка (файл)",
            ),
        ),
    ]

