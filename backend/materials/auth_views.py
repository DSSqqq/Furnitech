from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request) -> Response:
        u = request.user
        return Response(
            {
                "id": u.pk,
                "username": u.username,
                "email": u.email,
                "is_superuser": u.is_superuser,
                "is_staff": u.is_staff,
            }
        )
