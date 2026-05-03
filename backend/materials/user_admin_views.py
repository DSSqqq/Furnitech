"""Регистрация клиентов и управление доступом в веб-админку (сотрудники SPA, is_staff)."""

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

User = get_user_model()


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
    return {
        "id": u.pk,
        "username": u.username,
        "email": u.email or "",
        "is_staff": u.is_staff,
        "is_superuser": u.is_superuser,
    }


class AdminUserListView(APIView):
    """Список пользователей — только для вошедших сотрудников веб-админки (is_staff)."""

    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request) -> Response:
        qs = User.objects.all().order_by("id")
        return Response([_user_row(u) for u in qs])


class AdminUserStaffView(APIView):
    """PATCH is_staff; DELETE учётной записи (не суперпользователя, не себя). Доступ: is_staff."""

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

        raw = request.data.get("is_staff")
        if not isinstance(raw, bool):
            return Response(
                {"detail": "Передайте булево поле is_staff."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target.is_staff = raw
        target.save(update_fields=["is_staff"])
        return Response(_user_row(target))

    def delete(self, request, pk: int) -> Response:
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
