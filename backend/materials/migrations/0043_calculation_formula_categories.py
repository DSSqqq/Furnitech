import django.db.models.deletion
from django.db import migrations, models


def create_default_formula_folder_and_assign(apps, schema_editor) -> None:
    CalculationFormulaCategory = apps.get_model("materials", "CalculationFormulaCategory")
    CalculationFormula = apps.get_model("materials", "CalculationFormula")
    root = CalculationFormulaCategory.objects.create(
        parent=None,
        name="База формул",
        code="",
        sort_order=0,
    )
    CalculationFormula.objects.update(category=root)


def noop_reverse(apps, schema_editor) -> None:
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0042_material_class_categories"),
    ]

    operations = [
        migrations.CreateModel(
            name="CalculationFormulaCategory",
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
                        to="materials.calculationformulacategory",
                        verbose_name="Родительская папка",
                    ),
                ),
            ],
            options={
                "verbose_name": "Папка формул расчёта",
                "verbose_name_plural": "Папки формул расчёта",
                "ordering": ["sort_order", "name"],
                "unique_together": {("parent", "name")},
            },
        ),
        migrations.AddField(
            model_name="calculationformula",
            name="category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="formulas",
                to="materials.calculationformulacategory",
                verbose_name="Папка",
            ),
        ),
        migrations.RunPython(create_default_formula_folder_and_assign, noop_reverse),
        migrations.AlterField(
            model_name="calculationformula",
            name="category",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="formulas",
                to="materials.calculationformulacategory",
                verbose_name="Папка",
            ),
        ),
    ]
