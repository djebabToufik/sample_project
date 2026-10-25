from django.contrib import admin

from .models import Asset, MaintenancePlan, Organization, UserProfile

admin.site.register(Organization)
admin.site.register(UserProfile)
admin.site.register(Asset)
admin.site.register(MaintenancePlan)

# Register your models here.
