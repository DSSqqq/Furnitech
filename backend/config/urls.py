from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from materials.auth_views import MeView
from materials.jwt_auth import FurnitechTokenObtainPairSerializer
from materials.user_admin_views import AdminUserListView, AdminUserStaffView, RegisterView
from materials.views import MaterialExportPermission, MaterialImportPermission, MaterialViewSet

class FurnitechTokenObtainPairView(TokenObtainPairView):
    serializer_class = FurnitechTokenObtainPairSerializer


# Импорт/экспорт таблицы материалов — отдельно от router (не пересекаться с materials/<pk>/).
_materials_table_export = MaterialViewSet.as_view(
    {"get": "export_materials_table"},
    permission_classes=[MaterialExportPermission],
)
_materials_table_import = MaterialViewSet.as_view(
    {"post": "import_materials_table"},
    permission_classes=[MaterialImportPermission],
    parser_classes=[MultiPartParser, FormParser, JSONParser],
)

urlpatterns = [
    path("admin/django/", admin.site.urls),
    path(
        "api/auth/token/",
        FurnitechTokenObtainPairView.as_view(permission_classes=(AllowAny,)),
        name="token_obtain",
    ),
    path(
        "api/auth/token/refresh/",
        TokenRefreshView.as_view(permission_classes=(AllowAny,)),
        name="token_refresh",
    ),
    path("api/auth/me/", MeView.as_view(), name="auth_me"),
    path("api/auth/register/", RegisterView.as_view(), name="auth_register"),
    path("api/auth/admin-users/", AdminUserListView.as_view(), name="auth_admin_users"),
    path("api/auth/admin-users/<int:pk>/", AdminUserStaffView.as_view(), name="auth_admin_user_staff"),
    path("api/materials-export/", _materials_table_export, name="materials-table-export"),
    path("api/materials-import/", _materials_table_import, name="materials-table-import"),
    path("api/", include("materials.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
