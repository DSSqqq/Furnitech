"""JWT: вход по email или по username (поле в форме одно)."""

from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

_NO_ACCOUNT = "No active account found with the given credentials"


class FurnitechTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        raw = (attrs.get("username") or "").strip()
        password = attrs.get("password")
        if not raw or "@" not in raw:
            return super().validate(attrs)

        candidates = list(User.objects.filter(email__iexact=raw).order_by("pk"))
        if not candidates:
            return super().validate(attrs)

        last_err: serializers.ValidationError | AuthenticationFailed | None = None
        for u in candidates:
            try:
                return super().validate({"username": u.get_username(), "password": password})
            except (serializers.ValidationError, AuthenticationFailed) as e:
                last_err = e
                continue
        if last_err is not None:
            raise last_err
        raise AuthenticationFailed(_NO_ACCOUNT, code="no_active_account")
