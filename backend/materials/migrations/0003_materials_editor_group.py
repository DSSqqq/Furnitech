from django.db import migrations


def create_editor_group(apps, schema_editor) -> None:
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    group, _ = Group.objects.get_or_create(name="Редактор материалов")
    perms = Permission.objects.filter(content_type__app_label="materials")
    group.permissions.set(perms)


def remove_group(apps, schema_editor) -> None:
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name="Редактор материалов").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0002_seed_uom"),
    ]

    operations = [migrations.RunPython(create_editor_group, remove_group)]
