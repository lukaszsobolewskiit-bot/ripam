import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hostsApi, subnetsApi, dhcpPoolsApi, deviceTypesApi, manufacturersApi, deviceModelsApi, hostPortsApi, portConnectionsApi } from '@/api/endpoints'
import { extractApiError } from '@/lib/utils'
import { toast } from 'sonner'
import type { Host, PortType } from '@/types'
import { ChevronDown, ChevronRight, ArrowLeftRight, Plus, Trash2 } from 'lucide-react'

interface HostFormProps {
  subnetId?: number
  projectId?: number
  host?: Host
  defaultIpType?: 'static' | 'dhcp_lease'
  defaultDhcpPoolId?: number
  onClose: () => void
}

interface FormValues {
  ip_address: string
  hostname: string
  mac_address: string
  device_type: string
  device_model: string
  ip_type: string
  dhcp_pool: string
  description: string
  subnet: string
}

export function HostForm({ subnetId, projectId, host, defaultIpType, defaultDhcpPoolId, onClose }: HostFormProps) {
  const queryClient = useQueryClient()
  const needsSubnetSelector = !subnetId && !host
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('')
  const [connectionOpen, setConnectionOpen] = useState(false)

  // Port connection state (after host is saved)
  const [connHostBId, setConnHostBId] = useState('')
  const [connPortAId, setConnPortAId] = useState('')
  const [connPortBId, setConnPortBId] = useState('')
  const [connDesc, setConnDesc] = useState('')

  const { data: deviceTypes } = useQuery({
    queryKey: ['device-types'],
    queryFn: () => deviceTypesApi.list(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })

  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: () => manufacturersApi.list(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })

  const { data: deviceModels } = useQuery({
    queryKey: ['device-models', selectedManufacturer],
    queryFn: () => deviceModelsApi.list(selectedManufacturer ? { manufacturer: selectedManufacturer } : {}),
    select: (res) => res.data,
    enabled: !!selectedManufacturer,
    staleTime: 5 * 60 * 1000,
  })

  const { data: subnets } = useQuery({
    queryKey: ['subnets', { project: projectId }],
    queryFn: () => subnetsApi.list({ project: String(projectId!) }),
    select: (res) => res.data.results,
    enabled: needsSubnetSelector && !!projectId,
  })

  const resolvedSubnetId = subnetId ?? (host ? host.subnet : undefined)

  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: host ? {
      ip_address: host.ip_address,
      hostname: host.hostname,
      mac_address: host.mac_address,
      device_type: host.device_type,
      device_model: host.device_model ? String(host.device_model) : '',
      ip_type: host.ip_type ?? 'static',
      dhcp_pool: host.dhcp_pool ? String(host.dhcp_pool) : '',
      description: host.description,
      subnet: String(host.subnet),
    } : {
      device_type: '',
      device_model: '',
      ip_type: defaultIpType ?? 'static',
      dhcp_pool: defaultDhcpPoolId ? String(defaultDhcpPoolId) : '',
      subnet: subnetId ? String(subnetId) : '',
    },
  })

  // Pre-select manufacturer when editing
  useEffect(() => {
    if (host?.device_model && manufacturers) {
      for (const m of manufacturers) {
        const found = m.device_models?.find(dm => dm.id === host.device_model)
        if (found) {
          setSelectedManufacturer(String(m.id))
          break
        }
      }
    }
  }, [host, manufacturers])

  const selectedSubnet = watch('subnet')
  const effectiveSubnetId = resolvedSubnetId ?? (selectedSubnet ? parseInt(selectedSubnet, 10) : undefined)
  const watchDeviceType = watch('device_type')
  const watchDeviceModel = watch('device_model')

  const { data: dhcpPools } = useQuery({
    queryKey: ['dhcp-pools', { subnet: effectiveSubnetId }],
    queryFn: () => dhcpPoolsApi.list({ subnet: String(effectiveSubnetId!) }),
    select: (res) => res.data.results,
    enabled: !!effectiveSubnetId,
  })

  const watchIpType = watch('ip_type')
  const watchDhcpPool = watch('dhcp_pool')
  const selectedPoolId = watchIpType === 'dhcp_lease' && watchDhcpPool ? parseInt(watchDhcpPool, 10) : undefined

  const { data: nextFreeIp } = useQuery({
    queryKey: ['nextFreeIp', effectiveSubnetId, selectedPoolId],
    queryFn: () => subnetsApi.nextFreeIp(effectiveSubnetId!, selectedPoolId),
    select: (res) => res.data.next_free_ip,
    enabled: !host && !!effectiveSubnetId && (watchIpType === 'static' || !!selectedPoolId),
  })

  useEffect(() => {
    if (nextFreeIp && !host) setValue('ip_address', nextFreeIp)
  }, [nextFreeIp, host, setValue])

  // Ports of this host (for connection section)
  const { data: hostPorts } = useQuery({
    queryKey: ['host-ports-form', String(host?.id ?? '')],
    queryFn: () => hostPortsApi.list({ host: String(host!.id) }),
    select: (res) => res.data,
    enabled: !!host?.id && connectionOpen,
    staleTime: 0,
  })

  // Ports of partner host
  const { data: partnerPorts } = useQuery({
    queryKey: ['host-ports-form', connHostBId],
    queryFn: () => hostPortsApi.list({ host: connHostBId }),
    select: (res) => res.data,
    enabled: !!connHostBId && connectionOpen,
    staleTime: 0,
  })

  // Load hosts for connection form - filter by project if available
  const connectionProjectId = projectId

  const allHostsQuery = useQuery({
    queryKey: ['hosts-for-conn', connectionProjectId],
    queryFn: () => hostsApi.list(connectionProjectId 
      ? { project: String(connectionProjectId), page_size: '500' }
      : { page_size: '500' }
    ),
    select: (res) => res.data.results,
    enabled: connectionOpen,
  })

  const connMutation = useMutation({
    mutationFn: () => portConnectionsApi.create({
      port_a: parseInt(connPortAId, 10),
      port_b: parseInt(connPortBId, 10),
      description: connDesc,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-connections'] })
      queryClient.invalidateQueries({ queryKey: ['port-connections-all'] })
      queryClient.invalidateQueries({ queryKey: ['host-ports'] })
      queryClient.invalidateQueries({ queryKey: ['host-ports-form'] })
      queryClient.invalidateQueries({ queryKey: ['host', host?.id] })
      toast.success('Connection created')
      setConnHostBId(''); setConnPortAId(''); setConnPortBId(''); setConnDesc('')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to create connection')),
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const finalSubnetId = subnetId ?? parseInt(data.subnet, 10)
      const payload = {
        ip_address: data.ip_address,
        hostname: data.hostname,
        mac_address: data.mac_address,
        device_type: data.device_type,
        device_model: data.device_model ? parseInt(data.device_model, 10) : null,
        ip_type: data.ip_type,
        dhcp_pool: data.ip_type === 'dhcp_lease' ? parseInt(data.dhcp_pool, 10) : null,
        description: data.description,
        subnet: finalSubnetId,
      } as Record<string, unknown>
      return host
        ? hostsApi.update(host.id, payload as Partial<Host>)
        : hostsApi.create(payload as Partial<Host>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      queryClient.invalidateQueries({ queryKey: ['subnets'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      queryClient.invalidateQueries({ queryKey: ['dhcp-pools'] })
      queryClient.invalidateQueries({ queryKey: ['nextFreeIp'] })
      toast.success(host ? 'Host updated' : 'Host created')
      onClose()
    },
    onError: (err: unknown) => {
      toast.error(extractApiError(err, 'Failed to save host'))
    },
  })

  const hostLabel = (h: { id: number; hostname: string; ip_address: string }) =>
    h.hostname ? `${h.hostname} (${h.ip_address.split('/')[0]})` : h.ip_address.split('/')[0]

  const portLabel = (p: { name: string; port_type: string; connected_to: unknown }) =>
    `${p.name} [${(p.port_type as string).toUpperCase()}]${p.connected_to ? ' — in use' : ''}`

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
      {needsSubnetSelector && (
        <div>
          <label className="text-xs font-medium">Subnet</label>
          <select
            {...register('subnet', { required: 'Subnet is required' })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Choose subnet...</option>
            {subnets?.map((s) => (
              <option key={s.id} value={s.id}>{s.network}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-xs font-medium">IP Address</label>
        <input
          {...register('ip_address', { required: 'IP is required' })}
          placeholder="e.g. 10.0.1.1"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
        />
        {nextFreeIp && !host && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Suggested: {nextFreeIp}</p>
        )}
      </div>

      <div>
        <label className="text-xs font-medium">Hostname</label>
        <input
          {...register('hostname')}
          placeholder="e.g. sw-core-01"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium">MAC Address</label>
        <input
          {...register('mac_address')}
          placeholder="AA:BB:CC:DD:EE:FF"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
        />
      </div>

      <div>
        <label className="text-xs font-medium">Device Type</label>
        <select
          {...register('device_type')}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">— Select device type —</option>
          {deviceTypes?.map((dt) => (
            <option key={dt.value} value={dt.value}>{dt.label}</option>
          ))}
        </select>
      </div>

      {/* Device Model — only visible when device type is selected */}
      {watchDeviceType && (
        <div className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground">Device Model (optional)</p>
          <div>
            <label className="text-xs font-medium">Manufacturer</label>
            <select
              value={selectedManufacturer}
              onChange={(e) => {
                setSelectedManufacturer(e.target.value)
                setValue('device_model', '')
              }}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">— None —</option>
              {manufacturers?.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {selectedManufacturer && (
            <div>
              <label className="text-xs font-medium">Model</label>
              <select
                {...register('device_model')}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="">— None —</option>
                {deviceModels?.map((dm) => (
                  <option key={dm.id} value={dm.id}>{dm.name}</option>
                ))}
              </select>
              {deviceModels?.length === 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">No models for this manufacturer yet.</p>
              )}
            </div>
          )}
          {watchDeviceModel && (
            <p className="text-[10px] text-green-600 dark:text-green-400">
              ✓ Ports will be copied automatically from the model template
            </p>
          )}
        </div>
      )}

      <div>
        <label className="text-xs font-medium">IP Type</label>
        <select
          {...register('ip_type')}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="static">Static IP</option>
          <option value="dhcp_lease">DHCP Static Lease</option>
        </select>
      </div>

      {watchIpType === 'dhcp_lease' && (
        <div>
          <label className="text-xs font-medium">DHCP Pool</label>
          <select
            {...register('dhcp_pool', {
              validate: (val) => watchIpType !== 'dhcp_lease' || !!val || 'DHCP Pool is required for leases',
            })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Choose pool...</option>
            {dhcpPools?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.start_ip.split('/')[0]} – {p.end_ip.split('/')[0]}
              </option>
            ))}
          </select>
          {(!dhcpPools || dhcpPools.length === 0) && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              No DHCP pools in this subnet. Create one first.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="text-xs font-medium">Description</label>
        <textarea
          {...register('description')}
          rows={2}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      {/* Port connection section — only when editing existing host */}
      {host && (
        <div className="rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setConnectionOpen(!connectionOpen)}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium bg-muted/30 hover:bg-muted/50 transition-colors text-left"
          >
            {connectionOpen
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            }
            <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
            Add Port Connection
            {hostPorts && hostPorts.filter(p => !p.connected_to).length > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground">
                {hostPorts.filter(p => !p.connected_to).length} free ports
              </span>
            )}
          </button>

          {connectionOpen && (
            <div className="p-3 space-y-2 bg-background">
              {!hostPorts?.length ? (
                <p className="text-[10px] text-muted-foreground">
                  This host has no ports. Assign a device model with port templates first.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">My port</label>
                      <select
                        value={connPortAId}
                        onChange={(e) => setConnPortAId(e.target.value)}
                        className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="">Select...</option>
                        {hostPorts?.map((p) => (
                          <option key={p.id} value={p.id} disabled={!!p.connected_to}>
                            {portLabel(p)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Remote host</label>
                      <select
                        value={connHostBId}
                        onChange={(e) => { setConnHostBId(e.target.value); setConnPortBId('') }}
                        className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="">Select...</option>
                        {allHostsQuery.data?.filter(h => h.id !== host.id).map((h) => (
                          <option key={h.id} value={h.id}>{hostLabel(h)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {connHostBId && (
                    <div>
                      <label className="text-[10px] text-muted-foreground">Remote port</label>
                      <select
                        value={connPortBId}
                        onChange={(e) => setConnPortBId(e.target.value)}
                        className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="">Select...</option>
                        {partnerPorts?.map((p) => (
                          <option key={p.id} value={p.id} disabled={!!p.connected_to}>
                            {portLabel(p)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <input
                    value={connDesc}
                    onChange={(e) => setConnDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => connMutation.mutate()}
                    disabled={!connPortAId || !connPortBId || connMutation.isPending}
                    className="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" />
                    {connMutation.isPending ? 'Adding...' : 'Add Connection'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : host ? 'Update' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
