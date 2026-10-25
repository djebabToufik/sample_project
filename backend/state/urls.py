"""OEE endpoints, under /api/ (backend/urls.py)."""

from django.urls import path
from rest_framework import routers

from .views import CellViewSet, DowntimeViewSet, EventAutoViewSet, LineStateView, MachineFaultViewSet, ProductViewSet

router = routers.SimpleRouter()
router.register(r'events', EventAutoViewSet, basename='events')
router.register(r'downtime', DowntimeViewSet, basename='downtime')
router.register(r'cells', CellViewSet, basename='cells')
router.register(r'faults', MachineFaultViewSet, basename='faults')
router.register(r'products', ProductViewSet, basename='products')

urlpatterns = [
    # Machine states from other software (the gateway): the server writes the events.
    path('line-states/', LineStateView.as_view(), name='line-states'),
    *router.urls,
]
