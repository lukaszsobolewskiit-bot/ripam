/**
 * PatchPanelView — dwa rzędy portów jak fizyczny patch panel.
 * Rząd górny = FRONT (urządzenia), rząd dolny = BACK (patch panele).
 * Hover na porcie → dymek z detalami połączenia.
 */
import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patchPanelsApi, patchPanelConnectionsApi, hostsApi, hostPortsApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  X, ChevronDown, ChevronRight, Layers, AlertCircle,
  ArrowRight, ArrowLeft, Server, ArrowLeftRight, Plus,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import type { PatchPanel, PatchPanelPort } from '@/types'

// ─── Media colours ────────────────────────────────────────────────────────────

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
  fiber_pretm:  { color: '#34d399', label: 'Fiber Pre-term',    short: 'PT'   },
  hdmi:         { color: '#6b7280', label: 'HDMI',              short: 'HDMI' },
  displayport:  { color: '#9ca3af', label: 'DisplayPort',       short: 'DP'   },
  keystone:     { color: '#d1d5db', label: 'Keystone',          short: 'KS'   },
  blank_1u:     { color: '#e5e7eb', label: 'Blank 1U',          short: '—'    },
  mixed:        { color: '#8b5cf6', label: 'Mixed / Keystone',  short: 'Mix'  },
  same:         { color: '#94a3b8', label: 'Same as front',     short: '='    },
}

// ─── Port tooltip ─────────────────────────────────────────────────────────────

interface TooltipProps {
  port: PatchPanelPort
  side: 'front' | 'back'
  panelMediaColor: string
  x: number
  y: number
}

