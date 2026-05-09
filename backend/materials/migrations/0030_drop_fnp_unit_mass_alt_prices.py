"""
Полное удаление полей `fnp_name`, `unit_mass` у Material и модели MaterialAlternativePrice
(вместе с её content type/permissions).
"""

from django.db import migrations


def delete_alt_price_perms(apps, schema_editor) -> None:
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")
    Permission.objects.filter(
        content_type__app_label="materials",
        content_type__model="materialalternativeprice",
    ).delete()
    ContentType.objects.filter(
        app_label="materials",
        model="materialalternativeprice",
    ).delete()


def noop(apps, schema_editor) -> None:
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("materials", "0029_facade_orders"),
    ]

    operations = [
        migrations.RunPython(delete_alt_price_perms, noop),
        migrations.DeleteModel(name="MaterialAlternativePrice"),
        migrations.RemoveField(model_name="material", name="fnp_name"),
        migrations.RemoveField(model_name="material", name="unit_mass"),
    ]
