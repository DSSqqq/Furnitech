from django.db import transaction
from rest_framework import viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import (
    SAFE_METHODS,
    BasePermission,
    DjangoModelPermissions,
    IsAdminUser,
    IsAuthenticated,
)
from rest_framework.response import Response

from .models import (
    CalculatorFillingType,
    CalculatorHandleHoleDiameter,
    CalculatorHingeType,
    CalculatorProfile,
    CalculatorProfileType,
    FacadeOrder,
    Material,
    MaterialCategory,
    MaterialClass,
    TextureCategory,
    TextureItem,
    UnitOfMeasure,
)
from .flexible_search import (
    apply_flexible_charfield_filter,
    apply_flexible_search_name_or_article,
    apply_folder_name_filter,
)
from .serializers import (
    CalculatorFillingTypeSerializer,
    CalculatorHandleHoleDiameterSerializer,
    CalculatorHingeTypeSerializer,
    CalculatorProfileSerializer,
    CalculatorProfileTypeSerializer,
    FacadeOrderCreateSerializer,
    FacadeOrderSerializer,
    FacadeOrderStaffUpdateSerializer,
    MaterialCategorySerializer,
    MaterialClassSerializer,
    MaterialSerializer,
    TextureCategorySerializer,
    TextureItemSerializer,
    UnitOfMeasureSerializer,
)


class MaterialClassViewSet(viewsets.ModelViewSet):
    queryset = MaterialClass.objects.all()
    serializer_class = MaterialClassSerializer
    permission_classes = [DjangoModelPermissions]


class UnitOfMeasureViewSet(viewsets.ModelViewSet):
    queryset = UnitOfMeasure.objects.all()
    serializer_class = UnitOfMeasureSerializer
    permission_classes = [DjangoModelPermissions]


def _material_category_subtree_ids(root_id: int) -> list[int]:
    """Все id категории и потомков (BFS)."""
    ids: list[int] = [root_id]
    frontier: list[int] = [root_id]
    while frontier:
        children = list(
            MaterialCategory.objects.filter(parent_id__in=frontier).values_list(
                "id", flat=True
            )
        )
        frontier = children
        ids.extend(children)
    return ids


class MaterialCategoryViewSet(viewsets.ModelViewSet):
    queryset = MaterialCategory.objects.all()
    serializer_class = MaterialCategorySerializer
    permission_classes = [DjangoModelPermissions]

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        subtree_ids = _material_category_subtree_ids(instance.pk)
        Material.objects.filter(category_id__in=subtree_ids).delete()
        instance.delete()
        return Response(status=204)

    @staticmethod
    def _build_tree(categories: list, parent_id: int | None) -> list:
        def is_child(c: MaterialCategory) -> bool:
            if parent_id is None:
                return c.parent_id is None
            return c.parent_id == parent_id

        children = [c for c in categories if is_child(c)]
        out = []
        for c in sorted(children, key=lambda x: (x.sort_order, x.name)):
            out.append(
                {
                    **MaterialCategorySerializer(c).data,
                    "children": MaterialCategoryViewSet._build_tree(categories, c.id),
                }
            )
        return out

    def list(self, request, *args, **kwargs):
        if request.query_params.get("tree") == "1":
            all_cats = list(MaterialCategory.objects.all().select_related("parent"))
            return Response(self._build_tree(all_cats, None))
        return super().list(request, *args, **kwargs)


class TextureCategoryViewSet(viewsets.ModelViewSet):
    queryset = TextureCategory.objects.all()
    serializer_class = TextureCategorySerializer
    permission_classes = [DjangoModelPermissions]

    @staticmethod
    def _build_tree(categories: list, parent_id: int | None) -> list:
        def is_child(c: TextureCategory) -> bool:
            if parent_id is None:
                return c.parent_id is None
            return c.parent_id == parent_id

        children = [c for c in categories if is_child(c)]
        out = []
        for c in sorted(children, key=lambda x: (x.sort_order, x.name)):
            out.append(
                {
                    **TextureCategorySerializer(c).data,
                    "children": TextureCategoryViewSet._build_tree(categories, c.id),
                }
            )
        return out

    def list(self, request, *args, **kwargs):
        if request.query_params.get("tree") == "1":
            all_cats = list(TextureCategory.objects.all().select_related("parent"))
            return Response(self._build_tree(all_cats, None))
        return super().list(request, *args, **kwargs)


class TextureItemViewSet(viewsets.ModelViewSet):
    queryset = TextureItem.objects.all().select_related("category")
    serializer_class = TextureItemSerializer
    permission_classes = [DjangoModelPermissions]
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    filter_backends = []

    def get_queryset(self):
        qs = super().get_queryset()
        cat = self.request.query_params.get("category")
        if cat is not None and cat != "":
            try:
                qs = qs.filter(category_id=int(cat))
            except (TypeError, ValueError):
                pass
        return qs


class AllowAnyReadAuthenticatedModelPermsWrite(BasePermission):
    """GET/HEAD/OPTIONS — всем (в т.ч. без авторизации); запись — авторизация + Django model permissions."""

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        return DjangoModelPermissions().has_permission(request, view)


