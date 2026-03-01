/**
 * RackElevation — czysty widok szafy rack
 * - Zmiana rozmiaru szafy (+/- U)
 * - Bogaty tooltip ze szczegółami urządzenia
 * - Kliknięcie pustego slotu → dodawanie urządzenia
 * - Usuwanie urządzenia przez X
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rackUnitsApi, racksApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  X, Plus, Minus, Server, Cable, Cpu, Battery, Package,
  Network, MapPin, Tag, Hash, Layers, AlertCircle,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import type { Rack, RackUnit } from '@/types'

// ─── Konfiguracja typów urządzeń ──────────────────────────────────────────────

const TYPE_CFG: Record<string, {
  accent: string; bg: string; text: string; icon: typeof Server; label: string
}> = {
  device:      { accent: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  text: '#93c5fd', icon: Server,  label: 'Device'       },
  patch_panel: { accent: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  text: '#fde68a', icon: Cable,   label: 'Patch Panel'  },
  cable_mgmt:  { accent: '#6b7280', bg: 'rgba(107,114,128,0.12)', text: '#d1d5db', icon: Cable,   label: 'Cable Mgmt'   },
  blank:       { accent: '#374151', bg: 'rgba(55,65,81,0.15)',    text: '#6b7280', icon: Package, label: 'Blank'        },
  pdu:         { accent: '#ea580c', bg: 'rgba(234,88,12,0.12)',   text: '#fdba74', icon: Battery, label: 'PDU'          },
  ups:         { accent: '#16a34a', bg: 'rgba(22,163,74,0.12)',   text: '#86efac', icon: Battery, label: 'UPS'          },
  other:       { accent: '#7c3aed', bg: 'rgba(124,58,237,0.12)',  text: '#c4b5fd', icon: Cpu,     label: 'Other'        },
}

const U_PX = 28

// ─── Tooltip ze szczegółami ───────────────────────────────────────────────────

interface TooltipProps { unit: RackUnit; x: number; y: number }

function UnitTooltip({ unit, x, y }: TooltipProps) {
  const cfg = TYPE_CFG[unit.item_type] ?? TYPE_CFG.other
  const Icon = cfg.icon
  const name = unit.host_name || unit.patch_panel_name || unit.label || cfg.label

  // Pozycja: trzymaj po prawej, ale nie wychodź za ekran
  const left = Math.min(x + 18, window.innerWidth - 280)
  const top  = Math.max(8, Math.min(y - 20, window.innerHeight - 200))

  return (
    <div className="fixed z-[9999] pointer-events-none"
      style={{ left, top }}>
      <div className="w-64 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden text-xs">
        {/* Nagłówek z kolorem typu */}
        <div className="px-3 py-2.5 flex items-center gap-2.5"
          style={{ background: cfg.accent + '22', borderBottom: `1px solid ${cfg.accent}44` }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: cfg.accent + '33', border: `1px solid ${cfg.accent}55` }}>
            <Icon className="h-3.5 w-3.5" style={{ color: cfg.accent }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate leading-tight">{name}</p>
            <p className="text-[10px] mt-0.5" style={{ color: cfg.accent }}>
              {cfg.label} · U{unit.position_u}
              {unit.height_u > 1 ? `–U${unit.position_u + unit.height_u - 1}` : ''} · {unit.face}
            </p>
          </div>
        </div>

        {/* Szczegóły */}
        <div className="px-3 py-2 space-y-1.5">
          {unit.host_ip && (
            <Row icon={<Network className="h-3 w-3" />} label="IP" value={unit.host_ip} mono />
          )}
          {unit.host_model_name && (
            <Row icon={<Tag className="h-3 w-3" />} label="Model" value={unit.host_model_name} />
          )}
          {unit.host_device_type && (
            <Row icon={<Hash className="h-3 w-3" />} label="Type"
              value={unit.host_device_type.replace(/_/g, ' ')} capitalize />
          )}
          {unit.patch_panel_media_type && (
            <Row icon={<Layers className="h-3 w-3" />} label="Media"
              value={unit.patch_panel_media_type.replace(/_/g, ' ')} />
          )}
          {unit.label && unit.label !== name && (
            <Row icon={<Tag className="h-3 w-3" />} label="Note" value={unit.label} />
          )}
          {!unit.host_ip && !unit.host_model_name && !unit.patch_panel_media_type && !unit.label && (
            <p className="text-muted-foreground text-[10px] italic">Brak dodatkowych szczegółów</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ icon, label, value, mono, capitalize }: {
  icon: React.ReactNode; label: string; value: string; mono?: boolean; capitalize?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground shrink-0 w-10">{label}</span>
      <span className={cn(
        'text-foreground truncate',
        mono && 'font-mono',
        capitalize && 'capitalize',
      )}>{value}</span>
    </div>
  )
}

// ─── Zmiana rozmiaru szafy ────────────────────────────────────────────────────

function ResizeBar({ rack }: { rack: Rack }) {
  const queryClient = useQueryClient()

  const mut = useMutation({
    mutationFn: (h: number) => racksApi.update(rack.id, { height_u: h }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['racks'] }),
    onError: () => toast.error('Nie można zmienić rozmiaru'),
  })

  const minH = Math.max(rack.used_u, 1)

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => mut.mutate(Math.max(minH, rack.height_u - 1))}
        disabled={rack.height_u <= minH || mut.isPending}
        className="w-6 h-6 rounded border border-border/60 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
        title="Zmniejsz (-1U)"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="text-[11px] font-mono text-foreground tabular-nums w-8 text-center">{rack.height_u}U</span>
      <button
        onClick={() => mut.mutate(rack.height_u + 1)}
        disabled={mut.isPending}
        className="w-6 h-6 rounded border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
        title="Zwiększ (+1U)"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  )
}

