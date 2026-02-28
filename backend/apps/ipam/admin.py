from django.contrib import admin

from .models import VLAN, Host, Subnet, Tunnel, DeviceType, Manufacturer, DeviceModel, PortTemplate, HostPort
# Register signals
from . import signals  # noqa: F401


class SubnetInline(admin.TabularInline):
    model = Subnet
    extra = 0


class HostInline(admin.TabularInline):
    model = Host
    extra = 0


class PortTemplateInline(admin.TabularInline):
    model = PortTemplate
    extra = 1


class HostPortInline(admin.TabularInline):
    model = HostPort
    extra = 0


@admin.register(VLAN)
class VLANAdmin(admin.ModelAdmin):
    list_display = ("vlan_id", "name", "site", "purpose")
    list_filter = ("site__project", "site")
    search_fields = ("name", "purpose")
    inlines = [SubnetInline]


@admin.register(Subnet)
class SubnetAdmin(admin.ModelAdmin):
    list_display = ("network", "gateway", "vlan", "project", "site", "description")
    list_filter = ("project",)
    search_fields = ("description",)
    inlines = [HostInline]


@admin.register(Host)
class HostAdmin(admin.ModelAdmin):
    list_display = ("ip_address", "hostname", "device_type", "device_model", "subnet")
    list_filter = ("device_type", "subnet__project")
    search_fields = ("hostname", "description")
    inlines = [HostPortInline]


@admin.register(DeviceType)
class DeviceTypeAdmin(admin.ModelAdmin):
    list_display = ("value", "label", "position")
    ordering = ("position",)


@admin.register(Manufacturer)
class ManufacturerAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(DeviceModel)
class DeviceModelAdmin(admin.ModelAdmin):
    list_display = ("name", "manufacturer", "device_type")
    list_filter = ("manufacturer",)
    inlines = [PortTemplateInline]


@admin.register(Tunnel)
class TunnelAdmin(admin.ModelAdmin):
    list_display = ("name", "tunnel_type", "tunnel_subnet", "site_a", "site_b", "enabled")
    list_filter = ("tunnel_type", "enabled", "project")
    search_fields = ("name",)
