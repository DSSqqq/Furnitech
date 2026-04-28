from rest_framework import filters, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import (
    SAFE_METHODS,
    BasePermission,
    DjangoModelPermissions,
    IsAuthenticated,
)
from rest_framework.response import Response

from .models import (
    CalculatorFillingType,
    CalculatorProfile,
    CalculatorProfileType,
    Material,
    MaterialCategory,
    MaterialClass,
    UnitOfMeasure,
)
from .serializers import (
    CalculatorFillingTypeSerializer,
    CalculatorProfileSerializer,
    CalculatorProfileTypeSerializer,
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


class MaterialCategoryViewSet(viewsets.ModelViewSet):
    queryset = MaterialCategory.objects.all()
    serializer_class = MaterialCategorySerializer
    permission_classes = [DjangoModelPermissions]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if MaterialCategory.objects.filter(parent=instance).exists():
            return Response(
                {
                    "detail": "Сначала удалите или перенесите вложенные папки.",
                },
                status=400,
            )
        if Material.objects.filter(category=instance).exists():
            return Response(
                {
                    "detail": "В папке есть материалы. Перенесите или удалите их.",
                },
                status=400,
            )
        return super().destroy(request, *args, **kwargs)

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
