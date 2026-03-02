export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  first_name: string
  last_name: string
  is_active?: boolean
}

export interface UserAdmin {
  id: number
  username: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  first_name: string
  last_name: string
  is_active: boolean
  password?: string
}

export interface Project {
  id: number
  name: string
  description: string
  supernet: string | null
  created_by: number | null
  created_by_username: string | null
  site_count: number
  created_at: string
  updated_at: string
}

export interface SiteWanAddress {
  id?: number
  ip_address: string
  label: string
}

export interface Site {
  id: number
  project: number
  name: string
  address: string
  supernet: string | null
  latitude: number | null
  longitude: number | null
  vlan_count: number
  host_count: number
  wan_addresses: SiteWanAddress[]
  created_at: string
  updated_at: string
}

export interface VLAN {
  id: number
  site: number
  vlan_id: number
  name: string
  purpose: string
  description: string
  subnet_count: number
  host_count: number
  created_at: string
  updated_at: string
}

export interface Subnet {
  id: number
  project: number
  site: number
  vlan: number | null
  network: string
  gateway: string | null
  description: string
  host_count: number
  static_host_count: number
  dhcp_pool_total_size: number
  created_at: string
  updated_at: string
}

export interface DeviceTypeOption {
  id: number
  value: string
  label: string
  position: number
}

export type PortType = 'rj45' | 'sfp' | 'sfp+' | 'qsfp' | 'usb' | 'serial'

export interface PortTemplate {
  id: number
  device_model: number
  name: string
  port_type: PortType
  position: number
}

export interface DeviceModel {
  id: number
  manufacturer: number
  manufacturer_name: string
  name: string
  device_type: string
  description: string
  port_templates: PortTemplate[]
}

export interface Manufacturer {
  id: number
  name: string
  slug: string
  description: string
  model_count: number
  device_models: DeviceModel[]
}

export interface HostPort {
  id: number
  host: number
  name: string
  port_type: PortType
  description: string
  position: number
  connected_to: {
    connection_id: number
    port_id: number
    port_name: string
    host_id: number
    host_name: string
  } | null
  patch_connection: {
    connection_id: number
    panel_port_id: number
    panel_name: string
    port_number: number
  } | null
}

export interface SiteFile {
  id: number
  site: number
  name: string
  file: string
  size: number
  url: string
  created_at: string
}




export interface PDUOutlet {
  id: number
  pdu: number
  outlet_number: number
  label: string
  rack_unit: number | null
  rack_unit_label: string | null
  rack_unit_type: string | null
  current_a: string | null
  is_on: boolean
}

export interface PDU {
  id: number
  rack_unit: number
  name: string
  pdu_type: string
  pdu_type_display: string
  outlet_type: string
  outlet_type_display: string
  outlet_count: number
  max_ampere: number
  voltage: number
  manufacturer: string
  model_name: string
  serial_number: string
  description: string
  created_at: string
  outlets: PDUOutlet[]
  used_outlets: number
}

export interface SubscriberBoxPort {
  id: number
  box: number
  port_number: number
  label: string
  direction: 'trunk' | 'drop'
  direction_display: string
  media_type: string
  media_display: string
  connection_info: {
    connection_id: number
    panel_port_id?: number
    panel_name?: string
    panel_port_number?: number
    device_port_id?: number
    device_port_name?: string
    host_name?: string
  } | null
}

export interface SubscriberBox {
  id: number
  site: number | null
  site_name: string | null
  name: string
  box_type: string
  box_type_display: string
  location: string
  description: string
  created_at: string
  ports: SubscriberBoxPort[]
  trunk_count: number
  drop_count: number
}

export interface PanelPortTemplateEntry {
  id: number
  template: number
  count: number
  media_type: string
  media_display: string
  face: 'front' | 'back'
  face_display: string
  label_prefix: string
  sort_order: number
}

export interface PanelPortTemplate {
  id: number
  name: string
  description: string
  created_at: string
  entries: PanelPortTemplateEntry[]
  summary: string
}

export interface SiteNote {
  id: number
  site: number
  content: string
  created_at: string
  updated_at: string
}

export interface ProjectNote {
  id: number
  project: number
  content: string
  created_at: string
  updated_at: string
}

export interface HostNote {
  id: number
  host: number
  content: string
  created_at: string
  updated_at: string
}

export interface HostFile {
  id: number
  host: number
  name: string
  file: string
  size: number
  url: string
  created_at: string
}



export type RackStatus = 'active' | 'planned' | 'reserved' | 'decommissioning' | 'retired'
export type RackType = '2post_open' | '2post_closed' | '4post_open' | '4post_closed' | 'wall_open' | 'wall_closed'
export type RackItemType = 'device' | 'patch_panel' | 'cable_mgmt' | 'blank' | 'pdu' | 'ups' | 'other'

export interface RackUnit {
  id: number
  rack: number
  host: number | null
  patch_panel: number | null
  position_u: number
  height_u: number
  face: 'front' | 'rear'
  label: string
  item_type: RackItemType
  color: string
  created_at: string
  // read-only denorm
  host_name: string | null
  host_ip: string | null
  host_device_type: string | null
  host_model_name: string | null
  patch_panel_name: string | null
  patch_panel_media_type: string | null
}

