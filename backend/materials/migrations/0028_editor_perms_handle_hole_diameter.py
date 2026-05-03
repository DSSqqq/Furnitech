# Права на новую модель — в группу «Редактор материалов» (веб-админка без Django admin).

from django.db import migrations


def refresh_editor_perms(apps, schema_editor) -> None:
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    g = Group.objects.filter(name="Редактор материалов").first()
    if g:
        perms = Permission.objects.filter(content_type__app_label="materials")
        g.permissions.set(perms)


def noop(apps, schema_editor) -> None:
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("materials", "0027_calculator_handle_hole_diameters"),
    ]

    operations = [
        migrations.RunPython(refresh_editor_perms, noop),
    ]
