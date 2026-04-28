# Generated manually for calculator filling types

from django.db import migrations, models
import django.db.models.deletion


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
        ("materials", "0018_material_min_dimensions"),
    ]

    operations = [
        migrations.CreateModel(
            name="CalculatorFillingType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255, verbose_name="Название типа наполнения")),
                (
                    "image_url",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="URL картинки для карточки типа.",
                        max_length=1000,
                        verbose_name="Картинка (URL)",
                    ),
                ),
                (
                    "card_image",
                    models.ImageField(
                        blank=True,
                        null=True,
                        upload_to="filling_types/",
                        max_length=300,
                        verbose_name="Картинка (файл)",
                    ),
                ),
                ("is_active", models.BooleanField(default=True, verbose_name="Активен")),
                ("sort_order", models.PositiveIntegerField(default=0, verbose_name="Порядок")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Тип наполнения (калькулятор)",
                "verbose_name_plural": "Типы наполнения (калькулятор)",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.CreateModel(
            name="CalculatorFillingTypeMaterial",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.PositiveIntegerField(default=0, verbose_name="Порядок")),
                (
                    "filling_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="materials",
                        to="materials.calculatorfillingtype",
                        verbose_name="Тип наполнения",
                    ),
                ),
                (
                    "material",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="calculator_filling_in_types",
                        to="materials.material",
                        verbose_name="Материал",
                    ),
                ),
            ],
            options={
                "verbose_name": "Материал типа наполнения",
                "verbose_name_plural": "Материалы типов наполнения",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="calculatorfillingtypematerial",
            constraint=models.UniqueConstraint(
                fields=("filling_type", "material"),
                name="materials_calc_filling_type_material_uniq",
            ),
        ),
        migrations.RunPython(refresh_editor_perms, noop),
    ]
