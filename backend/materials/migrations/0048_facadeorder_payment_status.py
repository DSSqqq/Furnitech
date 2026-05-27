from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0047_calculator_card_image_4"),
    ]

    operations = [
        migrations.AddField(
            model_name="facadeorder",
            name="payment_status",
            field=models.CharField(
                choices=[
                    ("unpaid", "Не оплачен"),
                    ("partial", "Частично оплачен"),
                    ("paid", "Оплачен"),
                ],
                db_index=True,
                default="unpaid",
                max_length=32,
                verbose_name="Статус оплаты",
            ),
        ),
    ]
