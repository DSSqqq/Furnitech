from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0046_material_excess_coefficient"),
    ]

    operations = [
        migrations.AddField(
            model_name="calculatorprofiletype",
            name="card_image_4",
            field=models.ImageField(
                blank=True,
                max_length=300,
                null=True,
                upload_to="profile_types/",
                verbose_name="Картинка 4 (файл)",
            ),
        ),
        migrations.AddField(
            model_name="calculatorfillingtype",
            name="card_image_4",
            field=models.ImageField(
                blank=True,
                max_length=300,
                null=True,
                upload_to="filling_types/",
                verbose_name="Картинка 4 (файл)",
            ),
        ),
        migrations.AddField(
            model_name="calculatorhingetype",
            name="card_image_4",
            field=models.ImageField(
                blank=True,
                max_length=300,
                null=True,
                upload_to="hinge_types/",
                verbose_name="Картинка 4 (файл)",
            ),
        ),
    ]
