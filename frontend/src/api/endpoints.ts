import type {
  Project, Site, VLAN, Subnet, Host, Tunnel, DHCPPool, DeviceTypeOption,
  ProjectTopology, SearchResult, PaginatedResponse, AuditLog, User, UserAdmin,
  Manufacturer, DeviceModel, PortTemplate, HostPort, PortConnection,
} from '@/types'
import apiClient from './client'

// Auth
export const authApi = {
  login: (username: string, password: string, totp_code?: string) =>
    apiClient.post<User & { totp_required?: boolean }>('/auth/login/', { username, password, totp_code }),
  logout: () => apiClient.post('/auth/logout/'),
  me: () => apiClient.get<User>('/auth/me/'),
  setup2fa: () => apiClient.get<{ secret: string; uri: string }>('/auth/2fa/setup/'),
  confirm2fa: (code: string) => apiClient.post('/auth/2fa/setup/', { code }),
  disable2fa: (password: string, totp_code: string) =>
    apiClient.post('/auth/2fa/disable/', { password, totp_code }),
  adminDisable2fa: (userId: number) =>
    apiClient.post(`/auth/2fa/admin-disable/${userId}/`),
}

// Projects
export const projectsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Project>>('/projects/', { params }),
  get: (id: number) =>
    apiClient.get<Project>(`/projects/${id}/`),
  create: (data: Partial<Project>) =>
    apiClient.post<Project>('/projects/', data),
  update: (id: number, data: Partial<Project>) =>
    apiClient.patch<Project>(`/projects/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/projects/${id}/`),
  topology: (id: number) =>
    apiClient.get<ProjectTopology>(`/projects/${id}/topology/`),
}

// Sites
export const sitesApi = {
  list: (projectId: number, params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Site>>(`/projects/${projectId}/sites/`, { params }),
  get: (projectId: number, id: number) =>
    apiClient.get<Site>(`/projects/${projectId}/sites/${id}/`),
  create: (projectId: number, data: Partial<Site>) =>
    apiClient.post<Site>(`/projects/${projectId}/sites/`, data),
  update: (projectId: number, id: number, data: Partial<Site>) =>
    apiClient.patch<Site>(`/projects/${projectId}/sites/${id}/`, data),
  delete: (projectId: number, id: number) =>
    apiClient.delete(`/projects/${projectId}/sites/${id}/`),
}

// VLANs
export const vlansApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<VLAN>>('/vlans/', { params }),
  get: (id: number) =>
    apiClient.get<VLAN>(`/vlans/${id}/`),
  create: (data: Partial<VLAN>) =>
    apiClient.post<VLAN>('/vlans/', data),
  update: (id: number, data: Partial<VLAN>) =>
    apiClient.patch<VLAN>(`/vlans/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/vlans/${id}/`),
}

// Subnets
export const subnetsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Subnet>>('/subnets/', { params }),
  get: (id: number) =>
    apiClient.get<Subnet>(`/subnets/${id}/`),
  create: (data: Partial<Subnet>) =>
    apiClient.post<Subnet>('/subnets/', data),
  update: (id: number, data: Partial<Subnet>) =>
    apiClient.patch<Subnet>(`/subnets/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/subnets/${id}/`),
  nextFreeIp: (id: number, poolId?: number) =>
    apiClient.get<{ next_free_ip: string }>(`/subnets/${id}/next-free-ip/`, poolId ? { params: { pool: poolId } } : undefined),
  suggestedPoolRange: (id: number) =>
    apiClient.get<{ start_ip: string; end_ip: string; size: number }>(`/subnets/${id}/suggested-pool-range/`),
}

// Device Types
export const deviceTypesApi = {
  list: () =>
    apiClient.get<DeviceTypeOption[]>('/device-types/'),
  create: (data: Partial<DeviceTypeOption>) =>
    apiClient.post<DeviceTypeOption>('/device-types/', data),
  update: (id: number, data: Partial<DeviceTypeOption>) =>
    apiClient.patch<DeviceTypeOption>(`/device-types/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/device-types/${id}/`),
}

