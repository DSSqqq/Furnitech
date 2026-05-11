from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0038_material_modus_snapshot"),
    ]

    operations = [
        migrations.RenameField(
            model_name="material",
            old_name="modus_snapshot",
            new_name="import_export_snapshot",
        ),
    ]
