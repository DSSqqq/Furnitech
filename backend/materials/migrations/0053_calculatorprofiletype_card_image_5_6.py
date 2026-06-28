from django.db import migrations, models
import django.db.models.deletion


def card_texture_field(related_name: str, verbose_name: str):
    return models.ForeignKey(
        blank=True,
        null=True,
        on_delete=django.db.models.deletion.SET_NULL,
        related_name=related_name,
        to="materials.textureitem",
        verbose_name=verbose_name,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0052_material_article_name_unique"),
    ]

    operations = [
        migrations.AddField(
            model_name="calculatorprofiletype",
            name="card_image_5",
            field=models.ImageField(
                blank=True,
                max_length=300,
                null=True,
                upload_to="profile_types/",
                verbose_name="Картинка 5 (файл)",
            ),
        ),
        migrations.AddField(
            model_name="calculatorprofiletype",
            name="card_texture_5",
            field=card_texture_field("profile_type_card_5", "Картинка 5 из базы текстур"),
        ),
        migrations.AddField(
            model_name="calculatorprofiletype",
            name="card_image_6",
            field=models.ImageField(
                blank=True,
                max_length=300,
                null=True,
                upload_to="profile_types/",
                verbose_name="Картинка 6 (файл)",
            ),
        ),
        migrations.AddField(
            model_name="calculatorprofiletype",
            name="card_texture_6",
            field=card_texture_field("profile_type_card_6", "Картинка 6 из базы текстур"),
        ),
    ]
