# Generated manually for Furnitech pricing rules

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materials", "0020_calculator_material_fk_cascade"),
    ]

    operations = [
        migrations.AddField(
            model_name="materialrelateditem",
            name="quantity_scale",
            field=models.CharField(
                choices=[
                    (
                        "follow_parent",
                        "Как у родителя (× м²/м.п./шт по карточке основного материала)",
                    ),
                    ("per_facade", "На фасад (× количество фасадов)"),
                    (
                        "use_related_uom",
                        "По ед. изм. сопутствующего (× м²/м.п./шт по его карточке)",
                    ),
                ],
                default="follow_parent",
                max_length=32,
                verbose_name="Масштаб в калькуляторе",
            ),
        ),
        migrations.AddField(
            model_name="materialoperationline",
            name="price_per_facade",
            field=models.BooleanField(
                default=False,
                help_text="Если включено, в калькуляторе строка умножается на количество фасадов; иначе — один раз на конфигурацию.",
                verbose_name="Цена за каждый фасад",
            ),
        ),
    ]
