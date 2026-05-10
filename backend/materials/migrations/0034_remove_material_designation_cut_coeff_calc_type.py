from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("materials", "0033_texture_library"),
    ]

    operations = [
        migrations.RemoveField(model_name="material", name="designation"),
        migrations.RemoveField(model_name="material", name="cut_coeff"),
        migrations.RemoveField(model_name="material", name="calc_type"),
    ]