// Manufacturers
export const manufacturersApi = {
  list: () =>
    apiClient.get<Manufacturer[]>('/manufacturers/'),
  get: (id: number) =>
    apiClient.get<Manufacturer>(`/manufacturers/${id}/`),
  create: (data: Partial<Manufacturer>) =>
    apiClient.post<Manufacturer>('/manufacturers/', data),
  update: (id: number, data: Partial<Manufacturer>) =>
    apiClient.patch<Manufacturer>(`/manufacturers/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/manufacturers/${id}/`),
}

// Device Models
export const deviceModelsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<DeviceModel[]>('/device-models/', { params }),
  get: (id: number) =>
    apiClient.get<DeviceModel>(`/device-models/${id}/`),
  create: (data: Partial<DeviceModel>) =>
    apiClient.post<DeviceModel>('/device-models/', data),
  update: (id: number, data: Partial<DeviceModel>) =>
    apiClient.patch<DeviceModel>(`/device-models/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/device-models/${id}/`),
}

// Port Templates
export const portTemplatesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PortTemplate[]>('/port-templates/', { params }),
  create: (data: Partial<PortTemplate>) =>
    apiClient.post<PortTemplate>('/port-templates/', data),
  update: (id: number, data: Partial<PortTemplate>) =>
    apiClient.patch<PortTemplate>(`/port-templates/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/port-templates/${id}/`),
}

// Host Ports
export const hostPortsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<HostPort[]>('/host-ports/', { params }),
  create: (data: Partial<HostPort>) =>
    apiClient.post<HostPort>('/host-ports/', data),
  update: (id: number, data: Partial<HostPort>) =>
    apiClient.patch<HostPort>(`/host-ports/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/host-ports/${id}/`),
}

// Port Connections
export const portConnectionsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PortConnection[]>('/port-connections/', { params }),
  create: (data: Partial<PortConnection>) =>
    apiClient.post<PortConnection>('/port-connections/', data),
  update: (id: number, data: Partial<PortConnection>) =>
    apiClient.patch<PortConnection>(`/port-connections/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/port-connections/${id}/`),
}

export const hostNotesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<HostNote[]>('/host-notes/', { params }),
  create: (data: Partial<HostNote>) =>
    apiClient.post<HostNote>('/host-notes/', data),
  update: (id: number, data: Partial<HostNote>) =>
    apiClient.patch<HostNote>(`/host-notes/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/host-notes/${id}/`),
}

export const siteFilesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<SiteFile[]>('/site-files/', { params }),
  upload: (siteId: number, file: File, name?: string) => {
    const fd = new FormData()
    fd.append('site', String(siteId))
    fd.append('file', file)
    fd.append('name', name || file.name)
    return apiClient.post<SiteFile>('/site-files/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: (id: number) =>
    apiClient.delete(`/site-files/${id}/`),
}

export const hostFilesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<HostFile[]>('/host-files/', { params }),
  upload: (hostId: number, file: File, name?: string) => {
    const fd = new FormData()
    fd.append('host', String(hostId))
    fd.append('file', file)
    fd.append('name', name || file.name)
    return apiClient.post<HostFile>('/host-files/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: (id: number) =>
    apiClient.delete(`/host-files/${id}/`),
}

// Hosts
export const hostsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Host>>('/hosts/', { params }),
  get: (id: number) =>
    apiClient.get<Host>(`/hosts/${id}/`),
  copyPorts: (id: number) =>
    apiClient.post(`/hosts/${id}/copy-ports/`),
  create: (data: Partial<Host>) =>
    apiClient.post<Host>('/hosts/', data),
  update: (id: number, data: Partial<Host>) =>
    apiClient.patch<Host>(`/hosts/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/hosts/${id}/`),
}

// DHCP Pools
export const dhcpPoolsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<DHCPPool>>('/dhcp-pools/', { params }),
  get: (id: number) =>
    apiClient.get<DHCPPool>(`/dhcp-pools/${id}/`),
  create: (data: Partial<DHCPPool>) =>
    apiClient.post<DHCPPool>('/dhcp-pools/', data),
  update: (id: number, data: Partial<DHCPPool>) =>
    apiClient.patch<DHCPPool>(`/dhcp-pools/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/dhcp-pools/${id}/`),
}

