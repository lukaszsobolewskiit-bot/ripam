/**
 * PatchPanelView — widok patch paneli z pełnym back-to-back routing.
 * Każdy port ma przód (front) i tył (back).
 * Front → podłączenie urządzenia lub puszki abonenckiej
 * Back  → podłączenie innego patch panelu (śledzenie trasy kabla)
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patchPanelsApi, patchPanelConnectionsApi, hostsApi, hostPortsApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus, X, ChevronDown, ChevronRight, Layers, AlertCircle,
  ArrowRight, ArrowLeft, Server, Cable, Link2, ArrowLeftRight,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import type { PatchPanel, PatchPanelPort } from '@/types'

// ─── Media meta ───────────────────────────────────────────────────────────────

export const MEDIA_META: Record<string, { color: string; label: string; short: string }> = {
  copper:       { color: '#3b82f6', label: 'Copper — RJ45',      short: 'Cu'   },
  copper_rj11:  { color: '#60a5fa', label: 'Copper — RJ11',      short: 'RJ11' },
  copper_coax:  { color: '#93c5fd', label: 'Copper — Coax',      short: 'Coax' },
  fiber_lc_sm:  { color: '#f59e0b', label: 'Fiber SM — LC',      short: 'LC'   },
  fiber_sc_sm:  { color: '#fbbf24', label: 'Fiber SM — SC',      short: 'SC'   },
  fiber_sc_apc: { color: '#10b981', label: 'Fiber SM — SC/APC',  short: 'APC'  },
  fiber_sc_upc: { color: '#34d399', label: 'Fiber SM — SC/UPC',  short: 'UPC'  },
  fiber_st_sm:  { color: '#fcd34d', label: 'Fiber SM — ST',      short: 'ST'   },
  fiber_fc_sm:  { color: '#fde68a', label: 'Fiber SM — FC',      short: 'FC'   },
  fiber_e2000:  { color: '#f97316', label: 'Fiber SM — E2000',   short: 'E2k'  },
  fiber_lsh:    { color: '#fb923c', label: 'Fiber SM — LSH',     short: 'LSH'  },
  fiber_lc_mm:  { color: '#a855f7', label: 'Fiber MM — LC',      short: 'LC'   },
  fiber_lc_apc: { color: '#6ee7b7', label: 'Fiber MM — LC/APC',  short: 'APC'  },
  fiber_sc_mm:  { color: '#c084fc', label: 'Fiber MM — SC',      short: 'SC'   },
  fiber_st_mm:  { color: '#d8b4fe', label: 'Fiber MM — ST',      short: 'ST'   },
  fiber_fc_mm:  { color: '#e9d5ff', label: 'Fiber MM — FC',      short: 'FC'   },
  fiber_mpo12:  { color: '#ec4899', label: 'Fiber MPO-12',       short: 'M12'  },
  fiber_mpo24:  { color: '#f472b6', label: 'Fiber MPO-24',       short: 'M24'  },
  fiber_mtp:    { color: '#fb7185', label: 'Fiber MTP',          short: 'MTP'  },
  fiber_pretm:  { color: '#34d399', label: 'Fiber Pre-term',     short: 'PT'   },
  hdmi:         { color: '#6b7280', label: 'HDMI',               short: 'HDMI' },
  displayport:  { color: '#9ca3af', label: 'DisplayPort',        short: 'DP'   },
  keystone:     { color: '#d1d5db', label: 'Keystone',           short: 'KS'   },
  blank_1u:     { color: '#e5e7eb', label: 'Blank 1U',           short: '—'    },
  mixed:        { color: '#8b5cf6', label: 'Mixed / Keystone',   short: 'Mix'  },
  same:         { color: '#94a3b8', label: 'Same as front',      short: '='    },
}

// ─── Diagram trasy – widok pełnej ścieżki ─────────────────────────────────────

interface PathSegment {
  label: string
  sublabel?: string
  color?: string
  type: 'device' | 'panel' | 'box'
}

function PathDiagram({ segments }: { segments: PathSegment[] }) {
  if (segments.length === 0) return null
  return (
    <div className="flex items-center gap-1 flex-wrap text-[10px]">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
          <span className="flex items-center gap-1 rounded px-1.5 py-0.5 border"
            style={{
              backgroundColor: (seg.color ?? '#94a3b8') + '18',
              borderColor: (seg.color ?? '#94a3b8') + '44',
              color: seg.color ?? '#94a3b8',
            }}>
            {seg.type === 'device' ? <Server className="h-2.5 w-2.5" /> :
             seg.type === 'panel'  ? <Layers className="h-2.5 w-2.5" /> :
             <Cable className="h-2.5 w-2.5" />}
            <span className="font-medium">{seg.label}</span>
            {seg.sublabel && <span className="opacity-70">·{seg.sublabel}</span>}
          </span>
        </span>
      ))}
    </div>
  )
}

// ─── Port slot (przód + tył) ──────────────────────────────────────────────────

function PortCard({
  port, panel, allPanels,
  onConnectFront, onConnectBack,
  onDisconnectFront, onDisconnectBack,
}: {
  port: PatchPanelPort
  panel: PatchPanel
  allPanels: PatchPanel[]
  onConnectFront: (port: PatchPanelPort) => void
  onConnectBack: (port: PatchPanelPort) => void
  onDisconnectFront: (connId: number) => void
  onDisconnectBack: (connId: number) => void
}) {
  const frontMeta = MEDIA_META[panel.media_type] ?? MEDIA_META.copper
  const backMediaKey = port.back_media_type === 'same' || !port.back_media_type
    ? panel.media_type : port.back_media_type
  const backMeta = MEDIA_META[backMediaKey] ?? frontMeta

  const info = port.device_port_info
  const hasFront = !!info && (!!info.host_name || !!info.device_port_name)
  const hasBack  = !!info?.far_panel_name

  // Build path diagram
  const path: PathSegment[] = []
  if (info?.far_panel_name) {
    path.push({ label: info.far_panel_name, sublabel: `P${info.far_panel_port_number}`, color: '#f59e0b', type: 'panel' })
  }
  path.push({ label: panel.name, sublabel: `P${port.port_number}`, color: frontMeta.color, type: 'panel' })
  if (info?.host_name) {
    path.push({ label: info.host_name, sublabel: info.device_port_name, color: '#3b82f6', type: 'device' })
  }

  const portLabel = port.label || port.label_display || `${port.port_number}`

  return (
    <div className="group rounded-lg border border-border/60 bg-card hover:border-border transition-all overflow-hidden">
      {/* Port header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/20 border-b border-border/30">
        <span className="text-[10px] font-mono font-semibold text-muted-foreground w-6 shrink-0 text-right">
          {port.port_number}
        </span>
        {portLabel !== String(port.port_number) && (
          <span className="text-[10px] text-foreground font-medium truncate flex-1">{portLabel}</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {hasFront && hasBack && (
            <span className="text-[9px] bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium flex items-center gap-0.5">
              <ArrowLeftRight className="h-2.5 w-2.5" /> trasa
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border/30">
        {/* ── Przód (Front → device/box) ── */}
        <div className="p-2 space-y-1.5">
          <div className="flex items-center gap-1 mb-1">
            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50" />
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Przód</span>
            <div className="w-2 h-2 rounded-full ml-auto shrink-0"
              style={{ backgroundColor: frontMeta.color + '66', border: `1px solid ${frontMeta.color}` }} />
          </div>

          {hasFront ? (
            <div className="space-y-1">
              <div className="text-[10px] leading-tight">
                <div className="font-medium text-foreground truncate">{info!.host_name}</div>
                {info!.device_port_name && (
                  <div className="text-muted-foreground font-mono truncate">{info!.device_port_name}</div>
                )}
              </div>
              {info!.connection_id && (
                <button
                  onClick={() => onDisconnectFront(info!.connection_id)}
                  className="flex items-center gap-1 text-[9px] text-destructive/70 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="h-2.5 w-2.5" /> rozłącz
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => onConnectFront(port)}
              className="w-full flex items-center justify-center gap-1 rounded border border-dashed border-border/50 py-1.5 text-[9px] text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all"
            >
              <Plus className="h-2.5 w-2.5" /> podłącz
            </button>
          )}
        </div>

        {/* ── Tył (Back → other panel) ── */}
        <div className="p-2 space-y-1.5">
          <div className="flex items-center gap-1 mb-1">
            <ArrowLeft className="h-2.5 w-2.5 text-muted-foreground/50" />
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Tył</span>
            <div className="w-2 h-2 rounded-full ml-auto shrink-0"
              style={{ backgroundColor: backMeta.color + '66', border: `1px solid ${backMeta.color}` }} />
          </div>

          {hasBack ? (
            <div className="space-y-1">
              <div className="text-[10px] leading-tight">
                <div className="font-medium text-foreground truncate">{info!.far_panel_name}</div>
                <div className="text-muted-foreground font-mono">Port {info!.far_panel_port_number}</div>
              </div>
              {info!.connection_id && (
                <button
                  onClick={() => onDisconnectBack(info!.connection_id)}
                  className="flex items-center gap-1 text-[9px] text-destructive/70 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="h-2.5 w-2.5" /> rozłącz
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => onConnectBack(port)}
              className="w-full flex items-center justify-center gap-1 rounded border border-dashed border-border/50 py-1.5 text-[9px] text-muted-foreground hover:border-amber-500/50 hover:text-amber-600 hover:bg-amber-500/5 transition-all"
            >
              <Plus className="h-2.5 w-2.5" /> panel
            </button>
          )}
        </div>
      </div>

      {/* Pełna trasa (tylko gdy obie strony podłączone) */}
      {hasFront && hasBack && (
        <div className="px-2.5 py-1.5 bg-primary/5 border-t border-primary/10">
          <PathDiagram segments={path} />
        </div>
      )}
    </div>
  )
}

