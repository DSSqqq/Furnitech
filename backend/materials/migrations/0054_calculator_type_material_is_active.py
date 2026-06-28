from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materials", "0053_calculatorprofiletype_card_image_5_6"),
    ]

    operations = [
        migrations.AddField(
            model_name="calculatorprofiletypecolor",
            name="is_active",
            field=models.BooleanField(default=True, verbose_name="Активен в калькуляторе"),
        ),
        migrations.AddField(
            model_name="calculatorfillingtypematerial",
            name="is_active",
            field=models.BooleanField(default=True, verbose_name="Активен в калькуляторе"),
        ),
        migrations.AddField(
            model_name="calculatorhingetypematerial",
            name="is_active",
            field=models.BooleanField(default=True, verbose_name="Активен в калькуляторе"),
        ),
    ]
