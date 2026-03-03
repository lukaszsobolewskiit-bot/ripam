/**
 * SiteRacksPage — pełna strona zarządzania szafami rack dla danego Site.
 * Dostępna z bocznego menu przy kliknięciu "Racks" przy danym site.
 */
import { useState, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { racksApi, hostsApi, patchPanelsApi, portConnectionsApi, patchPanelPortsApi } from '@/api/endpoints'
import { RackElevation } from '@/components/rack/RackElevation'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/utils'
import {
  Plus, Server, ArrowLeft, LayoutGrid, List,
  Pencil, Trash2, ChevronLeft, ChevronRight,
  ChevronDown as ChevDown, Cable, Zap, Battery, Package, Cpu,
  Network, ArrowRight, Layers,
} from 'lucide-react'
import type { Rack, RackUnit } from '@/types'

// ─── Type config (same as RackElevation) ──────────────────────────────────────

const TYPE_CFG_LIST: Record<string, { accent: string; icon: typeof Server; label: string }> = {
  device:      { accent: '#3b82f6', icon: Server,  label: 'Device'      },
  patch_panel: { accent: '#f59e0b', icon: Cable,   label: 'Patch Panel' },
  cable_mgmt:  { accent: '#6b7280', icon: Cable,   label: 'Cable Mgmt'  },
  blank:       { accent: '#9ca3af', icon: Package, label: 'Blank'       },
  pdu:         { accent: '#ea580c', icon: Zap,     label: 'PDU'         },
  ups:         { accent: '#16a34a', icon: Battery, label: 'UPS'         },
  other:       { accent: '#7c3aed', icon: Cpu,     label: 'Other'       },
}

// ─── Device row with connections tooltip ──────────────────────────────────────

function DeviceRow({ unit }: { unit: RackUnit }) {
  const cfg  = TYPE_CFG_LIST[unit.item_type] ?? TYPE_CFG_LIST.other
  const name = unit.host_name || unit.patch_panel_name || unit.label || cfg.label
  const [hover, setHover] = useState(false)
  const [pos, setPos]     = useState({ x: 0, y: 0 })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: connections } = useQuery({
    queryKey: ['port-connections-list', unit.host],
    queryFn: () => portConnectionsApi.list({ host: String(unit.host) }),
    select: r => r.data,
    enabled: !!unit.host && hover,
    staleTime: 30000,
  })

  const { data: panelPorts } = useQuery({
    queryKey: ['patch-panel-ports-list', unit.patch_panel],
    queryFn: () => patchPanelPortsApi.list({ panel: String(unit.patch_panel) }),
    select: r => r.data,
    enabled: !!unit.patch_panel && hover,
    staleTime: 30000,
  })

  const connList = (connections ?? []).filter(c => c.host_a_id === unit.host || c.host_b_id === unit.host)
  const activePanelPorts = (panelPorts ?? []).filter(p => p.device_port_info?.host_name || p.device_port_info?.far_panel_name)
  const hasConns = connList.length > 0 || activePanelPorts.length > 0

  const onEnter = (e: React.MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setHover(true), 180)
  }
  const onMove = (e: React.MouseEvent) => setPos({ x: e.clientX, y: e.clientY })
  const onLeave = () => { if (timer.current) clearTimeout(timer.current); setHover(false) }

  return (
    <div
      className="flex items-center gap-3 px-3 py-1.5 rounded hover:bg-muted/40 transition-colors cursor-default relative"
      onMouseEnter={onEnter}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
        style={{ background: cfg.accent + '20', border: `1px solid ${cfg.accent}40` }}>
        <cfg.icon className="h-3 w-3" style={{ color: cfg.accent }}/>
      </div>
      <span className="text-[11px] font-mono text-muted-foreground shrink-0 w-5">U{unit.position_u}</span>
      <span className="text-xs font-medium truncate flex-1">{name}</span>
      {unit.host_ip && <span className="text-[10px] font-mono text-muted-foreground shrink-0">{unit.host_ip}</span>}
      {unit.height_u > 1 && <span className="text-[9px] text-muted-foreground shrink-0">{unit.height_u}U</span>}
      {hasConns && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"/>}

      {/* Hover tooltip with connections */}
      {hover && (
        <div className="fixed z-[9999] pointer-events-none"
          style={{ left: Math.min(pos.x + 16, window.innerWidth - 300), top: Math.max(8, pos.y - 10) }}>
          <div className="w-72 rounded-xl border border-border bg-popover shadow-xl overflow-hidden text-xs">
            <div className="px-3 py-2 flex items-center gap-2 border-b border-border/40"
              style={{ background: cfg.accent + '15' }}>
              <cfg.icon className="h-3.5 w-3.5 shrink-0" style={{ color: cfg.accent }}/>
              <span className="font-semibold truncate">{name}</span>
              <span className="ml-auto text-[9px] font-mono shrink-0" style={{ color: cfg.accent }}>U{unit.position_u}</span>
            </div>
            {unit.host_ip && (
              <div className="px-3 py-1.5 flex items-center gap-2 border-b border-border/20">
                <Network className="h-3 w-3 text-muted-foreground shrink-0"/>
                <span className="font-mono text-[10px]">{unit.host_ip}</span>
              </div>
            )}
            {connList.length > 0 && (
              <div className="px-3 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Połączenia ({connList.length})
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {connList.map(c => {
                    const isA = c.host_a_id === unit.host
                    const localPort  = isA ? c.port_a_name  : c.port_b_name
                    const remoteHost = isA ? c.host_b_name  : c.host_a_name
                    const remotePort = isA ? c.port_b_name  : c.port_a_name
                    return (
                      <div key={c.id} className="flex items-center gap-1.5 text-[10px]">
                        <span className="font-mono text-primary shrink-0">{localPort}</span>
                        <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0"/>
                        <span className="truncate text-foreground">{remoteHost}</span>
                        <span className="font-mono text-muted-foreground shrink-0 ml-auto">{remotePort}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {activePanelPorts.length > 0 && (
              <div className="px-3 py-2 border-t border-border/20">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Porty panelu ({activePanelPorts.length} połączonych)
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {activePanelPorts.slice(0, 8).map(p => {
                    const info = p.device_port_info!
                    return (
                      <div key={p.id} className="flex items-center gap-1.5 text-[10px]">
                        <span className="font-mono text-amber-500 shrink-0">P{p.port_number}</span>
                        <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0"/>
                        <span className="truncate text-foreground">{info.host_name || info.far_panel_name || '—'}</span>
                        <span className="font-mono text-muted-foreground shrink-0 ml-auto">
                          {info.device_port_name || (info.far_panel_port_number ? `P${info.far_panel_port_number}` : '')}
                        </span>
                      </div>
                    )
                  })}
                  {activePanelPorts.length > 8 && (
                    <p className="text-[9px] text-muted-foreground">+{activePanelPorts.length - 8} więcej…</p>
                  )}
                </div>
              </div>
            )}
            {!hasConns && (
              <div className="px-3 py-2 text-[10px] text-muted-foreground italic">Brak połączeń</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── RackListRow — card with expandable device list ───────────────────────────

function RackListRow({ rack, onEdit, onDelete }: { rack: Rack; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const freeU = rack.height_u - rack.used_u
  const pct = Math.round((rack.used_u / rack.height_u) * 100)

  // Sort units by position_u, deduplicate multi-U items
  const uniqueUnits = useMemo(() => {
    const seen = new Set<number>()
    const result: RackUnit[] = []
    for (const u of [...rack.rack_units].sort((a, b) => a.position_u - b.position_u)) {
      if (!seen.has(u.id)) { seen.add(u.id); result.push(u) }
    }
    return result.filter(u => u.item_type !== 'blank' && u.item_type !== 'cable_mgmt')
  }, [rack.rack_units])

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/30">
      {/* Header row */}
      <div className="flex items-center gap-4 px-4 py-3 group">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0 hover:bg-primary/20 transition-colors">
          <ChevDown className={cn('h-4 w-4 text-primary transition-transform', expanded && 'rotate-180')}/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{rack.name}</span>
            {rack.facility_id && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{rack.facility_id}</span>}
            <span className={cn(
              'text-[9px] rounded-full px-2 py-0.5 font-medium capitalize',
              rack.status === 'active' ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground',
            )}>{rack.status}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground">{rack.used_u}/{rack.height_u}U used</span>
            <span className={cn('text-[10px] font-medium', freeU > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
              {freeU}U free
            </span>
            {rack.location && <span className="text-[10px] text-muted-foreground truncate">{rack.location}</span>}
            <span className="text-[10px] text-muted-foreground ml-auto">{uniqueUnits.length} urządzeń</span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Device list */}
      {expanded && (
        <div className="border-t border-border/40 px-2 py-2 bg-muted/10">
          {uniqueUnits.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-3 italic">Szafa pusta</p>
          ) : (
            <div className="divide-y divide-border/30">
              {uniqueUnits.map(unit => (
                <DeviceRow key={unit.id} unit={unit}/>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Rack Form ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'active',          label: 'Active' },
  { value: 'planned',         label: 'Planned' },
  { value: 'reserved',        label: 'Reserved' },
  { value: 'decommissioning', label: 'Decommissioning' },
  { value: 'retired',         label: 'Retired' },
]

const RACK_TYPE_OPTIONS = [
  { value: '2post_open',   label: '2-post open frame' },
  { value: '2post_closed', label: '2-post closed' },
  { value: '4post_open',   label: '4-post open frame' },
  { value: '4post_closed', label: '4-post closed cabinet' },
  { value: 'wall_open',    label: 'Wall-mount open' },
  { value: 'wall_closed',  label: 'Wall-mount closed' },
]

interface RackFormProps {
  siteId: number
  rack?: Rack
  onClose: () => void
}

function RackForm({ siteId, rack, onClose }: RackFormProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(rack?.name ?? '')
  const [facilityId, setFacilityId] = useState(rack?.facility_id ?? '')
  const [status, setStatus] = useState(rack?.status ?? 'active')
  const [rackType, setRackType] = useState(rack?.rack_type ?? '4post_closed')
  const [heightU, setHeightU] = useState(rack?.height_u ?? 42)
  const [location, setLocation] = useState(rack?.location ?? '')
  const [numbDesc, setNumbDesc] = useState(rack?.numbering_desc ?? false)
  const [serial, setSerial] = useState(rack?.serial_number ?? '')
  const [asset, setAsset] = useState(rack?.asset_tag ?? '')
  const [desc, setDesc] = useState(rack?.description ?? '')

  const mutation = useMutation({
    mutationFn: () => rack
      ? racksApi.update(rack.id, { name, facility_id: facilityId, status: status as Rack['status'],
          rack_type: rackType as Rack['rack_type'], height_u: heightU, location,
          numbering_desc: numbDesc, serial_number: serial, asset_tag: asset, description: desc })
      : racksApi.create({ site: siteId, name, facility_id: facilityId, status: status as Rack['status'],
          rack_type: rackType as Rack['rack_type'], height_u: heightU, location,
          numbering_desc: numbDesc, serial_number: serial, asset_tag: asset, description: desc }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racks'] })
      toast.success(rack ? 'Rack updated' : 'Rack created')
      onClose()
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed')),
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rack-A1"
            autoFocus className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Facility ID</label>
          <input value={facilityId} onChange={e => setFacilityId(e.target.value)} placeholder="e.g. DC-R42"
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Type</label>
          <select value={rackType} onChange={e => setRackType(e.target.value)}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs">
            {RACK_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Height (U)</label>
          <input type="number" min={1} max={56} value={heightU} onChange={e => setHeightU(Number(e.target.value))}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Location / Row</label>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Row A, Room 3"
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Serial number</label>
          <input value={serial} onChange={e => setSerial(e.target.value)}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Asset tag</label>
          <input value={asset} onChange={e => setAsset(e.target.value)}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs" />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="numbdesc" checked={numbDesc} onChange={e => setNumbDesc(e.target.checked)}
            className="rounded border-input" />
          <label htmlFor="numbdesc" className="text-xs text-muted-foreground cursor-pointer">
            Descending numbering (U1 at top)
          </label>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Notes</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs resize-none" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose}
          className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
        <button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
          {mutation.isPending ? 'Saving…' : rack ? 'Update Rack' : 'Create Rack'}
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SiteRacksPage() {
  const { siteId, projectId } = useParams<{ siteId: string; projectId: string }>()
  const sid = Number(siteId)
  const pid = Number(projectId)
  const queryClient = useQueryClient()

  const [addOpen, setAddOpen] = useState(false)
  const [editRack, setEditRack] = useState<Rack | null>(null)
  const [selectedRackId, setSelectedRackId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'elevation' | 'list'>('elevation')

  const { data: racks, isLoading } = useQuery({
    queryKey: ['racks', { site: sid }],
    queryFn: () => racksApi.list({ site: String(sid) }),
    select: (res) => res.data,
    enabled: !!sid,
  })

  const { data: hosts } = useQuery({
    queryKey: ['hosts', { project: pid }],
    queryFn: () => hostsApi.list({ project: String(pid), page_size: '500' }),
    select: (res) => res.data.results.map(h => ({
      id: h.id,
      name: h.hostname || h.ip_address.split('/')[0],
      ip: h.ip_address.split('/')[0],
    })),
    enabled: !!pid,
  })

  const { data: panels } = useQuery({
    queryKey: ['patch-panels', { project: pid }],
    queryFn: () => patchPanelsApi.list({ project: String(pid) }),
    select: (res) => res.data.map(p => ({ id: p.id, name: p.name })),
    enabled: !!pid,
  })

  const deleteRack = useMutation({
    mutationFn: (id: number) => racksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racks'] })
      setSelectedRackId(null)
      toast.success('Rack deleted')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Cannot delete rack')),
  })

  const rackList = racks ?? []
  const selectedRack = rackList.find(r => r.id === selectedRackId) ?? rackList[0] ?? null

  // Pagination for elevation view (show one rack at a time on mobile, all on desktop)
  const [page, setPage] = useState(0)
  const RACKS_PER_PAGE = 3
  const pagedRacks = rackList.slice(page * RACKS_PER_PAGE, (page + 1) * RACKS_PER_PAGE)

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading racks…</div>
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-card/50 shrink-0">
        <Link to={`/projects/${pid}/topology`}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Server className="h-4 w-4 text-primary" />
        <div>
          <h1 className="text-sm font-bold">Rack Management</h1>
          <p className="text-[10px] text-muted-foreground">Site racks · {rackList.length} rack{rackList.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded border border-border overflow-hidden">
            <button onClick={() => setViewMode('elevation')}
              className={cn('p-1.5 text-xs transition-colors', viewMode === 'elevation' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setViewMode('list')}
              className={cn('p-1.5 text-xs transition-colors', viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Rack
          </button>
        </div>
      </div>

      {/* Content */}
      {rackList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto">
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold">No racks yet</p>
            <p className="text-sm text-muted-foreground">Add your first rack to start documenting physical infrastructure.</p>
            <button onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add First Rack
            </button>
          </div>
        </div>
      ) : viewMode === 'elevation' ? (
        /* ── Elevation view ── */
        <div className="flex-1 overflow-y-auto p-4">
          {/* Racks grid */}
          <div className="flex gap-6 flex-wrap items-start">
            {pagedRacks.map(rack => (
              <div key={rack.id} className="flex flex-col gap-2" style={{ width: 320 }}>
                {/* Per-rack controls */}
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditRack(rack)}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => { if (window.confirm(`Delete rack "${rack.name}"?`)) deleteRack.mutate(rack.id) }}
                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <RackElevation rack={rack} hosts={hosts ?? []} panels={panels ?? []} />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {rackList.length > RACKS_PER_PAGE && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded border border-border hover:bg-accent disabled:opacity-30 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground">
                {page + 1} / {Math.ceil(rackList.length / RACKS_PER_PAGE)}
              </span>
              <button onClick={() => setPage(p => Math.min(Math.ceil(rackList.length / RACKS_PER_PAGE) - 1, p + 1))}
                disabled={(page + 1) * RACKS_PER_PAGE >= rackList.length}
                className="p-1.5 rounded border border-border hover:bg-accent disabled:opacity-30 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ── List view ── */
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2 max-w-3xl">
            {rackList.map(rack => (
              <RackListRow
                key={rack.id}
                rack={rack}
                onEdit={() => setEditRack(rack)}
                onDelete={() => { if (window.confirm(`Delete rack "${rack.name}"?`)) deleteRack.mutate(rack.id) }}
              />
            ))}
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add Rack">
        <RackForm siteId={sid} onClose={() => setAddOpen(false)} />
      </Dialog>

      <Dialog open={!!editRack} onOpenChange={(o) => { if (!o) setEditRack(null) }} title="Edit Rack">
        {editRack && <RackForm siteId={sid} rack={editRack} onClose={() => setEditRack(null)} />}
      </Dialog>
    </div>
  )
}
