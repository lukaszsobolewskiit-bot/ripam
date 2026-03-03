/**
 * SubscriberBoxView — puszki abonenckie.
 * Wygląd identyczny z PatchPanelView:
 *  - nagłówek z przyciskiem "Nowa puszka"
 *  - karty z rozwijaniem
 *  - siatka kwadratów portów (trunk górna linia, drop dolna)
 *  - tooltip na połączonych portach
 * Fix: hosty per site puszki; wybór site przy tworzeniu puszki.
 */
import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  subscriberBoxesApi, subscriberBoxPortsApi, subscriberBoxConnectionsApi,
  patchPanelsApi, hostsApi, sitesApi,
} from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus, X, ChevronDown, ChevronRight, Box,
  ArrowDownToLine, ArrowUpFromLine, AlertCircle, Link2, Layers,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import type { SubscriberBox, SubscriberBoxPort, PatchPanel, Site } from '@/types'

// ─── Stałe ────────────────────────────────────────────────────────────────────

const BOX_TYPES = [
  { value: 'indoor',      label: 'Wewnętrzna'  },
  { value: 'outdoor',     label: 'Zewnętrzna'  },
  { value: 'wall_mount',  label: 'Naścienna'   },
  { value: 'pole_mount',  label: 'Słupowa'     },
  { value: 'underground', label: 'Ziemna'      },
  { value: 'cabinet',     label: 'Szafkowa'    },
  { value: 'other',       label: 'Inna'        },
]

const MEDIA_OPTS: { v: string; l: string; color: string }[] = [
  { v: 'fiber_sc_apc', l: 'SC/APC',  color: '#10b981' },
  { v: 'fiber_sc_upc', l: 'SC/UPC',  color: '#34d399' },
  { v: 'fiber_sc_sm',  l: 'SC SM',   color: '#fbbf24' },
  { v: 'fiber_lc_sm',  l: 'LC SM',   color: '#f59e0b' },
  { v: 'fiber_st_sm',  l: 'ST SM',   color: '#fcd34d' },
  { v: 'fiber_fc_sm',  l: 'FC SM',   color: '#fde68a' },
  { v: 'fiber_lc_mm',  l: 'LC MM',   color: '#a855f7' },
  { v: 'fiber_sc_mm',  l: 'SC MM',   color: '#c084fc' },
  { v: 'fiber_mpo12',  l: 'MPO-12',  color: '#ec4899' },
  { v: 'fiber_mpo24',  l: 'MPO-24',  color: '#f472b6' },
  { v: 'copper',       l: 'RJ45',    color: '#3b82f6' },
  { v: 'copper_rj11',  l: 'RJ11',    color: '#60a5fa' },
  { v: 'other',        l: 'Inne',    color: '#9ca3af' },
]
const mediaColor = (t: string) => MEDIA_OPTS.find(m => m.v === t)?.color ?? '#94a3b8'
const mediaLabel = (t: string) => MEDIA_OPTS.find(m => m.v === t)?.l ?? t

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function PortTooltip({ port, panelName, x, y }: {
  port: SubscriberBoxPort; panelName?: string; x: number; y: number
}) {
  const left = Math.min(x + 14, window.innerWidth - 240)
  const top  = Math.max(8, y - 70)
  if (!port.connection_info) return null
  const color = mediaColor(port.media_type)
  return (
    <div className="fixed z-[9999] pointer-events-none" style={{ left, top }}>
      <div className="w-52 rounded-lg border border-border bg-popover shadow-xl overflow-hidden text-xs">
        <div className="px-3 py-2 flex items-center gap-2 border-b border-border/40"
          style={{ background: color + '18' }}>
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }}/>
          <span className="font-semibold">Port {port.port_number}</span>
          {port.label && <span className="text-muted-foreground truncate">— {port.label}</span>}
        </div>
        <div className="px-3 py-2 space-y-1">
          <div className="flex items-center gap-2">
            <Link2 className="h-3 w-3 text-primary shrink-0"/>
            <span className="font-medium truncate">{panelName || '—'}</span>
          </div>
          <div className="pl-5 text-muted-foreground font-mono">Port {port.connection_info.panel_port_number}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Port kwadrat ─────────────────────────────────────────────────────────────

