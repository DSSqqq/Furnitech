# Generated manually: типы петель для шага присадки калькулятора

import django.db.models.deletion
from django.db import migrations, models


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
        ("materials", "0025_seed_material_class_linear_meter"),
    ]

    operations = [
        migrations.CreateModel(
            name="CalculatorHingeType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255, verbose_name="Название типа петель")),
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
                        upload_to="hinge_types/",
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
                "verbose_name": "Тип петель (калькулятор)",
                "verbose_name_plural": "Типы петель (калькулятор)",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.CreateModel(
            name="CalculatorHingeTypeMaterial",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.PositiveIntegerField(default=0, verbose_name="Порядок")),
                (
                    "hinge_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="materials",
                        to="materials.calculatorhingetype",
                        verbose_name="Тип петель",
                    ),
                ),
                (
                    "material",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="calculator_hinge_in_types",
                        to="materials.material",
                        verbose_name="Материал",
                    ),
                ),
            ],
            options={
                "verbose_name": "Материал типа петель",
                "verbose_name_plural": "Материалы типов петель",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="calculatorhingetypematerial",
            constraint=models.UniqueConstraint(
                fields=("hinge_type", "material"),
                name="materials_calc_hinge_type_material_uniq",
            ),
        ),
        migrations.RunPython(refresh_editor_perms, noop),
    ]