class MaterialViewSet(viewsets.ModelViewSet):
    queryset = (
        Material.objects.all()
        .select_related("uom", "category", "texture_item")
        .prefetch_related(
            "material_classes",
            "companion_items__related_material__uom",
            "companion_items__related_material__texture_item",
        )
    )
    serializer_class = MaterialSerializer
    permission_classes = [AllowAnyReadAuthenticatedModelPermsWrite]
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    filter_backends = []

    def get_queryset(self):
        qs = super().get_queryset()
        qp = self.request.query_params

        cat_id = None
        cat = qp.get("category")
        if cat is not None and cat != "":
            try:
                cat_id = int(cat)
                qs = qs.filter(category_id=cat_id)
            except (TypeError, ValueError):
                pass

        if cat_id is None:
            folder_name = (qp.get("folder_name") or "").strip()
            if folder_name:
                qs = apply_folder_name_filter(qs, folder_name)

        article = (qp.get("article") or "").strip()
        if article:
            qs = apply_flexible_charfield_filter(qs, "article", article)

        name = (qp.get("name") or "").strip()
        if name:
            qs = apply_flexible_charfield_filter(qs, "name", name)

        search = (qp.get("search") or "").strip()
        if search:
            qs = apply_flexible_search_name_or_article(qs, search)

        price_raw = (qp.get("price") or "").strip()
        if price_raw:
            try:
                from decimal import Decimal

                normalized = price_raw.replace(",", ".").replace(" ", "")
                qs = qs.filter(base_price=Decimal(normalized))
            except Exception:
                pass

        mc_raw = qp.get("material_class_ids")
        if mc_raw:
            ids = []
            for x in mc_raw.split(","):
                x = x.strip()
                if x.isdigit():
                    ids.append(int(x))
            if ids:
                qs = qs.filter(material_classes__id__in=ids).distinct()

        return qs


class AuthReadModelPermsWrite(IsAuthenticated):
    """GET/HEAD/OPTIONS — любому авторизованному; запись — по Django model permissions."""

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        if request.method in SAFE_METHODS:
            return True
        return DjangoModelPermissions().has_permission(request, view)


class CalculatorProfileViewSet(viewsets.ModelViewSet):
    queryset = CalculatorProfile.objects.all().select_related(
        "material", "material__texture_item"
    ).prefetch_related("colors__color_material__uom", "colors__color_material__texture_item")
    serializer_class = CalculatorProfileSerializer
    permission_classes = [AuthReadModelPermsWrite]


class CalculatorProfileTypeViewSet(viewsets.ModelViewSet):
    queryset = CalculatorProfileType.objects.all().prefetch_related(
        "colors__color_material__uom", "colors__color_material__texture_item"
    )
    serializer_class = CalculatorProfileTypeSerializer
    permission_classes = [AllowAnyReadAuthenticatedModelPermsWrite]
    parser_classes = [JSONParser, FormParser, MultiPartParser]


class CalculatorFillingTypeViewSet(viewsets.ModelViewSet):
    queryset = CalculatorFillingType.objects.all().prefetch_related(
        "materials__material__uom", "materials__material__texture_item"
    )
    serializer_class = CalculatorFillingTypeSerializer
    permission_classes = [AllowAnyReadAuthenticatedModelPermsWrite]
    parser_classes = [JSONParser, FormParser, MultiPartParser]


class CalculatorHingeTypeViewSet(viewsets.ModelViewSet):
    queryset = CalculatorHingeType.objects.all().prefetch_related(
        "materials__material__uom", "materials__material__texture_item"
    )
    serializer_class = CalculatorHingeTypeSerializer
    permission_classes = [AllowAnyReadAuthenticatedModelPermsWrite]
    parser_classes = [JSONParser, FormParser, MultiPartParser]


class CalculatorHandleHoleDiameterViewSet(viewsets.ModelViewSet):
    """Список диаметров: без прав change_* гости видят только client_visible=True."""

    queryset = CalculatorHandleHoleDiameter.objects.all().order_by("sort_order", "diameter_mm")
    serializer_class = CalculatorHandleHoleDiameterSerializer
    permission_classes = [AllowAnyReadAuthenticatedModelPermsWrite]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and user.has_perm("materials.change_calculatorhandleholediameter"):
            return qs
        return qs.filter(client_visible=True)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        data = response.data
        if isinstance(data, dict):
            user = request.user
            if user.is_authenticated and user.has_perm("materials.change_calculatorhandleholediameter"):
                data["catalog_scope"] = "full"
            else:
                data["catalog_scope"] = "client"
        return response


class FacadeOrderViewSet(viewsets.ModelViewSet):
    """Заказы калькулятора: создаёт клиент (multipart PDF + snapshot); список — свои; сотрудник — все; PATCH статуса и DELETE — только staff."""

    queryset = FacadeOrder.objects.all().select_related("user").order_by("-created_at")
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ("partial_update", "update", "destroy"):
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        u = self.request.user
        if u.is_staff or u.is_superuser:
            return qs
        return qs.filter(user=u)

    def get_serializer_class(self):
        if self.action == "create":
            return FacadeOrderCreateSerializer
        return FacadeOrderSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        ser = FacadeOrderStaffUpdateSerializer(
            instance,
            data=request.data,
            partial=True,
            context=self.get_serializer_context(),
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        instance.refresh_from_db()
        return Response(FacadeOrderSerializer(instance, context=self.get_serializer_context()).data)

    def perform_destroy(self, instance: FacadeOrder) -> None:
        if instance.pdf_file:
            instance.pdf_file.delete(save=False)
        instance.delete()
