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
}

export interface PortConnection {
  id: number
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
