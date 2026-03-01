import { useRef, useState } from 'react'
import { useUIStore } from '@/stores/ui.store'
import { useSelectionStore } from '@/stores/selection.store'
import { useTopologyStore } from '@/stores/topology.store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sitesApi, vlansApi, subnetsApi, hostsApi, tunnelsApi, dhcpPoolsApi, portConnectionsApi, hostPortsApi, siteFilesApi } from '@/api/endpoints'
import { CopyableIP } from '@/components/shared/CopyableIP'
import { cn } from '@/lib/utils'
import { SubnetUtilBar } from '@/components/shared/SubnetUtilBar'
import { Dialog } from '@/components/ui/Dialog'
import { SiteForm } from '@/components/data/forms/SiteForm'
import { VlanForm } from '@/components/data/forms/VlanForm'
import { SubnetForm } from '@/components/data/forms/SubnetForm'
import { HostForm } from '@/components/data/forms/HostForm'
import { DHCPPoolForm } from '@/components/data/forms/DHCPPoolForm'
import { TunnelForm } from '@/components/data/forms/TunnelForm'
import { PortConnectionForm } from '@/components/data/forms/PortConnectionForm'
import { HostNotesFiles } from '@/components/layout/HostNotesFiles'
import { toast } from 'sonner'
import type { Host, SiteFile } from '@/types'
import { useDeviceTypeLabel } from '@/hooks/useDeviceTypeLabel'
import {
  X, Pencil, Trash2, Plus,
  MapPin, Network, Server, Monitor, Cable, Layers, ArrowLeftRight,
  Upload, Download, File, FileText, StickyNote,
} from 'lucide-react'

export function DetailPanel({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)

  // Selection from sidebar
  const selectedSiteId = useSelectionStore((s) => s.selectedSiteId)
  const selectedVlanId = useSelectionStore((s) => s.selectedVlanId)
  const selectedSubnetId = useSelectionStore((s) => s.selectedSubnetId)
  const selectedHostId = useSelectionStore((s) => s.selectedHostId)
  const selectedTunnelId = useSelectionStore((s) => s.selectedTunnelId)
  const selectedDhcpPoolId = useSelectionStore((s) => s.selectedDhcpPoolId)
  const selectedProjectId = useSelectionStore((s) => s.selectedProjectId)

  // Also listen to topology store for VLAN clicks from the topology view
  const topoVlanId = useTopologyStore((s) => s.selectedVlanId)

  // Priority: Host > DHCP Pool > Subnet > VLAN (sidebar or topology) > Tunnel > Site
  const activeView = selectedHostId
    ? 'host'
    : selectedDhcpPoolId
      ? 'dhcpPool'
      : selectedSubnetId
        ? 'subnet'
        : (selectedVlanId || topoVlanId)
          ? 'vlan'
          : selectedTunnelId
            ? 'tunnel'
            : selectedSiteId
              ? 'site'
              : null

  const effectiveVlanId = selectedVlanId || topoVlanId

  return (
    <aside className={cn("w-80 h-full border-l border-border bg-card overflow-y-auto overflow-x-hidden", className)} style={style}>
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold">Details</h3>
        <button onClick={toggleDetailPanel} className="p-1 rounded hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>

      {activeView === 'site' && selectedSiteId && selectedProjectId && (
        <SiteDetail siteId={selectedSiteId} projectId={selectedProjectId} />
      )}
      {activeView === 'vlan' && effectiveVlanId && (
        <VlanDetail vlanId={effectiveVlanId} />
      )}
      {activeView === 'subnet' && selectedSubnetId && (
        <SubnetDetail subnetId={selectedSubnetId} />
      )}
      {activeView === 'tunnel' && selectedTunnelId && selectedProjectId && (
        <TunnelDetail tunnelId={selectedTunnelId} projectId={selectedProjectId} />
      )}
      {activeView === 'host' && selectedHostId && (
        <HostDetail hostId={selectedHostId} />
      )}
      {activeView === 'dhcpPool' && selectedDhcpPoolId && (
        <DHCPPoolDetail poolId={selectedDhcpPoolId} />
      )}
      {!activeView && (
        <div className="p-3 text-xs text-muted-foreground">
          Select an item in the sidebar or topology to see details.
        </div>
      )}
    </aside>
  )
}

