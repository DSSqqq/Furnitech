from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0034_remove_material_designation_cut_coeff_calc_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="calculatorprofiletype",
            name="card_image_2",
            field=models.ImageField(
                blank=True,
                max_length=300,
                null=True,
                upload_to="profile_types/",
                verbose_name="Картинка 2 (файл)",
            ),
        ),
        migrations.AddField(
            model_name="calculatorprofiletype",
            name="card_image_3",
            field=models.ImageField(
                blank=True,
                max_length=300,
                null=True,
                upload_to="profile_types/",
                verbose_name="Картинка 3 (файл)",
            ),
        ),
    ]