// ─── Dialog dodawania urządzenia ──────────────────────────────────────────────

const ITEM_TYPES = [
  { value: 'device',      label: 'Device / Host' },
  { value: 'patch_panel', label: 'Patch Panel' },
  { value: 'cable_mgmt',  label: 'Cable Management' },
  { value: 'blank',       label: 'Blank Panel' },
  { value: 'pdu',         label: 'PDU' },
  { value: 'ups',         label: 'UPS' },
  { value: 'other',       label: 'Other' },
]

function AddUnitDialog({
  rack, positionU, freeSlots, hosts, panels, onClose,
}: {
  rack: Rack; positionU: number; freeSlots: number
  hosts: { id: number; name: string; ip: string }[]
  panels: { id: number; name: string }[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [itemType, setItemType] = useState('device')
  const [hostId, setHostId] = useState('')
  const [panelId, setPanelId] = useState('')
  const [label, setLabel] = useState('')
  const [heightU, setHeightU] = useState(1)
  const [face, setFace] = useState<'front' | 'rear'>('front')

  const mut = useMutation({
    mutationFn: () => rackUnitsApi.create({
      rack: rack.id, item_type: itemType as RackUnit['item_type'],
      position_u: positionU, height_u: heightU, face, label,
      host: itemType === 'device' && hostId ? Number(hostId) : undefined,
      patch_panel: itemType === 'patch_panel' && panelId ? Number(panelId) : undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['racks'] }); toast.success('Dodano do szafy'); onClose() },
    onError: () => toast.error('Błąd dodawania'),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs flex items-center gap-3">
        <span className="font-mono font-bold text-primary">U{positionU}</span>
        <span className="text-muted-foreground">w {rack.name}</span>
        <span className="ml-auto text-muted-foreground">{freeSlots}U wolne</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Typ</label>
          <select value={itemType} onChange={e => setItemType(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
            {ITEM_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Wysokość (U)</label>
          <input type="number" min={1} max={Math.min(freeSlots, 20)} value={heightU}
            onChange={e => setHeightU(Number(e.target.value))}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
        </div>
      </div>

      {itemType === 'device' && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Host / Urządzenie</label>
          <select value={hostId} onChange={e => setHostId(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
            <option value="">— Niezarządzane / własna etykieta —</option>
            {hosts.map(h => <option key={h.id} value={h.id}>{h.name} ({h.ip})</option>)}
          </select>
        </div>
      )}

      {itemType === 'patch_panel' && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Patch Panel</label>
          {panels.length === 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Brak patch paneli. Dodaj je w Ustawienia → Patch Panels.
            </div>
          ) : (
            <select value={panelId} onChange={e => setPanelId(e.target.value)}
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
              <option value="">— Wybierz panel —</option>
              {panels.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          {itemType === 'device' && !hostId ? 'Etykieta (nazwa urządzenia)' : 'Etykieta / notatka (opcjonalne)'}
        </label>
        <input value={label} onChange={e => setLabel(e.target.value)}
          placeholder="np. Core Switch 01"
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Strona montażu</label>
        <div className="flex gap-2">
          {(['front', 'rear'] as const).map(f => (
            <button key={f} onClick={() => setFace(f)}
              className={cn(
                'flex-1 rounded border py-1.5 text-xs capitalize transition-colors',
                face === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent',
              )}>
              {f === 'front' ? 'Przód' : 'Tył'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">
          Anuluj
        </button>
        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
          {mut.isPending ? 'Dodawanie…' : 'Dodaj do szafy'}
        </button>
      </div>
    </div>
  )
}

// ─── Główny komponent RackElevation ──────────────────────────────────────────

interface Props {
  rack: Rack
  hosts: { id: number; name: string; ip: string }[]
  panels: { id: number; name: string }[]
}

export function RackElevation({ rack, hosts, panels }: Props) {
  const queryClient = useQueryClient()
  const [addAt, setAddAt] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<TooltipProps | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const deleteMut = useMutation({
    mutationFn: (id: number) => rackUnitsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['racks'] }); toast.success('Usunięto z szafy') },
  })

  // Mapa: positionU → RackUnit
  const slotMap = useMemo(() => {
    const m = new Map<number, RackUnit>()
    for (const u of rack.rack_units)
      for (let i = 0; i < u.height_u; i++) m.set(u.position_u + i, u)
    return m
  }, [rack.rack_units])

  // Wiersze do wyświetlenia
  const rows = useMemo(() => {
    const rendered = new Set<number>()
    const result: { u: number; unit: RackUnit | null }[] = []
    const uRange = rack.numbering_desc
      ? Array.from({ length: rack.height_u }, (_, i) => rack.height_u - i)
      : Array.from({ length: rack.height_u }, (_, i) => i + 1)
    for (const u of uRange) {
      const unit = slotMap.get(u) ?? null
      if (unit) { if (rendered.has(unit.id)) continue; rendered.add(unit.id) }
      result.push({ u, unit })
    }
    return result
  }, [rack, slotMap])

  const freeFrom = (startU: number) => {
    let n = 0
    for (let u = startU; u <= rack.height_u; u++) { if (!slotMap.has(u)) n++; else break }
    return n
  }

  const freeU = rack.height_u - rack.used_u
  const utilPct = rack.height_u > 0 ? (rack.used_u / rack.height_u) * 100 : 0
  const utilColor = utilPct > 90 ? '#ef4444' : utilPct > 70 ? '#f59e0b' : '#22c55e'

  const showTooltip = (unit: RackUnit, e: React.MouseEvent) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setTooltip({ unit, x: e.clientX, y: e.clientY }), 250)
  }
  const moveTooltip = (e: React.MouseEvent) => {
    if (tooltip) setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)
  }
  const hideTooltip = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setTooltip(null)
  }

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }, [])

  return (
    <div className="select-none" style={{ width: 288 }}>

      {/* ── Nagłówek szafy ── */}
      <div className="mb-3 space-y-2">
        {/* Nazwa + status */}
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-foreground truncate flex-1">{rack.name}</h3>
          {rack.facility_id && (
            <span className="text-[10px] font-mono bg-muted border border-border/60 rounded px-1.5 py-0.5 shrink-0">
              {rack.facility_id}
            </span>
          )}
          <span className={cn(
            'text-[10px] rounded-full px-2 py-0.5 font-medium capitalize shrink-0',
            rack.status === 'active'  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
            rack.status === 'planned' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
            'bg-muted text-muted-foreground',
          )}>{rack.status}</span>
        </div>

        {/* Lokalizacja + wolne U */}
        <div className="flex items-center gap-3 text-[11px]">
          {rack.location && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />{rack.location}
            </span>
          )}
          <span className={cn('font-medium', freeU > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
            {freeU}U wolne
          </span>
          <span className="text-muted-foreground/50">·</span>
          <ResizeBar rack={rack} />
        </div>

        {/* Pasek wykorzystania */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${utilPct}%`, backgroundColor: utilColor }} />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">
            {Math.round(utilPct)}%
          </span>
        </div>
      </div>

      {/* ── Wizualizacja szafy ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: '#0f172a',
          border: '2px solid #334155',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Górna listwa */}
        <div className="h-5 flex items-center justify-between px-3"
          style={{ background: 'linear-gradient(180deg, #475569 0%, #334155 100%)', borderBottom: '1px solid #1e293b' }}>
          <div className="flex gap-2 items-center">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-sm" style={{ width: 8, height: 4, background: '#64748b' }} />
            ))}
          </div>
          <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>
            {rack.name}
          </span>
          <div className="flex gap-2 items-center">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-sm" style={{ width: 8, height: 4, background: '#64748b' }} />
            ))}
          </div>
        </div>

        {/* Szyny + sloty */}
        <div className="flex">
          {/* Lewa szyna z numerami U */}
          <div className="flex flex-col shrink-0"
            style={{ width: 32, background: '#1e293b', borderRight: '1px solid #334155' }}>
            {rows.map(({ u, unit }) => (
              <div
                key={u}
                className="flex items-center justify-center shrink-0"
                style={{
                  height: (unit?.height_u ?? 1) * U_PX,
                  fontSize: 9,
                  fontFamily: 'monospace',
                  color: '#475569',
                  borderBottom: '1px solid #0f172a',
                }}
              >
                {u}
              </div>
            ))}
          </div>

          {/* Sloty urządzeń */}
          <div className="flex flex-col flex-1 min-w-0">
            {rows.map(({ u, unit }) => {
              const h = (unit?.height_u ?? 1) * U_PX

              if (unit) {
                const cfg = TYPE_CFG[unit.item_type] ?? TYPE_CFG.other
                const Icon = cfg.icon
                const name = unit.host_name || unit.patch_panel_name || unit.label || cfg.label

                return (
                  <div
                    key={u}
                    className="group relative flex items-center gap-2 px-2.5 shrink-0 cursor-default"
                    style={{
                      height: h,
                      background: cfg.bg,
                      borderLeft: `3px solid ${cfg.accent}`,
                      borderBottom: '1px solid #0f172a',
                    }}
                    onMouseEnter={e => showTooltip(unit, e)}
                    onMouseMove={moveTooltip}
                    onMouseLeave={hideTooltip}
                  >
                    {/* Ikona */}
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: cfg.accent }} />

                    {/* Nazwa */}
                    <span className="text-[11px] font-medium truncate flex-1 leading-tight"
                      style={{ color: cfg.text }}>
                      {name}
                    </span>

                    {/* IP — pokazuj tylko przy hover */}
                    {unit.host_ip && (
                      <span
                        className="text-[9px] font-mono opacity-0 group-hover:opacity-70 transition-opacity shrink-0 pr-5"
                        style={{ color: '#94a3b8' }}
                      >
                        {unit.host_ip}
                      </span>
                    )}

                    {/* Przycisk usuwania */}
                    <button
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(15,23,42,0.85)' }}
                      onClick={e => {
                        e.stopPropagation()
                        hideTooltip()
                        if (window.confirm(`Usunąć "${name}" z szafy?`)) deleteMut.mutate(unit.id)
                      }}
                      title="Usuń"
                    >
                      <X className="h-3 w-3" style={{ color: '#94a3b8' }} />
                    </button>
                  </div>
                )
              }

              // Pusty slot
              return (
                <div
                  key={u}
                  className="group relative flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                  style={{
                    height: h,
                    borderBottom: '1px solid #0f172a',
                  }}
                  onMouseEnter={hideTooltip}
                  onClick={() => setAddAt(u)}
                >
                  {/* Tło hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(51,65,85,0.4)' }} />
                  {/* Ikona + label */}
                  <div className="relative z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="h-3 w-3" style={{ color: '#475569' }} />
                    <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>U{u}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Prawa szyna */}
          <div className="shrink-0"
            style={{ width: 10, background: '#1e293b', borderLeft: '1px solid #334155' }} />
        </div>

        {/* Dolna listwa */}
        <div className="h-5 flex items-center px-3"
          style={{ background: 'linear-gradient(0deg, #475569 0%, #334155 100%)', borderTop: '1px solid #1e293b' }}>
          <div className="flex gap-2 items-center">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-sm" style={{ width: 8, height: 4, background: '#64748b' }} />
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex gap-2 items-center">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-sm" style={{ width: 8, height: 4, background: '#64748b' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && <UnitTooltip {...tooltip} />}

      {/* Dialog dodawania */}
      <Dialog
        open={addAt !== null}
        onOpenChange={o => { if (!o) setAddAt(null) }}
        title={`Dodaj do szafy — U${addAt}`}
      >
        {addAt !== null && (
          <AddUnitDialog
            rack={rack}
            positionU={addAt}
            freeSlots={freeFrom(addAt)}
            hosts={hosts}
            panels={panels}
            onClose={() => setAddAt(null)}
          />
        )}
      </Dialog>
    </div>
  )
}
