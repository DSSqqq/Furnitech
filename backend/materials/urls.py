from rest_framework.routers import DefaultRouter



from . import views



router = DefaultRouter()

router.register(r"material-classes", views.MaterialClassViewSet, basename="material-class")

router.register(
    r"material-class-categories",
    views.MaterialClassCategoryViewSet,
    basename="material-class-category",
)

router.register(
    r"calculation-formula-categories",
    views.CalculationFormulaCategoryViewSet,
    basename="calculation-formula-category",
)

router.register(r"calculation-formulas", views.CalculationFormulaViewSet, basename="calculation-formula")

router.register(r"uom", views.UnitOfMeasureViewSet, basename="uom")

router.register(r"categories", views.MaterialCategoryViewSet, basename="category")

router.register(r"texture-categories", views.TextureCategoryViewSet, basename="texture-category")

router.register(r"texture-items", views.TextureItemViewSet, basename="texture-item")

router.register(r"materials", views.MaterialViewSet, basename="material")

router.register(r"calculator-profiles", views.CalculatorProfileViewSet, basename="calculator-profile")

router.register(r"calculator-profile-types", views.CalculatorProfileTypeViewSet, basename="calculator-profile-type")

router.register(r"calculator-filling-types", views.CalculatorFillingTypeViewSet, basename="calculator-filling-type")

router.register(r"calculator-hinge-types", views.CalculatorHingeTypeViewSet, basename="calculator-hinge-type")

router.register(

    r"calculator-handle-hole-diameters",

    views.CalculatorHandleHoleDiameterViewSet,

    basename="calculator-handle-hole-diameter",

)

router.register(r"facade-orders", views.FacadeOrderViewSet, basename="facade-order")



urlpatterns = router.urls


