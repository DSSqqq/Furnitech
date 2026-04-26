from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Создать пользователя для веб-админки (без доступа в Django admin): "
        "is_staff=False, группа «Редактор материалов»"
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument("username", type=str)
        parser.add_argument("email", type=str, nargs="?", default="")
        parser.add_argument("password", type=str)

    def handle(self, *args, **options) -> None:
        username = options["username"]
        email = options["email"] or username
        group = Group.objects.get(name="Редактор материалов")
        u, _ = User.objects.get_or_create(
            username=username,
            defaults={"email": email, "is_staff": False, "is_superuser": False},
        )
        u.email = email
        u.is_staff = False
        u.is_superuser = False
        u.set_password(options["password"])
        u.save()
        group.user_set.add(u)
        self.stdout.write(self.style.SUCCESS(f"Пользователь {username!r} добавлен в «Редактор материалов»."))