export interface Rack {
  id: number
  site: number
  site_name: string
  name: string
  facility_id: string
  status: RackStatus
  rack_type: RackType
  height_u: number
  numbering_desc: boolean
  width_mm: number
  depth_mm: number
  serial_number: string
  asset_tag: string
  location: string
  description: string
  created_at: string
  updated_at: string
  rack_units: RackUnit[]
  used_u: number
}

export interface PatchPanelPort {
  id: number
  panel: number
  port_number: number
  label: string
  label_display: string
  back_media_type: string
  device_port_info: {
    connection_id: number
    device_port_id?: number
    device_port_name?: string
    host_id?: number
    host_name?: string
    far_panel_port_id?: number
    far_panel_port_number?: number
    far_panel_name?: string
  } | null
}

export interface PatchPanel {
  id: number
  site: number | null
  site_name: string | null
  name: string
  media_type: 'copper' | 'fiber_lc' | 'fiber_sc' | 'fiber_st' | 'fiber_mtp'
  port_count: number
  location: string
  description: string
  created_at: string
  ports: PatchPanelPort[]
}

export interface PatchPanelConnection {
  id: number
  project?: number
  device_port: number | null
  panel_port: number
  far_panel_port: number | null
  description: string
  created_at: string
  panel_name: string
  panel_port_number: number
  device_port_name: string | null
  host_id: number | null
  host_name: string | null
  far_panel_name: string | null
  far_panel_port_number: number | null
}

export interface PortConnection {
  id: number
  project?: number
  port_a: number
  port_b: number
  description: string
  created_at: string
  port_a_name: string
  port_b_name: string
  port_a_type: PortType
  port_b_type: PortType
  host_a_id: number
  host_b_id: number
  host_a_name: string
  host_b_name: string
}

export interface Host {
  id: number
  subnet: number
  ip_address: string
  hostname: string
  mac_address: string
  device_type: string
  device_model: number | null
  device_model_name: string | null
  ip_type: 'static' | 'dhcp_lease'
  dhcp_pool: number | null
  description: string
  created_at: string
  updated_at: string
  ports: HostPort[]
}

export interface DHCPPool {
  id: number
  subnet: number
  start_ip: string
  end_ip: string
  description: string
  lease_count: number
  created_at: string
  updated_at: string
}

export type TunnelType = 'gre' | 'ipsec' | 'vxlan' | 'wireguard'

export interface Tunnel {
  id: number
  project: number
  name: string
  tunnel_type: TunnelType
  tunnel_subnet: string
  site_a: number
  site_a_name: string
  ip_a: string
  site_b: number | null
  site_b_name: string | null
  site_b_project_id: number | null
  site_b_project_name: string | null
  ip_b: string
  external_endpoint: string
  enabled: boolean
  description: string
  created_at: string
  updated_at: string
}

// Topology types (nested read-only from /api/v1/projects/{id}/topology/)
export interface HostTopology {
  id: number
  ip_address: string
  hostname: string
  device_type: string
  ip_type: 'static' | 'dhcp_lease'
  dhcp_pool: number | null
}

export interface DHCPPoolTopology {
  id: number
  start_ip: string
  end_ip: string
  description: string
  leases: HostTopology[]
}

export interface SubnetTopology {
  id: number
  network: string
  gateway: string | null
  description: string
  hosts: HostTopology[]
  dhcp_pools: DHCPPoolTopology[]
}

export interface VLANTopology {
  id: number
  vlan_id: number
  name: string
  purpose: string
  subnets: SubnetTopology[]
}

export interface SiteTopology {
  id: number
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  wan_addresses: SiteWanAddress[]
  vlans: VLANTopology[]
  standalone_subnets: SubnetTopology[]
}

export interface TunnelTopology {
  id: number
  project: number
  name: string
  tunnel_type: TunnelType
  tunnel_subnet: string
  site_a: number
  site_a_name: string
  ip_a: string
  site_b: number | null
  site_b_name: string | null
  site_b_project_id: number | null
  site_b_project_name: string | null
  site_b_latitude: number | null
  site_b_longitude: number | null
  ip_b: string
  external_endpoint: string
  enabled: boolean
}

export interface ProjectTopology {
  sites: SiteTopology[]
  tunnels: TunnelTopology[]
}

// Search
export interface SearchResult {
  type: 'host' | 'subnet' | 'vlan' | 'site' | 'project'
  id: number
  label: string
  secondary: string
  breadcrumb: string
  project_id: number
  site_id?: number
  vlan_id?: number
  subnet_id?: number
}

// Paginated response
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// Audit
export interface AuditLog {
  id: number
  username: string | null
  action: 'create' | 'update' | 'delete'
  content_type: number
  object_id: number
  object_repr: string
  changes: Record<string, unknown>
  project_id: number | null
  timestamp: string
}