// Tunnels
export const tunnelsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Tunnel>>('/tunnels/', { params }),
  get: (id: number) =>
    apiClient.get<Tunnel>(`/tunnels/${id}/`),
  create: (data: Partial<Tunnel>) =>
    apiClient.post<Tunnel>('/tunnels/', data),
  update: (id: number, data: Partial<Tunnel>) =>
    apiClient.patch<Tunnel>(`/tunnels/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/tunnels/${id}/`),
}

// Users (admin)
export const usersApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<UserAdmin>>('/users/', { params }),
  get: (id: number) =>
    apiClient.get<UserAdmin>(`/users/${id}/`),
  create: (data: Partial<UserAdmin>) =>
    apiClient.post<UserAdmin>('/users/', data),
  update: (id: number, data: Partial<UserAdmin>) =>
    apiClient.patch<UserAdmin>(`/users/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/users/${id}/`),
}

// Search
export const searchApi = {
  search: (q: string) =>
    apiClient.get<{ results: SearchResult[] }>('/search/', { params: { q } }),
}

// Audit
export const auditApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AuditLog>>('/audit/', { params }),
}

// Tools
export const toolsApi = {
  subnetInfo: (cidr: string) =>
    apiClient.post<{
      network: string; broadcast: string; netmask: string; wildcard: string;
      prefix_length: number; num_addresses: number; num_hosts: number;
      first_host: string | null; last_host: string | null; is_private: boolean;
    }>('/tools/subnet-info/', { cidr }),
  vlsm: (cidr: string, requirements: { name: string; hosts: number }[]) =>
    apiClient.post('/tools/vlsm/', { cidr, requirements }),
}

// Export
export const exportApi = {
  excel: (projectId: number) =>
    apiClient.get(`/exports/project/${projectId}/excel/`, { responseType: 'blob' }),
  pdf: (projectId: number) =>
    apiClient.get(`/exports/project/${projectId}/pdf/`, { responseType: 'blob' }),
}

// Backup
export const backupApi = {
  download: () =>
    apiClient.get('/backup/export/', { responseType: 'blob' }),
  upload: (file: File, replace: boolean) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<{ detail: string; count: number }>(
      `/backup/import/${replace ? '?replace=true' : ''}`,
      form,
    )
  },
}

export const patchPanelsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PatchPanel[]>('/patch-panels/', { params }),
  get: (id: number) =>
    apiClient.get<PatchPanel>(`/patch-panels/${id}/`),
  create: (data: Partial<PatchPanel>) =>
    apiClient.post<PatchPanel>('/patch-panels/', data),
  update: (id: number, data: Partial<PatchPanel>) =>
    apiClient.patch<PatchPanel>(`/patch-panels/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/patch-panels/${id}/`),
}

export const patchPanelPortsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PatchPanelPort[]>('/patch-panel-ports/', { params }),
  create: (data: Partial<PatchPanelPort>) =>
    apiClient.post<PatchPanelPort>('/patch-panel-ports/', data),
  update: (id: number, data: Partial<PatchPanelPort>) =>
    apiClient.patch<PatchPanelPort>(`/patch-panel-ports/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/patch-panel-ports/${id}/`),
}

export const patchPanelConnectionsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PatchPanelConnection[]>('/patch-panel-connections/', { params }),
  create: (data: Partial<PatchPanelConnection>) =>
    apiClient.post<PatchPanelConnection>('/patch-panel-connections/', data),
  update: (id: number, data: Partial<PatchPanelConnection>) =>
    apiClient.patch<PatchPanelConnection>(`/patch-panel-connections/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/patch-panel-connections/${id}/`),
}

export const racksApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Rack[]>('/racks/', { params }),
  get: (id: number) =>
    apiClient.get<Rack>(`/racks/${id}/`),
  create: (data: Partial<Rack>) =>
    apiClient.post<Rack>('/racks/', data),
  update: (id: number, data: Partial<Rack>) =>
    apiClient.patch<Rack>(`/racks/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/racks/${id}/`),
}