function BoxPortSquare({ port, onConnect, onDisconnect, onHover, onLeave }: {
  port: SubscriberBoxPort
  onConnect: () => void
  onDisconnect: () => void
  onHover: (e: React.MouseEvent) => void
  onLeave: () => void
}) {
  const color = mediaColor(port.media_type)
  const label = port.label || String(port.port_number)
  const occ   = !!port.connection_info

  return (
    <div
      className="group relative flex flex-col items-center gap-0.5 p-1 rounded-md border cursor-pointer transition-all duration-100"
      style={{ borderColor: occ ? color + '80' : '#e2e8f0', backgroundColor: occ ? color + '18' : '#f8fafc' }}
      onMouseEnter={e => { if (occ) onHover(e) }}
      onMouseMove={e => { if (occ) onHover(e) }}
      onMouseLeave={onLeave}
      onClick={() => { if (!occ) onConnect() }}
      title={occ ? undefined : `Port ${port.port_number} — kliknij aby połączyć`}
    >
      <span className="text-[8px] font-mono leading-none text-muted-foreground/70 truncate max-w-full">
        {label.length > 4 ? label.slice(0, 4) : label}
      </span>
      <div className="w-6 h-3.5 rounded-sm flex items-center justify-center"
        style={{ backgroundColor: occ ? color + '30' : '#e2e8f0', border: `1.5px solid ${occ ? color : '#cbd5e1'}` }}>
        <div className="rounded-sm" style={{ width: 8, height: 5, backgroundColor: occ ? color : '#cbd5e1' }}/>
      </div>
      {occ && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}/>}
      {occ && (
        <button
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white hidden group-hover:flex items-center justify-center shadow-sm z-10"
          onClick={e => { e.stopPropagation(); onDisconnect() }}
        ><X className="h-2.5 w-2.5"/></button>
      )}
    </div>
  )
}

// ─── Connect Dialog ───────────────────────────────────────────────────────────

