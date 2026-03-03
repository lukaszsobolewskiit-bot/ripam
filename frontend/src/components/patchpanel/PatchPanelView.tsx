/**
 * PatchPanelView — widok patch paneli z dwiema liniami portów (przód/tył).
 * Fix 2: Przycisk "Nowy panel" bezpośrednio w widoku.
 * Fix 4: Hosty per site (panel.site → filtrowanie hostów).
 */
import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patchPanelsApi, patchPanelConnectionsApi, patchPanelPortsApi, hostsApi, hostPortsApi, sitesApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  X, ChevronDown, ChevronRight, Layers, AlertCircle,
  ArrowRight, ArrowLeft, ArrowLeftRight, Plus, Server,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import type { PatchPanel, PatchPanelPort, Site } from '@/types'

// ─── Media ────────────────────────────────────────────────────────────────────

export const MEDIA_META: Record<string, { color: string; label: string; short: string }> = {
  copper:       { color: '#3b82f6', label: 'Copper — RJ45',     short: 'Cu'   },
  copper_rj11:  { color: '#60a5fa', label: 'Copper — RJ11',     short: 'RJ11' },
  copper_coax:  { color: '#93c5fd', label: 'Copper — Coax',     short: 'Coax' },
  fiber_lc_sm:  { color: '#f59e0b', label: 'Fiber SM — LC',     short: 'LC'   },
  fiber_sc_sm:  { color: '#fbbf24', label: 'Fiber SM — SC',     short: 'SC'   },
  fiber_sc_apc: { color: '#10b981', label: 'Fiber SM — SC/APC', short: 'APC'  },
  fiber_sc_upc: { color: '#34d399', label: 'Fiber SM — SC/UPC', short: 'UPC'  },
  fiber_st_sm:  { color: '#fcd34d', label: 'Fiber SM — ST',     short: 'ST'   },
  fiber_fc_sm:  { color: '#fde68a', label: 'Fiber SM — FC',     short: 'FC'   },
  fiber_e2000:  { color: '#f97316', label: 'Fiber SM — E2000',  short: 'E2k'  },
  fiber_lsh:    { color: '#fb923c', label: 'Fiber SM — LSH',    short: 'LSH'  },
  fiber_lc_mm:  { color: '#a855f7', label: 'Fiber MM — LC',     short: 'LC'   },
  fiber_lc_apc: { color: '#6ee7b7', label: 'Fiber MM — LC/APC', short: 'APC'  },
  fiber_sc_mm:  { color: '#c084fc', label: 'Fiber MM — SC',     short: 'SC'   },
  fiber_st_mm:  { color: '#d8b4fe', label: 'Fiber MM — ST',     short: 'ST'   },
  fiber_fc_mm:  { color: '#e9d5ff', label: 'Fiber MM — FC',     short: 'FC'   },
  fiber_mpo12:  { color: '#ec4899', label: 'Fiber MPO-12',      short: 'M12'  },
  fiber_mpo24:  { color: '#f472b6', label: 'Fiber MPO-24',      short: 'M24'  },
  fiber_mtp:    { color: '#fb7185', label: 'Fiber MTP',         short: 'MTP'  },
  keystone:     { color: '#d1d5db', label: 'Keystone',          short: 'KS'   },
  mixed:        { color: '#8b5cf6', label: 'Mixed/Keystone',    short: 'Mix'  },
  blank_1u:     { color: '#e5e7eb', label: 'Blank 1U',          short: '—'    },
  same:         { color: '#94a3b8', label: 'Same as front',     short: '='    },
}

