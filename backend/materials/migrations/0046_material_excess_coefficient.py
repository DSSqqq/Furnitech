import django.core.validators
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materials", "0045_material_pricing_calc_mode"),
    ]

    operations = [
        migrations.AddField(
            model_name="material",
            name="excess_coefficient",
            field=models.DecimalField(
                decimal_places=6,
                default=Decimal("1"),
                help_text="Множитель к рассчитанному количеству (1 — без запаса, 1.1 — +10%).",
                max_digits=18,
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
                verbose_name="Коэффициент избытка",
            ),
        ),
    ]
