import re

from rest_framework import serializers

from apps.projects.models import Project, Site
from apps.projects.serializers import SiteWanAddressSerializer
from .models import (
    VLAN, Host, Subnet, Tunnel, DHCPPool, DeviceType, Manufacturer, DeviceModel,
    PortTemplate, HostPort, PortConnection, HostNote, HostFile, SiteFile,
    PatchPanel, PatchPanelPort, PatchPanelConnection,
    Rack, RackUnit,
    SiteNote, ProjectNote,
    SubscriberBox, SubscriberBoxPort, SubscriberBoxConnection,
    PanelPortTemplate, PanelPortTemplateEntry,
)
from .validators import (
    check_ip_duplicate_in_project, check_ip_in_subnet, check_subnet_overlap,
    check_pool_range_in_subnet, check_pool_overlap, check_static_ip_not_in_pool, check_lease_ip_in_pool,
)


class DeviceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceType
        fields = ["id", "value", "label", "position"]
        read_only_fields = ["id"]

    def validate_value(self, value):
        if not re.match(r'^[a-z0-9_]+$', value):
            raise serializers.ValidationError("Only lowercase letters, digits and underscores are allowed.")
        return value

    def update(self, instance, validated_data):
        validated_data.pop("value", None)
        return super().update(instance, validated_data)


class PortTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortTemplate
        fields = ["id", "device_model", "name", "port_type", "position"]
        read_only_fields = ["id"]


class DeviceModelSerializer(serializers.ModelSerializer):
    port_templates = PortTemplateSerializer(many=True, read_only=True)
    manufacturer_name = serializers.CharField(source="manufacturer.name", read_only=True)

    class Meta:
        model = DeviceModel
        fields = ["id", "manufacturer", "manufacturer_name", "name", "device_type", "description", "port_templates"]
        read_only_fields = ["id"]


class ManufacturerSerializer(serializers.ModelSerializer):
    device_models = DeviceModelSerializer(many=True, read_only=True)
    model_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Manufacturer
        fields = ["id", "name", "slug", "description", "model_count", "device_models"]
        read_only_fields = ["id"]


class HostPortSerializer(serializers.ModelSerializer):
    connected_to = serializers.SerializerMethodField()
    patch_connection = serializers.SerializerMethodField()

    class Meta:
        model = HostPort
        fields = ["id", "host", "name", "port_type", "description", "position", "connected_to", "patch_connection"]
        read_only_fields = ["id"]

    def get_connected_to(self, obj):
        conn = getattr(obj, 'connection_as_a', None) or getattr(obj, 'connection_as_b', None)
        if not conn:
            return None
        other_port = conn.port_b if conn.port_a_id == obj.id else conn.port_a
        other_host = other_port.host
        return {
            "connection_id": conn.id,
            "port_id": other_port.id,
            "port_name": other_port.name,
            "host_id": other_host.id,
            "host_name": other_host.hostname or str(other_host.ip_address),
        }

    def get_patch_connection(self, obj):
        pc = getattr(obj, 'patch_connection', None)
        if not pc:
            return None
        return {
            "connection_id": pc.id,
            "panel_port_id": pc.panel_port_id,
            "panel_name": pc.panel_port.panel.name,
            "port_number": pc.panel_port.port_number,
        }


class PortConnectionSerializer(serializers.ModelSerializer):
    port_a_name = serializers.CharField(source="port_a.name", read_only=True)
    port_b_name = serializers.CharField(source="port_b.name", read_only=True)
    port_a_type = serializers.CharField(source="port_a.port_type", read_only=True)
    port_b_type = serializers.CharField(source="port_b.port_type", read_only=True)
    host_a_id = serializers.IntegerField(source="port_a.host_id", read_only=True)
    host_b_id = serializers.IntegerField(source="port_b.host_id", read_only=True)
    host_a_name = serializers.SerializerMethodField()
    host_b_name = serializers.SerializerMethodField()

    class Meta:
        model = PortConnection
        fields = [
            "id", "project", "port_a", "port_b", "description", "created_at",
            "port_a_name", "port_b_name", "port_a_type", "port_b_type",
            "host_a_id", "host_b_id", "host_a_name", "host_b_name",
        ]
        read_only_fields = ["id", "created_at"]

    def get_host_a_name(self, obj):
        h = obj.port_a.host
        return h.hostname or str(h.ip_address)

    def get_host_b_name(self, obj):
        h = obj.port_b.host
        return h.hostname or str(h.ip_address)

    def validate(self, attrs):
        port_a = attrs.get("port_a") or (self.instance and self.instance.port_a)
        port_b = attrs.get("port_b") or (self.instance and self.instance.port_b)
        if port_a and port_b and port_a.id == port_b.id:
            raise serializers.ValidationError("A port cannot be connected to itself.")
        return attrs


