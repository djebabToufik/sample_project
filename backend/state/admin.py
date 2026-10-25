from django.contrib import admin

from .models import Cell, Event, MachineFault, Product


class EventFilter(admin.ModelAdmin):
    list_filter = ["machine"]
    ordering = ['-created_at']


admin.site.register(MachineFault, EventFilter)
admin.site.register(Cell)
admin.site.register(Product)
admin.site.register(Event, EventFilter)