function ConnectPortDialog({ port, box, panels, onClose }: {
  port: SubscriberBoxPort; box: SubscriberBox
  panels: PatchPanel[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const [panelId, setPanelId]       = useState('')
  const [panelPortId, setPanelPortId] = useState('')

  // Hosty per site puszki
  const siteId = box.site
  const { data: _hosts } = useQuery({
    queryKey: ['hosts', { site: siteId }],
    queryFn: () => hostsApi.list({ site: String(siteId), page_size: '500' }),
    select: r => r.data.results,
    enabled: !!siteId,
  })

  const selectedPanel   = panels.find(p => String(p.id) === panelId)
  const freePanelPorts  = selectedPanel?.ports.filter(p =>
    !p.device_port_info?.host_name && !p.device_port_info?.connection_id
  ) ?? []

  // Panele z tego samego site lub bez site
  const sitePanels = siteId
    ? panels.filter(p => p.site === siteId || !p.site)
    : panels

  const mut = useMutation({
    mutationFn: () => subscriberBoxConnectionsApi.create({
      box_port: port.id, panel_port: Number(panelPortId),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriber-boxes'] }); toast.success('Połączono'); onClose() },
    onError:   () => toast.error('Błąd połączenia'),
  })

  const color = mediaColor(port.media_type)

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
        <Box className="h-3.5 w-3.5 text-violet-500"/>
        <span className="font-semibold">{box.name}</span>
        <span className="text-muted-foreground">· Port {port.port_number}</span>
        {port.label && <span className="text-muted-foreground">({port.label})</span>}
        <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
          style={{ backgroundColor: color + '18', color, border: `1px solid ${color}44` }}>
          {mediaLabel(port.media_type)}
        </span>
      </div>
      {box.site_name && (
        <p className="text-[10px] text-muted-foreground">
          Pokazuję panele z lokalizacji: <strong>{box.site_name}</strong>
        </p>
      )}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Patch Panel</label>
        <select value={panelId} onChange={e => { setPanelId(e.target.value); setPanelPortId('') }}
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
          <option value="">— Wybierz panel —</option>
          {sitePanels.map(p => <option key={p.id} value={p.id}>{p.name} ({p.site_name || 'bez site'})</option>)}
        </select>
      </div>
      {panelId && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Port panelu</label>
          {freePanelPorts.length === 0
            ? <p className="text-xs text-amber-600 bg-amber-500/10 rounded px-2 py-1.5 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5"/> Brak wolnych portów</p>
            : <select value={panelPortId} onChange={e => setPanelPortId(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                <option value="">— Wybierz port —</option>
                {freePanelPorts.map(p => <option key={p.id} value={p.id}>Port {p.port_number}{p.label ? ` — ${p.label}` : ''}</option>)}
              </select>
          }
        </div>
      )}
      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
        <button onClick={() => mut.mutate()} disabled={!panelPortId || mut.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
          {mut.isPending ? 'Łączenie…' : 'Połącz'}
        </button>
      </div>
    </div>
  )
}

// ─── Box card ─────────────────────────────────────────────────────────────────

function BoxCard({ box, panels }: { box: SubscriberBox; panels: PatchPanel[] }) {
  const qc = useQueryClient()
  const [expanded, setExpanded]       = useState(true)
  const [connectPort, setConnectPort] = useState<SubscriberBoxPort | null>(null)
  const [tooltip, setTooltip]         = useState<{ port: SubscriberBoxPort; x: number; y: number } | null>(null)
  const [addingPort, setAddingPort]   = useState<'trunk' | 'drop' | null>(null)
  const [newPortLabel, setNewPortLabel] = useState('')
  const [newPortMedia, setNewPortMedia] = useState('fiber_sc_apc')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trunkPorts = box.ports.filter(p => p.direction === 'trunk')
  const dropPorts  = box.ports.filter(p => p.direction === 'drop')

  const disconnectMut = useMutation({
    mutationFn: (connId: number) => subscriberBoxConnectionsApi.delete(connId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriber-boxes'] }); toast.success('Rozłączono') },
  })
  const addPortMut = useMutation({
    mutationFn: (dir: 'trunk' | 'drop') => {
      const portsInDir = box.ports.filter(p => p.direction === dir)
      const nextNum    = portsInDir.length > 0 ? Math.max(...portsInDir.map(p => p.port_number)) + 1 : 1
      return subscriberBoxPortsApi.create({ box: box.id, direction: dir, port_number: nextNum, media_type: newPortMedia, label: newPortLabel.trim() })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriber-boxes'] })
      setAddingPort(null); setNewPortLabel(''); setNewPortMedia('fiber_sc_apc')
      toast.success('Port dodany')
    },
    onError: () => toast.error('Błąd'),
  })

  const showTT = (port: SubscriberBoxPort, e: React.MouseEvent) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setTooltip({ port, x: e.clientX, y: e.clientY }), 200)
  }
  const hideTT = () => { if (timer.current) clearTimeout(timer.current); setTooltip(null) }

  const connPanelName = (p: SubscriberBoxPort) => {
    if (!p.connection_info) return undefined
    return panels.find(pan => pan.ports.some(pp => pp.id === p.connection_info?.panel_port_id))?.name
  }

  // Sekcja portów — identyczna z PatchPanelView
  const renderSection = (ports: SubscriberBoxPort[], dir: 'trunk' | 'drop') => {
    const color = dir === 'trunk' ? '#3b82f6' : '#10b981'
    const Icon  = dir === 'trunk' ? ArrowDownToLine : ArrowUpFromLine
    const label = dir === 'trunk' ? 'Trunk — wejście' : 'Drop — abonent'
    const used  = ports.filter(p => !!p.connection_info).length

    return (
      <div className="p-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className="h-3 w-3 shrink-0" style={{ color }}/>
          <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color }}>{label}</span>
          <span className="text-[9px] text-muted-foreground ml-1">{used}/{ports.length}</span>
          <div className="flex-1 h-px ml-1" style={{ backgroundColor: color + '30' }}/>
          <button onClick={() => { setAddingPort(dir); setNewPortLabel(''); setNewPortMedia('fiber_sc_apc') }}
            className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-primary transition-colors ml-1">
            <Plus className="h-2.5 w-2.5"/> port
          </button>
        </div>
        {ports.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ports.map(port => (
              <BoxPortSquare key={port.id} port={port}
                onConnect={() => setConnectPort(port)}
                onDisconnect={() => {
                  if (port.connection_info && window.confirm('Rozłączyć?'))
                    disconnectMut.mutate(port.connection_info.connection_id)
                }}
                onHover={e => showTT(port, e)}
                onLeave={hideTT}
              />
            ))}
          </div>
        )}
        {addingPort === dir && (
          <div className="mt-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-muted-foreground block mb-0.5">Typ złącza</label>
                <select value={newPortMedia} onChange={e => setNewPortMedia(e.target.value)}
                  className="w-full rounded border border-input bg-background px-1.5 py-1 text-[10px]">
                  {MEDIA_OPTS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground block mb-0.5">Etykieta</label>
                <input value={newPortLabel} onChange={e => setNewPortLabel(e.target.value)}
                  placeholder="np. Mieszk. 3"
                  onKeyDown={e => { if (e.key === 'Enter') addPortMut.mutate(dir); if (e.key === 'Escape') setAddingPort(null) }}
                  className="w-full rounded border border-input bg-background px-1.5 py-1 text-[10px]"
                  autoFocus/>
              </div>
            </div>
            <div className="flex gap-1 justify-end">
              <button onClick={() => setAddingPort(null)} className="px-2 py-0.5 rounded border border-border text-[10px] hover:bg-accent">Anuluj</button>
              <button onClick={() => addPortMut.mutate(dir)} disabled={addPortMut.isPending}
                className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground disabled:opacity-50">
                <Plus className="h-2.5 w-2.5"/> Dodaj
              </button>
            </div>
          </div>
        )}
        {ports.length === 0 && addingPort !== dir && (
          <p className="text-[10px] text-muted-foreground/50 py-1 pl-1">Brak portów — kliknij „+ port"</p>
        )}
      </div>
    )
  }

  const connected = box.ports.filter(p => !!p.connection_info).length

  // Skalowanie szerokości — im więcej portów tym szersze pole portów
  // Każdy port ~36px szerokości + padding; minimalna szerokość dla 8 portów
  const maxPortsInRow = Math.max(trunkPorts.length, dropPorts.length, 1)
  // Obliczamy sugerowaną min-width dla sekcji portów: ~36px/port + 24px padding
  const portsSectionMinW = Math.min(Math.max(maxPortsInRow * 36 + 24, 280), 960)

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Nagłówek — identyczny styl jak PanelRack */}
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-muted/20 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/>
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/>
        }
        {/* Ikona puszki */}
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#8b5cf622', border: '1.5px solid #8b5cf655' }}>
          <Box className="h-4 w-4" style={{ color: '#8b5cf6' }}/>
        </div>
        {/* Metadane */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{box.name}</span>
            {box.site_name && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{box.site_name}</span>
            )}
            {box.location && (
              <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{box.location}</span>
            )}
            <span className="text-[10px] text-muted-foreground capitalize">
              {BOX_TYPES.find(t => t.value === box.box_type)?.label ?? box.box_type}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowDownToLine className="h-2.5 w-2.5 text-blue-400"/>{box.trunk_count} trunk
            </span>
            <span className="flex items-center gap-1">
              <ArrowUpFromLine className="h-2.5 w-2.5 text-emerald-400"/>{box.drop_count} drop
            </span>
            <span>· {connected} połączonych</span>
          </div>
        </div>
        {/* Pasy wykorzystania — jak w PanelRack */}
        <div className="w-20 shrink-0 hidden sm:block space-y-1">
          {[
            { v: trunkPorts.filter(p => !!p.connection_info).length, t: box.trunk_count, c: '#3b82f6' },
            { v: dropPorts.filter(p => !!p.connection_info).length,  t: box.drop_count,  c: '#10b981' },
          ].map(({ v, t, c }, i) => (
            <div key={i} className="h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(v / Math.max(t, 1)) * 100}%`, backgroundColor: c }}/>
            </div>
          ))}
        </div>
      </button>

      {/* Ciało — identyczne z PanelRack */}
      {expanded && (
        <div className="border-t border-border/30">
          <div className="rounded-lg overflow-hidden border border-border/50 bg-muted/5 m-3" style={{ minWidth: portsSectionMinW }}>
            {renderSection(trunkPorts, 'trunk')}
            <div className="mx-2 h-px bg-border/40 flex items-center justify-center">
              <span className="text-[8px] text-muted-foreground/40 bg-card px-2">puszka</span>
            </div>
            {renderSection(dropPorts, 'drop')}
          </div>
        </div>
      )}

      {tooltip && (
        <PortTooltip port={tooltip.port} panelName={connPanelName(tooltip.port)} x={tooltip.x} y={tooltip.y}/>
      )}

      <Dialog open={!!connectPort} onOpenChange={o => { if (!o) setConnectPort(null) }}
        title={`Połącz port — ${box.name} · Port ${connectPort?.port_number}`}>
        {connectPort && (
          <ConnectPortDialog port={connectPort} box={box} panels={panels} onClose={() => setConnectPort(null)}/>
        )}
      </Dialog>
    </div>
  )
}