const MEDIA_GROUPS = [
  { g: 'Copper',  opts: [['copper','RJ45'],['copper_rj11','RJ11'],['copper_coax','Coax']] },
  { g: 'Fiber SM',opts: [['fiber_sc_apc','SC/APC'],['fiber_sc_upc','SC/UPC'],['fiber_sc_sm','SC'],['fiber_lc_sm','LC'],['fiber_st_sm','ST'],['fiber_fc_sm','FC'],['fiber_e2000','E2000'],['fiber_lsh','LSH']] },
  { g: 'Fiber MM',opts: [['fiber_lc_mm','LC'],['fiber_lc_apc','LC/APC'],['fiber_sc_mm','SC'],['fiber_st_mm','ST'],['fiber_fc_mm','FC']] },
  { g: 'MTP/MPO', opts: [['fiber_mpo12','MPO-12'],['fiber_mpo24','MPO-24'],['fiber_mtp','MTP']] },
  { g: 'Other',   opts: [['keystone','Keystone'],['mixed','Mixed'],['blank_1u','Blank 1U']] },
] as const

function MediaSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
      {MEDIA_GROUPS.map(g => (
        <optgroup key={g.g} label={g.g}>
          {g.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function PortTooltip({ port, side, panelColor, x, y }: {
  port: PatchPanelPort; side: 'front' | 'back'; panelColor: string; x: number; y: number
}) {
  const info  = port.device_port_info
  const left  = Math.min(x + 14, window.innerWidth - 260)
  const top   = Math.max(8, y - 70)
  const hasFront = !!(info?.host_name)
  const hasBack  = !!info?.far_panel_name
  if ((side === 'front' && !hasFront) || (side === 'back' && !hasBack)) return null
  return (
    <div className="fixed z-[9999] pointer-events-none" style={{ left, top }}>
      <div className="w-56 rounded-lg border border-border bg-popover shadow-xl overflow-hidden text-xs">
        <div className="px-3 py-2 flex items-center gap-2 border-b border-border/40"
          style={{ background: (side === 'front' ? panelColor : '#f59e0b') + '18' }}>
          {side === 'front'
            ? <><ArrowRight className="h-3 w-3 shrink-0" style={{ color: panelColor }}/><span className="font-semibold">Przód · Port {port.port_number}</span></>
            : <><ArrowLeft  className="h-3 w-3 shrink-0 text-amber-500"/><span className="font-semibold">Tył · Port {port.port_number}</span></>
          }
        </div>
        <div className="px-3 py-2 space-y-1">
          {side === 'front' && hasFront && (
            <><div className="flex items-center gap-2"><Server className="h-3 w-3 text-blue-500 shrink-0"/><span className="font-medium truncate">{info!.host_name}</span></div>
            {info!.device_port_name && <div className="pl-5 text-muted-foreground font-mono truncate">{info!.device_port_name}</div>}</>
          )}
          {side === 'back' && hasBack && (
            <><div className="flex items-center gap-2"><Layers className="h-3 w-3 text-amber-500 shrink-0"/><span className="font-medium truncate">{info!.far_panel_name}</span></div>
            <div className="pl-5 text-muted-foreground font-mono">Port {info!.far_panel_port_number}</div></>
          )}
          {hasFront && hasBack && (
            <div className="pt-1 mt-1 border-t border-border/30 flex items-center gap-1 text-[10px] flex-wrap">
              <span style={{ color: '#f59e0b' }}>{info!.far_panel_name}:{info!.far_panel_port_number}</span>
              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40"/>
              <span style={{ color: panelColor }}>ten panel</span>
              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40"/>
              <span className="text-blue-500">{info!.host_name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Port kwadrat ─────────────────────────────────────────────────────────────

function PortSquare({ port, side, color, onConnect, onDisconnect, onDeletePort, onHover, onLeave }: {
  port: PatchPanelPort; side: 'front' | 'back'; color: string
  onConnect: () => void; onDisconnect: (id: number) => void
  onDeletePort: () => void
  onHover: (e: React.MouseEvent) => void; onLeave: () => void
}) {
  const info  = port.device_port_info
  const occ   = side === 'front' ? !!(info?.host_name) : !!(info?.far_panel_name)
  const label = port.label || String(port.port_number)
  const c     = side === 'front' ? color : '#f59e0b'

  return (
    <div
      className="group relative flex flex-col items-center gap-0.5 p-1 rounded-md border cursor-pointer transition-all duration-100"
      style={{ borderColor: occ ? c + '80' : '#e2e8f0', backgroundColor: occ ? c + '18' : '#f8fafc', minWidth: 0 }}
      onMouseEnter={e => { if (occ) onHover(e) }}
      onMouseMove={e => { if (occ) onHover(e) }}
      onMouseLeave={onLeave}
      onClick={() => { if (!occ) onConnect() }}
      title={occ ? undefined : `Port ${port.port_number} — kliknij aby połączyć`}
    >
      <span className="text-[8px] font-mono leading-none text-muted-foreground/70 truncate max-w-full">
        {label.length > 4 ? label.slice(0,4) : label}
      </span>
      <div className="w-6 h-3.5 rounded-sm flex items-center justify-center"
        style={{ backgroundColor: occ ? c + '30' : '#e2e8f0', border: `1.5px solid ${occ ? c : '#cbd5e1'}` }}>
        <div className="rounded-sm" style={{ width: 8, height: 5, backgroundColor: occ ? c : '#cbd5e1' }}/>
      </div>
      {occ && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }}/>}
      {occ && info?.connection_id && (
        <button
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white hidden group-hover:flex items-center justify-center shadow-sm z-10"
          onClick={e => { e.stopPropagation(); onDisconnect(info.connection_id) }}
        ><X className="h-2.5 w-2.5"/></button>
      )}
      {/* Usuń port — widoczny tylko dla wolnych portów przy hover */}
      {!occ && (
        <button
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white hidden group-hover:flex items-center justify-center shadow-sm z-10"
          onClick={e => { e.stopPropagation(); onDeletePort() }}
          title="Usuń port"
        ><X className="h-2.5 w-2.5"/></button>
      )}
    </div>
  )
}

// ─── Panel rack ───────────────────────────────────────────────────────────────

// Liczba portów per wiersz: ≤12 → 12, ≤24 → 24, ≤48 → 24, >48 → 24
const PORTS_PER_ROW = 24

function PanelRack({ panel, allPanels, projectId, onConnect, onDisconnect }: {
  panel: PatchPanel; allPanels: PatchPanel[]; projectId: number
  onConnect: (port: PatchPanelPort, side: 'front' | 'back') => void
  onDisconnect: (id: number) => void
}) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(true)
  const [tooltip, setTooltip]   = useState<{ port: PatchPanelPort; side: 'front'|'back'; x: number; y: number } | null>(null)
  const [addingPort, setAddingPort]     = useState(false)
  const [newPortLabel, setNewPortLabel] = useState('')
  const [newPortMedia, setNewPortMedia] = useState('same')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const meta      = MEDIA_META[panel.media_type] ?? MEDIA_META.copper
  const frontUsed = panel.ports.filter(p => !!p.device_port_info?.host_name).length
  const backUsed  = panel.ports.filter(p => !!p.device_port_info?.far_panel_name).length

  const addPortMut = useMutation({
    mutationFn: () => {
      const nextNum = panel.ports.length > 0 ? Math.max(...panel.ports.map(p => p.port_number)) + 1 : 1
      return patchPanelPortsApi.create({
        panel: panel.id,
        port_number: nextNum,
        label: newPortLabel.trim(),
        back_media_type: newPortMedia as PatchPanelPort['back_media_type'],
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patch-panels'] })
      setAddingPort(false); setNewPortLabel(''); setNewPortMedia('same')
      toast.success('Port dodany')
    },
    onError: () => toast.error('Błąd dodawania portu'),
  })

  const deletePortMut = useMutation({
    mutationFn: (id: number) => patchPanelPortsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patch-panels'] }); toast.success('Port usunięty') },
    onError:   () => toast.error('Nie można usunąć — port jest połączony'),
  })

  const showTT = (port: PatchPanelPort, side: 'front'|'back', e: React.MouseEvent) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setTooltip({ port, side, x: e.clientX, y: e.clientY }), 200)
  }
  const hideTT = () => { if (timer.current) clearTimeout(timer.current); setTooltip(null) }

  // Skalowanie: dobieramy rozmiar wiersza do liczby portów
  const portsPerRow = panel.ports.length <= 12 ? 12 : PORTS_PER_ROW
  const rows: PatchPanelPort[][] = []
  for (let i = 0; i < panel.ports.length; i += portsPerRow) rows.push(panel.ports.slice(i, i + portsPerRow))

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button className="w-full flex items-center gap-3 px-4 py-2.5 bg-muted/20 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/>}
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold"
          style={{ backgroundColor: meta.color + '22', color: meta.color, border: `1.5px solid ${meta.color}55` }}>
          {meta.short}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{panel.name}</span>
            {panel.location && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{panel.location}</span>}
            {panel.site_name && <span className="text-[10px] text-muted-foreground">{panel.site_name}</span>}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
            <span style={{ color: meta.color }}>{meta.label}</span>
            <span>· {panel.port_count}p</span>
            <span className="flex items-center gap-1"><ArrowRight className="h-2.5 w-2.5 text-blue-400"/><span className={cn(frontUsed>0?'text-blue-500 font-medium':'')}>{frontUsed}</span></span>
            <span className="flex items-center gap-1"><ArrowLeft className="h-2.5 w-2.5 text-amber-400"/><span className={cn(backUsed>0?'text-amber-500 font-medium':'')}>{backUsed}</span></span>
          </div>
        </div>
        <div className="w-20 shrink-0 hidden sm:block space-y-1">
          {[{v:frontUsed,c:meta.color},{v:backUsed,c:'#f59e0b'}].map(({v,c},i)=>(
            <div key={i} className="h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width:`${(v/Math.max(panel.port_count,1))*100}%`, backgroundColor:c }}/>
            </div>
          ))}
        </div>
      </button>

      {expanded && (
        <div className="p-3 pt-2 border-t border-border/30 space-y-3">
          {rows.map((row, ri) => (
            <div key={ri} className="rounded-lg overflow-hidden border border-border/50 bg-muted/5">
              {rows.length > 1 && (
                <div className="px-2 py-0.5 text-[9px] text-muted-foreground/60 font-mono border-b border-border/30">
                  Porty {ri * portsPerRow + 1}–{Math.min((ri + 1) * portsPerRow, panel.ports.length)}
                </div>
              )}
              {/* Przód */}
              <div className="p-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ArrowRight className="h-3 w-3 shrink-0" style={{ color: meta.color }}/>
                  <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>Przód — urządzenia</span>
                  <div className="flex-1 h-px ml-1" style={{ backgroundColor: meta.color + '30' }}/>
                </div>
                <div className="flex flex-wrap gap-1">
                  {row.map(port => (
                    <PortSquare key={`f-${port.id}`} port={port} side="front" color={meta.color}
                      onConnect={() => onConnect(port, 'front')}
                      onDisconnect={onDisconnect}
                      onDeletePort={() => {
                        if (window.confirm(`Usunąć port ${port.port_number}${port.label ? ` (${port.label})` : ''}?`))
                          deletePortMut.mutate(port.id)
                      }}
                      onHover={e => showTT(port, 'front', e)}
                      onLeave={hideTT}
                    />
                  ))}
                </div>
              </div>
              {/* Separator */}
              <div className="mx-2 h-px bg-border/40 flex items-center justify-center">
                <span className="text-[8px] text-muted-foreground/40 bg-muted px-2">patch kablem</span>
              </div>
              {/* Tył */}
              <div className="p-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ArrowLeft className="h-3 w-3 shrink-0 text-amber-500"/>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-500">Tył — inne panele</span>
                  <div className="flex-1 h-px bg-amber-400/30 ml-1"/>
                </div>
                <div className="flex flex-wrap gap-1">
                  {row.map(port => (
                    <PortSquare key={`b-${port.id}`} port={port} side="back" color={meta.color}
                      onConnect={() => onConnect(port, 'back')}
                      onDisconnect={onDisconnect}
                      onDeletePort={() => {
                        if (window.confirm(`Usunąć port ${port.port_number}${port.label ? ` (${port.label})` : ''}?`))
                          deletePortMut.mutate(port.id)
                      }}
                      onHover={e => showTT(port, 'back', e)}
                      onLeave={hideTT}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Dodaj port — inline formularz */}
          {addingPort ? (
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nowy port #{panel.ports.length + 1}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Złącze tył</label>
                  <select value={newPortMedia} onChange={e => setNewPortMedia(e.target.value)}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                    <option value="same">= Taki sam jak przód ({meta.short})</option>
                    <optgroup label="Copper">
                      <option value="copper">RJ45</option>
                      <option value="copper_rj11">RJ11</option>
                    </optgroup>
                    <optgroup label="Fiber SM">
                      <option value="fiber_sc_apc">SC/APC</option>
                      <option value="fiber_sc_upc">SC/UPC</option>
                      <option value="fiber_sc_sm">SC SM</option>
                      <option value="fiber_lc_sm">LC SM</option>
                      <option value="fiber_st_sm">ST SM</option>
                      <option value="fiber_fc_sm">FC SM</option>
                    </optgroup>
                    <optgroup label="Fiber MM">
                      <option value="fiber_lc_mm">LC MM</option>
                      <option value="fiber_sc_mm">SC MM</option>
                    </optgroup>
                    <optgroup label="MTP/MPO">
                      <option value="fiber_mpo12">MPO-12</option>
                      <option value="fiber_mpo24">MPO-24</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Etykieta (opcjonalna)</label>
                  <input value={newPortLabel} onChange={e => setNewPortLabel(e.target.value)}
                    placeholder={`np. P${panel.ports.length + 1}`}
                    onKeyDown={e => { if (e.key === 'Enter') addPortMut.mutate(); if (e.key === 'Escape') setAddingPort(false) }}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setAddingPort(false)} className="px-3 py-1.5 rounded border border-border text-xs hover:bg-accent">Anuluj</button>
                <button onClick={() => addPortMut.mutate()} disabled={addPortMut.isPending}
                  className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
                  <Plus className="h-3 w-3"/> Dodaj port
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingPort(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-2 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors">
              <Plus className="h-3.5 w-3.5"/> Dodaj port
            </button>
          )}
        </div>
      )}

      {tooltip && <PortTooltip port={tooltip.port} side={tooltip.side} panelColor={meta.color} x={tooltip.x} y={tooltip.y}/>}
    </div>
  )
}

// ─── Connect Front Dialog ─────────────────────────────────────────────────────

function ConnectFrontDialog({ panel, port, allPanels, onClose }: {
  panel: PatchPanel; port: PatchPanelPort; allPanels: PatchPanel[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'host' | 'panel'>('host')
  // Host mode
  const [hostId, setHostId]         = useState('')
  const [devicePortId, setDevicePortId] = useState('')
  const [desc, setDesc]             = useState('')
  // Panel mode
  const [targetPanelId, setTargetPanelId] = useState('')
  const [targetPortId, setTargetPortId]   = useState('')

  const siteId = panel.site
  const { data: hosts } = useQuery({
    queryKey: ['hosts', { site: siteId }],
    queryFn: () => hostsApi.list({ site: String(siteId), page_size: '500' }),
    select: r => r.data.results,
    enabled: !!siteId,
  })

  const { data: ports } = useQuery({
    queryKey: ['host-ports-patch', hostId],
    queryFn: () => hostPortsApi.list({ host: hostId }),
    select: r => r.data,
    enabled: !!hostId, staleTime: 0, gcTime: 0,
  })

  const freePorts = (ports ?? []).filter(p => !p.connected_to)
  const meta = MEDIA_META[panel.media_type] ?? MEDIA_META.copper

  const otherPanels = allPanels.filter(p => p.id !== panel.id)
  const selectedPanel = otherPanels.find(p => String(p.id) === targetPanelId)
  const freePanelPorts = selectedPanel?.ports.filter(p => !p.device_port_info?.host_name && !p.device_port_info?.far_panel_name) ?? []

  const mutHost = useMutation({
    mutationFn: () => patchPanelConnectionsApi.create({
      device_port: Number(devicePortId), panel_port: port.id, description: desc,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patch-panels'] }); toast.success('Połączono'); onClose() },
    onError: () => toast.error('Błąd połączenia'),
  })

  const mutPanel = useMutation({
    mutationFn: () => patchPanelConnectionsApi.create({
      panel_port: port.id, far_panel_port: Number(targetPortId), description: desc,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patch-panels'] }); toast.success('Połączono panel–panel'); onClose() },
    onError: () => toast.error('Błąd połączenia'),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
        <Layers className="h-3.5 w-3.5 text-muted-foreground"/>
        <span className="font-semibold">{panel.name}</span>
        <span className="text-muted-foreground">· Port {port.port_number}</span>
        {port.label && <span className="text-muted-foreground">({port.label})</span>}
        <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
          style={{ backgroundColor: meta.color+'18', color: meta.color, border:`1px solid ${meta.color}44` }}>
          <ArrowRight className="h-2.5 w-2.5"/> Przód
        </span>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded border border-border overflow-hidden text-xs">
        <button onClick={() => setMode('host')}
          className={`flex-1 py-1.5 transition-colors ${mode==='host' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
          Urządzenie / host
        </button>
        <button onClick={() => setMode('panel')}
          className={`flex-1 py-1.5 transition-colors ${mode==='panel' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
          Inny Patch Panel
        </button>
      </div>

      {mode === 'host' && (
        <>
          {panel.site_name && (
            <p className="text-[10px] text-muted-foreground">Pokazuję urządzenia z lokalizacji: <strong>{panel.site_name}</strong></p>
          )}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Urządzenie</label>
            <select value={hostId} onChange={e => { setHostId(e.target.value); setDevicePortId('') }}
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
              <option value="">— Wybierz urządzenie —</option>
              {(hosts ?? []).map(h => <option key={h.id} value={h.id}>{h.hostname || h.ip_address}</option>)}
            </select>
          </div>
          {hostId && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Port urządzenia</label>
              {freePorts.length === 0
                ? <p className="text-xs text-amber-600 bg-amber-500/10 rounded px-2 py-1.5 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5"/> Brak wolnych portów</p>
                : <select value={devicePortId} onChange={e => setDevicePortId(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                    <option value="">— Wybierz port —</option>
                    {freePorts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.port_type.toUpperCase()})</option>)}
                  </select>
              }
            </div>
          )}
        </>
      )}

      {mode === 'panel' && (
        <>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Docelowy Patch Panel</label>
            <select value={targetPanelId} onChange={e => { setTargetPanelId(e.target.value); setTargetPortId('') }}
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
              <option value="">— Wybierz panel —</option>
              {otherPanels.map(p => <option key={p.id} value={p.id}>{p.name} ({p.site_name || 'bez site'})</option>)}
            </select>
          </div>
          {targetPanelId && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Port panelu</label>
              {freePanelPorts.length === 0
                ? <p className="text-xs text-amber-600 bg-amber-500/10 rounded px-2 py-1.5 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5"/> Brak wolnych portów</p>
                : <select value={targetPortId} onChange={e => setTargetPortId(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                    <option value="">— Wybierz port —</option>
                    {freePanelPorts.map(p => <option key={p.id} value={p.id}>Port {p.port_number}{p.label ? ` — ${p.label}` : ''}</option>)}
                  </select>
              }
            </div>
          )}
        </>
      )}

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Opis</label>
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="np. Biurko A3…"
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"/>
      </div>
      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
        {mode === 'host'
          ? <button onClick={() => mutHost.mutate()} disabled={!devicePortId || mutHost.isPending}
              className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
              {mutHost.isPending ? 'Łączenie…' : 'Połącz'}
            </button>
          : <button onClick={() => mutPanel.mutate()} disabled={!targetPortId || mutPanel.isPending}
              className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
              {mutPanel.isPending ? 'Łączenie…' : 'Połącz'}
            </button>
        }
      </div>
    </div>
  )
}

// ─── Connect Back Dialog ──────────────────────────────────────────────────────

function ConnectBackDialog({ panel, port, allPanels, onClose }: {
  panel: PatchPanel; port: PatchPanelPort; allPanels: PatchPanel[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const [targetPanelId, setTargetPanelId] = useState('')
  const [targetPortId, setTargetPortId]   = useState('')
  const [desc, setDesc] = useState('')

  const otherPanels = allPanels.filter(p => p.id !== panel.id)
  const selected    = otherPanels.find(p => String(p.id) === targetPanelId)
  const freePorts   = selected?.ports.filter(p => !p.device_port_info?.far_panel_name) ?? []

  const mut = useMutation({
    mutationFn: () => patchPanelConnectionsApi.create({ panel_port: port.id, far_panel_port: Number(targetPortId), description: desc }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patch-panels'] }); toast.success('Połączenie tył–tył utworzone'); onClose() },
    onError: () => toast.error('Błąd'),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs flex items-center gap-2">
        <ArrowLeftRight className="h-3.5 w-3.5 text-amber-600 shrink-0"/>
        <span className="text-amber-700 dark:text-amber-400">Połączenie <strong>tył → tył</strong>: trasa kabla krosowego między panelami.</span>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Docelowy Patch Panel</label>
        <select value={targetPanelId} onChange={e => { setTargetPanelId(e.target.value); setTargetPortId('') }}
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
          <option value="">— Wybierz panel —</option>
          {otherPanels.map(p => <option key={p.id} value={p.id}>{p.name} ({p.site_name || 'bez site'})</option>)}
        </select>
      </div>
      {targetPanelId && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Port tył</label>
          {freePorts.length === 0
            ? <p className="text-xs text-amber-600 bg-amber-500/10 rounded px-2 py-1.5 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5"/> Brak wolnych portów tył</p>
            : <select value={targetPortId} onChange={e => setTargetPortId(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                <option value="">— Wybierz port —</option>
                {freePorts.map(p => <option key={p.id} value={p.id}>Port {p.port_number}{p.label?` — ${p.label}`:''}</option>)}
              </select>
          }
        </div>
      )}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Opis trasy</label>
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="np. Kabel #12…"
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"/>
      </div>
      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
        <button onClick={() => mut.mutate()} disabled={!targetPortId || mut.isPending}
          className="rounded bg-amber-500 px-3 py-1.5 text-xs text-white disabled:opacity-50">
          {mut.isPending ? 'Łączenie…' : 'Utwórz połączenie'}
        </button>
      </div>
    </div>
  )
}

// ─── Add Panel Dialog (Fix 2) ─────────────────────────────────────────────────

function AddPanelDialog({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName]     = useState('')
  const [media, setMedia]   = useState('fiber_sc_apc')
  const [count, setCount]   = useState(24)
  const [loc, setLoc]       = useState('')
  const [siteId, setSiteId] = useState('')

  const { data: sites } = useQuery({
    queryKey: ['sites', projectId],
    queryFn:  () => sitesApi.list(projectId),
    select:   r => r.data.results as Site[],
  })

  const mut = useMutation({
    mutationFn: () => patchPanelsApi.create({
      name: name.trim(), media_type: media as PatchPanel['media_type'],
      port_count: count, location: loc.trim(),
      site: siteId ? Number(siteId) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patch-panels'] }); toast.success('Panel dodany'); onClose() },
    onError: () => toast.error('Błąd tworzenia panelu'),
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] text-muted-foreground block mb-0.5">Nazwa *</label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="np. PP-01"
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"/>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Typ złącza *</label>
          <MediaSelect value={media} onChange={setMedia}/>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Liczba portów</label>
          <input type="number" min={1} max={96} value={count} onChange={e => setCount(Number(e.target.value))}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"/>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Lokalizacja (Site)</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
            <option value="">— Brak przypisania —</option>
            {(sites ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Opis lokalizacji</label>
          <input value={loc} onChange={e => setLoc(e.target.value)} placeholder="np. Rack A, U3"
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"/>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
        <button onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
          {mut.isPending ? 'Tworzenie…' : 'Dodaj panel'}
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type ConnTarget = { panel: PatchPanel; port: PatchPanelPort; side: 'front' | 'back' } | null

export function PatchPanelView({ projectId }: { projectId: number }) {
  const qc = useQueryClient()
  const [connectTarget, setConnectTarget] = useState<ConnTarget>(null)
  const [addPanel, setAddPanel]           = useState(false)

  const { data: panels, isLoading } = useQuery({
    queryKey: ['patch-panels', { project: projectId }],
    queryFn: () => patchPanelsApi.list({ project: String(projectId) }),
    select: r => r.data,
  })

  const disconnectMut = useMutation({
    mutationFn: (id: number) => patchPanelConnectionsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patch-panels'] }); toast.success('Połączenie usunięte') },
  })

  const bySite = useMemo<Record<string, PatchPanel[]>>(() => {
    const m: Record<string, PatchPanel[]> = {}
    for (const p of (panels ?? [])) {
      const k = p.site_name || 'Nieprzypisane'
      ;(m[k] ??= []).push(p)
    }
    return m
  }, [panels])

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-5 max-w-6xl mx-auto">

        {/* Nagłówek */}
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-primary"/>
          <h2 className="text-base font-semibold">Patch Panele</h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {panels?.length ?? 0} paneli
            </span>
          )}
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border-2 border-blue-400 bg-blue-400/20"/>Przód → urządzenie</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border-2 border-amber-400 bg-amber-400/20"/>Tył → panel</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-border bg-muted/30"/>Wolny</span>
            </div>
            <button onClick={() => setAddPanel(true)}
              className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5"/> Nowy panel
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">Ładowanie…</div>}

        {/* Empty state */}
        {!isLoading && panels?.length === 0 && (
          <div className="flex h-40 items-center justify-center">
            <div className="text-center space-y-2">
              <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto"/>
              <p className="text-sm font-medium">Brak patch paneli</p>
              <p className="text-xs text-muted-foreground">Kliknij „Nowy panel" aby dodać.</p>
            </div>
          </div>
        )}

        {/* Lista */}
        {Object.entries(bySite).map(([siteName, sitePanels]) => (
          <div key={siteName} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{siteName}</span>
              <div className="flex-1 h-px bg-border/50"/>
            </div>
            {sitePanels.map(panel => (
              <PanelRack key={panel.id} panel={panel} allPanels={panels!} projectId={projectId}
                onConnect={(port, side) => setConnectTarget({ panel, port, side })}
                onDisconnect={id => { if (window.confirm('Usunąć połączenie?')) disconnectMut.mutate(id) }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Dialog nowego panelu */}
      <Dialog open={addPanel} onOpenChange={o => { if (!o) setAddPanel(false) }} title="Nowy Patch Panel">
        <AddPanelDialog projectId={projectId} onClose={() => setAddPanel(false)}/>
      </Dialog>

      {/* Dialog połączenia */}
      <Dialog
        open={!!connectTarget}
        onOpenChange={o => { if (!o) setConnectTarget(null) }}
        title={connectTarget?.side === 'back'
          ? `Tył — ${connectTarget?.panel.name} · Port ${connectTarget?.port.port_number}`
          : `Przód — ${connectTarget?.panel.name} · Port ${connectTarget?.port.port_number}`}
      >
        {connectTarget?.side === 'front' && (
          <ConnectFrontDialog panel={connectTarget.panel} port={connectTarget.port} allPanels={panels!} onClose={() => setConnectTarget(null)}/>
        )}
        {connectTarget?.side === 'back' && (
          <ConnectBackDialog panel={connectTarget.panel} port={connectTarget.port} allPanels={panels!} onClose={() => setConnectTarget(null)}/>
        )}
      </Dialog>
    </div>
  )
}
