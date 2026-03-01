import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patchPanelsApi, patchPanelConnectionsApi, hostsApi, hostPortsApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Server, X, ChevronDown, ChevronRight, Layers, AlertCircle } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import type { PatchPanel, PatchPanelPort } from '@/types'

// ─── Media type styling ───────────────────────────────────────────────────────

const MEDIA_META: Record<string, { color: string; label: string; short: string }> = {
  copper:    { color: '#3b82f6', label: 'Copper (RJ45)', short: 'Cu' },
  fiber_lc:  { color: '#f59e0b', label: 'Fiber LC',      short: 'LC' },
  fiber_sc:  { color: '#f59e0b', label: 'Fiber SC',      short: 'SC' },
  fiber_st:  { color: '#8b5cf6', label: 'Fiber ST',      short: 'ST' },
  fiber_mtp: { color: '#ec4899', label: 'Fiber MTP/MPO', short: 'MTP' },
}

// ─── Single port slot ─────────────────────────────────────────────────────────

function PanelPortSlot({
  port,
  mediaType,
  onConnect,
  onDisconnect,
}: {
  port: PatchPanelPort
  mediaType: string
  onConnect: (port: PatchPanelPort) => void
  onDisconnect: (connectionId: number) => void
}) {
  const info = port.device_port_info
  const meta = MEDIA_META[mediaType] ?? MEDIA_META.copper
  const occupied = !!info

  return (
    <div
      className={cn(
        'relative group flex flex-col items-center gap-0.5 p-1 rounded-md border transition-all duration-150',
        occupied
          ? 'border-border/60 bg-card hover:border-primary/60 hover:bg-primary/5 cursor-default'
          : 'border-dashed border-border/40 bg-muted/10 hover:border-primary/50 hover:bg-primary/5 cursor-pointer',
      )}
      title={
        occupied
          ? `${info?.host_name} / ${info?.device_port_name}` +
            (info?.far_panel_name ? ` → ${info.far_panel_name}:${info.far_panel_port_number}` : '')
          : `Port ${port.port_number} — click to connect`
      }
      onClick={() => !occupied && onConnect(port)}
    >
      <span className="text-[9px] font-mono text-muted-foreground leading-none">{port.port_number}</span>

      {/* Socket visual */}
      <div
        className="w-7 h-4 rounded-sm flex items-center justify-center transition-colors"
        style={{
          backgroundColor: occupied ? meta.color + '22' : undefined,
          border: `1.5px solid ${occupied ? meta.color : '#6b728040'}`,
        }}
      >
        <div className={cn('w-2 h-1.5 rounded-sm', occupied ? '' : 'bg-muted-foreground/20')}
          style={{ backgroundColor: occupied ? meta.color : undefined }} />
      </div>

      {occupied && info ? (
        <div className="text-[8px] text-center leading-tight max-w-full overflow-hidden">
          <span className="font-medium text-foreground truncate block max-w-[52px]">{info.host_name}</span>
          <span className="text-muted-foreground font-mono truncate block max-w-[52px]">{info.device_port_name}</span>
        </div>
      ) : (
        <span className="text-[8px] text-muted-foreground/40 leading-none">—</span>
      )}

      {/* Disconnect X */}
      {occupied && info?.connection_id && (
        <button
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive/90 text-white hidden group-hover:flex items-center justify-center shadow-sm z-10"
          onClick={(e) => { e.stopPropagation(); onDisconnect(info.connection_id) }}
          title="Remove connection"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}

// ─── 1U Panel rack unit ───────────────────────────────────────────────────────

function PanelRackUnit({
  panel,
  onConnect,
  onDisconnect,
}: {
  panel: PatchPanel
  onConnect: (panel: PatchPanel, port: PatchPanelPort) => void
  onDisconnect: (connectionId: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const meta = MEDIA_META[panel.media_type] ?? MEDIA_META.copper
  const usedCount = panel.ports.filter(p => p.device_port_info).length

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}

        <div className="w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: meta.color + '22', color: meta.color, border: `1.5px solid ${meta.color}55` }}>
          {meta.short}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{panel.name}</span>
            {panel.location && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{panel.location}</span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            <span style={{ color: meta.color }}>{meta.label}</span>
            <span>·</span>
            <span>{panel.port_count}p</span>
            <span>·</span>
            <span className={cn('font-medium', usedCount > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
              {usedCount}/{panel.port_count} used
            </span>
          </div>
        </div>

        {/* Utilization bar */}
        <div className="w-20 shrink-0 hidden sm:block">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${(usedCount / panel.port_count) * 100}%`, backgroundColor: meta.color }} />
          </div>
          <div className="text-[9px] text-muted-foreground text-center mt-0.5">
            {Math.round((usedCount / panel.port_count) * 100)}%
          </div>
        </div>
      </button>

      {expanded && (
        <div className="p-3 border-t border-border/30">
          {/* Ports 1–24 */}
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Front</span>
            <div className="flex-1 h-px bg-border/20" />
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(panel.port_count, 24)}, minmax(0, 1fr))` }}>
            {panel.ports.slice(0, 24).map(port => (
              <PanelPortSlot key={port.id} port={port} mediaType={panel.media_type}
                onConnect={(p) => onConnect(panel, p)} onDisconnect={onDisconnect} />
            ))}
          </div>

          {/* Additional ports */}
          {panel.ports.length > 24 && (
            <>
              <div className="mt-2 mb-1 flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Ports 25+</span>
                <div className="flex-1 h-px bg-border/20" />
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(panel.port_count - 24, 24)}, minmax(0, 1fr))` }}>
                {panel.ports.slice(24).map(port => (
                  <PanelPortSlot key={port.id} port={port} mediaType={panel.media_type}
                    onConnect={(p) => onConnect(panel, p)} onDisconnect={onDisconnect} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Connect port dialog ──────────────────────────────────────────────────────

function ConnectPortDialog({
  panel, port, projectId, onClose,
}: {
  panel: PatchPanel; port: PatchPanelPort; projectId: number; onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [hostId, setHostId] = useState('')
  const [devicePortId, setDevicePortId] = useState('')
  const [desc, setDesc] = useState('')

  const { data: hosts } = useQuery({
    queryKey: ['hosts', { project: projectId }],
    queryFn: () => hostsApi.list({ project: String(projectId), page_size: '500' }),
    select: (res) => res.data.results,
  })

  const { data: ports } = useQuery({
    queryKey: ['host-ports-patch', hostId],
    queryFn: () => hostPortsApi.list({ host: hostId }),
    select: (res) => res.data,
    enabled: !!hostId,
    staleTime: 0,
    gcTime: 0,
  })

  const freePorts = (ports ?? []).filter((p) => !p.connected_to)

  const createMutation = useMutation({
    mutationFn: () => patchPanelConnectionsApi.create({
      device_port: Number(devicePortId),
      panel_port: port.id,
      project: projectId,
      description: desc,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch-panels'] })
      toast.success('Port connected')
      onClose()
    },
    onError: () => toast.error('Failed to create connection'),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">{panel.name}</span>
        <span className="text-border">·</span>
        <span className="font-mono font-semibold">Port {port.port_number}</span>
        {port.label && <span className="text-muted-foreground">({port.label})</span>}
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Device</label>
          <select value={hostId} onChange={e => { setHostId(e.target.value); setDevicePortId('') }}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs">
            <option value="">— Select device —</option>
            {hosts?.map(h => (
              <option key={h.id} value={h.id}>{h.hostname || h.ip_address}</option>
            ))}
          </select>
        </div>

        {hostId && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Port</label>
            {freePorts.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 py-1">
                <AlertCircle className="h-3.5 w-3.5" /> No free ports on this device
              </p>
            ) : (
              <select value={devicePortId} onChange={e => setDevicePortId(e.target.value)}
                className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs">
                <option value="">— Select port —</option>
                {freePorts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.port_type.toUpperCase()})</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Label / description (optional)</label>
          <input value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="e.g. Workstation A3"
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs" />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onClose}
          className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent transition-colors">
          Cancel
        </button>
        <button onClick={() => createMutation.mutate()}
          disabled={!devicePortId || createMutation.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {createMutation.isPending ? 'Connecting…' : 'Connect Port'}
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PatchPanelView({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const [connectTarget, setConnectTarget] = useState<{ panel: PatchPanel; port: PatchPanelPort } | null>(null)

  const { data: panels, isLoading } = useQuery({
    queryKey: ['patch-panels', { project: projectId }],
    queryFn: () => patchPanelsApi.list({ project: String(projectId) }),
    select: (res) => res.data,
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: number) => patchPanelConnectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch-panels'] })
      toast.success('Connection removed')
    },
  })

  const bySite = useMemo<Record<string, PatchPanel[]>>(() => {
    const m: Record<string, PatchPanel[]> = {}
    for (const p of (panels ?? [])) {
      const key = p.site_name || 'Unassigned'
      ;(m[key] ??= []).push(p)
    }
    return m
  }, [panels])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading patch panels…
      </div>
    )
  }

  if (!(panels?.length)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto">
            <Layers className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-medium">No patch panels</p>
          <p className="text-sm text-muted-foreground">Add patch panels in Settings → Patch Panels.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Patch Panels</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {panels.length} panels
          </span>
        </div>

        {Object.entries(bySite).map(([siteName, sitePanels]) => (
          <div key={siteName} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{siteName}</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
            {sitePanels.map(panel => (
              <PanelRackUnit key={panel.id} panel={panel}
                onConnect={(p, port) => setConnectTarget({ panel: p, port })}
                onDisconnect={(id) => { if (window.confirm('Remove this connection?')) disconnectMutation.mutate(id) }} />
            ))}
          </div>
        ))}
      </div>

      <Dialog open={!!connectTarget} onOpenChange={(o) => { if (!o) setConnectTarget(null) }}
        title="Connect Panel Port">
        {connectTarget && (
          <ConnectPortDialog panel={connectTarget.panel} port={connectTarget.port}
            projectId={projectId} onClose={() => setConnectTarget(null)} />
        )}
      </Dialog>
    </div>
  )
}
