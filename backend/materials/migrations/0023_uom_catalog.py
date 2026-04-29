from django.db import migrations


def seed_uom_catalog(apps, schema_editor):
    Uom = apps.get_model("materials", "UnitOfMeasure")

    for code, name, short in [
        ("m2", "Квадратный метр", "кв.м"),
        ("m", "Метр", "м"),
        ("pc", "Штука", "шт"),
        ("l", "Литр", "литр"),
        ("kg", "Килограмм", "кг"),
    ]:
        Uom.objects.filter(code=code).update(name=name, short_name=short)

    for code, name, short in [
        ("m3", "Кубический метр", "куб.м"),
        ("sheet", "Лист", "лист"),
        ("mm", "Миллиметр", "мм"),
        ("roll", "Рулон", "рулон"),
        ("pack", "Упаковка", "упак"),
        ("tg", "Тенге", "тг"),
        ("pair", "Пара", "пара"),
    ]:
        Uom.objects.get_or_create(
            code=code,
            defaults={"name": name, "short_name": short},
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0022_seed_uom_l_kg"),
    ]

    operations = [
        migrations.RunPython(seed_uom_catalog, noop_reverse),
    ]