// ─── Dialog łączenia przodu (urządzenie) ──────────────────────────────────────

function ConnectFrontDialog({
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
    staleTime: 0, gcTime: 0,
  })

  const freePorts = (ports ?? []).filter(p => !p.connected_to)

  const mut = useMutation({
    mutationFn: () => patchPanelConnectionsApi.create({
      device_port: Number(devicePortId),
      panel_port: port.id,
      project: projectId,
      description: desc,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch-panels'] })
      toast.success('Port podłączony')
      onClose()
    },
    onError: () => toast.error('Błąd połączenia'),
  })

  return (
    <div className="space-y-4">
      <PortInfoBar panel={panel} port={port} side="front" />

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Urządzenie</label>
        <select value={hostId} onChange={e => { setHostId(e.target.value); setDevicePortId('') }}
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
          <option value="">— Wybierz urządzenie —</option>
          {hosts?.map(h => (
            <option key={h.id} value={h.id}>{h.hostname || h.ip_address}</option>
          ))}
        </select>
      </div>

      {hostId && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Port urządzenia</label>
          {freePorts.length === 0
            ? <p className="text-xs text-amber-600 bg-amber-500/10 rounded px-2 py-1.5 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Brak wolnych portów
              </p>
            : <select value={devicePortId} onChange={e => setDevicePortId(e.target.value)}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                <option value="">— Wybierz port —</option>
                {freePorts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.port_type.toUpperCase()})</option>
                ))}
              </select>
          }
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Opis (opcjonalny)</label>
        <input value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="np. Biurko A3, Sala konferencyjna…"
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
      </div>

      <DialogActions onClose={onClose} onConfirm={() => mut.mutate()} disabled={!devicePortId} pending={mut.isPending} label="Połącz" />
    </div>
  )
}