// ── Site Detail ──────────────────────────────────────────────

function SiteDetail({ siteId, projectId }: { siteId: number; projectId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: site } = useQuery({
    queryKey: ['site', projectId, siteId],
    queryFn: () => sitesApi.get(projectId, siteId),
    select: (res) => res.data,
  })

  const { data: files } = useQuery({
    queryKey: ['site-files', siteId],
    queryFn: () => siteFilesApi.list({ site: String(siteId) }),
    select: (res) => res.data,
  })

  const deleteMutation = useMutation({
    mutationFn: () => sitesApi.delete(projectId, siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedSite(null)
      toast.success('Site deleted')
    },
  })

  const uploadFile = useMutation({
    mutationFn: (file: File) => siteFilesApi.upload(siteId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-files', siteId] })
      toast.success('File uploaded')
    },
    onError: () => toast.error('Failed to upload file'),
  })

  const deleteFile = useMutation({
    mutationFn: (id: number) => siteFilesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-files', siteId] })
      toast.success('File deleted')
    },
  })

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  if (!site) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">{site.name}</span>
      </div>

      <dl className="space-y-1.5 text-xs">
        {site.address && <DetailRow label="Address" value={site.address} />}
        {site.latitude != null && site.longitude != null && (
          <DetailRow label="Coordinates" value={`${site.latitude}, ${site.longitude}`} mono />
        )}
        <DetailRow label="VLANs" value={String(site.vlan_count)} />
        <DetailRow label="Hosts" value={String(site.host_count)} />
      </dl>

      {/* ── Files ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
            <File className="h-3 w-3" /> Files ({files?.length ?? 0})
          </h4>
        </div>

        <div className="space-y-1">
          {files?.map((file: SiteFile) => (
            <div key={file.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs group hover:bg-accent/20 transition-colors">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate" title={file.name}>{file.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatSize(file.size)} · {new Date(file.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {file.url && (
                  <a
                    href={file.url}
                    download={file.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-0.5 rounded hover:bg-accent"
                    title="Download"
                  >
                    <Download className="h-3 w-3" />
                  </a>
                )}
                <button
                  onClick={() => { if (window.confirm(`Delete "${file.name}"?`)) deleteFile.mutate(file.id) }}
                  className="p-0.5 rounded hover:bg-destructive/20"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Upload button */}
        <div className="mt-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadFile.mutate(file)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadFile.isPending}
            className="flex items-center gap-1.5 rounded border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors w-full justify-center"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploadFile.isPending ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </div>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete site "${site.name}"?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Site">
        <SiteForm projectId={projectId} site={site} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── VLAN Detail ──────────────────────────────────────────────

