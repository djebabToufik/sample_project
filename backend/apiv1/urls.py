"""CMMS endpoints, under /api/ (backend/urls.py)."""

from django.urls import path
from rest_framework import routers

from .views import (
    AssetPhotoView,
    AssetViewSet,
    MaintenanceInstructionsView,
    MaintenancePlanViewSet,
    UserProfileViewSet,
)

router = routers.SimpleRouter()
router.register(r'assets', AssetViewSet, basename='assets')
router.register(r'maintenance-plans', MaintenancePlanViewSet, basename='maintenance-plans')
router.register(r'users', UserProfileViewSet, basename='users')

urlpatterns = router.urls + [
    path('assets/<uuid:pk>/photo/', AssetPhotoView.as_view(), name='asset-photo'),
    path(
        'maintenance-plans/<uuid:pk>/instructions/',
        MaintenanceInstructionsView.as_view(),
        name='maintenance-instructions',
    ),
]