// ─── Dialog łączenia tyłu (patch panel → patch panel) ────────────────────────

function ConnectBackDialog({
  panel, port, allPanels, projectId, onClose,
}: {
  panel: PatchPanel; port: PatchPanelPort; allPanels: PatchPanel[]; projectId: number; onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [targetPanelId, setTargetPanelId] = useState('')
  const [targetPortId, setTargetPortId] = useState('')
  const [desc, setDesc] = useState('')

  const otherPanels = allPanels.filter(p => p.id !== panel.id)
  const selectedPanel = otherPanels.find(p => String(p.id) === targetPanelId)
  const freePorts = selectedPanel?.ports.filter(p => !p.device_port_info?.far_panel_name && !p.device_port_info?.connection_id) ?? []

  const mut = useMutation({
    mutationFn: () => patchPanelConnectionsApi.create({
      panel_port: port.id,
      far_panel_port: Number(targetPortId),
      project: projectId,
      description: desc,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch-panels'] })
      toast.success('Połączenie back-to-back utworzone')
      onClose()
    },
    onError: () => toast.error('Błąd połączenia'),
  })

  return (
    <div className="space-y-4">
      <PortInfoBar panel={panel} port={port} side="back" />

      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
        <ArrowLeftRight className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>Połączenie <strong>tył→tył</strong> między panelami — odzwierciedla trasę kabla krosowego łączącego tylne strony dwóch szaf.</span>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Docelowy Patch Panel</label>
        <select value={targetPanelId} onChange={e => { setTargetPanelId(e.target.value); setTargetPortId('') }}
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
          <option value="">— Wybierz panel —</option>
          {otherPanels.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.site_name || 'bez site'})</option>
          ))}
        </select>
      </div>

      {targetPanelId && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Port (tył) na docelowym panelu</label>
          {freePorts.length === 0
            ? <p className="text-xs text-amber-600 bg-amber-500/10 rounded px-2 py-1.5 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Brak wolnych portów tył
              </p>
            : <select value={targetPortId} onChange={e => setTargetPortId(e.target.value)}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                <option value="">— Wybierz port —</option>
                {freePorts.map(p => (
                  <option key={p.id} value={p.id}>
                    Port {p.port_number}{p.label ? ` — ${p.label}` : ''}
                    {p.device_port_info?.host_name ? ` (przód: ${p.device_port_info.host_name})` : ''}
                  </option>
                ))}
              </select>
          }
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Opis trasy (opcjonalny)</label>
        <input value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="np. Kabel #12, Rura OS1…"
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
      </div>

      <DialogActions onClose={onClose} onConfirm={() => mut.mutate()} disabled={!targetPortId} pending={mut.isPending} label="Utwórz połączenie" />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PortInfoBar({ panel, port, side }: { panel: PatchPanel; port: PatchPanelPort; side: 'front' | 'back' }) {
  const meta = MEDIA_META[panel.media_type] ?? MEDIA_META.copper
  return (
    <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="font-semibold">{panel.name}</span>
      <span className="text-muted-foreground">·</span>
      <span className="font-mono">Port {port.port_number}</span>
      {port.label && <span className="text-muted-foreground">({port.label})</span>}
      <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
        style={{ backgroundColor: meta.color + '18', color: meta.color, border: `1px solid ${meta.color}44` }}>
        {side === 'front' ? <ArrowRight className="h-2.5 w-2.5" /> : <ArrowLeft className="h-2.5 w-2.5" />}
        {side === 'front' ? 'Przód' : 'Tył'}
      </span>
    </div>
  )
}

function DialogActions({ onClose, onConfirm, disabled, pending, label }: {
  onClose: () => void; onConfirm: () => void; disabled: boolean; pending: boolean; label: string
}) {
  return (
    <div className="flex gap-2 justify-end pt-1 border-t border-border">
      <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
      <button onClick={onConfirm} disabled={disabled || pending}
        className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
        {pending ? 'Łączenie…' : label}
      </button>
    </div>
  )
}

// ─── Panel card ───────────────────────────────────────────────────────────────

function PanelCard({
  panel, allPanels, projectId,
  onConnectFront, onConnectBack, onDisconnectFront, onDisconnectBack,
}: {
  panel: PatchPanel; allPanels: PatchPanel[]; projectId: number
  onConnectFront: (panel: PatchPanel, port: PatchPanelPort) => void
  onConnectBack: (panel: PatchPanel, port: PatchPanelPort) => void
  onDisconnectFront: (id: number) => void
  onDisconnectBack: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const meta = MEDIA_META[panel.media_type] ?? MEDIA_META.copper
  const usedFront = panel.ports.filter(p => !!p.device_port_info?.host_name).length
  const usedBack  = panel.ports.filter(p => !!p.device_port_info?.far_panel_name).length

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}

        {/* Media badge */}
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold"
          style={{ backgroundColor: meta.color + '22', color: meta.color, border: `1.5px solid ${meta.color}55` }}>
          {meta.short}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{panel.name}</span>
            {panel.location && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{panel.location}</span>
            )}
            {panel.site_name && (
              <span className="text-[10px] text-muted-foreground">{panel.site_name}</span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
            <span style={{ color: meta.color }}>{meta.label}</span>
            <span>·</span>
            <span>{panel.port_count}p</span>
            <span className="flex items-center gap-1">
              <ArrowRight className="h-2.5 w-2.5" />
              <span className={cn('font-medium', usedFront > 0 ? 'text-blue-500' : '')}>{usedFront} przód</span>
            </span>
            <span className="flex items-center gap-1">
              <ArrowLeft className="h-2.5 w-2.5" />
              <span className={cn('font-medium', usedBack > 0 ? 'text-amber-500' : '')}>{usedBack} tył</span>
            </span>
          </div>
        </div>

        {/* Mini utilization */}
        <div className="w-24 shrink-0 hidden sm:block space-y-1">
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>przód</span>
            <span>{Math.round((usedFront / panel.port_count) * 100)}%</span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(usedFront / panel.port_count) * 100}%`, backgroundColor: meta.color }} />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>tył</span>
            <span>{Math.round((usedBack / panel.port_count) * 100)}%</span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${(usedBack / panel.port_count) * 100}%` }} />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="p-3 border-t border-border/30">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {panel.ports.map(port => (
              <PortCard
                key={port.id}
                port={port}
                panel={panel}
                allPanels={allPanels}
                onConnectFront={p => onConnectFront(panel, p)}
                onConnectBack={p => onConnectBack(panel, p)}
                onDisconnectFront={onDisconnectFront}
                onDisconnectBack={onDisconnectBack}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type ConnTarget = { panel: PatchPanel; port: PatchPanelPort; side: 'front' | 'back' } | null

export function PatchPanelView({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const [connectTarget, setConnectTarget] = useState<ConnTarget>(null)

  const { data: panels, isLoading } = useQuery({
    queryKey: ['patch-panels', { project: projectId }],
    queryFn: () => patchPanelsApi.list({ project: String(projectId) }),
    select: (res) => res.data,
  })

  const disconnectMut = useMutation({
    mutationFn: (id: number) => patchPanelConnectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch-panels'] })
      toast.success('Połączenie usunięte')
    },
  })

  const bySite = useMemo<Record<string, PatchPanel[]>>(() => {
    const m: Record<string, PatchPanel[]> = {}
    for (const p of (panels ?? [])) {
      const k = p.site_name || 'Nieprzypisane'
      ;(m[k] ??= []).push(p)
    }
    return m
  }, [panels])

  if (isLoading) return (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      Ładowanie patch paneli…
    </div>
  )

  if (!panels?.length) return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto">
          <Layers className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="font-medium">Brak patch paneli</p>
        <p className="text-sm text-muted-foreground">Dodaj panele w Ustawienia → Patch Panels.</p>
      </div>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Patch Panele</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{panels.length} paneli</span>
          <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><ArrowRight className="h-3 w-3 text-blue-500" /> Przód = urządzenie</span>
            <span className="flex items-center gap-1"><ArrowLeft className="h-3 w-3 text-amber-500" /> Tył = patch panel</span>
          </div>
        </div>

        {Object.entries(bySite).map(([siteName, sitePanels]) => (
          <div key={siteName} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{siteName}</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
            {sitePanels.map(panel => (
              <PanelCard
                key={panel.id}
                panel={panel}
                allPanels={panels}
                projectId={projectId}
                onConnectFront={(p, port) => setConnectTarget({ panel: p, port, side: 'front' })}
                onConnectBack={(p, port)  => setConnectTarget({ panel: p, port, side: 'back'  })}
                onDisconnectFront={id => { if (window.confirm('Usunąć połączenie?')) disconnectMut.mutate(id) }}
                onDisconnectBack={id  => { if (window.confirm('Usunąć połączenie tył?')) disconnectMut.mutate(id) }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Dialogi */}
      <Dialog
        open={!!connectTarget}
        onOpenChange={o => { if (!o) setConnectTarget(null) }}
        title={connectTarget?.side === 'back' ? 'Połącz Tył — Patch Panel → Patch Panel' : 'Połącz Przód — Port → Urządzenie'}
      >
        {connectTarget?.side === 'front' && (
          <ConnectFrontDialog
            panel={connectTarget.panel} port={connectTarget.port}
            projectId={projectId} onClose={() => setConnectTarget(null)}
          />
        )}
        {connectTarget?.side === 'back' && (
          <ConnectBackDialog
            panel={connectTarget.panel} port={connectTarget.port}
            allPanels={panels} projectId={projectId} onClose={() => setConnectTarget(null)}
          />
        )}
      </Dialog>
    </div>
  )
}
