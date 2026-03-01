from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"vlans", views.VLANViewSet, basename="vlan")
router.register(r"subnets", views.SubnetViewSet, basename="subnet")
router.register(r"hosts", views.HostViewSet, basename="host")
router.register(r"tunnels", views.TunnelViewSet, basename="tunnel")
router.register(r"dhcp-pools", views.DHCPPoolViewSet, basename="dhcppool")
router.register(r"device-types", views.DeviceTypeViewSet, basename="devicetype")
router.register(r"manufacturers", views.ManufacturerViewSet, basename="manufacturer")
router.register(r"device-models", views.DeviceModelViewSet, basename="devicemodel")
router.register(r"port-templates", views.PortTemplateViewSet, basename="porttemplate")
router.register(r"host-ports", views.HostPortViewSet, basename="hostport")
router.register(r"port-connections", views.PortConnectionViewSet, basename="portconnection")

urlpatterns = [
    path("", include(router.urls)),
]
router.register(r"host-notes", views.HostNoteViewSet, basename="hostnote")
router.register(r"host-files", views.HostFileViewSet, basename="hostfile")
router.register(r"site-files", views.SiteFileViewSet, basename="sitefile")
router.register(r"patch-panels", views.PatchPanelViewSet, basename="patchpanel")
router.register(r"patch-panel-ports", views.PatchPanelPortViewSet, basename="patchpanelport")
router.register(r"patch-panel-connections", views.PatchPanelConnectionViewSet, basename="patchpanelconnection")
router.register(r"racks", views.RackViewSet, basename="rack")
router.register(r"rack-units", views.RackUnitViewSet, basename="rackunit")
