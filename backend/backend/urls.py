"""URLs: the Django admin, the account endpoints (/api/auth/) and the app's API (/api/)."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    # CMMS (assets, maintenance plans, users, assistant) and OEE (events, downtime, cells, faults, products).
    path('api/', include('apiv1.urls')),
    path('api/', include('state.urls')),
]
