# Generated manually for Furnitech

from decimal import Decimal

from django.db import migrations, models
from django.core.validators import MinValueValidator


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0017_calculatorprofiletype_card_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="material",
            name="min_length",
            field=models.DecimalField(
                default=Decimal("0"),
                decimal_places=3,
                max_digits=18,
                validators=[MinValueValidator(Decimal("0"))],
                verbose_name="Мин. длина",
            ),
        ),
        migrations.AddField(
            model_name="material",
            name="min_width",
            field=models.DecimalField(
                default=Decimal("0"),
                decimal_places=3,
                max_digits=18,
                validators=[MinValueValidator(Decimal("0"))],
                verbose_name="Мин. ширина",
            ),
        ),
    ]

