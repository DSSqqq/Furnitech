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
        ("materials", "0049_managers_group"),
    ]

    operations = [
        migrations.AddField(
            model_name="calculatorprofiletype",
            name="card_texture",
            field=card_texture_field("profile_type_card_1", "Картинка 1 из базы текстур"),
        ),
        migrations.AddField(
            model_name="calculatorprofiletype",
            name="card_texture_2",
            field=card_texture_field("profile_type_card_2", "Картинка 2 из базы текстур"),
        ),
        migrations.AddField(
            model_name="calculatorprofiletype",
            name="card_texture_3",
            field=card_texture_field("profile_type_card_3", "Картинка 3 из базы текстур"),
        ),
        migrations.AddField(
            model_name="calculatorprofiletype",
            name="card_texture_4",
            field=card_texture_field("profile_type_card_4", "Картинка 4 из базы текстур"),
        ),
        migrations.AddField(
            model_name="calculatorfillingtype",
            name="card_texture",
            field=card_texture_field("filling_type_card_1", "Картинка 1 из базы текстур"),
        ),
        migrations.AddField(
            model_name="calculatorfillingtype",
            name="card_texture_2",
            field=card_texture_field("filling_type_card_2", "Картинка 2 из базы текстур"),
        ),
        migrations.AddField(
            model_name="calculatorfillingtype",
            name="card_texture_3",
            field=card_texture_field("filling_type_card_3", "Картинка 3 из базы текстур"),
        ),
        migrations.AddField(
            model_name="calculatorfillingtype",
            name="card_texture_4",
            field=card_texture_field("filling_type_card_4", "Картинка 4 из базы текстур"),
        ),
        migrations.AddField(
            model_name="calculatorhingetype",
            name="card_texture",
            field=card_texture_field("hinge_type_card_1", "Картинка 1 из базы текстур"),
        ),
        migrations.AddField(
            model_name="calculatorhingetype",
            name="card_texture_2",
            field=card_texture_field("hinge_type_card_2", "Картинка 2 из базы текстур"),
        ),
        migrations.AddField(
            model_name="calculatorhingetype",
            name="card_texture_3",
            field=card_texture_field("hinge_type_card_3", "Картинка 3 из базы текстур"),
        ),
        migrations.AddField(
            model_name="calculatorhingetype",
            name="card_texture_4",
            field=card_texture_field("hinge_type_card_4", "Картинка 4 из базы текстур"),
        ),
    ]

