from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"material-classes", views.MaterialClassViewSet, basename="material-class")
router.register(r"uom", views.UnitOfMeasureViewSet, basename="uom")
router.register(r"categories", views.MaterialCategoryViewSet, basename="category")
router.register(r"materials", views.MaterialViewSet, basename="material")
router.register(r"calculator-profiles", views.CalculatorProfileViewSet, basename="calculator-profile")
router.register(r"calculator-profile-types", views.CalculatorProfileTypeViewSet, basename="calculator-profile-type")

urlpatterns = router.urls
