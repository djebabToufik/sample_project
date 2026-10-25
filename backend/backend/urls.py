"""URLs: the Django admin, the account endpoints (/api/auth/) and the app's API (/api/)."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    # CMMS (assets, maintenance plans, users, assistant) and OEE (events, downtime, cells, faults, products).
    path('api/', include('apiv1.urls')),
    path('api/', include('state.urls')),
    # API documentation, public: the OpenAPI schema and Swagger UI on top of it.
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='api-docs'),
]