class HostSerializer(serializers.ModelSerializer):
    ports = HostPortSerializer(many=True, read_only=True)
    device_model_name = serializers.SerializerMethodField()

    class Meta:
        model = Host
        fields = [
            "id", "subnet", "ip_address", "hostname", "mac_address",
            "device_type", "device_model", "device_model_name",
            "ip_type", "dhcp_pool",
            "description", "created_at", "updated_at", "ports",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_device_model_name(self, obj):
        if obj.device_model:
            return str(obj.device_model)
        return None

    def validate(self, attrs):
        device_type = attrs.get("device_type") or (self.instance and self.instance.device_type)
        if device_type and not DeviceType.objects.filter(value=device_type).exists():
            raise serializers.ValidationError({"device_type": f"Unknown device type: {device_type}"})

        subnet = attrs.get("subnet") or (self.instance and self.instance.subnet)
        ip_address = attrs.get("ip_address") or (self.instance and self.instance.ip_address)
        ip_type = attrs.get("ip_type") or (self.instance and self.instance.ip_type) or "static"
        dhcp_pool = attrs.get("dhcp_pool") or (self.instance and self.instance.dhcp_pool)

        if ip_address and subnet:
            check_ip_in_subnet(ip_address, subnet.network)
            project = subnet.project
            check_ip_duplicate_in_project(
                ip_address, project,
                exclude_pk=self.instance.pk if self.instance else None,
            )

        # DHCP-specific validation
        if ip_type == "static":
            if dhcp_pool:
                raise serializers.ValidationError(
                    {"dhcp_pool": "Static IP hosts cannot have a DHCP pool."}
                )
            if ip_address and subnet:
                check_static_ip_not_in_pool(ip_address, subnet)
        elif ip_type == "dhcp_lease":
            if not dhcp_pool:
                raise serializers.ValidationError(
                    {"dhcp_pool": "DHCP lease hosts must have a DHCP pool."}
                )
            if dhcp_pool.subnet_id != subnet.id:
                raise serializers.ValidationError(
                    {"dhcp_pool": "DHCP pool must belong to the same subnet as the host."}
                )
            if ip_address and dhcp_pool:
                check_lease_ip_in_pool(ip_address, dhcp_pool)

        return attrs


class DHCPPoolSerializer(serializers.ModelSerializer):
    lease_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = DHCPPool
        fields = [
            "id", "subnet", "start_ip", "end_ip", "description",
            "lease_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        subnet = attrs.get("subnet") or (self.instance and self.instance.subnet)
        start_ip = attrs.get("start_ip") or (self.instance and self.instance.start_ip)
        end_ip = attrs.get("end_ip") or (self.instance and self.instance.end_ip)

        if start_ip and end_ip and subnet:
            check_pool_range_in_subnet(start_ip, end_ip, subnet.network, gateway=subnet.gateway)
            check_pool_overlap(
                start_ip, end_ip, subnet,
                exclude_pk=self.instance.pk if self.instance else None,
            )

        return attrs


class SubnetSerializer(serializers.ModelSerializer):
    host_count = serializers.IntegerField(read_only=True, default=0)
    static_host_count = serializers.IntegerField(read_only=True, default=0)
    dhcp_pool_total_size = serializers.IntegerField(read_only=True, default=0)
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        required=False,
    )
    site = serializers.PrimaryKeyRelatedField(
        queryset=Site.objects.all(),
        required=False,
    )

    class Meta:
        model = Subnet
        fields = [
            "id", "project", "site", "vlan", "network", "gateway", "description",
            "host_count", "static_host_count", "dhcp_pool_total_size", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        vlan = attrs.get("vlan", self.instance.vlan if self.instance else None)
        site = attrs.get("site", self.instance.site if self.instance else None)
        project = attrs.get("project", self.instance.project if self.instance else None)
        network = attrs.get("network") or (self.instance and self.instance.network)

        # Auto-derive project/site from vlan when vlan is provided
        if vlan:
            attrs["site"] = vlan.site
            attrs["project"] = vlan.site.project
            site = vlan.site
            project = vlan.site.project
        else:
            # Without vlan, project and site are required
            if not project:
                raise serializers.ValidationError(
                    {"project": "Project is required when no VLAN is specified."}
                )
            if not site:
                raise serializers.ValidationError(
                    {"site": "Site is required when no VLAN is specified."}
                )
            # Validate site belongs to project
            if site.project_id != project.id:
                raise serializers.ValidationError(
                    {"site": "Site does not belong to the specified project."}
                )

        if network and project:
            check_subnet_overlap(
                network, project,
                exclude_pk=self.instance.pk if self.instance else None,
            )

        return attrs


class VLANSerializer(serializers.ModelSerializer):
    subnet_count = serializers.IntegerField(read_only=True, default=0)
    host_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = VLAN
        fields = [
            "id", "site", "vlan_id", "name", "purpose", "description",
            "subnet_count", "host_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class TunnelSerializer(serializers.ModelSerializer):
    site_a_name = serializers.CharField(source="site_a.name", read_only=True)
    site_b_name = serializers.CharField(source="site_b.name", read_only=True, default=None)
    site_b_project_id = serializers.IntegerField(source="site_b.project_id", read_only=True, default=None)
    site_b_project_name = serializers.CharField(source="site_b.project.name", read_only=True, default=None)

    class Meta:
        model = Tunnel
        fields = [
            "id", "project", "name", "tunnel_type", "tunnel_subnet",
            "site_a", "site_a_name", "ip_a",
            "site_b", "site_b_name", "site_b_project_id", "site_b_project_name", "ip_b",
            "external_endpoint",
            "enabled", "description", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        site_b = attrs.get("site_b")
        external = attrs.get("external_endpoint", "")
        if site_b and external:
            raise serializers.ValidationError("Cannot set both site_b and external_endpoint.")
        if not site_b and not external:
            raise serializers.ValidationError("Either site_b or external_endpoint is required.")
        site_a = attrs.get("site_a") or (self.instance and self.instance.site_a)
        project = attrs.get("project") or (self.instance and self.instance.project)
        if site_a and project and site_a.project_id != project.id:
            raise serializers.ValidationError({"site_a": "Site A must belong to the tunnel's project."})
        return attrs



# ─── SiteFile serializer ─────────────────────────────────────────────────────

class SiteFileSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = SiteFile
        fields = ["id", "site", "name", "file", "size", "url", "created_at"]
        read_only_fields = ["id", "size", "url", "created_at"]

    def get_url(self, obj):
        request = self.context.get("request")
        if request and obj.file:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None

    def create(self, validated_data):
        file_obj = validated_data.get("file")
        if file_obj:
            validated_data["size"] = file_obj.size
            validated_data["name"] = validated_data.get("name") or file_obj.name
        return super().create(validated_data)


# ─── HostNote / HostFile serializers ─────────────────────────────────────────

class HostNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostNote
        fields = ["id", "host", "content", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class HostFileSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = HostFile
        fields = ["id", "host", "name", "file", "size", "url", "created_at"]
        read_only_fields = ["id", "size", "url", "created_at"]

    def get_url(self, obj):
        request = self.context.get("request")
        if request and obj.file:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None

    def create(self, validated_data):
        file_obj = validated_data.get("file")
        if file_obj:
            validated_data["size"] = file_obj.size
            validated_data["name"] = validated_data.get("name") or file_obj.name
        return super().create(validated_data)


# --- Topology serializers (nested, read-only) ---

class HostTopologySerializer(serializers.ModelSerializer):
    class Meta:
        model = Host
        fields = ["id", "ip_address", "hostname", "device_type", "ip_type", "dhcp_pool"]


class DHCPPoolTopologySerializer(serializers.ModelSerializer):
    leases = HostTopologySerializer(many=True, read_only=True)

    class Meta:
        model = DHCPPool
        fields = ["id", "start_ip", "end_ip", "description", "leases"]


class SubnetTopologySerializer(serializers.ModelSerializer):
    hosts = serializers.SerializerMethodField()
    dhcp_pools = DHCPPoolTopologySerializer(many=True, read_only=True)

    class Meta:
        model = Subnet
        fields = ["id", "network", "gateway", "description", "hosts", "dhcp_pools"]

    def get_hosts(self, obj):
        """Only return static hosts at the subnet level."""
        qs = obj.hosts.filter(ip_type="static")
        return HostTopologySerializer(qs, many=True).data


class VLANTopologySerializer(serializers.ModelSerializer):
    subnets = SubnetTopologySerializer(many=True, read_only=True)

    class Meta:
        model = VLAN
        fields = ["id", "vlan_id", "name", "purpose", "subnets"]


class SiteTopologySerializer(serializers.ModelSerializer):
    vlans = VLANTopologySerializer(many=True, read_only=True)
    wan_addresses = SiteWanAddressSerializer(many=True, read_only=True)
    standalone_subnets = serializers.SerializerMethodField()
    latitude = serializers.FloatField(allow_null=True)
    longitude = serializers.FloatField(allow_null=True)

    class Meta:
        model = Site
        fields = ["id", "name", "address", "latitude", "longitude", "wan_addresses", "vlans", "standalone_subnets"]

    def get_standalone_subnets(self, obj):
        qs = obj.subnets.filter(vlan__isnull=True)
        return SubnetTopologySerializer(qs, many=True).data


class TunnelTopologySerializer(serializers.ModelSerializer):
    site_a_name = serializers.CharField(source="site_a.name", read_only=True)
    site_b_name = serializers.CharField(source="site_b.name", read_only=True, default=None)
    site_b_project_id = serializers.IntegerField(source="site_b.project_id", read_only=True, default=None)
    site_b_project_name = serializers.CharField(source="site_b.project.name", read_only=True, default=None)
    site_b_latitude = serializers.FloatField(source="site_b.latitude", read_only=True, default=None)
    site_b_longitude = serializers.FloatField(source="site_b.longitude", read_only=True, default=None)

    class Meta:
        model = Tunnel
        fields = [
            "id", "project", "name", "tunnel_type", "tunnel_subnet",
            "site_a", "site_a_name", "ip_a",
            "site_b", "site_b_name", "site_b_project_id", "site_b_project_name",
            "site_b_latitude", "site_b_longitude", "ip_b",
            "external_endpoint", "enabled",
        ]


class ProjectTopologySerializer(serializers.Serializer):
    """Full topology data for a project - used by the topology view."""
    sites = SiteTopologySerializer(many=True, read_only=True)
    tunnels = TunnelTopologySerializer(many=True, read_only=True)
    standalone_subnets = SubnetTopologySerializer(many=True, read_only=True)

# ─── PatchPanel serializers ───────────────────────────────────────────────────


class PatchPanelPortSerializer(serializers.ModelSerializer):
    label_display = serializers.SerializerMethodField()
    device_port_info = serializers.SerializerMethodField()

    class Meta:
        model = PatchPanelPort
        fields = ['id', 'panel', 'port_number', 'label', 'label_display', 'back_media_type', 'device_port_info']
        read_only_fields = ['id', 'label_display', 'device_port_info']

    def get_label_display(self, obj):
        return obj.label or f'Port {obj.port_number}'

    def get_device_port_info(self, obj):
        conn = obj.connections.select_related(
            'device_port__host', 'far_panel_port__panel'
        ).first()
        if not conn:
            return None
        result = {'connection_id': conn.id}
        if conn.device_port:
            host = conn.device_port.host
            result['device_port_id'] = conn.device_port.id
            result['device_port_name'] = conn.device_port.name
            result['host_id'] = host.id
            result['host_name'] = host.hostname or str(host.ip_address)
        if conn.far_panel_port:
            result['far_panel_port_id'] = conn.far_panel_port.id
            result['far_panel_port_number'] = conn.far_panel_port.port_number
            result['far_panel_name'] = conn.far_panel_port.panel.name
        return result


class PatchPanelSerializer(serializers.ModelSerializer):
    ports = PatchPanelPortSerializer(many=True, read_only=True)
    site_name = serializers.CharField(source='site.name', read_only=True)

    class Meta:
        model = PatchPanel
        fields = ['id', 'site', 'site_name', 'name', 'media_type', 'port_count',
                  'location', 'description', 'created_at', 'ports']
        read_only_fields = ['id', 'created_at', 'site_name']


class PatchPanelConnectionSerializer(serializers.ModelSerializer):
    panel_name = serializers.CharField(source='panel_port.panel.name', read_only=True)
    panel_port_number = serializers.IntegerField(source='panel_port.port_number', read_only=True)
    device_port_name = serializers.CharField(source='device_port.name', read_only=True)
    host_id = serializers.IntegerField(source='device_port.host.id', read_only=True)
    host_name = serializers.SerializerMethodField()
    far_panel_name = serializers.SerializerMethodField()
    far_panel_port_number = serializers.SerializerMethodField()

    class Meta:
        model = PatchPanelConnection
        fields = ['id', 'project', 'device_port', 'panel_port', 'far_panel_port',
                  'description', 'created_at',
                  'panel_name', 'panel_port_number',
                  'device_port_name', 'host_id', 'host_name',
                  'far_panel_name', 'far_panel_port_number']
        read_only_fields = ['id', 'created_at']

    def get_host_name(self, obj):
        if obj.device_port:
            h = obj.device_port.host
            return h.hostname or str(h.ip_address)
        return None

    def get_far_panel_name(self, obj):
        return obj.far_panel_port.panel.name if obj.far_panel_port else None

    def get_far_panel_port_number(self, obj):
        return obj.far_panel_port.port_number if obj.far_panel_port else None

# ─── Rack serializers ─────────────────────────────────────────────────────────


class RackUnitSerializer(serializers.ModelSerializer):
    host_name = serializers.SerializerMethodField()
    host_ip = serializers.SerializerMethodField()
    host_device_type = serializers.SerializerMethodField()
    host_model_name = serializers.SerializerMethodField()
    patch_panel_name = serializers.CharField(source='patch_panel.name', read_only=True)
    patch_panel_media_type = serializers.CharField(source='patch_panel.media_type', read_only=True)

    class Meta:
        model = RackUnit
        fields = [
            'id', 'rack', 'host', 'patch_panel', 'position_u', 'height_u', 'face',
            'label', 'item_type', 'color', 'created_at',
            'host_name', 'host_ip', 'host_device_type', 'host_model_name',
            'patch_panel_name', 'patch_panel_media_type',
        ]
        read_only_fields = ['id', 'created_at']

    def get_host_name(self, obj):
        if obj.host:
            return obj.host.hostname or str(obj.host.ip_address).split('/')[0]
        return None

    def get_host_ip(self, obj):
        if obj.host:
            return str(obj.host.ip_address).split('/')[0]
        return None

    def get_host_device_type(self, obj):
        if obj.host:
            return obj.host.device_type
        return None

    def get_host_model_name(self, obj):
        if obj.host and obj.host.device_model:
            return str(obj.host.device_model)
        return None


class RackSerializer(serializers.ModelSerializer):
    rack_units = RackUnitSerializer(many=True, read_only=True)
    site_name = serializers.CharField(source='site.name', read_only=True)
    used_u = serializers.SerializerMethodField()

    class Meta:
        model = Rack
        fields = [
            'id', 'site', 'site_name', 'name', 'facility_id', 'status', 'rack_type',
            'height_u', 'numbering_desc', 'width_mm', 'depth_mm',
            'serial_number', 'asset_tag', 'location', 'description',
            'created_at', 'updated_at', 'rack_units', 'used_u',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_used_u(self, obj):
        return sum(u.height_u for u in obj.rack_units.all())


# ─── Site / Project Notes ─────────────────────────────────────────────────────


class SiteNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteNote
        fields = ['id', 'site', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProjectNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectNote
        fields = ['id', 'project', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


# ─── SubscriberBox ────────────────────────────────────────────────────────────



class SubscriberBoxPortSerializer(serializers.ModelSerializer):
    direction_display = serializers.CharField(source='get_direction_display', read_only=True)
    media_display = serializers.SerializerMethodField()
    connection_info = serializers.SerializerMethodField()

    class Meta:
        model = SubscriberBoxPort
        fields = ['id', 'box', 'port_number', 'label', 'direction', 'direction_display',
                  'media_type', 'media_display', 'connection_info']
        read_only_fields = ['id', 'direction_display', 'media_display', 'connection_info']

    def get_media_display(self, obj):
        return obj.get_media_type_display()

    def get_connection_info(self, obj):
        try:
            c = obj.connection
            result = {'connection_id': c.id}
            if c.panel_port:
                result['panel_port_id'] = c.panel_port.id
                result['panel_name'] = c.panel_port.panel.name
                result['panel_port_number'] = c.panel_port.port_number
            if c.device_port:
                result['device_port_id'] = c.device_port.id
                result['device_port_name'] = c.device_port.name
                result['host_name'] = c.device_port.host.hostname or str(c.device_port.host.ip_address)
            return result
        except Exception:
            return None


class SubscriberBoxSerializer(serializers.ModelSerializer):
    ports = SubscriberBoxPortSerializer(many=True, read_only=True)
    site_name = serializers.CharField(source='site.name', read_only=True)
    box_type_display = serializers.CharField(source='get_box_type_display', read_only=True)
    trunk_count = serializers.SerializerMethodField()
    drop_count = serializers.SerializerMethodField()

    class Meta:
        model = SubscriberBox
        fields = ['id', 'site', 'site_name', 'name', 'box_type', 'box_type_display',
                  'location', 'description', 'created_at', 'ports', 'trunk_count', 'drop_count']
        read_only_fields = ['id', 'site_name', 'box_type_display', 'created_at']

    def get_trunk_count(self, obj):
        return sum(1 for p in obj.ports.all() if p.direction == 'trunk')

    def get_drop_count(self, obj):
        return sum(1 for p in obj.ports.all() if p.direction == 'drop')


class SubscriberBoxConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriberBoxConnection
        fields = ['id', 'box_port', 'panel_port', 'device_port', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


# ─── PanelPortTemplate ────────────────────────────────────────────────────────

class PanelPortTemplateEntrySerializer(serializers.ModelSerializer):
    media_display = serializers.CharField(source='get_media_type_display', read_only=True)
    face_display = serializers.CharField(source='get_face_display', read_only=True)

    class Meta:
        model = PanelPortTemplateEntry
        fields = ['id', 'template', 'count', 'media_type', 'media_display',
                  'face', 'face_display', 'label_prefix', 'sort_order']
        read_only_fields = ['id', 'media_display', 'face_display']


class PanelPortTemplateSerializer(serializers.ModelSerializer):
    entries = PanelPortTemplateEntrySerializer(many=True, read_only=True)
    summary = serializers.SerializerMethodField()

    class Meta:
        model = PanelPortTemplate
        fields = ['id', 'name', 'description', 'created_at', 'entries', 'summary']
        read_only_fields = ['id', 'created_at', 'entries', 'summary']

    def get_summary(self, obj):
        parts = []
        for e in obj.entries.all():
            parts.append(f"{e.count}×{e.get_media_type_display().split('—')[-1].strip()} ({e.face})")
        return ' + '.join(parts) if parts else '—'
