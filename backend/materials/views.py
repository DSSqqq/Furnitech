from django.db import transaction
from rest_framework import filters, viewsets
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
    UnitOfMeasure,
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
        .select_related("uom", "category")
        .prefetch_related(
            "material_classes",
            "alternative_prices",
            "companion_items__related_material__uom",
            "operation_lines__uom",
        )
    )
    serializer_class = MaterialSerializer
    permission_classes = [AllowAnyReadAuthenticatedModelPermsWrite]
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    filter_backends = [filters.SearchFilter]
    search_fields = ("name", "article", "fnp_name")

    def get_queryset(self):
        qs = super().get_queryset()
        cat = self.request.query_params.get("category")
        if cat is not None and cat != "":
            try:
                return qs.filter(category_id=int(cat))
            except (TypeError, ValueError):
                return qs
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
    queryset = CalculatorProfile.objects.all().select_related("material").prefetch_related(
        "colors__color_material__uom"
    )
    serializer_class = CalculatorProfileSerializer
    permission_classes = [AuthReadModelPermsWrite]


class CalculatorProfileTypeViewSet(viewsets.ModelViewSet):
    queryset = CalculatorProfileType.objects.all().prefetch_related("colors__color_material__uom")
    serializer_class = CalculatorProfileTypeSerializer
    permission_classes = [AllowAnyReadAuthenticatedModelPermsWrite]
    parser_classes = [JSONParser, FormParser, MultiPartParser]


class CalculatorFillingTypeViewSet(viewsets.ModelViewSet):
    queryset = CalculatorFillingType.objects.all().prefetch_related("materials__material__uom")
    serializer_class = CalculatorFillingTypeSerializer
    permission_classes = [AllowAnyReadAuthenticatedModelPermsWrite]
    parser_classes = [JSONParser, FormParser, MultiPartParser]


class CalculatorHingeTypeViewSet(viewsets.ModelViewSet):
    queryset = CalculatorHingeType.objects.all().prefetch_related("materials__material__uom")
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
    """Заказы калькулятора: создаёт клиент (multipart PDF + snapshot); список — свои; сотрудник — все; PATCH статуса — только staff."""

    queryset = FacadeOrder.objects.all().select_related("user").order_by("-created_at")
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "head", "options"]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ("partial_update", "update"):
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
