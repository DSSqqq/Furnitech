from django.db import migrations, models
import django.db.models.deletion


def grant_editor_texture_perms(apps, schema_editor) -> None:
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    group = Group.objects.filter(name="Редактор материалов").first()
    if not group:
        return
    perms = Permission.objects.filter(
        content_type__app_label="materials",
        content_type__model__in=["texturecategory", "textureitem"],
    )
    group.permissions.add(*perms)


def revoke_editor_texture_perms(apps, schema_editor) -> None:
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    group = Group.objects.filter(name="Редактор материалов").first()
    if not group:
        return
    perms = Permission.objects.filter(
        content_type__app_label="materials",
        content_type__model__in=["texturecategory", "textureitem"],
    )
    group.permissions.remove(*perms)


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0032_remove_material_operation_line"),
    ]

    operations = [
        migrations.CreateModel(
            name="TextureCategory",
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
                        to="materials.texturecategory",
                        verbose_name="Родительская папка",
                    ),
                ),
            ],
            options={
                "verbose_name": "Папка текстур",
                "verbose_name_plural": "Папки текстур",
                "ordering": ["sort_order", "name"],
                "unique_together": {("parent", "name")},
            },
        ),
        migrations.CreateModel(
            name="TextureItem",
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
                ("name", models.CharField(max_length=500, verbose_name="Наименование")),
                (
                    "image",
                    models.ImageField(
                        blank=True,
                        max_length=300,
                        null=True,
                        upload_to="texture_library/",
                        verbose_name="Изображение",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "category",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="materials.texturecategory",
                        verbose_name="Папка",
                    ),
                ),
            ],
            options={
                "verbose_name": "Текстура (база)",
                "verbose_name_plural": "Текстуры (база)",
                "ordering": ["name"],
            },
        ),
        migrations.AddField(
            model_name="material",
            name="texture_item",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="materials_using",
                to="materials.textureitem",
                verbose_name="Текстура из базы",
            ),
        ),
        migrations.RunPython(grant_editor_texture_perms, revoke_editor_texture_perms),
    ]
