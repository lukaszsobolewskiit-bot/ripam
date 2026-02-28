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

urlpatterns = [
    path("", include(router.urls)),
]