function PortTooltip({ port, side, panelMediaColor, x, y }: TooltipProps) {
  const info = port.device_port_info
  const left = Math.min(x + 14, window.innerWidth - 260)
  const top  = Math.max(8, y - 70)

  const hasFront = !!(info?.host_name || info?.device_port_name)
  const hasBack  = !!info?.far_panel_name

  if (side === 'front' && !hasFront) return null
  if (side === 'back'  && !hasBack)  return null

  return (
    <div className="fixed z-[9999] pointer-events-none" style={{ left, top }}>
      <div className="w-56 rounded-lg border border-border bg-popover shadow-xl overflow-hidden text-xs">
        {/* Header */}
        <div className="px-3 py-2 flex items-center gap-2 border-b border-border/50"
          style={{ background: panelMediaColor + '18' }}>
          {side === 'front'
            ? <><ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: panelMediaColor }} /><span className="font-semibold text-foreground">Przód — Port {port.port_number}</span></>
            : <><ArrowLeft  className="h-3.5 w-3.5 shrink-0" style={{ color: '#f59e0b'       }} /><span className="font-semibold text-foreground">Tył — Port {port.port_number}</span></>
          }
        </div>
        <div className="px-3 py-2 space-y-1">
          {side === 'front' && hasFront && (
            <>
              {info!.host_name && (
                <div className="flex items-center gap-2">
                  <Server className="h-3 w-3 text-blue-500 shrink-0" />
                  <span className="font-medium text-foreground truncate">{info!.host_name}</span>
                </div>
              )}
              {info!.device_port_name && (
                <div className="pl-5 text-muted-foreground font-mono truncate">{info!.device_port_name}</div>
              )}
            </>
          )}
          {side === 'back' && hasBack && (
            <>
              <div className="flex items-center gap-2">
                <Layers className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="font-medium text-foreground truncate">{info!.far_panel_name}</span>
              </div>
              <div className="pl-5 text-muted-foreground font-mono">Port {info!.far_panel_port_number}</div>
            </>
          )}
          {port.label && (
            <div className="text-muted-foreground italic truncate pt-0.5 border-t border-border/30 mt-1">{port.label}</div>
          )}
          {/* Pełna trasa */}
          {hasFront && hasBack && (
            <div className="pt-1.5 mt-1 border-t border-border/30">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
                <span className="font-medium" style={{ color: '#f59e0b' }}>{info!.far_panel_name}:{info!.far_panel_port_number}</span>
                <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                <span className="font-medium" style={{ color: panelMediaColor }}>ten panel</span>
                <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                <span className="font-medium text-blue-500">{info!.host_name}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pojedynczy kwadrat portu ─────────────────────────────────────────────────

function PortSquare({
  port, side, mediaColor, onConnect, onDisconnect, onShowTooltip, onHideTooltip,
}: {
  port: PatchPanelPort
  side: 'front' | 'back'
  mediaColor: string
  onConnect: (p: PatchPanelPort, side: 'front' | 'back') => void
  onDisconnect: (connId: number) => void
  onShowTooltip: (p: PatchPanelPort, side: 'front' | 'back', e: React.MouseEvent) => void
  onHideTooltip: () => void
}) {
  const info = port.device_port_info
  const occupied = side === 'front'
    ? !!(info?.host_name || info?.device_port_name)
    : !!info?.far_panel_name

  const color = side === 'front' ? mediaColor : '#f59e0b'
  const portLabel = port.label || String(port.port_number)

  return (
    <div
      className="group relative flex flex-col items-center gap-0.5 p-1 rounded-md border transition-all duration-100 cursor-pointer"
      style={{
        borderColor: occupied ? color + '80' : '#e2e8f0',
        backgroundColor: occupied ? color + '18' : '#f8fafc',
        minWidth: 0,
      }}
      onMouseEnter={e => { if (occupied) onShowTooltip(port, side, e) }}
      onMouseMove={e => { if (occupied) onShowTooltip(port, side, e) }}
      onMouseLeave={onHideTooltip}
      onClick={() => {
        if (!occupied) {
          onConnect(port, side)
        }
      }}
      title={occupied ? undefined : `Port ${port.port_number} — kliknij aby połączyć`}
    >
      {/* Numer portu */}
      <span className="text-[8px] font-mono leading-none text-muted-foreground/70 truncate max-w-full">
        {portLabel.length > 4 ? portLabel.slice(0, 4) : portLabel}
      </span>

      {/* Wizualizacja gniazda */}
      <div
        className="w-6 h-3.5 rounded-sm flex items-center justify-center transition-colors"
        style={{
          backgroundColor: occupied ? color + '30' : '#e2e8f0',
          border: `1.5px solid ${occupied ? color : '#cbd5e1'}`,
        }}
      >
        <div
          className="rounded-sm transition-colors"
          style={{
            width: 8, height: 5,
            backgroundColor: occupied ? color : '#cbd5e1',
          }}
        />
      </div>

      {/* Mała ikona po podłączeniu */}
      {occupied && (
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}

      {/* Przycisk usuwania (hover) */}
      {occupied && info?.connection_id && (
        <button
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white hidden group-hover:flex items-center justify-center shadow-sm z-10"
          onClick={e => { e.stopPropagation(); onDisconnect(info.connection_id) }}
          title="Usuń połączenie"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}

// ─── Wizualizacja panelu (dwa rzędy) ─────────────────────────────────────────

function PanelRack({
  panel, allPanels, projectId,
  onConnect, onDisconnect,
}: {
  panel: PatchPanel
  allPanels: PatchPanel[]
  projectId: number
  onConnect: (panel: PatchPanel, port: PatchPanelPort, side: 'front' | 'back') => void
  onDisconnect: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [tooltip, setTooltip] = useState<{ port: PatchPanelPort; side: 'front' | 'back'; x: number; y: number } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const meta = MEDIA_META[panel.media_type] ?? MEDIA_META.copper
  const frontUsed = panel.ports.filter(p => !!(p.device_port_info?.host_name || p.device_port_info?.device_port_name)).length
  const backUsed  = panel.ports.filter(p => !!p.device_port_info?.far_panel_name).length

  const showTooltip = (port: PatchPanelPort, side: 'front' | 'back', e: React.MouseEvent) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setTooltip({ port, side, x: e.clientX, y: e.clientY }), 180)
  }
  const hideTooltip = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setTooltip(null)
  }

  // Podziel porty na rzędy po 24 (jak fizyczny panel)
  const rows: PatchPanelPort[][] = []
  for (let i = 0; i < panel.ports.length; i += 24) {
    rows.push(panel.ports.slice(i, i + 24))
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* ── Nagłówek panelu ── */}
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}

        {/* Typ medium badge */}
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
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-3">
            <span style={{ color: meta.color }}>{meta.label}</span>
            <span>·</span>
            <span>{panel.port_count}p</span>
            <span className="flex items-center gap-1">
              <ArrowRight className="h-2.5 w-2.5 text-blue-400" />
              <span className={cn(frontUsed > 0 ? 'text-blue-500 font-medium' : '')}>{frontUsed} przód</span>
            </span>
            <span className="flex items-center gap-1">
              <ArrowLeft className="h-2.5 w-2.5 text-amber-400" />
              <span className={cn(backUsed > 0 ? 'text-amber-500 font-medium' : '')}>{backUsed} tył</span>
            </span>
          </div>
        </div>

        {/* Paski wykorzystania */}
        <div className="w-24 shrink-0 hidden sm:block space-y-1">
          {[
            { label: '▶ przód', used: frontUsed, color: meta.color },
            { label: '◀ tył',  used: backUsed,  color: '#f59e0b'  },
          ].map(({ label, used, color }) => (
            <div key={label}>
              <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                <span>{label}</span>
                <span>{Math.round((used / Math.max(panel.port_count, 1)) * 100)}%</span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${(used / Math.max(panel.port_count, 1)) * 100}%`, backgroundColor: color }} />
              </div>
            </div>
          ))}
        </div>
      </button>

      {/* ── Wizualizacja portów ── */}
      {expanded && (
        <div className="p-3 pt-2 border-t border-border/30 space-y-3">
          {rows.map((row, ri) => (
            <div key={ri} className="rounded-lg overflow-hidden border border-border/50 bg-muted/5">
              {/* Etykieta rzędu */}
              {rows.length > 1 && (
                <div className="px-2 py-0.5 text-[9px] text-muted-foreground/60 font-mono border-b border-border/30">
                  Porty {ri * 24 + 1}–{Math.min((ri + 1) * 24, panel.port_count)}
                </div>
              )}

              {/* ─── Rząd FRONT ─── */}
              <div className="p-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ArrowRight className="h-3 w-3 shrink-0" style={{ color: meta.color }} />
                  <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>Przód — urządzenia</span>
                  <div className="flex-1 h-px ml-1" style={{ backgroundColor: meta.color + '30' }} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {row.map(port => (
                    <PortSquare
                      key={`f-${port.id}`}
                      port={port}
                      side="front"
                      mediaColor={meta.color}
                      onConnect={(p, s) => onConnect(panel, p, s)}
                      onDisconnect={onDisconnect}
                      onShowTooltip={showTooltip}
                      onHideTooltip={hideTooltip}
                    />
                  ))}
                </div>
              </div>

              {/* ─── Separator ─── */}
              <div className="mx-2 h-px bg-border/40 flex items-center justify-center">
                <span className="text-[8px] text-muted-foreground/40 bg-muted px-2">patch kablem</span>
              </div>

              {/* ─── Rząd BACK ─── */}
              <div className="p-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ArrowLeft className="h-3 w-3 shrink-0 text-amber-500" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-500">Tył — inne panele</span>
                  <div className="flex-1 h-px bg-amber-400/30 ml-1" />
                </div>
                <div className="flex flex-wrap gap-1">
                  {row.map(port => (
                    <PortSquare
                      key={`b-${port.id}`}
                      port={port}
                      side="back"
                      mediaColor={meta.color}
                      onConnect={(p, s) => onConnect(panel, p, s)}
                      onDisconnect={onDisconnect}
                      onShowTooltip={showTooltip}
                      onHideTooltip={hideTooltip}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <PortTooltip
          port={tooltip.port}
          side={tooltip.side}
          panelMediaColor={meta.color}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  )
}

// ─── Dialog: połącz przód (urządzenie) ───────────────────────────────────────

function ConnectFrontDialog({
  panel, port, projectId, onClose,
}: {
  panel: PatchPanel; port: PatchPanelPort; projectId: number; onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [hostId, setHostId]         = useState('')
  const [devicePortId, setDevicePortId] = useState('')
  const [desc, setDesc]             = useState('')

  const { data: hosts } = useQuery({
    queryKey: ['hosts', { project: projectId }],
    queryFn: () => hostsApi.list({ project: String(projectId), page_size: '500' }),
    select: r => r.data.results,
  })

  const { data: ports } = useQuery({
    queryKey: ['host-ports-patch', hostId],
    queryFn: () => hostPortsApi.list({ host: hostId }),
    select: r => r.data,
    enabled: !!hostId, staleTime: 0, gcTime: 0,
  })

  const freePorts = (ports ?? []).filter(p => !p.connected_to)

  const mut = useMutation({
    mutationFn: () => patchPanelConnectionsApi.create({
      device_port: Number(devicePortId), panel_port: port.id, project: projectId, description: desc,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['patch-panels'] }); toast.success('Połączono'); onClose() },
    onError: () => toast.error('Błąd połączenia'),
  })

  const meta = MEDIA_META[panel.media_type] ?? MEDIA_META.copper

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-semibold">{panel.name}</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-mono">Port {port.port_number}</span>
        {port.label && <span className="text-muted-foreground">({port.label})</span>}
        <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
          style={{ backgroundColor: meta.color + '18', color: meta.color, border: `1px solid ${meta.color}44` }}>
          <ArrowRight className="h-2.5 w-2.5" /> Przód
        </span>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Urządzenie</label>
        <select value={hostId} onChange={e => { setHostId(e.target.value); setDevicePortId('') }}
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
          <option value="">— Wybierz urządzenie —</option>
          {hosts?.map(h => <option key={h.id} value={h.id}>{h.hostname || h.ip_address}</option>)}
        </select>
      </div>

      {hostId && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Port urządzenia</label>
          {freePorts.length === 0
            ? <p className="text-xs text-amber-600 bg-amber-500/10 rounded px-2 py-1.5 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Brak wolnych portów</p>
            : <select value={devicePortId} onChange={e => setDevicePortId(e.target.value)}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                <option value="">— Wybierz port —</option>
                {freePorts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.port_type.toUpperCase()})</option>)}
              </select>
          }
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Opis (opcjonalny)</label>
        <input value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="np. Biurko A3…"
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
      </div>

      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
        <button onClick={() => mut.mutate()} disabled={!devicePortId || mut.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
          {mut.isPending ? 'Łączenie…' : 'Połącz'}
        </button>
      </div>
    </div>
  )
}

// ─── Dialog: połącz tył (patch panel → patch panel) ──────────────────────────

function ConnectBackDialog({
  panel, port, allPanels, projectId, onClose,
}: {
  panel: PatchPanel; port: PatchPanelPort; allPanels: PatchPanel[]; projectId: number; onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [targetPanelId, setTargetPanelId] = useState('')
  const [targetPortId, setTargetPortId]   = useState('')
  const [desc, setDesc] = useState('')

  const otherPanels = allPanels.filter(p => p.id !== panel.id)
  const selectedPanel = otherPanels.find(p => String(p.id) === targetPanelId)
  // Wolne porty tył: takie, które nie mają far_panel_name
  const freePorts = selectedPanel?.ports.filter(p => !p.device_port_info?.far_panel_name) ?? []

  const mut = useMutation({
    mutationFn: () => patchPanelConnectionsApi.create({
      panel_port: port.id, far_panel_port: Number(targetPortId),
      project: projectId, description: desc,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['patch-panels'] }); toast.success('Połączenie tył–tył utworzone'); onClose() },
    onError: () => toast.error('Błąd połączenia'),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs flex items-center gap-2">
        <ArrowLeftRight className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span className="text-amber-700 dark:text-amber-400">
          Połączenie <strong>tył → tył</strong>: odwzorowanie kabla krosowego między tyłami szaf / paneli.
        </span>
      </div>

      <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-semibold">{panel.name}</span> · <span className="font-mono">Port {port.port_number}</span>
        {port.label && <span className="text-muted-foreground">({port.label})</span>}
        <span className="ml-auto text-amber-500 flex items-center gap-1 text-[10px]">
          <ArrowLeft className="h-2.5 w-2.5" /> Tył
        </span>
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
          <label className="text-xs text-muted-foreground block mb-1">Port tył na docelowym panelu</label>
          {freePorts.length === 0
            ? <p className="text-xs text-amber-600 bg-amber-500/10 rounded px-2 py-1.5 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Brak wolnych portów tył</p>
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
          placeholder="np. Kabel #12, OS1 rura A…"
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
      </div>

      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Anuluj</button>
        <button onClick={() => mut.mutate()} disabled={!targetPortId || mut.isPending}
          className="rounded bg-amber-500 px-3 py-1.5 text-xs text-white disabled:opacity-50">
          {mut.isPending ? 'Łączenie…' : 'Utwórz połączenie tył–tył'}
        </button>
      </div>
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
    select: r => r.data,
  })

  const disconnectMut = useMutation({
    mutationFn: (id: number) => patchPanelConnectionsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['patch-panels'] }); toast.success('Połączenie usunięte') },
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
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Ładowanie…</div>
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
      <div className="p-4 space-y-6 max-w-6xl mx-auto">
        {/* Legenda */}
        <div className="flex items-center gap-4">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Patch Panele</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{panels.length} paneli</span>
          <div className="ml-auto flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border-2 border-blue-400 bg-blue-400/20" />
              Przód → urządzenie
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border-2 border-amber-400 bg-amber-400/20" />
              Tył → patch panel
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border border-border bg-muted/30" />
              Wolny
            </span>
          </div>
        </div>

        {Object.entries(bySite).map(([siteName, sitePanels]) => (
          <div key={siteName} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{siteName}</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
            {sitePanels.map(panel => (
              <PanelRack
                key={panel.id}
                panel={panel}
                allPanels={panels}
                projectId={projectId}
                onConnect={(p, port, side) => setConnectTarget({ panel: p, port, side })}
                onDisconnect={id => { if (window.confirm('Usunąć połączenie?')) disconnectMut.mutate(id) }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Dialogi */}
      <Dialog
        open={!!connectTarget}
        onOpenChange={o => { if (!o) setConnectTarget(null) }}
        title={connectTarget?.side === 'back'
          ? `Połącz tył — ${connectTarget?.panel.name} Port ${connectTarget?.port.port_number}`
          : `Połącz przód — ${connectTarget?.panel.name} Port ${connectTarget?.port.port_number}`}
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
