from django.db import migrations


def create_managers_group(apps, schema_editor) -> None:
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")

    group, _ = Group.objects.get_or_create(name="Менеджеры")

    perms = Permission.objects.filter(
        content_type__app_label="materials",
        codename__in=[
            "view_facadeorder",
            "change_facadeorder",
        ],
    )
    group.permissions.set(perms)


def remove_managers_group(apps, schema_editor) -> None:
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name="Менеджеры").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0048_facadeorder_payment_status"),
    ]

    operations = [
        migrations.RunPython(create_managers_group, remove_managers_group),
    ]