// ─── Add Box Dialog ───────────────────────────────────────────────────────────

function AddBoxDialog({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName]   = useState('')
  const [type, setType]   = useState('indoor')
  const [loc, setLoc]     = useState('')
  const [siteId, setSiteId] = useState('')

  const { data: sites } = useQuery({
    queryKey: ['sites', projectId],
    queryFn:  () => sitesApi.list(projectId),
    select:   r => r.data.results as Site[],
  })

  const mut = useMutation({
    mutationFn: () => subscriberBoxesApi.create({
      name: name.trim(), box_type: type, location: loc.trim(),
      site: siteId ? Number(siteId) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriber-boxes'] }); toast.success('Puszka dodana'); onClose() },
    onError:   () => toast.error('Błąd tworzenia'),
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] text-muted-foreground block mb-0.5">Nazwa *</label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="np. PK-01"
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"/>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Typ puszki</label>
          <select value={type} onChange={e => setType(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
            {BOX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Lokalizacja (Site)</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
            <option value="">— Brak przypisania —</option>
            {(sites ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[10px] text-muted-foreground block mb-0.5">Opis lokalizacji</label>
          <input value={loc} onChange={e => setLoc(e.target.value)} placeholder="np. Kl. 1, piętro 2"
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"/>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
        <button onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
          {mut.isPending ? 'Tworzenie…' : 'Dodaj puszkę'}
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SubscriberBoxView({ projectId }: { projectId: number }) {
  const [addBox, setAddBox] = useState(false)

  const { data: boxes, isLoading } = useQuery({
    queryKey: ['subscriber-boxes', { project: projectId }],
    queryFn:  () => subscriberBoxesApi.list({ project: String(projectId) }),
    select:   r => r.data,
  })

  // Panele per projekt — filtrowanie per site działa w ConnectPortDialog
  const { data: panels } = useQuery({
    queryKey: ['patch-panels', { project: projectId }],
    queryFn:  () => patchPanelsApi.list({ project: String(projectId) }),
    select:   r => r.data,
  })

  const bySite = useMemo<Record<string, SubscriberBox[]>>(() => {
    const m: Record<string, SubscriberBox[]> = {}
    for (const b of (boxes ?? [])) {
      const k = b.site_name || 'Nieprzypisane'
      ;(m[k] ??= []).push(b)
    }
    return m
  }, [boxes])

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-5 max-w-6xl mx-auto">

        {/* Nagłówek — identyczny styl jak PatchPanelView */}
        <div className="flex items-center gap-3">
          <Box className="h-5 w-5 text-violet-500"/>
          <h2 className="text-base font-semibold">Puszki Abonenckie</h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {boxes?.length ?? 0} puszek
            </span>
          )}
          <div className="ml-auto flex items-center gap-4">
            {/* Legenda — taka sama jak w Patches */}
            <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><ArrowDownToLine className="h-3 w-3 text-blue-400"/>Trunk → wejście</span>
              <span className="flex items-center gap-1.5"><ArrowUpFromLine className="h-3 w-3 text-emerald-400"/>Drop → abonent</span>
            </div>
            <button onClick={() => setAddBox(true)}
              className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5"/> Nowa puszka
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">Ładowanie…</div>
        )}

        {!isLoading && boxes?.length === 0 && (
          <div className="flex h-40 items-center justify-center">
            <div className="text-center space-y-2">
              <Box className="h-10 w-10 text-muted-foreground/30 mx-auto"/>
              <p className="text-sm font-medium">Brak puszek abonenckich</p>
              <p className="text-xs text-muted-foreground">Kliknij „Nowa puszka" aby dodać.</p>
            </div>
          </div>
        )}

        {/* Grupowanie po site — identyczne jak w PatchPanelView */}
        {Object.entries(bySite).map(([siteName, siteBoxes]) => (
          <div key={siteName} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{siteName}</span>
              <div className="flex-1 h-px bg-border/50"/>
            </div>
            {siteBoxes.map(box => (
              <BoxCard key={box.id} box={box} panels={panels ?? []}/>
            ))}
          </div>
        ))}
      </div>

      <Dialog open={addBox} onOpenChange={o => { if (!o) setAddBox(false) }} title="Nowa Puszka Abonencka">
        <AddBoxDialog projectId={projectId} onClose={() => setAddBox(false)}/>
      </Dialog>
    </div>
  )
}
