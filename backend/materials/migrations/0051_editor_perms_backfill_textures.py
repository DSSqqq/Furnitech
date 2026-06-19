from django.db import migrations


EDITOR_GROUP_NAME = "Редактор материалов"


def backfill_editor_perms(apps, schema_editor) -> None:
    """Гарантируем, что у группы «Редактор материалов» есть все права приложения
    materials (включая add/change/delete textureitem и texturecategory) и что
    каждый SPA-«админ» (is_staff, не суперпользователь) состоит в этой группе.

    Без этого staff-пользователь видит вкладку «Текстуры», но получает 403 на
    POST /api/texture-items/ («+ Текстура»): is_staff сам по себе не даёт model
    permissions, а суперпользователь их обходит — отсюда «у владельца работает,
    у заказчика нет».
    """
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    UserModel = apps.get_model("auth", "User")

    group, _ = Group.objects.get_or_create(name=EDITOR_GROUP_NAME)
    perms = Permission.objects.filter(content_type__app_label="materials")
    group.permissions.add(*perms)

    # Бэкфилл членства: все действующие сотрудники веб-админки (is_staff), кроме
    # суперпользователей (им группа не нужна), получают права редактора.
    for u in UserModel.objects.filter(is_staff=True, is_superuser=False):
        u.groups.add(group)


def noop_reverse(apps, schema_editor) -> None:
    # Не отзываем права/членство при откате: безопасный no-op.
    return


class Migration(migrations.Migration):
    dependencies = [
        ("materials", "0050_calculator_card_textures"),
    ]

    operations = [
        migrations.RunPython(backfill_editor_perms, noop_reverse),
    ]
