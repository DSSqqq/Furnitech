from django.db import migrations


def swap_kg_for_m2(apps, schema_editor) -> None:
    Uom = apps.get_model("materials", "UnitOfMeasure")
    Material = apps.get_model("materials", "Material")

    kg = Uom.objects.filter(code="kg").first()
    m2, _ = Uom.objects.get_or_create(
        code="m2",
        defaults={"name": "Квадратный метр", "short_name": "м²"},
    )
    if kg:
        # материалы с кг ссылаются на uom: переносим на м.п. (или первую единицу)
        fallback = Uom.objects.filter(code="m").first() or m2
        Material.objects.filter(uom_id=kg.pk).update(uom_id=fallback.pk)
        kg.delete()


def unswap(apps, schema_editor) -> None:
    Uom = apps.get_model("materials", "UnitOfMeasure")
    Uom.objects.filter(code="m2").delete()
    Uom.objects.get_or_create(
        code="kg",
        defaults={"name": "Килограмм", "short_name": "кг"},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0003_materials_editor_group"),
    ]

    operations = [migrations.RunPython(swap_kg_for_m2, unswap)]
