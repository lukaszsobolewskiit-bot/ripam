import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hostsApi, hostPortsApi, portConnectionsApi } from '@/api/endpoints'
import { extractApiError } from '@/lib/utils'
import { toast } from 'sonner'
import type { PortConnection } from '@/types'
import { ArrowLeftRight } from 'lucide-react'

interface PortConnectionFormProps {
  projectId: number
  defaultHostId?: number
  defaultPortId?: number
  connection?: PortConnection
  onClose: () => void
}

export function PortConnectionForm({
  projectId,
  defaultHostId,
  defaultPortId,
  connection,
  onClose,
}: PortConnectionFormProps) {
  const queryClient = useQueryClient()

  const [hostAId, setHostAId] = useState<string>(
    connection ? String(connection.host_a_id) : (defaultHostId ? String(defaultHostId) : '')
  )
  const [portAId, setPortAId] = useState<string>(
    connection ? String(connection.port_a) : (defaultPortId ? String(defaultPortId) : '')
  )
  const [hostBId, setHostBId] = useState<string>(
    connection ? String(connection.host_b_id) : ''
  )
  const [portBId, setPortBId] = useState<string>(
    connection ? String(connection.port_b) : ''
  )
  const [description, setDescription] = useState(connection?.description ?? '')

  // Load all hosts
  const { data: hosts } = useQuery({
    queryKey: ['hosts-all'],
    queryFn: () => hostsApi.list({ page_size: '500' }),
    select: (res) => res.data.results,
  })

  // Ports for host A — fetch fresh from API, not from host object
  const { data: portsA, isLoading: loadingA } = useQuery({
    queryKey: ['host-ports-form', hostAId],
    queryFn: () => hostPortsApi.list({ host: hostAId }),
    select: (res) => res.data,
    enabled: !!hostAId,
    staleTime: 0,
  })

  // Ports for host B
  const { data: portsB, isLoading: loadingB } = useQuery({
    queryKey: ['host-ports-form', hostBId],
    queryFn: () => hostPortsApi.list({ host: hostBId }),
    select: (res) => res.data,
    enabled: !!hostBId,
    staleTime: 0,
  })

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        port_a: parseInt(portAId, 10),
        port_b: parseInt(portBId, 10),
        description,
      }
      return connection
        ? portConnectionsApi.update(connection.id, payload)
        : portConnectionsApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-connections'] })
      queryClient.invalidateQueries({ queryKey: ['port-connections-all'] })
      queryClient.invalidateQueries({ queryKey: ['host-ports'] })
      queryClient.invalidateQueries({ queryKey: ['host-ports-form'] })
      queryClient.invalidateQueries({ queryKey: ['host'] })
      toast.success(connection ? 'Connection updated' : 'Connection created')
      onClose()
    },
    onError: (err: unknown) => {
      toast.error(extractApiError(err, 'Failed to save connection'))
    },
  })

  const canSubmit = portAId && portBId && portAId !== portBId

  const hostLabel = (h: { id: number; hostname: string; ip_address: string }) =>
    h.hostname ? `${h.hostname} (${h.ip_address.split('/')[0]})` : h.ip_address.split('/')[0]

  const portLabel = (p: { name: string; port_type: string; connected_to: unknown }) =>
    `${p.name} [${p.port_type.toUpperCase()}]${p.connected_to ? ' — in use' : ''}`

  return (
    <div className="space-y-4">
      {/* Side A */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Device A</p>
        <div>
          <label className="text-xs font-medium">Host</label>
          <select
            value={hostAId}
            onChange={(e) => { setHostAId(e.target.value); setPortAId('') }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Select host...</option>
            {hosts?.map((h) => (
              <option key={h.id} value={h.id}>{hostLabel(h)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Port</label>
          <select
            value={portAId}
            onChange={(e) => setPortAId(e.target.value)}
            disabled={!hostAId || loadingA}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <option value="">{loadingA ? 'Loading...' : 'Select port...'}</option>
            {portsA?.map((p) => (
              <option key={p.id} value={p.id} disabled={!!p.connected_to && String(p.connected_to.connection_id) !== String(connection?.id)}>
                {portLabel(p)}
              </option>
            ))}
          </select>
          {hostAId && !loadingA && portsA?.length === 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">No ports on this host. Add ports in Settings → Device Catalog.</p>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ArrowLeftRight className="h-4 w-4" />
          <span className="text-xs">connected to</span>
        </div>
      </div>

      {/* Side B */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Device B</p>
        <div>
          <label className="text-xs font-medium">Host</label>
          <select
            value={hostBId}
            onChange={(e) => { setHostBId(e.target.value); setPortBId('') }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Select host...</option>
            {hosts?.filter((h) => String(h.id) !== hostAId).map((h) => (
              <option key={h.id} value={h.id}>{hostLabel(h)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Port</label>
          <select
            value={portBId}
            onChange={(e) => setPortBId(e.target.value)}
            disabled={!hostBId || loadingB}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <option value="">{loadingB ? 'Loading...' : 'Select port...'}</option>
            {portsB?.map((p) => (
              <option key={p.id} value={p.id} disabled={!!p.connected_to && String(p.connected_to.connection_id) !== String(connection?.id)}>
                {portLabel(p)}
              </option>
            ))}
          </select>
          {hostBId && !loadingB && portsB?.length === 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">No ports on this host.</p>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="e.g. Uplink to core switch"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : connection ? 'Update' : 'Create'}
        </button>
        <button
          onClick={onClose}
          className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
