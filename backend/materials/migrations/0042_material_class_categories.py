import django.db.models.deletion
from django.db import migrations, models


def create_default_folder_and_assign(apps, schema_editor) -> None:
    MaterialClassCategory = apps.get_model("materials", "MaterialClassCategory")
    MaterialClass = apps.get_model("materials", "MaterialClass")
    root = MaterialClassCategory.objects.create(
        parent=None,
        name="База классов",
        code="",
        sort_order=0,
    )
    MaterialClass.objects.update(category=root)


def noop_reverse(apps, schema_editor) -> None:
    pass


def grant_editor_class_folder_perms(apps, schema_editor) -> None:
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    group = Group.objects.filter(name="Редактор материалов").first()
    if not group:
        return
    perms = Permission.objects.filter(
        content_type__app_label="materials",
        content_type__model="materialclasscategory",
    )
    group.permissions.add(*perms)


def revoke_editor_class_folder_perms(apps, schema_editor) -> None:
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    group = Group.objects.filter(name="Редактор материалов").first()
    if not group:
        return
    perms = Permission.objects.filter(
        content_type__app_label="materials",
        content_type__model="materialclasscategory",
    )
    group.permissions.remove(*perms)


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0041_calculation_formula"),
    ]

    operations = [
        migrations.CreateModel(
            name="MaterialClassCategory",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=255, verbose_name="Наименование")),
                ("code", models.SlugField(blank=True, max_length=64, verbose_name="Код")),
                (
                    "sort_order",
                    models.PositiveIntegerField(default=0, verbose_name="Порядок"),
                ),
                (
                    "parent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="children",
                        to="materials.materialclasscategory",
                        verbose_name="Родительская папка",
                    ),
                ),
            ],
            options={
                "verbose_name": "Папка классов материалов",
                "verbose_name_plural": "Папки классов материалов",
                "ordering": ["sort_order", "name"],
                "unique_together": {("parent", "name")},
            },
        ),
        migrations.AddField(
            model_name="materialclass",
            name="category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="classes",
                to="materials.materialclasscategory",
                verbose_name="Папка",
            ),
        ),
        migrations.RunPython(create_default_folder_and_assign, noop_reverse),
        migrations.AlterField(
            model_name="materialclass",
            name="category",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="classes",
                to="materials.materialclasscategory",
                verbose_name="Папка",
            ),
        ),
        migrations.RunPython(grant_editor_class_folder_perms, revoke_editor_class_folder_perms),
    ]