export const rackUnitsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<RackUnit[]>('/rack-units/', { params }),
  create: (data: Partial<RackUnit>) =>
    apiClient.post<RackUnit>('/rack-units/', data),
  update: (id: number, data: Partial<RackUnit>) =>
    apiClient.patch<RackUnit>(`/rack-units/${id}/`, data),
  move: (id: number, position_u: number) =>
    apiClient.post<RackUnit>(`/rack-units/${id}/move/`, { position_u }),
  delete: (id: number) =>
    apiClient.delete(`/rack-units/${id}/`),
}

export const siteNotesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<SiteNote[]>('/site-notes/', { params }),
  create: (data: { site: number; content: string }) =>
    apiClient.post<SiteNote>('/site-notes/', data),
  update: (id: number, data: { content: string }) =>
    apiClient.patch<SiteNote>(`/site-notes/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/site-notes/${id}/`),
}

export const projectNotesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<ProjectNote[]>('/project-notes/', { params }),
  create: (data: { project: number; content: string }) =>
    apiClient.post<ProjectNote>('/project-notes/', data),
  update: (id: number, data: { content: string }) =>
    apiClient.patch<ProjectNote>(`/project-notes/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/project-notes/${id}/`),
}

export const subscriberBoxesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<SubscriberBox[]>('/subscriber-boxes/', { params }),
  create: (data: Partial<SubscriberBox>) =>
    apiClient.post<SubscriberBox>('/subscriber-boxes/', data),
  update: (id: number, data: Partial<SubscriberBox>) =>
    apiClient.patch<SubscriberBox>(`/subscriber-boxes/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/subscriber-boxes/${id}/`),
}

export const subscriberBoxPortsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<SubscriberBoxPort[]>('/subscriber-box-ports/', { params }),
  create: (data: Partial<SubscriberBoxPort>) =>
    apiClient.post<SubscriberBoxPort>('/subscriber-box-ports/', data),
  update: (id: number, data: Partial<SubscriberBoxPort>) =>
    apiClient.patch<SubscriberBoxPort>(`/subscriber-box-ports/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/subscriber-box-ports/${id}/`),
}

export const subscriberBoxConnectionsApi = {
  create: (data: Record<string, unknown>) =>
    apiClient.post('/subscriber-box-connections/', data),
  delete: (id: number) =>
    apiClient.delete(`/subscriber-box-connections/${id}/`),
}

export const panelPortTemplatesApi = {
  list: () =>
    apiClient.get<PanelPortTemplate[]>('/panel-port-templates/'),
  create: (data: Partial<PanelPortTemplate>) =>
    apiClient.post<PanelPortTemplate>('/panel-port-templates/', data),
  update: (id: number, data: Partial<PanelPortTemplate>) =>
    apiClient.patch<PanelPortTemplate>(`/panel-port-templates/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/panel-port-templates/${id}/`),
}

export const panelPortTemplateEntriesApi = {
  create: (data: Partial<PanelPortTemplateEntry>) =>
    apiClient.post<PanelPortTemplateEntry>('/panel-port-template-entries/', data),
  update: (id: number, data: Partial<PanelPortTemplateEntry>) =>
    apiClient.patch<PanelPortTemplateEntry>(`/panel-port-template-entries/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/panel-port-template-entries/${id}/`),
}

export const pdusApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PDU[]>('/pdus/', { params }),
  get: (id: number) =>
    apiClient.get<PDU>(`/pdus/${id}/`),
  create: (data: Partial<PDU> & { rack_unit: number }) =>
    apiClient.post<PDU>('/pdus/', data),
  update: (id: number, data: Partial<PDU>) =>
    apiClient.patch<PDU>(`/pdus/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/pdus/${id}/`),
}

export const pduOutletsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PDUOutlet[]>('/pdu-outlets/', { params }),
  update: (id: number, data: Partial<PDUOutlet>) =>
    apiClient.patch<PDUOutlet>(`/pdu-outlets/${id}/`, data),
}

