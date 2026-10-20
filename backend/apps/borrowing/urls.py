from rest_framework.routers import DefaultRouter
from .views import BorrowViewSet

router = DefaultRouter()
router.register("borrows", BorrowViewSet, basename="borrow")
urlpatterns = router.urls
