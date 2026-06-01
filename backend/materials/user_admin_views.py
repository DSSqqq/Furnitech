"""Регистрация клиентов и управление доступом в веб-админку (сотрудники SPA, is_staff)."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import IntegrityError
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

User = get_user_model()
MANAGERS_GROUP_NAME = "Менеджеры"


def _requests_staff_or_superuser_elevation(data) -> bool:
    """True if client tries to register with admin/superuser flags (only booleans honored)."""
    for key in ("is_staff", "is_superuser"):
        v = data.get(key)
        if v is True:
            return True
    return False


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request) -> Response:
        if _requests_staff_or_superuser_elevation(request.data):
            return Response(
                {
                    "detail": "Роль администратора при регистрации задать нельзя. "
                    "Новые учётные записи создаются как обычные пользователи.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        email = (request.data.get("email") or "").strip()

        if not username:
            return Response({"detail": "Укажите имя пользователя."}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response(
                {"detail": "Пароль не короче 8 символов."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.create_user(
                username=username,
                email=email or "",
                password=password,
                is_staff=False,
                is_superuser=False,
            )
            # На случай кастомного UserManager / сигналов: веб-админка SPA — только is_staff=True вручную.
            if user.is_staff or user.is_superuser:
                user.is_staff = False
                user.is_superuser = False
                user.save(update_fields=["is_staff", "is_superuser"])
        except IntegrityError:
            return Response(
                {"detail": "Пользователь с таким именем уже существует."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"detail": "Регистрация успешна."}, status=status.HTTP_201_CREATED)


def _user_row(u: User) -> dict:
    is_manager = False
    try:
        is_manager = u.groups.filter(name=MANAGERS_GROUP_NAME).exists()
    except Exception:  # noqa: BLE001
        is_manager = False
    return {
        "id": u.pk,
        "username": u.username,
        "email": u.email or "",
        "is_staff": u.is_staff,
        "is_superuser": u.is_superuser,
        "is_manager": is_manager,
    }


class AdminUserListView(APIView):
    """Список пользователей — только для вошедших сотрудников веб-админки (is_staff)."""

    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request) -> Response:
        qs = User.objects.all().order_by("id")
        return Response([_user_row(u) for u in qs])


class AdminUserStaffView(APIView):
    """PATCH роли; DELETE учётной записи. Список — is_staff; роль admin и DELETE — только superuser."""

    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def patch(self, request, pk: int) -> Response:
        try:
            pk = int(pk)
        except (TypeError, ValueError):
            return Response({"detail": "Некорректный id."}, status=status.HTTP_400_BAD_REQUEST)

        target = User.objects.filter(pk=pk).first()
        if not target:
            return Response({"detail": "Пользователь не найден."}, status=status.HTTP_404_NOT_FOUND)

        if target.is_superuser:
            return Response(
                {"detail": "У суперпользователя нельзя менять флаг доступа к админке через это API."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        role = request.data.get("role")
        raw_is_staff = request.data.get("is_staff")

        # backward-compatible: {"is_staff": true/false}
        if role is None:
            if not isinstance(raw_is_staff, bool):
                return Response(
                    {"detail": "Передайте булево поле is_staff или строковое поле role (user/manager/admin)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            role = "admin" if raw_is_staff else "user"

        if role not in ("user", "manager", "admin"):
            return Response(
                {"detail": "Некорректная роль. Допустимо: user, manager, admin."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if role == "admin" and not request.user.is_superuser:
            return Response(
                {"detail": "Назначить роль администратора может только суперпользователь."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ensure group exists (created by migration, but be defensive)
        managers_group, _ = Group.objects.get_or_create(name=MANAGERS_GROUP_NAME)

        if role == "admin":
            target.is_staff = True
            target.groups.remove(managers_group)
        elif role == "manager":
            target.is_staff = False
            target.groups.add(managers_group)
        else:  # user
            target.is_staff = False
            target.groups.remove(managers_group)

        target.save(update_fields=["is_staff"])
        return Response(_user_row(target))

    def delete(self, request, pk: int) -> Response:
        if not request.user.is_superuser:
            return Response(
                {"detail": "Удаление учётных записей доступно только суперпользователю."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            pk = int(pk)
        except (TypeError, ValueError):
            return Response({"detail": "Некорректный id."}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.pk == pk:
            return Response(
                {"detail": "Нельзя удалить свою учётную запись."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target = User.objects.filter(pk=pk).first()
        if not target:
            return Response({"detail": "Пользователь не найден."}, status=status.HTTP_404_NOT_FOUND)

        if target.is_superuser:
            return Response(
                {"detail": "Нельзя удалить суперпользователя через это API."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
