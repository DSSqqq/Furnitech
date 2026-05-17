from django.contrib import admin

from .models import (
    CalculationFormula,
    CalculationFormulaCategory,
    CalculatorFillingType,
    CalculatorFillingTypeMaterial,
    CalculatorHandleHoleDiameter,
    CalculatorHingeType,
    CalculatorHingeTypeMaterial,
    FacadeOrder,
    Material,
    MaterialCategory,
    MaterialClass,
    MaterialClassCategory,
    MaterialRelatedItem,
    TextureCategory,
    TextureItem,
    UnitOfMeasure,
)


class MaterialClassCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "sort_order", "code")
    list_filter = ("parent",)
    search_fields = ("name", "code")
    raw_id_fields = ("parent",)


admin.site.register(MaterialClassCategory, MaterialClassCategoryAdmin)


@admin.register(MaterialClass)
class MaterialClassAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "code", "external_id")
    search_fields = ("name", "code", "external_id")
    raw_id_fields = ("category",)


class CalculationFormulaCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "sort_order", "code")
    list_filter = ("parent",)
    search_fields = ("name", "code")
    raw_id_fields = ("parent",)


admin.site.register(CalculationFormulaCategory, CalculationFormulaCategoryAdmin)


@admin.register(CalculationFormula)
class CalculationFormulaAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_active", "sort_order", "updated_at")
    list_filter = ("is_active", "category")
    search_fields = ("name", "expression")
    raw_id_fields = ("category",)


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


class TextureCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "sort_order", "code")
    list_filter = ("parent",)
    search_fields = ("name", "code")
    raw_id_fields = ("parent",)


admin.site.register(TextureCategory, TextureCategoryAdmin)


@admin.register(TextureItem)
class TextureItemAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "updated_at")
    list_filter = ("category",)
    search_fields = ("name",)
    raw_id_fields = ("category",)


class MaterialAdmin(admin.ModelAdmin):
    list_display = ("name", "article", "category", "base_price", "base_currency", "is_active")
    list_filter = ("category", "rounding_mode", "is_active")
    search_fields = ("name", "article", "external_id")
    raw_id_fields = ("category", "uom", "texture_item")
    filter_horizontal = ("material_classes",)


admin.site.register(Material, MaterialAdmin)


@admin.register(MaterialRelatedItem)
class MaterialRelatedItemAdmin(admin.ModelAdmin):
    list_display = ("parent", "related_material", "quantity", "quantity_scale", "sort_order")
    raw_id_fields = ("parent", "related_material")


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


class CalculatorHingeTypeMaterialInline(admin.TabularInline):
    model = CalculatorHingeTypeMaterial
    extra = 0
    raw_id_fields = ("material",)


@admin.register(CalculatorHingeType)
class CalculatorHingeTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "sort_order")
    list_filter = ("is_active",)
    search_fields = ("name",)
    inlines = (CalculatorHingeTypeMaterialInline,)


@admin.register(CalculatorHandleHoleDiameter)
class CalculatorHandleHoleDiameterAdmin(admin.ModelAdmin):
    list_display = ("diameter_mm", "client_visible", "sort_order")
    list_filter = ("client_visible",)
    ordering = ("sort_order", "diameter_mm")


@admin.register(FacadeOrder)
class FacadeOrderAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "contact_phone", "contact_email", "created_at")
    list_filter = ("status",)
    search_fields = ("contact_name", "contact_phone", "contact_email", "user__username")
    raw_id_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")