function VlanDetail({ vlanId }: { vlanId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [addSubnetOpen, setAddSubnetOpen] = useState(false)

  const { data: vlan } = useQuery({
    queryKey: ['vlan', vlanId],
    queryFn: () => vlansApi.get(vlanId),
    select: (res) => res.data,
  })

  const { data: hostsData } = useQuery({
    queryKey: ['hosts', { vlan: vlanId }],
    queryFn: () => hostsApi.list({ vlan: String(vlanId) }),
    select: (res) => res.data.results,
  })

  const deleteMutation = useMutation({
    mutationFn: () => vlansApi.delete(vlanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vlans'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedVlan(null)
      toast.success('VLAN deleted')
    },
  })

  const hosts = hostsData ?? []

  if (!vlan) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">VLAN {vlan.vlan_id} - {vlan.name}</span>
      </div>

      {vlan.purpose && (
        <p className="text-xs text-muted-foreground">{vlan.purpose}</p>
      )}

      <dl className="space-y-1.5 text-xs">
        <DetailRow label="Subnets" value={String(vlan.subnet_count)} />
        <DetailRow label="Hosts" value={String(vlan.host_count)} />
      </dl>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Hosts ({hosts.length})
          </h4>
          <button
            onClick={() => setAddSubnetOpen(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Subnet
          </button>
        </div>
        <HostList hosts={hosts} />
      </div>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete VLAN ${vlan.vlan_id}?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit VLAN">
        <VlanForm siteId={vlan.site} vlan={vlan} onClose={() => setEditOpen(false)} />
      </Dialog>

      <Dialog open={addSubnetOpen} onOpenChange={setAddSubnetOpen} title="Add Subnet">
        <SubnetForm vlanId={vlanId} onClose={() => setAddSubnetOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── Subnet Detail ────────────────────────────────────────────

function SubnetDetail({ subnetId }: { subnetId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [addHostOpen, setAddHostOpen] = useState(false)
  const [addPoolOpen, setAddPoolOpen] = useState(false)

  const { data: subnet } = useQuery({
    queryKey: ['subnet', subnetId],
    queryFn: () => subnetsApi.get(subnetId),
    select: (res) => res.data,
  })

  const { data: hostsData } = useQuery({
    queryKey: ['hosts', { subnet: subnetId }],
    queryFn: () => hostsApi.list({ subnet: String(subnetId) }),
    select: (res) => res.data.results,
  })

  const { data: dhcpPoolsData } = useQuery({
    queryKey: ['dhcp-pools', { subnet: subnetId }],
    queryFn: () => dhcpPoolsApi.list({ subnet: String(subnetId) }),
    select: (res) => res.data.results,
  })

  const deleteMutation = useMutation({
    mutationFn: () => subnetsApi.delete(subnetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subnets'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedSubnet(null)
      toast.success('Subnet deleted')
    },
  })

  const hosts = hostsData ?? []
  const dhcpPools = dhcpPoolsData ?? []

  if (!subnet) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Server className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold font-mono">{subnet.network}</span>
      </div>

      <SubnetUtilBar network={subnet.network} hostCount={subnet.static_host_count} dhcpPoolSize={subnet.dhcp_pool_total_size} variant="full" />

      <dl className="space-y-1.5 text-xs">
        {subnet.gateway && <DetailRow label="Gateway" value={subnet.gateway} mono />}
        {subnet.description && <DetailRow label="Description" value={subnet.description} />}
      </dl>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Hosts ({hosts.length})
          </h4>
          <button
            onClick={() => setAddHostOpen(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Host
          </button>
        </div>
        <HostList hosts={hosts} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            DHCP Pools ({dhcpPools.length})
          </h4>
          <button
            onClick={() => setAddPoolOpen(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Pool
          </button>
        </div>
        <div className="space-y-1">
          {dhcpPools.map((pool) => (
            <div
              key={pool.id}
              onClick={() => useSelectionStore.getState().setSelectedDhcpPool(pool.id)}
              className="flex w-full items-center justify-between rounded-md border border-border p-2 text-xs hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <span className="font-mono">{pool.start_ip.split('/')[0]} – {pool.end_ip.split('/')[0]}</span>
              <span className="text-[10px] text-muted-foreground">{pool.lease_count} leases</span>
            </div>
          ))}
          {dhcpPools.length === 0 && (
            <p className="text-xs text-muted-foreground">No DHCP pools</p>
          )}
        </div>
      </div>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete subnet ${subnet.network}?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Subnet">
        <SubnetForm
          vlanId={subnet.vlan ?? undefined}
          siteId={subnet.site ?? undefined}
          projectId={subnet.project}
          subnet={subnet}
          onClose={() => setEditOpen(false)}
        />
      </Dialog>

      <Dialog open={addHostOpen} onOpenChange={setAddHostOpen} title="Add Host">
        <HostForm subnetId={subnetId} onClose={() => setAddHostOpen(false)} />
      </Dialog>

      <Dialog open={addPoolOpen} onOpenChange={setAddPoolOpen} title="Add DHCP Pool">
        <DHCPPoolForm subnetId={subnetId} onClose={() => setAddPoolOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── Tunnel Detail ────────────────────────────────────────────

function TunnelDetail({ tunnelId, projectId }: { tunnelId: number; projectId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

  const { data: tunnel } = useQuery({
    queryKey: ['tunnel', tunnelId],
    queryFn: () => tunnelsApi.get(tunnelId),
    select: (res) => res.data,
  })

  const deleteMutation = useMutation({
    mutationFn: () => tunnelsApi.delete(tunnelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedTunnel(null)
      toast.success('Tunnel deleted')
    },
  })

  if (!tunnel) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Cable className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">{tunnel.name}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
          tunnel.enabled
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground'
        )}>
          {tunnel.enabled ? 'Enabled' : 'Disabled'}
        </span>
        <span className="text-xs uppercase text-muted-foreground">{tunnel.tunnel_type}</span>
      </div>

      <dl className="space-y-1.5 text-xs">
        <DetailRow label="Subnet" value={tunnel.tunnel_subnet} mono />
        <DetailRow label="Site A" value={tunnel.site_a_name} />
        <DetailRow label="IP A" value={tunnel.ip_a} mono />
        {tunnel.site_b_name ? (
          <DetailRow label="Site B" value={tunnel.site_b_project_name ? `${tunnel.site_b_project_name} / ${tunnel.site_b_name}` : tunnel.site_b_name} />
        ) : (
          <DetailRow label="External" value={tunnel.external_endpoint} />
        )}
        <DetailRow label="IP B" value={tunnel.ip_b} mono />
        {tunnel.description && <DetailRow label="Description" value={tunnel.description} />}
      </dl>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete tunnel "${tunnel.name}"?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Tunnel">
        <TunnelForm projectId={projectId} tunnel={tunnel} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}


// ── Host Detail ──────────────────────────────────────────────

function HostDetail({ hostId }: { hostId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [connectPortOpen, setConnectPortOpen] = useState(false)
  const [connectingPortId, setConnectingPortId] = useState<number | null>(null)
  const [editConnectionId, setEditConnectionId] = useState<number | null>(null)
  const [addPortOpen, setAddPortOpen] = useState(false)
  const [newPortName, setNewPortName] = useState('')
  const [newPortType, setNewPortType] = useState<'rj45' | 'sfp' | 'sfp+' | 'qsfp' | 'usb' | 'serial'>('rj45')
  const [activeTab, setActiveTab] = useState<'info' | 'notes'>('info')
  const getLabel = useDeviceTypeLabel()
  const selectedProjectId = useSelectionStore((s) => s.selectedProjectId)
  const setSelectedHost = useSelectionStore((s) => s.setSelectedHost)

  const { data: host } = useQuery({
    queryKey: ['host', hostId],
    queryFn: () => hostsApi.get(hostId),
    select: (res) => res.data,
  })

  const { data: connections } = useQuery({
    queryKey: ['port-connections', { host: hostId }],
    queryFn: () => portConnectionsApi.list({ host: String(hostId) }),
    select: (res) => res.data,
    enabled: !!hostId,
  })

  const deleteMutation = useMutation({
    mutationFn: () => hostsApi.delete(hostId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedHost(null)
      toast.success('Host deleted')
    },
  })

  const deleteConnectionMutation = useMutation({
    mutationFn: (id: number) => portConnectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-connections'] })
      queryClient.invalidateQueries({ queryKey: ['host-ports'] })
      queryClient.invalidateQueries({ queryKey: ['host', hostId] })
      toast.success('Connection removed')
    },
  })

  const addPortMutation = useMutation({
    mutationFn: () => hostPortsApi.create({
      host: hostId,
      name: newPortName.trim(),
      port_type: newPortType,
    } as Parameters<typeof hostPortsApi.create>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host', hostId] })
      queryClient.invalidateQueries({ queryKey: ['host-ports'] })
      setNewPortName('')
      setAddPortOpen(false)
      toast.success('Port added')
    },
    onError: () => toast.error('Failed to add port'),
  })

  if (!host) return <DetailLoading />

  const ports = host.ports ?? []
  const editConnection = connections?.find((c) => c.id === editConnectionId)

  const PORT_TYPE_OPTIONS = [
    { value: 'rj45', label: 'RJ45' },
    { value: 'sfp', label: 'SFP' },
    { value: 'sfp+', label: 'SFP+' },
    { value: 'qsfp', label: 'QSFP' },
    { value: 'usb', label: 'USB' },
    { value: 'serial', label: 'Serial' },
  ] as const

  const PORT_COLORS: Record<string, string> = {
    rj45: '#3b82f6', sfp: '#8b5cf6', 'sfp+': '#a855f7', qsfp: '#ec4899', usb: '#f59e0b', serial: '#6b7280',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <CopyableIP ip={host.ip_address} />
            {host.hostname && (
              <p className="text-xs text-muted-foreground truncate">{host.hostname}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-2 border-b border-border -mb-3 pb-0">
          {(['info', 'notes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 text-xs font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'notes' ? 'Notes & Files' : 'Info'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {activeTab === 'info' && (
          <>
            {/* Basic info */}
            <dl className="space-y-1.5 text-xs">
              {host.mac_address && <DetailRow label="MAC" value={host.mac_address} mono />}
              <DetailRow label="Device Type" value={getLabel(host.device_type)} />
              {host.device_model_name && <DetailRow label="Model" value={host.device_model_name} />}
              {host.description && <DetailRow label="Description" value={host.description} />}
            </dl>

            {/* ── Ports ── */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                  Ports ({ports.length})
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConnectPortOpen(true)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ArrowLeftRight className="h-3 w-3" /> Connect
                  </button>
                  <button
                    onClick={() => setAddPortOpen(v => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
              </div>

              {/* Add port form */}
              {addPortOpen && (
                <div className="mb-2 rounded border border-dashed border-border p-2 space-y-1.5 bg-muted/20">
                  <div className="flex items-center gap-1.5">
                    <input
                      value={newPortName}
                      onChange={(e) => setNewPortName(e.target.value)}
                      placeholder="e.g. ether1"
                      autoFocus
                      className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-xs font-mono"
                    />
                    <select
                      value={newPortType}
                      onChange={(e) => setNewPortType(e.target.value as typeof newPortType)}
                      className="rounded border border-input bg-background px-1.5 py-0.5 text-xs"
                    >
                      {PORT_TYPE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => addPortMutation.mutate()}
                      disabled={!newPortName.trim() || addPortMutation.isPending}
                      className="rounded bg-primary px-2.5 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
                    >
                      {addPortMutation.isPending ? 'Adding...' : 'Add Port'}
                    </button>
                    <button
                      onClick={() => { setAddPortOpen(false); setNewPortName('') }}
                      className="rounded border border-border px-2.5 py-0.5 text-xs hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {ports.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">
                  No ports. Add one above or assign a device model with port templates.
                </p>
              ) : (
                <div className="space-y-1">
                  {ports.map((port) => {
                    const color = PORT_COLORS[port.port_type] ?? '#6b7280'
                    return (
                      <div
                        key={port.id}
                        className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs group hover:bg-accent/20 transition-colors"
                      >
                        {/* Color dot = port type */}
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                          title={port.port_type.toUpperCase()}
                        />
                        <span className="font-mono font-medium w-20 shrink-0 truncate" title={port.name}>
                          {port.name}
                        </span>
                        <span className="text-[9px] bg-muted px-1 py-0.5 rounded text-muted-foreground shrink-0">
                          {port.port_type.toUpperCase()}
                        </span>

                        {port.connected_to ? (
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <Cable className="h-3 w-3 text-green-500 shrink-0" />
                            <button
                              onClick={() => {
                                const conn = connections?.find(c => c.id === port.connected_to!.connection_id)
                                if (conn) setEditConnectionId(conn.id)
                              }}
                              className="text-[10px] text-green-600 dark:text-green-400 truncate hover:underline"
                              title={`${port.connected_to.host_name} / ${port.connected_to.port_name}`}
                            >
                              {port.connected_to.host_name} / {port.connected_to.port_name}
                            </button>
                            {port.patch_connection && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1 py-0.5 rounded shrink-0" title={`via ${port.patch_connection.panel_name} port ${port.patch_connection.port_number}`}>
                                ↑ patch
                              </span>
                            )}
                            <button
                              onClick={() => {
                                if (window.confirm('Remove connection?')) {
                                  deleteConnectionMutation.mutate(port.connected_to!.connection_id)
                                }
                              }}
                              className="ml-auto p-0.5 rounded hover:bg-destructive/20 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 flex-1">
                            {port.patch_connection ? (
                              <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded" title={`Patched via ${port.patch_connection.panel_name}:${port.patch_connection.port_number}`}>
                                {port.patch_connection.panel_name}:{port.patch_connection.port_number}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">free</span>
                            )}
                            <button
                              onClick={() => { setConnectingPortId(port.id); setConnectPortOpen(true) }}
                              className="ml-auto text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:underline shrink-0"
                            >
                              connect
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Connections ── */}
            {connections && connections.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1.5">
                  Connections ({connections.length})
                </h4>
                <div className="space-y-1">
                  {connections.map((conn) => {
                    const isA = conn.host_a_id === hostId
                    const myPort = isA ? conn.port_a_name : conn.port_b_name
                    const otherHost = isA ? conn.host_b_name : conn.host_a_name
                    const otherPort = isA ? conn.port_b_name : conn.port_a_name
                    const color = PORT_COLORS[conn.port_a_type] ?? '#6b7280'
                    return (
                      <div key={conn.id} className="flex items-center gap-1.5 text-[10px] rounded border border-border px-2 py-1 group hover:bg-accent/20 transition-colors">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-mono font-medium text-foreground shrink-0">{myPort}</span>
                        <ArrowLeftRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <button
                          onClick={() => setSelectedHost(isA ? conn.host_b_id : conn.host_a_id)}
                          className="truncate text-muted-foreground hover:text-primary hover:underline"
                        >
                          {otherHost}
                        </button>
                        <span className="font-mono text-muted-foreground shrink-0">/{otherPort}</span>
                        <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => setEditConnectionId(conn.id)}
                            className="p-0.5 rounded hover:bg-accent"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => { if (window.confirm('Delete?')) deleteConnectionMutation.mutate(conn.id) }}
                            className="p-0.5 rounded hover:bg-destructive/20"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <DetailActions
              onEdit={() => setEditOpen(true)}
              onDelete={() => {
                if (window.confirm(`Delete host ${host.ip_address}?`)) deleteMutation.mutate()
              }}
            />
          </>
        )}

        {activeTab === 'notes' && (
          <HostNotesFiles hostId={hostId} />
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Host">
        <HostForm subnetId={host.subnet} host={host} onClose={() => setEditOpen(false)} />
      </Dialog>

      <Dialog
        open={connectPortOpen}
        onOpenChange={(open) => { setConnectPortOpen(open); if (!open) setConnectingPortId(null) }}
        title="Connect Port"
      >
        <PortConnectionForm
          projectId={selectedProjectId!}
          defaultHostId={hostId}
          defaultPortId={connectingPortId ?? undefined}
          onClose={() => { setConnectPortOpen(false); setConnectingPortId(null) }}
        />
      </Dialog>

      <Dialog
        open={editConnectionId !== null}
        onOpenChange={(open) => { if (!open) setEditConnectionId(null) }}
        title="Edit Connection"
      >
        {editConnection && (
          <PortConnectionForm
            projectId={selectedProjectId!}
            connection={editConnection}
            onClose={() => setEditConnectionId(null)}
          />
        )}
      </Dialog>
    </div>
  )
}

// ── DHCP Pool Detail ──────────────────────────────────────────

function DHCPPoolDetail({ poolId }: { poolId: number }) {
  const queryClient = useQueryClient()
  const setSelectedSubnet = useSelectionStore((s) => s.setSelectedSubnet)
  const [editOpen, setEditOpen] = useState(false)
  const [addHostOpen, setAddHostOpen] = useState(false)

  const { data: pool } = useQuery({
    queryKey: ['dhcp-pool', poolId],
    queryFn: () => dhcpPoolsApi.get(poolId),
    select: (res) => res.data,
  })

  const { data: subnet } = useQuery({
    queryKey: ['subnet', pool?.subnet],
    queryFn: () => subnetsApi.get(pool!.subnet),
    select: (res) => res.data,
    enabled: !!pool,
  })

  const { data: hostsData } = useQuery({
    queryKey: ['hosts', { dhcp_pool: poolId }],
    queryFn: () => hostsApi.list({ dhcp_pool: String(poolId) }),
    select: (res) => res.data.results,
  })

  const deleteMutation = useMutation({
    mutationFn: () => dhcpPoolsApi.delete(poolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dhcp-pools'] })
      queryClient.invalidateQueries({ queryKey: ['subnets'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedDhcpPool(null)
      toast.success('DHCP Pool deleted')
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to delete'
      toast.error(message)
    },
  })

  const hosts = hostsData ?? []

  if (!pool) return <DetailLoading />

  const startIp = pool.start_ip.split('/')[0]
  const endIp = pool.end_ip.split('/')[0]

  // Calculate pool size
  const ipToInt = (ip: string) => {
    const parts = ip.split('.')
    return parts.reduce((acc, p) => (acc << 8) + parseInt(p, 10), 0) >>> 0
  }
  const poolSize = ipToInt(endIp) - ipToInt(startIp) + 1

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0">
          <span className="text-sm font-semibold font-mono block">
            {startIp} – {endIp}
          </span>
          {subnet && (
            <button
              onClick={() => setSelectedSubnet(pool.subnet)}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              ← {subnet.network}
            </button>
          )}
        </div>
      </div>

      <dl className="space-y-1.5 text-xs">
        <DetailRow label="Pool Size" value={`${poolSize} addresses`} />
        <DetailRow label="Leases" value={`${hosts.length} / ${poolSize}`} />
        {pool.description && <DetailRow label="Description" value={pool.description} />}
      </dl>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Leases ({hosts.length})
          </h4>
          <button
            onClick={() => setAddHostOpen(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Lease
          </button>
        </div>
        <HostList hosts={hosts} />
      </div>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm('Delete this DHCP pool?')) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit DHCP Pool">
        <DHCPPoolForm subnetId={pool.subnet} pool={pool} onClose={() => setEditOpen(false)} />
      </Dialog>

      <Dialog open={addHostOpen} onOpenChange={setAddHostOpen} title="Add DHCP Lease">
        <HostForm
          subnetId={pool.subnet}
          defaultIpType="dhcp_lease"
          defaultDhcpPoolId={pool.id}
          onClose={() => setAddHostOpen(false)}
        />
      </Dialog>
    </div>
  )
}

// ── Shared helpers ───────────────────────────────────────────

function DetailLoading() {
  return <div className="p-3 text-xs text-muted-foreground">Loading...</div>
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono' : ''}>{value}</dd>
    </div>
  )
}

function DetailActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-2 pt-1 border-t border-border">
      <button
        onClick={onEdit}
        className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs hover:bg-accent transition-colors"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
      <button
        onClick={onDelete}
        className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 className="h-3 w-3" /> Delete
      </button>
    </div>
  )
}

function HostList({ hosts }: { hosts: Host[] }) {
  const setSelectedHost = useSelectionStore((s) => s.setSelectedHost)
  const getLabel = useDeviceTypeLabel()

  return (
    <div className="space-y-1">
      {hosts.map((host) => (
        <div
          key={host.id}
          onClick={() => setSelectedHost(host.id)}
          className="flex w-full items-center justify-between rounded-md border border-border p-2 text-xs hover:bg-accent/50 transition-colors cursor-pointer"
        >
          <div className="min-w-0">
            <CopyableIP ip={host.ip_address} />
            {host.hostname && (
              <p className="text-muted-foreground truncate mt-0.5">{host.hostname}</p>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">{getLabel(host.device_type)}</span>
        </div>
      ))}
      {hosts.length === 0 && (
        <p className="text-xs text-muted-foreground">No hosts</p>
      )}
    </div>
  )
}
