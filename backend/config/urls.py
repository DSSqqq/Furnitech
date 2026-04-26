from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from materials.auth_views import MeView

urlpatterns = [
    path("admin/django/", admin.site.urls),
    path(
        "api/auth/token/",
        TokenObtainPairView.as_view(permission_classes=(AllowAny,)),
        name="token_obtain",
    ),
    path(
        "api/auth/token/refresh/",
        TokenRefreshView.as_view(permission_classes=(AllowAny,)),
        name="token_refresh",
    ),
    path("api/auth/me/", MeView.as_view(), name="auth_me"),
    path("api/", include("materials.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
