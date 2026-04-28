from django.contrib import admin

from .models import (
    CalculatorFillingType,
    CalculatorFillingTypeMaterial,
    Material,
    MaterialAlternativePrice,
    MaterialCategory,
    MaterialClass,
    MaterialOperationLine,
    MaterialRelatedItem,
    UnitOfMeasure,
)


@admin.register(MaterialClass)
class MaterialClassAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "external_id")
    search_fields = ("name", "code", "external_id")


@admin.register(UnitOfMeasure)
class UnitOfMeasureAdmin(admin.ModelAdmin):
    list_display = ("name", "short_name", "code", "external_id")
    search_fields = ("name", "code")


class MaterialCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "sort_order", "code", "external_id")
    list_filter = ("parent",)
    search_fields = ("name", "code", "external_id")
    raw_id_fields = ("parent",)


admin.site.register(MaterialCategory, MaterialCategoryAdmin)


class MaterialAdmin(admin.ModelAdmin):
    list_display = ("name", "article", "category", "fnp_name", "base_price", "base_currency", "is_active")
    list_filter = ("category", "rounding_mode", "is_active")
    search_fields = ("name", "article", "fnp_name", "external_id")
    raw_id_fields = ("category", "uom")
    filter_horizontal = ("material_classes",)


@admin.register(MaterialAlternativePrice)
class MaterialAlternativePriceAdmin(admin.ModelAdmin):
    list_display = ("material", "currency", "price")
    list_filter = ("currency",)
    search_fields = ("material__name", "currency")


admin.site.register(Material, MaterialAdmin)


@admin.register(MaterialRelatedItem)
class MaterialRelatedItemAdmin(admin.ModelAdmin):
    list_display = ("parent", "related_material", "quantity", "quantity_scale", "sort_order")
    raw_id_fields = ("parent", "related_material")


@admin.register(MaterialOperationLine)
class MaterialOperationLineAdmin(admin.ModelAdmin):
    list_display = ("material", "name", "quantity", "price", "price_per_facade", "sort_order")
    raw_id_fields = ("material", "uom")


class CalculatorFillingTypeMaterialInline(admin.TabularInline):
    model = CalculatorFillingTypeMaterial
    extra = 0
    raw_id_fields = ("material",)


@admin.register(CalculatorFillingType)
class CalculatorFillingTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "sort_order")
    list_filter = ("is_active",)
    search_fields = ("name",)
    inlines = (CalculatorFillingTypeMaterialInline,)
